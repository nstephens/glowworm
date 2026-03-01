"""
Image Loading and Display for GlowWorm Display Engine.

Handles loading images from file paths, creating Pi3D textures,
calculating aspect ratios, and positioning sprites for display.

Performance optimizations:
- Image resizing before GPU upload (reduces memory)
- Texture recycling pool (reduces allocations)
- Lazy shader loading
"""

import logging
from collections import OrderedDict
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import TYPE_CHECKING, Callable

from PIL import Image

from glowworm_display.config import Rotation

if TYPE_CHECKING:
    import pi3d
    from glowworm_display.performance import PerformanceMonitor

logger = logging.getLogger(__name__)

# Supported image formats
SUPPORTED_FORMATS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}

# Default max texture dimension (optimized for Pi GPU memory)
# Images larger than this will be resized before upload
DEFAULT_MAX_TEXTURE_SIZE = 2048

# Default texture pool size (number of textures to keep in memory)
DEFAULT_TEXTURE_POOL_SIZE = 4


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


@dataclass
class ImageLoaderConfig:
    """Configuration for image loader optimizations."""

    # Maximum texture dimension (images larger are resized)
    max_texture_size: int = DEFAULT_MAX_TEXTURE_SIZE

    # Number of textures to keep in recycling pool
    texture_pool_size: int = DEFAULT_TEXTURE_POOL_SIZE

    # Enable image resizing before GPU upload
    resize_large_images: bool = True

    # JPEG quality for resized images (1-100)
    resize_quality: int = 90

    # Use mipmaps (better quality at cost of memory)
    use_mipmaps: bool = True

    # Enable texture blending (for alpha)
    enable_blending: bool = True


@dataclass
class TextureInfo:
    """Information about a loaded texture for tracking."""

    file_path: str
    width: int
    height: int
    original_width: int
    original_height: int
    size_bytes: int = 0
    was_resized: bool = False


class MockTexture:
    """Mock Pi3D texture for development/testing."""

    def __init__(
        self,
        file_path: str,
        width: int,
        height: int,
        original_width: int | None = None,
        original_height: int | None = None,
    ) -> None:
        self.file_path = file_path
        self.ix = width
        self.iy = height
        self.original_width = original_width or width
        self.original_height = original_height or height
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

    Performance optimizations:
    - Resizes large images before GPU upload to reduce memory
    - Maintains a texture recycling pool to reduce allocations
    - Integrates with PerformanceMonitor for tracking

    Attributes:
        display_width: Width of the display in pixels
        display_height: Height of the display in pixels
        rotation: Display rotation in degrees
        mock: Whether running in mock mode
        config: Image loader configuration
    """

    def __init__(
        self,
        display_width: int,
        display_height: int,
        rotation: Rotation = Rotation.DEG_0,
        mock: bool = False,
        config: ImageLoaderConfig | None = None,
        performance_monitor: "PerformanceMonitor | None" = None,
    ) -> None:
        """
        Initialize the image loader.

        Args:
            display_width: Width of the display in pixels
            display_height: Height of the display in pixels
            rotation: Display rotation in degrees
            mock: If True, use mock objects for development
            config: Optional configuration for optimizations
            performance_monitor: Optional monitor for tracking metrics
        """
        self.display_width = display_width
        self.display_height = display_height
        self.rotation = rotation
        self.mock = mock
        self.config = config or ImageLoaderConfig()
        self._perf_monitor = performance_monitor

        # Pi3D shader for sprites (loaded lazily)
        self._shader: "pi3d.Shader | None" = None

        # Texture recycling pool: OrderedDict for LRU behavior
        # Maps file_path -> (texture, TextureInfo)
        self._texture_pool: OrderedDict[str, tuple] = OrderedDict()

        # Track texture info for all loaded textures
        self._texture_info: dict[str, TextureInfo] = {}

        # Statistics
        self._textures_loaded: int = 0
        self._textures_recycled: int = 0
        self._textures_evicted: int = 0
        self._bytes_saved_by_resize: int = 0

        logger.info(
            f"ImageLoader initialized: {display_width}x{display_height}, "
            f"rotation={rotation.value}, mock={mock}, "
            f"max_texture_size={self.config.max_texture_size}"
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

    def _should_resize(self, width: int, height: int) -> bool:
        """Check if an image should be resized based on configuration."""
        if not self.config.resize_large_images:
            return False
        max_size = self.config.max_texture_size
        return width > max_size or height > max_size

    def _calculate_resize_dimensions(
        self, width: int, height: int
    ) -> tuple[int, int]:
        """
        Calculate new dimensions that fit within max_texture_size.

        Maintains aspect ratio while ensuring neither dimension
        exceeds the maximum.

        Args:
            width: Original width
            height: Original height

        Returns:
            Tuple of (new_width, new_height)
        """
        max_size = self.config.max_texture_size

        if width <= max_size and height <= max_size:
            return width, height

        # Calculate scale factor to fit within max_size
        scale = min(max_size / width, max_size / height)
        new_width = int(width * scale)
        new_height = int(height * scale)

        # Ensure dimensions are at least 1
        return max(1, new_width), max(1, new_height)

    def _resize_image(self, path: Path) -> tuple[Image.Image, bool]:
        """
        Load and optionally resize an image.

        Args:
            path: Path to the image file

        Returns:
            Tuple of (PIL Image, was_resized)

        Raises:
            ImageLoadError: If image cannot be loaded
        """
        try:
            img = Image.open(path)

            # Convert to RGB if necessary (handles RGBA, P, etc.)
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGBA" if "A" in img.mode else "RGB")

            original_width, original_height = img.size

            if self._should_resize(original_width, original_height):
                new_width, new_height = self._calculate_resize_dimensions(
                    original_width, original_height
                )

                # Use LANCZOS for high-quality downsampling
                img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

                # Calculate memory saved (approximate)
                original_bytes = original_width * original_height * 4  # RGBA
                new_bytes = new_width * new_height * 4
                self._bytes_saved_by_resize += original_bytes - new_bytes

                logger.debug(
                    f"Resized image {path.name}: "
                    f"{original_width}x{original_height} -> {new_width}x{new_height}"
                )
                return img, True

            return img, False

        except Exception as e:
            raise ImageLoadError(f"Failed to load/resize image: {e}") from e

    def _get_texture_from_pool(
        self, file_path: str
    ) -> "MockTexture | pi3d.Texture | None":
        """
        Try to get a texture from the recycling pool.

        If found, moves it to the end (most recently used).

        Args:
            file_path: Path to look up

        Returns:
            Texture if found in pool, None otherwise
        """
        if file_path in self._texture_pool:
            # Move to end (most recently used)
            self._texture_pool.move_to_end(file_path)
            texture, info = self._texture_pool[file_path]
            self._textures_recycled += 1
            logger.debug(f"Recycled texture from pool: {file_path}")
            return texture
        return None

    def _add_texture_to_pool(
        self,
        file_path: str,
        texture: "MockTexture | pi3d.Texture",
        info: TextureInfo,
    ) -> None:
        """
        Add a texture to the recycling pool.

        Evicts oldest textures if pool is full.

        Args:
            file_path: Path key for the texture
            texture: The texture object
            info: Texture information
        """
        # Evict oldest if pool is full
        while len(self._texture_pool) >= self.config.texture_pool_size:
            oldest_path, (old_texture, old_info) = self._texture_pool.popitem(last=False)
            self._textures_evicted += 1

            # Track in performance monitor
            if self._perf_monitor:
                self._perf_monitor.track_texture_unload(old_info.size_bytes)

            logger.debug(f"Evicted texture from pool: {oldest_path}")

        self._texture_pool[file_path] = (texture, info)
        self._texture_info[file_path] = info

    def clear_texture_pool(self) -> int:
        """
        Clear all textures from the recycling pool.

        Useful for freeing memory during idle periods.

        Returns:
            Number of textures cleared
        """
        count = len(self._texture_pool)

        for file_path, (texture, info) in self._texture_pool.items():
            if self._perf_monitor:
                self._perf_monitor.track_texture_unload(info.size_bytes)

        self._texture_pool.clear()
        logger.info(f"Cleared {count} textures from pool")
        return count

    def get_pool_stats(self) -> dict:
        """
        Get statistics about the texture pool.

        Returns:
            Dict with pool statistics
        """
        total_size = sum(
            info.size_bytes for _, (_, info) in self._texture_pool.items()
        )

        return {
            "pool_size": len(self._texture_pool),
            "pool_capacity": self.config.texture_pool_size,
            "total_bytes": total_size,
            "total_mb": round(total_size / (1024 * 1024), 2),
            "textures_loaded": self._textures_loaded,
            "textures_recycled": self._textures_recycled,
            "textures_evicted": self._textures_evicted,
            "recycle_rate": (
                self._textures_recycled / self._textures_loaded
                if self._textures_loaded > 0
                else 0.0
            ),
            "bytes_saved_by_resize": self._bytes_saved_by_resize,
            "mb_saved_by_resize": round(
                self._bytes_saved_by_resize / (1024 * 1024), 2
            ),
        }

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
        self,
        file_path: str | Path,
        use_pool: bool = True,
    ) -> "MockTexture | pi3d.Texture":
        """
        Load an image file as a Pi3D texture.

        Includes optimizations:
        - Checks texture pool first to avoid reloading
        - Resizes large images to fit max_texture_size
        - Tracks texture in performance monitor

        Args:
            file_path: Path to the image file
            use_pool: If True, check/use texture pool

        Returns:
            Pi3D Texture object (or MockTexture in mock mode)

        Raises:
            ImageLoadError: If image cannot be loaded
        """
        path = self._validate_path(file_path)
        path_str = str(path)

        # Check texture pool first
        if use_pool:
            pooled = self._get_texture_from_pool(path_str)
            if pooled is not None:
                return pooled

        logger.debug(f"Loading texture: {path}")
        self._textures_loaded += 1

        if self.mock:
            # Load with PIL and optionally resize
            img, was_resized = self._resize_image(path)
            width, height = img.size
            original_width, original_height = (
                self._load_image_dimensions(path) if was_resized else (width, height)
            )
            img.close()

            texture = MockTexture(
                path_str, width, height, original_width, original_height
            )

            # Calculate approximate size (RGBA)
            size_bytes = width * height * 4

            info = TextureInfo(
                file_path=path_str,
                width=width,
                height=height,
                original_width=original_width,
                original_height=original_height,
                size_bytes=size_bytes,
                was_resized=was_resized,
            )

            # Track in performance monitor
            if self._perf_monitor:
                self._perf_monitor.track_texture_load(size_bytes)

            # Add to pool
            if use_pool:
                self._add_texture_to_pool(path_str, texture, info)

            return texture

        try:
            import pi3d

            # Get original dimensions first
            original_width, original_height = self._load_image_dimensions(path)

            # Check if resizing is needed
            if self._should_resize(original_width, original_height):
                # Load, resize, and create texture from PIL image
                img, was_resized = self._resize_image(path)
                width, height = img.size

                # Create texture from PIL image array
                import numpy as np

                # Convert to numpy array for pi3d
                img_array = np.array(img)
                img.close()

                # pi3d.Texture can accept numpy array
                texture = pi3d.Texture(
                    img_array,
                    blend=self.config.enable_blending,
                    mipmap=self.config.use_mipmaps,
                )
            else:
                # Load directly (no resize needed)
                texture = pi3d.Texture(
                    path_str,
                    blend=self.config.enable_blending,
                    mipmap=self.config.use_mipmaps,
                )
                width, height = texture.ix, texture.iy
                was_resized = False

            # Calculate approximate GPU memory usage
            # RGBA with mipmaps is roughly 1.33x base size
            size_bytes = width * height * 4
            if self.config.use_mipmaps:
                size_bytes = int(size_bytes * 1.33)

            info = TextureInfo(
                file_path=path_str,
                width=width,
                height=height,
                original_width=original_width,
                original_height=original_height,
                size_bytes=size_bytes,
                was_resized=was_resized,
            )

            # Track in performance monitor
            if self._perf_monitor:
                self._perf_monitor.track_texture_load(size_bytes)

            # Add to pool
            if use_pool:
                self._add_texture_to_pool(path_str, texture, info)

            logger.debug(
                f"Texture loaded: {width}x{height}"
                f"{' (resized from ' + str(original_width) + 'x' + str(original_height) + ')' if was_resized else ''}"
            )
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

        # Pi3D Sprite uses .width and .height, MockSprite uses .w and .h
        sprite_w = getattr(sprite, 'width', getattr(sprite, 'w', 0))
        sprite_h = getattr(sprite, 'height', getattr(sprite, 'h', 0))
        logger.info(
            f"Image loaded: {texture.ix}x{texture.iy} -> "
            f"{sprite_w:.0f}x{sprite_h:.0f}"
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

    def calculate_stacked_dimensions(
        self,
        image_width: int,
        image_height: int,
        position: str,
        scale_mode: ScaleMode = ScaleMode.FIT,
    ) -> ImageDimensions:
        """
        Calculate display dimensions for an image in a stacked layout.

        For portrait displays, two landscape images are displayed stacked
        (top/bottom), each occupying half the screen height.

        Args:
            image_width: Original image width in pixels
            image_height: Original image height in pixels
            position: 'top' or 'bottom'
            scale_mode: How to scale the image within its half

        Returns:
            ImageDimensions with calculated size and position
        """
        # Use display dimensions directly - Pi3D already reports actual screen size
        # Rotation is applied to images, not to the coordinate system
        effective_width = self.display_width
        effective_height = self.display_height

        logger.info(
            f"calculate_stacked_dimensions: display={effective_width}x{effective_height}, "
            f"image={image_width}x{image_height}, position={position}, rotation={self.rotation.value}"
        )
        # Also write to a debug file since logging may not be visible
        try:
            with open("/tmp/glowworm_stacked_debug.log", "a") as f:
                f.write(
                    f"calculate_stacked: display={effective_width}x{effective_height}, "
                    f"image={image_width}x{image_height}, position={position}, "
                    f"rotation={self.rotation.value}\n"
                )
        except:
            pass

        # Each image gets half the display height
        half_height = effective_height / 2.0

        # Calculate aspect ratios
        image_aspect = image_width / image_height
        half_aspect = effective_width / half_height

        if scale_mode == ScaleMode.STRETCH:
            # Stretch to fill half
            scaled_width = float(effective_width)
            scaled_height = half_height
        elif scale_mode == ScaleMode.FILL:
            # Fill the half, cropping as needed
            if image_aspect > half_aspect:
                scale = half_height / image_height
                scaled_width = image_width * scale
                scaled_height = half_height
            else:
                scale = effective_width / image_width
                scaled_width = float(effective_width)
                scaled_height = image_height * scale
        else:
            # FIT mode - fit within half, letterbox if needed
            if image_aspect > half_aspect:
                # Image is wider - fit to width
                scale = effective_width / image_width
                scaled_width = float(effective_width)
                scaled_height = image_height * scale
            else:
                # Image is taller - fit to half height
                scale = half_height / image_height
                scaled_width = image_width * scale
                scaled_height = half_height

        # Calculate position offset based on rotation
        # Pi3D reports hardware dimensions, and sprites are rotated to display correctly.
        # For rotated displays, we need to position along the axis that becomes vertical
        # after rotation.
        #
        # Rotation 0: Y is vertical, position along Y
        # Rotation 90: X becomes vertical (Y->-X), position along X (negated)
        # Rotation 180: Y is vertical (Y->-Y), position along Y (negated)
        # Rotation 270: X becomes vertical (Y->X), position along X
        quarter_offset = effective_height / 4.0

        if self.rotation in (Rotation.DEG_90, Rotation.DEG_270):
            # Rotated display: position along X axis (which becomes vertical)
            if self.rotation == Rotation.DEG_270:
                # 270°: visual top is positive X
                if position == 'top':
                    x_offset = quarter_offset
                    y_offset = 0.0
                else:
                    x_offset = -quarter_offset
                    y_offset = 0.0
            else:  # DEG_90
                # 90°: visual top is negative X
                if position == 'top':
                    x_offset = -quarter_offset
                    y_offset = 0.0
                else:
                    x_offset = quarter_offset
                    y_offset = 0.0
        else:
            # Non-rotated display: position along Y axis
            x_offset = 0.0
            if self.rotation == Rotation.DEG_180:
                # 180°: Y is flipped
                if position == 'top':
                    y_offset = -quarter_offset
                else:
                    y_offset = quarter_offset
            else:  # DEG_0
                if position == 'top':
                    y_offset = quarter_offset
                else:
                    y_offset = -quarter_offset

        return ImageDimensions(
            width=scaled_width,
            height=scaled_height,
            x_offset=x_offset,
            y_offset=y_offset,
            scale_x=scaled_width / image_width if image_width > 0 else 1.0,
            scale_y=scaled_height / image_height if image_height > 0 else 1.0,
        )

    def create_stacked_sprite(
        self,
        texture: "MockTexture | pi3d.Texture",
        position: str,
        scale_mode: ScaleMode = ScaleMode.FIT,
        z: float = 1.0,
    ) -> "MockSprite | pi3d.Sprite":
        """
        Create a sprite positioned for stacked display.

        Args:
            texture: Pi3D Texture to use
            position: 'top' or 'bottom'
            scale_mode: How to scale the image within its half
            z: Z depth for layering

        Returns:
            Pi3D Sprite positioned for stacked display
        """
        image_width = texture.ix
        image_height = texture.iy

        dims = self.calculate_stacked_dimensions(
            image_width, image_height, position, scale_mode
        )

        logger.info(
            f"Creating stacked sprite ({position}): "
            f"image={image_width}x{image_height}, "
            f"scaled={dims.width:.0f}x{dims.height:.0f}, "
            f"offset=({dims.x_offset:.0f}, {dims.y_offset:.0f}), "
            f"rotation={self.rotation.value}"
        )
        # Also write to a debug file
        try:
            with open("/tmp/glowworm_stacked_debug.log", "a") as f:
                f.write(
                    f"stacked sprite ({position}): image={image_width}x{image_height}, "
                    f"scaled={dims.width:.0f}x{dims.height:.0f}, "
                    f"offset=({dims.x_offset:.0f}, {dims.y_offset:.0f}), rotation={self.rotation.value}\n"
                )
        except:
            pass

        if self.mock:
            sprite = MockSprite(
                texture=texture,
                w=dims.width,
                h=dims.height,
                x=dims.x_offset,
                y=dims.y_offset,
                z=z,
            )
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

        if self.rotation != Rotation.DEG_0:
            sprite.rotateToZ(float(self.rotation.value))

        return sprite

    def load_stacked_image(
        self,
        file_path: str | Path,
        position: str,
        scale_mode: ScaleMode = ScaleMode.FIT,
        z: float = 1.0,
    ) -> "MockSprite | pi3d.Sprite":
        """
        Load an image positioned for stacked display.

        Convenience method for loading images in a top/bottom stacked layout.

        Args:
            file_path: Path to the image file
            position: 'top' or 'bottom'
            scale_mode: How to scale the image within its half
            z: Z depth for layering

        Returns:
            Pi3D Sprite positioned for stacked display

        Raises:
            ImageLoadError: If image cannot be loaded
        """
        logger.info(f"Loading stacked image ({position}): {file_path}")

        texture = self.load_texture(file_path)
        sprite = self.create_stacked_sprite(texture, position, scale_mode, z)

        return sprite
