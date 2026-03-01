"""
Tests for Task 7.1: Error Handling.

Tests comprehensive error handling across the display engine, daemon, and status reporting.
"""

import asyncio
import pytest
import time
from unittest.mock import AsyncMock, MagicMock, patch

from glowworm_daemon.slideshow_orchestrator import (
    SlideshowOrchestrator,
    SlideshowConfig,
    SlideshowState,
    SlideshowError,
)
from glowworm_daemon.status_reporter import (
    StatusReporter,
    StatusReporterConfig,
    DeviceStatus,
)
from glowworm_daemon.display_controller import (
    DisplayController,
    DisplayControllerConfig,
)


class TestSlideshowError:
    """Test SlideshowError dataclass."""

    def test_error_creation(self):
        """Test basic error creation."""
        error = SlideshowError(
            message="Test error",
            code="TEST",
            details="Some details",
            recoverable=True,
        )

        assert error.message == "Test error"
        assert error.code == "TEST"
        assert error.details == "Some details"
        assert error.recoverable is True
        assert error.timestamp > 0

    def test_error_auto_timestamp(self):
        """Test that timestamp is auto-populated."""
        before = time.time()
        error = SlideshowError(message="Test", code="TEST")
        after = time.time()

        assert before <= error.timestamp <= after

    def test_error_explicit_timestamp(self):
        """Test explicit timestamp."""
        error = SlideshowError(
            message="Test",
            code="TEST",
            timestamp=1234567890.0,
        )

        assert error.timestamp == 1234567890.0


class TestSlideshowOrchestratorErrorHandling:
    """Test error handling in SlideshowOrchestrator."""

    @pytest.fixture
    def mock_display(self):
        """Create a mock DisplayController."""
        display = MagicMock()
        display.is_running = True
        display.show_error = AsyncMock(return_value=True)
        display.clear_error = AsyncMock(return_value=True)
        display.load_image = AsyncMock(return_value=True)
        return display

    @pytest.fixture
    def mock_playlist(self):
        """Create a mock PlaylistManager."""
        playlist = MagicMock()
        playlist.playlist = MagicMock(
            id=1,
            name="Test Playlist",
            entry_count=5,
            display_time_seconds=30.0,
        )
        playlist.current_position = 0
        playlist.get_current_images = MagicMock(return_value=[
            MagicMock(id=1, url="http://example.com/1.jpg")
        ])
        playlist.next = MagicMock(return_value=(MagicMock(), 1))
        return playlist

    @pytest.fixture
    def mock_images(self):
        """Create a mock ImageManager."""
        images = MagicMock()
        images.get_cached_path = MagicMock(return_value=None)
        images.download_image = AsyncMock(return_value=(None, "failed"))
        return images

    @pytest.fixture
    def orchestrator(self, mock_display, mock_playlist, mock_images):
        """Create a SlideshowOrchestrator with mocks."""
        return SlideshowOrchestrator(
            display=mock_display,
            playlist=mock_playlist,
            images=mock_images,
            config=SlideshowConfig(
                default_display_time=1.0,
                max_image_retries=1,
                image_retry_delay=0.1,
            ),
        )

    @pytest.mark.asyncio
    async def test_report_error_logs_and_records(self, orchestrator):
        """Test that _report_error logs and records error."""
        await orchestrator._report_error(
            message="Test error message",
            code="TEST_CODE",
            details="Technical details",
            recoverable=True,
            show_on_display=False,
        )

        # Check error was recorded in stats
        assert orchestrator._stats.errors == 1
        assert orchestrator._stats.last_error is not None
        assert orchestrator._stats.last_error.message == "Test error message"
        assert orchestrator._stats.last_error.code == "TEST_CODE"
        assert orchestrator._stats.last_error.details == "Technical details"
        assert orchestrator._stats.last_error.recoverable is True

    @pytest.mark.asyncio
    async def test_report_error_shows_on_display(self, orchestrator, mock_display):
        """Test that _report_error can show error on display."""
        await orchestrator._report_error(
            message="Display error",
            code="DISPLAY",
            show_on_display=True,
        )

        mock_display.show_error.assert_called_once_with(
            message="Display error",
            code="DISPLAY",
            details=None,
            recoverable=True,
        )

    @pytest.mark.asyncio
    async def test_clear_error_display(self, orchestrator, mock_display):
        """Test clearing error display."""
        await orchestrator.clear_error_display()

        mock_display.clear_error.assert_called_once()

    def test_last_error_property(self, orchestrator):
        """Test last_error property."""
        # Initially None
        assert orchestrator.last_error is None

        # After setting
        orchestrator._stats.last_error = SlideshowError(
            message="Test",
            code="TEST",
        )

        assert orchestrator.last_error is not None
        assert orchestrator.last_error.message == "Test"

    def test_get_status_includes_error_info(self, orchestrator):
        """Test that get_status includes error information."""
        # Set an error
        orchestrator._stats.last_error = SlideshowError(
            message="Error message",
            code="ERROR_CODE",
            timestamp=1234567890.0,
            recoverable=True,
        )

        status = orchestrator.get_status()

        assert status["has_error"] is True
        assert "last_error" in status
        assert status["last_error"]["message"] == "Error message"
        assert status["last_error"]["code"] == "ERROR_CODE"
        assert status["last_error"]["timestamp"] == 1234567890.0
        assert status["last_error"]["recoverable"] is True

    def test_get_status_no_error(self, orchestrator):
        """Test get_status when no error."""
        status = orchestrator.get_status()

        assert status["has_error"] is False
        assert "last_error" not in status


class TestStatusReporterErrorHandling:
    """Test error handling in StatusReporter."""

    @pytest.fixture
    def mock_websocket(self):
        """Create a mock WebSocketClient."""
        ws = MagicMock()
        ws.send = AsyncMock(return_value=True)
        return ws

    @pytest.fixture
    def mock_slideshow(self):
        """Create a mock SlideshowOrchestrator."""
        slideshow = MagicMock()
        slideshow.get_status = MagicMock(return_value={
            "state": "playing",
            "has_error": True,
            "last_error": {
                "message": "Image load failed",
                "code": "IMAGE_LOAD",
                "timestamp": 1234567890.0,
                "recoverable": True,
            },
            "current_image_id": 1,
            "current_image_path": "/path/to/image.jpg",
            "images_displayed": 10,
            "images_skipped": 2,
            "transitions_completed": 8,
            "errors": 2,
            "runtime_seconds": 300.0,
            "playlist": {
                "id": 1,
                "name": "Test",
                "position": 5,
                "entry_count": 20,
            },
        })
        slideshow.add_state_callback = MagicMock()
        return slideshow

    @pytest.fixture
    def reporter(self, mock_websocket, mock_slideshow):
        """Create a StatusReporter with mocks."""
        return StatusReporter(
            websocket=mock_websocket,
            slideshow=mock_slideshow,
            config=StatusReporterConfig(
                report_interval=60.0,
                min_report_interval=0.0,
            ),
        )

    def test_device_status_includes_error_fields(self):
        """Test DeviceStatus has error fields."""
        status = DeviceStatus(
            state="error",
            has_error=True,
            error_message="Test error",
            error_code="TEST",
            error_timestamp=1234567890.0,
        )

        assert status.has_error is True
        assert status.error_message == "Test error"
        assert status.error_code == "TEST"
        assert status.error_timestamp == 1234567890.0

    def test_device_status_to_dict_with_error(self):
        """Test DeviceStatus.to_dict includes error info."""
        status = DeviceStatus(
            state="error",
            has_error=True,
            error_message="Test error",
            error_code="TEST",
            error_timestamp=1234567890.0,
        )

        data = status.to_dict()

        assert data["has_error"] is True
        assert data["error"] is not None
        assert data["error"]["message"] == "Test error"
        assert data["error"]["code"] == "TEST"
        assert data["error"]["timestamp"] == 1234567890.0

    def test_device_status_to_dict_without_error(self):
        """Test DeviceStatus.to_dict without error."""
        status = DeviceStatus(
            state="playing",
            has_error=False,
        )

        data = status.to_dict()

        assert data["has_error"] is False
        assert data["error"] is None

    def test_collect_status_includes_error(self, reporter, mock_slideshow):
        """Test _collect_status includes error from slideshow."""
        status = reporter._collect_status()

        assert status.has_error is True
        assert status.error_message == "Image load failed"
        assert status.error_code == "IMAGE_LOAD"
        assert status.error_timestamp == 1234567890.0


class TestDisplayControllerErrorHandling:
    """Test error handling in DisplayController."""

    @pytest.fixture
    def controller(self):
        """Create a DisplayController."""
        return DisplayController(
            config=DisplayControllerConfig(
                socket_path="/tmp/test_error.sock",
                startup_timeout=1.0,
            )
        )

    @pytest.mark.asyncio
    async def test_show_error_not_connected(self, controller):
        """Test show_error when not connected."""
        result = await controller.show_error(
            message="Test error",
            code="TEST",
        )

        # Should return False when not connected
        assert result is False

    @pytest.mark.asyncio
    async def test_clear_error_not_connected(self, controller):
        """Test clear_error when not connected."""
        result = await controller.clear_error()

        # Should return False when not connected
        assert result is False

    @pytest.mark.asyncio
    async def test_show_error_with_mock_client(self, controller):
        """Test show_error with mocked IPC client."""
        # Mock the IPC client
        mock_client = MagicMock()
        mock_client.is_connected = True
        mock_client.call = AsyncMock(return_value=MagicMock(
            success=True,
            result={"success": True, "state": "error"},
        ))

        controller._ipc_client = mock_client

        result = await controller.show_error(
            message="Test error",
            code="TEST_CODE",
            details="Some details",
            recoverable=True,
        )

        assert result is True
        mock_client.call.assert_called_once()

        # Verify the call parameters
        call_args = mock_client.call.call_args
        assert call_args[0][0] == "show_error"
        assert call_args[0][1]["message"] == "Test error"
        assert call_args[0][1]["code"] == "TEST_CODE"
        assert call_args[0][1]["details"] == "Some details"
        assert call_args[0][1]["recoverable"] is True

    @pytest.mark.asyncio
    async def test_clear_error_with_mock_client(self, controller):
        """Test clear_error with mocked IPC client."""
        mock_client = MagicMock()
        mock_client.is_connected = True
        mock_client.call = AsyncMock(return_value=MagicMock(
            success=True,
            result={"success": True, "state": "idle"},
        ))

        controller._ipc_client = mock_client

        result = await controller.clear_error()

        assert result is True
        mock_client.call.assert_called_once_with("clear_error")


class TestErrorRecovery:
    """Test error recovery strategies."""

    @pytest.fixture
    def mock_display(self):
        """Create a mock DisplayController."""
        display = MagicMock()
        display.is_running = True
        display.show_error = AsyncMock(return_value=True)
        display.clear_error = AsyncMock(return_value=True)
        display.load_image = AsyncMock(return_value=True)
        return display

    @pytest.fixture
    def mock_playlist(self):
        """Create a mock PlaylistManager."""
        playlist = MagicMock()
        playlist.playlist = MagicMock(
            id=1,
            name="Test Playlist",
            entry_count=5,
            display_time_seconds=1.0,
        )
        playlist.current_position = 0
        playlist.get_current_images = MagicMock(return_value=[
            MagicMock(id=1, url="http://example.com/1.jpg")
        ])
        playlist.next = MagicMock(return_value=(MagicMock(), 1))
        return playlist

    @pytest.fixture
    def mock_images(self):
        """Create a mock ImageManager with retry behavior."""
        images = MagicMock()
        images.get_cached_path = MagicMock(return_value=None)
        # First call fails, second succeeds
        images.download_image = AsyncMock(side_effect=[
            (None, "failed"),
            ("/path/to/image.jpg", "success"),
        ])
        return images

    @pytest.mark.asyncio
    async def test_image_load_retry(self, mock_display, mock_playlist, mock_images):
        """Test that image loading is retried on failure."""
        from pathlib import Path

        # Create a mock path that exists
        mock_path = MagicMock(spec=Path)
        mock_path.exists.return_value = True

        # Configure to succeed on second attempt
        mock_images.download_image = AsyncMock(side_effect=[
            (None, "failed"),
            (mock_path, "success"),
        ])

        orchestrator = SlideshowOrchestrator(
            display=mock_display,
            playlist=mock_playlist,
            images=mock_images,
            config=SlideshowConfig(
                default_display_time=1.0,
                max_image_retries=2,  # Allow retry
                image_retry_delay=0.01,
            ),
        )

        # Get image path (this should retry)
        image = MagicMock(id=1)
        path = await orchestrator._get_image_path(image)

        # Should have called download twice
        assert mock_images.download_image.call_count == 2
        assert path is not None

    @pytest.mark.asyncio
    async def test_skip_on_max_retries(self, mock_display, mock_playlist, mock_images):
        """Test that image is skipped after max retries."""
        # Always fail
        mock_images.download_image = AsyncMock(return_value=(None, "failed"))

        orchestrator = SlideshowOrchestrator(
            display=mock_display,
            playlist=mock_playlist,
            images=mock_images,
            config=SlideshowConfig(
                default_display_time=1.0,
                max_image_retries=2,
                image_retry_delay=0.01,
            ),
        )

        # Get image path (this should fail after retries)
        image = MagicMock(id=1)
        path = await orchestrator._get_image_path(image)

        # Should have tried max_image_retries times
        assert mock_images.download_image.call_count == 2
        assert path is None


class TestErrorInfoExport:
    """Test that error info is properly exported."""

    def test_slideshow_error_exported(self):
        """Test SlideshowError is exported from daemon module."""
        from glowworm_daemon import SlideshowError

        error = SlideshowError(message="Test", code="TEST")
        assert error.message == "Test"

    def test_error_info_exported_from_display(self):
        """Test ErrorInfo is exported from display module."""
        from glowworm_display import ErrorInfo

        error = ErrorInfo(message="Test", code="TEST")
        assert error.message == "Test"
