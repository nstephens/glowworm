"""
Stacked Reveal Transition for GlowWorm Display Engine.

Implements a staggered transition for paired images on portrait display,
where two landscape images are displayed stacked (top/bottom) with
slightly different timing for visual interest.
"""

import logging
import time
from typing import TYPE_CHECKING, List, Tuple

from glowworm_display.transitions.base import (
    ProgressCallback,
    Transition,
    TransitionProgress,
    TransitionState,
    ease_in_out_cubic,
)

if TYPE_CHECKING:
    import pi3d
    from glowworm_display.image_loader import MockSprite

logger = logging.getLogger(__name__)


class StackedRevealTransition(Transition):
    """
    Stacked reveal transition for paired images.

    Animates two images (top and bottom) with staggered timing:
    - Top image: starts immediately, shorter duration (1.2s)
    - Bottom image: starts after delay (300ms), longer duration (1.5s)

    This creates visual interest by having the images not appear at
    exactly the same time.

    The transition combines crossfade (alpha) with a subtle slide animation
    similar to the frontend StackedReveal effect.

    Attributes:
        duration: Base duration for the transition
        stagger_delay: Delay before bottom image starts (in seconds)
        top_duration: Duration for top image animation
        bottom_duration: Duration for bottom image animation
        use_slide: Whether to include slide-in animation
    """

    def __init__(
        self,
        duration: float = 1.5,
        stagger_delay: float = 0.3,
        top_duration: float = 1.2,
        bottom_duration: float = 1.5,
        use_slide: bool = True,
        on_progress: ProgressCallback | None = None,
    ) -> None:
        """
        Initialize the stacked reveal transition.

        Args:
            duration: Overall transition duration (used for completion tracking)
            stagger_delay: Delay before bottom image starts (seconds)
            top_duration: Duration for top image animation
            bottom_duration: Duration for bottom image animation
            use_slide: If True, include slide-in effect along with fade
            on_progress: Optional callback for progress updates
        """
        # Total duration is delay + bottom duration
        total_duration = stagger_delay + bottom_duration
        super().__init__(duration=total_duration, on_progress=on_progress)

        self.stagger_delay = stagger_delay
        self.top_duration = top_duration
        self.bottom_duration = bottom_duration
        self.use_slide = use_slide

        # Slide offset percentage (10% of image dimension)
        self.slide_offset = 0.10

        logger.debug(
            f"StackedRevealTransition created: "
            f"top={top_duration}s, bottom={bottom_duration}s, "
            f"stagger={stagger_delay}s, slide={use_slide}"
        )

    def _calculate_layer_progress(
        self,
        elapsed: float,
        layer: str
    ) -> Tuple[float, float]:
        """
        Calculate progress for a specific layer.

        Args:
            elapsed: Time elapsed since transition start
            layer: 'top' or 'bottom'

        Returns:
            Tuple of (alpha_progress, slide_progress) both 0.0-1.0
        """
        if layer == 'top':
            # Top starts immediately
            layer_elapsed = elapsed
            layer_duration = self.top_duration
        else:
            # Bottom starts after stagger delay
            layer_elapsed = max(0.0, elapsed - self.stagger_delay)
            layer_duration = self.bottom_duration

        if layer_duration <= 0:
            return 1.0, 1.0

        # Calculate raw progress
        raw_progress = min(1.0, layer_elapsed / layer_duration)

        # Apply easing
        eased = ease_in_out_cubic(raw_progress)

        return eased, eased

    def render(
        self,
        current_sprite: "MockSprite | pi3d.Sprite | None",
        next_sprite: "MockSprite | pi3d.Sprite | None",
    ) -> None:
        """
        Render a single image transition.

        For single images (not paired), this behaves like a normal crossfade.

        Args:
            current_sprite: The outgoing image sprite (may be None)
            next_sprite: The incoming image sprite (may be None)
        """
        # For single image, use standard crossfade behavior
        progress_info = self.update()
        progress = progress_info.progress

        current_alpha = 1.0 - progress
        next_alpha = progress

        if current_sprite is not None:
            current_sprite.set_alpha(current_alpha)
            curr_x = current_sprite.x() if callable(current_sprite.x) else current_sprite.x
            curr_y = current_sprite.y() if callable(current_sprite.y) else current_sprite.y
            current_sprite.position(curr_x, curr_y, 2.0)
            current_sprite.draw()

        if next_sprite is not None:
            next_sprite.set_alpha(next_alpha)
            next_x = next_sprite.x() if callable(next_sprite.x) else next_sprite.x
            next_y = next_sprite.y() if callable(next_sprite.y) else next_sprite.y
            next_sprite.position(next_x, next_y, 1.0)
            next_sprite.draw()

    def render_stacked(
        self,
        current_top: "MockSprite | pi3d.Sprite | None",
        current_bottom: "MockSprite | pi3d.Sprite | None",
        next_top: "MockSprite | pi3d.Sprite | None",
        next_bottom: "MockSprite | pi3d.Sprite | None",
        display_height: int,
    ) -> None:
        """
        Render stacked image transition with staggered timing.

        Handles the transition from one set of stacked images to another,
        with the top and bottom layers animating with different timing.

        Args:
            current_top: Current top image sprite (may be None)
            current_bottom: Current bottom image sprite (may be None)
            next_top: Next top image sprite (may be None)
            next_bottom: Next bottom image sprite (may be None)
            display_height: Full display height for calculating offsets
        """
        if self._start_time is None:
            raise RuntimeError("Transition not started. Call start() first.")

        elapsed = time.time() - self._start_time

        # Update internal state
        self.update()

        # Calculate progress for each layer
        top_alpha, top_slide = self._calculate_layer_progress(elapsed, 'top')
        bottom_alpha, bottom_slide = self._calculate_layer_progress(elapsed, 'bottom')

        # Calculate slide offsets if enabled
        # Top slides from upper-left (-x, +y offset)
        # Bottom slides from lower-right (+x, -y offset)
        half_height = display_height / 4  # Quarter of screen for offset base

        if self.use_slide:
            top_x_offset = -half_height * self.slide_offset * (1.0 - top_slide)
            top_y_offset = half_height * self.slide_offset * (1.0 - top_slide)
            bottom_x_offset = half_height * self.slide_offset * (1.0 - bottom_slide)
            bottom_y_offset = -half_height * self.slide_offset * (1.0 - bottom_slide)
        else:
            top_x_offset = 0.0
            top_y_offset = 0.0
            bottom_x_offset = 0.0
            bottom_y_offset = 0.0

        # Draw outgoing images (fading out)
        if current_top is not None:
            current_top.set_alpha(1.0 - top_alpha)
            curr_top_x = current_top.x() if callable(current_top.x) else current_top.x
            curr_top_y = current_top.y() if callable(current_top.y) else current_top.y
            current_top.position(curr_top_x, curr_top_y, 4.0)
            current_top.draw()

        if current_bottom is not None:
            current_bottom.set_alpha(1.0 - bottom_alpha)
            curr_bot_x = current_bottom.x() if callable(current_bottom.x) else current_bottom.x
            curr_bot_y = current_bottom.y() if callable(current_bottom.y) else current_bottom.y
            current_bottom.position(curr_bot_x, curr_bot_y, 3.0)
            current_bottom.draw()

        # Draw incoming images (fading in with optional slide)
        if next_top is not None:
            next_top.set_alpha(top_alpha)
            # Get base position (should be set by loader to top half)
            base_x = next_top.x() if callable(next_top.x) else next_top.x
            base_y = next_top.y() if callable(next_top.y) else next_top.y
            next_top.position(base_x + top_x_offset, base_y + top_y_offset, 2.0)
            next_top.draw()

        if next_bottom is not None:
            next_bottom.set_alpha(bottom_alpha)
            base_x = next_bottom.x() if callable(next_bottom.x) else next_bottom.x
            base_y = next_bottom.y() if callable(next_bottom.y) else next_bottom.y
            next_bottom.position(base_x + bottom_x_offset, base_y + bottom_y_offset, 1.0)
            next_bottom.draw()

    @property
    def is_top_complete(self) -> bool:
        """Check if top image animation is complete."""
        if self._start_time is None:
            return False
        elapsed = time.time() - self._start_time
        return elapsed >= self.top_duration

    @property
    def is_bottom_complete(self) -> bool:
        """Check if bottom image animation is complete."""
        if self._start_time is None:
            return False
        elapsed = time.time() - self._start_time
        return elapsed >= (self.stagger_delay + self.bottom_duration)
