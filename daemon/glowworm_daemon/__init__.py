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
from .cache import (
    ImageCache,
    CacheConfig,
    CacheEntryMetadata,
    CacheStats,
    create_cache,
)
from .playlist_manager import (
    PlaylistManager,
    PlaylistManagerConfig,
    PlaylistData,
    PlaylistImage,
    PlaylistEntry,
    PlaylistPosition,
    PlaylistStatus,
    PlaylistError,
    PlaylistNotFoundError,
    create_playlist_manager,
)
from .preload_manager import (
    PreloadManager,
    PreloadManagerConfig,
    PreloadStatus,
    PreloadEntry,
    PreloadStats,
    create_preload_manager,
)
from .display_controller import (
    DisplayController,
    DisplayControllerConfig,
    DisplayState,
    IPCClient,
    IPCResponse,
    create_display_controller,
)
from .slideshow_orchestrator import (
    SlideshowOrchestrator,
    SlideshowConfig,
    SlideshowState,
    SlideshowStats,
    create_slideshow_orchestrator,
)
from .unified_config import (
    UnifiedConfig,
    BackendConfig,
    DisplayConfig as UnifiedDisplayConfig,
    SlideshowConfig as UnifiedSlideshowConfig,
    CacheConfig as UnifiedCacheConfig,
    StateConfig,
    IPCConfig,
    LoggingConfig,
    CECConfig,
    Orientation,
    Rotation,
    ScaleMode,
    ConfigurationError,
    load_config as load_unified_config,
    create_default_config as create_default_unified_config,
    save_config as save_unified_config,
)
from .websocket_client import (
    WebSocketClient,
    WebSocketConfig,
    WebSocketStats,
    ConnectionState,
    MessageType,
    QueuedMessage,
    create_websocket_client,
)

__all__ = [
    "GlowwormDaemon",
    # Image Manager
    "ImageManager",
    "ImageManagerConfig",
    "ImageManagerError",
    "ImageNotFoundError",
    "AuthenticationError",
    "DownloadStatus",
    "DownloadProgress",
    "CacheEntry",
    "create_image_manager",
    # Image Cache
    "ImageCache",
    "CacheConfig",
    "CacheEntryMetadata",
    "CacheStats",
    "create_cache",
    # Playlist Manager
    "PlaylistManager",
    "PlaylistManagerConfig",
    "PlaylistData",
    "PlaylistImage",
    "PlaylistEntry",
    "PlaylistPosition",
    "PlaylistStatus",
    "PlaylistError",
    "PlaylistNotFoundError",
    "create_playlist_manager",
    # Preload Manager
    "PreloadManager",
    "PreloadManagerConfig",
    "PreloadStatus",
    "PreloadEntry",
    "PreloadStats",
    "create_preload_manager",
    # Display Controller
    "DisplayController",
    "DisplayControllerConfig",
    "DisplayState",
    "IPCClient",
    "IPCResponse",
    "create_display_controller",
    # Slideshow Orchestrator
    "SlideshowOrchestrator",
    "SlideshowConfig",
    "SlideshowState",
    "SlideshowStats",
    "create_slideshow_orchestrator",
    # Unified Configuration (v3.0)
    "UnifiedConfig",
    "BackendConfig",
    "UnifiedDisplayConfig",
    "UnifiedSlideshowConfig",
    "UnifiedCacheConfig",
    "StateConfig",
    "IPCConfig",
    "LoggingConfig",
    "CECConfig",
    "Orientation",
    "Rotation",
    "ScaleMode",
    "ConfigurationError",
    "load_unified_config",
    "create_default_unified_config",
    "save_unified_config",
    # WebSocket Client (v3.0)
    "WebSocketClient",
    "WebSocketConfig",
    "WebSocketStats",
    "ConnectionState",
    "MessageType",
    "QueuedMessage",
    "create_websocket_client",
]

