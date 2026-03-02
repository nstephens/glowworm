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

    # Test with SCALED dimensions like the daemon does
    # Simulating a landscape image (e.g., 2048x1152) scaled to fit in half
    gap = 20
    half_height = (3840 - gap) / 2  # 1910 each
    target_w = 2160
    target_h = half_height

    # Simulate scaling a 2048x1152 image to fit
    image_w, image_h = 2048, 1152
    image_aspect = image_w / image_h
    target_aspect = target_w / target_h

    # FIT mode: scale to fit within target
    if image_aspect > target_aspect:
        # Image wider than target - fit to width
        scale = target_w / image_w
    else:
        scale = target_h / image_h

    sprite_w = image_w * scale  # Should be 2160
    sprite_h = image_h * scale  # Should be ~1215

    print(f"Scaled sprite: {sprite_w:.0f}x{sprite_h:.0f}")

    # Position in top half - same formula as before
    x_pos = gap/2 + half_height/2   # center of top half (+X = visual up)
    y_pos = 0     # centered horizontally

    # Add 270° rotation like the real display
    rotation = 270

    # Use EXACTLY the same values as daemon for comparison
    # From daemon log: pi3d.Sprite(w=2160, h=1215, x=965, y=0, z=1.0), rotateToZ(270)
    print(f"\nUsing daemon's exact values for comparison:")
    print(f"Top: w=2160, h=1215, x=965, y=0, z=1.0, rot=270")
    print(f"Bottom: w=2160, h=1215, x=-965, y=0, z=1.0, rot=270")

    # TOP sprite (red) - exact daemon values
    sprite_top = pi3d.Sprite(w=2160, h=1215, x=965, y=0, z=1.0)
    sprite_top.set_shader(shader)
    sprite_top.set_textures([texture])
    sprite_top.rotateToZ(270.0)

    # BOTTOM sprite - create blue texture
    img_array_blue = np.zeros((100, 200, 4), dtype=np.uint8)
    img_array_blue[:, :, 2] = 255  # Blue
    img_array_blue[:, :, 3] = 255  # Alpha
    img_array_blue[0:5, :, :3] = 255   # White border
    img_array_blue[-5:, :, :3] = 255
    img_array_blue[:, 0:5, :3] = 255
    img_array_blue[:, -5:, :3] = 255
    texture_blue = pi3d.Texture(img_array_blue)

    # Bottom sprite (blue) - exact daemon values
    sprite_bottom = pi3d.Sprite(w=2160, h=1215, x=-965, y=0, z=1.0)
    sprite_bottom.set_shader(shader)
    sprite_bottom.set_textures([texture_blue])
    sprite_bottom.rotateToZ(270.0)

    print(f"Hardware display: {hw_width}x{hw_height}")
    print("Press Ctrl+C to exit")

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
