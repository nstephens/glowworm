"""
Glowworm Display Device Daemon

Optional daemon service for Raspberry Pi display devices that enables
host-level control operations including:
- Remote browser URL updates
- HDMI CEC display control (power, input switching)
- Integration with Glowworm scheduler
"""

__version__ = "1.0.0"
__author__ = "Glowworm Team"

from .daemon import GlowwormDaemon

__all__ = ["GlowwormDaemon"]

