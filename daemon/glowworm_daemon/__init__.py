"""
Glowworm Display Device Daemon

Optional daemon service for Raspberry Pi display devices that enables
host-level control operations including:
- Remote browser URL updates
- HDMI CEC display control (power, input switching)
- Integration with Glowworm scheduler
- Image fetching and caching (v3.0+)
"""

__version__ = "3.0.0"
__author__ = "Glowworm Team"

from .daemon import GlowwormDaemon
from .image_manager import (
    ImageManager,
    ImageManagerConfig,
    ImageManagerError,
    ImageNotFoundError,
    AuthenticationError,
    DownloadStatus,
    DownloadProgress,
    CacheEntry,
    create_image_manager,
)

__all__ = [
    "GlowwormDaemon",
    "ImageManager",
    "ImageManagerConfig",
    "ImageManagerError",
    "ImageNotFoundError",
    "AuthenticationError",
    "DownloadStatus",
    "DownloadProgress",
    "CacheEntry",
    "create_image_manager",
]

