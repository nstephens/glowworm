"""
Cross-fade transition for GlowWorm Display Engine.

Implements a smooth alpha-blending transition between two images.
"""

import logging
from typing import TYPE_CHECKING

from glowworm_display.transitions.base import (
    ProgressCallback,
    Transition,
    ease_in_out_cubic,
)

if TYPE_CHECKING:
    import pi3d
    from glowworm_display.image_loader import MockSprite

logger = logging.getLogger(__name__)


class CrossfadeTransition(Transition):
    """
    Cross-fade transition between two images.

    Smoothly blends from the current image to the next image
    by adjusting alpha values over the transition duration.

    The outgoing image fades from alpha=1 to alpha=0 while
    the incoming image fades from alpha=0 to alpha=1.

    Attributes:
        duration: Duration of the transition in seconds
        use_easing: Whether to apply easing to alpha interpolation
    """

    def __init__(
        self,
        duration: float = 1.0,
        use_easing: bool = True,
        on_progress: ProgressCallback | None = None,
    ) -> None:
        """
        Initialize the cross-fade transition.

        Args:
            duration: Duration of the transition in seconds
            use_easing: If True, use ease-in-out curve for smoother blending
            on_progress: Optional callback for progress updates
        """
        super().__init__(duration=duration, on_progress=on_progress)
        self.use_easing = use_easing
        logger.debug(f"CrossfadeTransition created: duration={duration}s, easing={use_easing}")

    def _ease(self, t: float) -> float:
        """
        Apply easing function to progress.

        Uses cubic ease-in-out for smooth acceleration/deceleration
        if easing is enabled.

        Args:
            t: Linear progress from 0.0 to 1.0

        Returns:
            Eased progress value
        """
        if self.use_easing:
            return ease_in_out_cubic(t)
        return t

    def render(
        self,
        current_sprite: "MockSprite | pi3d.Sprite | None",
        next_sprite: "MockSprite | pi3d.Sprite | None",
    ) -> None:
        """
        Render the current frame of the cross-fade transition.

        Updates alpha values for both sprites and draws them in the correct
        order (outgoing first, incoming second to blend on top).

        The sprites are positioned at different Z depths:
        - current_sprite at z=2.0 (further back)
        - next_sprite at z=1.0 (in front)

        This ensures proper layering during the blend.

        Args:
            current_sprite: The outgoing image sprite (may be None)
            next_sprite: The incoming image sprite (may be None)
        """
        # Get progress (updates internal state)
        progress_info = self.update()
        progress = progress_info.progress

        # Calculate alpha values
        # Current image fades out: 1 -> 0
        current_alpha = 1.0 - progress
        # Next image fades in: 0 -> 1
        next_alpha = progress

        # Update and draw current (outgoing) sprite
        if current_sprite is not None:
            current_sprite.set_alpha(current_alpha)
            # Position further back
            # Pi3D uses .x() and .y() methods, MockSprite uses .x and .y attributes
            curr_x = current_sprite.x() if callable(current_sprite.x) else current_sprite.x
            curr_y = current_sprite.y() if callable(current_sprite.y) else current_sprite.y
            current_sprite.position(curr_x, curr_y, 2.0)
            current_sprite.draw()

        # Update and draw next (incoming) sprite
        if next_sprite is not None:
            next_sprite.set_alpha(next_alpha)
            # Position in front
            # Pi3D uses .x() and .y() methods, MockSprite uses .x and .y attributes
            next_x = next_sprite.x() if callable(next_sprite.x) else next_sprite.x
            next_y = next_sprite.y() if callable(next_sprite.y) else next_sprite.y
            next_sprite.position(next_x, next_y, 1.0)
            next_sprite.draw()

    def render_single(
        self,
        sprite: "MockSprite | pi3d.Sprite | None",
        fade_in: bool = True,
    ) -> None:
        """
        Render a single sprite fading in or out.

        Useful for transitioning from/to blank screen.

        Args:
            sprite: The sprite to fade
            fade_in: If True, fade in (0->1). If False, fade out (1->0).
        """
        if sprite is None:
            return

        # Get progress (updates internal state)
        progress_info = self.update()
        progress = progress_info.progress

        # Calculate alpha based on direction
        if fade_in:
            alpha = progress
        else:
            alpha = 1.0 - progress

        sprite.set_alpha(alpha)
        sprite.draw()
