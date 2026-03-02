"""
Renderer Main Loop for GlowWorm Display Engine.

Manages image display, transitions, and state machine for the slideshow.

Performance features:
- Integrates with PerformanceMonitor for real-time metrics
- Runs GC during idle periods (between images)
- Tracks frame timing and memory usage
"""

import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import TYPE_CHECKING, Callable

from glowworm_display.display import Display
from glowworm_display.image_loader import ImageLoader, ImageLoadError, ScaleMode
from glowworm_display.performance import PerformanceMonitor, PerformanceConfig
from glowworm_display.text_renderer import TextRenderer
from glowworm_display.transitions import (
    CrossfadeTransition,
    StackedRevealTransition,
    Transition,
    TransitionState,
)

if TYPE_CHECKING:
    import pi3d
    from glowworm_display.image_loader import MockSprite

logger = logging.getLogger(__name__)


class RendererState(str, Enum):
    """State of the renderer."""

    IDLE = "idle"  # No image loaded, showing background
    DISPLAYING = "displaying"  # Showing a static image
    TRANSITIONING = "transitioning"  # Transitioning between images
    PAUSED = "paused"  # Paused, not updating display
    REGISTRATION = "registration"  # Showing registration code
    ERROR = "error"  # Showing error message


@dataclass
class ErrorInfo:
    """Information about a display error."""

    message: str  # User-friendly error message
    code: str = "UNKNOWN"  # Error code for categorization
    details: str | None = None  # Technical details (for logging)
    timestamp: float = 0.0  # When the error occurred
    recoverable: bool = True  # Whether the system can recover

    def __post_init__(self) -> None:
        if self.timestamp == 0.0:
            self.timestamp = time.time()


@dataclass
class RenderStats:
    """Statistics about rendering performance."""

    frame_count: int = 0
    total_render_time: float = 0.0
    last_frame_time: float = 0.0
    min_frame_time: float = float("inf")
    max_frame_time: float = 0.0
    transition_count: int = 0
    images_displayed: int = 0
    errors_count: int = 0

    @property
    def avg_frame_time(self) -> float:
        """Average frame render time in seconds."""
        if self.frame_count == 0:
            return 0.0
        return self.total_render_time / self.frame_count

    @property
    def avg_fps(self) -> float:
        """Average frames per second."""
        if self.avg_frame_time == 0:
            return 0.0
        return 1.0 / self.avg_frame_time


@dataclass
class QueuedImage:
    """An image queued for display."""

    path: str
    scale_mode: ScaleMode = ScaleMode.FIT
    transition_duration: float = 1.0


@dataclass
class QueuedImagePair:
    """A pair of images queued for stacked display."""

    top_path: str
    bottom_path: str
    scale_mode: ScaleMode = ScaleMode.FIT
    transition_duration: float = 1.5
    stagger_delay: float = 0.3


# Callback types
StateChangeCallback = Callable[[RendererState, RendererState], None]


class Renderer:
    """
    Main renderer for the GlowWorm display engine.

    Manages the render loop, image display, transitions, and state machine.
    Receives commands to load images and handles the display lifecycle.

    Attributes:
        display: The Pi3D display instance
        image_loader: Image loader for creating sprites
        state: Current renderer state
        stats: Rendering statistics
    """

    def __init__(
        self,
        display: Display,
        image_loader: ImageLoader,
        default_transition_duration: float = 1.0,
        on_state_change: StateChangeCallback | None = None,
        mock: bool = False,
        enable_performance_monitoring: bool = True,
        performance_log_interval: float = 60.0,
    ) -> None:
        """
        Initialize the renderer.

        Args:
            display: Initialized Pi3D display
            image_loader: Image loader for creating sprites
            default_transition_duration: Default transition duration in seconds
            on_state_change: Optional callback when state changes
            mock: If True, use mock rendering for development
            enable_performance_monitoring: If True, track performance metrics
            performance_log_interval: How often to log performance (seconds)
        """
        self.display = display
        self.image_loader = image_loader
        self.default_transition_duration = default_transition_duration
        self.on_state_change = on_state_change
        self.mock = mock

        # State management
        self._state = RendererState.IDLE
        self._paused_state: RendererState | None = None  # State before pause

        # Current and queued images (single image mode)
        self._current_sprite: "MockSprite | pi3d.Sprite | None" = None
        self._next_sprite: "MockSprite | pi3d.Sprite | None" = None
        self._image_queue: list[QueuedImage] = []

        # Stacked image mode (paired images)
        self._stacked_mode: bool = False
        self._current_top_sprite: "MockSprite | pi3d.Sprite | None" = None
        self._current_bottom_sprite: "MockSprite | pi3d.Sprite | None" = None
        self._next_top_sprite: "MockSprite | pi3d.Sprite | None" = None
        self._next_bottom_sprite: "MockSprite | pi3d.Sprite | None" = None
        self._pair_queue: list[QueuedImagePair] = []

        # Current transition (if any)
        self._transition: Transition | None = None

        # Text renderer for registration display and error messages
        self._text_renderer = TextRenderer(
            display_width=display.width,
            display_height=display.height,
            mock=mock,
        )

        # Error state
        self._current_error: ErrorInfo | None = None
        self._previous_state: RendererState | None = None  # State before error

        # Statistics
        self.stats = RenderStats()

        # Running flag
        self._running = False

        # Performance monitoring
        self._perf_monitor: PerformanceMonitor | None = None
        if enable_performance_monitoring:
            perf_config = PerformanceConfig(
                target_fps=display.fps_target if hasattr(display, 'fps_target') else 30,
                log_interval_seconds=performance_log_interval,
            )
            self._perf_monitor = PerformanceMonitor(
                perf_config,
                on_alert=self._on_performance_alert,
            )

        # Track last image display time for GC scheduling
        self._last_image_change: float = 0.0
        self._gc_scheduled: bool = False

        logger.info("Renderer initialized")

    def _on_performance_alert(self, alert_type: str, data: dict) -> None:
        """Handle performance alerts from the monitor."""
        if alert_type == "low_fps":
            logger.warning(
                f"Performance alert: Low FPS ({data['fps']:.1f} < {data['threshold']})"
            )
        elif alert_type == "slow_frame":
            logger.warning(
                f"Performance alert: Slow frame ({data['time_ms']:.1f}ms > {data['threshold']}ms)"
            )

    @property
    def state(self) -> RendererState:
        """Get current renderer state."""
        return self._state

    @property
    def is_running(self) -> bool:
        """Check if render loop is running."""
        return self._running

    @property
    def is_paused(self) -> bool:
        """Check if renderer is paused."""
        return self._state == RendererState.PAUSED

    @property
    def current_image_path(self) -> str | None:
        """Get path of currently displayed image, if any."""
        if self._current_sprite and hasattr(self._current_sprite, "texture"):
            texture = self._current_sprite.texture
            if hasattr(texture, "file_path"):
                return texture.file_path
        return None

    @property
    def queue_length(self) -> int:
        """Get number of images in the queue."""
        return len(self._image_queue)

    @property
    def current_error(self) -> ErrorInfo | None:
        """Get current error info, if in error state."""
        return self._current_error

    @property
    def has_error(self) -> bool:
        """Check if renderer is in error state."""
        return self._state == RendererState.ERROR

    def _set_state(self, new_state: RendererState) -> None:
        """
        Set renderer state and invoke callback.

        Args:
            new_state: The new state to set
        """
        if new_state == self._state:
            return

        old_state = self._state
        self._state = new_state
        logger.debug(f"State changed: {old_state.value} -> {new_state.value}")

        if self.on_state_change:
            try:
                self.on_state_change(old_state, new_state)
            except Exception as e:
                logger.warning(f"State change callback error: {e}")

    def queue_image(
        self,
        path: str,
        scale_mode: ScaleMode = ScaleMode.FIT,
        transition_duration: float | None = None,
    ) -> None:
        """
        Add an image to the display queue.

        The image will be displayed after any currently queued images.

        Args:
            path: Path to the image file
            scale_mode: How to scale the image
            transition_duration: Override default transition duration
        """
        duration = (
            transition_duration
            if transition_duration is not None
            else self.default_transition_duration
        )

        queued = QueuedImage(
            path=path,
            scale_mode=scale_mode,
            transition_duration=duration,
        )
        self._image_queue.append(queued)
        logger.info(f"Image queued: {path} (queue length: {len(self._image_queue)})")

    def queue_image_pair(
        self,
        top_path: str,
        bottom_path: str,
        scale_mode: ScaleMode = ScaleMode.FIT,
        transition_duration: float | None = None,
        stagger_delay: float = 0.3,
    ) -> None:
        """
        Add a pair of images for stacked display.

        On portrait displays, two landscape images are displayed stacked
        (top/bottom) with a staggered reveal transition.

        Args:
            top_path: Path to the top image file
            bottom_path: Path to the bottom image file
            scale_mode: How to scale the images
            transition_duration: Override default transition duration
            stagger_delay: Delay between top and bottom image transitions
        """
        duration = (
            transition_duration
            if transition_duration is not None
            else 1.5  # Default longer for stacked transitions
        )

        queued = QueuedImagePair(
            top_path=top_path,
            bottom_path=bottom_path,
            scale_mode=scale_mode,
            transition_duration=duration,
            stagger_delay=stagger_delay,
        )
        self._pair_queue.append(queued)
        logger.info(
            f"Image pair queued: {top_path}, {bottom_path} "
            f"(pair queue length: {len(self._pair_queue)})"
        )

    def load_image_immediate(
        self,
        path: str,
        scale_mode: ScaleMode = ScaleMode.FIT,
        transition_duration: float | None = None,
    ) -> bool:
        """
        Load an image immediately, interrupting any current transition.

        Clears the queue and starts transitioning to the new image.

        Args:
            path: Path to the image file
            scale_mode: How to scale the image
            transition_duration: Override default transition duration

        Returns:
            True if image load started, False if failed
        """
        duration = (
            transition_duration
            if transition_duration is not None
            else self.default_transition_duration
        )

        # Clear queues and cancel any in-progress transition
        self._image_queue.clear()
        self._pair_queue.clear()
        if self._transition and self._transition.is_running:
            self._transition.cancel()
            logger.debug("Cancelled in-progress transition")

        # Exit stacked mode if active
        self._stacked_mode = False
        self._current_top_sprite = None
        self._current_bottom_sprite = None
        self._next_top_sprite = None
        self._next_bottom_sprite = None

        # Load the new image
        try:
            self._next_sprite = self.image_loader.load_image(path, scale_mode)
        except ImageLoadError as e:
            logger.error(f"Failed to load image: {e}")
            return False

        # Start transition
        self._start_transition(duration)
        return True

    def load_image_pair_immediate(
        self,
        top_path: str,
        bottom_path: str,
        scale_mode: ScaleMode = ScaleMode.FIT,
        transition_duration: float | None = None,
        stagger_delay: float = 0.3,
        top_focus: tuple[float, float] = (0.5, 0.5),
        bottom_focus: tuple[float, float] = (0.5, 0.5),
    ) -> bool:
        """
        Load a pair of images immediately for stacked display.

        Clears the queue and starts the stacked reveal transition.

        Args:
            top_path: Path to the top image file
            bottom_path: Path to the bottom image file
            scale_mode: How to scale the images
            transition_duration: Override default transition duration
            stagger_delay: Delay between top and bottom image transitions
            top_focus: Focus point (x, y) for top image cropping (0.0-1.0)
            bottom_focus: Focus point (x, y) for bottom image cropping (0.0-1.0)

        Returns:
            True if images loaded successfully, False if failed
        """
        duration = transition_duration if transition_duration is not None else 1.5

        # Clear queues and cancel any in-progress transition
        self._image_queue.clear()
        self._pair_queue.clear()
        if self._transition and self._transition.is_running:
            self._transition.cancel()
            logger.debug("Cancelled in-progress transition")

        # Load the new images
        try:
            self._next_top_sprite = self.image_loader.load_stacked_image(
                top_path, position='top', scale_mode=scale_mode,
                focus_point=top_focus
            )
            self._next_bottom_sprite = self.image_loader.load_stacked_image(
                bottom_path, position='bottom', scale_mode=scale_mode,
                focus_point=bottom_focus
            )
        except ImageLoadError as e:
            logger.error(f"Failed to load image pair: {e}")
            return False

        # Enter stacked mode
        self._stacked_mode = True

        # Clear single image mode sprites
        self._current_sprite = None
        self._next_sprite = None

        # Start stacked transition
        self._start_stacked_transition(duration, stagger_delay)
        return True

    def _start_transition(self, duration: float) -> None:
        """Start a transition to the next sprite."""
        if self._next_sprite is None:
            logger.warning("No next sprite to transition to")
            return

        self._transition = CrossfadeTransition(duration=duration)
        self._transition.start()
        self._set_state(RendererState.TRANSITIONING)
        self.stats.transition_count += 1
        logger.debug(f"Started transition: duration={duration}s")

    def _start_stacked_transition(
        self, duration: float, stagger_delay: float = 0.3
    ) -> None:
        """Start a stacked reveal transition for paired images."""
        if self._next_top_sprite is None and self._next_bottom_sprite is None:
            logger.warning("No next sprites to transition to")
            return

        self._transition = StackedRevealTransition(
            duration=duration,
            stagger_delay=stagger_delay,
            top_duration=1.2,
            bottom_duration=1.5,
            use_slide=False,  # Disabled for rotated displays - slide offsets are wrong
        )
        self._transition.start()
        self._set_state(RendererState.TRANSITIONING)
        self.stats.transition_count += 1
        logger.debug(
            f"Started stacked transition: duration={duration}s, "
            f"stagger={stagger_delay}s"
        )

    def _process_queue(self) -> None:
        """Process the next image in the queue if ready."""
        if self._state == RendererState.TRANSITIONING:
            # Already transitioning, wait
            return

        if self._state == RendererState.PAUSED:
            # Paused, don't process queue
            return

        # Check pair queue first (stacked images take priority)
        if self._pair_queue:
            self._process_pair_queue()
            return

        if not self._image_queue:
            return

        # Exit stacked mode when processing single images
        if self._stacked_mode:
            self._stacked_mode = False
            self._current_top_sprite = None
            self._current_bottom_sprite = None
            self._next_top_sprite = None
            self._next_bottom_sprite = None

        # Get next queued image
        queued = self._image_queue.pop(0)
        logger.debug(f"Processing queued image: {queued.path}")

        # Load the image
        try:
            self._next_sprite = self.image_loader.load_image(
                queued.path, queued.scale_mode
            )
        except ImageLoadError as e:
            logger.error(f"Failed to load queued image: {e}")
            # Try next in queue
            self._process_queue()
            return

        # Start transition
        self._start_transition(queued.transition_duration)

    def _process_pair_queue(self) -> None:
        """Process the next image pair in the pair queue."""
        if not self._pair_queue:
            return

        queued = self._pair_queue.pop(0)
        logger.debug(
            f"Processing queued image pair: {queued.top_path}, {queued.bottom_path}"
        )

        # Load the images
        try:
            self._next_top_sprite = self.image_loader.load_stacked_image(
                queued.top_path, position='top', scale_mode=queued.scale_mode
            )
            self._next_bottom_sprite = self.image_loader.load_stacked_image(
                queued.bottom_path, position='bottom', scale_mode=queued.scale_mode
            )
        except ImageLoadError as e:
            logger.error(f"Failed to load queued image pair: {e}")
            # Try next in queue
            self._process_queue()
            return

        # Enter stacked mode
        self._stacked_mode = True

        # Clear single image mode sprites
        self._current_sprite = None
        self._next_sprite = None

        # Start stacked transition
        self._start_stacked_transition(
            queued.transition_duration, queued.stagger_delay
        )

    def _update_transition(self) -> None:
        """Update the current transition state."""
        if self._transition is None:
            return

        progress = self._transition.update()

        if self._transition.state == TransitionState.COMPLETED:
            if self._stacked_mode:
                # Stacked transition complete - swap both sprites
                self._current_top_sprite = self._next_top_sprite
                self._current_bottom_sprite = self._next_bottom_sprite
                self._next_top_sprite = None
                self._next_bottom_sprite = None
                self._transition = None
                self._set_state(RendererState.DISPLAYING)
                self.stats.images_displayed += 2  # Count both images

                logger.debug("Stacked transition complete, now displaying paired images")
            else:
                # Single image transition complete - swap sprites
                self._current_sprite = self._next_sprite
                self._next_sprite = None
                self._transition = None
                self._set_state(RendererState.DISPLAYING)
                self.stats.images_displayed += 1

                logger.debug("Transition complete, now displaying new image")

            # Track image change time and schedule GC
            self._last_image_change = time.time()
            self._gc_scheduled = True

        elif self._transition.state == TransitionState.CANCELLED:
            if self._stacked_mode:
                # Stacked transition cancelled - keep current sprites
                self._next_top_sprite = None
                self._next_bottom_sprite = None
                self._transition = None
                if self._current_top_sprite or self._current_bottom_sprite:
                    self._set_state(RendererState.DISPLAYING)
                else:
                    self._set_state(RendererState.IDLE)
            else:
                # Single transition cancelled - keep current sprite
                self._next_sprite = None
                self._transition = None
                if self._current_sprite:
                    self._set_state(RendererState.DISPLAYING)
                else:
                    self._set_state(RendererState.IDLE)
            logger.debug("Transition cancelled")

    def _render_frame(self) -> None:
        """Render a single frame."""
        if self._state == RendererState.IDLE:
            # Nothing to draw, just background
            pass

        elif self._state == RendererState.DISPLAYING:
            if self._stacked_mode:
                # Draw both stacked images
                if self._current_top_sprite:
                    self._current_top_sprite.set_alpha(1.0)
                    self._current_top_sprite.draw()
                if self._current_bottom_sprite:
                    self._current_bottom_sprite.set_alpha(1.0)
                    self._current_bottom_sprite.draw()
            else:
                # Draw current image (alpha should already be 1.0 from transition completion)
                if self._current_sprite:
                    self._current_sprite.draw()

        elif self._state == RendererState.TRANSITIONING:
            # Render transition
            if self._transition:
                if self._stacked_mode and isinstance(self._transition, StackedRevealTransition):
                    # Render stacked transition with staggered timing
                    self._transition.render_stacked(
                        self._current_top_sprite,
                        self._current_bottom_sprite,
                        self._next_top_sprite,
                        self._next_bottom_sprite,
                        self.display.height,
                    )
                else:
                    # Render single image transition
                    self._transition.render(self._current_sprite, self._next_sprite)

        elif self._state == RendererState.PAUSED:
            if self._stacked_mode:
                # Draw both stacked images (frozen)
                if self._current_top_sprite:
                    self._current_top_sprite.set_alpha(1.0)
                    self._current_top_sprite.draw()
                if self._current_bottom_sprite:
                    self._current_bottom_sprite.set_alpha(1.0)
                    self._current_bottom_sprite.draw()
            else:
                # Draw current image (frozen)
                if self._current_sprite:
                    self._current_sprite.set_alpha(1.0)
                    self._current_sprite.draw()

        elif self._state == RendererState.REGISTRATION:
            # Draw registration display with animation
            self._text_renderer.render_registration()

        elif self._state == RendererState.ERROR:
            # Draw error message
            self._text_renderer.render_error()

    def pause(self) -> None:
        """
        Pause the renderer.

        Stops processing queue and freezes display on current image.
        """
        if self._state == RendererState.PAUSED:
            logger.debug("Already paused")
            return

        self._paused_state = self._state
        self._set_state(RendererState.PAUSED)
        logger.info("Renderer paused")

    def resume(self) -> None:
        """
        Resume the renderer from paused state.

        Continues from where it was paused. If we were transitioning,
        the transition continues from where it left off.
        """
        if self._state != RendererState.PAUSED:
            logger.debug("Not paused, nothing to resume")
            return

        # Restore previous state
        restored_state = self._paused_state or RendererState.IDLE
        self._paused_state = None

        # If we were transitioning and still have a transition, keep transitioning
        if restored_state == RendererState.TRANSITIONING:
            if self._transition and self._transition.is_running:
                # Transition is still valid, continue it
                pass
            elif self._current_sprite:
                restored_state = RendererState.DISPLAYING
            else:
                restored_state = RendererState.IDLE

        self._set_state(restored_state)
        logger.info(f"Renderer resumed: {restored_state.value}")

    def clear(self) -> None:
        """
        Clear the current display.

        Removes current image and clears queue.
        """
        self._image_queue.clear()
        self._pair_queue.clear()
        self._current_sprite = None
        self._next_sprite = None

        # Clear stacked mode
        self._stacked_mode = False
        self._current_top_sprite = None
        self._current_bottom_sprite = None
        self._next_top_sprite = None
        self._next_bottom_sprite = None

        if self._transition:
            self._transition.cancel()
            self._transition = None

        # Clear registration display if active
        self._text_renderer.clear_registration()

        self._set_state(RendererState.IDLE)
        logger.info("Renderer cleared")

    def show_registration(self, code: str) -> None:
        """
        Display a registration code on screen.

        Shows the registration code large and centered with a
        waiting animation. Clears any current image display.

        Args:
            code: The registration code to display (typically 4 characters)
        """
        # Clear current display state
        self._image_queue.clear()
        self._current_sprite = None
        self._next_sprite = None

        if self._transition:
            self._transition.cancel()
            self._transition = None

        # Set the registration code
        self._text_renderer.set_registration_code(code)
        self._set_state(RendererState.REGISTRATION)
        logger.info(f"Showing registration code: {code}")

    def hide_registration(self) -> None:
        """
        Hide the registration display.

        Returns to idle state. Use load_image_immediate or queue_image
        to start displaying images.
        """
        self._text_renderer.clear_registration()
        self._set_state(RendererState.IDLE)
        logger.info("Registration display hidden")

    def show_error(
        self,
        message: str,
        code: str = "UNKNOWN",
        details: str | None = None,
        recoverable: bool = True,
    ) -> None:
        """
        Display an error message on screen.

        Shows a user-friendly error message. The error will remain
        displayed until clear_error() is called or a new image is loaded.

        Args:
            message: User-friendly error message
            code: Error code for categorization (e.g., "NETWORK", "IMAGE_LOAD")
            details: Technical details for logging (not shown to user)
            recoverable: Whether the system can recover from this error
        """
        # Log the error with full details
        log_msg = f"Display error [{code}]: {message}"
        if details:
            log_msg += f" - {details}"
        logger.error(log_msg)

        # Store error info
        self._current_error = ErrorInfo(
            message=message,
            code=code,
            details=details,
            recoverable=recoverable,
        )
        self.stats.errors_count += 1

        # Save previous state for recovery
        if self._state != RendererState.ERROR:
            self._previous_state = self._state

        # Show error on text renderer
        self._text_renderer.set_error_message(message, code)
        self._set_state(RendererState.ERROR)

    def clear_error(self) -> None:
        """
        Clear the error display and return to previous state.

        If there was a recoverable error, attempts to return to
        the state before the error occurred.
        """
        self._text_renderer.clear_error()
        self._current_error = None

        # Return to previous state if available
        if self._previous_state:
            self._set_state(self._previous_state)
            self._previous_state = None
        else:
            self._set_state(RendererState.IDLE)

        logger.info("Error display cleared")

    @property
    def is_showing_registration(self) -> bool:
        """Check if currently showing registration code."""
        return self._state == RendererState.REGISTRATION

    @property
    def registration_code(self) -> str | None:
        """Get the current registration code, if any."""
        return self._text_renderer.current_code

    def run_once(self) -> bool:
        """
        Run a single iteration of the render loop.

        This is the main entry point for the render loop.
        Should be called repeatedly in the main loop.

        Returns:
            True if rendering should continue, False if display stopped
        """
        if not self.display.is_running:
            return False

        frame_start = time.time()

        # Performance monitoring - frame start
        if self._perf_monitor:
            self._perf_monitor.frame_start()

        # Update transition if active
        if self._state == RendererState.TRANSITIONING:
            self._update_transition()

        # Process queue if idle or displaying
        if self._state in (RendererState.IDLE, RendererState.DISPLAYING):
            self._process_queue()

            # Schedule GC during idle periods (between image changes)
            self._maybe_run_gc()

        # Render frame
        with self.display.frame():
            self._render_frame()

        # Update statistics
        frame_time = time.time() - frame_start
        self.stats.frame_count += 1
        self.stats.total_render_time += frame_time
        self.stats.last_frame_time = frame_time
        self.stats.min_frame_time = min(self.stats.min_frame_time, frame_time)
        self.stats.max_frame_time = max(self.stats.max_frame_time, frame_time)

        # Performance monitoring - frame end
        if self._perf_monitor:
            self._perf_monitor.frame_end()

        return True

    def _maybe_run_gc(self) -> None:
        """
        Run garbage collection during idle periods.

        Schedules GC to run after a transition completes and the
        display is stable, to avoid GC pauses during animations.
        """
        if not self._gc_scheduled:
            return

        # Only run GC if we've been displaying for a bit (after transition)
        time_since_change = time.time() - self._last_image_change
        if time_since_change > 0.5 and self._state == RendererState.DISPLAYING:
            if self._perf_monitor:
                self._perf_monitor.run_gc()
            self._gc_scheduled = False
            logger.debug("Ran scheduled GC after transition")

    def run(self) -> None:
        """
        Run the main render loop.

        Blocks until display is stopped or stop() is called.
        """
        logger.info("Starting render loop")
        self._running = True

        # Start performance monitoring
        if self._perf_monitor:
            self._perf_monitor.start()

        try:
            while self._running and self.display.is_running:
                if not self.run_once():
                    break
        except KeyboardInterrupt:
            logger.info("Render loop interrupted")
        finally:
            self._running = False

            # Stop performance monitoring
            if self._perf_monitor:
                self._perf_monitor.stop()

            logger.info(
                f"Render loop ended: {self.stats.frame_count} frames, "
                f"{self.stats.avg_fps:.1f} avg FPS"
            )

    def stop(self) -> None:
        """Stop the render loop."""
        self._running = False
        logger.info("Renderer stop requested")

    def get_status(self) -> dict:
        """
        Get current renderer status.

        Returns:
            Dict with current state and statistics
        """
        # Get display dimensions
        display_width = self.display.width if self.display else 0
        display_height = self.display.height if self.display else 0

        # Get rotation from image loader (config setting)
        rotation = self.image_loader.rotation.value if self.image_loader else 0

        status = {
            "state": self._state.value,
            "is_running": self._running,
            "is_paused": self.is_paused,
            "is_registration": self.is_showing_registration,
            "registration_code": self.registration_code,
            "has_error": self.has_error,
            "current_image": self.current_image_path,
            "queue_length": self.queue_length,
            "pair_queue_length": len(self._pair_queue),
            "stacked_mode": self._stacked_mode,
            "display_width": display_width,
            "display_height": display_height,
            "rotation": rotation,
            "stats": {
                "frame_count": self.stats.frame_count,
                "avg_fps": round(self.stats.avg_fps, 1),
                "images_displayed": self.stats.images_displayed,
                "transition_count": self.stats.transition_count,
                "errors_count": self.stats.errors_count,
            },
        }

        # Include error details if in error state
        if self._current_error:
            status["error"] = {
                "message": self._current_error.message,
                "code": self._current_error.code,
                "timestamp": self._current_error.timestamp,
                "recoverable": self._current_error.recoverable,
            }

        # Include performance metrics if monitoring is enabled
        if self._perf_monitor:
            perf_metrics = self._perf_monitor.get_metrics()
            status["performance"] = perf_metrics.to_dict()

        # Include texture pool stats if available
        if hasattr(self.image_loader, 'get_pool_stats'):
            status["texture_pool"] = self.image_loader.get_pool_stats()

        return status

    def get_performance_metrics(self) -> dict | None:
        """
        Get detailed performance metrics.

        Returns:
            Performance metrics dict, or None if monitoring disabled
        """
        if self._perf_monitor:
            return self._perf_monitor.get_metrics().to_dict()
        return None
