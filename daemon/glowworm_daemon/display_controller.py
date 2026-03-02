"""
Display Controller for GlowWorm Daemon.

Manages the Pi3D display subprocess, including spawning, IPC communication,
health monitoring, crash detection, and auto-restart.
"""

import asyncio
import json
import logging
import os
import signal
import sys
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Callable

logger = logging.getLogger(__name__)


class DisplayState(str, Enum):
    """State of the display controller."""

    STOPPED = "stopped"
    STARTING = "starting"
    RUNNING = "running"
    STOPPING = "stopping"
    CRASHED = "crashed"
    RESTARTING = "restarting"


@dataclass
class DisplayControllerConfig:
    """Configuration for the display controller."""

    # Path to the glowworm-display command or Python module
    display_command: list[str] = field(
        default_factory=lambda: [sys.executable, "-m", "glowworm_display"]
    )

    # Path to Unix socket for IPC
    socket_path: str = "/run/glowworm/display.sock"

    # Use cage Wayland compositor (required on Pi5/headless without X11)
    use_cage: bool = True
    cage_command: str = "cage"

    # Health check interval in seconds
    health_check_interval: float = 5.0

    # Startup timeout in seconds
    startup_timeout: float = 30.0

    # Number of consecutive health check failures before considering crashed
    health_check_failures_threshold: int = 3

    # Auto-restart on crash
    auto_restart: bool = True

    # Maximum restart attempts before giving up
    max_restart_attempts: int = 5

    # Delay between restart attempts (with exponential backoff)
    restart_base_delay: float = 1.0
    restart_max_delay: float = 60.0

    # Shutdown timeout in seconds
    shutdown_timeout: float = 10.0

    # Additional environment variables for subprocess
    extra_env: dict[str, str] = field(default_factory=dict)

    # Display-specific configuration to pass to subprocess
    mock_mode: bool = False
    config_file: str | None = None

    # Display configuration as JSON (from UnifiedConfig.get_display_config_json())
    # If set, passed via GLOWWORM_DISPLAY_CONFIG environment variable
    display_config_json: str | None = None

    @classmethod
    def from_unified_config(cls, unified_config) -> "DisplayControllerConfig":
        """
        Create DisplayControllerConfig from a UnifiedConfig instance.

        Args:
            unified_config: UnifiedConfig instance

        Returns:
            DisplayControllerConfig with settings from UnifiedConfig
        """
        return cls(
            socket_path=unified_config.ipc.socket_path,
            display_config_json=unified_config.get_display_config_json(),
        )


# Type for state change callbacks
StateChangeCallback = Callable[[DisplayState, DisplayState], None]
NotificationCallback = Callable[[str, dict[str, Any]], None]


@dataclass
class IPCResponse:
    """Response from an IPC call."""

    success: bool
    result: dict[str, Any] | None = None
    error: dict[str, Any] | None = None
    request_id: int | None = None


class IPCClient:
    """
    JSON-RPC 2.0 client for communicating with the display subprocess.

    Connects to a Unix domain socket and sends/receives JSON-RPC messages.
    """

    def __init__(self, socket_path: str, timeout: float = 5.0) -> None:
        """
        Initialize the IPC client.

        Args:
            socket_path: Path to the Unix socket
            timeout: Request timeout in seconds
        """
        self.socket_path = socket_path
        self.timeout = timeout
        self._reader: asyncio.StreamReader | None = None
        self._writer: asyncio.StreamWriter | None = None
        self._request_id = 0
        self._connected = False
        self._lock = asyncio.Lock()
        self._notification_callbacks: list[NotificationCallback] = []

    @property
    def is_connected(self) -> bool:
        """Check if connected to the server."""
        return self._connected

    def add_notification_callback(self, callback: NotificationCallback) -> None:
        """
        Add a callback for notifications received from the display.

        Args:
            callback: Function called with (method, params) on notifications
        """
        self._notification_callbacks.append(callback)

    async def connect(self) -> bool:
        """
        Connect to the IPC server.

        Returns:
            True if connection successful, False otherwise
        """
        try:
            self._reader, self._writer = await asyncio.wait_for(
                asyncio.open_unix_connection(self.socket_path),
                timeout=self.timeout,
            )
            self._connected = True
            logger.info(f"IPC client connected to {self.socket_path}")
            return True
        except FileNotFoundError:
            logger.debug(f"Socket not found: {self.socket_path}")
            return False
        except ConnectionRefusedError:
            logger.debug(f"Connection refused: {self.socket_path}")
            return False
        except asyncio.TimeoutError:
            logger.warning(f"Connection timeout: {self.socket_path}")
            return False
        except Exception as e:
            logger.warning(f"Failed to connect: {e}")
            return False

    async def disconnect(self) -> None:
        """Disconnect from the IPC server."""
        self._connected = False
        if self._writer:
            try:
                self._writer.close()
                await self._writer.wait_closed()
            except Exception as e:
                logger.debug(f"Error closing connection: {e}")
            finally:
                self._writer = None
                self._reader = None
        logger.debug("IPC client disconnected")

    async def call(
        self, method: str, params: dict[str, Any] | None = None
    ) -> IPCResponse:
        """
        Call a JSON-RPC method.

        Args:
            method: Method name to call
            params: Optional parameters

        Returns:
            IPCResponse with result or error
        """
        if not self._connected:
            return IPCResponse(
                success=False,
                error={"code": -1, "message": "Not connected"},
            )

        async with self._lock:
            self._request_id += 1
            request_id = self._request_id

            request = {
                "jsonrpc": "2.0",
                "method": method,
                "params": params or {},
                "id": request_id,
            }

            try:
                # Send request
                data = json.dumps(request) + "\n"
                self._writer.write(data.encode("utf-8"))
                await asyncio.wait_for(
                    self._writer.drain(),
                    timeout=self.timeout,
                )

                # Read response, skipping any notifications
                while True:
                    line = await asyncio.wait_for(
                        self._reader.readline(),
                        timeout=self.timeout,
                    )

                    if not line:
                        # Connection closed
                        self._connected = False
                        return IPCResponse(
                            success=False,
                            error={"code": -1, "message": "Connection closed"},
                        )

                    message = json.loads(line.decode("utf-8"))

                    # Check if it's a notification (no id field)
                    if "id" not in message:
                        # Handle notification
                        self._handle_notification(message)
                        continue

                    # This is the response we're waiting for
                    if message.get("id") != request_id:
                        logger.warning(
                            f"Unexpected response id: {message.get('id')}, "
                            f"expected: {request_id}"
                        )
                        continue

                    if "error" in message:
                        return IPCResponse(
                            success=False,
                            error=message["error"],
                            request_id=request_id,
                        )

                    return IPCResponse(
                        success=True,
                        result=message.get("result", {}),
                        request_id=request_id,
                    )

            except asyncio.TimeoutError:
                logger.warning(f"Request timeout: {method}")
                return IPCResponse(
                    success=False,
                    error={"code": -1, "message": "Request timeout"},
                    request_id=request_id,
                )
            except json.JSONDecodeError as e:
                logger.warning(f"Invalid JSON response: {e}")
                return IPCResponse(
                    success=False,
                    error={"code": -1, "message": f"Invalid JSON: {e}"},
                    request_id=request_id,
                )
            except Exception as e:
                logger.warning(f"IPC call error: {e}")
                self._connected = False
                return IPCResponse(
                    success=False,
                    error={"code": -1, "message": str(e)},
                    request_id=request_id,
                )

    def _handle_notification(self, message: dict[str, Any]) -> None:
        """Handle a notification from the server."""
        method = message.get("method", "")
        params = message.get("params", {})
        logger.debug(f"Received notification: {method}")

        for callback in self._notification_callbacks:
            try:
                callback(method, params)
            except Exception as e:
                logger.warning(f"Notification callback error: {e}")


class DisplayController:
    """
    Manages the Pi3D display subprocess.

    Handles subprocess spawning, IPC communication, health monitoring,
    crash detection, and auto-restart.

    Usage:
        controller = DisplayController(config)
        await controller.start()

        # Send commands
        status = await controller.get_status()
        await controller.load_image("/path/to/image.jpg")

        # Stop gracefully
        await controller.stop()
    """

    def __init__(
        self,
        config: DisplayControllerConfig | None = None,
    ) -> None:
        """
        Initialize the display controller.

        Args:
            config: Controller configuration
        """
        self.config = config or DisplayControllerConfig()
        self._state = DisplayState.STOPPED
        self._process: asyncio.subprocess.Process | None = None
        self._ipc_client: IPCClient | None = None
        self._health_task: asyncio.Task | None = None
        self._restart_count = 0
        self._consecutive_health_failures = 0
        self._last_status: dict[str, Any] | None = None
        self._started_at: float | None = None
        self._state_callbacks: list[StateChangeCallback] = []
        self._notification_callbacks: list[NotificationCallback] = []

        logger.info(
            f"DisplayController initialized: socket={self.config.socket_path}"
        )

    @property
    def state(self) -> DisplayState:
        """Get the current controller state."""
        return self._state

    @property
    def is_running(self) -> bool:
        """Check if the display is running."""
        return self._state == DisplayState.RUNNING

    @property
    def restart_count(self) -> int:
        """Get the number of restarts since start."""
        return self._restart_count

    @property
    def uptime(self) -> float | None:
        """Get display uptime in seconds, or None if not running."""
        if self._started_at and self._state == DisplayState.RUNNING:
            return time.time() - self._started_at
        return None

    @property
    def last_status(self) -> dict[str, Any] | None:
        """Get the last status retrieved from the display."""
        return self._last_status

    def add_state_callback(self, callback: StateChangeCallback) -> None:
        """
        Add a callback for state changes.

        Args:
            callback: Function called with (old_state, new_state)
        """
        self._state_callbacks.append(callback)

    def add_notification_callback(self, callback: NotificationCallback) -> None:
        """
        Add a callback for notifications from the display.

        Args:
            callback: Function called with (method, params)
        """
        self._notification_callbacks.append(callback)

    def _set_state(self, new_state: DisplayState) -> None:
        """Set the state and notify callbacks."""
        if new_state == self._state:
            return

        old_state = self._state
        self._state = new_state
        logger.info(f"Display state: {old_state.value} -> {new_state.value}")

        for callback in self._state_callbacks:
            try:
                callback(old_state, new_state)
            except Exception as e:
                logger.warning(f"State callback error: {e}")

    async def start(self) -> bool:
        """
        Start the display subprocess.

        Returns:
            True if started successfully, False otherwise
        """
        if self._state in (DisplayState.RUNNING, DisplayState.STARTING):
            logger.warning("Display already starting or running")
            return True

        self._set_state(DisplayState.STARTING)
        self._restart_count = 0

        return await self._start_process()

    async def _start_process(self) -> bool:
        """Start the subprocess and establish IPC connection."""
        print("DisplayController._start_process() called", flush=True)
        try:
            # Build display command
            display_cmd = list(self.config.display_command)
            display_cmd.extend(["--socket", self.config.socket_path])

            if self.config.mock_mode:
                display_cmd.append("--mock")

            if self.config.config_file:
                display_cmd.extend(["--config", self.config.config_file])

            # Wrap with cage if enabled (required on Pi5/headless)
            if self.config.use_cage:
                cmd = [self.config.cage_command, "--"] + display_cmd
            else:
                cmd = display_cmd

            # Build environment
            env = os.environ.copy()
            env.update(self.config.extra_env)

            # Set XDG_RUNTIME_DIR for cage/Wayland
            if self.config.use_cage and "XDG_RUNTIME_DIR" not in env:
                runtime_dir = "/run/user/0"
                os.makedirs(runtime_dir, mode=0o700, exist_ok=True)
                env["XDG_RUNTIME_DIR"] = runtime_dir

            # Set SDL2/Wayland environment variables for Pi3D
            # These are required for Pi3D's SDL2 backend to work with Cage compositor
            if self.config.use_cage:
                # Force SDL2 to use Wayland backend (not X11 or KMSDRM)
                env["SDL_VIDEODRIVER"] = "wayland"
                # Use OpenGL ES 2.0 renderer (required for Pi GPU)
                env["SDL_RENDER_DRIVER"] = "opengles2"
                # IMPORTANT: Do NOT set WAYLAND_DISPLAY here - cage will set it for the child process
                # If WAYLAND_DISPLAY is set in the parent environment, cage tries to nest
                # under that compositor instead of using DRM backend directly
                env.pop("WAYLAND_DISPLAY", None)
                env.pop("DISPLAY", None)  # Also remove X11 display

            # Pass display config via environment variable if provided
            if self.config.display_config_json:
                env["GLOWWORM_DISPLAY_CONFIG"] = self.config.display_config_json

            # Remove stale socket if it exists
            socket_path = Path(self.config.socket_path)
            if socket_path.exists():
                logger.debug(f"Removing stale socket: {socket_path}")
                socket_path.unlink()

            print(f"Starting display process: {' '.join(cmd)}", flush=True)
            logger.info(f"Starting display process: {' '.join(cmd)}")

            # Start subprocess
            self._process = await asyncio.create_subprocess_exec(
                *cmd,
                env=env,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            print(f"Display process started: PID {self._process.pid}", flush=True)
            logger.info(f"Display process started: PID {self._process.pid}")

            # Wait for IPC socket to be available
            print("Waiting for IPC socket...", flush=True)
            if not await self._wait_for_socket():
                # Read any subprocess output for debugging
                if self._process.stdout:
                    stdout = await self._process.stdout.read()
                    if stdout:
                        print(f"Display stdout: {stdout.decode()}", flush=True)
                if self._process.stderr:
                    stderr = await self._process.stderr.read()
                    if stderr:
                        print(f"Display stderr: {stderr.decode()}", flush=True)
                logger.error("Timeout waiting for display socket")
                print("Timeout waiting for display socket", flush=True)
                await self._kill_process()
                self._set_state(DisplayState.CRASHED)
                return False

            # Connect IPC client with retries (cage takes time to start)
            self._ipc_client = IPCClient(
                self.config.socket_path,
                timeout=self.config.health_check_interval,
            )

            # Add notification handler
            for callback in self._notification_callbacks:
                self._ipc_client.add_notification_callback(callback)

            # Retry IPC connection (display inside cage may take a moment)
            max_connect_attempts = 10
            for attempt in range(max_connect_attempts):
                if await self._ipc_client.connect():
                    logger.info(f"IPC connected on attempt {attempt + 1}")
                    break
                logger.debug(f"IPC connect attempt {attempt + 1}/{max_connect_attempts} failed, retrying...")
                await asyncio.sleep(1.0)
            else:
                logger.error(f"Failed to connect IPC client after {max_connect_attempts} attempts")
                await self._kill_process()
                self._set_state(DisplayState.CRASHED)
                return False

            # Verify display is responding
            response = await self._ipc_client.call("get_status")
            if not response.success:
                logger.error(f"Initial status check failed: {response.error}")
                await self._kill_process()
                self._set_state(DisplayState.CRASHED)
                return False

            self._last_status = response.result
            self._started_at = time.time()
            self._consecutive_health_failures = 0
            self._set_state(DisplayState.RUNNING)

            # Start health monitoring
            self._health_task = asyncio.create_task(self._health_monitor())

            logger.info("Display started successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to start display: {e}")
            self._set_state(DisplayState.CRASHED)
            return False

    async def _wait_for_socket(self) -> bool:
        """Wait for the IPC socket to become available."""
        socket_path = Path(self.config.socket_path)
        start_time = time.time()

        while time.time() - start_time < self.config.startup_timeout:
            # Check if process is still alive
            if self._process.returncode is not None:
                logger.error(
                    f"Display process exited with code {self._process.returncode}"
                )
                return False

            if socket_path.exists():
                logger.debug("Display socket is available")
                return True

            await asyncio.sleep(0.1)

        return False

    async def stop(self) -> None:
        """Stop the display subprocess gracefully."""
        if self._state in (DisplayState.STOPPED, DisplayState.STOPPING):
            return

        self._set_state(DisplayState.STOPPING)

        # Cancel health monitoring
        if self._health_task:
            self._health_task.cancel()
            try:
                await self._health_task
            except asyncio.CancelledError:
                pass
            self._health_task = None

        # Disconnect IPC client
        if self._ipc_client:
            await self._ipc_client.disconnect()
            self._ipc_client = None

        # Stop subprocess
        await self._stop_process()

        self._started_at = None
        self._set_state(DisplayState.STOPPED)
        logger.info("Display stopped")

    async def _stop_process(self) -> None:
        """Stop the subprocess with graceful shutdown."""
        if not self._process:
            return

        # Try graceful shutdown first
        try:
            self._process.terminate()
            try:
                await asyncio.wait_for(
                    self._process.wait(),
                    timeout=self.config.shutdown_timeout,
                )
                logger.debug("Display process terminated gracefully")
                return
            except asyncio.TimeoutError:
                logger.warning("Graceful shutdown timeout, killing process")
        except ProcessLookupError:
            # Process already dead
            return

        # Force kill
        await self._kill_process()

    async def _kill_process(self) -> None:
        """Force kill the subprocess."""
        if not self._process:
            return

        try:
            self._process.kill()
            await self._process.wait()
            logger.debug("Display process killed")
        except ProcessLookupError:
            # Process already dead
            pass
        finally:
            self._process = None

    async def restart(self) -> bool:
        """
        Restart the display subprocess.

        Returns:
            True if restart successful, False otherwise
        """
        logger.info("Restarting display...")
        self._set_state(DisplayState.RESTARTING)

        # Stop current process
        if self._health_task:
            self._health_task.cancel()
            try:
                await self._health_task
            except asyncio.CancelledError:
                pass
            self._health_task = None

        if self._ipc_client:
            await self._ipc_client.disconnect()
            self._ipc_client = None

        await self._stop_process()

        # Increment restart count
        self._restart_count += 1

        # Calculate backoff delay
        delay = min(
            self.config.restart_base_delay * (2 ** (self._restart_count - 1)),
            self.config.restart_max_delay,
        )
        logger.info(f"Waiting {delay:.1f}s before restart (attempt {self._restart_count})")
        await asyncio.sleep(delay)

        # Start new process
        return await self._start_process()

    async def _health_monitor(self) -> None:
        """Background task to monitor display health."""
        logger.debug("Health monitor started")

        try:
            while self._state == DisplayState.RUNNING:
                await asyncio.sleep(self.config.health_check_interval)

                if self._state != DisplayState.RUNNING:
                    break

                # Check process health
                if self._process and self._process.returncode is not None:
                    print(f"Display process crashed with code {self._process.returncode}", flush=True)
                    # Try to get any remaining output
                    if self._process.stderr:
                        try:
                            stderr = await asyncio.wait_for(self._process.stderr.read(), timeout=1.0)
                            if stderr:
                                print(f"Display stderr: {stderr.decode()}", flush=True)
                        except:
                            pass
                    logger.error(
                        f"Display process crashed with code {self._process.returncode}"
                    )
                    await self._handle_crash()
                    break

                # Check IPC health
                if self._ipc_client and self._ipc_client.is_connected:
                    response = await self._ipc_client.call("get_status")
                    if response.success:
                        self._last_status = response.result
                        self._consecutive_health_failures = 0
                    else:
                        self._consecutive_health_failures += 1
                        logger.warning(
                            f"Health check failed "
                            f"({self._consecutive_health_failures}/"
                            f"{self.config.health_check_failures_threshold})"
                        )

                        if (
                            self._consecutive_health_failures
                            >= self.config.health_check_failures_threshold
                        ):
                            logger.error("Too many health check failures")
                            await self._handle_crash()
                            break
                else:
                    # Connection lost
                    logger.warning("IPC connection lost")
                    self._consecutive_health_failures += 1

                    if (
                        self._consecutive_health_failures
                        >= self.config.health_check_failures_threshold
                    ):
                        await self._handle_crash()
                        break

        except asyncio.CancelledError:
            logger.debug("Health monitor cancelled")
            raise
        except Exception as e:
            logger.error(f"Health monitor error: {e}")

    async def _handle_crash(self) -> None:
        """Handle a detected crash."""
        self._set_state(DisplayState.CRASHED)

        if not self.config.auto_restart:
            logger.info("Auto-restart disabled, not restarting")
            return

        if self._restart_count >= self.config.max_restart_attempts:
            logger.error(
                f"Max restart attempts ({self.config.max_restart_attempts}) "
                "reached, giving up"
            )
            return

        # Attempt restart
        success = await self.restart()
        if not success:
            logger.error("Restart failed")

    # IPC command methods

    async def get_status(self) -> dict[str, Any] | None:
        """
        Get current display status.

        Returns:
            Status dict or None if not connected
        """
        if not self._ipc_client or not self._ipc_client.is_connected:
            return None

        response = await self._ipc_client.call("get_status")
        if response.success:
            self._last_status = response.result
            return response.result
        return None

    async def load_image(
        self,
        path: str,
        scale_mode: str = "fit",
        transition_duration: float | None = None,
    ) -> bool:
        """
        Load an image immediately.

        Args:
            path: Path to the image file
            scale_mode: Scale mode (fit, fill, stretch)
            transition_duration: Optional transition duration

        Returns:
            True if successful, False otherwise
        """
        if not self._ipc_client or not self._ipc_client.is_connected:
            print(f"load_image: IPC not connected", flush=True)
            return False

        params: dict[str, Any] = {
            "path": path,
            "scale_mode": scale_mode,
        }
        if transition_duration is not None:
            params["transition_duration"] = transition_duration

        print(f"load_image: calling IPC with params={params}", flush=True)
        response = await self._ipc_client.call("load_image", params)
        print(f"load_image: response.success={response.success}, result={response.result}, error={response.error}", flush=True)
        return response.success and response.result.get("success", False)

    async def queue_image(
        self,
        path: str,
        scale_mode: str = "fit",
        transition_duration: float | None = None,
    ) -> int | None:
        """
        Queue an image for display.

        Args:
            path: Path to the image file
            scale_mode: Scale mode (fit, fill, stretch)
            transition_duration: Optional transition duration

        Returns:
            Queue position, or None if failed
        """
        if not self._ipc_client or not self._ipc_client.is_connected:
            return None

        params: dict[str, Any] = {
            "path": path,
            "scale_mode": scale_mode,
        }
        if transition_duration is not None:
            params["transition_duration"] = transition_duration

        response = await self._ipc_client.call("queue_image", params)
        if response.success and response.result.get("success", False):
            return response.result.get("queue_position")
        return None

    async def load_image_pair(
        self,
        top_path: str,
        bottom_path: str,
        scale_mode: str = "fill",  # Use fill for stacked to minimize black bars
        transition_duration: float | None = None,
        stagger_delay: float = 0.3,
        top_focus_x: float = 0.5,
        top_focus_y: float = 0.5,
        bottom_focus_x: float = 0.5,
        bottom_focus_y: float = 0.5,
    ) -> bool:
        """
        Load a pair of images for stacked display.

        Used for portrait displays where two landscape images are
        displayed stacked (top/bottom) with staggered transitions.

        Args:
            top_path: Path to the top image file
            bottom_path: Path to the bottom image file
            scale_mode: Scale mode (fit, fill, stretch)
            transition_duration: Optional transition duration
            stagger_delay: Delay between top and bottom transitions
            top_focus_x: Focus point X for top image (0.0-1.0)
            top_focus_y: Focus point Y for top image (0.0-1.0)
            bottom_focus_x: Focus point X for bottom image (0.0-1.0)
            bottom_focus_y: Focus point Y for bottom image (0.0-1.0)

        Returns:
            True if successful, False otherwise
        """
        if not self._ipc_client or not self._ipc_client.is_connected:
            print(f"load_image_pair: IPC not connected", flush=True)
            return False

        params: dict[str, Any] = {
            "top_path": top_path,
            "bottom_path": bottom_path,
            "scale_mode": scale_mode,
            "stagger_delay": stagger_delay,
            "top_focus_x": top_focus_x,
            "top_focus_y": top_focus_y,
            "bottom_focus_x": bottom_focus_x,
            "bottom_focus_y": bottom_focus_y,
        }
        if transition_duration is not None:
            params["transition_duration"] = transition_duration

        print(f"load_image_pair: calling IPC with params={params}", flush=True)
        response = await self._ipc_client.call("load_image_pair", params)
        print(f"load_image_pair: response.success={response.success}, result={response.result}, error={response.error}", flush=True)
        return response.success and response.result.get("success", False)

    async def pause(self) -> bool:
        """
        Pause the display.

        Returns:
            True if successful, False otherwise
        """
        if not self._ipc_client or not self._ipc_client.is_connected:
            return False

        response = await self._ipc_client.call("pause")
        return response.success and response.result.get("success", False)

    async def resume(self) -> bool:
        """
        Resume the display.

        Returns:
            True if successful, False otherwise
        """
        if not self._ipc_client or not self._ipc_client.is_connected:
            return False

        response = await self._ipc_client.call("resume")
        return response.success and response.result.get("success", False)

    async def clear(self) -> bool:
        """
        Clear the display.

        Returns:
            True if successful, False otherwise
        """
        if not self._ipc_client or not self._ipc_client.is_connected:
            return False

        response = await self._ipc_client.call("clear")
        return response.success and response.result.get("success", False)

    async def show_registration(self, code: str) -> bool:
        """
        Show registration code on display.

        Args:
            code: Registration code to display

        Returns:
            True if successful, False otherwise
        """
        if not self._ipc_client or not self._ipc_client.is_connected:
            return False

        response = await self._ipc_client.call(
            "show_registration", {"code": code}
        )
        return response.success and response.result.get("success", False)

    async def hide_registration(self) -> bool:
        """
        Hide registration display.

        Returns:
            True if successful, False otherwise
        """
        if not self._ipc_client or not self._ipc_client.is_connected:
            return False

        response = await self._ipc_client.call("hide_registration")
        return response.success and response.result.get("success", False)

    async def show_error(
        self,
        message: str,
        code: str = "ERROR",
        details: str | None = None,
        recoverable: bool = True,
    ) -> bool:
        """
        Show an error message on the display.

        Args:
            message: User-friendly error message
            code: Error code for categorization (e.g., "NETWORK", "IMAGE")
            details: Technical details for logging (not shown to user)
            recoverable: Whether the system can recover from this error

        Returns:
            True if successful, False otherwise
        """
        if not self._ipc_client or not self._ipc_client.is_connected:
            # If we can't show error on display, at least log it
            logger.error(f"Cannot show error on display (not connected): [{code}] {message}")
            return False

        params = {
            "message": message,
            "code": code,
        }
        if details:
            params["details"] = details
        params["recoverable"] = recoverable

        response = await self._ipc_client.call("show_error", params)
        return response.success and response.result.get("success", False)

    async def clear_error(self) -> bool:
        """
        Clear the error display and return to previous state.

        Returns:
            True if successful, False otherwise
        """
        if not self._ipc_client or not self._ipc_client.is_connected:
            return False

        response = await self._ipc_client.call("clear_error")
        return response.success and response.result.get("success", False)

    # Context manager support

    async def __aenter__(self) -> "DisplayController":
        """Start the display on context entry."""
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Stop the display on context exit."""
        await self.stop()


def create_display_controller(
    socket_path: str = "/run/glowworm/display.sock",
    mock_mode: bool = False,
    config_file: str | None = None,
    auto_restart: bool = True,
) -> DisplayController:
    """
    Create a display controller with common settings.

    Args:
        socket_path: Path to IPC socket
        mock_mode: Run display in mock mode (no Pi3D)
        config_file: Path to display config file
        auto_restart: Enable auto-restart on crash

    Returns:
        DisplayController instance
    """
    config = DisplayControllerConfig(
        socket_path=socket_path,
        mock_mode=mock_mode,
        config_file=config_file,
        auto_restart=auto_restart,
    )
    return DisplayController(config)
