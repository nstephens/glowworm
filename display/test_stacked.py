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

    # Create a simple test pattern - bright red rectangle with white border
    import numpy as np
    # Make a small, obvious test image
    img_array = np.zeros((100, 200, 4), dtype=np.uint8)
    # Fill with bright red
    img_array[:, :, 0] = 255  # Red
    img_array[:, :, 3] = 255  # Alpha
    # Add white border so we can see edges
    img_array[0:5, :, :3] = 255   # Top edge white
    img_array[-5:, :, :3] = 255   # Bottom edge white
    img_array[:, 0:5, :3] = 255   # Left edge white
    img_array[:, -5:, :3] = 255   # Right edge white

    texture = pi3d.Texture(img_array)

    # TEST: Small centered sprite with rotation
    # Make sprite MUCH smaller - about 1/4 of the smallest display dimension
    sprite_w = 400
    sprite_h = 200

    # Start at center (0,0)
    x_pos = 0
    y_pos = 0

    sprite = pi3d.Sprite(w=sprite_w, h=sprite_h, x=x_pos, y=y_pos, z=1.0)
    sprite.set_shader(shader)
    sprite.set_textures([texture])
    sprite.rotateToZ(float(ROTATION))

    print(f"Hardware display: {hw_width}x{hw_height}")
    print(f"Sprite size: {sprite_w}x{sprite_h}")
    print(f"Sprite position: ({x_pos}, {y_pos})")
    print(f"Rotation: {ROTATION}°")
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
