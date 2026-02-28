"""
Tests for StatusReporter.
"""

import asyncio
import pytest
import time
from unittest.mock import AsyncMock, MagicMock, patch

from glowworm_daemon.status_reporter import (
    StatusReporter,
    StatusReporterConfig,
    DeviceStatus,
    ReporterState,
    create_status_reporter,
)
from glowworm_daemon.slideshow_orchestrator import SlideshowState
from glowworm_daemon.display_controller import DisplayState
from glowworm_daemon.cache import CacheStats


class TestStatusReporterConfig:
    """Tests for StatusReporterConfig."""

    def test_default_values(self):
        """Test default configuration values."""
        config = StatusReporterConfig()

        assert config.report_interval == 30.0
        assert config.report_on_state_change is True
        assert config.min_report_interval == 1.0
        assert config.status_priority == 5
        assert config.include_cache_details is True

    def test_custom_values(self):
        """Test custom configuration values."""
        config = StatusReporterConfig(
            report_interval=60.0,
            report_on_state_change=False,
            min_report_interval=5.0,
            status_priority=10,
            include_cache_details=False,
        )

        assert config.report_interval == 60.0
        assert config.report_on_state_change is False
        assert config.min_report_interval == 5.0
        assert config.status_priority == 10
        assert config.include_cache_details is False


class TestDeviceStatus:
    """Tests for DeviceStatus dataclass."""

    def test_default_values(self):
        """Test default status values."""
        status = DeviceStatus(state="playing")

        assert status.state == "playing"
        assert status.is_online is True
        assert status.current_image_id is None
        assert status.images_displayed == 0
        assert status.cache_entry_count == 0
        assert status.display_running is False
        assert status.timestamp > 0

    def test_to_dict(self):
        """Test status serialization to dictionary."""
        status = DeviceStatus(
            state="playing",
            current_image_id=123,
            current_image_path="/cache/123.jpg",
            images_displayed=10,
            images_skipped=2,
            transitions_completed=9,
            errors=1,
            runtime_seconds=300.5,
            playlist_id=1,
            playlist_name="Test Playlist",
            playlist_position=5,
            playlist_entry_count=20,
            cache_entry_count=15,
            cache_size_mb=50.123,
            cache_max_size_mb=500,
            cache_hit_rate=0.857,
            uptime_seconds=3600.5,
            display_running=True,
            display_state="running",
        )

        result = status.to_dict()

        assert result["state"] == "playing"
        assert result["is_online"] is True
        assert result["current_image_id"] == 123
        assert result["current_image_path"] == "/cache/123.jpg"

        # Slideshow stats
        assert result["slideshow"]["images_displayed"] == 10
        assert result["slideshow"]["images_skipped"] == 2
        assert result["slideshow"]["transitions_completed"] == 9
        assert result["slideshow"]["errors"] == 1
        assert result["slideshow"]["runtime_seconds"] == 300.5

        # Playlist info
        assert result["playlist"]["id"] == 1
        assert result["playlist"]["name"] == "Test Playlist"
        assert result["playlist"]["position"] == 5
        assert result["playlist"]["entry_count"] == 20

        # Cache stats
        assert result["cache"]["entry_count"] == 15
        assert result["cache"]["size_mb"] == 50.12  # Rounded
        assert result["cache"]["max_size_mb"] == 500
        assert result["cache"]["hit_rate"] == 0.857

        # Display
        assert result["display"]["running"] is True
        assert result["display"]["state"] == "running"

        # Meta
        assert result["uptime_seconds"] == 3600.5
        assert "timestamp" in result


class TestStatusReporter:
    """Tests for StatusReporter."""

    @pytest.fixture
    def mock_websocket(self):
        """Create mock WebSocket client."""
        ws = MagicMock()
        ws.send = AsyncMock(return_value=True)
        ws.is_connected = True
        return ws

    @pytest.fixture
    def mock_slideshow(self):
        """Create mock slideshow orchestrator."""
        slideshow = MagicMock()
        slideshow.state = SlideshowState.PLAYING
        slideshow.get_status.return_value = {
            "state": "playing",
            "current_image_id": 123,
            "current_image_path": "/cache/123.jpg",
            "images_displayed": 10,
            "images_skipped": 1,
            "transitions_completed": 9,
            "errors": 0,
            "runtime_seconds": 300.0,
            "playlist": {
                "id": 1,
                "name": "Test Playlist",
                "position": 5,
                "entry_count": 20,
            },
        }
        slideshow.add_state_callback = MagicMock()
        return slideshow

    @pytest.fixture
    def mock_display(self):
        """Create mock display controller."""
        display = MagicMock()
        display.is_running = True
        display.state = DisplayState.RUNNING
        return display

    @pytest.fixture
    def mock_cache(self):
        """Create mock image cache."""
        cache = MagicMock()
        cache.get_stats.return_value = CacheStats(
            entry_count=15,
            total_size_bytes=52428800,  # 50 MB
            total_size_mb=50.0,
            max_size_mb=500,
            usage_percent=10.0,
            hits=100,
            misses=10,
            hit_rate=0.909,
            evictions=5,
            free_space_mb=1000,
        )
        return cache

    def test_initialization(self, mock_websocket):
        """Test reporter initialization."""
        config = StatusReporterConfig(report_interval=60.0)
        reporter = StatusReporter(websocket=mock_websocket, config=config)

        assert reporter.state == ReporterState.STOPPED
        assert reporter.is_running is False
        assert reporter.websocket == mock_websocket
        assert reporter.config.report_interval == 60.0

    @pytest.mark.asyncio
    async def test_start_stop(self, mock_websocket):
        """Test reporter start and stop."""
        reporter = StatusReporter(
            websocket=mock_websocket,
            config=StatusReporterConfig(report_interval=60.0),
        )

        await reporter.start()
        assert reporter.state == ReporterState.RUNNING
        assert reporter.is_running is True

        # Should have sent initial status
        mock_websocket.send.assert_called()

        await reporter.stop()
        assert reporter.state == ReporterState.STOPPED
        assert reporter.is_running is False

    @pytest.mark.asyncio
    async def test_start_already_running(self, mock_websocket):
        """Test starting when already running."""
        reporter = StatusReporter(websocket=mock_websocket)

        await reporter.start()
        await reporter.start()  # Should not raise

        assert reporter.state == ReporterState.RUNNING
        await reporter.stop()

    @pytest.mark.asyncio
    async def test_report_status(self, mock_websocket, mock_slideshow, mock_display, mock_cache):
        """Test status reporting."""
        reporter = StatusReporter(
            websocket=mock_websocket,
            slideshow=mock_slideshow,
            display=mock_display,
            cache=mock_cache,
        )

        result = await reporter.report_status(force=True)
        assert result is True

        # Verify send was called with correct message type
        mock_websocket.send.assert_called_once()
        call_args = mock_websocket.send.call_args

        assert call_args.kwargs["message_type"] == "status"
        assert call_args.kwargs["queue_if_offline"] is True

        payload = call_args.kwargs["payload"]
        assert payload["state"] == "playing"
        assert payload["current_image_id"] == 123

    @pytest.mark.asyncio
    async def test_report_status_rate_limiting(self, mock_websocket):
        """Test rate limiting of status reports."""
        config = StatusReporterConfig(min_report_interval=5.0)
        reporter = StatusReporter(websocket=mock_websocket, config=config)

        # First report should succeed
        result1 = await reporter.report_status(force=True)
        assert result1 is True

        # Second report should be rate limited (within min_report_interval)
        result2 = await reporter.report_status(force=False)
        assert result2 is False

        # Force should bypass rate limiting
        result3 = await reporter.report_status(force=True)
        assert result3 is True

    @pytest.mark.asyncio
    async def test_report_queued_when_offline(self, mock_websocket):
        """Test status queued when offline."""
        mock_websocket.send = AsyncMock(return_value=False)  # Not sent immediately

        reporter = StatusReporter(websocket=mock_websocket)
        result = await reporter.report_status(force=True)

        assert result is True  # Still returns True because message was queued
        mock_websocket.send.assert_called_once()
        assert mock_websocket.send.call_args.kwargs["queue_if_offline"] is True

    @pytest.mark.asyncio
    async def test_state_change_callback_registered(self, mock_websocket, mock_slideshow):
        """Test state change callback is registered with slideshow."""
        reporter = StatusReporter(
            websocket=mock_websocket,
            slideshow=mock_slideshow,
            config=StatusReporterConfig(report_on_state_change=True),
        )

        await reporter.start()

        mock_slideshow.add_state_callback.assert_called_once()
        await reporter.stop()

    @pytest.mark.asyncio
    async def test_state_change_callback_disabled(self, mock_websocket, mock_slideshow):
        """Test state change callback not registered when disabled."""
        reporter = StatusReporter(
            websocket=mock_websocket,
            slideshow=mock_slideshow,
            config=StatusReporterConfig(report_on_state_change=False),
        )

        await reporter.start()

        mock_slideshow.add_state_callback.assert_not_called()
        await reporter.stop()

    @pytest.mark.asyncio
    async def test_status_callback(self, mock_websocket):
        """Test status callbacks are invoked."""
        reporter = StatusReporter(websocket=mock_websocket)

        received_status = []

        def callback(status: DeviceStatus):
            received_status.append(status)

        reporter.add_callback(callback)
        await reporter.report_status(force=True)

        assert len(received_status) == 1
        assert isinstance(received_status[0], DeviceStatus)

    @pytest.mark.asyncio
    async def test_remove_callback(self, mock_websocket):
        """Test removing status callback."""
        reporter = StatusReporter(websocket=mock_websocket)

        received_status = []

        def callback(status: DeviceStatus):
            received_status.append(status)

        reporter.add_callback(callback)
        reporter.remove_callback(callback)

        await reporter.report_status(force=True)

        assert len(received_status) == 0

    @pytest.mark.asyncio
    async def test_collect_status_no_components(self, mock_websocket):
        """Test status collection with no components."""
        reporter = StatusReporter(websocket=mock_websocket)

        status = reporter._collect_status()

        assert status.state == "stopped"
        assert status.current_image_id is None
        assert status.display_running is False

    @pytest.mark.asyncio
    async def test_collect_status_with_slideshow(self, mock_websocket, mock_slideshow):
        """Test status collection with slideshow."""
        reporter = StatusReporter(
            websocket=mock_websocket,
            slideshow=mock_slideshow,
        )

        status = reporter._collect_status()

        assert status.state == "playing"
        assert status.current_image_id == 123
        assert status.playlist_id == 1
        assert status.images_displayed == 10

    @pytest.mark.asyncio
    async def test_collect_status_with_display(self, mock_websocket, mock_display):
        """Test status collection with display controller."""
        reporter = StatusReporter(
            websocket=mock_websocket,
            display=mock_display,
        )

        status = reporter._collect_status()

        assert status.display_running is True
        assert status.display_state == "running"

    @pytest.mark.asyncio
    async def test_collect_status_with_cache(self, mock_websocket, mock_cache):
        """Test status collection with cache."""
        reporter = StatusReporter(
            websocket=mock_websocket,
            cache=mock_cache,
        )

        status = reporter._collect_status()

        assert status.cache_entry_count == 15
        assert status.cache_size_mb == 50.0
        assert status.cache_max_size_mb == 500

    @pytest.mark.asyncio
    async def test_uptime_tracking(self, mock_websocket):
        """Test uptime is tracked from start."""
        reporter = StatusReporter(websocket=mock_websocket)

        await reporter.start()
        await asyncio.sleep(0.1)

        status = reporter._collect_status()
        assert status.uptime_seconds >= 0.1

        await reporter.stop()

    @pytest.mark.asyncio
    async def test_get_last_status(self, mock_websocket, mock_slideshow):
        """Test getting last status without sending."""
        reporter = StatusReporter(
            websocket=mock_websocket,
            slideshow=mock_slideshow,
        )

        status = reporter.get_last_status()

        assert isinstance(status, DeviceStatus)
        assert status.state == "playing"

        # Should not have sent anything
        mock_websocket.send.assert_not_called()

    @pytest.mark.asyncio
    async def test_periodic_reporting(self, mock_websocket):
        """Test periodic status reporting."""
        config = StatusReporterConfig(report_interval=0.1, min_report_interval=0.0)
        reporter = StatusReporter(websocket=mock_websocket, config=config)

        await reporter.start()

        # Wait for a few report cycles
        await asyncio.sleep(0.35)

        await reporter.stop()

        # Should have initial report + periodic reports
        assert mock_websocket.send.call_count >= 3

    @pytest.mark.asyncio
    async def test_context_manager(self, mock_websocket):
        """Test async context manager."""
        async with StatusReporter(websocket=mock_websocket) as reporter:
            assert reporter.is_running is True
            assert reporter.state == ReporterState.RUNNING

        assert reporter.state == ReporterState.STOPPED

    @pytest.mark.asyncio
    async def test_slideshow_state_mapping(self, mock_websocket, mock_slideshow):
        """Test slideshow state to status state mapping."""
        reporter = StatusReporter(
            websocket=mock_websocket,
            slideshow=mock_slideshow,
        )

        # Test various states
        state_mappings = [
            ("playing", "playing"),
            ("transitioning", "playing"),  # Transitioning maps to playing
            ("paused", "paused"),
            ("stopped", "stopped"),
            ("error", "error"),
        ]

        for slideshow_state, expected_status in state_mappings:
            mock_slideshow.get_status.return_value = {"state": slideshow_state}
            status = reporter._collect_status()
            assert status.state == expected_status, f"Failed for {slideshow_state}"

    @pytest.mark.asyncio
    async def test_send_error_handling(self, mock_websocket):
        """Test handling of send errors."""
        mock_websocket.send = AsyncMock(side_effect=Exception("Send failed"))

        reporter = StatusReporter(websocket=mock_websocket)
        result = await reporter.report_status(force=True)

        assert result is False

    @pytest.mark.asyncio
    async def test_callback_error_handling(self, mock_websocket):
        """Test handling of callback errors."""
        reporter = StatusReporter(websocket=mock_websocket)

        def bad_callback(status):
            raise ValueError("Callback error")

        reporter.add_callback(bad_callback)

        # Should not raise
        result = await reporter.report_status(force=True)
        assert result is True

    @pytest.mark.asyncio
    async def test_status_priority(self, mock_websocket):
        """Test status messages use configured priority."""
        config = StatusReporterConfig(status_priority=10)
        reporter = StatusReporter(websocket=mock_websocket, config=config)

        await reporter.report_status(force=True)

        call_args = mock_websocket.send.call_args
        assert call_args.kwargs["priority"] == 10


class TestCreateStatusReporter:
    """Tests for factory function."""

    def test_create_status_reporter(self):
        """Test factory function creates reporter."""
        mock_ws = MagicMock()

        reporter = create_status_reporter(
            websocket=mock_ws,
            report_interval=60.0,
            report_on_state_change=False,
        )

        assert isinstance(reporter, StatusReporter)
        assert reporter.config.report_interval == 60.0
        assert reporter.config.report_on_state_change is False

    def test_create_status_reporter_with_components(self):
        """Test factory function with all components."""
        mock_ws = MagicMock()
        mock_slideshow = MagicMock()
        mock_images = MagicMock()
        mock_display = MagicMock()
        mock_cache = MagicMock()

        reporter = create_status_reporter(
            websocket=mock_ws,
            slideshow=mock_slideshow,
            images=mock_images,
            display=mock_display,
            cache=mock_cache,
        )

        assert reporter.websocket == mock_ws
        assert reporter.slideshow == mock_slideshow
        assert reporter.images == mock_images
        assert reporter.display == mock_display
        assert reporter.cache == mock_cache
