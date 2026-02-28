"""
Local Image Cache with LRU eviction and disk space management.

Provides:
- SQLite-based metadata persistence
- LRU eviction when max size exceeded
- Minimum free space protection
- Cache statistics (count, size, hit rate)
"""
import logging
import os
import shutil
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


@dataclass
class CacheConfig:
    """Configuration for the image cache."""
    cache_dir: str = "/var/cache/glowworm/images"
    max_size_mb: int = 500  # Maximum cache size in MB
    min_free_space_mb: int = 100  # Minimum free disk space to maintain
    db_filename: str = "cache.db"

    def __post_init__(self):
        # Ensure cache directory exists
        os.makedirs(self.cache_dir, exist_ok=True)


@dataclass
class CacheEntryMetadata:
    """Metadata for a cached image."""
    image_id: int
    size: str
    local_path: str
    file_size: int
    etag: Optional[str]
    last_modified: Optional[str]
    content_type: Optional[str]
    cached_at: float
    last_accessed: float

    @property
    def age_seconds(self) -> float:
        """Time since this entry was cached."""
        return time.time() - self.cached_at

    @property
    def idle_seconds(self) -> float:
        """Time since this entry was last accessed."""
        return time.time() - self.last_accessed


@dataclass
class CacheStats:
    """Statistics about the image cache."""
    entry_count: int
    total_size_bytes: int
    total_size_mb: float
    max_size_mb: int
    usage_percent: float
    hits: int
    misses: int
    hit_rate: float
    evictions: int
    free_space_mb: float

    def to_dict(self) -> Dict:
        """Convert to dictionary for serialization."""
        return {
            "entry_count": self.entry_count,
            "total_size_bytes": self.total_size_bytes,
            "total_size_mb": round(self.total_size_mb, 2),
            "max_size_mb": self.max_size_mb,
            "usage_percent": round(self.usage_percent, 1),
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": round(self.hit_rate, 3),
            "evictions": self.evictions,
            "free_space_mb": round(self.free_space_mb, 2),
        }


class ImageCache:
    """
    Local image cache with SQLite metadata storage and LRU eviction.

    Features:
    - Persistent metadata storage across daemon restarts
    - LRU eviction when cache size exceeds max_size_mb
    - Free space protection (won't fill disk below min_free_space_mb)
    - Thread-safe operations
    - Cache statistics tracking (hits, misses, evictions)
    """

    def __init__(self, config: CacheConfig):
        self.config = config
        self._db_path = Path(config.cache_dir) / config.db_filename
        self._lock = Lock()

        # Statistics counters
        self._hits = 0
        self._misses = 0
        self._evictions = 0

        # Initialize database
        self._init_db()
        self._reconcile_cache()

    def _init_db(self) -> None:
        """Initialize the SQLite database."""
        with self._lock:
            conn = sqlite3.connect(str(self._db_path))
            try:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS cache_entries (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        image_id INTEGER NOT NULL,
                        size TEXT NOT NULL,
                        local_path TEXT NOT NULL,
                        file_size INTEGER NOT NULL,
                        etag TEXT,
                        last_modified TEXT,
                        content_type TEXT,
                        cached_at REAL NOT NULL,
                        last_accessed REAL NOT NULL,
                        UNIQUE(image_id, size)
                    )
                """)

                # Create index for LRU queries
                conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_last_accessed
                    ON cache_entries(last_accessed)
                """)

                # Create stats table
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS cache_stats (
                        key TEXT PRIMARY KEY,
                        value INTEGER NOT NULL DEFAULT 0
                    )
                """)

                # Initialize stats if not present
                conn.execute("""
                    INSERT OR IGNORE INTO cache_stats (key, value) VALUES
                    ('hits', 0), ('misses', 0), ('evictions', 0)
                """)

                conn.commit()
            finally:
                conn.close()

        logger.debug(f"Cache database initialized at {self._db_path}")

    def _reconcile_cache(self) -> None:
        """
        Reconcile database with actual files on disk.

        Removes entries for files that no longer exist.
        """
        with self._lock:
            conn = sqlite3.connect(str(self._db_path))
            try:
                cursor = conn.execute("SELECT id, local_path FROM cache_entries")
                rows = cursor.fetchall()

                removed = 0
                for row_id, local_path in rows:
                    if not Path(local_path).exists():
                        conn.execute("DELETE FROM cache_entries WHERE id = ?", (row_id,))
                        removed += 1

                if removed > 0:
                    conn.commit()
                    logger.info(f"Reconciled cache: removed {removed} stale entries")

            finally:
                conn.close()

    def _get_db_connection(self) -> sqlite3.Connection:
        """Get a database connection with row factory."""
        conn = sqlite3.connect(str(self._db_path))
        conn.row_factory = sqlite3.Row
        return conn

    def get(self, image_id: int, size: str = "original") -> Optional[CacheEntryMetadata]:
        """
        Get cache entry metadata.

        Updates last_accessed time on hit. Tracks hit/miss statistics.

        Returns:
            CacheEntryMetadata if found and file exists, None otherwise.
        """
        with self._lock:
            conn = self._get_db_connection()
            try:
                cursor = conn.execute(
                    """
                    SELECT * FROM cache_entries
                    WHERE image_id = ? AND size = ?
                    """,
                    (image_id, size)
                )
                row = cursor.fetchone()

                if row is None:
                    self._misses += 1
                    conn.execute(
                        "UPDATE cache_stats SET value = value + 1 WHERE key = 'misses'"
                    )
                    conn.commit()
                    return None

                # Check if file still exists
                local_path = Path(row["local_path"])
                if not local_path.exists():
                    # File deleted externally, remove entry
                    conn.execute(
                        "DELETE FROM cache_entries WHERE image_id = ? AND size = ?",
                        (image_id, size)
                    )
                    self._misses += 1
                    conn.execute(
                        "UPDATE cache_stats SET value = value + 1 WHERE key = 'misses'"
                    )
                    conn.commit()
                    return None

                # Update last_accessed time
                now = time.time()
                conn.execute(
                    """
                    UPDATE cache_entries SET last_accessed = ?
                    WHERE image_id = ? AND size = ?
                    """,
                    (now, image_id, size)
                )

                self._hits += 1
                conn.execute(
                    "UPDATE cache_stats SET value = value + 1 WHERE key = 'hits'"
                )
                conn.commit()

                return CacheEntryMetadata(
                    image_id=row["image_id"],
                    size=row["size"],
                    local_path=row["local_path"],
                    file_size=row["file_size"],
                    etag=row["etag"],
                    last_modified=row["last_modified"],
                    content_type=row["content_type"],
                    cached_at=row["cached_at"],
                    last_accessed=now,
                )

            finally:
                conn.close()

    def put(
        self,
        image_id: int,
        size: str,
        local_path: str,
        file_size: int,
        etag: Optional[str] = None,
        last_modified: Optional[str] = None,
        content_type: Optional[str] = None,
    ) -> bool:
        """
        Add or update a cache entry.

        Triggers eviction if cache size would exceed max_size_mb.

        Returns:
            True if entry was added successfully, False if space couldn't be freed.
        """
        now = time.time()

        # Check space constraints and evict if needed
        if not self._ensure_space(file_size):
            logger.warning(f"Cannot cache image {image_id}: insufficient space")
            return False

        with self._lock:
            conn = self._get_db_connection()
            try:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO cache_entries
                    (image_id, size, local_path, file_size, etag, last_modified,
                     content_type, cached_at, last_accessed)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (image_id, size, local_path, file_size, etag, last_modified,
                     content_type, now, now)
                )
                conn.commit()

                logger.debug(f"Cached image {image_id}:{size} ({file_size} bytes)")
                return True

            finally:
                conn.close()

    def remove(self, image_id: int, size: str = "original") -> bool:
        """
        Remove a cache entry and delete the file.

        Returns:
            True if entry was removed, False if not found.
        """
        with self._lock:
            conn = self._get_db_connection()
            try:
                cursor = conn.execute(
                    "SELECT local_path FROM cache_entries WHERE image_id = ? AND size = ?",
                    (image_id, size)
                )
                row = cursor.fetchone()

                if row is None:
                    return False

                # Delete file
                local_path = Path(row["local_path"])
                if local_path.exists():
                    local_path.unlink()

                # Remove entry
                conn.execute(
                    "DELETE FROM cache_entries WHERE image_id = ? AND size = ?",
                    (image_id, size)
                )
                conn.commit()

                logger.debug(f"Removed cache entry for image {image_id}:{size}")
                return True

            finally:
                conn.close()

    def clear(self) -> int:
        """
        Clear all cache entries and delete all cached files.

        Returns:
            Number of entries cleared.
        """
        with self._lock:
            conn = self._get_db_connection()
            try:
                cursor = conn.execute("SELECT local_path FROM cache_entries")
                rows = cursor.fetchall()

                count = 0
                for row in rows:
                    path = Path(row["local_path"])
                    if path.exists():
                        try:
                            path.unlink()
                            count += 1
                        except OSError as e:
                            logger.warning(f"Failed to delete {path}: {e}")

                conn.execute("DELETE FROM cache_entries")
                conn.commit()

                logger.info(f"Cleared cache: {count} files deleted")
                return count

            finally:
                conn.close()

    def _ensure_space(self, needed_bytes: int) -> bool:
        """
        Ensure there's enough space for a new entry.

        Evicts LRU entries if necessary.

        Returns:
            True if space is available, False if cannot free enough space.
        """
        max_bytes = self.config.max_size_mb * 1024 * 1024
        min_free_bytes = self.config.min_free_space_mb * 1024 * 1024

        # Check if we need to evict
        current_size = self._get_total_size()
        target_size = max_bytes - needed_bytes

        # Also check free disk space
        free_space = self._get_free_space()
        need_to_free = max(
            current_size - target_size,
            min_free_bytes - (free_space - needed_bytes)
        )

        if need_to_free <= 0:
            return True

        # Evict LRU entries
        evicted = self._evict_lru(need_to_free)

        if evicted < need_to_free:
            logger.warning(
                f"Could not free enough space: needed {need_to_free}, freed {evicted}"
            )
            return False

        return True

    def _evict_lru(self, bytes_to_free: int) -> int:
        """
        Evict least recently used entries.

        Returns:
            Number of bytes freed.
        """
        freed = 0

        with self._lock:
            conn = self._get_db_connection()
            try:
                # Get entries ordered by last_accessed (oldest first)
                cursor = conn.execute(
                    """
                    SELECT id, image_id, size, local_path, file_size
                    FROM cache_entries
                    ORDER BY last_accessed ASC
                    """
                )
                entries = cursor.fetchall()

                for entry in entries:
                    if freed >= bytes_to_free:
                        break

                    # Delete file
                    local_path = Path(entry["local_path"])
                    if local_path.exists():
                        try:
                            local_path.unlink()
                            freed += entry["file_size"]
                        except OSError as e:
                            logger.warning(f"Failed to evict {local_path}: {e}")
                            continue

                    # Remove entry
                    conn.execute("DELETE FROM cache_entries WHERE id = ?", (entry["id"],))

                    self._evictions += 1
                    conn.execute(
                        "UPDATE cache_stats SET value = value + 1 WHERE key = 'evictions'"
                    )

                    logger.debug(
                        f"Evicted image {entry['image_id']}:{entry['size']} "
                        f"({entry['file_size']} bytes, freed {freed} total)"
                    )

                conn.commit()

            finally:
                conn.close()

        return freed

    def _get_total_size(self) -> int:
        """Get total size of cached files in bytes."""
        with self._lock:
            conn = self._get_db_connection()
            try:
                cursor = conn.execute("SELECT SUM(file_size) FROM cache_entries")
                result = cursor.fetchone()[0]
                return result or 0
            finally:
                conn.close()

    def _get_free_space(self) -> int:
        """Get free disk space on cache partition in bytes."""
        try:
            stat = shutil.disk_usage(self.config.cache_dir)
            return stat.free
        except OSError:
            # If we can't determine free space, assume plenty
            return 10 * 1024 * 1024 * 1024  # 10GB

    def get_stats(self) -> CacheStats:
        """Get cache statistics."""
        with self._lock:
            conn = self._get_db_connection()
            try:
                # Get counts
                cursor = conn.execute("SELECT COUNT(*) FROM cache_entries")
                entry_count = cursor.fetchone()[0]

                # Get total size
                cursor = conn.execute("SELECT SUM(file_size) FROM cache_entries")
                total_size = cursor.fetchone()[0] or 0

                # Get persistent stats
                cursor = conn.execute("SELECT key, value FROM cache_stats")
                stats_rows = {row["key"]: row["value"] for row in cursor.fetchall()}

                hits = stats_rows.get("hits", 0) + self._hits
                misses = stats_rows.get("misses", 0) + self._misses
                evictions = stats_rows.get("evictions", 0) + self._evictions

                total_requests = hits + misses
                hit_rate = hits / total_requests if total_requests > 0 else 0.0

                max_bytes = self.config.max_size_mb * 1024 * 1024
                usage_percent = (total_size / max_bytes * 100) if max_bytes > 0 else 0

                free_space = self._get_free_space()

                return CacheStats(
                    entry_count=entry_count,
                    total_size_bytes=total_size,
                    total_size_mb=total_size / (1024 * 1024),
                    max_size_mb=self.config.max_size_mb,
                    usage_percent=usage_percent,
                    hits=hits,
                    misses=misses,
                    hit_rate=hit_rate,
                    evictions=evictions,
                    free_space_mb=free_space / (1024 * 1024),
                )

            finally:
                conn.close()

    def list_entries(
        self,
        order_by: str = "last_accessed",
        limit: Optional[int] = None
    ) -> List[CacheEntryMetadata]:
        """
        List all cache entries.

        Args:
            order_by: Column to order by (last_accessed, cached_at, file_size)
            limit: Maximum number of entries to return

        Returns:
            List of cache entry metadata.
        """
        valid_columns = {"last_accessed", "cached_at", "file_size", "image_id"}
        if order_by not in valid_columns:
            order_by = "last_accessed"

        with self._lock:
            conn = self._get_db_connection()
            try:
                query = f"SELECT * FROM cache_entries ORDER BY {order_by} DESC"
                if limit:
                    query += f" LIMIT {limit}"

                cursor = conn.execute(query)
                entries = []

                for row in cursor.fetchall():
                    entries.append(CacheEntryMetadata(
                        image_id=row["image_id"],
                        size=row["size"],
                        local_path=row["local_path"],
                        file_size=row["file_size"],
                        etag=row["etag"],
                        last_modified=row["last_modified"],
                        content_type=row["content_type"],
                        cached_at=row["cached_at"],
                        last_accessed=row["last_accessed"],
                    ))

                return entries

            finally:
                conn.close()

    def contains(self, image_id: int, size: str = "original") -> bool:
        """
        Check if an image is in the cache.

        Unlike get(), this does not update last_accessed or track hits/misses.
        """
        with self._lock:
            conn = self._get_db_connection()
            try:
                cursor = conn.execute(
                    """
                    SELECT local_path FROM cache_entries
                    WHERE image_id = ? AND size = ?
                    """,
                    (image_id, size)
                )
                row = cursor.fetchone()

                if row is None:
                    return False

                # Verify file exists
                return Path(row["local_path"]).exists()

            finally:
                conn.close()

    def get_path(self, image_id: int, size: str = "original") -> Optional[Path]:
        """
        Get the local file path for a cached image.

        Unlike get(), this does not update last_accessed or track statistics.
        Useful for checking file existence without affecting LRU order.
        """
        with self._lock:
            conn = self._get_db_connection()
            try:
                cursor = conn.execute(
                    """
                    SELECT local_path FROM cache_entries
                    WHERE image_id = ? AND size = ?
                    """,
                    (image_id, size)
                )
                row = cursor.fetchone()

                if row is None:
                    return None

                path = Path(row["local_path"])
                return path if path.exists() else None

            finally:
                conn.close()

    def touch(self, image_id: int, size: str = "original") -> bool:
        """
        Update last_accessed time without retrieving metadata.

        Useful for marking an image as recently used without full get().

        Returns:
            True if entry was touched, False if not found.
        """
        with self._lock:
            conn = self._get_db_connection()
            try:
                cursor = conn.execute(
                    """
                    UPDATE cache_entries SET last_accessed = ?
                    WHERE image_id = ? AND size = ?
                    """,
                    (time.time(), image_id, size)
                )
                conn.commit()
                return cursor.rowcount > 0

            finally:
                conn.close()


def create_cache(config: CacheConfig) -> ImageCache:
    """Factory function to create an ImageCache instance."""
    return ImageCache(config)
