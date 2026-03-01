"""
Pi3D Display Management for GlowWorm Display Engine.

Handles Pi3D initialization, fullscreen display, orientation,
background color, and resource cleanup.
"""

import atexit
import logging
import signal
import sys
from contextlib import contextmanager
from types import FrameType
from typing import TYPE_CHECKING, Generator

from glowworm_display.config import DisplayConfig, Orientation, Rotation

if TYPE_CHECKING:
    import pi3d

logger = logging.getLogger(__name__)


class MockDisplay:
    """
    Mock display for development/testing without Pi3D hardware.

    Simulates Pi3D Display behavior for testing on non-Pi systems.
    """

    def __init__(
        self,
        width: int = 1920,
        height: int = 1080,
        background: tuple[float, float, float, float] = (0.0, 0.0, 0.0, 1.0),
    ) -> None:
        self.width = width
        self.height = height
        self.background = background
        self._running = True
        self._frames = 0
        logger.info(f"MockDisplay initialized: {width}x{height}")

    def loop_running(self) -> bool:
        """Check if display loop should continue."""
        return self._running

    def set_background(
        self, r: float, g: float, b: float, a: float = 1.0
    ) -> None:
        """Set background color."""
        self.background = (r, g, b, a)
        logger.debug(f"Background set to: ({r}, {g}, {b}, {a})")

    def stop(self) -> None:
        """Stop the display."""
        self._running = False
        logger.info("MockDisplay stopped")

    def destroy(self) -> None:
        """Destroy the display and clean up resources."""
        self._running = False
        logger.info("MockDisplay destroyed")

    def clear(self) -> None:
        """Clear the display buffer."""
        pass

    def swap_buffers(self) -> None:
        """Swap front and back buffers."""
        self._frames += 1

    @property
    def opengl(self) -> None:
        """Mock OpenGL context (None for mock)."""
        return None

    @property
    def frames(self) -> int:
        """Number of frames rendered."""
        return self._frames


class MockCamera:
    """Mock camera for development/testing without Pi3D hardware."""

    def __init__(self, is_3d: bool = False) -> None:
        self.is_3d = is_3d
        logger.info(f"MockCamera initialized: is_3d={is_3d}")


class Display:
    """
    Pi3D Display manager for GlowWorm.

    Handles initialization of Pi3D display with proper configuration,
    orientation handling, and resource cleanup.

    Attributes:
        config: Display configuration
        mock: Whether running in mock mode (no real Pi3D)
        display: Pi3D Display instance (or MockDisplay)
        camera: Pi3D Camera instance (or MockCamera)
    """

    def __init__(self, config: DisplayConfig, mock: bool = False) -> None:
        """
        Initialize the display manager.

        Args:
            config: Display configuration
            mock: If True, use mock display for development
        """
        self.config = config
        self.mock = mock
        self._display: "pi3d.Display | MockDisplay | None" = None
        self._camera: "pi3d.Camera | MockCamera | None" = None
        self._initialized = False
        self._cleanup_registered = False

        logger.info(f"Display manager created: mock={mock}")
        logger.info(f"Config: {config.to_dict()}")

    @property
    def display(self) -> "pi3d.Display | MockDisplay":
        """Get the Pi3D Display instance."""
        if self._display is None:
            raise RuntimeError("Display not initialized. Call initialize() first.")
        return self._display

    @property
    def camera(self) -> "pi3d.Camera | MockCamera":
        """Get the Pi3D Camera instance."""
        if self._camera is None:
            raise RuntimeError("Camera not initialized. Call initialize() first.")
        return self._camera

    @property
    def width(self) -> int:
        """Get display width in pixels."""
        return self.display.width

    @property
    def height(self) -> int:
        """Get display height in pixels."""
        return self.display.height

    @property
    def is_running(self) -> bool:
        """Check if display is running."""
        if self._display is None:
            return False
        return self._display.loop_running()

    def _detect_resolution(self) -> tuple[int, int]:
        """
        Detect display resolution.

        Returns:
            Tuple of (width, height) in pixels

        If config specifies width/height (non-zero), uses those values.
        Otherwise, attempts to detect from system or uses 1920x1080 default.
        """
        if self.config.width > 0 and self.config.height > 0:
            logger.info(
                f"Using configured resolution: {self.config.width}x{self.config.height}"
            )
            return (self.config.width, self.config.height)

        # In mock mode, default to 1080p
        if self.mock:
            logger.info("Mock mode: using default 1920x1080")
            return (1920, 1080)

        # Let Pi3D auto-detect (it will get screen size from the system)
        # We return 0, 0 to signal auto-detection
        logger.info("Resolution will be auto-detected by Pi3D")
        return (0, 0)

    def _calculate_rotation(self) -> float:
        """
        Calculate the rotation angle for Pi3D based on config.

        Returns:
            Rotation angle in degrees for Pi3D camera
        """
        return float(self.config.rotation.value)

    def initialize(self) -> None:
        """
        Initialize the Pi3D display.

        Creates fullscreen display with configured orientation and background.
        Registers cleanup handlers for graceful shutdown.

        Raises:
            RuntimeError: If initialization fails
        """
        if self._initialized:
            logger.warning("Display already initialized")
            return

        logger.info("Initializing display...")

        width, height = self._detect_resolution()
        bg_rgb = self.config.background_rgb

        if self.mock:
            self._initialize_mock(width, height, bg_rgb)
        else:
            self._initialize_pi3d(width, height, bg_rgb)

        self._register_cleanup()
        self._initialized = True
        logger.info("Display initialization complete")

    def _initialize_mock(
        self,
        width: int,
        height: int,
        bg_rgb: tuple[float, float, float],
    ) -> None:
        """Initialize mock display for development."""
        # Use defaults if auto-detect was requested
        if width == 0:
            width = 1920
        if height == 0:
            height = 1080

        self._display = MockDisplay(
            width=width,
            height=height,
            background=(bg_rgb[0], bg_rgb[1], bg_rgb[2], 1.0),
        )
        self._camera = MockCamera(is_3d=False)

        logger.info(f"Mock display initialized: {width}x{height}")

    def _initialize_pi3d(
        self,
        width: int,
        height: int,
        bg_rgb: tuple[float, float, float],
    ) -> None:
        """Initialize real Pi3D display."""
        import os

        # Log environment for debugging
        logger.info("Display environment:")
        logger.info(f"  SDL_VIDEODRIVER={os.environ.get('SDL_VIDEODRIVER', 'unset')}")
        logger.info(f"  WAYLAND_DISPLAY={os.environ.get('WAYLAND_DISPLAY', 'unset')}")
        logger.info(f"  XDG_RUNTIME_DIR={os.environ.get('XDG_RUNTIME_DIR', 'unset')}")
        logger.info(f"  DISPLAY={os.environ.get('DISPLAY', 'unset')}")

        try:
            import pi3d
        except ImportError as e:
            raise RuntimeError(
                "Pi3D library not found. Install it with: pip install pi3d"
            ) from e

        # Log pi3d configuration for debugging
        logger.info("Creating Pi3D display...")
        logger.info(f"Pi3D version: {getattr(pi3d, '__version__', 'unknown')}")
        logger.info(f"Pi3D PLATFORM: {getattr(pi3d, 'PLATFORM', 'unknown')}")
        logger.info(f"Pi3D USE_PYGAME: {getattr(pi3d, 'USE_PYGAME', 'unknown')}")
        logger.info(f"Pi3D USE_SDL2: {getattr(pi3d, 'USE_SDL2', 'unknown')}")

        # Create display with configuration
        display_kwargs: dict = {
            "background": (bg_rgb[0], bg_rgb[1], bg_rgb[2], 1.0),
            "frames_per_second": self.config.fps_target,
            # Use 16-bit depth buffer for better Pi4/Pi5 compatibility
            # Pi4+ has issues with 24-bit depth in SDL2 mode
            "depth": 16,
        }

        # Handle fullscreen vs windowed
        # Note: use_pygame removed in newer Pi3D versions - DRM/KMS is default
        if self.config.fullscreen:
            # Auto-detect if width/height are 0
            if width > 0:
                display_kwargs["w"] = width
            if height > 0:
                display_kwargs["h"] = height
        else:
            # Windowed mode for debugging
            display_kwargs["w"] = width if width > 0 else 800
            display_kwargs["h"] = height if height > 0 else 600

        logger.info(f"Display kwargs: {display_kwargs}")

        try:
            self._display = pi3d.Display.create(**display_kwargs)
        except Exception as e:
            logger.error(f"Failed to create Pi3D display: {e}")
            raise RuntimeError(f"Pi3D display creation failed: {e}") from e

        # Apply background color
        self._display.set_background(*bg_rgb, 1.0)

        # Create 2D camera for image display
        # Rotation is handled by rotating sprites, not the camera
        self._camera = pi3d.Camera(is_3d=False)

        logger.info(
            f"Pi3D display created: {self._display.width}x{self._display.height}"
        )
        logger.info(f"FPS target: {self.config.fps_target}")
        logger.info(f"Background: {self.config.background_color}")

    def _register_cleanup(self) -> None:
        """Register cleanup handlers for graceful shutdown."""
        if self._cleanup_registered:
            return

        # Register atexit handler
        atexit.register(self.cleanup)

        # Register signal handlers
        signal.signal(signal.SIGTERM, self._signal_handler)
        signal.signal(signal.SIGINT, self._signal_handler)

        self._cleanup_registered = True
        logger.debug("Cleanup handlers registered")

    def _signal_handler(
        self, signum: int, frame: FrameType | None
    ) -> None:
        """Handle termination signals."""
        sig_name = signal.Signals(signum).name
        logger.info(f"Received signal {sig_name}, cleaning up...")
        self.cleanup()
        sys.exit(0)

    def set_background(self, color: str) -> None:
        """
        Set display background color.

        Args:
            color: Hex color string (e.g., "#000000")
        """
        # Validate and parse color
        if not color.startswith("#") or len(color) != 7:
            logger.warning(f"Invalid color '{color}', using black")
            color = "#000000"

        hex_color = color.lstrip("#")
        r = int(hex_color[0:2], 16) / 255.0
        g = int(hex_color[2:4], 16) / 255.0
        b = int(hex_color[4:6], 16) / 255.0

        if self._display:
            self._display.set_background(r, g, b, 1.0)
            logger.debug(f"Background set to {color}")

    def clear(self) -> None:
        """Clear the display buffer."""
        if self._display:
            self._display.clear()

    def swap_buffers(self) -> None:
        """Swap front and back buffers, completing a frame."""
        if self._display:
            self._display.swap_buffers()

    def stop(self) -> None:
        """Stop the display loop."""
        if self._display:
            self._display.stop()
            logger.info("Display stopped")

    def cleanup(self) -> None:
        """
        Clean up display resources.

        Destroys Pi3D display and releases GPU resources.
        Safe to call multiple times.
        """
        if not self._initialized:
            return

        logger.info("Cleaning up display resources...")

        try:
            if self._display:
                self._display.destroy()
                self._display = None
        except Exception as e:
            logger.error(f"Error during display cleanup: {e}")

        self._camera = None
        self._initialized = False
        logger.info("Display cleanup complete")

    @contextmanager
    def frame(self) -> Generator[None, None, None]:
        """
        Context manager for a single frame.

        Clears the display, yields for drawing, then swaps buffers.

        Usage:
            with display.frame():
                # draw sprites/shapes here
                pass
        """
        self.clear()
        yield
        self.swap_buffers()

    def __enter__(self) -> "Display":
        """Context manager entry - initialize display."""
        self.initialize()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """Context manager exit - cleanup display."""
        self.cleanup()


def create_display(config: DisplayConfig, mock: bool = False) -> Display:
    """
    Factory function to create a Display instance.

    Args:
        config: Display configuration
        mock: If True, use mock display for development

    Returns:
        Initialized Display instance
    """
    display = Display(config=config, mock=mock)
    display.initialize()
    return display
