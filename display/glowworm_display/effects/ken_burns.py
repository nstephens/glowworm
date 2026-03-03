"""
Ken Burns Effect for GlowWorm Display Engine.

Implements the classic Ken Burns zoom and pan effect that animates
images during display. Creates a cinematic, documentary-style effect
by slowly zooming and panning across the image.
"""

import logging
import math
import random
import time
from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING, Tuple

if TYPE_CHECKING:
    import pi3d
    from glowworm_display.image_loader import MockSprite

logger = logging.getLogger(__name__)


class KenBurnsDirection(str, Enum):
    """Direction of Ken Burns movement."""
    ZOOM_IN = "zoom_in"      # Zoom in while panning
    ZOOM_OUT = "zoom_out"    # Zoom out while panning
    RANDOM = "random"        # Randomly choose direction


@dataclass
class KenBurnsConfig:
    """Configuration for Ken Burns effect."""

    # Zoom range (1.0 = no zoom, 1.2 = 20% zoom)
    min_zoom: float = 1.0
    max_zoom: float = 1.15  # Subtle zoom for better quality

    # Pan range (as fraction of image dimensions)
    max_pan_x: float = 0.08  # Max 8% horizontal pan
    max_pan_y: float = 0.08  # Max 8% vertical pan

    # Direction preference
    direction: KenBurnsDirection = KenBurnsDirection.RANDOM

    # Duration multiplier (1.0 = use display time, 1.2 = 20% longer for smooth ending)
    duration_multiplier: float = 1.0

    # Easing (smoother start/stop)
    use_easing: bool = True


class KenBurnsEffect:
    """
    Ken Burns zoom and pan effect for images.

    Creates a slow, continuous zoom and pan animation on an image
    during its display time. Each image gets randomly assigned
    start and end positions/zoom levels for variety.

    Usage:
        effect = KenBurnsEffect(duration=30.0)
        effect.start()

        # In render loop:
        while effect.is_running:
            effect.apply(sprite)
            sprite.draw()

    Attributes:
        config: Effect configuration
        duration: Total duration of the effect in seconds
    """

    def __init__(
        self,
        duration: float,
        config: KenBurnsConfig | None = None,
        seed: int | None = None,
    ) -> None:
        """
        Initialize the Ken Burns effect.

        Args:
            duration: Duration of the effect in seconds
            config: Optional configuration (uses defaults if None)
            seed: Optional random seed for reproducible animations
        """
        self.config = config or KenBurnsConfig()
        self.duration = max(0.1, duration * self.config.duration_multiplier)

        # Initialize random generator with seed if provided
        self._rng = random.Random(seed)

        # State
        self._start_time: float | None = None
        self._is_running = False

        # Animation parameters (set on start)
        self._start_zoom: float = 1.0
        self._end_zoom: float = 1.0
        self._start_pan_x: float = 0.0
        self._start_pan_y: float = 0.0
        self._end_pan_x: float = 0.0
        self._end_pan_y: float = 0.0

        # Store original sprite properties for restoration
        self._original_scale: float | None = None
        self._original_x: float | None = None
        self._original_y: float | None = None

        # For stacked pair - store bottom sprite original position
        self._bottom_original_x: float | None = None
        self._bottom_original_y: float | None = None

        logger.debug(
            f"KenBurnsEffect created: duration={duration}s, "
            f"zoom={self.config.min_zoom}-{self.config.max_zoom}"
        )

    def _generate_animation_params(self) -> None:
        """Generate random start and end parameters for the animation."""
        cfg = self.config

        # Determine zoom direction
        if cfg.direction == KenBurnsDirection.ZOOM_IN:
            zoom_in = True
        elif cfg.direction == KenBurnsDirection.ZOOM_OUT:
            zoom_in = False
        else:
            zoom_in = self._rng.choice([True, False])

        # Generate zoom levels
        zoom_range = cfg.max_zoom - cfg.min_zoom
        if zoom_in:
            self._start_zoom = cfg.min_zoom + self._rng.random() * zoom_range * 0.3
            self._end_zoom = cfg.max_zoom - self._rng.random() * zoom_range * 0.3
        else:
            self._start_zoom = cfg.max_zoom - self._rng.random() * zoom_range * 0.3
            self._end_zoom = cfg.min_zoom + self._rng.random() * zoom_range * 0.3

        # Generate pan positions (random points within allowed range)
        # Use signed random to allow panning in any direction
        self._start_pan_x = (self._rng.random() * 2 - 1) * cfg.max_pan_x
        self._start_pan_y = (self._rng.random() * 2 - 1) * cfg.max_pan_y
        self._end_pan_x = (self._rng.random() * 2 - 1) * cfg.max_pan_x
        self._end_pan_y = (self._rng.random() * 2 - 1) * cfg.max_pan_y

        logger.debug(
            f"Ken Burns params: zoom {self._start_zoom:.2f} -> {self._end_zoom:.2f}, "
            f"pan ({self._start_pan_x:.3f}, {self._start_pan_y:.3f}) -> "
            f"({self._end_pan_x:.3f}, {self._end_pan_y:.3f})"
        )

    def start(self) -> None:
        """Start the Ken Burns effect."""
        self._generate_animation_params()
        self._start_time = time.time()
        self._is_running = True
        self._original_scale = None
        self._original_x = None
        self._original_y = None
        logger.debug("Ken Burns effect started")

    def stop(self) -> None:
        """Stop the Ken Burns effect."""
        self._is_running = False
        logger.debug("Ken Burns effect stopped")

    def reset(self) -> None:
        """Reset the effect to initial state."""
        self._start_time = None
        self._is_running = False
        self._original_scale = None
        self._original_x = None
        self._original_y = None
        self._bottom_original_x = None
        self._bottom_original_y = None

    @property
    def is_running(self) -> bool:
        """Check if the effect is currently running."""
        return self._is_running

    @property
    def progress(self) -> float:
        """Get current progress (0.0 to 1.0)."""
        if self._start_time is None:
            return 0.0
        elapsed = time.time() - self._start_time
        return min(1.0, elapsed / self.duration)

    def _ease(self, t: float) -> float:
        """
        Apply easing function to progress.

        Uses sine easing for very smooth, gentle movement.

        Args:
            t: Linear progress from 0.0 to 1.0

        Returns:
            Eased progress value
        """
        if not self.config.use_easing:
            return t

        # Sine ease-in-out for very smooth motion
        return -(math.cos(math.pi * t) - 1) / 2

    def get_current_transform(self) -> Tuple[float, float, float]:
        """
        Get the current zoom and pan values.

        Returns:
            Tuple of (zoom, pan_x, pan_y) where:
            - zoom: Scale factor (1.0 = normal)
            - pan_x: X offset as fraction of width
            - pan_y: Y offset as fraction of height
        """
        if self._start_time is None:
            return 1.0, 0.0, 0.0

        # Calculate progress
        elapsed = time.time() - self._start_time
        raw_progress = min(1.0, elapsed / self.duration)
        progress = self._ease(raw_progress)

        # Interpolate zoom
        zoom = self._start_zoom + (self._end_zoom - self._start_zoom) * progress

        # Interpolate pan
        pan_x = self._start_pan_x + (self._end_pan_x - self._start_pan_x) * progress
        pan_y = self._start_pan_y + (self._end_pan_y - self._start_pan_y) * progress

        return zoom, pan_x, pan_y

    def apply(
        self,
        sprite: "MockSprite | pi3d.Sprite",
        display_width: int,
        display_height: int,
    ) -> None:
        """
        Apply the Ken Burns effect to a sprite.

        Modifies the sprite's scale and position based on the current
        animation progress. Should be called each frame.

        Args:
            sprite: The sprite to animate
            display_width: Display width for calculating pan offset
            display_height: Display height for calculating pan offset
        """
        if sprite is None or not self._is_running:
            return

        # Store original values on first apply
        if self._original_x is None:
            # Get original position
            self._original_x = sprite.x() if callable(sprite.x) else sprite.x
            self._original_y = sprite.y() if callable(sprite.y) else sprite.y

        zoom, pan_x, pan_y = self.get_current_transform()

        # Calculate new position (pan is relative to display size)
        new_x = self._original_x + pan_x * display_width
        new_y = self._original_y + pan_y * display_height

        # Apply scale - Pi3D's scale() multiplies, so we need to set absolute values
        # We'll directly modify the sprite's scale matrix
        if hasattr(sprite, 'sx'):
            # Direct access to scale values (Pi3D Shape)
            sprite.sx = zoom
            sprite.sy = zoom
            sprite.sz = 1.0
        elif hasattr(sprite, 'scale'):
            # Fallback: try to use scale() - but this may be cumulative
            # For now, just set scale once and don't animate zoom
            pass

        # Apply position
        # Get current z position to maintain layering
        if hasattr(sprite, 'z') and callable(sprite.z):
            curr_z = sprite.z()
        elif hasattr(sprite, 'z'):
            curr_z = sprite.z
        else:
            curr_z = 1.0

        sprite.position(new_x, new_y, curr_z)

        # Check if effect should end
        if self.progress >= 1.0:
            self._is_running = False

    def apply_to_pair(
        self,
        top_sprite: "MockSprite | pi3d.Sprite | None",
        bottom_sprite: "MockSprite | pi3d.Sprite | None",
        display_width: int,
        display_height: int,
    ) -> None:
        """
        Apply Ken Burns effect to a pair of stacked sprites.

        Each sprite gets a slightly different animation for visual interest.
        The top sprite uses the main animation, bottom uses a slightly
        different phase.

        Args:
            top_sprite: Top image sprite
            bottom_sprite: Bottom image sprite
            display_width: Display width
            display_height: Display height (full, not half)
        """
        if not self._is_running:
            return

        # Apply main effect to top sprite
        if top_sprite is not None:
            self.apply(top_sprite, display_width, display_height // 2)

        # Apply inverted/offset effect to bottom sprite
        if bottom_sprite is not None:
            # Store original position on first call
            if self._bottom_original_x is None:
                self._bottom_original_x = bottom_sprite.x() if callable(bottom_sprite.x) else bottom_sprite.x
                self._bottom_original_y = bottom_sprite.y() if callable(bottom_sprite.y) else bottom_sprite.y

            zoom, pan_x, pan_y = self.get_current_transform()

            # Use stored original position, invert pan for variety
            new_x = self._bottom_original_x - pan_x * display_width  # Inverted X
            new_y = self._bottom_original_y + pan_y * (display_height // 2)  # Same Y direction

            # Apply scale directly to prevent cumulative scaling
            if hasattr(bottom_sprite, 'sx'):
                bottom_sprite.sx = zoom
                bottom_sprite.sy = zoom
                bottom_sprite.sz = 1.0

            curr_z = 1.0
            if hasattr(bottom_sprite, 'z') and callable(bottom_sprite.z):
                curr_z = bottom_sprite.z()
            elif hasattr(bottom_sprite, 'z'):
                curr_z = bottom_sprite.z

            bottom_sprite.position(new_x, new_y, curr_z)
