"""
Unit tests for the ImageCache module.

Tests cover:
- Cache initialization and database setup
- Put/get operations
- LRU eviction
- Free space protection
- Cache statistics
- Cache clearing
- Cache reconciliation
"""
import os
import shutil
import sqlite3
import tempfile
import time
from pathlib import Path
from unittest.mock import patch

import pytest

from glowworm_daemon.cache import (
    CacheConfig,
    CacheEntryMetadata,
    CacheStats,
    ImageCache,
    create_cache,
)


@pytest.fixture
def temp_cache_dir():
    """Create a temporary cache directory."""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    # Cleanup
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture
def cache_config(temp_cache_dir):
    """Create a cache config with temporary directory."""
    return CacheConfig(
        cache_dir=temp_cache_dir,
        max_size_mb=10,
        min_free_space_mb=50,
    )


@pytest.fixture
def cache(cache_config):
    """Create an ImageCache instance."""
    return ImageCache(cache_config)


def create_test_file(cache_dir: str, image_id: int, size_bytes: int = 1024) -> str:
    """Create a test file in the cache directory."""
    path = Path(cache_dir) / f"{image_id}.jpg"
    with open(path, "wb") as f:
        f.write(b"x" * size_bytes)
    return str(path)


class TestCacheConfig:
    """Tests for CacheConfig dataclass."""

    def test_default_values(self, temp_cache_dir):
        """Test default configuration values."""
        config = CacheConfig(cache_dir=temp_cache_dir)
        assert config.max_size_mb == 500
        assert config.min_free_space_mb == 100
        assert config.db_filename == "cache.db"

    def test_creates_cache_directory(self):
        """Test that cache directory is created on init."""
        with tempfile.TemporaryDirectory() as temp_dir:
            cache_path = Path(temp_dir) / "new_cache"
            config = CacheConfig(cache_dir=str(cache_path))
            assert cache_path.exists()


class TestCacheInitialization:
    """Tests for cache initialization."""

    def test_creates_database(self, cache_config):
        """Test that database is created on initialization."""
        cache = ImageCache(cache_config)
        db_path = Path(cache_config.cache_dir) / cache_config.db_filename
        assert db_path.exists()

    def test_creates_tables(self, cache_config):
        """Test that required tables are created."""
        cache = ImageCache(cache_config)
        db_path = Path(cache_config.cache_dir) / cache_config.db_filename

        conn = sqlite3.connect(str(db_path))
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )
        tables = {row[0] for row in cursor.fetchall()}
        conn.close()

        assert "cache_entries" in tables
        assert "cache_stats" in tables

    def test_factory_function(self, cache_config):
        """Test create_cache factory function."""
        cache = create_cache(cache_config)
        assert isinstance(cache, ImageCache)


class TestCachePutGet:
    """Tests for put/get operations."""

    def test_put_and_get(self, cache, cache_config):
        """Test basic put and get operations."""
        local_path = create_test_file(cache_config.cache_dir, 1)

        result = cache.put(
            image_id=1,
            size="original",
            local_path=local_path,
            file_size=1024,
            etag="abc123",
            last_modified="Fri, 28 Feb 2026 12:00:00 GMT",
            content_type="image/jpeg",
        )
        assert result is True

        entry = cache.get(1, "original")
        assert entry is not None
        assert entry.image_id == 1
        assert entry.size == "original"
        assert entry.local_path == local_path
        assert entry.file_size == 1024
        assert entry.etag == "abc123"
        assert entry.last_modified == "Fri, 28 Feb 2026 12:00:00 GMT"
        assert entry.content_type == "image/jpeg"

    def test_get_updates_last_accessed(self, cache, cache_config):
        """Test that get() updates last_accessed time."""
        local_path = create_test_file(cache_config.cache_dir, 1)
        cache.put(image_id=1, size="original", local_path=local_path, file_size=1024)

        entry1 = cache.get(1, "original")
        time.sleep(0.1)
        entry2 = cache.get(1, "original")

        assert entry2.last_accessed > entry1.last_accessed

    def test_get_nonexistent_returns_none(self, cache):
        """Test that get() returns None for nonexistent entry."""
        entry = cache.get(999, "original")
        assert entry is None

    def test_get_missing_file_returns_none(self, cache, cache_config):
        """Test that get() returns None if file is missing."""
        local_path = create_test_file(cache_config.cache_dir, 1)
        cache.put(image_id=1, size="original", local_path=local_path, file_size=1024)

        # Delete the file
        os.unlink(local_path)

        entry = cache.get(1, "original")
        assert entry is None

    def test_put_replaces_existing(self, cache, cache_config):
        """Test that put() replaces existing entry."""
        local_path = create_test_file(cache_config.cache_dir, 1)
        cache.put(image_id=1, size="original", local_path=local_path, file_size=1024, etag="v1")

        cache.put(image_id=1, size="original", local_path=local_path, file_size=2048, etag="v2")

        entry = cache.get(1, "original")
        assert entry.file_size == 2048
        assert entry.etag == "v2"

    def test_different_sizes_stored_separately(self, cache, cache_config):
        """Test that same image with different sizes stored separately."""
        path1 = create_test_file(cache_config.cache_dir, 1, size_bytes=1024)
        path2 = str(Path(cache_config.cache_dir) / "1_medium.jpg")
        with open(path2, "wb") as f:
            f.write(b"x" * 512)

        cache.put(image_id=1, size="original", local_path=path1, file_size=1024)
        cache.put(image_id=1, size="medium", local_path=path2, file_size=512)

        original = cache.get(1, "original")
        medium = cache.get(1, "medium")

        assert original.file_size == 1024
        assert medium.file_size == 512


class TestCacheStatistics:
    """Tests for cache statistics."""

    def test_tracks_hits_and_misses(self, cache, cache_config):
        """Test that hits and misses are tracked."""
        local_path = create_test_file(cache_config.cache_dir, 1)
        cache.put(image_id=1, size="original", local_path=local_path, file_size=1024)

        # Generate hits
        cache.get(1, "original")
        cache.get(1, "original")

        # Generate misses
        cache.get(999, "original")
        cache.get(998, "original")

        stats = cache.get_stats()
        assert stats.hits >= 2
        assert stats.misses >= 2
        assert stats.hit_rate > 0

    def test_reports_total_size(self, cache, cache_config):
        """Test that total cache size is reported."""
        create_test_file(cache_config.cache_dir, 1, size_bytes=1000)
        cache.put(image_id=1, size="original",
                  local_path=str(Path(cache_config.cache_dir) / "1.jpg"),
                  file_size=1000)

        create_test_file(cache_config.cache_dir, 2, size_bytes=2000)
        cache.put(image_id=2, size="original",
                  local_path=str(Path(cache_config.cache_dir) / "2.jpg"),
                  file_size=2000)

        stats = cache.get_stats()
        assert stats.total_size_bytes == 3000
        assert stats.entry_count == 2

    def test_usage_percent(self, cache, cache_config):
        """Test usage percent calculation."""
        # Cache is configured for 10MB max
        # Add 1MB of data
        size_bytes = 1 * 1024 * 1024
        path = str(Path(cache_config.cache_dir) / "1.jpg")
        with open(path, "wb") as f:
            f.write(b"x" * size_bytes)
        cache.put(image_id=1, size="original", local_path=path, file_size=size_bytes)

        stats = cache.get_stats()
        assert stats.usage_percent == pytest.approx(10.0, rel=0.1)

    def test_stats_to_dict(self, cache, cache_config):
        """Test CacheStats.to_dict() method."""
        local_path = create_test_file(cache_config.cache_dir, 1)
        cache.put(image_id=1, size="original", local_path=local_path, file_size=1024)

        stats = cache.get_stats()
        stats_dict = stats.to_dict()

        assert "entry_count" in stats_dict
        assert "total_size_bytes" in stats_dict
        assert "hits" in stats_dict
        assert "misses" in stats_dict
        assert "hit_rate" in stats_dict
        assert "evictions" in stats_dict


class TestLRUEviction:
    """Tests for LRU eviction."""

    def test_evicts_oldest_accessed(self, temp_cache_dir):
        """Test that LRU eviction removes oldest accessed entries."""
        # max_size of 10KB means:
        # - When adding a 5KB entry, target_size = 10KB - 5KB = 5KB
        # - If current_size > 5KB, eviction is triggered
        config = CacheConfig(
            cache_dir=temp_cache_dir,
            max_size_mb=0.010,  # 10KB max
            min_free_space_mb=0,
        )
        cache = ImageCache(config)

        # Add first entry (5KB) - fits in max size
        path1 = create_test_file(temp_cache_dir, 1, size_bytes=5000)
        cache.put(image_id=1, size="original", local_path=path1, file_size=5000)
        time.sleep(0.1)

        # Add second entry (5KB) - total now 10KB, equals max
        path2 = create_test_file(temp_cache_dir, 2, size_bytes=5000)
        cache.put(image_id=2, size="original", local_path=path2, file_size=5000)
        time.sleep(0.1)

        # Access image 1 to make it more recently used than image 2
        cache.get(1, "original")
        time.sleep(0.1)

        # Add a third file (5KB) - current_size (10KB) > target (5KB)
        # Should evict image 2 (oldest by last_accessed)
        path3 = create_test_file(temp_cache_dir, 3, size_bytes=5000)
        cache.put(image_id=3, size="original", local_path=path3, file_size=5000)

        # Image 1 should be kept (recently accessed)
        assert cache.contains(1, "original")
        # Image 2 should be evicted (oldest not recently accessed)
        assert not cache.contains(2, "original")
        # Image 3 should be present (just added)
        assert cache.contains(3, "original")

    def test_eviction_deletes_files(self, temp_cache_dir):
        """Test that evicted entries have their files deleted."""
        config = CacheConfig(
            cache_dir=temp_cache_dir,
            max_size_mb=0.005,  # 5KB max
            min_free_space_mb=0,
        )
        cache = ImageCache(config)

        # Add 10KB total (will trigger eviction)
        path1 = create_test_file(temp_cache_dir, 1, size_bytes=5000)
        cache.put(image_id=1, size="original", local_path=path1, file_size=5000)
        time.sleep(0.1)

        path2 = create_test_file(temp_cache_dir, 2, size_bytes=5000)
        cache.put(image_id=2, size="original", local_path=path2, file_size=5000)

        # First file should be evicted
        assert not Path(path1).exists()

    def test_tracks_eviction_count(self, temp_cache_dir):
        """Test that eviction count is tracked."""
        config = CacheConfig(
            cache_dir=temp_cache_dir,
            max_size_mb=0.005,  # 5KB max
            min_free_space_mb=0,
        )
        cache = ImageCache(config)

        # Force evictions
        for i in range(1, 5):
            path = create_test_file(temp_cache_dir, i, size_bytes=3000)
            cache.put(image_id=i, size="original", local_path=path, file_size=3000)

        stats = cache.get_stats()
        assert stats.evictions > 0


class TestFreeSpaceProtection:
    """Tests for minimum free space protection."""

    def test_respects_min_free_space(self, temp_cache_dir):
        """Test that cache respects min_free_space_mb setting."""
        config = CacheConfig(
            cache_dir=temp_cache_dir,
            max_size_mb=1000,  # Large max size
            min_free_space_mb=1024 * 1024,  # Unrealistically large (1TB)
        )
        cache = ImageCache(config)

        path = create_test_file(temp_cache_dir, 1, size_bytes=1024)

        # Should fail because we can't maintain 1TB free space
        result = cache.put(image_id=1, size="original", local_path=path, file_size=1024)

        # Entry should be rejected
        assert result is False


class TestCacheRemoveAndClear:
    """Tests for remove and clear operations."""

    def test_remove_entry(self, cache, cache_config):
        """Test removing a single entry."""
        local_path = create_test_file(cache_config.cache_dir, 1)
        cache.put(image_id=1, size="original", local_path=local_path, file_size=1024)

        result = cache.remove(1, "original")
        assert result is True
        assert not cache.contains(1, "original")
        assert not Path(local_path).exists()

    def test_remove_nonexistent(self, cache):
        """Test removing nonexistent entry."""
        result = cache.remove(999, "original")
        assert result is False

    def test_clear_all(self, cache, cache_config):
        """Test clearing all entries."""
        paths = []
        for i in range(1, 6):
            path = create_test_file(cache_config.cache_dir, i)
            paths.append(path)
            cache.put(image_id=i, size="original", local_path=path, file_size=1024)

        count = cache.clear()
        assert count == 5

        stats = cache.get_stats()
        assert stats.entry_count == 0

        for path in paths:
            assert not Path(path).exists()


class TestCacheReconciliation:
    """Tests for cache reconciliation with filesystem."""

    def test_removes_stale_entries(self, temp_cache_dir):
        """Test that stale entries are removed on startup."""
        config = CacheConfig(cache_dir=temp_cache_dir)

        # Create cache and add entry
        cache1 = ImageCache(config)
        path = create_test_file(temp_cache_dir, 1)
        cache1.put(image_id=1, size="original", local_path=path, file_size=1024)

        # Delete the file externally
        os.unlink(path)

        # Create new cache instance - should reconcile
        cache2 = ImageCache(config)

        # Entry should be gone
        assert not cache2.contains(1, "original")


class TestCacheUtilityMethods:
    """Tests for utility methods."""

    def test_contains(self, cache, cache_config):
        """Test contains() method."""
        local_path = create_test_file(cache_config.cache_dir, 1)
        cache.put(image_id=1, size="original", local_path=local_path, file_size=1024)

        assert cache.contains(1, "original")
        assert not cache.contains(999, "original")

    def test_contains_missing_file(self, cache, cache_config):
        """Test contains() returns False if file is missing."""
        local_path = create_test_file(cache_config.cache_dir, 1)
        cache.put(image_id=1, size="original", local_path=local_path, file_size=1024)

        os.unlink(local_path)
        assert not cache.contains(1, "original")

    def test_get_path(self, cache, cache_config):
        """Test get_path() method."""
        local_path = create_test_file(cache_config.cache_dir, 1)
        cache.put(image_id=1, size="original", local_path=local_path, file_size=1024)

        result = cache.get_path(1, "original")
        assert result == Path(local_path)

        # Nonexistent
        assert cache.get_path(999, "original") is None

    def test_touch(self, cache, cache_config):
        """Test touch() method updates last_accessed."""
        local_path = create_test_file(cache_config.cache_dir, 1)
        cache.put(image_id=1, size="original", local_path=local_path, file_size=1024)

        entry1 = cache.get(1, "original")
        time.sleep(0.1)

        result = cache.touch(1, "original")
        assert result is True

        entry2 = cache.get(1, "original")
        assert entry2.last_accessed > entry1.last_accessed

    def test_touch_nonexistent(self, cache):
        """Test touch() returns False for nonexistent entry."""
        result = cache.touch(999, "original")
        assert result is False

    def test_list_entries(self, cache, cache_config):
        """Test list_entries() method."""
        for i in range(1, 4):
            path = create_test_file(cache_config.cache_dir, i)
            cache.put(image_id=i, size="original", local_path=path, file_size=i * 1000)
            time.sleep(0.05)

        entries = cache.list_entries()
        assert len(entries) == 3

        # Default order is by last_accessed DESC
        assert entries[0].image_id == 3  # Most recent

    def test_list_entries_with_limit(self, cache, cache_config):
        """Test list_entries() with limit parameter."""
        for i in range(1, 11):
            path = create_test_file(cache_config.cache_dir, i)
            cache.put(image_id=i, size="original", local_path=path, file_size=1024)

        entries = cache.list_entries(limit=5)
        assert len(entries) == 5

    def test_list_entries_order_by(self, cache, cache_config):
        """Test list_entries() with order_by parameter."""
        for i in range(1, 4):
            path = create_test_file(cache_config.cache_dir, i, size_bytes=i * 1000)
            cache.put(image_id=i, size="original", local_path=path, file_size=i * 1000)

        entries = cache.list_entries(order_by="file_size")
        assert entries[0].file_size >= entries[1].file_size >= entries[2].file_size


class TestCacheEntryMetadata:
    """Tests for CacheEntryMetadata dataclass."""

    def test_age_seconds(self):
        """Test age_seconds property."""
        entry = CacheEntryMetadata(
            image_id=1,
            size="original",
            local_path="/tmp/1.jpg",
            file_size=1024,
            etag=None,
            last_modified=None,
            content_type="image/jpeg",
            cached_at=time.time() - 60,  # 60 seconds ago
            last_accessed=time.time(),
        )
        assert entry.age_seconds >= 59
        assert entry.age_seconds <= 61

    def test_idle_seconds(self):
        """Test idle_seconds property."""
        entry = CacheEntryMetadata(
            image_id=1,
            size="original",
            local_path="/tmp/1.jpg",
            file_size=1024,
            etag=None,
            last_modified=None,
            content_type="image/jpeg",
            cached_at=time.time() - 120,
            last_accessed=time.time() - 30,  # 30 seconds ago
        )
        assert entry.idle_seconds >= 29
        assert entry.idle_seconds <= 31
