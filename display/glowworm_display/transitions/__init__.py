"""
Transition effects for GlowWorm Display Engine.

This package contains various transition implementations for
smoothly changing between images.
"""

from glowworm_display.transitions.base import (
    ProgressCallback,
    Transition,
    TransitionProgress,
    TransitionState,
    ease_in_out_cubic,
    ease_out_quad,
)
from glowworm_display.transitions.crossfade import CrossfadeTransition
from glowworm_display.transitions.stacked_reveal import StackedRevealTransition

__all__ = [
    "CrossfadeTransition",
    "ProgressCallback",
    "StackedRevealTransition",
    "Transition",
    "TransitionProgress",
    "TransitionState",
    "ease_in_out_cubic",
    "ease_out_quad",
]
