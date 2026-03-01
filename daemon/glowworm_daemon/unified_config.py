"""
Unified Configuration for GlowWorm v3.0.

Provides a single YAML configuration file that covers both daemon and display settings.
Configuration can come from:
1. YAML file (e.g., /etc/glowworm/config.yaml)
2. Environment variables (prefixed with GLOWWORM_)
3. Direct instantiation with defaults

Example config.yaml:
```yaml
# Backend connection
backend:
  url: "https://glowworm.example.com"
  device_token: ""  # Set during registration
  websocket_url: ""  # Auto-derived from url if not set

# Display settings
display:
  orientation: portrait  # portrait or landscape
  rotation: 0  # 0, 90, 180, 270
  background_color: "#000000"
  fps_target: 30
  fullscreen: true
  width: 0  # 0 = auto-detect
  height: 0  # 0 = auto-detect

# Slideshow settings
slideshow:
  display_time: 30.0  # seconds per image
  transition_duration: 2.0  # seconds
  scale_mode: fit  # fit, fill, stretch
  preload_count: 3

# Cache settings
cache:
  directory: /var/cache/glowworm/images
  max_size_mb: 500
  min_free_space_mb: 100

# State persistence
state:
  directory: /var/lib/glowworm

# IPC settings
ipc:
  socket_path: /run/glowworm/display.sock
  timeout: 5.0

# Logging
logging:
  level: INFO  # DEBUG, INFO, WARNING, ERROR
  file: /var/log/glowworm/daemon.log

# CEC control
cec:
  enabled: false
  display_address: 0
  adapter: /dev/cec0
  timeout: 5
```
"""

import logging
import os
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Optional

import yaml

logger = logging.getLogger(__name__)


class ConfigurationError(Exception):
    """Raised when configuration is invalid."""
    pass


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


class ScaleMode(str, Enum):
    """Image scaling modes."""
    FIT = "fit"  # Fit image within display, letterbox/pillarbox as needed
    FILL = "fill"  # Fill display, crop as needed
    STRETCH = "stretch"  # Stretch to fit, may distort


@dataclass
class BackendConfig:
    """Backend connection configuration."""
    url: str = "http://localhost:3003"
    device_token: str = ""
    websocket_url: str = ""  # Auto-derived if empty
    connect_timeout: float = 10.0
    read_timeout: float = 30.0
    max_retries: int = 3
    retry_base_delay: float = 1.0
    retry_max_delay: float = 60.0

    @property
    def effective_websocket_url(self) -> str:
        """Get WebSocket URL, deriving from HTTP URL if not set."""
        if self.websocket_url:
            return self.websocket_url
        # Convert http(s) to ws(s)
        # Frontend proxies /api/* to backend, including WebSockets
        if self.url.startswith("https://"):
            return self.url.replace("https://", "wss://", 1) + "/api/ws/device"
        elif self.url.startswith("http://"):
            return self.url.replace("http://", "ws://", 1) + "/api/ws/device"
        return self.websocket_url


@dataclass
class DisplayConfig:
    """Display/rendering configuration."""
    orientation: Orientation = Orientation.PORTRAIT
    rotation: Rotation = Rotation.DEG_0
    background_color: str = "#000000"
    fps_target: int = 30
    fullscreen: bool = True
    width: int = 0  # 0 = auto-detect
    height: int = 0  # 0 = auto-detect

    def __post_init__(self):
        """Validate and normalize configuration values."""
        # Normalize orientation
        if isinstance(self.orientation, str):
            try:
                self.orientation = Orientation(self.orientation.lower())
            except ValueError:
                logger.warning(f"Invalid orientation '{self.orientation}', using portrait")
                self.orientation = Orientation.PORTRAIT

        # Normalize rotation
        if isinstance(self.rotation, int) and not isinstance(self.rotation, Rotation):
            try:
                self.rotation = Rotation(self.rotation)
            except ValueError:
                logger.warning(f"Invalid rotation {self.rotation}, using 0")
                self.rotation = Rotation.DEG_0

        # Validate background color format
        if not self.background_color.startswith("#") or len(self.background_color) != 7:
            logger.warning(f"Invalid background_color '{self.background_color}', using #000000")
            self.background_color = "#000000"

        # Validate fps_target
        if self.fps_target < 1:
            logger.warning("fps_target must be at least 1, using 30")
            self.fps_target = 30

    @property
    def background_rgb(self) -> tuple:
        """Get background color as RGB tuple (0.0-1.0 range for Pi3D)."""
        hex_color = self.background_color.lstrip("#")
        r = int(hex_color[0:2], 16) / 255.0
        g = int(hex_color[2:4], 16) / 255.0
        b = int(hex_color[4:6], 16) / 255.0
        return (r, g, b)

    def to_dict(self) -> dict:
        """Convert to dictionary for serialization."""
        return {
            "orientation": self.orientation.value,
            "rotation": self.rotation.value,
            "background_color": self.background_color,
            "fps_target": self.fps_target,
            "fullscreen": self.fullscreen,
            "width": self.width,
            "height": self.height,
        }


@dataclass
class SlideshowConfig:
    """Slideshow behavior configuration."""
    display_time: float = 30.0  # seconds per image
    transition_duration: float = 2.0  # seconds
    scale_mode: ScaleMode = ScaleMode.FIT
    preload_count: int = 3
    image_retry_delay: float = 2.0
    max_image_retries: int = 2
    playlist_update_interval: float = 300.0  # 5 minutes

    def __post_init__(self):
        """Validate and normalize configuration values."""
        # Normalize scale mode
        if isinstance(self.scale_mode, str):
            try:
                self.scale_mode = ScaleMode(self.scale_mode.lower())
            except ValueError:
                logger.warning(f"Invalid scale_mode '{self.scale_mode}', using fit")
                self.scale_mode = ScaleMode.FIT

        # Validate timing values
        if self.display_time <= 0:
            logger.warning("display_time must be positive, using 30.0")
            self.display_time = 30.0

        if self.transition_duration <= 0:
            logger.warning("transition_duration must be positive, using 2.0")
            self.transition_duration = 2.0

        if self.preload_count < 0:
            logger.warning("preload_count must be non-negative, using 3")
            self.preload_count = 3


@dataclass
class CacheConfig:
    """Image cache configuration."""
    directory: str = "/var/cache/glowworm/images"
    max_size_mb: int = 500
    min_free_space_mb: int = 100

    def __post_init__(self):
        """Validate cache configuration."""
        if self.max_size_mb < 10:
            logger.warning("max_size_mb must be at least 10, using 500")
            self.max_size_mb = 500

        if self.min_free_space_mb < 10:
            logger.warning("min_free_space_mb must be at least 10, using 100")
            self.min_free_space_mb = 100


@dataclass
class StateConfig:
    """State persistence configuration."""
    directory: str = "/var/lib/glowworm"


@dataclass
class IPCConfig:
    """IPC communication configuration."""
    socket_path: str = "/run/glowworm/display.sock"
    timeout: float = 5.0


@dataclass
class LoggingConfig:
    """Logging configuration."""
    level: str = "INFO"
    file: Optional[str] = "/var/log/glowworm/daemon.log"

    def __post_init__(self):
        """Validate logging configuration."""
        valid_levels = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        if self.level.upper() not in valid_levels:
            logger.warning(f"Invalid log level '{self.level}', using INFO")
            self.level = "INFO"
        else:
            self.level = self.level.upper()


@dataclass
class CECConfig:
    """HDMI-CEC control configuration."""
    enabled: bool = False
    display_address: int = 0
    adapter: str = "/dev/cec0"
    timeout: int = 5


@dataclass
class UnifiedConfig:
    """
    Complete unified configuration for GlowWorm daemon and display.

    This single configuration object contains all settings needed for the
    daemon, display engine, slideshow, caching, and communication.
    """
    backend: BackendConfig = field(default_factory=BackendConfig)
    display: DisplayConfig = field(default_factory=DisplayConfig)
    slideshow: SlideshowConfig = field(default_factory=SlideshowConfig)
    cache: CacheConfig = field(default_factory=CacheConfig)
    state: StateConfig = field(default_factory=StateConfig)
    ipc: IPCConfig = field(default_factory=IPCConfig)
    logging: LoggingConfig = field(default_factory=LoggingConfig)
    cec: CECConfig = field(default_factory=CECConfig)

    # Source information (not a config field)
    _source_path: Optional[str] = field(default=None, repr=False)

    def validate(self) -> list:
        """
        Validate the configuration and return any errors.

        Returns:
            List of error messages (empty if valid)
        """
        errors = []

        # Backend URL is required
        if not self.backend.url:
            errors.append("backend.url is required")

        # Device token required for normal operation (empty allowed for registration)
        # This is a warning, not an error
        if not self.backend.device_token:
            logger.info("No device_token configured - device registration required")

        return errors

    def to_dict(self) -> dict:
        """Convert configuration to dictionary for serialization."""
        return {
            "backend": {
                "url": self.backend.url,
                "device_token": self.backend.device_token,
                "websocket_url": self.backend.websocket_url,
                "connect_timeout": self.backend.connect_timeout,
                "read_timeout": self.backend.read_timeout,
                "max_retries": self.backend.max_retries,
                "retry_base_delay": self.backend.retry_base_delay,
                "retry_max_delay": self.backend.retry_max_delay,
            },
            "display": self.display.to_dict(),
            "slideshow": {
                "display_time": self.slideshow.display_time,
                "transition_duration": self.slideshow.transition_duration,
                "scale_mode": self.slideshow.scale_mode.value,
                "preload_count": self.slideshow.preload_count,
                "image_retry_delay": self.slideshow.image_retry_delay,
                "max_image_retries": self.slideshow.max_image_retries,
                "playlist_update_interval": self.slideshow.playlist_update_interval,
            },
            "cache": {
                "directory": self.cache.directory,
                "max_size_mb": self.cache.max_size_mb,
                "min_free_space_mb": self.cache.min_free_space_mb,
            },
            "state": {
                "directory": self.state.directory,
            },
            "ipc": {
                "socket_path": self.ipc.socket_path,
                "timeout": self.ipc.timeout,
            },
            "logging": {
                "level": self.logging.level,
                "file": self.logging.file,
            },
            "cec": {
                "enabled": self.cec.enabled,
                "display_address": self.cec.display_address,
                "adapter": self.cec.adapter,
                "timeout": self.cec.timeout,
            },
        }

    def get_display_config_json(self) -> str:
        """
        Get display configuration as JSON for passing to Pi3D subprocess.

        Returns:
            JSON string with display-relevant configuration
        """
        import json
        display_config = {
            "display": self.display.to_dict(),
            "slideshow": {
                "transition_duration": self.slideshow.transition_duration,
            },
            "ipc": {
                "socket_path": self.ipc.socket_path,
                "timeout": self.ipc.timeout,
            },
            "logging": {
                "level": self.logging.level,
                "file": self.logging.file,
            },
        }
        return json.dumps(display_config)


# Default config file paths
DEFAULT_CONFIG_PATHS = [
    "/etc/glowworm/config.yaml",
    Path.home() / ".config" / "glowworm" / "config.yaml",
    Path.cwd() / "config.yaml",
]


def _parse_backend_section(data: dict) -> BackendConfig:
    """Parse backend section from YAML data."""
    section = data.get("backend", {})
    return BackendConfig(
        url=section.get("url", "http://localhost:3003"),
        device_token=section.get("device_token", ""),
        websocket_url=section.get("websocket_url", ""),
        connect_timeout=float(section.get("connect_timeout", 10.0)),
        read_timeout=float(section.get("read_timeout", 30.0)),
        max_retries=int(section.get("max_retries", 3)),
        retry_base_delay=float(section.get("retry_base_delay", 1.0)),
        retry_max_delay=float(section.get("retry_max_delay", 60.0)),
    )


def _parse_display_section(data: dict) -> DisplayConfig:
    """Parse display section from YAML data."""
    section = data.get("display", {})
    return DisplayConfig(
        orientation=section.get("orientation", "portrait"),
        rotation=section.get("rotation", 0),
        background_color=section.get("background_color", "#000000"),
        fps_target=int(section.get("fps_target", 30)),
        fullscreen=bool(section.get("fullscreen", True)),
        width=int(section.get("width", 0)),
        height=int(section.get("height", 0)),
    )


def _parse_slideshow_section(data: dict) -> SlideshowConfig:
    """Parse slideshow section from YAML data."""
    section = data.get("slideshow", {})
    return SlideshowConfig(
        display_time=float(section.get("display_time", 30.0)),
        transition_duration=float(section.get("transition_duration", 2.0)),
        scale_mode=section.get("scale_mode", "fit"),
        preload_count=int(section.get("preload_count", 3)),
        image_retry_delay=float(section.get("image_retry_delay", 2.0)),
        max_image_retries=int(section.get("max_image_retries", 2)),
        playlist_update_interval=float(section.get("playlist_update_interval", 300.0)),
    )


def _parse_cache_section(data: dict) -> CacheConfig:
    """Parse cache section from YAML data."""
    section = data.get("cache", {})
    return CacheConfig(
        directory=section.get("directory", "/var/cache/glowworm/images"),
        max_size_mb=int(section.get("max_size_mb", 500)),
        min_free_space_mb=int(section.get("min_free_space_mb", 100)),
    )


def _parse_state_section(data: dict) -> StateConfig:
    """Parse state section from YAML data."""
    section = data.get("state", {})
    return StateConfig(
        directory=section.get("directory", "/var/lib/glowworm"),
    )


def _parse_ipc_section(data: dict) -> IPCConfig:
    """Parse IPC section from YAML data."""
    section = data.get("ipc", {})
    return IPCConfig(
        socket_path=section.get("socket_path", "/run/glowworm/display.sock"),
        timeout=float(section.get("timeout", 5.0)),
    )


def _parse_logging_section(data: dict) -> LoggingConfig:
    """Parse logging section from YAML data."""
    section = data.get("logging", {})
    return LoggingConfig(
        level=section.get("level", "INFO"),
        file=section.get("file", "/var/log/glowworm/daemon.log"),
    )


def _parse_cec_section(data: dict) -> CECConfig:
    """Parse CEC section from YAML data."""
    section = data.get("cec", {})
    return CECConfig(
        enabled=bool(section.get("enabled", False)),
        display_address=int(section.get("display_address", 0)),
        adapter=section.get("adapter", "/dev/cec0"),
        timeout=int(section.get("timeout", 5)),
    )


def _apply_env_overrides(config: UnifiedConfig) -> None:
    """Apply environment variable overrides to configuration."""
    env_mappings = {
        # Backend
        "GLOWWORM_BACKEND_URL": ("backend", "url", str),
        "GLOWWORM_DEVICE_TOKEN": ("backend", "device_token", str),
        # Display
        "GLOWWORM_DISPLAY_ORIENTATION": ("display", "orientation", str),
        "GLOWWORM_DISPLAY_ROTATION": ("display", "rotation", int),
        "GLOWWORM_DISPLAY_BACKGROUND_COLOR": ("display", "background_color", str),
        "GLOWWORM_DISPLAY_FPS_TARGET": ("display", "fps_target", int),
        # Slideshow
        "GLOWWORM_SLIDESHOW_DISPLAY_TIME": ("slideshow", "display_time", float),
        "GLOWWORM_SLIDESHOW_TRANSITION_DURATION": ("slideshow", "transition_duration", float),
        "GLOWWORM_SLIDESHOW_SCALE_MODE": ("slideshow", "scale_mode", str),
        # Cache
        "GLOWWORM_CACHE_DIRECTORY": ("cache", "directory", str),
        "GLOWWORM_CACHE_MAX_SIZE_MB": ("cache", "max_size_mb", int),
        # IPC
        "GLOWWORM_IPC_SOCKET_PATH": ("ipc", "socket_path", str),
        # Logging
        "GLOWWORM_LOG_LEVEL": ("logging", "level", str),
        "GLOWWORM_LOG_FILE": ("logging", "file", str),
        # CEC
        "GLOWWORM_CEC_ENABLED": ("cec", "enabled", lambda x: x.lower() in ("true", "1", "yes")),
    }

    for env_var, (section, attr, converter) in env_mappings.items():
        value = os.environ.get(env_var)
        if value is not None:
            try:
                section_obj = getattr(config, section)
                setattr(section_obj, attr, converter(value))
                logger.debug(f"Override from env: {section}.{attr}={converter(value)}")
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid env var {env_var}={value}: {e}")


def load_config(config_path: Optional[str] = None) -> UnifiedConfig:
    """
    Load unified configuration from YAML file.

    Args:
        config_path: Path to configuration file. If None, searches default locations.

    Returns:
        UnifiedConfig instance

    Raises:
        ConfigurationError: If configuration is invalid
        FileNotFoundError: If config file specified but not found
    """
    # Find config file
    actual_path = None
    if config_path is not None:
        actual_path = Path(config_path)
        if not actual_path.exists():
            raise FileNotFoundError(f"Configuration file not found: {config_path}")
    else:
        for path in DEFAULT_CONFIG_PATHS:
            if Path(path).exists():
                actual_path = Path(path)
                break

    # Load YAML if found
    data = {}
    if actual_path is not None:
        logger.info(f"Loading configuration from: {actual_path}")
        with open(actual_path, "r") as f:
            data = yaml.safe_load(f) or {}
    else:
        logger.info("No config file found, using defaults")

    # Parse sections
    config = UnifiedConfig(
        backend=_parse_backend_section(data),
        display=_parse_display_section(data),
        slideshow=_parse_slideshow_section(data),
        cache=_parse_cache_section(data),
        state=_parse_state_section(data),
        ipc=_parse_ipc_section(data),
        logging=_parse_logging_section(data),
        cec=_parse_cec_section(data),
        _source_path=str(actual_path) if actual_path else None,
    )

    # Apply environment overrides
    _apply_env_overrides(config)

    # Validate
    errors = config.validate()
    if errors:
        raise ConfigurationError(f"Configuration errors: {'; '.join(errors)}")

    return config


def create_default_config(output_path: str) -> None:
    """
    Create a default configuration file.

    Args:
        output_path: Path where configuration file should be created
    """
    # Ensure directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    config_content = """\
# GlowWorm v3.0 Configuration
# See documentation for full options: https://github.com/your-repo/glowworm

# Backend connection
backend:
  url: "http://localhost:3003"
  device_token: ""  # Set during device registration
  # websocket_url: ""  # Auto-derived from url if not set

# Display settings
display:
  orientation: portrait  # portrait or landscape
  rotation: 0  # 0, 90, 180, 270
  background_color: "#000000"
  fps_target: 30
  fullscreen: true
  # width: 0  # 0 = auto-detect
  # height: 0  # 0 = auto-detect

# Slideshow settings
slideshow:
  display_time: 30.0  # seconds per image
  transition_duration: 2.0  # seconds
  scale_mode: fit  # fit, fill, stretch
  preload_count: 3

# Cache settings
cache:
  directory: /var/cache/glowworm/images
  max_size_mb: 500
  min_free_space_mb: 100

# State persistence
state:
  directory: /var/lib/glowworm

# IPC settings
ipc:
  socket_path: /run/glowworm/display.sock
  timeout: 5.0

# Logging
logging:
  level: INFO  # DEBUG, INFO, WARNING, ERROR
  file: /var/log/glowworm/daemon.log

# CEC control (HDMI power management)
cec:
  enabled: false
  display_address: 0
  adapter: /dev/cec0
  timeout: 5
"""

    with open(output_path, "w") as f:
        f.write(config_content)

    logger.info(f"Created default configuration file: {output_path}")


def save_config(config: UnifiedConfig, output_path: str) -> None:
    """
    Save configuration to YAML file.

    Args:
        config: Configuration to save
        output_path: Path where configuration file should be written
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, "w") as f:
        yaml.dump(config.to_dict(), f, default_flow_style=False, sort_keys=False)

    logger.info(f"Saved configuration to: {output_path}")


if __name__ == "__main__":
    # Test configuration loading
    import sys

    logging.basicConfig(level=logging.DEBUG)

    # Test default config
    config = UnifiedConfig()
    print(f"Default config created")
    print(f"Backend URL: {config.backend.url}")
    print(f"Display orientation: {config.display.orientation}")
    print(f"Display RGB: {config.display.background_rgb}")

    # Test to_dict
    print(f"\nConfig dict keys: {list(config.to_dict().keys())}")

    # Test display config JSON
    print(f"\nDisplay config JSON:")
    print(config.get_display_config_json())

    # Test creating default config
    test_path = "/tmp/test_glowworm_config.yaml"
    create_default_config(test_path)
    print(f"\nCreated default config at: {test_path}")

    # Test loading
    loaded = load_config(test_path)
    print(f"Loaded config backend URL: {loaded.backend.url}")

    print("\nConfiguration test completed successfully!")
