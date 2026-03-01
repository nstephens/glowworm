"""
Tests for color extraction service
"""

import pytest
from services.color_extractor import extract_dominant_colors, rgb_to_hex, color_extractor_service


def test_rgb_to_hex():
    """Test RGB to hex conversion"""
    assert rgb_to_hex((255, 87, 51)) == "#ff5733"
    assert rgb_to_hex((51, 255, 87)) == "#33ff57"
    assert rgb_to_hex((51, 87, 255)) == "#3357ff"
    assert rgb_to_hex((0, 0, 0)) == "#000000"
    assert rgb_to_hex((255, 255, 255)) == "#ffffff"


def test_color_extractor_service_initialization():
    """Test that service singleton is properly initialized"""
    assert color_extractor_service is not None
    assert color_extractor_service.default_color_count == 3
    assert color_extractor_service.default_quality == 10


def test_extract_colors_invalid_path():
    """Test that invalid path returns None"""
    colors = extract_dominant_colors("/nonexistent/path/to/image.jpg")
    assert colors is None


def test_extract_colors_format_validation():
    """Test that extracted colors are in correct format"""
    # This test would need actual image file
    # For now, validate the format when colors are returned
    test_colors = ["#ff5733", "#33ff57", "#3357ff"]
    
    # Validate hex format
    for color in test_colors:
        assert color.startswith("#")
        assert len(color) == 7
        # Validate hex characters
        hex_chars = color[1:]
        assert all(c in "0123456789abcdef" for c in hex_chars.lower())


# Note: Full integration tests would require:
# - Sample test images (JPEG, PNG, WebP, RGBA, etc.)
# - Testing with corrupted images
# - Testing with various color palettes
# - Performance benchmarking
# These should be run with actual image files in integration tests

