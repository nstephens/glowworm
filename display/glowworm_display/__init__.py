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
    ImageLoadError,
    ScaleMode,
)
from glowworm_display.ipc_server import (
    IPCServer,
    IPCServerConfig,
    create_ipc_server,
)
from glowworm_display.renderer import (
    Renderer,
    RendererState,
    RenderStats,
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
    "ImageLoader",
    "ImageLoadError",
    "IPCServer",
    "IPCServerConfig",
    "create_ipc_server",
    "Renderer",
    "RendererState",
    "RenderStats",
    "ScaleMode",
    "Transition",
    "TransitionProgress",
    "TransitionState",
    "__version__",
]
