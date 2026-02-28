"""
Configuration management for Glowworm daemon.

v3.0: Now supports unified YAML configuration while maintaining backward
compatibility with the legacy INI format for existing deployments.

Configuration loading order:
1. Try YAML format (/etc/glowworm/config.yaml)
2. Fall back to INI format (/etc/glowworm/daemon.conf)
3. Use defaults if no config found
"""
import configparser
import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional

import yaml

logger = logging.getLogger(__name__)


# YAML configuration paths (preferred, v3.0+)
YAML_CONFIG_PATHS = [
    "/etc/glowworm/config.yaml",
    os.path.expanduser("~/.config/glowworm/config.yaml"),
    os.path.join(os.getcwd(), "config.yaml"),
]

# Legacy INI configuration paths (v2.x compatibility)
INI_CONFIG_PATHS = [
    "/etc/glowworm/daemon.conf",
    os.path.expanduser("~/.config/glowworm/daemon.conf"),
    os.path.join(os.getcwd(), "daemon.conf"),
]

# Default configuration values (INI format for backward compat)
DEFAULT_CONFIG = {
    "daemon": {
        "backend_url": "http://localhost:3003",
        "device_token": "",
        "poll_interval": "5",
        "log_level": "INFO",
        "log_file": "/var/log/glowworm/daemon.log",
        "max_retries": "3",
        "retry_delay": "5",
    },
    "cec": {
        "enabled": "false",
        "display_address": "0",
        "adapter": "/dev/cec0",
        "timeout": "5",
    },
    "fullpageos": {
        "config_path": "/boot/firmware/fullpageos.txt",
        "backup_enabled": "true",
    },
}


class ConfigurationError(Exception):
    """Raised when configuration is invalid"""
    pass


class DaemonConfig:
    """
    Configuration container for daemon settings.

    Provides a unified interface regardless of whether config was loaded
    from YAML or INI format.
    """

    def __init__(self, config_data: Dict[str, Dict[str, Any]]):
        self._data = config_data
        self._unified = None  # Set if loaded from UnifiedConfig
        self._validate()

    @classmethod
    def from_unified(cls, unified) -> "DaemonConfig":
        """
        Create DaemonConfig from a UnifiedConfig instance.

        Args:
            unified: UnifiedConfig instance from unified_config.py

        Returns:
            DaemonConfig with settings mapped from UnifiedConfig
        """
        # Map UnifiedConfig to legacy format
        config_data = {
            "daemon": {
                "backend_url": unified.backend.url,
                "device_token": unified.backend.device_token,
                "poll_interval": str(5),  # Not in unified, use default
                "log_level": unified.logging.level,
                "log_file": unified.logging.file or "/var/log/glowworm/daemon.log",
                "max_retries": str(unified.backend.max_retries),
                "retry_delay": str(int(unified.backend.retry_base_delay)),
            },
            "cec": {
                "enabled": str(unified.cec.enabled).lower(),
                "display_address": str(unified.cec.display_address),
                "adapter": unified.cec.adapter,
                "timeout": str(unified.cec.timeout),
            },
            "fullpageos": {
                "config_path": "/boot/firmware/fullpageos.txt",
                "backup_enabled": "true",
            },
        }
        instance = cls.__new__(cls)
        instance._data = config_data
        instance._unified = unified
        instance._validate()
        return instance

    def _validate(self):
        """Validate required configuration values"""
        # Validate daemon section
        if not self.get("daemon", "backend_url"):
            raise ConfigurationError("backend_url is required in [daemon] section")

        # Device token not required for registration mode
        if not self.get("daemon", "device_token"):
            logger.info("No device_token configured - device registration required")

        # Validate poll_interval is a positive integer
        try:
            poll_interval = int(self.get("daemon", "poll_interval", "5"))
            if poll_interval < 1:
                raise ValueError
        except ValueError:
            raise ConfigurationError("poll_interval must be a positive integer")

        # Validate log level
        log_level = self.get("daemon", "log_level", "INFO").upper()
        if log_level not in ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]:
            raise ConfigurationError(f"Invalid log_level: {log_level}")

        logger.debug("Configuration validated successfully")

    def get(self, section: str, key: str, default: Optional[str] = None) -> str:
        """Get configuration value"""
        return self._data.get(section, {}).get(key, default)

    def get_int(self, section: str, key: str, default: int = 0) -> int:
        """Get configuration value as integer"""
        try:
            return int(self.get(section, key, str(default)))
        except (ValueError, TypeError):
            return default

    def get_bool(self, section: str, key: str, default: bool = False) -> bool:
        """Get configuration value as boolean"""
        value = self.get(section, key, str(default)).lower()
        return value in ["true", "1", "yes", "on"]

    def get_float(self, section: str, key: str, default: float = 0.0) -> float:
        """Get configuration value as float"""
        try:
            return float(self.get(section, key, str(default)))
        except (ValueError, TypeError):
            return default

    @property
    def unified(self):
        """Get the underlying UnifiedConfig if loaded from YAML."""
        return self._unified

    @property
    def backend_url(self) -> str:
        """Backend API URL"""
        return self.get("daemon", "backend_url")

    @property
    def device_token(self) -> str:
        """Device authentication token"""
        return self.get("daemon", "device_token")

    @property
    def poll_interval(self) -> int:
        """Command polling interval in seconds"""
        return self.get_int("daemon", "poll_interval", 5)

    @property
    def log_level(self) -> str:
        """Logging level"""
        return self.get("daemon", "log_level", "INFO").upper()

    @property
    def log_file(self) -> str:
        """Log file path"""
        return self.get("daemon", "log_file", "/var/log/glowworm/daemon.log")

    @property
    def max_retries(self) -> int:
        """Maximum number of connection retries"""
        return self.get_int("daemon", "max_retries", 3)

    @property
    def retry_delay(self) -> int:
        """Delay between retries in seconds"""
        return self.get_int("daemon", "retry_delay", 5)

    @property
    def cec_enabled(self) -> bool:
        """Whether HDMI CEC control is enabled"""
        return self.get_bool("cec", "enabled", False)

    @property
    def cec_display_address(self) -> int:
        """CEC display logical address"""
        return self.get_int("cec", "display_address", 0)

    @property
    def cec_adapter(self) -> str:
        """CEC adapter device path"""
        return self.get("cec", "adapter", "/dev/cec0")

    @property
    def cec_timeout(self) -> int:
        """CEC command timeout in seconds"""
        return self.get_int("cec", "timeout", 5)

    @property
    def fullpageos_config_path(self) -> str:
        """FullPageOS configuration file path"""
        return self.get("fullpageos", "config_path", "/boot/firmware/fullpageos.txt")

    @property
    def fullpageos_backup_enabled(self) -> bool:
        """Whether to backup FullPageOS config before modifying"""
        return self.get_bool("fullpageos", "backup_enabled", True)


def _find_yaml_config() -> Optional[str]:
    """Find YAML configuration file in standard locations."""
    for path in YAML_CONFIG_PATHS:
        if os.path.isfile(path):
            logger.info(f"Found YAML configuration: {path}")
            return path
    return None


def _find_ini_config() -> Optional[str]:
    """Find INI configuration file in standard locations."""
    for path in INI_CONFIG_PATHS:
        if os.path.isfile(path):
            logger.info(f"Found INI configuration: {path}")
            return path
    return None


def _load_yaml_config(config_path: str) -> DaemonConfig:
    """Load configuration from YAML file using UnifiedConfig."""
    from .unified_config import load_config as load_unified

    unified = load_unified(config_path)
    return DaemonConfig.from_unified(unified)


def _load_ini_config(config_path: str) -> DaemonConfig:
    """Load configuration from INI file (legacy v2.x format)."""
    parser = configparser.ConfigParser()
    try:
        parser.read(config_path)
        logger.info(f"Loaded legacy INI configuration from: {config_path}")
    except Exception as e:
        raise ConfigurationError(f"Failed to parse configuration file: {e}")

    # Convert to dict with defaults
    config_data = {}
    for section in DEFAULT_CONFIG:
        config_data[section] = dict(DEFAULT_CONFIG[section])
        if parser.has_section(section):
            config_data[section].update(dict(parser.items(section)))

    return DaemonConfig(config_data)


def find_config_file() -> Optional[str]:
    """
    Find configuration file in standard locations.

    Searches for YAML config first, then falls back to INI format.
    """
    # Try YAML first (v3.0+)
    yaml_path = _find_yaml_config()
    if yaml_path:
        return yaml_path

    # Fall back to INI (v2.x)
    ini_path = _find_ini_config()
    if ini_path:
        return ini_path

    return None


def load_config(config_path: Optional[str] = None) -> DaemonConfig:
    """
    Load configuration from file.

    Automatically detects YAML vs INI format based on file extension
    or content.

    Args:
        config_path: Optional path to configuration file. If not provided,
                    searches standard locations.

    Returns:
        DaemonConfig object

    Raises:
        ConfigurationError: If config file not found or invalid
    """
    # Find config file if not provided
    if config_path is None:
        config_path = find_config_file()

    if config_path is None:
        # No config file - use defaults (for registration mode)
        logger.info("No configuration file found, using defaults")
        config_data = {}
        for section in DEFAULT_CONFIG:
            config_data[section] = dict(DEFAULT_CONFIG[section])
        return DaemonConfig(config_data)

    if not os.path.isfile(config_path):
        raise ConfigurationError(f"Configuration file not found: {config_path}")

    # Determine format based on extension or content
    if config_path.endswith(".yaml") or config_path.endswith(".yml"):
        return _load_yaml_config(config_path)
    elif config_path.endswith(".conf") or config_path.endswith(".ini"):
        return _load_ini_config(config_path)
    else:
        # Try to detect format from content
        with open(config_path, "r") as f:
            first_line = f.readline().strip()

        if first_line.startswith("#") or first_line.startswith("["):
            # Looks like INI format
            return _load_ini_config(config_path)
        else:
            # Assume YAML
            return _load_yaml_config(config_path)


def create_default_config(output_path: str, format: str = "yaml") -> None:
    """
    Create a default configuration file.

    Args:
        output_path: Path where configuration file should be created
        format: Configuration format ("yaml" or "ini")
    """
    # Ensure directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    if format == "yaml":
        from .unified_config import create_default_config as create_yaml
        create_yaml(output_path)
    else:
        # Legacy INI format
        parser = configparser.ConfigParser()
        for section, values in DEFAULT_CONFIG.items():
            parser.add_section(section)
            for key, value in values.items():
                parser.set(section, key, value)

        with open(output_path, "w") as f:
            f.write("# Glowworm Display Device Daemon Configuration\n")
            f.write("# Generated configuration file\n\n")
            parser.write(f)

    logger.info(f"Created default configuration file: {output_path}")


if __name__ == "__main__":
    # Test config loading
    logging.basicConfig(level=logging.INFO)

    # Test YAML config
    test_yaml_path = "/tmp/test_glowworm_config.yaml"
    create_default_config(test_yaml_path, format="yaml")

    # Add required values
    with open(test_yaml_path, "r") as f:
        data = yaml.safe_load(f)

    data["backend"]["url"] = "http://10.10.10.2:8002"
    data["backend"]["device_token"] = "test-token-123"

    with open(test_yaml_path, "w") as f:
        yaml.dump(data, f, default_flow_style=False)

    # Load and test YAML
    config = load_config(test_yaml_path)
    print(f"YAML Config - Backend URL: {config.backend_url}")
    print(f"YAML Config - Device Token: {config.device_token}")
    print(f"YAML Config - CEC Enabled: {config.cec_enabled}")
    print(f"YAML Config - Has Unified: {config.unified is not None}")

    # Test INI config (legacy)
    test_ini_path = "/tmp/test_daemon.conf"
    create_default_config(test_ini_path, format="ini")

    parser = configparser.ConfigParser()
    parser.read(test_ini_path)
    parser.set("daemon", "backend_url", "http://10.10.10.2:8002")
    parser.set("daemon", "device_token", "test-token-456")
    with open(test_ini_path, "w") as f:
        parser.write(f)

    config = load_config(test_ini_path)
    print(f"\nINI Config - Backend URL: {config.backend_url}")
    print(f"INI Config - Device Token: {config.device_token}")
    print(f"INI Config - Has Unified: {config.unified is not None}")

    print("\nConfiguration test completed successfully!")
