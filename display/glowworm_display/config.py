"""
Configuration management for GlowWorm Display Engine.

Uses dataclasses for type-safe configuration with YAML loading support.
Configuration can come from:
1. YAML file (e.g., /etc/glowworm/config.yaml)
2. Environment variables (prefixed with GLOWWORM_DISPLAY_)
3. Direct instantiation with defaults
"""

import logging
import os
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger(__name__)


class Orientation(str, Enum):
    """Display orientation modes."""

    PORTRAIT = "portrait"
    LANDSCAPE = "landscape"


class Rotation(int, Enum):
    """Display rotation angles."""

    DEG_0 = 0
    DEG_90 = 90
    DEG_180 = 180
    DEG_270 = 270


@dataclass
class DisplayConfig:
    """
    Configuration for the Pi3D display engine.

    Attributes:
        orientation: Display orientation (portrait or landscape)
        rotation: Display rotation in degrees (0, 90, 180, 270)
        background_color: Background color as hex string (e.g., "#000000")
        transition_duration: Duration of cross-fade transitions in seconds
        image_duration: How long each image displays before transitioning
        fps_target: Target frames per second for rendering
        fullscreen: Whether to run in fullscreen mode
        width: Display width in pixels (0 = auto-detect)
        height: Display height in pixels (0 = auto-detect)
    """

    orientation: Orientation = Orientation.PORTRAIT
    rotation: Rotation = Rotation.DEG_0
    background_color: str = "#000000"
    transition_duration: float = 2.0
    image_duration: float = 30.0
    fps_target: int = 30
    fullscreen: bool = True
    width: int = 0
    height: int = 0

    def __post_init__(self) -> None:
        """Validate and normalize configuration values."""
        # Normalize orientation
        if isinstance(self.orientation, str):
            try:
                self.orientation = Orientation(self.orientation.lower())
            except ValueError:
                logger.warning(
                    f"Invalid orientation '{self.orientation}', using portrait"
                )
                self.orientation = Orientation.PORTRAIT

        # Normalize rotation
        if isinstance(self.rotation, int):
            try:
                self.rotation = Rotation(self.rotation)
            except ValueError:
                logger.warning(
                    f"Invalid rotation {self.rotation}, using 0"
                )
                self.rotation = Rotation.DEG_0

        # Validate background color format
        if not self.background_color.startswith("#") or len(self.background_color) != 7:
            logger.warning(
                f"Invalid background_color '{self.background_color}', using #000000"
            )
            self.background_color = "#000000"

        # Validate timing values
        if self.transition_duration <= 0:
            logger.warning("transition_duration must be positive, using 2.0")
            self.transition_duration = 2.0

        if self.image_duration <= 0:
            logger.warning("image_duration must be positive, using 30.0")
            self.image_duration = 30.0

        if self.fps_target < 1:
            logger.warning("fps_target must be at least 1, using 30")
            self.fps_target = 30

    @property
    def background_rgb(self) -> tuple[float, float, float]:
        """Get background color as RGB tuple (0.0-1.0 range for Pi3D)."""
        hex_color = self.background_color.lstrip("#")
        r = int(hex_color[0:2], 16) / 255.0
        g = int(hex_color[2:4], 16) / 255.0
        b = int(hex_color[4:6], 16) / 255.0
        return (r, g, b)

    @property
    def effective_rotation(self) -> int:
        """Get effective rotation considering orientation."""
        return self.rotation.value

    def to_dict(self) -> dict[str, Any]:
        """Convert configuration to dictionary."""
        return {
            "orientation": self.orientation.value,
            "rotation": self.rotation.value,
            "background_color": self.background_color,
            "transition_duration": self.transition_duration,
            "image_duration": self.image_duration,
            "fps_target": self.fps_target,
            "fullscreen": self.fullscreen,
            "width": self.width,
            "height": self.height,
        }


@dataclass
class IPCConfig:
    """
    Configuration for IPC server.

    Attributes:
        socket_path: Path to Unix domain socket for IPC
        timeout: Timeout for IPC operations in seconds
    """

    socket_path: str = "/run/glowworm/display.sock"
    timeout: float = 5.0


@dataclass
class LoggingConfig:
    """
    Configuration for logging.

    Attributes:
        level: Log level (DEBUG, INFO, WARNING, ERROR)
        file: Optional log file path
    """

    level: str = "INFO"
    file: str | None = None


@dataclass
class FullConfig:
    """
    Complete configuration for the display engine.

    Combines display, IPC, and logging configuration.
    """

    display: DisplayConfig = field(default_factory=DisplayConfig)
    ipc: IPCConfig = field(default_factory=IPCConfig)
    logging: LoggingConfig = field(default_factory=LoggingConfig)


# Default config file paths
DEFAULT_CONFIG_PATHS = [
    "/etc/glowworm/config.yaml",
    Path.home() / ".config" / "glowworm" / "config.yaml",
    Path.cwd() / "config.yaml",
]


def load_config(config_path: str | Path | None = None) -> DisplayConfig:
    """
    Load display configuration from YAML file.

    Args:
        config_path: Path to configuration file. If None, searches default locations.

    Returns:
        DisplayConfig instance

    Raises:
        FileNotFoundError: If config file not found
        ValueError: If config file is invalid
    """
    # Find config file
    if config_path is None:
        for path in DEFAULT_CONFIG_PATHS:
            if Path(path).exists():
                config_path = path
                break

    if config_path is None:
        logger.info("No config file found, using defaults")
        return DisplayConfig()

    config_path = Path(config_path)
    if not config_path.exists():
        raise FileNotFoundError(f"Configuration file not found: {config_path}")

    logger.info(f"Loading configuration from: {config_path}")

    # Load YAML
    with open(config_path, "r") as f:
        data = yaml.safe_load(f) or {}

    # Extract display section
    display_data = data.get("display", {})

    # Apply environment variable overrides
    display_data = _apply_env_overrides(display_data)

    return DisplayConfig(
        orientation=display_data.get("orientation", "portrait"),
        rotation=display_data.get("rotation", 0),
        background_color=display_data.get("background_color", "#000000"),
        transition_duration=display_data.get("transition_duration", 2.0),
        image_duration=display_data.get("image_duration", 30.0),
        fps_target=display_data.get("fps_target", 30),
        fullscreen=display_data.get("fullscreen", True),
        width=display_data.get("width", 0),
        height=display_data.get("height", 0),
    )


def load_full_config(config_path: str | Path | None = None) -> FullConfig:
    """
    Load complete configuration from YAML file.

    Args:
        config_path: Path to configuration file. If None, searches default locations.

    Returns:
        FullConfig instance with display, IPC, and logging configuration
    """
    # Find config file
    if config_path is None:
        for path in DEFAULT_CONFIG_PATHS:
            if Path(path).exists():
                config_path = path
                break

    if config_path is None:
        logger.info("No config file found, using defaults")
        return FullConfig()

    config_path = Path(config_path)
    if not config_path.exists():
        raise FileNotFoundError(f"Configuration file not found: {config_path}")

    logger.info(f"Loading full configuration from: {config_path}")

    # Load YAML
    with open(config_path, "r") as f:
        data = yaml.safe_load(f) or {}

    # Build configuration objects
    display_data = _apply_env_overrides(data.get("display", {}))
    ipc_data = data.get("ipc", {})
    logging_data = data.get("logging", {})

    return FullConfig(
        display=DisplayConfig(
            orientation=display_data.get("orientation", "portrait"),
            rotation=display_data.get("rotation", 0),
            background_color=display_data.get("background_color", "#000000"),
            transition_duration=display_data.get("transition_duration", 2.0),
            image_duration=display_data.get("image_duration", 30.0),
            fps_target=display_data.get("fps_target", 30),
            fullscreen=display_data.get("fullscreen", True),
            width=display_data.get("width", 0),
            height=display_data.get("height", 0),
        ),
        ipc=IPCConfig(
            socket_path=ipc_data.get("socket_path", "/run/glowworm/display.sock"),
            timeout=ipc_data.get("timeout", 5.0),
        ),
        logging=LoggingConfig(
            level=logging_data.get("level", "INFO"),
            file=logging_data.get("file"),
        ),
    )


def _apply_env_overrides(display_data: dict[str, Any]) -> dict[str, Any]:
    """Apply environment variable overrides to display configuration."""
    env_mappings = {
        "GLOWWORM_DISPLAY_ORIENTATION": ("orientation", str),
        "GLOWWORM_DISPLAY_ROTATION": ("rotation", int),
        "GLOWWORM_DISPLAY_BACKGROUND_COLOR": ("background_color", str),
        "GLOWWORM_DISPLAY_TRANSITION_DURATION": ("transition_duration", float),
        "GLOWWORM_DISPLAY_IMAGE_DURATION": ("image_duration", float),
        "GLOWWORM_DISPLAY_FPS_TARGET": ("fps_target", int),
        "GLOWWORM_DISPLAY_FULLSCREEN": ("fullscreen", lambda x: x.lower() == "true"),
        "GLOWWORM_DISPLAY_WIDTH": ("width", int),
        "GLOWWORM_DISPLAY_HEIGHT": ("height", int),
    }

    result = display_data.copy()
    for env_var, (key, converter) in env_mappings.items():
        value = os.environ.get(env_var)
        if value is not None:
            try:
                result[key] = converter(value)
                logger.debug(f"Override from env: {key}={result[key]}")
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid env var {env_var}={value}: {e}")

    return result


def load_config_from_env() -> FullConfig | None:
    """
    Load configuration from GLOWWORM_DISPLAY_CONFIG environment variable.

    The daemon passes display configuration as JSON via this environment
    variable when spawning the display subprocess.

    Returns:
        FullConfig if GLOWWORM_DISPLAY_CONFIG is set and valid, None otherwise
    """
    import json

    env_config = os.environ.get("GLOWWORM_DISPLAY_CONFIG")
    if not env_config:
        return None

    try:
        data = json.loads(env_config)
        logger.info("Loading configuration from GLOWWORM_DISPLAY_CONFIG environment")

        display_data = data.get("display", {})
        slideshow_data = data.get("slideshow", {})
        ipc_data = data.get("ipc", {})
        logging_data = data.get("logging", {})

        return FullConfig(
            display=DisplayConfig(
                orientation=display_data.get("orientation", "portrait"),
                rotation=display_data.get("rotation", 0),
                background_color=display_data.get("background_color", "#000000"),
                # Use slideshow transition_duration if available
                transition_duration=slideshow_data.get(
                    "transition_duration",
                    display_data.get("transition_duration", 2.0)
                ),
                image_duration=display_data.get("image_duration", 30.0),
                fps_target=display_data.get("fps_target", 30),
                fullscreen=display_data.get("fullscreen", True),
                width=display_data.get("width", 0),
                height=display_data.get("height", 0),
            ),
            ipc=IPCConfig(
                socket_path=ipc_data.get("socket_path", "/run/glowworm/display.sock"),
                timeout=ipc_data.get("timeout", 5.0),
            ),
            logging=LoggingConfig(
                level=logging_data.get("level", "INFO"),
                file=logging_data.get("file"),
            ),
        )
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in GLOWWORM_DISPLAY_CONFIG: {e}")
        return None
    except Exception as e:
        logger.error(f"Error parsing GLOWWORM_DISPLAY_CONFIG: {e}")
        return None


def load_config_auto(config_path: str | Path | None = None) -> FullConfig:
    """
    Load configuration automatically from best available source.

    Order of precedence:
    1. GLOWWORM_DISPLAY_CONFIG environment variable (from daemon)
    2. Specified config_path
    3. Default config file locations
    4. Built-in defaults

    Args:
        config_path: Optional path to configuration file

    Returns:
        FullConfig instance
    """
    # Try environment variable first (passed by daemon)
    env_config = load_config_from_env()
    if env_config:
        return env_config

    # Fall back to file-based loading
    return load_full_config(config_path)


if __name__ == "__main__":
    # Test configuration loading
    logging.basicConfig(level=logging.DEBUG)

    # Test default config
    config = DisplayConfig()
    print(f"Default config: {config}")
    print(f"Background RGB: {config.background_rgb}")

    # Test with custom values
    custom = DisplayConfig(
        orientation="landscape",
        rotation=90,
        background_color="#1a1a1a",
        transition_duration=3.0,
    )
    print(f"Custom config: {custom}")
    print(f"Config dict: {custom.to_dict()}")
