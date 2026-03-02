#!/usr/bin/env python3
"""
Test script for stacked image positioning on rotated display.

Run on the Pi with:
    sudo XDG_RUNTIME_DIR=/run/user/1000 cage -- /opt/glowworm/venv/bin/python /home/nick/glowworm/display/test_stacked.py

This will display a single image positioned at the "top" of a portrait display
(which is 270° rotated from landscape hardware).
"""

import os
import time

import pi3d

# Display setup - matches your hardware
ROTATION = 270  # degrees counter-clockwise

def main():
    # Initialize display
    display = pi3d.Display.create(
        background=(0.0, 0.0, 0.0, 1.0),
        frames_per_second=30,
    )

    print(f"Display size: {display.width}x{display.height}")

    # Hardware dimensions
    hw_width = display.width   # 3840
    hw_height = display.height  # 2160

    # Load a test image (use any image on the Pi)
    # We'll create a simple colored rectangle as a texture
    shader = pi3d.Shader("uv_flat")

    # Create a simple test pattern - red rectangle
    import numpy as np
    # Create a red/blue gradient image so we can see orientation
    img_array = np.zeros((100, 200, 4), dtype=np.uint8)
    img_array[:, :100, 0] = 255  # Left half red
    img_array[:, 100:, 2] = 255  # Right half blue
    img_array[:, :, 3] = 255  # Full alpha

    texture = pi3d.Texture(img_array)

    # Test parameters - adjust these to experiment
    # For a 270° rotated display:
    # - Visual portrait: 2160 wide x 3840 tall
    # - Each stacked image should be ~2160 wide x 1920 tall (visual)
    # - In hardware space, that's 1920 wide x 2160 tall

    sprite_w = 1910  # Half of hardware width (3840/2) minus gap
    sprite_h = 2160  # Full hardware height

    # Position for "top" image
    # Quarter offset from center along X axis
    x_pos = 965  # 3840/4 ≈ 960, plus small adjustment for gap
    y_pos = 0

    sprite = pi3d.Sprite(w=sprite_w, h=sprite_h, x=x_pos, y=y_pos, z=1.0)
    sprite.set_shader(shader)
    sprite.set_textures([texture])
    sprite.rotateToZ(float(ROTATION))

    print(f"Sprite: {sprite_w}x{sprite_h} at ({x_pos}, {y_pos}), rotation={ROTATION}")
    print("Press Ctrl+C to exit")
    print()
    print("The image should appear at the TOP of the portrait display.")
    print("Red should be on one side, blue on the other.")

    try:
        while display.loop_running():
            sprite.draw()
            time.sleep(0.033)  # ~30 fps
    except KeyboardInterrupt:
        print("\nExiting...")
    finally:
        display.destroy()

if __name__ == "__main__":
    main()
