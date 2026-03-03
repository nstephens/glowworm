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
- Image pairing for portrait displays (landscape images stacked)
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
    # Using "fill" for stacked images to minimize black bars
    scale_mode: str = "fill"

    # Preload count (number of upcoming images to preload)
    preload_count: int = 3

    # Retry delay for failed images before skipping
    image_retry_delay: float = 2.0

    # Maximum retries for loading an image before skipping
    max_image_retries: int = 2

    # Interval for checking playlist updates
    playlist_update_interval: float = 300.0  # 5 minutes

    # Display orientation for image pairing ('portrait', 'landscape', or 'auto')
    # 'auto' detects from display dimensions
    display_orientation: str = "auto"

    # Stagger delay for paired image transitions (seconds)
    stagger_delay: float = 0.3

    # Transition duration for paired images (longer for visual effect)
    pair_transition_duration: float = 1.5


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

            # Compute image pairing sequence based on display orientation
            await self._compute_pairing()

            # Configure display effects based on playlist settings
            await self._configure_display_mode()

            # Start slideshow loop
            self._slideshow_task = asyncio.create_task(self._slideshow_loop())

            # Start playlist update checker
            self._update_task = asyncio.create_task(self._playlist_update_loop())

            self._set_state(SlideshowState.PLAYING)
            logger.info("Slideshow started")
            return True

    async def _compute_pairing(self) -> None:
        """
        Compute image pairing sequence based on display orientation.

        Fetches display status to get dimensions and determines the
        appropriate pairing strategy.
        """
        # Determine display orientation
        orientation = self.config.display_orientation

        if orientation == "auto":
            # Detect from display dimensions
            status = await self.display.get_status()
            if status:
                # Try to get display dimensions from status
                # The renderer reports these in its status
                width = status.get("display_width", 1920)
                height = status.get("display_height", 1080)

                # Account for rotation - if display is rotated 90/270, swap dimensions
                rotation = status.get("rotation", 0)
                if rotation in (90, 270):
                    width, height = height, width

                from glowworm_daemon.image_pairing import detect_display_orientation
                orientation = detect_display_orientation(width, height)
                logger.info(f"Auto-detected display orientation: {orientation} ({width}x{height})")
            else:
                # Default to portrait if we can't get status
                orientation = "portrait"
                logger.warning("Could not get display status, defaulting to portrait orientation")

        # Compute pairing sequence
        self.playlist.compute_pairing_sequence(orientation)
        logger.info(f"Computed pairing sequence for {orientation} display")

    async def _configure_display_mode(self) -> None:
        """
        Configure display effects based on playlist display_mode setting.

        Maps playlist display modes to renderer effects:
        - ken_burns_plus: Enable Ken Burns zoom/pan effect
        - default: Simple crossfade (no Ken Burns)
        - Other modes: Future implementation
        """
        playlist_data = self.playlist.playlist
        if not playlist_data:
            return

        display_mode = playlist_data.display_mode
        display_time = playlist_data.display_time_seconds or 30

        # Configure Ken Burns based on display mode
        if display_mode == "ken_burns_plus":
            # Enable Ken Burns with playlist's display time
            await self.display.set_ken_burns(
                enabled=True,
                duration=float(display_time),
                min_zoom=1.0,
                max_zoom=1.15,
                max_pan=0.08,
            )
            logger.info(f"Ken Burns enabled: duration={display_time}s")
        else:
            # Disable Ken Burns for other modes
            await self.display.set_ken_burns(enabled=False)
            logger.info(f"Ken Burns disabled (mode={display_mode})")

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

            # Recompute pairing sequence
            await self._compute_pairing()

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
        print("Slideshow loop started", flush=True)
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
                print(f"Current images: {images}", flush=True)
                if not images:
                    print("No current images, waiting...", flush=True)
                    logger.warning("No current images, waiting...")
                    await asyncio.sleep(1.0)
                    continue

                # Check if we're already displaying this exact image
                # (single-image playlist shouldn't keep re-transitioning)
                current_image_id = images[0].id if images else None
                if current_image_id == self._stats.current_image_id and self._stats.images_displayed > 0:
                    # Already displaying this image, just wait for display time
                    print(f"Already displaying image {current_image_id}, skipping reload", flush=True)
                else:
                    # Display the current image(s)
                    print(f"Displaying {len(images)} image(s)...", flush=True)
                    success = await self._display_images(images)
                    print(f"Display result: {success}", flush=True)

                    if not success:
                        self._stats.images_skipped += 1
                        # Skip to next immediately on failure
                        self.playlist.next()
                        continue

                    self._stats.images_displayed += 1

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

                # Advance to next image
                # _direction: 1 = forward (normal timed advance)
                #             0 = go_to was called (don't advance, already positioned)
                #            -1 = previous was called (handled by previous())
                if self._direction != 0:
                    # Regular timed advance - move to next image
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
        For paired images (2 landscape on portrait display), displays
        them stacked with staggered transitions.

        Args:
            images: List of PlaylistImage objects to display

        Returns:
            True if successful, False if all images failed.
        """
        if not images:
            print("_display_images: no images", flush=True)
            return False

        # Check if this is a paired display (2 images)
        if len(images) == 2:
            return await self._display_image_pair(images[0], images[1])

        # Single image display
        image = images[0]
        self._stats.current_image_id = image.id

        # Get cached path or download
        print(f"_display_images: getting path for image {image.id}", flush=True)
        image_path = await self._get_image_path(image)
        print(f"_display_images: image_path = {image_path}", flush=True)

        if not image_path:
            print(f"_display_images: no image path for {image.id}", flush=True)
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

        print(f"_display_images: calling display.load_image({image_path})", flush=True)
        success = await self.display.load_image(
            path=str(image_path),
            scale_mode=self.config.scale_mode,
            transition_duration=self.config.transition_duration,
        )
        print(f"_display_images: load_image returned {success}", flush=True)

        if success:
            self._stats.transitions_completed += 1
            self._set_state(SlideshowState.PLAYING)
            logger.info(f"Displayed image {image.id}")

            # Set image info overlay if enabled in playlist
            await self._update_image_info_overlay(image)

            return True
        else:
            print(f"_display_images: display.load_image failed for {image_path}", flush=True)
            await self._report_error(
                message=f"Display error for image {image.id}",
                code="DISPLAY",
                details=f"IPC call to display failed for image at {image_path}",
                recoverable=True,
                show_on_display=False,  # Don't show - might cause loop
            )
            self._set_state(SlideshowState.PLAYING)
            return False

    async def _update_image_info_overlay(
        self,
        image: "PlaylistImage",
        secondary_image: "PlaylistImage | None" = None,
    ) -> None:
        """
        Update image info overlay if enabled in playlist settings.

        Args:
            image: Primary image (or top image for pairs)
            secondary_image: Bottom image for pairs (optional)
        """
        playlist_data = self.playlist.playlist
        if not playlist_data:
            return

        show_filename = playlist_data.show_image_info
        show_date = playlist_data.show_exif_date

        if not show_filename and not show_date:
            # Clear any existing overlay
            await self.display.clear_image_info()
            return

        # Use original filename if available, otherwise use filename
        display_name = image.original_filename or image.filename

        # For paired images, could show both or just the first
        # Currently showing just the primary image info

        await self.display.set_image_info(
            filename=display_name,
            exif_date=image.exif_date,
            show_filename=show_filename,
            show_date=show_date,
        )

    async def _display_image_pair(
        self,
        top_image: "PlaylistImage",
        bottom_image: "PlaylistImage",
    ) -> bool:
        """
        Display a pair of images stacked (top/bottom).

        Used for portrait displays where two landscape images are
        displayed together with staggered transitions.

        Args:
            top_image: Image for the top half
            bottom_image: Image for the bottom half

        Returns:
            True if successful, False if failed
        """
        self._stats.current_image_id = top_image.id

        # Get paths for both images
        print(f"_display_image_pair: getting paths for images {top_image.id}, {bottom_image.id}", flush=True)
        top_path = await self._get_image_path(top_image)
        bottom_path = await self._get_image_path(bottom_image)

        if not top_path:
            print(f"_display_image_pair: no path for top image {top_image.id}", flush=True)
            await self._report_error(
                message=f"Image unavailable (ID: {top_image.id})",
                code="IMAGE_LOAD",
                details=f"Failed to download or locate image {top_image.id}",
                recoverable=True,
                show_on_display=False,
            )
            return False

        if not bottom_path:
            print(f"_display_image_pair: no path for bottom image {bottom_image.id}", flush=True)
            await self._report_error(
                message=f"Image unavailable (ID: {bottom_image.id})",
                code="IMAGE_LOAD",
                details=f"Failed to download or locate image {bottom_image.id}",
                recoverable=True,
                show_on_display=False,
            )
            return False

        self._stats.current_image_path = f"{top_path}+{bottom_path}"

        # Send to display as pair
        self._set_state(SlideshowState.TRANSITIONING)

        print(f"_display_image_pair: calling display.load_image_pair({top_path}, {bottom_path})", flush=True)
        success = await self.display.load_image_pair(
            top_path=str(top_path),
            bottom_path=str(bottom_path),
            scale_mode=self.config.scale_mode,
            transition_duration=self.config.pair_transition_duration,
            stagger_delay=self.config.stagger_delay,
            top_focus_x=top_image.focus_x,
            top_focus_y=top_image.focus_y,
            bottom_focus_x=bottom_image.focus_x,
            bottom_focus_y=bottom_image.focus_y,
        )
        print(f"_display_image_pair: load_image_pair returned {success}", flush=True)

        if success:
            self._stats.transitions_completed += 1
            self._set_state(SlideshowState.PLAYING)
            logger.info(f"Displayed image pair {top_image.id}, {bottom_image.id}")

            # Set image info overlay if enabled in playlist
            # For pairs, show the top image's info
            await self._update_image_info_overlay(top_image, bottom_image)

            return True
        else:
            print(f"_display_image_pair: display.load_image_pair failed", flush=True)
            await self._report_error(
                message=f"Display error for image pair {top_image.id}, {bottom_image.id}",
                code="DISPLAY",
                details=f"IPC call to display failed for image pair",
                recoverable=True,
                show_on_display=False,
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

                        # Recompute pairing sequence for the new playlist
                        await self._compute_pairing()

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
