"""
Command Handler for GlowWorm v3.0.

Receives and executes commands from backend via WebSocket with:
- Command message parsing
- Routing to appropriate handlers
- Command acknowledgment/result sending
- Error handling for unknown commands
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .websocket_client import WebSocketClient
    from .slideshow_orchestrator import SlideshowOrchestrator
    from .playlist_manager import PlaylistManager

logger = logging.getLogger(__name__)


class CommandType(str, Enum):
    """Supported command types."""
    NEXT = "next"
    PREVIOUS = "previous"
    PAUSE = "pause"
    RESUME = "resume"
    PLAY = "play"  # Alias for resume
    RELOAD_PLAYLIST = "reload_playlist"
    GO_TO = "go_to"
    CLEAR = "clear"
    CLEAR_CACHE = "clear_cache"
    STATUS = "status"
    # CEC commands
    CEC_POWER_ON = "cec_power_on"
    CEC_POWER_OFF = "cec_power_off"
    CEC_SET_INPUT = "cec_set_input"
    CEC_SCAN = "cec_scan"


class CommandStatus(str, Enum):
    """Status of a command execution."""
    SUCCESS = "success"
    FAILED = "failed"
    ERROR = "error"
    UNKNOWN_COMMAND = "unknown_command"


@dataclass
class CommandResult:
    """Result of a command execution."""
    command: str
    status: CommandStatus
    message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    request_id: Optional[str] = None
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result = {
            "command": self.command,
            "status": self.status.value,
            "timestamp": self.timestamp,
        }
        if self.message:
            result["message"] = self.message
        if self.data:
            result["data"] = self.data
        if self.request_id:
            result["request_id"] = self.request_id
        return result


@dataclass
class CommandHandlerConfig:
    """Configuration for command handler."""
    # Whether to send acknowledgment for all commands
    send_acknowledgment: bool = True

    # Priority for command responses in offline queue
    response_priority: int = 3  # Higher priority than status (5)

    # Timeout for command execution
    command_timeout: float = 30.0


# Type for command callbacks
CommandCallback = Callable[[str, CommandResult], None]


class CommandHandler:
    """
    Handles commands received from backend via WebSocket.

    Features:
    - Parses command messages from WebSocket
    - Routes commands to appropriate slideshow/playlist handlers
    - Sends command acknowledgment/result
    - Handles unknown commands gracefully

    Usage:
        handler = CommandHandler(
            websocket=ws_client,
            slideshow=slideshow_orchestrator,
            playlist=playlist_manager,
        )

        # Register as WebSocket message handler
        ws_client.on_message = handler.handle_message

        # Start handler
        await handler.start()
    """

    def __init__(
        self,
        websocket: "WebSocketClient",
        slideshow: Optional["SlideshowOrchestrator"] = None,
        playlist: Optional["PlaylistManager"] = None,
        cec_controller: Optional[Any] = None,
        config: Optional[CommandHandlerConfig] = None,
    ) -> None:
        """
        Initialize command handler.

        Args:
            websocket: WebSocket client for sending responses
            slideshow: Optional SlideshowOrchestrator for playback commands
            playlist: Optional PlaylistManager for playlist commands
            cec_controller: Optional CECController for CEC commands
            config: Handler configuration
        """
        self.websocket = websocket
        self.slideshow = slideshow
        self.playlist = playlist
        self.cec_controller = cec_controller
        self.config = config or CommandHandlerConfig()

        self._running = False
        self._callbacks: list[CommandCallback] = []

        # Statistics
        self._commands_received = 0
        self._commands_succeeded = 0
        self._commands_failed = 0
        self._unknown_commands = 0

        logger.info("CommandHandler initialized")

    @property
    def is_running(self) -> bool:
        """Whether handler is running."""
        return self._running

    def add_callback(self, callback: CommandCallback) -> None:
        """Add a callback for command results."""
        self._callbacks.append(callback)

    def remove_callback(self, callback: CommandCallback) -> None:
        """Remove a command callback."""
        if callback in self._callbacks:
            self._callbacks.remove(callback)

    async def start(self) -> None:
        """Start the command handler."""
        if self._running:
            logger.warning("CommandHandler already running")
            return

        self._running = True
        logger.info("CommandHandler started")

    async def stop(self) -> None:
        """Stop the command handler."""
        if not self._running:
            return

        self._running = False
        logger.info("CommandHandler stopped")

    async def handle_message(self, message_type: str, payload: Dict[str, Any]) -> None:
        """
        Handle a message from WebSocket.

        This should be called by the WebSocket client's message handler.

        Args:
            message_type: Type of the message
            payload: Message payload
        """
        if message_type != "command":
            # Not a command message, ignore
            return

        if not self._running:
            logger.warning("Command received but handler not running")
            return

        self._commands_received += 1

        # Extract command info
        command = payload.get("command", "").lower()
        params = payload.get("params", {})
        request_id = payload.get("request_id")

        logger.info(f"Received command: {command}, params={params}")

        # Execute command
        result = await self._execute_command(command, params, request_id)

        # Update statistics
        if result.status == CommandStatus.SUCCESS:
            self._commands_succeeded += 1
        elif result.status == CommandStatus.UNKNOWN_COMMAND:
            self._unknown_commands += 1
        else:
            self._commands_failed += 1

        # Notify callbacks
        for callback in self._callbacks:
            try:
                callback(command, result)
            except Exception as e:
                logger.warning(f"Command callback error: {e}")

        # Send response
        if self.config.send_acknowledgment:
            await self._send_response(result)

    async def _execute_command(
        self,
        command: str,
        params: Dict[str, Any],
        request_id: Optional[str] = None,
    ) -> CommandResult:
        """
        Execute a command and return the result.

        Args:
            command: Command name
            params: Command parameters
            request_id: Optional request ID for correlation

        Returns:
            CommandResult with execution status
        """
        try:
            # Route to appropriate handler
            if command == CommandType.NEXT.value:
                return await self._handle_next(request_id)

            elif command == CommandType.PREVIOUS.value:
                return await self._handle_previous(request_id)

            elif command in (CommandType.PAUSE.value,):
                return await self._handle_pause(request_id)

            elif command in (CommandType.RESUME.value, CommandType.PLAY.value):
                return await self._handle_resume(request_id)

            elif command == CommandType.RELOAD_PLAYLIST.value:
                return await self._handle_reload_playlist(request_id)

            elif command == CommandType.GO_TO.value:
                position = params.get("position", 0)
                return await self._handle_go_to(position, request_id)

            elif command == CommandType.CLEAR.value:
                return await self._handle_clear(request_id)

            elif command == CommandType.CLEAR_CACHE.value:
                return await self._handle_clear_cache(request_id)

            elif command == CommandType.STATUS.value:
                return await self._handle_status(request_id)

            # CEC commands
            elif command == CommandType.CEC_POWER_ON.value:
                return await self._handle_cec_power(True, request_id)

            elif command == CommandType.CEC_POWER_OFF.value:
                return await self._handle_cec_power(False, request_id)

            elif command == CommandType.CEC_SET_INPUT.value:
                input_address = params.get("input_address")
                return await self._handle_cec_set_input(input_address, request_id)

            elif command == CommandType.CEC_SCAN.value:
                return await self._handle_cec_scan(request_id)

            else:
                logger.warning(f"Unknown command: {command}")
                return CommandResult(
                    command=command,
                    status=CommandStatus.UNKNOWN_COMMAND,
                    message=f"Unknown command: {command}",
                    request_id=request_id,
                )

        except asyncio.TimeoutError:
            logger.error(f"Command {command} timed out")
            return CommandResult(
                command=command,
                status=CommandStatus.ERROR,
                message="Command timed out",
                request_id=request_id,
            )
        except Exception as e:
            logger.exception(f"Error executing command {command}: {e}")
            return CommandResult(
                command=command,
                status=CommandStatus.ERROR,
                message=str(e),
                request_id=request_id,
            )

    async def _handle_next(self, request_id: Optional[str] = None) -> CommandResult:
        """Handle the 'next' command."""
        if not self.slideshow:
            return CommandResult(
                command="next",
                status=CommandStatus.FAILED,
                message="Slideshow not available",
                request_id=request_id,
            )

        success = await asyncio.wait_for(
            self.slideshow.next(),
            timeout=self.config.command_timeout,
        )

        if success:
            return CommandResult(
                command="next",
                status=CommandStatus.SUCCESS,
                message="Advanced to next image",
                data={"position": self.slideshow.playlist.current_position if self.slideshow.playlist else None},
                request_id=request_id,
            )
        else:
            return CommandResult(
                command="next",
                status=CommandStatus.FAILED,
                message="Failed to advance to next image",
                request_id=request_id,
            )

    async def _handle_previous(self, request_id: Optional[str] = None) -> CommandResult:
        """Handle the 'previous' command."""
        if not self.slideshow:
            return CommandResult(
                command="previous",
                status=CommandStatus.FAILED,
                message="Slideshow not available",
                request_id=request_id,
            )

        success = await asyncio.wait_for(
            self.slideshow.previous(),
            timeout=self.config.command_timeout,
        )

        if success:
            return CommandResult(
                command="previous",
                status=CommandStatus.SUCCESS,
                message="Went to previous image",
                data={"position": self.slideshow.playlist.current_position if self.slideshow.playlist else None},
                request_id=request_id,
            )
        else:
            return CommandResult(
                command="previous",
                status=CommandStatus.FAILED,
                message="Failed to go to previous image",
                request_id=request_id,
            )

    async def _handle_pause(self, request_id: Optional[str] = None) -> CommandResult:
        """Handle the 'pause' command."""
        if not self.slideshow:
            return CommandResult(
                command="pause",
                status=CommandStatus.FAILED,
                message="Slideshow not available",
                request_id=request_id,
            )

        success = await asyncio.wait_for(
            self.slideshow.pause(),
            timeout=self.config.command_timeout,
        )

        if success:
            return CommandResult(
                command="pause",
                status=CommandStatus.SUCCESS,
                message="Slideshow paused",
                data={"state": self.slideshow.state.value},
                request_id=request_id,
            )
        else:
            return CommandResult(
                command="pause",
                status=CommandStatus.FAILED,
                message="Slideshow already paused or not running",
                data={"state": self.slideshow.state.value},
                request_id=request_id,
            )

    async def _handle_resume(self, request_id: Optional[str] = None) -> CommandResult:
        """Handle the 'resume' command."""
        if not self.slideshow:
            return CommandResult(
                command="resume",
                status=CommandStatus.FAILED,
                message="Slideshow not available",
                request_id=request_id,
            )

        success = await asyncio.wait_for(
            self.slideshow.resume(),
            timeout=self.config.command_timeout,
        )

        if success:
            return CommandResult(
                command="resume",
                status=CommandStatus.SUCCESS,
                message="Slideshow resumed",
                data={"state": self.slideshow.state.value},
                request_id=request_id,
            )
        else:
            return CommandResult(
                command="resume",
                status=CommandStatus.FAILED,
                message="Slideshow not paused",
                data={"state": self.slideshow.state.value},
                request_id=request_id,
            )

    async def _handle_reload_playlist(self, request_id: Optional[str] = None) -> CommandResult:
        """Handle the 'reload_playlist' command."""
        if not self.slideshow:
            return CommandResult(
                command="reload_playlist",
                status=CommandStatus.FAILED,
                message="Slideshow not available",
                request_id=request_id,
            )

        success = await asyncio.wait_for(
            self.slideshow.reload_playlist(),
            timeout=self.config.command_timeout,
        )

        if success:
            playlist_info = None
            if self.slideshow.playlist and self.slideshow.playlist.playlist:
                playlist_info = {
                    "id": self.slideshow.playlist.playlist.id,
                    "name": self.slideshow.playlist.playlist.name,
                    "entry_count": self.slideshow.playlist.playlist.entry_count,
                }

            return CommandResult(
                command="reload_playlist",
                status=CommandStatus.SUCCESS,
                message="Playlist reloaded",
                data={"playlist": playlist_info},
                request_id=request_id,
            )
        else:
            return CommandResult(
                command="reload_playlist",
                status=CommandStatus.FAILED,
                message="Failed to reload playlist",
                request_id=request_id,
            )

    async def _handle_go_to(
        self,
        position: int,
        request_id: Optional[str] = None,
    ) -> CommandResult:
        """Handle the 'go_to' command."""
        if not self.slideshow:
            return CommandResult(
                command="go_to",
                status=CommandStatus.FAILED,
                message="Slideshow not available",
                request_id=request_id,
            )

        success = await asyncio.wait_for(
            self.slideshow.go_to(position),
            timeout=self.config.command_timeout,
        )

        if success:
            return CommandResult(
                command="go_to",
                status=CommandStatus.SUCCESS,
                message=f"Jumped to position {position}",
                data={"position": self.slideshow.playlist.current_position if self.slideshow.playlist else None},
                request_id=request_id,
            )
        else:
            return CommandResult(
                command="go_to",
                status=CommandStatus.FAILED,
                message=f"Invalid position: {position}",
                request_id=request_id,
            )

    async def _handle_clear(self, request_id: Optional[str] = None) -> CommandResult:
        """Handle the 'clear' command."""
        if not self.slideshow:
            return CommandResult(
                command="clear",
                status=CommandStatus.FAILED,
                message="Slideshow not available",
                request_id=request_id,
            )

        await asyncio.wait_for(
            self.slideshow.display.clear(),
            timeout=self.config.command_timeout,
        )

        return CommandResult(
            command="clear",
            status=CommandStatus.SUCCESS,
            message="Display cleared",
            request_id=request_id,
        )

    async def _handle_clear_cache(self, request_id: Optional[str] = None) -> CommandResult:
        """Handle the 'clear_cache' command."""
        if not self.slideshow:
            return CommandResult(
                command="clear_cache",
                status=CommandStatus.FAILED,
                message="Slideshow not available",
                request_id=request_id,
            )

        try:
            count = self.slideshow.clear_cache()
            return CommandResult(
                command="clear_cache",
                status=CommandStatus.SUCCESS,
                message=f"Cache cleared: {count} entries removed",
                data={"entries_cleared": count},
                request_id=request_id,
            )
        except Exception as e:
            logger.error(f"Failed to clear cache: {e}")
            return CommandResult(
                command="clear_cache",
                status=CommandStatus.FAILED,
                message=f"Failed to clear cache: {str(e)}",
                request_id=request_id,
            )

    async def _handle_status(self, request_id: Optional[str] = None) -> CommandResult:
        """Handle the 'status' command."""
        status_data = {}

        if self.slideshow:
            status_data["slideshow"] = self.slideshow.get_status()

        if self.playlist:
            status_data["playlist"] = self.playlist.get_status()

        status_data["command_handler"] = {
            "commands_received": self._commands_received,
            "commands_succeeded": self._commands_succeeded,
            "commands_failed": self._commands_failed,
            "unknown_commands": self._unknown_commands,
        }

        return CommandResult(
            command="status",
            status=CommandStatus.SUCCESS,
            message="Status retrieved",
            data=status_data,
            request_id=request_id,
        )

    async def _handle_cec_power(
        self,
        power_on: bool,
        request_id: Optional[str] = None,
    ) -> CommandResult:
        """Handle CEC power on/off commands."""
        command = "cec_power_on" if power_on else "cec_power_off"

        if not self.cec_controller:
            return CommandResult(
                command=command,
                status=CommandStatus.FAILED,
                message="CEC controller not available",
                request_id=request_id,
            )

        if not self.cec_controller.available:
            return CommandResult(
                command=command,
                status=CommandStatus.FAILED,
                message="CEC not available on this device",
                request_id=request_id,
            )

        try:
            if power_on:
                success, message = self.cec_controller.power_on()
            else:
                success, message = self.cec_controller.power_off()

            if success:
                return CommandResult(
                    command=command,
                    status=CommandStatus.SUCCESS,
                    message=message,
                    request_id=request_id,
                )
            else:
                return CommandResult(
                    command=command,
                    status=CommandStatus.FAILED,
                    message=message,
                    request_id=request_id,
                )
        except Exception as e:
            logger.error(f"CEC power command failed: {e}")
            return CommandResult(
                command=command,
                status=CommandStatus.ERROR,
                message=str(e),
                request_id=request_id,
            )

    async def _handle_cec_set_input(
        self,
        input_address: Optional[str],
        request_id: Optional[str] = None,
    ) -> CommandResult:
        """Handle CEC input selection command."""
        if not self.cec_controller:
            return CommandResult(
                command="cec_set_input",
                status=CommandStatus.FAILED,
                message="CEC controller not available",
                request_id=request_id,
            )

        if not self.cec_controller.available:
            return CommandResult(
                command="cec_set_input",
                status=CommandStatus.FAILED,
                message="CEC not available on this device",
                request_id=request_id,
            )

        if not input_address:
            return CommandResult(
                command="cec_set_input",
                status=CommandStatus.FAILED,
                message="No input address specified",
                request_id=request_id,
            )

        try:
            success, message = self.cec_controller.set_input(input_address)

            if success:
                return CommandResult(
                    command="cec_set_input",
                    status=CommandStatus.SUCCESS,
                    message=message,
                    data={"input_address": input_address},
                    request_id=request_id,
                )
            else:
                return CommandResult(
                    command="cec_set_input",
                    status=CommandStatus.FAILED,
                    message=message,
                    request_id=request_id,
                )
        except Exception as e:
            logger.error(f"CEC set input command failed: {e}")
            return CommandResult(
                command="cec_set_input",
                status=CommandStatus.ERROR,
                message=str(e),
                request_id=request_id,
            )

    async def _handle_cec_scan(
        self,
        request_id: Optional[str] = None,
    ) -> CommandResult:
        """Handle CEC device scan command."""
        if not self.cec_controller:
            return CommandResult(
                command="cec_scan",
                status=CommandStatus.FAILED,
                message="CEC controller not available",
                request_id=request_id,
            )

        if not self.cec_controller.available:
            return CommandResult(
                command="cec_scan",
                status=CommandStatus.FAILED,
                message="CEC not available on this device",
                request_id=request_id,
            )

        try:
            success, devices = self.cec_controller.scan_devices(timeout=15)

            if success:
                # Update cached devices
                if hasattr(self.cec_controller, 'cached_devices'):
                    self.cec_controller.cached_devices = devices

                return CommandResult(
                    command="cec_scan",
                    status=CommandStatus.SUCCESS,
                    message=f"Found {len(devices)} CEC device(s)",
                    data={"devices": devices},
                    request_id=request_id,
                )
            else:
                return CommandResult(
                    command="cec_scan",
                    status=CommandStatus.FAILED,
                    message="CEC scan failed",
                    request_id=request_id,
                )
        except Exception as e:
            logger.error(f"CEC scan command failed: {e}")
            return CommandResult(
                command="cec_scan",
                status=CommandStatus.ERROR,
                message=str(e),
                request_id=request_id,
            )

    async def _send_response(self, result: CommandResult) -> bool:
        """
        Send command response via WebSocket.

        Args:
            result: Command execution result

        Returns:
            True if sent (or queued), False otherwise
        """
        try:
            sent = await self.websocket.send(
                message_type="command_response",
                payload=result.to_dict(),
                queue_if_offline=True,
                priority=self.config.response_priority,
            )

            if sent:
                logger.debug(f"Command response sent: {result.command} -> {result.status.value}")
            else:
                logger.debug(f"Command response queued: {result.command} -> {result.status.value}")

            return True

        except Exception as e:
            logger.error(f"Failed to send command response: {e}")
            return False

    def get_stats(self) -> Dict[str, Any]:
        """Get command handler statistics."""
        return {
            "running": self._running,
            "commands_received": self._commands_received,
            "commands_succeeded": self._commands_succeeded,
            "commands_failed": self._commands_failed,
            "unknown_commands": self._unknown_commands,
        }

    async def __aenter__(self) -> "CommandHandler":
        """Start handler on context entry."""
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Stop handler on context exit."""
        await self.stop()


def create_command_handler(
    websocket: "WebSocketClient",
    slideshow: Optional["SlideshowOrchestrator"] = None,
    playlist: Optional["PlaylistManager"] = None,
    send_acknowledgment: bool = True,
) -> CommandHandler:
    """
    Factory function to create a CommandHandler.

    Args:
        websocket: WebSocket client for sending responses
        slideshow: Optional SlideshowOrchestrator
        playlist: Optional PlaylistManager
        send_acknowledgment: Whether to send acknowledgment for commands

    Returns:
        Configured CommandHandler instance
    """
    config = CommandHandlerConfig(
        send_acknowledgment=send_acknowledgment,
    )
    return CommandHandler(
        websocket=websocket,
        slideshow=slideshow,
        playlist=playlist,
        config=config,
    )
