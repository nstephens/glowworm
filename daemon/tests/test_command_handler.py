"""
Tests for CommandHandler.

Tests command reception, parsing, routing, and response handling.
"""

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from typing import Any, Dict, List, Tuple

from glowworm_daemon.command_handler import (
    CommandHandler,
    CommandHandlerConfig,
    CommandType,
    CommandStatus,
    CommandResult,
    create_command_handler,
)


class MockWebSocketClient:
    """Mock WebSocket client for testing."""

    def __init__(self):
        self.sent_messages: List[Tuple[str, Dict[str, Any], bool, int]] = []
        self.is_connected = True

    async def send(
        self,
        message_type: str,
        payload: Dict[str, Any],
        queue_if_offline: bool = True,
        priority: int = 0,
    ) -> bool:
        """Mock send that records all calls."""
        self.sent_messages.append((message_type, payload, queue_if_offline, priority))
        return self.is_connected


class MockSlideshow:
    """Mock slideshow orchestrator for testing."""

    def __init__(self):
        self.state = MagicMock()
        self.state.value = "playing"
        self.playlist = MockPlaylistManager()
        self.display = AsyncMock()
        self.display.clear = AsyncMock()

        # Track method calls
        self.next_called = False
        self.previous_called = False
        self.pause_called = False
        self.resume_called = False
        self.reload_playlist_called = False
        self.go_to_position = None

        # Default return values
        self.next_success = True
        self.previous_success = True
        self.pause_success = True
        self.resume_success = True
        self.reload_playlist_success = True
        self.go_to_success = True

    async def next(self) -> bool:
        self.next_called = True
        return self.next_success

    async def previous(self) -> bool:
        self.previous_called = True
        return self.previous_success

    async def pause(self) -> bool:
        self.pause_called = True
        if self.pause_success:
            self.state.value = "paused"
        return self.pause_success

    async def resume(self) -> bool:
        self.resume_called = True
        if self.resume_success:
            self.state.value = "playing"
        return self.resume_success

    async def reload_playlist(self) -> bool:
        self.reload_playlist_called = True
        return self.reload_playlist_success

    async def go_to(self, position: int) -> bool:
        self.go_to_position = position
        return self.go_to_success

    def get_status(self) -> Dict[str, Any]:
        return {
            "state": self.state.value,
            "current_image_id": 1,
            "images_displayed": 5,
        }


class MockPlaylistManager:
    """Mock playlist manager for testing."""

    def __init__(self):
        self.current_position = 0
        self.playlist = MagicMock()
        self.playlist.id = 1
        self.playlist.name = "Test Playlist"
        self.playlist.entry_count = 10

    def get_status(self) -> Dict[str, Any]:
        return {
            "playlist_id": 1,
            "name": "Test Playlist",
            "position": self.current_position,
            "entry_count": 10,
        }


# === Configuration Tests ===


def test_config_defaults():
    """Test CommandHandlerConfig defaults."""
    config = CommandHandlerConfig()
    assert config.send_acknowledgment is True
    assert config.response_priority == 3
    assert config.command_timeout == 30.0


def test_config_custom_values():
    """Test CommandHandlerConfig custom values."""
    config = CommandHandlerConfig(
        send_acknowledgment=False,
        response_priority=1,
        command_timeout=10.0,
    )
    assert config.send_acknowledgment is False
    assert config.response_priority == 1
    assert config.command_timeout == 10.0


# === CommandResult Tests ===


def test_command_result_to_dict():
    """Test CommandResult serialization."""
    result = CommandResult(
        command="next",
        status=CommandStatus.SUCCESS,
        message="Advanced",
        data={"position": 5},
        request_id="req-123",
    )
    d = result.to_dict()

    assert d["command"] == "next"
    assert d["status"] == "success"
    assert d["message"] == "Advanced"
    assert d["data"] == {"position": 5}
    assert d["request_id"] == "req-123"
    assert "timestamp" in d


def test_command_result_minimal():
    """Test CommandResult with minimal fields."""
    result = CommandResult(
        command="pause",
        status=CommandStatus.FAILED,
    )
    d = result.to_dict()

    assert d["command"] == "pause"
    assert d["status"] == "failed"
    assert "message" not in d
    assert "data" not in d
    assert "request_id" not in d


# === Handler Initialization Tests ===


def test_handler_initialization():
    """Test CommandHandler initialization."""
    ws = MockWebSocketClient()
    slideshow = MockSlideshow()
    playlist = MockPlaylistManager()

    handler = CommandHandler(
        websocket=ws,
        slideshow=slideshow,
        playlist=playlist,
    )

    assert handler.websocket == ws
    assert handler.slideshow == slideshow
    assert handler.playlist == playlist
    assert handler.is_running is False


def test_handler_with_config():
    """Test CommandHandler with custom config."""
    ws = MockWebSocketClient()
    config = CommandHandlerConfig(send_acknowledgment=False)

    handler = CommandHandler(
        websocket=ws,
        config=config,
    )

    assert handler.config.send_acknowledgment is False


# === Handler Lifecycle Tests ===


@pytest.mark.asyncio
async def test_handler_start_stop():
    """Test handler start and stop."""
    ws = MockWebSocketClient()
    handler = CommandHandler(websocket=ws)

    assert handler.is_running is False

    await handler.start()
    assert handler.is_running is True

    await handler.stop()
    assert handler.is_running is False


@pytest.mark.asyncio
async def test_handler_context_manager():
    """Test handler as async context manager."""
    ws = MockWebSocketClient()
    handler = CommandHandler(websocket=ws)

    async with handler:
        assert handler.is_running is True

    assert handler.is_running is False


# === Command Handling Tests ===


@pytest.mark.asyncio
async def test_handle_next_command():
    """Test handling 'next' command."""
    ws = MockWebSocketClient()
    slideshow = MockSlideshow()

    async with CommandHandler(websocket=ws, slideshow=slideshow) as handler:
        await handler.handle_message("command", {
            "command": "next",
            "params": {},
        })

    assert slideshow.next_called is True
    assert len(ws.sent_messages) == 1
    assert ws.sent_messages[0][0] == "command_response"
    assert ws.sent_messages[0][1]["status"] == "success"


@pytest.mark.asyncio
async def test_handle_previous_command():
    """Test handling 'previous' command."""
    ws = MockWebSocketClient()
    slideshow = MockSlideshow()

    async with CommandHandler(websocket=ws, slideshow=slideshow) as handler:
        await handler.handle_message("command", {
            "command": "previous",
        })

    assert slideshow.previous_called is True
    assert len(ws.sent_messages) == 1
    assert ws.sent_messages[0][1]["status"] == "success"


@pytest.mark.asyncio
async def test_handle_pause_command():
    """Test handling 'pause' command."""
    ws = MockWebSocketClient()
    slideshow = MockSlideshow()

    async with CommandHandler(websocket=ws, slideshow=slideshow) as handler:
        await handler.handle_message("command", {
            "command": "pause",
        })

    assert slideshow.pause_called is True
    assert ws.sent_messages[0][1]["status"] == "success"
    assert ws.sent_messages[0][1]["data"]["state"] == "paused"


@pytest.mark.asyncio
async def test_handle_resume_command():
    """Test handling 'resume' command."""
    ws = MockWebSocketClient()
    slideshow = MockSlideshow()
    slideshow.state.value = "paused"

    async with CommandHandler(websocket=ws, slideshow=slideshow) as handler:
        await handler.handle_message("command", {
            "command": "resume",
        })

    assert slideshow.resume_called is True
    assert ws.sent_messages[0][1]["status"] == "success"


@pytest.mark.asyncio
async def test_handle_play_command():
    """Test handling 'play' command (alias for resume)."""
    ws = MockWebSocketClient()
    slideshow = MockSlideshow()
    slideshow.state.value = "paused"

    async with CommandHandler(websocket=ws, slideshow=slideshow) as handler:
        await handler.handle_message("command", {
            "command": "play",
        })

    assert slideshow.resume_called is True


@pytest.mark.asyncio
async def test_handle_reload_playlist_command():
    """Test handling 'reload_playlist' command."""
    ws = MockWebSocketClient()
    slideshow = MockSlideshow()

    async with CommandHandler(websocket=ws, slideshow=slideshow) as handler:
        await handler.handle_message("command", {
            "command": "reload_playlist",
        })

    assert slideshow.reload_playlist_called is True
    assert ws.sent_messages[0][1]["status"] == "success"
    assert ws.sent_messages[0][1]["data"]["playlist"]["id"] == 1


@pytest.mark.asyncio
async def test_handle_go_to_command():
    """Test handling 'go_to' command."""
    ws = MockWebSocketClient()
    slideshow = MockSlideshow()

    async with CommandHandler(websocket=ws, slideshow=slideshow) as handler:
        await handler.handle_message("command", {
            "command": "go_to",
            "params": {"position": 5},
        })

    assert slideshow.go_to_position == 5
    assert ws.sent_messages[0][1]["status"] == "success"


@pytest.mark.asyncio
async def test_handle_clear_command():
    """Test handling 'clear' command."""
    ws = MockWebSocketClient()
    slideshow = MockSlideshow()

    async with CommandHandler(websocket=ws, slideshow=slideshow) as handler:
        await handler.handle_message("command", {
            "command": "clear",
        })

    slideshow.display.clear.assert_called_once()
    assert ws.sent_messages[0][1]["status"] == "success"


@pytest.mark.asyncio
async def test_handle_status_command():
    """Test handling 'status' command."""
    ws = MockWebSocketClient()
    slideshow = MockSlideshow()
    playlist = MockPlaylistManager()

    async with CommandHandler(websocket=ws, slideshow=slideshow, playlist=playlist) as handler:
        await handler.handle_message("command", {
            "command": "status",
        })

    assert ws.sent_messages[0][1]["status"] == "success"
    assert "slideshow" in ws.sent_messages[0][1]["data"]
    assert "playlist" in ws.sent_messages[0][1]["data"]
    assert "command_handler" in ws.sent_messages[0][1]["data"]


# === Error Handling Tests ===


@pytest.mark.asyncio
async def test_handle_unknown_command():
    """Test handling unknown command."""
    ws = MockWebSocketClient()

    async with CommandHandler(websocket=ws) as handler:
        await handler.handle_message("command", {
            "command": "unknown_cmd",
        })

    assert len(ws.sent_messages) == 1
    assert ws.sent_messages[0][1]["status"] == "unknown_command"
    assert "unknown_cmd" in ws.sent_messages[0][1]["message"]


@pytest.mark.asyncio
async def test_handle_command_without_slideshow():
    """Test handling command when slideshow not available."""
    ws = MockWebSocketClient()

    async with CommandHandler(websocket=ws) as handler:
        await handler.handle_message("command", {
            "command": "next",
        })

    assert ws.sent_messages[0][1]["status"] == "failed"
    assert "not available" in ws.sent_messages[0][1]["message"]


@pytest.mark.asyncio
async def test_handle_failed_command():
    """Test handling command that returns failure."""
    ws = MockWebSocketClient()
    slideshow = MockSlideshow()
    slideshow.next_success = False

    async with CommandHandler(websocket=ws, slideshow=slideshow) as handler:
        await handler.handle_message("command", {
            "command": "next",
        })

    assert ws.sent_messages[0][1]["status"] == "failed"


@pytest.mark.asyncio
async def test_ignore_non_command_message():
    """Test that non-command messages are ignored."""
    ws = MockWebSocketClient()
    slideshow = MockSlideshow()

    async with CommandHandler(websocket=ws, slideshow=slideshow) as handler:
        await handler.handle_message("status", {"some": "data"})
        await handler.handle_message("other", {"other": "data"})

    assert len(ws.sent_messages) == 0


@pytest.mark.asyncio
async def test_handle_command_when_not_running():
    """Test that commands are ignored when handler not running."""
    ws = MockWebSocketClient()
    slideshow = MockSlideshow()

    handler = CommandHandler(websocket=ws, slideshow=slideshow)
    # Don't call start()

    await handler.handle_message("command", {"command": "next"})

    assert slideshow.next_called is False
    assert len(ws.sent_messages) == 0


# === Request ID Tests ===


@pytest.mark.asyncio
async def test_request_id_preserved():
    """Test that request_id is preserved in response."""
    ws = MockWebSocketClient()
    slideshow = MockSlideshow()

    async with CommandHandler(websocket=ws, slideshow=slideshow) as handler:
        await handler.handle_message("command", {
            "command": "next",
            "request_id": "req-456",
        })

    assert ws.sent_messages[0][1]["request_id"] == "req-456"


# === Callback Tests ===


@pytest.mark.asyncio
async def test_command_callback():
    """Test command result callbacks."""
    ws = MockWebSocketClient()
    slideshow = MockSlideshow()

    callback_results = []

    def callback(cmd: str, result: CommandResult):
        callback_results.append((cmd, result))

    handler = CommandHandler(websocket=ws, slideshow=slideshow)
    handler.add_callback(callback)

    async with handler:
        await handler.handle_message("command", {"command": "next"})

    assert len(callback_results) == 1
    assert callback_results[0][0] == "next"
    assert callback_results[0][1].status == CommandStatus.SUCCESS


@pytest.mark.asyncio
async def test_remove_callback():
    """Test removing command callback."""
    ws = MockWebSocketClient()
    callback_results = []

    def callback(cmd: str, result: CommandResult):
        callback_results.append(cmd)

    handler = CommandHandler(websocket=ws)
    handler.add_callback(callback)
    handler.remove_callback(callback)

    async with handler:
        await handler.handle_message("command", {"command": "status"})

    # Callback should not be called
    assert len(callback_results) == 0


# === Statistics Tests ===


@pytest.mark.asyncio
async def test_statistics_tracking():
    """Test command statistics tracking."""
    ws = MockWebSocketClient()
    slideshow = MockSlideshow()

    async with CommandHandler(websocket=ws, slideshow=slideshow) as handler:
        # Successful command
        await handler.handle_message("command", {"command": "next"})

        # Failed command
        slideshow.next_success = False
        await handler.handle_message("command", {"command": "next"})

        # Unknown command
        await handler.handle_message("command", {"command": "unknown"})

        stats = handler.get_stats()

    assert stats["commands_received"] == 3
    assert stats["commands_succeeded"] == 1
    assert stats["commands_failed"] == 1
    assert stats["unknown_commands"] == 1


# === Acknowledgment Tests ===


@pytest.mark.asyncio
async def test_no_acknowledgment_when_disabled():
    """Test that acknowledgment is not sent when disabled."""
    ws = MockWebSocketClient()
    slideshow = MockSlideshow()
    config = CommandHandlerConfig(send_acknowledgment=False)

    handler = CommandHandler(
        websocket=ws,
        slideshow=slideshow,
        config=config,
    )

    async with handler:
        await handler.handle_message("command", {"command": "next"})

    assert len(ws.sent_messages) == 0


@pytest.mark.asyncio
async def test_response_priority():
    """Test that response uses configured priority."""
    ws = MockWebSocketClient()
    slideshow = MockSlideshow()
    config = CommandHandlerConfig(response_priority=1)

    async with CommandHandler(websocket=ws, slideshow=slideshow, config=config) as handler:
        await handler.handle_message("command", {"command": "next"})

    assert ws.sent_messages[0][3] == 1  # Priority


# === Factory Function Tests ===


def test_create_command_handler():
    """Test factory function."""
    ws = MockWebSocketClient()
    slideshow = MockSlideshow()

    handler = create_command_handler(
        websocket=ws,
        slideshow=slideshow,
        send_acknowledgment=False,
    )

    assert handler.websocket == ws
    assert handler.slideshow == slideshow
    assert handler.config.send_acknowledgment is False


# === Case Insensitivity Tests ===


@pytest.mark.asyncio
async def test_command_case_insensitive():
    """Test that commands are case-insensitive."""
    ws = MockWebSocketClient()
    slideshow = MockSlideshow()

    async with CommandHandler(websocket=ws, slideshow=slideshow) as handler:
        await handler.handle_message("command", {"command": "NEXT"})
        await handler.handle_message("command", {"command": "Pause"})
        await handler.handle_message("command", {"command": "RELOAD_PLAYLIST"})

    assert slideshow.next_called is True
    assert slideshow.pause_called is True
    assert slideshow.reload_playlist_called is True
    assert len(ws.sent_messages) == 3
