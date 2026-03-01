"""
IPC Server for GlowWorm Display Engine.

Implements JSON-RPC 2.0 over Unix domain sockets for communication with the daemon.
Provides commands for image loading, status queries, and playback control.
"""

import asyncio
import json
import logging
import os
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Callable, TYPE_CHECKING

if TYPE_CHECKING:
    from glowworm_display.renderer import Renderer

logger = logging.getLogger(__name__)

# JSON-RPC 2.0 error codes
PARSE_ERROR = -32700
INVALID_REQUEST = -32600
METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
INTERNAL_ERROR = -32603


class ConnectionState(str, Enum):
    """State of a client connection."""

    CONNECTED = "connected"
    DISCONNECTED = "disconnected"


@dataclass
class IPCClient:
    """Represents a connected IPC client."""

    reader: asyncio.StreamReader
    writer: asyncio.StreamWriter
    address: str = ""
    connected_at: float = 0.0

    async def send(self, message: dict[str, Any]) -> None:
        """Send a JSON message to the client."""
        try:
            data = json.dumps(message) + "\n"
            self.writer.write(data.encode("utf-8"))
            await self.writer.drain()
        except Exception as e:
            logger.warning(f"Failed to send to client {self.address}: {e}")
            raise

    async def close(self) -> None:
        """Close the client connection."""
        try:
            self.writer.close()
            await self.writer.wait_closed()
        except Exception as e:
            logger.debug(f"Error closing client {self.address}: {e}")


@dataclass
class IPCServerConfig:
    """Configuration for the IPC server."""

    socket_path: str = "/run/glowworm/display.sock"
    timeout: float = 5.0
    max_message_size: int = 1024 * 1024  # 1MB max message


# Callback type for notifications
NotificationCallback = Callable[[str, dict[str, Any]], None]


class IPCServer:
    """
    JSON-RPC 2.0 server over Unix domain sockets.

    Provides commands for controlling the display engine and querying status.
    Supports multiple concurrent client connections.

    Attributes:
        config: Server configuration
        renderer: Optional renderer reference for command execution
    """

    def __init__(
        self,
        config: IPCServerConfig | None = None,
        renderer: "Renderer | None" = None,
    ) -> None:
        """
        Initialize the IPC server.

        Args:
            config: Server configuration (uses defaults if None)
            renderer: Renderer instance for executing commands
        """
        self.config = config or IPCServerConfig()
        self.renderer = renderer

        self._server: asyncio.Server | None = None
        self._clients: list[IPCClient] = []
        self._running = False

        # Command handlers
        self._handlers: dict[str, Callable[..., Any]] = {
            "load_image": self._handle_load_image,
            "load_image_pair": self._handle_load_image_pair,
            "get_status": self._handle_get_status,
            "pause": self._handle_pause,
            "resume": self._handle_resume,
            "clear": self._handle_clear,
            "queue_image": self._handle_queue_image,
            "show_registration": self._handle_show_registration,
            "hide_registration": self._handle_hide_registration,
            "show_error": self._handle_show_error,
            "clear_error": self._handle_clear_error,
        }

        # Notification listeners (for sending async notifications)
        self._notification_listeners: list[NotificationCallback] = []

        logger.info(f"IPC server initialized: socket={self.config.socket_path}")

    @property
    def is_running(self) -> bool:
        """Check if server is running."""
        return self._running

    @property
    def client_count(self) -> int:
        """Get number of connected clients."""
        return len(self._clients)

    def set_renderer(self, renderer: "Renderer") -> None:
        """
        Set the renderer instance.

        Args:
            renderer: Renderer to use for command execution
        """
        self.renderer = renderer
        logger.debug("Renderer set for IPC server")

    def add_notification_listener(self, callback: NotificationCallback) -> None:
        """
        Add a notification listener.

        The callback will be called with (method, params) when notifications
        are sent to clients.

        Args:
            callback: Function to call on notifications
        """
        self._notification_listeners.append(callback)

    async def start(self) -> None:
        """
        Start the IPC server.

        Creates the Unix socket and begins accepting connections.
        """
        if self._running:
            logger.warning("IPC server already running")
            return

        # Ensure socket directory exists
        socket_path = Path(self.config.socket_path)
        socket_path.parent.mkdir(parents=True, exist_ok=True)

        # Remove existing socket if present
        if socket_path.exists():
            logger.debug(f"Removing existing socket: {socket_path}")
            socket_path.unlink()

        try:
            self._server = await asyncio.start_unix_server(
                self._handle_client,
                path=str(socket_path),
            )
            # Set socket permissions to allow group access
            os.chmod(socket_path, 0o660)
            self._running = True
            logger.info(f"IPC server started: {socket_path}")
        except Exception as e:
            logger.error(f"Failed to start IPC server: {e}")
            raise

    async def stop(self) -> None:
        """
        Stop the IPC server.

        Closes all client connections and removes the socket.
        """
        if not self._running:
            return

        self._running = False

        # Close all client connections
        for client in self._clients[:]:
            await client.close()
        self._clients.clear()

        # Close server
        if self._server:
            self._server.close()
            await self._server.wait_closed()
            self._server = None

        # Remove socket file
        socket_path = Path(self.config.socket_path)
        if socket_path.exists():
            socket_path.unlink()

        logger.info("IPC server stopped")

    async def run(self) -> None:
        """
        Run the server until stopped.

        This is a convenience method that starts the server and waits
        until stop() is called.
        """
        await self.start()

        try:
            while self._running:
                await asyncio.sleep(0.1)
        except asyncio.CancelledError:
            logger.debug("IPC server run cancelled")
        finally:
            await self.stop()

    async def _handle_client(
        self,
        reader: asyncio.StreamReader,
        writer: asyncio.StreamWriter,
    ) -> None:
        """Handle a new client connection."""
        import time

        peername = writer.get_extra_info("peername") or "unknown"
        client = IPCClient(
            reader=reader,
            writer=writer,
            address=str(peername),
            connected_at=time.time(),
        )
        self._clients.append(client)
        logger.info(f"Client connected: {client.address}")

        try:
            await self._process_client(client)
        except asyncio.CancelledError:
            logger.debug(f"Client handler cancelled: {client.address}")
        except Exception as e:
            logger.error(f"Error handling client {client.address}: {e}")
        finally:
            if client in self._clients:
                self._clients.remove(client)
            await client.close()
            logger.info(f"Client disconnected: {client.address}")

    async def _process_client(self, client: IPCClient) -> None:
        """Process messages from a client."""
        while self._running:
            try:
                # Read line (JSON-RPC message)
                line = await asyncio.wait_for(
                    client.reader.readline(),
                    timeout=None,  # No timeout for reads
                )

                if not line:
                    # Client disconnected
                    break

                # Check message size
                if len(line) > self.config.max_message_size:
                    await self._send_error(client, None, PARSE_ERROR, "Message too large")
                    continue

                # Parse and handle message
                await self._handle_message(client, line)

            except asyncio.TimeoutError:
                continue
            except ConnectionResetError:
                logger.debug(f"Connection reset: {client.address}")
                break
            except Exception as e:
                logger.error(f"Error processing message from {client.address}: {e}")
                break

    async def _handle_message(self, client: IPCClient, data: bytes) -> None:
        """Parse and handle a JSON-RPC message."""
        # Parse JSON
        try:
            message = json.loads(data.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            logger.warning(f"Invalid JSON from {client.address}: {e}")
            await self._send_error(client, None, PARSE_ERROR, "Parse error")
            return

        # Validate JSON-RPC structure
        if not isinstance(message, dict):
            await self._send_error(client, None, INVALID_REQUEST, "Invalid Request")
            return

        # Check for JSON-RPC 2.0
        if message.get("jsonrpc") != "2.0":
            await self._send_error(client, None, INVALID_REQUEST, "Invalid Request: must be JSON-RPC 2.0")
            return

        # Get request ID (optional for notifications)
        request_id = message.get("id")

        # Get method
        method = message.get("method")
        if not method or not isinstance(method, str):
            await self._send_error(client, request_id, INVALID_REQUEST, "Invalid Request: method required")
            return

        # Get params (optional)
        params = message.get("params", {})
        if not isinstance(params, (dict, list)):
            await self._send_error(client, request_id, INVALID_PARAMS, "Invalid params")
            return

        # Handle the request
        await self._handle_request(client, request_id, method, params)

    async def _handle_request(
        self,
        client: IPCClient,
        request_id: int | str | None,
        method: str,
        params: dict[str, Any] | list[Any],
    ) -> None:
        """Handle a JSON-RPC request."""
        # Find handler
        handler = self._handlers.get(method)
        if not handler:
            logger.warning(f"Unknown method: {method}")
            await self._send_error(client, request_id, METHOD_NOT_FOUND, f"Method not found: {method}")
            return

        # Execute handler
        try:
            # Convert list params to dict if needed
            if isinstance(params, list):
                result = await handler(*params)
            else:
                result = await handler(**params)

            # Send result (only if request_id is present - notifications don't need response)
            if request_id is not None:
                await self._send_result(client, request_id, result)

        except TypeError as e:
            logger.warning(f"Invalid params for {method}: {e}")
            await self._send_error(client, request_id, INVALID_PARAMS, str(e))
        except Exception as e:
            logger.error(f"Error executing {method}: {e}")
            await self._send_error(client, request_id, INTERNAL_ERROR, str(e))

    async def _send_result(
        self,
        client: IPCClient,
        request_id: int | str | None,
        result: Any,
    ) -> None:
        """Send a successful JSON-RPC response."""
        response = {
            "jsonrpc": "2.0",
            "result": result,
            "id": request_id,
        }
        await client.send(response)
        logger.debug(f"Sent result for request {request_id}")

    async def _send_error(
        self,
        client: IPCClient,
        request_id: int | str | None,
        code: int,
        message: str,
        data: Any = None,
    ) -> None:
        """Send a JSON-RPC error response."""
        error: dict[str, Any] = {
            "code": code,
            "message": message,
        }
        if data is not None:
            error["data"] = data

        response = {
            "jsonrpc": "2.0",
            "error": error,
            "id": request_id,
        }
        await client.send(response)
        logger.debug(f"Sent error for request {request_id}: {message}")

    async def send_notification(
        self,
        method: str,
        params: dict[str, Any] | None = None,
    ) -> None:
        """
        Send a notification to all connected clients.

        Notifications are JSON-RPC messages without an id, meaning
        clients do not need to respond.

        Args:
            method: Notification method name
            params: Optional parameters
        """
        notification = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params or {},
        }

        # Notify listeners
        for listener in self._notification_listeners:
            try:
                listener(method, params or {})
            except Exception as e:
                logger.warning(f"Notification listener error: {e}")

        # Send to all clients
        disconnected: list[IPCClient] = []

        for client in self._clients:
            try:
                await client.send(notification)
            except Exception as e:
                logger.warning(f"Failed to send notification to {client.address}: {e}")
                disconnected.append(client)

        # Remove disconnected clients
        for client in disconnected:
            if client in self._clients:
                self._clients.remove(client)

        logger.debug(f"Sent notification: {method} to {len(self._clients)} clients")

    # Command handlers

    async def _handle_load_image(
        self,
        path: str,
        scale_mode: str = "fit",
        transition_duration: float | None = None,
    ) -> dict[str, Any]:
        """
        Load an image immediately.

        Args:
            path: Path to the image file
            scale_mode: Scale mode (fit, fill, stretch)
            transition_duration: Optional transition duration override

        Returns:
            Dict with success status
        """
        if not self.renderer:
            return {"success": False, "error": "Renderer not initialized"}

        from glowworm_display.image_loader import ScaleMode

        try:
            mode = ScaleMode(scale_mode)
        except ValueError:
            return {"success": False, "error": f"Invalid scale_mode: {scale_mode}"}

        success = self.renderer.load_image_immediate(
            path=path,
            scale_mode=mode,
            transition_duration=transition_duration,
        )

        return {"success": success}

    async def _handle_queue_image(
        self,
        path: str,
        scale_mode: str = "fit",
        transition_duration: float | None = None,
    ) -> dict[str, Any]:
        """
        Queue an image for display.

        Args:
            path: Path to the image file
            scale_mode: Scale mode (fit, fill, stretch)
            transition_duration: Optional transition duration override

        Returns:
            Dict with success status and queue position
        """
        if not self.renderer:
            return {"success": False, "error": "Renderer not initialized"}

        from glowworm_display.image_loader import ScaleMode

        try:
            mode = ScaleMode(scale_mode)
        except ValueError:
            return {"success": False, "error": f"Invalid scale_mode: {scale_mode}"}

        self.renderer.queue_image(
            path=path,
            scale_mode=mode,
            transition_duration=transition_duration,
        )

        return {
            "success": True,
            "queue_position": self.renderer.queue_length,
        }

    async def _handle_load_image_pair(
        self,
        top_path: str,
        bottom_path: str,
        scale_mode: str = "fit",
        transition_duration: float | None = None,
        stagger_delay: float = 0.3,
    ) -> dict[str, Any]:
        """
        Load a pair of images for stacked display.

        Used for portrait displays where two landscape images are
        displayed stacked (top/bottom) with staggered transitions.

        Args:
            top_path: Path to the top image file
            bottom_path: Path to the bottom image file
            scale_mode: Scale mode (fit, fill, stretch)
            transition_duration: Optional transition duration override
            stagger_delay: Delay between top and bottom transitions

        Returns:
            Dict with success status
        """
        if not self.renderer:
            return {"success": False, "error": "Renderer not initialized"}

        from glowworm_display.image_loader import ScaleMode

        try:
            mode = ScaleMode(scale_mode)
        except ValueError:
            return {"success": False, "error": f"Invalid scale_mode: {scale_mode}"}

        success = self.renderer.load_image_pair_immediate(
            top_path=top_path,
            bottom_path=bottom_path,
            scale_mode=mode,
            transition_duration=transition_duration,
            stagger_delay=stagger_delay,
        )

        return {"success": success}

    async def _handle_get_status(self) -> dict[str, Any]:
        """
        Get current renderer status.

        Returns:
            Dict with renderer state and statistics
        """
        if not self.renderer:
            return {
                "state": "uninitialized",
                "is_running": False,
                "is_paused": False,
                "current_image": None,
                "queue_length": 0,
                "stats": {},
            }

        return self.renderer.get_status()

    async def _handle_pause(self) -> dict[str, Any]:
        """
        Pause the renderer.

        Returns:
            Dict with success status and new state
        """
        if not self.renderer:
            return {"success": False, "error": "Renderer not initialized"}

        self.renderer.pause()
        state = self.renderer.state.value

        # Schedule notification to be sent after response
        asyncio.create_task(self._send_state_notification(state))

        return {
            "success": True,
            "state": state,
        }

    async def _handle_resume(self) -> dict[str, Any]:
        """
        Resume the renderer.

        Returns:
            Dict with success status and new state
        """
        if not self.renderer:
            return {"success": False, "error": "Renderer not initialized"}

        self.renderer.resume()
        state = self.renderer.state.value

        # Schedule notification to be sent after response
        asyncio.create_task(self._send_state_notification(state))

        return {
            "success": True,
            "state": state,
        }

    async def _handle_clear(self) -> dict[str, Any]:
        """
        Clear the display.

        Returns:
            Dict with success status
        """
        if not self.renderer:
            return {"success": False, "error": "Renderer not initialized"}

        self.renderer.clear()
        state = self.renderer.state.value

        # Schedule notification to be sent after response
        asyncio.create_task(self._send_state_notification(state))

        return {"success": True}

    async def _send_state_notification(self, state: str) -> None:
        """
        Send a state change notification.

        This is scheduled as a separate task to ensure it runs after
        the command response has been sent.

        Args:
            state: The new state value
        """
        # Small delay to ensure response is sent first
        await asyncio.sleep(0.01)
        await self.send_notification("state_changed", {"state": state})

    async def _handle_show_registration(self, code: str) -> dict[str, Any]:
        """
        Show registration code on display.

        Args:
            code: The registration code to display

        Returns:
            Dict with success status
        """
        if not self.renderer:
            return {"success": False, "error": "Renderer not initialized"}

        if not code or not isinstance(code, str):
            return {"success": False, "error": "Registration code required"}

        self.renderer.show_registration(code)
        state = self.renderer.state.value

        # Schedule notification to be sent after response
        asyncio.create_task(self._send_state_notification(state))

        return {
            "success": True,
            "state": state,
            "code": code.upper(),
        }

    async def _handle_hide_registration(self) -> dict[str, Any]:
        """
        Hide registration display.

        Returns:
            Dict with success status
        """
        if not self.renderer:
            return {"success": False, "error": "Renderer not initialized"}

        self.renderer.hide_registration()
        state = self.renderer.state.value

        # Schedule notification to be sent after response
        asyncio.create_task(self._send_state_notification(state))

        return {
            "success": True,
            "state": state,
        }

    async def _handle_show_error(
        self,
        message: str,
        code: str = "ERROR",
        details: str | None = None,
        recoverable: bool = True,
    ) -> dict[str, Any]:
        """
        Show an error message on display.

        Args:
            message: User-friendly error message
            code: Error code for categorization
            details: Technical details (for logging only)
            recoverable: Whether the system can recover

        Returns:
            Dict with success status
        """
        if not self.renderer:
            return {"success": False, "error": "Renderer not initialized"}

        if not message or not isinstance(message, str):
            return {"success": False, "error": "Error message required"}

        self.renderer.show_error(
            message=message,
            code=code,
            details=details,
            recoverable=recoverable,
        )
        state = self.renderer.state.value

        # Schedule notification to be sent after response
        asyncio.create_task(self._send_state_notification(state))
        # Also send error notification
        asyncio.create_task(self._send_error_notification(message, code))

        return {
            "success": True,
            "state": state,
            "error_code": code,
        }

    async def _handle_clear_error(self) -> dict[str, Any]:
        """
        Clear error display and return to previous state.

        Returns:
            Dict with success status
        """
        if not self.renderer:
            return {"success": False, "error": "Renderer not initialized"}

        self.renderer.clear_error()
        state = self.renderer.state.value

        # Schedule notification to be sent after response
        asyncio.create_task(self._send_state_notification(state))

        return {
            "success": True,
            "state": state,
        }

    async def _send_error_notification(self, message: str, code: str) -> None:
        """
        Send an error notification to all clients.

        Args:
            message: Error message
            code: Error code
        """
        await asyncio.sleep(0.01)
        await self.send_notification("error_occurred", {
            "message": message,
            "code": code,
        })


async def create_ipc_server(
    socket_path: str = "/run/glowworm/display.sock",
    renderer: "Renderer | None" = None,
) -> IPCServer:
    """
    Create and start an IPC server.

    Convenience function for creating a server with common defaults.

    Args:
        socket_path: Path to the Unix socket
        renderer: Optional renderer instance

    Returns:
        Started IPCServer instance
    """
    config = IPCServerConfig(socket_path=socket_path)
    server = IPCServer(config=config, renderer=renderer)
    await server.start()
    return server
