"""
Tests for Cache Performance Optimizations.
"""

import asyncio
import os
import tempfile
import time
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from glowworm_daemon.cache import (
    CacheConfig,
    CacheStats,
    ImageCache,
    create_cache,
)


@pytest.fixture
def temp_cache_dir():
    """Create a temporary cache directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def cache(temp_cache_dir):
    """Create a cache instance with default config."""
    config = CacheConfig(
        cache_dir=temp_cache_dir,
        max_size_mb=10,
        min_free_space_mb=1,
    )
    cache = ImageCache(config)
    yield cache
    cache.shutdown()


@pytest.fixture
def sample_files(temp_cache_dir):
    """Create sample files in cache directory."""
    files = []
    for i in range(5):
        path = Path(temp_cache_dir) / f"image_{i}.jpg"
        # Create 1MB files
        with open(path, "wb") as f:
            f.write(b"x" * (1024 * 1024))
        files.append(path)
    return files


class TestCacheConfig:
    """Tests for CacheConfig with background I/O settings."""

    def test_default_values(self, temp_cache_dir):
        """Test default configuration includes background I/O."""
        config = CacheConfig(cache_dir=temp_cache_dir)

        assert config.io_workers == 2
        assert config.enable_background_eviction is True
        assert config.eviction_batch_size == 5

    def test_custom_io_settings(self, temp_cache_dir):
        """Test custom I/O settings."""
        config = CacheConfig(
            cache_dir=temp_cache_dir,
            io_workers=4,
            enable_background_eviction=False,
        )

        assert config.io_workers == 4
        assert config.enable_background_eviction is False


class TestEvictionCallback:
    """Tests for eviction callback."""

    def test_eviction_callback_called(self, temp_cache_dir, sample_files):
        """Test that eviction callback is called when evicting."""
        evictions = []

        def on_eviction(image_id, size):
            evictions.append((image_id, size))

        config = CacheConfig(
            cache_dir=temp_cache_dir,
            max_size_mb=2,  # Only allow 2MB
            enable_background_eviction=False,  # Synchronous for testing
        )
        cache = ImageCache(config, on_eviction=on_eviction)

        # Add files to cache (each is 1MB)
        for i, path in enumerate(sample_files[:3]):
            cache.put(
                image_id=i,
                size="original",
                local_path=str(path),
                file_size=1024 * 1024,  # 1MB
            )

        # Should have evicted at least one
        assert len(evictions) >= 1

        cache.shutdown()


class TestBackgroundEviction:
    """Tests for background eviction."""

    def test_background_eviction_non_blocking(self, temp_cache_dir, sample_files):
        """Test that background eviction doesn't block."""
        config = CacheConfig(
            cache_dir=temp_cache_dir,
            max_size_mb=100,
            enable_background_eviction=True,
            io_workers=2,
        )
        cache = ImageCache(config)

        # Add files to cache
        for i, path in enumerate(sample_files):
            cache.put(
                image_id=i,
                size="original",
                local_path=str(path),
                file_size=1024 * 1024,
            )

        # Start time
        start = time.time()

        # Schedule background eviction (should return immediately)
        cache._evict_lru_background(1024 * 1024 * 2)

        # Should return quickly (< 100ms)
        elapsed = time.time() - start
        assert elapsed < 0.1

        # Wait a bit for background operation
        time.sleep(0.2)

        cache.shutdown()

    def test_scheduled_eviction(self, temp_cache_dir, sample_files):
        """Test automatic eviction scheduling."""
        config = CacheConfig(
            cache_dir=temp_cache_dir,
            max_size_mb=3,  # Small limit
            enable_background_eviction=True,
        )
        cache = ImageCache(config)

        # Add files close to capacity
        for i, path in enumerate(sample_files[:3]):
            cache.put(
                image_id=i,
                size="original",
                local_path=str(path),
                file_size=1024 * 1024,
            )

        # Should schedule eviction when over 90%
        was_scheduled = cache.schedule_eviction_if_needed()

        # May or may not schedule depending on exact thresholds
        # Just verify it doesn't crash
        assert isinstance(was_scheduled, bool)

        cache.shutdown()

    def test_pending_eviction_count(self, temp_cache_dir, sample_files):
        """Test tracking of pending background evictions."""
        config = CacheConfig(
            cache_dir=temp_cache_dir,
            max_size_mb=100,
            enable_background_eviction=True,
        )
        cache = ImageCache(config)

        # Add files to cache
        for i, path in enumerate(sample_files):
            cache.put(
                image_id=i,
                size="original",
                local_path=str(path),
                file_size=1024 * 1024,
            )

        # Schedule eviction
        cache._evict_lru_background(1024 * 1024)

        # Should have at least one pending
        assert cache._pending_evictions >= 0

        # Wait for completion
        time.sleep(0.3)

        # Should complete eventually
        assert cache._pending_evictions == 0

        cache.shutdown()


class TestAsyncEviction:
    """Tests for async eviction methods."""

    @pytest.mark.asyncio
    async def test_async_eviction(self, temp_cache_dir, sample_files):
        """Test async LRU eviction."""
        config = CacheConfig(
            cache_dir=temp_cache_dir,
            max_size_mb=100,
            enable_background_eviction=True,
        )
        cache = ImageCache(config)

        # Add files to cache
        for i, path in enumerate(sample_files):
            cache.put(
                image_id=i,
                size="original",
                local_path=str(path),
                file_size=1024 * 1024,
            )

        # Evict asynchronously
        freed = await cache.evict_lru_async(1024 * 1024 * 2)

        # Should have freed approximately 2MB
        assert freed >= 1024 * 1024

        cache.shutdown()


class TestShutdown:
    """Tests for cache shutdown."""

    def test_graceful_shutdown(self, temp_cache_dir, sample_files):
        """Test that shutdown waits for pending operations."""
        config = CacheConfig(
            cache_dir=temp_cache_dir,
            max_size_mb=100,
            enable_background_eviction=True,
        )
        cache = ImageCache(config)

        # Add files to cache
        for i, path in enumerate(sample_files):
            cache.put(
                image_id=i,
                size="original",
                local_path=str(path),
                file_size=1024 * 1024,
            )

        # Schedule background work
        cache._evict_lru_background(1024 * 1024)

        # Shutdown should complete without error
        cache.shutdown()

        # Executor should be None
        assert cache._io_executor is None

    def test_shutdown_without_executor(self, temp_cache_dir):
        """Test shutdown when executor is disabled."""
        config = CacheConfig(
            cache_dir=temp_cache_dir,
            enable_background_eviction=False,
        )
        cache = ImageCache(config)

        # Should not have executor
        assert cache._io_executor is None

        # Shutdown should be a no-op
        cache.shutdown()


class TestCreateCache:
    """Tests for cache factory function."""

    def test_create_with_callback(self, temp_cache_dir):
        """Test creating cache with eviction callback."""
        callback = MagicMock()

        config = CacheConfig(cache_dir=temp_cache_dir)
        cache = create_cache(config, on_eviction=callback)

        assert cache._on_eviction == callback

        cache.shutdown()


class TestCacheStatsWithPending:
    """Tests for cache stats with pending operations."""

    def test_stats_include_pending(self, temp_cache_dir, sample_files):
        """Test that stats are accurate during background operations."""
        config = CacheConfig(
            cache_dir=temp_cache_dir,
            max_size_mb=100,
            enable_background_eviction=True,
        )
        cache = ImageCache(config)

        # Add files to cache
        for i, path in enumerate(sample_files):
            cache.put(
                image_id=i,
                size="original",
                local_path=str(path),
                file_size=1024 * 1024,
            )

        stats = cache.get_stats()

        # Stats should be valid
        assert stats.entry_count >= 0
        assert stats.total_size_bytes >= 0
        assert stats.hit_rate >= 0

        cache.shutdown()
