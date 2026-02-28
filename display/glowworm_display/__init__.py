"""
GlowWorm Display Engine

GPU-accelerated Pi3D display engine for digital photo frame slideshow.
Designed to run on Raspberry Pi with smooth cross-fade transitions.
"""

__version__ = "3.0.0"
__author__ = "Glowworm Team"

from glowworm_display.config import DisplayConfig
from glowworm_display.display import Display, create_display

__all__ = ["DisplayConfig", "Display", "create_display", "__version__"]
