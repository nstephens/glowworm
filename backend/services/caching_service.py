"""
Caching service for API responses and frequently accessed data.
Implements in-memory caching with TTL and cache invalidation strategies.
"""

import time
import json
import hashlib
import logging
from typing import Any, Optional, Dict, List, Callable
from functools import wraps
from datetime import datetime, timedelta
import threading

logger = logging.getLogger(__name__)

class CacheEntry:
    """Individual cache entry with TTL and metadata"""
    
    def __init__(self, value: Any, ttl_seconds: int = 300):
        self.value = value
        self.created_at = time.time()
        self.ttl_seconds = ttl_seconds
        self.access_count = 0
        self.last_accessed = self.created_at
    
    def is_expired(self) -> bool:
        """Check if cache entry has expired"""
        return time.time() - self.created_at > self.ttl_seconds
    
    def access(self) -> Any:
        """Access the cached value and update metadata"""
        self.access_count += 1
        self.last_accessed = time.time()
        return self.value
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert cache entry to dictionary for monitoring"""
        return {
            'created_at': datetime.fromtimestamp(self.created_at).isoformat(),
            'ttl_seconds': self.ttl_seconds,
            'access_count': self.access_count,
            'last_accessed': datetime.fromtimestamp(self.last_accessed).isoformat(),
            'is_expired': self.is_expired(),
            'age_seconds': time.time() - self.created_at
        }

class CachingService:
    """Thread-safe in-memory caching service with TTL and invalidation"""
    
    def __init__(self, max_size: int = 1000, default_ttl: int = 300):
        self.max_size = max_size
        self.default_ttl = default_ttl
        self._cache: Dict[str, CacheEntry] = {}
        self._lock = threading.RLock()
        self._stats = {
            'hits': 0,
            'misses': 0,
            'evictions': 0,
            'invalidations': 0
        }
    
    def _generate_key(self, prefix: str, *args, **kwargs) -> str:
        """Generate a cache key from arguments"""
        # Create a hash of the arguments
        key_data = {
            'prefix': prefix,
            'args': args,
            'kwargs': sorted(kwargs.items()) if kwargs else {}
        }
        key_string = json.dumps(key_data, sort_keys=True, default=str)
        return hashlib.md5(key_string.encode()).hexdigest()
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        with self._lock:
            if key not in self._cache:
                self._stats['misses'] += 1
                return None
            
            entry = self._cache[key]
            if entry.is_expired():
                del self._cache[key]
                self._stats['misses'] += 1
                return None
            
            self._stats['hits'] += 1
            return entry.access()
    
    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        """Set value in cache with TTL"""
        with self._lock:
            ttl = ttl_seconds or self.default_ttl
            
            # Check if we need to evict entries
            if len(self._cache) >= self.max_size and key not in self._cache:
                self._evict_oldest()
            
            self._cache[key] = CacheEntry(value, ttl)
    
    def delete(self, key: str) -> bool:
        """Delete entry from cache"""
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                self._stats['invalidations'] += 1
                return True
            return False
    
    def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate all keys matching a pattern"""
        with self._lock:
            keys_to_delete = [key for key in self._cache.keys() if pattern in key]
            for key in keys_to_delete:
                del self._cache[key]
            
            self._stats['invalidations'] += len(keys_to_delete)
            return len(keys_to_delete)
    
    def clear(self) -> None:
        """Clear all cache entries"""
        with self._lock:
            self._cache.clear()
            self._stats['invalidations'] += len(self._cache)
    
    def _evict_oldest(self) -> None:
        """Evict the least recently accessed entry"""
        if not self._cache:
            return
        
        oldest_key = min(
            self._cache.keys(),
            key=lambda k: self._cache[k].last_accessed
        )
        del self._cache[oldest_key]
        self._stats['evictions'] += 1
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        with self._lock:
            total_requests = self._stats['hits'] + self._stats['misses']
            hit_rate = (self._stats['hits'] / total_requests * 100) if total_requests > 0 else 0
            
            # Clean up expired entries for accurate count
            expired_keys = [k for k, v in self._cache.items() if v.is_expired()]
            for key in expired_keys:
                del self._cache[key]
            
            return {
                'size': len(self._cache),
                'max_size': self.max_size,
                'hit_rate_percent': round(hit_rate, 2),
                'hits': self._stats['hits'],
                'misses': self._stats['misses'],
                'evictions': self._stats['evictions'],
                'invalidations': self._stats['invalidations'],
                'entries': {
                    key: entry.to_dict() 
                    for key, entry in self._cache.items()
                }
            }
    
    def cleanup_expired(self) -> int:
        """Remove expired entries and return count of removed entries"""
        with self._lock:
            expired_keys = [k for k, v in self._cache.items() if v.is_expired()]
            for key in expired_keys:
                del self._cache[key]
            return len(expired_keys)

# Global cache instance
cache_service = CachingService(max_size=2000, default_ttl=300)

def cached(prefix: str, ttl_seconds: int = 300, key_func: Optional[Callable] = None):
    """Decorator for caching function results"""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key
            if key_func:
                cache_key = key_func(*args, **kwargs)
            else:
                cache_key = cache_service._generate_key(prefix, *args, **kwargs)
            
            # Try to get from cache
            cached_result = cache_service.get(cache_key)
            if cached_result is not None:
                logger.debug(f"Cache hit for {prefix}: {cache_key[:16]}...")
                return cached_result
            
            # Execute function and cache result
            logger.debug(f"Cache miss for {prefix}: {cache_key[:16]}...")
            result = func(*args, **kwargs)
            cache_service.set(cache_key, result, ttl_seconds)
            
            return result
        
        return wrapper
    return decorator

def invalidate_cache(prefix: str, *args, **kwargs) -> bool:
    """Invalidate specific cache entry"""
    cache_key = cache_service._generate_key(prefix, *args, **kwargs)
    return cache_service.delete(cache_key)

def invalidate_cache_pattern(pattern: str) -> int:
    """Invalidate all cache entries matching pattern"""
    return cache_service.invalidate_pattern(pattern)

def get_cache_stats() -> Dict[str, Any]:
    """Get cache statistics"""
    return cache_service.get_stats()

def clear_cache() -> None:
    """Clear all cache entries"""
    cache_service.clear()

# Cache key generators for common use cases
def image_stats_key() -> str:
    """Generate cache key for image statistics"""
    return "image_stats"

def playlist_stats_key() -> str:
    """Generate cache key for playlist statistics"""
    return "playlist_stats"

def album_stats_key() -> str:
    """Generate cache key for album statistics"""
    return "album_stats"

def image_list_key(album_id: Optional[int] = None, playlist_id: Optional[int] = None, 
                  limit: int = 100, offset: int = 0) -> str:
    """Generate cache key for image list queries"""
    return cache_service._generate_key("image_list", album_id, playlist_id, limit, offset)

def playlist_images_key(playlist_id: int) -> str:
    """Generate cache key for playlist images"""
    return cache_service._generate_key("playlist_images", playlist_id)

def duplicate_images_key() -> str:
    """Generate cache key for duplicate images"""
    return "duplicate_images"

# Cache invalidation functions
def invalidate_image_cache(image_id: Optional[int] = None) -> int:
    """Invalidate image-related cache entries"""
    if image_id:
        # Invalidate specific image caches
        return invalidate_cache_pattern(f"image_{image_id}")
    else:
        # Invalidate all image-related caches
        patterns = ["image_list", "image_stats", "duplicate_images"]
        total_invalidated = 0
        for pattern in patterns:
            total_invalidated += invalidate_cache_pattern(pattern)
        return total_invalidated

def invalidate_playlist_cache(playlist_id: Optional[int] = None) -> int:
    """Invalidate playlist-related cache entries"""
    if playlist_id:
        # Invalidate specific playlist caches
        return invalidate_cache_pattern(f"playlist_{playlist_id}")
    else:
        # Invalidate all playlist-related caches
        patterns = ["playlist_images", "playlist_stats"]
        total_invalidated = 0
        for pattern in patterns:
            total_invalidated += invalidate_cache_pattern(pattern)
        return total_invalidated

def invalidate_album_cache(album_id: Optional[int] = None) -> int:
    """Invalidate album-related cache entries"""
    if album_id:
        # Invalidate specific album caches
        return invalidate_cache_pattern(f"album_{album_id}")
    else:
        # Invalidate all album-related caches
        return invalidate_cache_pattern("album_stats")














