"""
Tests for ImageLoader Performance Optimizations.
"""

import tempfile
from pathlib import Path

import pytest
from PIL import Image

from glowworm_display.image_loader import (
    ImageLoader,
    ImageLoaderConfig,
    ScaleMode,
)


@pytest.fixture
def temp_image_dir():
    """Create a temporary directory with test images."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)

        # Create a small test image
        small_img = Image.new("RGB", (800, 600), color="red")
        small_img.save(tmpdir_path / "small.jpg", "JPEG")

        # Create a large test image (over default max texture size)
        large_img = Image.new("RGB", (4000, 3000), color="blue")
        large_img.save(tmpdir_path / "large.jpg", "JPEG")

        # Create a medium test image
        medium_img = Image.new("RGB", (1920, 1080), color="green")
        medium_img.save(tmpdir_path / "medium.jpg", "JPEG")

        yield tmpdir_path


class TestImageLoaderConfig:
    """Tests for ImageLoaderConfig."""

    def test_default_values(self):
        """Test default configuration values."""
        config = ImageLoaderConfig()

        assert config.max_texture_size == 2048
        assert config.texture_pool_size == 4
        assert config.resize_large_images is True
        assert config.resize_quality == 90
        assert config.use_mipmaps is True

    def test_custom_values(self):
        """Test custom configuration."""
        config = ImageLoaderConfig(
            max_texture_size=1024,
            texture_pool_size=8,
            resize_quality=85,
        )

        assert config.max_texture_size == 1024
        assert config.texture_pool_size == 8
        assert config.resize_quality == 85


class TestImageResizing:
    """Tests for image resizing optimization."""

    def test_should_resize_detection(self, temp_image_dir):
        """Test resize detection based on image dimensions."""
        config = ImageLoaderConfig(max_texture_size=2048)
        loader = ImageLoader(
            display_width=1920,
            display_height=1080,
            mock=True,
            config=config,
        )

        # Small image should not need resize
        assert loader._should_resize(800, 600) is False

        # Large image should need resize
        assert loader._should_resize(4000, 3000) is True

        # Edge case - exactly at limit
        assert loader._should_resize(2048, 2048) is False

        # Just over limit
        assert loader._should_resize(2049, 2048) is True

    def test_calculate_resize_dimensions(self, temp_image_dir):
        """Test resize dimension calculation maintains aspect ratio."""
        config = ImageLoaderConfig(max_texture_size=1024)
        loader = ImageLoader(
            display_width=1920,
            display_height=1080,
            mock=True,
            config=config,
        )

        # Landscape image
        new_w, new_h = loader._calculate_resize_dimensions(4000, 2000)
        assert new_w == 1024
        assert new_h == 512  # Maintains 2:1 ratio

        # Portrait image
        new_w, new_h = loader._calculate_resize_dimensions(2000, 4000)
        assert new_w == 512
        assert new_h == 1024  # Maintains 1:2 ratio

        # Square image
        new_w, new_h = loader._calculate_resize_dimensions(3000, 3000)
        assert new_w == 1024
        assert new_h == 1024

    def test_resize_image(self, temp_image_dir):
        """Test actual image resizing."""
        config = ImageLoaderConfig(max_texture_size=1024)
        loader = ImageLoader(
            display_width=1920,
            display_height=1080,
            mock=True,
            config=config,
        )

        # Load large image - should be resized
        large_path = temp_image_dir / "large.jpg"
        img, was_resized = loader._resize_image(large_path)

        assert was_resized is True
        assert img.size[0] <= 1024
        assert img.size[1] <= 1024
        img.close()

        # Load small image - should not be resized
        small_path = temp_image_dir / "small.jpg"
        img, was_resized = loader._resize_image(small_path)

        assert was_resized is False
        assert img.size == (800, 600)
        img.close()

    def test_bytes_saved_tracking(self, temp_image_dir):
        """Test that bytes saved by resizing is tracked."""
        config = ImageLoaderConfig(max_texture_size=1024)
        loader = ImageLoader(
            display_width=1920,
            display_height=1080,
            mock=True,
            config=config,
        )

        initial_saved = loader._bytes_saved_by_resize

        # Load large image
        large_path = temp_image_dir / "large.jpg"
        loader.load_texture(large_path)

        # Should have saved bytes
        assert loader._bytes_saved_by_resize > initial_saved


class TestTexturePool:
    """Tests for texture recycling pool."""

    def test_texture_pooling(self, temp_image_dir):
        """Test texture recycling from pool."""
        config = ImageLoaderConfig(texture_pool_size=2)
        loader = ImageLoader(
            display_width=1920,
            display_height=1080,
            mock=True,
            config=config,
        )

        small_path = str(temp_image_dir / "small.jpg")

        # First load
        texture1 = loader.load_texture(small_path)
        assert loader._textures_loaded == 1
        assert loader._textures_recycled == 0

        # Second load of same image - should recycle
        texture2 = loader.load_texture(small_path)
        assert loader._textures_loaded == 1  # No new load
        assert loader._textures_recycled == 1

    def test_pool_eviction(self, temp_image_dir):
        """Test LRU eviction from pool when full."""
        config = ImageLoaderConfig(texture_pool_size=2)
        loader = ImageLoader(
            display_width=1920,
            display_height=1080,
            mock=True,
            config=config,
        )

        # Load 3 different images (pool size is 2)
        loader.load_texture(temp_image_dir / "small.jpg")
        loader.load_texture(temp_image_dir / "medium.jpg")
        loader.load_texture(temp_image_dir / "large.jpg")

        # Should have evicted one
        assert loader._textures_evicted >= 1
        assert len(loader._texture_pool) <= 2

    def test_pool_lru_order(self, temp_image_dir):
        """Test that pool maintains LRU order."""
        config = ImageLoaderConfig(texture_pool_size=2)
        loader = ImageLoader(
            display_width=1920,
            display_height=1080,
            mock=True,
            config=config,
        )

        small_path = str(temp_image_dir / "small.jpg")
        medium_path = str(temp_image_dir / "medium.jpg")
        large_path = str(temp_image_dir / "large.jpg")

        # Load small and medium
        loader.load_texture(small_path)
        loader.load_texture(medium_path)

        # Access small again (moves to end of LRU)
        loader.load_texture(small_path)

        # Load large - should evict medium (least recently used)
        loader.load_texture(large_path)

        # small should still be in pool, medium should be evicted
        assert small_path in loader._texture_pool
        assert medium_path not in loader._texture_pool
        assert large_path in loader._texture_pool

    def test_clear_texture_pool(self, temp_image_dir):
        """Test clearing the texture pool."""
        config = ImageLoaderConfig(texture_pool_size=4)
        loader = ImageLoader(
            display_width=1920,
            display_height=1080,
            mock=True,
            config=config,
        )

        # Load some textures
        loader.load_texture(temp_image_dir / "small.jpg")
        loader.load_texture(temp_image_dir / "medium.jpg")

        assert len(loader._texture_pool) == 2

        # Clear pool
        cleared = loader.clear_texture_pool()

        assert cleared == 2
        assert len(loader._texture_pool) == 0

    def test_pool_stats(self, temp_image_dir):
        """Test pool statistics."""
        config = ImageLoaderConfig(texture_pool_size=4)
        loader = ImageLoader(
            display_width=1920,
            display_height=1080,
            mock=True,
            config=config,
        )

        # Load textures
        loader.load_texture(temp_image_dir / "small.jpg")
        loader.load_texture(temp_image_dir / "small.jpg")  # Recycle

        stats = loader.get_pool_stats()

        assert stats["pool_size"] == 1
        assert stats["pool_capacity"] == 4
        assert stats["textures_loaded"] == 1
        assert stats["textures_recycled"] == 1
        assert stats["recycle_rate"] == 1.0


class TestDisabledOptimizations:
    """Tests for when optimizations are disabled."""

    def test_disabled_resize(self, temp_image_dir):
        """Test with resizing disabled."""
        config = ImageLoaderConfig(resize_large_images=False)
        loader = ImageLoader(
            display_width=1920,
            display_height=1080,
            mock=True,
            config=config,
        )

        # Should not resize
        assert loader._should_resize(4000, 3000) is False

    def test_load_without_pool(self, temp_image_dir):
        """Test loading without using pool."""
        config = ImageLoaderConfig(texture_pool_size=4)
        loader = ImageLoader(
            display_width=1920,
            display_height=1080,
            mock=True,
            config=config,
        )

        small_path = temp_image_dir / "small.jpg"

        # Load without pool
        texture = loader.load_texture(small_path, use_pool=False)

        # Should not be in pool
        assert str(small_path) not in loader._texture_pool
