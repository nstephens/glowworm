"""
Configuration management for Glowworm daemon
Loads and validates configuration from INI files
"""
import os
import configparser
import logging
from pathlib import Path
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Default configuration paths
DEFAULT_CONFIG_PATH = "/etc/glowworm/daemon.conf"
FALLBACK_CONFIG_PATHS = [
    "/etc/glowworm/daemon.conf",
    os.path.expanduser("~/.config/glowworm/daemon.conf"),
    os.path.join(os.getcwd(), "daemon.conf"),
]

# Default configuration values
DEFAULT_CONFIG = {
    "daemon": {
        "backend_url": "http://localhost:3003",  # Frontend URL (proxies /api/ to backend)
        "device_token": "",
        "poll_interval": "30",
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
    """Configuration container for daemon settings"""
    
    def __init__(self, config_data: Dict[str, Dict[str, Any]]):
        self._data = config_data
        self._validate()
    
    def _validate(self):
        """Validate required configuration values"""
        # Validate daemon section
        if not self.get("daemon", "backend_url"):
            raise ConfigurationError("backend_url is required in [daemon] section")
        
        if not self.get("daemon", "device_token"):
            raise ConfigurationError("device_token is required in [daemon] section")
        
        # Validate poll_interval is a positive integer
        try:
            poll_interval = int(self.get("daemon", "poll_interval", "30"))
            if poll_interval < 1:
                raise ValueError
        except ValueError:
            raise ConfigurationError("poll_interval must be a positive integer")
        
        # Validate log level
        log_level = self.get("daemon", "log_level", "INFO").upper()
        if log_level not in ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]:
            raise ConfigurationError(f"Invalid log_level: {log_level}")
        
        logger.info("Configuration validated successfully")
    
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
        return self.get_int("daemon", "poll_interval", 30)
    
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


def find_config_file() -> Optional[str]:
    """Find configuration file in standard locations"""
    for path in FALLBACK_CONFIG_PATHS:
        if os.path.isfile(path):
            logger.info(f"Found configuration file: {path}")
            return path
    return None


def load_config(config_path: Optional[str] = None) -> DaemonConfig:
    """
    Load configuration from file
    
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
        raise ConfigurationError(
            f"Configuration file not found. Searched: {', '.join(FALLBACK_CONFIG_PATHS)}"
        )
    
    if not os.path.isfile(config_path):
        raise ConfigurationError(f"Configuration file not found: {config_path}")
    
    # Parse INI file
    parser = configparser.ConfigParser()
    try:
        parser.read(config_path)
        logger.info(f"Loaded configuration from: {config_path}")
    except Exception as e:
        raise ConfigurationError(f"Failed to parse configuration file: {e}")
    
    # Convert to dict with defaults
    config_data = {}
    for section in DEFAULT_CONFIG:
        config_data[section] = dict(DEFAULT_CONFIG[section])
        if parser.has_section(section):
            config_data[section].update(dict(parser.items(section)))
    
    # Create config object (validates on construction)
    return DaemonConfig(config_data)


def create_default_config(output_path: str) -> None:
    """
    Create a default configuration file
    
    Args:
        output_path: Path where configuration file should be created
    """
    # Ensure directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Create config parser
    parser = configparser.ConfigParser()
    
    # Add sections and values
    for section, values in DEFAULT_CONFIG.items():
        parser.add_section(section)
        for key, value in values.items():
            parser.set(section, key, value)
    
    # Write to file
    with open(output_path, "w") as f:
        f.write("# Glowworm Display Device Daemon Configuration\n")
        f.write("# Generated configuration file\n\n")
        parser.write(f)
    
    logger.info(f"Created default configuration file: {output_path}")


if __name__ == "__main__":
    # Test config loading
    logging.basicConfig(level=logging.INFO)
    
    # Create a test config
    test_config_path = "/tmp/test_daemon.conf"
    create_default_config(test_config_path)
    
    # Modify with required values for testing
    parser = configparser.ConfigParser()
    parser.read(test_config_path)
    parser.set("daemon", "backend_url", "http://10.10.10.2:8002")
    parser.set("daemon", "device_token", "test-token-123")
    with open(test_config_path, "w") as f:
        parser.write(f)
    
    # Load and test
    config = load_config(test_config_path)
    print(f"Backend URL: {config.backend_url}")
    print(f"Device Token: {config.device_token}")
    print(f"Poll Interval: {config.poll_interval}")
    print(f"CEC Enabled: {config.cec_enabled}")
    print("Configuration loaded successfully!")

