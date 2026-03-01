"""
GlowWorm Display Engine

GPU-accelerated Pi3D display engine for digital photo frame slideshow.
Designed to run on Raspberry Pi with smooth cross-fade transitions.
"""

__version__ = "3.0.0"
__author__ = "Glowworm Team"

from glowworm_display.config import DisplayConfig
from glowworm_display.display import Display, create_display
from glowworm_display.image_loader import (
    ImageLoader,
    ImageLoaderConfig,
    ImageLoadError,
    ScaleMode,
    TextureInfo,
)
from glowworm_display.ipc_server import (
    IPCServer,
    IPCServerConfig,
    create_ipc_server,
)
from glowworm_display.performance import (
    PerformanceConfig,
    PerformanceMetrics,
    PerformanceMonitor,
    create_performance_monitor,
)
from glowworm_display.renderer import (
    ErrorInfo,
    Renderer,
    RendererState,
    RenderStats,
)
from glowworm_display.text_renderer import (
    TextRenderer,
    TextStyle,
)
from glowworm_display.transitions import (
    CrossfadeTransition,
    Transition,
    TransitionProgress,
    TransitionState,
)

__all__ = [
    "CrossfadeTransition",
    "DisplayConfig",
    "Display",
    "create_display",
    "create_performance_monitor",
    "ErrorInfo",
    "ImageLoader",
    "ImageLoaderConfig",
    "ImageLoadError",
    "IPCServer",
    "IPCServerConfig",
    "create_ipc_server",
    "PerformanceConfig",
    "PerformanceMetrics",
    "PerformanceMonitor",
    "Renderer",
    "RendererState",
    "RenderStats",
    "ScaleMode",
    "TextRenderer",
    "TextStyle",
    "TextureInfo",
    "Transition",
    "TransitionProgress",
    "TransitionState",
    "__version__",
]
