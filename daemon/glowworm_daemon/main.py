"""
Main entry point for GlowWorm daemon service

This module delegates to main_v3 for the Pi3D-based architecture.
"""
from .main_v3 import main

if __name__ == "__main__":
    main()

