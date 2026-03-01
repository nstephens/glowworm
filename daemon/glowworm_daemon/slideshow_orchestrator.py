"""
Slideshow Orchestrator - Coordinates slideshow between components.

Manages the slideshow loop by coordinating:
- PlaylistManager for playlist state and navigation
- ImageManager for image downloading and caching
- PreloadManager for background preloading
- DisplayController for sending images to Pi3D display

Provides:
- Image duration timing with configurable intervals
- Transition triggering via IPC to display
- Next/previous command handling
- Pause/resume state management
- Missing image handling (skip with error log)
- Offline operation using cached images
"""
import asyncio
import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .display_controller import DisplayController
    from .image_manager import ImageManager
    from .playlist_manager import PlaylistManager, PlaylistImage
    from .preload_manager import PreloadManager

logger = logging.getLogger(__name__)


class SlideshowState(str, Enum):
    """State of the slideshow orchestrator."""

    STOPPED = "stopped"
    STARTING = "starting"
    PLAYING = "playing"
    PAUSED = "paused"
    TRANSITIONING = "transitioning"
    ERROR = "error"


@dataclass
class SlideshowConfig:
    """Configuration for the slideshow orchestrator."""

    # Default image display duration in seconds
    default_display_time: float = 30.0

    # Transition duration in seconds
    transition_duration: float = 1.0

    # Scale mode for images (fit, fill, stretch)
    scale_mode: str = "fit"

    # Preload count (number of upcoming images to preload)
    preload_count: int = 3

    # Retry delay for failed images before skipping
    image_retry_delay: float = 2.0

    # Maximum retries for loading an image before skipping
    max_image_retries: int = 2

    # Interval for checking playlist updates
    playlist_update_interval: float = 300.0  # 5 minutes


@dataclass
class SlideshowError:
    """Information about a slideshow error."""

    message: str  # User-friendly error message
    code: str = "UNKNOWN"  # Error code for categorization
    details: str | None = None  # Technical details
    timestamp: float = 0.0  # When the error occurred
    recoverable: bool = True  # Whether the system can recover

    def __post_init__(self) -> None:
        if self.timestamp == 0.0:
            self.timestamp = time.time()


@dataclass
class SlideshowStats:
    """Statistics for the slideshow."""

    images_displayed: int = 0
    images_skipped: int = 0
    transitions_completed: int = 0
    errors: int = 0
    total_runtime_seconds: float = 0.0
    started_at: Optional[float] = None
    current_image_id: Optional[int] = None
    current_image_path: Optional[str] = None
    last_error: Optional[SlideshowError] = None


# Type for state change callbacks
StateChangeCallback = Callable[[SlideshowState, SlideshowState], None]


class SlideshowOrchestrator:
    """
    Coordinates slideshow operation between all components.

    Features:
    - Main slideshow loop with configurable image timing
    - Triggers transitions via DisplayController IPC
    - Handles next/previous commands with immediate response
    - Manages pause/resume state
    - Skips missing images with error logging
    - Works offline using cached images
    - Triggers preloading of upcoming images
    - Periodic playlist update checking

    Usage:
        orchestrator = SlideshowOrchestrator(
            display=display_controller,
            playlist=playlist_manager,
            images=image_manager,
            preloader=preload_manager,
            config=SlideshowConfig(),
        )

        # Start slideshow
        await orchestrator.start()

        # Control
        await orchestrator.next()
        await orchestrator.previous()
        await orchestrator.pause()
        await orchestrator.resume()

        # Stop
        await orchestrator.stop()
    """

    def __init__(
        self,
        display: "DisplayController",
        playlist: "PlaylistManager",
        images: "ImageManager",
        preloader: Optional["PreloadManager"] = None,
        config: Optional[SlideshowConfig] = None,
    ) -> None:
        """
        Initialize the slideshow orchestrator.

        Args:
            display: DisplayController for IPC with Pi3D
            playlist: PlaylistManager for playlist state
            images: ImageManager for image downloading
            preloader: Optional PreloadManager for background preloading
            config: Slideshow configuration
        """
        self.display = display
        self.playlist = playlist
        self.images = images
        self.preloader = preloader
        self.config = config or SlideshowConfig()

        self._state = SlideshowState.STOPPED
        self._stats = SlideshowStats()
        self._state_callbacks: List[StateChangeCallback] = []

        # Control tasks
        self._slideshow_task: Optional[asyncio.Task] = None
        self._update_task: Optional[asyncio.Task] = None

        # Timing state
        self._next_transition_time: Optional[float] = None
        self._remaining_time: float = 0.0  # For pause/resume

        # Event for waking up the slideshow loop (next/previous commands)
        self._advance_event: asyncio.Event = asyncio.Event()
        self._direction: int = 1  # 1 = next, -1 = previous

        # Lock for state transitions
        self._lock: asyncio.Lock = asyncio.Lock()

        logger.info(
            f"SlideshowOrchestrator initialized: "
            f"display_time={self.config.default_display_time}s, "
            f"transition={self.config.transition_duration}s"
        )

    @property
    def state(self) -> SlideshowState:
        """Get the current slideshow state."""
        return self._state

    @property
    def is_playing(self) -> bool:
        """Check if slideshow is actively playing."""
        return self._state in (SlideshowState.PLAYING, SlideshowState.TRANSITIONING)

    @property
    def is_paused(self) -> bool:
        """Check if slideshow is paused."""
        return self._state == SlideshowState.PAUSED

    @property
    def stats(self) -> SlideshowStats:
        """Get slideshow statistics."""
        # Update runtime
        if self._stats.started_at and self._state != SlideshowState.STOPPED:
            self._stats.total_runtime_seconds = time.time() - self._stats.started_at
        return self._stats

    def add_state_callback(self, callback: StateChangeCallback) -> None:
        """Add a callback for state changes."""
        self._state_callbacks.append(callback)

    @property
    def last_error(self) -> Optional[SlideshowError]:
        """Get the last error that occurred."""
        return self._stats.last_error

    def _set_state(self, new_state: SlideshowState) -> None:
        """Set the state and notify callbacks."""
        if new_state == self._state:
            return

        old_state = self._state
        self._state = new_state
        logger.info(f"Slideshow state: {old_state.value} -> {new_state.value}")

        for callback in self._state_callbacks:
            try:
                callback(old_state, new_state)
            except Exception as e:
                logger.warning(f"State callback error: {e}")

    async def _report_error(
        self,
        message: str,
        code: str = "SLIDESHOW",
        details: str | None = None,
        recoverable: bool = True,
        show_on_display: bool = False,
    ) -> None:
        """
        Report an error with proper logging and optional display.

        Args:
            message: User-friendly error message
            code: Error code for categorization
            details: Technical details for logging
            recoverable: Whether the system can recover
            show_on_display: If True, show error on Pi3D display
        """
        # Log with full details
        log_msg = f"[{code}] {message}"
        if details:
            log_msg += f" - Details: {details}"
        logger.error(log_msg)

        # Record error in stats
        self._stats.errors += 1
        self._stats.last_error = SlideshowError(
            message=message,
            code=code,
            details=details,
            recoverable=recoverable,
        )

        # Show on display if requested and display is available
        if show_on_display and self.display and self.display.is_running:
            await self.display.show_error(
                message=message,
                code=code,
                details=details,
                recoverable=recoverable,
            )

    async def clear_error_display(self) -> None:
        """Clear error display on Pi3D."""
        if self.display and self.display.is_running:
            await self.display.clear_error()

    async def start(self) -> bool:
        """
        Start the slideshow.

        Returns:
            True if started successfully, False otherwise.
        """
        async with self._lock:
            if self._state != SlideshowState.STOPPED:
                logger.warning("Slideshow already started")
                return True

            self._set_state(SlideshowState.STARTING)

            # Reset stats
            self._stats = SlideshowStats(started_at=time.time())

            # Check we have a playlist
            if not self.playlist.playlist:
                logger.error("No playlist loaded")
                self._set_state(SlideshowState.ERROR)
                return False

            # Check display is running
            if not self.display.is_running:
                logger.error("Display not running")
                self._set_state(SlideshowState.ERROR)
                return False

            # Start slideshow loop
            self._slideshow_task = asyncio.create_task(self._slideshow_loop())

            # Start playlist update checker
            self._update_task = asyncio.create_task(self._playlist_update_loop())

            self._set_state(SlideshowState.PLAYING)
            logger.info("Slideshow started")
            return True

    async def stop(self) -> None:
        """Stop the slideshow."""
        async with self._lock:
            if self._state == SlideshowState.STOPPED:
                return

            self._set_state(SlideshowState.STOPPED)

            # Cancel tasks
            if self._slideshow_task:
                self._slideshow_task.cancel()
                try:
                    await self._slideshow_task
                except asyncio.CancelledError:
                    pass
                self._slideshow_task = None

            if self._update_task:
                self._update_task.cancel()
                try:
                    await self._update_task
                except asyncio.CancelledError:
                    pass
                self._update_task = None

            # Clear display
            await self.display.clear()

            logger.info("Slideshow stopped")

    async def pause(self) -> bool:
        """
        Pause the slideshow.

        Returns:
            True if paused, False if already paused or not running.
        """
        async with self._lock:
            if self._state not in (SlideshowState.PLAYING, SlideshowState.TRANSITIONING):
                return False

            # Calculate remaining time
            if self._next_transition_time:
                self._remaining_time = max(0.0, self._next_transition_time - time.time())
            else:
                self._remaining_time = 0.0

            self._set_state(SlideshowState.PAUSED)

            # Pause display
            await self.display.pause()

            logger.info(f"Slideshow paused, {self._remaining_time:.1f}s remaining")
            return True

    async def resume(self) -> bool:
        """
        Resume the slideshow.

        Returns:
            True if resumed, False if not paused.
        """
        async with self._lock:
            if self._state != SlideshowState.PAUSED:
                return False

            # Set next transition time based on remaining time
            self._next_transition_time = time.time() + self._remaining_time

            self._set_state(SlideshowState.PLAYING)

            # Resume display
            await self.display.resume()

            # Wake up slideshow loop
            self._advance_event.set()

            logger.info("Slideshow resumed")
            return True

    async def next(self) -> bool:
        """
        Advance to the next image immediately.

        Returns:
            True if successful, False otherwise.
        """
        if self._state not in (
            SlideshowState.PLAYING,
            SlideshowState.TRANSITIONING,
            SlideshowState.PAUSED,
        ):
            return False

        async with self._lock:
            # Advance playlist position
            entry, pos = self.playlist.next()
            if not entry:
                logger.warning("No next entry available")
                return False

            logger.info(f"Manual advance to position {pos}")

        # Signal the slideshow loop to advance immediately
        self._direction = 1
        self._advance_event.set()

        # If paused, resume
        if self._state == SlideshowState.PAUSED:
            await self.resume()

        return True

    async def previous(self) -> bool:
        """
        Go to the previous image immediately.

        Returns:
            True if successful, False otherwise.
        """
        if self._state not in (
            SlideshowState.PLAYING,
            SlideshowState.TRANSITIONING,
            SlideshowState.PAUSED,
        ):
            return False

        async with self._lock:
            # Go back in playlist
            entry, pos = self.playlist.previous()
            if not entry:
                logger.warning("No previous entry available")
                return False

            logger.info(f"Manual rewind to position {pos}")

        # Signal the slideshow loop to show current image
        self._direction = -1
        self._advance_event.set()

        # If paused, resume
        if self._state == SlideshowState.PAUSED:
            await self.resume()

        return True

    async def go_to(self, position: int) -> bool:
        """
        Go to a specific position in the playlist.

        Args:
            position: Target position (0-indexed)

        Returns:
            True if successful, False otherwise.
        """
        if self._state not in (
            SlideshowState.PLAYING,
            SlideshowState.TRANSITIONING,
            SlideshowState.PAUSED,
        ):
            return False

        async with self._lock:
            entry, actual_pos = self.playlist.go_to(position)
            if not entry:
                logger.warning(f"Invalid position: {position}")
                return False

            logger.info(f"Go to position {actual_pos}")

        # Signal the slideshow loop to show current image
        self._direction = 0
        self._advance_event.set()

        # If paused, resume
        if self._state == SlideshowState.PAUSED:
            await self.resume()

        return True

    async def reload_playlist(self) -> bool:
        """
        Reload the playlist from backend.

        Returns:
            True if successful, False otherwise.
        """
        try:
            await self.playlist.fetch_playlist()

            # Update preloader with new playlist
            if self.preloader:
                await self.preloader.update_preload_queue(self.playlist)

            logger.info("Playlist reloaded")
            return True

        except Exception as e:
            logger.error(f"Failed to reload playlist: {e}")
            return False

    def clear_cache(self) -> int:
        """
        Clear the image cache.

        Returns:
            Number of cache entries cleared.
        """
        if not self.images:
            logger.warning("Image manager not available")
            return 0

        count = self.images.clear_all_cache()
        logger.info(f"Cache cleared: {count} entries removed")
        return count

    async def _slideshow_loop(self) -> None:
        """Main slideshow loop."""
        logger.debug("Slideshow loop started")

        try:
            while self._state != SlideshowState.STOPPED:
                # Wait if paused
                while self._state == SlideshowState.PAUSED:
                    await asyncio.sleep(0.1)
                    if self._state == SlideshowState.STOPPED:
                        return

                # Get current images
                images = self.playlist.get_current_images()
                if not images:
                    logger.warning("No current images, waiting...")
                    await asyncio.sleep(1.0)
                    continue

                # Display the current image(s)
                success = await self._display_images(images)

                if success:
                    self._stats.images_displayed += 1
                else:
                    self._stats.images_skipped += 1
                    # Skip to next immediately on failure
                    self.playlist.next()
                    continue

                # Update preloader queue after displaying
                if self.preloader:
                    await self.preloader.update_preload_queue(self.playlist)

                # Get display time from playlist or use default
                display_time = self.config.default_display_time
                if self.playlist.playlist:
                    display_time = self.playlist.playlist.display_time_seconds

                # Calculate next transition time
                self._next_transition_time = time.time() + display_time

                # Wait for display time or advance event
                try:
                    remaining = display_time
                    while remaining > 0 and self._state == SlideshowState.PLAYING:
                        # Wait with timeout
                        try:
                            await asyncio.wait_for(
                                self._advance_event.wait(),
                                timeout=min(remaining, 1.0),
                            )
                            # Event was set - break out of wait loop
                            self._advance_event.clear()
                            break
                        except asyncio.TimeoutError:
                            # Update remaining time
                            if self._next_transition_time:
                                remaining = self._next_transition_time - time.time()
                            else:
                                remaining -= 1.0

                except asyncio.CancelledError:
                    raise

                # Check if we were stopped or paused
                if self._state == SlideshowState.STOPPED:
                    return
                if self._state == SlideshowState.PAUSED:
                    continue

                # Advance to next image (unless we already moved due to manual nav)
                # The _direction will be 0 if go_to was called
                if self._direction == 1 or self._direction == 0:
                    # Already advanced or go_to was called, just continue
                    pass
                else:
                    # Regular timed advance
                    self.playlist.next()

                # Reset direction for next iteration
                self._direction = 1

        except asyncio.CancelledError:
            logger.debug("Slideshow loop cancelled")
            raise
        except Exception as e:
            logger.exception(f"Slideshow loop error: {e}")
            self._stats.errors += 1
            self._set_state(SlideshowState.ERROR)

    async def _display_images(self, images: List["PlaylistImage"]) -> bool:
        """
        Display one or more images.

        Handles downloading if needed, and sends to display.

        Args:
            images: List of PlaylistImage objects to display

        Returns:
            True if successful, False if all images failed.
        """
        # Currently only handle single images (pair support can be added later)
        if not images:
            return False

        image = images[0]
        self._stats.current_image_id = image.id

        # Get cached path or download
        image_path = await self._get_image_path(image)

        if not image_path:
            await self._report_error(
                message=f"Image unavailable (ID: {image.id})",
                code="IMAGE_LOAD",
                details=f"Failed to download or locate image {image.id} after retries",
                recoverable=True,
                show_on_display=False,  # Don't show for individual image errors, we'll skip
            )
            return False

        self._stats.current_image_path = str(image_path)

        # Send to display
        self._set_state(SlideshowState.TRANSITIONING)

        success = await self.display.load_image(
            path=str(image_path),
            scale_mode=self.config.scale_mode,
            transition_duration=self.config.transition_duration,
        )

        if success:
            self._stats.transitions_completed += 1
            self._set_state(SlideshowState.PLAYING)
            logger.info(f"Displayed image {image.id}")
            return True
        else:
            await self._report_error(
                message=f"Display error for image {image.id}",
                code="DISPLAY",
                details=f"IPC call to display failed for image at {image_path}",
                recoverable=True,
                show_on_display=False,  # Don't show - might cause loop
            )
            self._set_state(SlideshowState.PLAYING)
            return False

    async def _get_image_path(self, image: "PlaylistImage") -> Optional[Path]:
        """
        Get local path to image, downloading if necessary.

        Args:
            image: PlaylistImage to get path for

        Returns:
            Path to local file, or None if unavailable.
        """
        # Check cache first
        cached_path = self.images.get_cached_path(image.id)
        if cached_path and cached_path.exists():
            logger.debug(f"Image {image.id} found in cache: {cached_path}")
            return cached_path

        # Download with retries
        for attempt in range(self.config.max_image_retries):
            try:
                path, status = await self.images.download_image(image.id)
                if path and path.exists():
                    return path

            except Exception as e:
                logger.warning(
                    f"Download attempt {attempt + 1} failed for image {image.id}: {e}"
                )

                if attempt < self.config.max_image_retries - 1:
                    await asyncio.sleep(self.config.image_retry_delay)

        logger.error(
            f"Failed to download image {image.id} after {self.config.max_image_retries} attempts"
        )
        return None

    async def _playlist_update_loop(self) -> None:
        """Periodically check for playlist updates."""
        logger.debug("Playlist update loop started")

        try:
            while self._state != SlideshowState.STOPPED:
                await asyncio.sleep(self.config.playlist_update_interval)

                if self._state == SlideshowState.STOPPED:
                    return

                try:
                    has_updates = await self.playlist.check_for_updates()
                    if has_updates:
                        logger.info("Playlist updated, reloading...")
                        await self.playlist.fetch_playlist()

                        # Update preloader
                        if self.preloader:
                            await self.preloader.update_preload_queue(self.playlist)

                except Exception as e:
                    logger.warning(f"Error checking playlist updates: {e}")

        except asyncio.CancelledError:
            logger.debug("Playlist update loop cancelled")
            raise

    def get_status(self) -> Dict[str, Any]:
        """Get comprehensive status information."""
        stats = self.stats

        status = {
            "state": self._state.value,
            "is_playing": self.is_playing,
            "is_paused": self.is_paused,
            "has_error": stats.last_error is not None,
            "current_image_id": stats.current_image_id,
            "current_image_path": stats.current_image_path,
            "images_displayed": stats.images_displayed,
            "images_skipped": stats.images_skipped,
            "transitions_completed": stats.transitions_completed,
            "errors": stats.errors,
            "runtime_seconds": stats.total_runtime_seconds,
            "config": {
                "default_display_time": self.config.default_display_time,
                "transition_duration": self.config.transition_duration,
                "scale_mode": self.config.scale_mode,
                "preload_count": self.config.preload_count,
            },
        }

        # Include last error details if available
        if stats.last_error:
            status["last_error"] = {
                "message": stats.last_error.message,
                "code": stats.last_error.code,
                "timestamp": stats.last_error.timestamp,
                "recoverable": stats.last_error.recoverable,
            }

        # Add time until next transition
        if self._next_transition_time and self._state == SlideshowState.PLAYING:
            remaining = max(0.0, self._next_transition_time - time.time())
            status["time_until_next"] = round(remaining, 1)

        # Add playlist info
        if self.playlist.playlist:
            status["playlist"] = {
                "id": self.playlist.playlist.id,
                "name": self.playlist.playlist.name,
                "position": self.playlist.current_position,
                "entry_count": self.playlist.playlist.entry_count,
            }

        return status

    async def __aenter__(self) -> "SlideshowOrchestrator":
        """Start the slideshow on context entry."""
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Stop the slideshow on context exit."""
        await self.stop()


def create_slideshow_orchestrator(
    display: "DisplayController",
    playlist: "PlaylistManager",
    images: "ImageManager",
    preloader: Optional["PreloadManager"] = None,
    default_display_time: float = 30.0,
    transition_duration: float = 1.0,
    scale_mode: str = "fit",
) -> SlideshowOrchestrator:
    """
    Create a slideshow orchestrator with common settings.

    Args:
        display: DisplayController for IPC with Pi3D
        playlist: PlaylistManager for playlist state
        images: ImageManager for image downloading
        preloader: Optional PreloadManager
        default_display_time: Default display time in seconds
        transition_duration: Transition duration in seconds
        scale_mode: Scale mode (fit, fill, stretch)

    Returns:
        SlideshowOrchestrator instance
    """
    config = SlideshowConfig(
        default_display_time=default_display_time,
        transition_duration=transition_duration,
        scale_mode=scale_mode,
    )
    return SlideshowOrchestrator(
        display=display,
        playlist=playlist,
        images=images,
        preloader=preloader,
        config=config,
    )
