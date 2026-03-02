"""
Status Reporter for GlowWorm v3.0.

Reports device status to backend via WebSocket with:
- Periodic status reporting (configurable interval)
- Immediate status report on state change
- Comprehensive device state including current image, slideshow state, cache stats
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
    from .image_manager import ImageManager
    from .display_controller import DisplayController
    from .cache import ImageCache

logger = logging.getLogger(__name__)


class ReporterState(str, Enum):
    """State of the status reporter."""
    STOPPED = "stopped"
    RUNNING = "running"
    ERROR = "error"


@dataclass
class StatusReporterConfig:
    """Configuration for status reporter."""
    # Interval for periodic status reporting in seconds
    report_interval: float = 30.0

    # Whether to report immediately on state changes
    report_on_state_change: bool = True

    # Minimum interval between reports (to prevent flooding)
    min_report_interval: float = 1.0

    # Priority for status messages in offline queue
    status_priority: int = 5  # Higher number = lower priority

    # Include detailed cache statistics
    include_cache_details: bool = True


@dataclass
class DeviceStatus:
    """Device status message payload."""
    # Current state
    state: str  # playing, paused, stopped, error, registration
    is_online: bool = True

    # Current image info
    current_image_id: Optional[int] = None
    current_image_path: Optional[str] = None

    # Slideshow stats
    images_displayed: int = 0
    images_skipped: int = 0
    transitions_completed: int = 0
    errors: int = 0
    runtime_seconds: float = 0.0

    # Playlist info
    playlist_id: Optional[int] = None
    playlist_name: Optional[str] = None
    playlist_position: int = 0
    playlist_entry_count: int = 0

    # Cache statistics
    cache_entry_count: int = 0
    cache_size_mb: float = 0.0
    cache_max_size_mb: float = 0.0
    cache_hit_rate: float = 0.0

    # Connection/uptime info
    uptime_seconds: float = 0.0
    timestamp: float = field(default_factory=time.time)

    # Display state
    display_running: bool = False
    display_state: str = "stopped"

    # Error info (v3.0)
    has_error: bool = False
    error_message: Optional[str] = None
    error_code: Optional[str] = None
    error_timestamp: Optional[float] = None

    # CEC capabilities (v3.0)
    cec_available: bool = False
    cec_devices: list = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "state": self.state,
            "is_online": self.is_online,
            "current_image_id": self.current_image_id,
            "current_image_path": self.current_image_path,
            "slideshow": {
                "images_displayed": self.images_displayed,
                "images_skipped": self.images_skipped,
                "transitions_completed": self.transitions_completed,
                "errors": self.errors,
                "runtime_seconds": round(self.runtime_seconds, 1),
            },
            "playlist": {
                "id": self.playlist_id,
                "name": self.playlist_name,
                "position": self.playlist_position,
                "entry_count": self.playlist_entry_count,
            },
            "cache": {
                "entry_count": self.cache_entry_count,
                "size_mb": round(self.cache_size_mb, 2),
                "max_size_mb": self.cache_max_size_mb,
                "hit_rate": round(self.cache_hit_rate, 3),
            },
            "display": {
                "running": self.display_running,
                "state": self.display_state,
            },
            "uptime_seconds": round(self.uptime_seconds, 1),
            "timestamp": self.timestamp,
            "has_error": self.has_error,
            "error": {
                "message": self.error_message,
                "code": self.error_code,
                "timestamp": self.error_timestamp,
            } if self.has_error else None,
            "cec": {
                "available": self.cec_available,
                "devices": self.cec_devices,
            },
        }


# Type for status change callbacks
StatusCallback = Callable[[DeviceStatus], None]


class StatusReporter:
    """
    Reports device status to backend via WebSocket.

    Features:
    - Periodic status reporting at configurable intervals
    - Immediate reporting on state changes
    - Rate limiting to prevent flooding
    - Offline queuing via WebSocket client
    - Comprehensive status aggregation from all components

    Usage:
        reporter = StatusReporter(
            websocket=ws_client,
            slideshow=slideshow,
            images=image_manager,
            display=display_controller,
            config=StatusReporterConfig(),
        )

        await reporter.start()
        # ...
        await reporter.stop()
    """

    def __init__(
        self,
        websocket: "WebSocketClient",
        slideshow: Optional["SlideshowOrchestrator"] = None,
        images: Optional["ImageManager"] = None,
        display: Optional["DisplayController"] = None,
        cache: Optional["ImageCache"] = None,
        cec_controller: Optional[Any] = None,
        config: Optional[StatusReporterConfig] = None,
    ) -> None:
        """
        Initialize status reporter.

        Args:
            websocket: WebSocket client for sending status
            slideshow: Optional SlideshowOrchestrator for state info
            images: Optional ImageManager for cache info
            display: Optional DisplayController for display state
            cache: Optional ImageCache for cache statistics
            cec_controller: Optional CECController for CEC capabilities
            config: Reporter configuration
        """
        self.websocket = websocket
        self.slideshow = slideshow
        self.images = images
        self.display = display
        self.cache = cache
        self.cec_controller = cec_controller
        self.config = config or StatusReporterConfig()

        self._state = ReporterState.STOPPED
        self._report_task: Optional[asyncio.Task] = None
        self._last_report_time: float = 0.0
        self._started_at: Optional[float] = None

        # Status callbacks
        self._callbacks: list[StatusCallback] = []

        logger.info(
            f"StatusReporter initialized: "
            f"interval={self.config.report_interval}s, "
            f"on_state_change={self.config.report_on_state_change}"
        )

    @property
    def state(self) -> ReporterState:
        """Current reporter state."""
        return self._state

    @property
    def is_running(self) -> bool:
        """Whether reporter is running."""
        return self._state == ReporterState.RUNNING

    def add_callback(self, callback: StatusCallback) -> None:
        """Add a callback for status reports."""
        self._callbacks.append(callback)

    def remove_callback(self, callback: StatusCallback) -> None:
        """Remove a status callback."""
        if callback in self._callbacks:
            self._callbacks.remove(callback)

    async def start(self) -> None:
        """Start the status reporter."""
        if self._state == ReporterState.RUNNING:
            logger.warning("StatusReporter already running")
            return

        self._started_at = time.time()
        self._state = ReporterState.RUNNING

        # Start periodic reporting task
        self._report_task = asyncio.create_task(self._report_loop())

        # Register state change callbacks with slideshow if available
        if self.slideshow and self.config.report_on_state_change:
            self.slideshow.add_state_callback(self._on_slideshow_state_change)

        # Send initial status
        await self.report_status()

        logger.info("StatusReporter started")

    async def stop(self) -> None:
        """Stop the status reporter."""
        if self._state != ReporterState.RUNNING:
            return

        self._state = ReporterState.STOPPED

        # Cancel report task
        if self._report_task:
            self._report_task.cancel()
            try:
                await self._report_task
            except asyncio.CancelledError:
                pass
            self._report_task = None

        logger.info("StatusReporter stopped")

    async def report_status(self, force: bool = False) -> bool:
        """
        Report current status to backend.

        Args:
            force: If True, bypass rate limiting

        Returns:
            True if status was sent (or queued), False if rate limited
        """
        # Rate limiting check
        now = time.time()
        if not force and (now - self._last_report_time) < self.config.min_report_interval:
            logger.debug("Status report rate limited")
            return False

        # Collect status
        status = self._collect_status()

        # Notify callbacks
        for callback in self._callbacks:
            try:
                callback(status)
            except Exception as e:
                logger.warning(f"Status callback error: {e}")

        # Send via WebSocket
        try:
            sent = await self.websocket.send(
                message_type="status",
                payload=status.to_dict(),
                queue_if_offline=True,
                priority=self.config.status_priority,
            )

            self._last_report_time = now

            if sent:
                logger.debug("Status report sent")
            else:
                logger.debug("Status report queued (offline)")

            return True

        except Exception as e:
            logger.error(f"Failed to send status: {e}")
            return False

    def _collect_status(self) -> DeviceStatus:
        """Collect status from all components."""
        status = DeviceStatus(state="unknown")

        # Calculate uptime
        if self._started_at:
            status.uptime_seconds = time.time() - self._started_at

        # Slideshow state
        if self.slideshow:
            slideshow_status = self.slideshow.get_status()

            # Map state
            state = slideshow_status.get("state", "stopped")
            if state == "playing" or state == "transitioning":
                status.state = "playing"
            elif state == "paused":
                status.state = "paused"
            elif state == "stopped":
                status.state = "stopped"
            elif state == "error":
                status.state = "error"
            else:
                status.state = state

            # Current image
            status.current_image_id = slideshow_status.get("current_image_id")
            status.current_image_path = slideshow_status.get("current_image_path")

            # Stats
            status.images_displayed = slideshow_status.get("images_displayed", 0)
            status.images_skipped = slideshow_status.get("images_skipped", 0)
            status.transitions_completed = slideshow_status.get("transitions_completed", 0)
            status.errors = slideshow_status.get("errors", 0)
            status.runtime_seconds = slideshow_status.get("runtime_seconds", 0.0)

            # Playlist info
            playlist = slideshow_status.get("playlist", {})
            if playlist:
                status.playlist_id = playlist.get("id")
                status.playlist_name = playlist.get("name")
                status.playlist_position = playlist.get("position", 0)
                status.playlist_entry_count = playlist.get("entry_count", 0)

            # Error info
            status.has_error = slideshow_status.get("has_error", False)
            if status.has_error:
                last_error = slideshow_status.get("last_error", {})
                if last_error:
                    status.error_message = last_error.get("message")
                    status.error_code = last_error.get("code")
                    status.error_timestamp = last_error.get("timestamp")
        else:
            status.state = "stopped"

        # Cache statistics
        if self.cache and self.config.include_cache_details:
            try:
                cache_stats = self.cache.get_stats()
                status.cache_entry_count = cache_stats.entry_count
                status.cache_size_mb = cache_stats.total_size_mb
                status.cache_max_size_mb = cache_stats.max_size_mb
                status.cache_hit_rate = cache_stats.hit_rate
            except Exception as e:
                logger.debug(f"Failed to get cache stats: {e}")
        elif self.images and self.config.include_cache_details:
            # Fallback to ImageManager cache stats
            try:
                cache_stats = self.images.get_cache_stats()
                if cache_stats:
                    status.cache_entry_count = cache_stats.get("entry_count", 0)
                    status.cache_size_mb = cache_stats.get("total_size_mb", 0.0)
                    status.cache_max_size_mb = cache_stats.get("max_size_mb", 0.0)
                    status.cache_hit_rate = cache_stats.get("hit_rate", 0.0)
            except Exception as e:
                logger.debug(f"Failed to get image manager cache stats: {e}")

        # Display state
        if self.display:
            status.display_running = self.display.is_running
            status.display_state = self.display.state.value

        # CEC state
        if self.cec_controller:
            status.cec_available = self.cec_controller.available
            # Get cached devices if available
            if hasattr(self.cec_controller, 'cached_devices'):
                status.cec_devices = self.cec_controller.cached_devices or []

        status.timestamp = time.time()
        return status

    def _on_slideshow_state_change(self, old_state, new_state) -> None:
        """Handle slideshow state changes."""
        if not self.config.report_on_state_change:
            return

        logger.debug(f"Slideshow state change: {old_state} -> {new_state}")

        # Schedule immediate status report
        asyncio.create_task(self.report_status())

    async def _report_loop(self) -> None:
        """Background task for periodic status reporting."""
        logger.debug("Status report loop started")

        try:
            while self._state == ReporterState.RUNNING:
                # Wait for interval
                await asyncio.sleep(self.config.report_interval)

                if self._state != ReporterState.RUNNING:
                    break

                # Send periodic status
                await self.report_status()

        except asyncio.CancelledError:
            logger.debug("Status report loop cancelled")
            raise
        except Exception as e:
            logger.error(f"Status report loop error: {e}")
            self._state = ReporterState.ERROR

    def get_last_status(self) -> DeviceStatus:
        """Get the current status without sending."""
        return self._collect_status()

    async def __aenter__(self) -> "StatusReporter":
        """Start reporter on context entry."""
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Stop reporter on context exit."""
        await self.stop()


def create_status_reporter(
    websocket: "WebSocketClient",
    slideshow: Optional["SlideshowOrchestrator"] = None,
    images: Optional["ImageManager"] = None,
    display: Optional["DisplayController"] = None,
    cache: Optional["ImageCache"] = None,
    cec_controller: Optional[Any] = None,
    report_interval: float = 30.0,
    report_on_state_change: bool = True,
) -> StatusReporter:
    """
    Factory function to create a StatusReporter.

    Args:
        websocket: WebSocket client for sending status
        slideshow: Optional SlideshowOrchestrator
        images: Optional ImageManager
        display: Optional DisplayController
        cache: Optional ImageCache
        cec_controller: Optional CECController for CEC capabilities
        report_interval: Interval between periodic reports
        report_on_state_change: Whether to report on state changes

    Returns:
        Configured StatusReporter instance
    """
    config = StatusReporterConfig(
        report_interval=report_interval,
        report_on_state_change=report_on_state_change,
    )
    return StatusReporter(
        websocket=websocket,
        slideshow=slideshow,
        images=images,
        display=display,
        cache=cache,
        cec_controller=cec_controller,
        config=config,
    )
