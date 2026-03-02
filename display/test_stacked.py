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

    # IMPORTANT: Use 2D orthographic camera like the actual display code does
    camera = pi3d.Camera(is_3d=False)

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

    # Position for TOP stacked image on portrait display (270° rotation)
    #
    # Coordinate mapping (confirmed by testing):
    #   +X = visual top
    #   +Y = visual left
    #
    # The sprite rotation rotates the IMAGE content, not its bounding box.
    # So we create the sprite with the dimensions we want VISUALLY,
    # and the 270° rotation will rotate the texture inside.
    #
    # For a landscape image in top half of portrait display:
    #   - Visual target: 2160 wide x ~1000 tall (landscape in top half)
    #   - Create sprite at that size, texture will be rotated inside

    # Create landscape-shaped sprite to fill top half
    # Visual portrait display is 2160 wide x 3840 tall
    # Top half is 2160 wide x 1920 tall
    sprite_w = 2160  # visual width (full width of portrait display)
    sprite_h = 1920  # visual height (full half height)

    # Position in top half
    # The top half spans from visual Y = 0 to Y = 1920
    # Center of top half is at visual Y = 960
    # But visual Y maps to hardware X, so x_pos = 960
    x_pos = 960   # center of top half (+X = visual up)
    y_pos = 0     # centered horizontally

    # Add 270° rotation like the real display
    rotation = 270

    # TOP sprite (red)
    sprite_top = pi3d.Sprite(w=sprite_w, h=sprite_h, x=x_pos, y=y_pos, z=5.0)
    sprite_top.set_shader(shader)
    sprite_top.set_textures([texture])
    if rotation != 0:
        sprite_top.rotateToZ(float(rotation))

    # BOTTOM sprite - create blue texture
    img_array_blue = np.zeros((100, 200, 4), dtype=np.uint8)
    img_array_blue[:, :, 2] = 255  # Blue
    img_array_blue[:, :, 3] = 255  # Alpha
    img_array_blue[0:5, :, :3] = 255   # White border
    img_array_blue[-5:, :, :3] = 255
    img_array_blue[:, 0:5, :3] = 255
    img_array_blue[:, -5:, :3] = 255
    texture_blue = pi3d.Texture(img_array_blue)

    # Bottom half: x_pos = -960 (negative X = visual bottom)
    x_pos_bottom = -960
    sprite_bottom = pi3d.Sprite(w=sprite_w, h=sprite_h, x=x_pos_bottom, y=y_pos, z=5.0)
    sprite_bottom.set_shader(shader)
    sprite_bottom.set_textures([texture_blue])
    if rotation != 0:
        sprite_bottom.rotateToZ(float(rotation))

    print(f"Hardware display: {hw_width}x{hw_height}")
    print(f"Sprite size: {sprite_w}x{sprite_h}")
    print(f"Top position: ({x_pos}, {y_pos})")
    print(f"Bottom position: ({x_pos_bottom}, {y_pos})")
    print(f"Rotation: {rotation}°")
    print("Press Ctrl+C to exit")
    print()
    print("The image should appear at the TOP of the portrait display.")
    print("Red should be on one side, blue on the other.")

    try:
        while display.loop_running():
            sprite_top.draw()
            sprite_bottom.draw()
            time.sleep(0.033)  # ~30 fps
    except KeyboardInterrupt:
        print("\nExiting...")
    finally:
        display.destroy()

if __name__ == "__main__":
    main()
