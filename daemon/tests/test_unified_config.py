"""
Tests for unified configuration system (Task 3.3).

Tests:
- Configuration loads from /etc/glowworm/config.yaml
- Missing optional values use sensible defaults
- Invalid configuration raises clear error message
- Display receives correct orientation/timing settings
"""
import json
import os
import tempfile
from pathlib import Path

import pytest
import yaml

from glowworm_daemon.unified_config import (
    UnifiedConfig,
    BackendConfig,
    DisplayConfig,
    SlideshowConfig,
    CacheConfig,
    StateConfig,
    IPCConfig,
    LoggingConfig,
    CECConfig,
    Orientation,
    Rotation,
    ScaleMode,
    ConfigurationError,
    load_config,
    create_default_config,
    save_config,
)


class TestDefaultConfiguration:
    """Test default configuration values."""

    def test_unified_config_defaults(self):
        """UnifiedConfig has sensible defaults."""
        config = UnifiedConfig()

        assert config.backend.url == "http://localhost:3003"
        assert config.backend.device_token == ""
        assert config.display.orientation == Orientation.PORTRAIT
        assert config.display.rotation == Rotation.DEG_0
        assert config.display.background_color == "#000000"
        assert config.display.fps_target == 30
        assert config.slideshow.display_time == 30.0
        assert config.slideshow.transition_duration == 2.0
        assert config.slideshow.scale_mode == ScaleMode.FIT
        assert config.cache.max_size_mb == 500
        assert config.ipc.socket_path == "/run/glowworm/display.sock"
        assert config.logging.level == "INFO"
        assert config.cec.enabled is False

    def test_backend_config_defaults(self):
        """BackendConfig has sensible defaults."""
        config = BackendConfig()

        assert config.url == "http://localhost:3003"
        assert config.device_token == ""
        assert config.connect_timeout == 10.0
        assert config.max_retries == 3

    def test_display_config_defaults(self):
        """DisplayConfig has sensible defaults."""
        config = DisplayConfig()

        assert config.orientation == Orientation.PORTRAIT
        assert config.rotation == Rotation.DEG_0
        assert config.background_color == "#000000"
        assert config.fps_target == 30
        assert config.fullscreen is True

    def test_slideshow_config_defaults(self):
        """SlideshowConfig has sensible defaults."""
        config = SlideshowConfig()

        assert config.display_time == 30.0
        assert config.transition_duration == 2.0
        assert config.scale_mode == ScaleMode.FIT
        assert config.preload_count == 3


class TestConfigurationValidation:
    """Test configuration validation."""

    def test_display_config_normalizes_orientation_string(self):
        """DisplayConfig accepts string orientation."""
        config = DisplayConfig(orientation="landscape")
        assert config.orientation == Orientation.LANDSCAPE

    def test_display_config_normalizes_rotation_int(self):
        """DisplayConfig accepts int rotation."""
        config = DisplayConfig(rotation=90)
        assert config.rotation == Rotation.DEG_90

    def test_display_config_invalid_orientation_uses_default(self):
        """DisplayConfig uses default for invalid orientation."""
        config = DisplayConfig(orientation="invalid")
        assert config.orientation == Orientation.PORTRAIT

    def test_display_config_invalid_rotation_uses_default(self):
        """DisplayConfig uses default for invalid rotation."""
        config = DisplayConfig(rotation=45)
        assert config.rotation == Rotation.DEG_0

    def test_display_config_invalid_background_color_uses_default(self):
        """DisplayConfig uses default for invalid background color."""
        config = DisplayConfig(background_color="red")
        assert config.background_color == "#000000"

    def test_display_config_invalid_fps_target_uses_default(self):
        """DisplayConfig uses default for invalid fps_target."""
        config = DisplayConfig(fps_target=0)
        assert config.fps_target == 30

    def test_slideshow_config_normalizes_scale_mode_string(self):
        """SlideshowConfig accepts string scale mode."""
        config = SlideshowConfig(scale_mode="fill")
        assert config.scale_mode == ScaleMode.FILL

    def test_slideshow_config_invalid_display_time_uses_default(self):
        """SlideshowConfig uses default for invalid display_time."""
        config = SlideshowConfig(display_time=-5)
        assert config.display_time == 30.0

    def test_logging_config_invalid_level_uses_default(self):
        """LoggingConfig uses default for invalid level."""
        config = LoggingConfig(level="VERBOSE")
        assert config.level == "INFO"

    def test_logging_config_normalizes_level_case(self):
        """LoggingConfig normalizes level to uppercase."""
        config = LoggingConfig(level="debug")
        assert config.level == "DEBUG"


class TestYAMLLoading:
    """Test loading configuration from YAML files."""

    def test_load_config_from_yaml(self, tmp_path):
        """Can load configuration from YAML file."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text("""
backend:
  url: "https://glowworm.example.com"
  device_token: "test-token-123"

display:
  orientation: landscape
  rotation: 180
  background_color: "#1a1a1a"
  fps_target: 60

slideshow:
  display_time: 60.0
  transition_duration: 3.0
  scale_mode: fill

cache:
  directory: /tmp/test-cache
  max_size_mb: 1000

logging:
  level: DEBUG
  file: /tmp/test.log

cec:
  enabled: true
  display_address: 1
""")

        config = load_config(str(config_file))

        assert config.backend.url == "https://glowworm.example.com"
        assert config.backend.device_token == "test-token-123"
        assert config.display.orientation == Orientation.LANDSCAPE
        assert config.display.rotation == Rotation.DEG_180
        assert config.display.background_color == "#1a1a1a"
        assert config.display.fps_target == 60
        assert config.slideshow.display_time == 60.0
        assert config.slideshow.transition_duration == 3.0
        assert config.slideshow.scale_mode == ScaleMode.FILL
        assert config.cache.directory == "/tmp/test-cache"
        assert config.cache.max_size_mb == 1000
        assert config.logging.level == "DEBUG"
        assert config.logging.file == "/tmp/test.log"
        assert config.cec.enabled is True
        assert config.cec.display_address == 1

    def test_load_config_missing_sections_uses_defaults(self, tmp_path):
        """Missing sections use default values."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text("""
backend:
  url: "https://example.com"
""")

        config = load_config(str(config_file))

        # Explicitly set value
        assert config.backend.url == "https://example.com"

        # Default values for missing sections
        assert config.display.orientation == Orientation.PORTRAIT
        assert config.slideshow.display_time == 30.0
        assert config.cache.max_size_mb == 500
        assert config.logging.level == "INFO"
        assert config.cec.enabled is False

    def test_load_config_empty_file_uses_defaults(self, tmp_path):
        """Empty config file uses all defaults."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text("")

        config = load_config(str(config_file))

        assert config.backend.url == "http://localhost:3003"
        assert config.display.orientation == Orientation.PORTRAIT

    def test_load_config_file_not_found_raises_error(self, tmp_path):
        """Missing config file raises FileNotFoundError."""
        with pytest.raises(FileNotFoundError):
            load_config(str(tmp_path / "nonexistent.yaml"))

    def test_load_config_no_path_returns_defaults(self, tmp_path, monkeypatch):
        """No config path returns defaults when no files exist."""
        # Ensure no config files exist in default locations
        monkeypatch.chdir(tmp_path)

        config = load_config(None)

        assert config.backend.url == "http://localhost:3003"


class TestEnvironmentOverrides:
    """Test environment variable overrides."""

    def test_backend_url_override(self, tmp_path, monkeypatch):
        """GLOWWORM_BACKEND_URL overrides config file."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text("""
backend:
  url: "https://original.com"
""")

        monkeypatch.setenv("GLOWWORM_BACKEND_URL", "https://override.com")

        config = load_config(str(config_file))

        assert config.backend.url == "https://override.com"

    def test_device_token_override(self, tmp_path, monkeypatch):
        """GLOWWORM_DEVICE_TOKEN overrides config file."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text("""
backend:
  url: "https://example.com"
  device_token: "original-token"
""")

        monkeypatch.setenv("GLOWWORM_DEVICE_TOKEN", "override-token")

        config = load_config(str(config_file))

        assert config.backend.device_token == "override-token"

    def test_display_orientation_override(self, tmp_path, monkeypatch):
        """GLOWWORM_DISPLAY_ORIENTATION overrides config file."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text("""
backend:
  url: "https://example.com"
display:
  orientation: portrait
""")

        monkeypatch.setenv("GLOWWORM_DISPLAY_ORIENTATION", "landscape")

        config = load_config(str(config_file))

        assert config.display.orientation == Orientation.LANDSCAPE

    def test_log_level_override(self, tmp_path, monkeypatch):
        """GLOWWORM_LOG_LEVEL overrides config file."""
        config_file = tmp_path / "config.yaml"
        config_file.write_text("""
backend:
  url: "https://example.com"
logging:
  level: INFO
""")

        monkeypatch.setenv("GLOWWORM_LOG_LEVEL", "DEBUG")

        config = load_config(str(config_file))

        assert config.logging.level == "DEBUG"


class TestConfigSerialization:
    """Test configuration serialization."""

    def test_to_dict_includes_all_sections(self):
        """to_dict() includes all configuration sections."""
        config = UnifiedConfig()
        data = config.to_dict()

        assert "backend" in data
        assert "display" in data
        assert "slideshow" in data
        assert "cache" in data
        assert "state" in data
        assert "ipc" in data
        assert "logging" in data
        assert "cec" in data

    def test_get_display_config_json_format(self):
        """get_display_config_json() returns valid JSON."""
        config = UnifiedConfig()
        json_str = config.get_display_config_json()

        data = json.loads(json_str)

        assert "display" in data
        assert "slideshow" in data
        assert "ipc" in data
        assert "logging" in data

    def test_get_display_config_json_includes_key_settings(self):
        """get_display_config_json() includes display-relevant settings."""
        config = UnifiedConfig(
            display=DisplayConfig(
                orientation="landscape",
                rotation=90,
                background_color="#ffffff",
            ),
            slideshow=SlideshowConfig(transition_duration=5.0),
            ipc=IPCConfig(socket_path="/tmp/test.sock"),
        )

        json_str = config.get_display_config_json()
        data = json.loads(json_str)

        assert data["display"]["orientation"] == "landscape"
        assert data["display"]["rotation"] == 90
        assert data["display"]["background_color"] == "#ffffff"
        assert data["slideshow"]["transition_duration"] == 5.0
        assert data["ipc"]["socket_path"] == "/tmp/test.sock"

    def test_save_and_load_roundtrip(self, tmp_path):
        """Configuration can be saved and loaded."""
        original = UnifiedConfig(
            backend=BackendConfig(url="https://test.com", device_token="token-123"),
            display=DisplayConfig(orientation="landscape", rotation=90),
            slideshow=SlideshowConfig(display_time=45.0),
        )

        config_file = str(tmp_path / "config.yaml")
        save_config(original, config_file)

        loaded = load_config(config_file)

        assert loaded.backend.url == original.backend.url
        assert loaded.backend.device_token == original.backend.device_token
        assert loaded.display.orientation == original.display.orientation
        assert loaded.display.rotation == original.display.rotation
        assert loaded.slideshow.display_time == original.slideshow.display_time


class TestDefaultConfigCreation:
    """Test creating default configuration files."""

    def test_create_default_config(self, tmp_path):
        """create_default_config creates a valid YAML file."""
        config_file = str(tmp_path / "config.yaml")
        create_default_config(config_file)

        assert os.path.exists(config_file)

        # Verify it's valid YAML
        with open(config_file) as f:
            data = yaml.safe_load(f)

        assert "backend" in data
        assert "display" in data
        assert "slideshow" in data
        assert "cache" in data
        assert "ipc" in data
        assert "logging" in data
        assert "cec" in data

    def test_create_default_config_creates_directories(self, tmp_path):
        """create_default_config creates parent directories."""
        config_file = str(tmp_path / "nested" / "dir" / "config.yaml")
        create_default_config(config_file)

        assert os.path.exists(config_file)


class TestBackendConfigHelpers:
    """Test BackendConfig helper methods."""

    def test_effective_websocket_url_from_http(self):
        """Derives ws:// from http:// URL."""
        config = BackendConfig(url="http://example.com")
        assert config.effective_websocket_url == "ws://example.com/ws/device"

    def test_effective_websocket_url_from_https(self):
        """Derives wss:// from https:// URL."""
        config = BackendConfig(url="https://example.com")
        assert config.effective_websocket_url == "wss://example.com/ws/device"

    def test_effective_websocket_url_explicit(self):
        """Uses explicit websocket_url if set."""
        config = BackendConfig(
            url="https://example.com",
            websocket_url="wss://custom.example.com/socket",
        )
        assert config.effective_websocket_url == "wss://custom.example.com/socket"


class TestDisplayConfigHelpers:
    """Test DisplayConfig helper methods."""

    def test_background_rgb_black(self):
        """background_rgb converts #000000 correctly."""
        config = DisplayConfig(background_color="#000000")
        assert config.background_rgb == (0.0, 0.0, 0.0)

    def test_background_rgb_white(self):
        """background_rgb converts #ffffff correctly."""
        config = DisplayConfig(background_color="#ffffff")
        r, g, b = config.background_rgb
        assert abs(r - 1.0) < 0.01
        assert abs(g - 1.0) < 0.01
        assert abs(b - 1.0) < 0.01

    def test_background_rgb_color(self):
        """background_rgb converts colors correctly."""
        config = DisplayConfig(background_color="#ff8000")  # Orange
        r, g, b = config.background_rgb
        assert abs(r - 1.0) < 0.01
        assert abs(g - 0.5) < 0.01
        assert abs(b - 0.0) < 0.01


class TestUnifiedConfigValidation:
    """Test UnifiedConfig validation."""

    def test_validate_returns_empty_for_valid_config(self):
        """validate() returns empty list for valid config."""
        config = UnifiedConfig(
            backend=BackendConfig(url="https://example.com")
        )
        errors = config.validate()
        assert errors == []

    def test_validate_requires_backend_url(self):
        """validate() reports missing backend.url."""
        config = UnifiedConfig(backend=BackendConfig(url=""))
        errors = config.validate()
        assert len(errors) == 1
        assert "backend.url" in errors[0]


class TestDaemonConfigIntegration:
    """Test integration with legacy DaemonConfig."""

    def test_daemon_config_from_unified(self, tmp_path):
        """DaemonConfig can be created from UnifiedConfig."""
        from glowworm_daemon.config import load_config as load_daemon_config

        config_file = tmp_path / "config.yaml"
        config_file.write_text("""
backend:
  url: "https://test.example.com"
  device_token: "my-token"

logging:
  level: DEBUG
  file: /var/log/test.log

cec:
  enabled: true
  display_address: 2
""")

        config = load_daemon_config(str(config_file))

        assert config.backend_url == "https://test.example.com"
        assert config.device_token == "my-token"
        assert config.log_level == "DEBUG"
        assert config.log_file == "/var/log/test.log"
        assert config.cec_enabled is True
        assert config.cec_display_address == 2

        # Unified config should be available
        assert config.unified is not None
        assert config.unified.backend.url == "https://test.example.com"
