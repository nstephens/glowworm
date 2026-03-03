"""
Effects for GlowWorm Display Engine.

This package contains visual effects that can be applied to images
during display, separate from transitions between images.
"""

from glowworm_display.effects.ken_burns import KenBurnsEffect, KenBurnsConfig

__all__ = [
    "KenBurnsEffect",
    "KenBurnsConfig",
]
