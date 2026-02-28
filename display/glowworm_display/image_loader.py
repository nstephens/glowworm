"""
Image Loading and Display for GlowWorm Display Engine.

Handles loading images from file paths, creating Pi3D textures,
calculating aspect ratios, and positioning sprites for display.
"""

import logging
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import TYPE_CHECKING

from PIL import Image

from glowworm_display.config import Rotation

if TYPE_CHECKING:
    import pi3d

logger = logging.getLogger(__name__)

# Supported image formats
SUPPORTED_FORMATS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}


class ScaleMode(str, Enum):
    """Image scaling modes."""

    FIT = "fit"  # Fit inside display (letterbox/pillarbox)
    FILL = "fill"  # Fill display (crop edges)
    STRETCH = "stretch"  # Stretch to fill (distort)


@dataclass
class ImageDimensions:
    """
    Calculated dimensions for displaying an image.

    Attributes:
        width: Final display width in pixels
        height: Final display height in pixels
        x_offset: X offset from center (for positioning)
        y_offset: Y offset from center (for positioning)
        scale_x: Scale factor for X axis
        scale_y: Scale factor for Y axis
    """

    width: float
    height: float
    x_offset: float = 0.0
    y_offset: float = 0.0
    scale_x: float = 1.0
    scale_y: float = 1.0


class ImageLoadError(Exception):
    """Raised when an image cannot be loaded."""

    pass


class MockTexture:
    """Mock Pi3D texture for development/testing."""

    def __init__(self, file_path: str, width: int, height: int) -> None:
        self.file_path = file_path
        self.ix = width
        self.iy = height
        logger.debug(f"MockTexture created: {width}x{height} from {file_path}")


class MockSprite:
    """Mock Pi3D sprite for development/testing."""

    def __init__(
        self,
        texture: "MockTexture | pi3d.Texture",
        w: float,
        h: float,
        x: float = 0.0,
        y: float = 0.0,
        z: float = 1.0,
    ) -> None:
        self.texture = texture
        self.w = w
        self.h = h
        self.x = x
        self.y = y
        self.z = z
        self._alpha = 1.0
        self._rotation = 0.0
        logger.debug(f"MockSprite created: {w}x{h} at ({x}, {y})")

    def draw(self) -> None:
        """Draw the sprite (no-op in mock mode)."""
        pass

    def set_alpha(self, alpha: float) -> None:
        """Set sprite alpha/opacity."""
        self._alpha = max(0.0, min(1.0, alpha))

    def alpha(self) -> float:
        """Get current alpha value."""
        return self._alpha

    def rotateToZ(self, angle: float) -> None:
        """Rotate sprite around Z axis."""
        self._rotation = angle

    def position(self, x: float, y: float, z: float) -> None:
        """Set sprite position."""
        self.x = x
        self.y = y
        self.z = z

    def set_textures(self, textures: list) -> None:
        """Set sprite textures."""
        if textures:
            self.texture = textures[0]


class ImageLoader:
    """
    Loads images and creates Pi3D sprites for display.

    Handles image loading, texture creation, aspect ratio calculation,
    and sprite positioning for proper display within the screen bounds.

    Attributes:
        display_width: Width of the display in pixels
        display_height: Height of the display in pixels
        rotation: Display rotation in degrees
        mock: Whether running in mock mode
    """

    def __init__(
        self,
        display_width: int,
        display_height: int,
        rotation: Rotation = Rotation.DEG_0,
        mock: bool = False,
    ) -> None:
        """
        Initialize the image loader.

        Args:
            display_width: Width of the display in pixels
            display_height: Height of the display in pixels
            rotation: Display rotation in degrees
            mock: If True, use mock objects for development
        """
        self.display_width = display_width
        self.display_height = display_height
        self.rotation = rotation
        self.mock = mock

        # Pi3D shader for sprites (loaded lazily)
        self._shader: "pi3d.Shader | None" = None

        logger.info(
            f"ImageLoader initialized: {display_width}x{display_height}, "
            f"rotation={rotation.value}, mock={mock}"
        )

    def _get_shader(self) -> "pi3d.Shader":
        """Get or create the Pi3D shader for sprites."""
        if self._shader is None:
            if self.mock:
                # Mock shader - just return None, sprites don't need it in mock
                return None  # type: ignore
            import pi3d

            self._shader = pi3d.Shader("uv_flat")
        return self._shader

    def _validate_path(self, file_path: str | Path) -> Path:
        """
        Validate that the file path exists and is a supported format.

        Args:
            file_path: Path to the image file

        Returns:
            Path object for the file

        Raises:
            ImageLoadError: If file doesn't exist or format not supported
        """
        path = Path(file_path)

        if not path.exists():
            raise ImageLoadError(f"Image file not found: {path}")

        if not path.is_file():
            raise ImageLoadError(f"Not a file: {path}")

        suffix = path.suffix.lower()
        if suffix not in SUPPORTED_FORMATS:
            raise ImageLoadError(
                f"Unsupported image format: {suffix}. "
                f"Supported formats: {', '.join(SUPPORTED_FORMATS)}"
            )

        return path

    def _load_image_dimensions(self, path: Path) -> tuple[int, int]:
        """
        Load image and get its dimensions without fully decoding.

        Args:
            path: Path to the image file

        Returns:
            Tuple of (width, height)

        Raises:
            ImageLoadError: If image cannot be read
        """
        try:
            with Image.open(path) as img:
                return img.size
        except Exception as e:
            raise ImageLoadError(f"Failed to read image dimensions: {e}") from e

    def calculate_dimensions(
        self,
        image_width: int,
        image_height: int,
        scale_mode: ScaleMode = ScaleMode.FIT,
    ) -> ImageDimensions:
        """
        Calculate display dimensions for an image.

        Calculates how to scale and position an image to fit within
        the display bounds while respecting the scale mode.

        For FIT mode (letterbox/pillarbox):
        - Image is scaled to fit entirely within the display
        - Black bars appear on sides (pillarbox) or top/bottom (letterbox)

        For FILL mode:
        - Image is scaled to fill the entire display
        - Parts of the image may be cropped

        Args:
            image_width: Original image width in pixels
            image_height: Original image height in pixels
            scale_mode: How to scale the image

        Returns:
            ImageDimensions with calculated size and position
        """
        # Account for rotation - swap display dimensions if rotated 90 or 270
        if self.rotation in (Rotation.DEG_90, Rotation.DEG_270):
            effective_width = self.display_height
            effective_height = self.display_width
        else:
            effective_width = self.display_width
            effective_height = self.display_height

        # Calculate aspect ratios
        image_aspect = image_width / image_height
        display_aspect = effective_width / effective_height

        if scale_mode == ScaleMode.STRETCH:
            # Stretch to fill exactly
            return ImageDimensions(
                width=float(effective_width),
                height=float(effective_height),
                scale_x=effective_width / image_width,
                scale_y=effective_height / image_height,
            )

        if scale_mode == ScaleMode.FILL:
            # Fill display, cropping as needed
            if image_aspect > display_aspect:
                # Image is wider - fit height, crop width
                scale = effective_height / image_height
                scaled_width = image_width * scale
                return ImageDimensions(
                    width=scaled_width,
                    height=float(effective_height),
                    scale_x=scale,
                    scale_y=scale,
                )
            else:
                # Image is taller - fit width, crop height
                scale = effective_width / image_width
                scaled_height = image_height * scale
                return ImageDimensions(
                    width=float(effective_width),
                    height=scaled_height,
                    scale_x=scale,
                    scale_y=scale,
                )

        # FIT mode (default) - letterbox/pillarbox
        if image_aspect > display_aspect:
            # Image is wider than display - pillarbox (bars on top/bottom)
            # Fit to width, letterbox height
            scale = effective_width / image_width
            scaled_height = image_height * scale
            return ImageDimensions(
                width=float(effective_width),
                height=scaled_height,
                scale_x=scale,
                scale_y=scale,
            )
        else:
            # Image is taller than display - letterbox (bars on sides)
            # Fit to height, pillarbox width
            scale = effective_height / image_height
            scaled_width = image_width * scale
            return ImageDimensions(
                width=scaled_width,
                height=float(effective_height),
                scale_x=scale,
                scale_y=scale,
            )

    def load_texture(
        self, file_path: str | Path
    ) -> "MockTexture | pi3d.Texture":
        """
        Load an image file as a Pi3D texture.

        Args:
            file_path: Path to the image file

        Returns:
            Pi3D Texture object (or MockTexture in mock mode)

        Raises:
            ImageLoadError: If image cannot be loaded
        """
        path = self._validate_path(file_path)

        logger.debug(f"Loading texture: {path}")

        if self.mock:
            # Load with PIL just to get dimensions
            width, height = self._load_image_dimensions(path)
            return MockTexture(str(path), width, height)

        try:
            import pi3d

            texture = pi3d.Texture(str(path), blend=True, mipmap=True)
            logger.debug(f"Texture loaded: {texture.ix}x{texture.iy}")
            return texture
        except Exception as e:
            raise ImageLoadError(f"Failed to load texture: {e}") from e

    def create_sprite(
        self,
        texture: "MockTexture | pi3d.Texture",
        scale_mode: ScaleMode = ScaleMode.FIT,
        z: float = 1.0,
    ) -> "MockSprite | pi3d.Sprite":
        """
        Create a Pi3D sprite from a texture.

        Creates a sprite with proper dimensions and positioning
        based on the scale mode and display configuration.

        Args:
            texture: Pi3D Texture to use
            scale_mode: How to scale the image
            z: Z depth for layering (higher = further back)

        Returns:
            Pi3D Sprite object (or MockSprite in mock mode)
        """
        # Get texture dimensions
        image_width = texture.ix
        image_height = texture.iy

        # Calculate display dimensions
        dims = self.calculate_dimensions(image_width, image_height, scale_mode)

        logger.debug(
            f"Creating sprite: image={image_width}x{image_height}, "
            f"display={dims.width}x{dims.height}"
        )

        if self.mock:
            sprite = MockSprite(
                texture=texture,
                w=dims.width,
                h=dims.height,
                x=dims.x_offset,
                y=dims.y_offset,
                z=z,
            )
            # Apply rotation
            if self.rotation != Rotation.DEG_0:
                sprite.rotateToZ(float(self.rotation.value))
            return sprite

        import pi3d

        shader = self._get_shader()
        sprite = pi3d.Sprite(
            w=dims.width,
            h=dims.height,
            x=dims.x_offset,
            y=dims.y_offset,
            z=z,
        )
        sprite.set_shader(shader)
        sprite.set_textures([texture])

        # Apply rotation
        if self.rotation != Rotation.DEG_0:
            sprite.rotateToZ(float(self.rotation.value))

        return sprite

    def load_image(
        self,
        file_path: str | Path,
        scale_mode: ScaleMode = ScaleMode.FIT,
        z: float = 1.0,
    ) -> "MockSprite | pi3d.Sprite":
        """
        Load an image and create a ready-to-display sprite.

        Convenience method that combines load_texture and create_sprite.

        Args:
            file_path: Path to the image file
            scale_mode: How to scale the image
            z: Z depth for layering

        Returns:
            Pi3D Sprite ready for display

        Raises:
            ImageLoadError: If image cannot be loaded
        """
        logger.info(f"Loading image: {file_path}")

        texture = self.load_texture(file_path)
        sprite = self.create_sprite(texture, scale_mode, z)

        logger.info(
            f"Image loaded: {texture.ix}x{texture.iy} -> "
            f"{sprite.w:.0f}x{sprite.h:.0f}"
        )

        return sprite

    def preload_texture(
        self, file_path: str | Path
    ) -> "MockTexture | pi3d.Texture | None":
        """
        Preload an image texture without creating a sprite.

        Useful for preloading upcoming images in the slideshow.
        Returns None if loading fails (logs error but doesn't raise).

        Args:
            file_path: Path to the image file

        Returns:
            Texture if successful, None if failed
        """
        try:
            return self.load_texture(file_path)
        except ImageLoadError as e:
            logger.error(f"Failed to preload image: {e}")
            return None
