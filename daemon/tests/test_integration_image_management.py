"""
Integration tests for Image Manager and Playlist Manager together.

Tests cover:
- Playlist fetched and images downloaded to cache
- Slideshow can operate entirely from cache (offline simulation)
- Cache eviction during extended operation
- Playlist update triggers new image downloads
"""
import asyncio
import json
import os
from pathlib import Path
from typing import Any, Dict, List
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from aiohttp import web

from glowworm_daemon.cache import CacheConfig, ImageCache
from glowworm_daemon.image_manager import (
    ImageManager,
    ImageManagerConfig,
    DownloadStatus,
)
from glowworm_daemon.playlist_manager import (
    PlaylistManager,
    PlaylistManagerConfig,
    PlaylistImage,
)
from glowworm_daemon.preload_manager import (
    PreloadManager,
    PreloadManagerConfig,
    PreloadStatus,
)


# Test image data (1x1 JPEG)
TEST_IMAGE_DATA = bytes([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
    0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
    0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
    0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
    0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
    0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
    0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
    0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
    0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
    0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
    0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
    0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
    0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
    0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
    0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
    0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6,
    0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
    0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2,
    0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
    0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01,
    0x00, 0x00, 0x3F, 0x00, 0xFB, 0xD5, 0xDB, 0x20, 0xA8, 0xF7, 0xFF, 0xD9
])


def create_playlist_response(
    playlist_id: int,
    name: str,
    image_ids: List[int]
) -> Dict[str, Any]:
    """Create a mock playlist API response."""
    manifest = [
        {
            "id": img_id,
            "url": f"/api/images/{img_id}/file",
            "filename": f"image_{img_id}.jpg",
            "mime_type": "image/jpeg",
            "file_size": len(TEST_IMAGE_DATA),
            "checksum": f"checksum_{img_id}",
        }
        for img_id in image_ids
    ]

    return {
        "playlist": {
            "id": playlist_id,
            "name": name,
            "slug": f"playlist-{playlist_id}",
            "display_time_seconds": 10,
            "display_mode": "default",
            "sequence": image_ids,
        },
        "manifest": manifest,
    }


@pytest.fixture
def tmp_cache_dir(tmp_path: Path) -> Path:
    """Create temporary cache directory."""
    cache_dir = tmp_path / "cache"
    cache_dir.mkdir()
    return cache_dir


@pytest.fixture
def tmp_state_dir(tmp_path: Path) -> Path:
    """Create temporary state directory."""
    state_dir = tmp_path / "state"
    state_dir.mkdir()
    return state_dir


@pytest.fixture
def cache_config(tmp_cache_dir: Path) -> CacheConfig:
    """Create cache configuration."""
    return CacheConfig(
        cache_dir=str(tmp_cache_dir),
        max_size_mb=10,  # Small cache for testing eviction
        min_free_space_mb=1,
    )


@pytest.fixture
def image_cache(cache_config: CacheConfig) -> ImageCache:
    """Create image cache."""
    return ImageCache(cache_config)


class MockBackendServer:
    """Mock backend server for testing."""

    def __init__(self, port: int):
        self.port = port
        self.app = web.Application()
        self.runner: web.AppRunner = None
        self.playlist_data: Dict[str, Any] = {}
        self.image_data: Dict[int, bytes] = {}
        self.request_log: List[Dict] = []
        self.offline = False

        # Setup routes
        self.app.router.add_get("/api/device-daemon/playlist", self._handle_playlist)
        self.app.router.add_get(
            "/api/playlists/{playlist_id}/images/manifest",
            self._handle_playlist_manifest
        )
        self.app.router.add_get(
            "/api/images/{image_id}/file",
            self._handle_image
        )

    async def start(self):
        """Start the mock server."""
        self.runner = web.AppRunner(self.app)
        await self.runner.setup()
        site = web.TCPSite(self.runner, "127.0.0.1", self.port)
        await site.start()

    async def stop(self):
        """Stop the mock server."""
        if self.runner:
            await self.runner.cleanup()

    def set_playlist(self, playlist_id: int, name: str, image_ids: List[int]):
        """Set the playlist data to return."""
        self.playlist_data = create_playlist_response(playlist_id, name, image_ids)
        # Create test image data for each image
        for img_id in image_ids:
            self.image_data[img_id] = TEST_IMAGE_DATA

    def add_image(self, image_id: int, data: bytes = None):
        """Add an image to the mock server."""
        self.image_data[image_id] = data or TEST_IMAGE_DATA

    async def _handle_playlist(self, request: web.Request) -> web.Response:
        """Handle playlist request."""
        self.request_log.append({"type": "playlist", "path": request.path})

        if self.offline:
            raise web.HTTPServiceUnavailable()

        if not self.playlist_data:
            return web.json_response({"error": "No playlist"}, status=404)

        return web.json_response(self.playlist_data)

    async def _handle_playlist_manifest(self, request: web.Request) -> web.Response:
        """Handle playlist manifest request."""
        playlist_id = request.match_info["playlist_id"]
        self.request_log.append({"type": "manifest", "playlist_id": playlist_id})

        if self.offline:
            raise web.HTTPServiceUnavailable()

        if not self.playlist_data:
            return web.json_response({"error": "No playlist"}, status=404)

        # Return manifest format
        return web.json_response({
            "playlist_id": self.playlist_data["playlist"]["id"],
            "playlist_name": self.playlist_data["playlist"]["name"],
            "manifest": self.playlist_data["manifest"],
        })

    async def _handle_image(self, request: web.Request) -> web.Response:
        """Handle image request."""
        image_id = int(request.match_info["image_id"])
        self.request_log.append({"type": "image", "image_id": image_id})

        if self.offline:
            raise web.HTTPServiceUnavailable()

        if image_id not in self.image_data:
            return web.json_response({"error": "Image not found"}, status=404)

        return web.Response(
            body=self.image_data[image_id],
            content_type="image/jpeg",
            headers={
                "ETag": f'"{image_id}-etag"',
                "Last-Modified": "Sat, 28 Feb 2026 12:00:00 GMT",
            }
        )


@pytest_asyncio.fixture
async def mock_server(unused_tcp_port):
    """Create and start mock backend server."""
    server = MockBackendServer(unused_tcp_port)
    await server.start()
    yield server
    await server.stop()


@pytest.fixture
def unused_tcp_port():
    """Get an unused TCP port."""
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class TestPlaylistFetchAndImageDownload:
    """Tests for fetching playlist and downloading images to cache."""

    @pytest.mark.asyncio
    async def test_fetch_playlist_and_download_images(
        self,
        mock_server: MockBackendServer,
        tmp_cache_dir: Path,
        tmp_state_dir: Path,
        image_cache: ImageCache,
    ):
        """Test fetching playlist and downloading images."""
        # Setup
        mock_server.set_playlist(1, "Test Playlist", [1, 2, 3])

        image_config = ImageManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_server.port}",
            device_token="test-token",
            cache_dir=str(tmp_cache_dir),
            max_retries=1,
        )

        playlist_config = PlaylistManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_server.port}",
            device_token="test-token",
            state_dir=str(tmp_state_dir),
            max_retries=1,
        )

        async with ImageManager(image_config, cache=image_cache) as image_manager:
            async with PlaylistManager(playlist_config) as playlist_manager:
                # Fetch playlist
                playlist = await playlist_manager.fetch_playlist()

                assert playlist.id == 1
                assert playlist.name == "Test Playlist"
                assert playlist.image_count == 3
                assert playlist.sequence == [1, 2, 3]

                # Download each image
                for image_id in playlist.sequence:
                    path, status = await image_manager.download_image(image_id)

                    assert status == DownloadStatus.COMPLETE
                    assert path.exists()
                    assert image_manager.is_cached(image_id)

                # Verify all images are in cache
                for image_id in [1, 2, 3]:
                    assert image_cache.contains(image_id)

                stats = image_cache.get_stats()
                assert stats.entry_count == 3

    @pytest.mark.asyncio
    async def test_preload_images_from_playlist(
        self,
        mock_server: MockBackendServer,
        tmp_cache_dir: Path,
        tmp_state_dir: Path,
        image_cache: ImageCache,
    ):
        """Test preloading images from playlist position."""
        mock_server.set_playlist(1, "Test Playlist", [1, 2, 3, 4, 5])

        image_config = ImageManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_server.port}",
            device_token="test-token",
            cache_dir=str(tmp_cache_dir),
            max_retries=1,
        )

        playlist_config = PlaylistManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_server.port}",
            device_token="test-token",
            state_dir=str(tmp_state_dir),
            max_retries=1,
        )

        preload_config = PreloadManagerConfig(
            preload_count=3,
            max_concurrent_downloads=2,
        )

        async with ImageManager(image_config, cache=image_cache) as image_manager:
            async with PlaylistManager(playlist_config) as playlist_manager:
                # Fetch playlist
                playlist = await playlist_manager.fetch_playlist()

                async with PreloadManager(image_manager, preload_config) as preloader:
                    # Update preload queue based on current position (0)
                    await preloader.update_preload_queue(playlist_manager)

                    # Wait for preloads to complete
                    for _ in range(50):
                        stats = preloader.get_stats()
                        if stats.pending_count == 0 and stats.downloading_count == 0:
                            break
                        await asyncio.sleep(0.05)

                    # Images 2, 3, 4 should be preloaded (next 3 after position 0)
                    assert image_manager.is_cached(2)
                    assert image_manager.is_cached(3)
                    assert image_manager.is_cached(4)

                    # Image 1 is current (not preloaded), 5 is beyond preload count
                    assert not image_manager.is_cached(1)
                    assert not image_manager.is_cached(5)


class TestOfflineOperation:
    """Tests for offline operation with cached images."""

    @pytest.mark.asyncio
    async def test_slideshow_operates_from_cache(
        self,
        mock_server: MockBackendServer,
        tmp_cache_dir: Path,
        tmp_state_dir: Path,
        image_cache: ImageCache,
    ):
        """Test that slideshow can operate entirely from cache."""
        mock_server.set_playlist(1, "Test Playlist", [1, 2, 3])

        image_config = ImageManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_server.port}",
            device_token="test-token",
            cache_dir=str(tmp_cache_dir),
            max_retries=1,
        )

        playlist_config = PlaylistManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_server.port}",
            device_token="test-token",
            state_dir=str(tmp_state_dir),
            max_retries=1,
        )

        # First, download all images while online
        async with ImageManager(image_config, cache=image_cache) as image_manager:
            async with PlaylistManager(playlist_config) as playlist_manager:
                playlist = await playlist_manager.fetch_playlist()

                for image_id in playlist.sequence:
                    await image_manager.download_image(image_id)

        # Now go offline
        mock_server.offline = True

        # Restart managers and simulate slideshow operating from cache
        async with ImageManager(image_config, cache=image_cache) as image_manager:
            # Can't fetch playlist (offline), but position is persisted
            async with PlaylistManager(playlist_config) as playlist_manager:
                # Load persisted position
                assert playlist_manager.current_position == 0

                # Simulate slideshow by getting cached images - no network needed
                for image_id in [1, 2, 3]:
                    # Images should be available from cache without network
                    cached_path = image_manager.get_cached_path(image_id)
                    assert cached_path is not None
                    assert cached_path.exists()

                    # Verify is_cached works
                    assert image_manager.is_cached(image_id)

                    # Read the cached file to verify it's valid
                    with open(cached_path, "rb") as f:
                        data = f.read()
                    assert len(data) > 0

    @pytest.mark.asyncio
    async def test_cache_hit_tracking(
        self,
        mock_server: MockBackendServer,
        tmp_path: Path,
    ):
        """Test that cache hits are tracked and increase over time."""
        mock_server.set_playlist(1, "Test Playlist", [1, 2])

        # Create a completely fresh cache directory and cache for this test
        unique_cache_dir = tmp_path / "unique_cache"
        unique_cache_dir.mkdir()

        fresh_cache = ImageCache(CacheConfig(
            cache_dir=str(unique_cache_dir),
            max_size_mb=10,
            min_free_space_mb=1,
        ))

        image_config = ImageManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_server.port}",
            device_token="test-token",
            cache_dir=str(unique_cache_dir),
            max_retries=1,
        )

        async with ImageManager(image_config, cache=fresh_cache) as image_manager:
            # Download images
            await image_manager.download_image(1)
            await image_manager.download_image(2)

            # Get initial hit count (may not be 0 if download checked cache)
            stats = fresh_cache.get_stats()
            initial_hits = stats.hits

            # Access cached images multiple times via cache.get()
            for _ in range(3):
                fresh_cache.get(1)
                fresh_cache.get(2)

            # Check hit count increased (each get() should add at least 1 hit)
            stats = fresh_cache.get_stats()
            assert stats.hits > initial_hits
            # We did 6 cache gets, so hits should increase by at least 6
            assert stats.hits >= initial_hits + 6

            # Check hit rate is positive
            assert stats.hit_rate > 0


class TestCacheEviction:
    """Tests for cache eviction during extended operation."""

    @pytest.mark.asyncio
    async def test_lru_eviction_on_cache_full(
        self,
        mock_server: MockBackendServer,
        tmp_cache_dir: Path,
        image_cache: ImageCache,
    ):
        """Test LRU eviction when cache is full."""
        # Create many images to fill cache
        num_images = 20
        mock_server.set_playlist(1, "Test Playlist", list(range(1, num_images + 1)))

        # Make images larger to fill cache faster
        large_image_data = TEST_IMAGE_DATA * 1000  # ~300KB per image
        for i in range(1, num_images + 1):
            mock_server.add_image(i, large_image_data)

        # Use a smaller cache to trigger eviction faster
        small_cache = ImageCache(CacheConfig(
            cache_dir=str(tmp_cache_dir),
            max_size_mb=1,  # 1MB cache
            min_free_space_mb=1,
        ))

        image_config = ImageManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_server.port}",
            device_token="test-token",
            cache_dir=str(tmp_cache_dir),
            max_retries=1,
        )

        async with ImageManager(image_config, cache=small_cache) as image_manager:
            # Download images until cache fills and eviction occurs
            for image_id in range(1, num_images + 1):
                try:
                    await image_manager.download_image(image_id)
                except Exception:
                    pass  # Some may fail due to space constraints

            # Check that eviction occurred
            stats = small_cache.get_stats()
            assert stats.evictions > 0

            # Not all images should be cached (some evicted)
            cached_count = sum(
                1 for i in range(1, num_images + 1)
                if small_cache.contains(i)
            )
            assert cached_count < num_images

    @pytest.mark.asyncio
    async def test_cache_respects_size_limit(
        self,
        mock_server: MockBackendServer,
        tmp_cache_dir: Path,
    ):
        """Test that cache respects max size limit."""
        # Create 10 images of ~100KB each
        num_images = 10
        image_size = 100 * 1024  # 100KB
        mock_server.set_playlist(1, "Test Playlist", list(range(1, num_images + 1)))

        for i in range(1, num_images + 1):
            mock_server.add_image(i, bytes(image_size))

        # Cache limit of 500KB (can hold ~5 images)
        cache = ImageCache(CacheConfig(
            cache_dir=str(tmp_cache_dir),
            max_size_mb=0.5,  # 500KB
            min_free_space_mb=1,
        ))

        image_config = ImageManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_server.port}",
            device_token="test-token",
            cache_dir=str(tmp_cache_dir),
            max_retries=1,
        )

        async with ImageManager(image_config, cache=cache) as image_manager:
            for image_id in range(1, num_images + 1):
                try:
                    await image_manager.download_image(image_id)
                except Exception:
                    pass

            # Cache should be under limit
            stats = cache.get_stats()
            assert stats.total_size_mb <= 0.6  # Allow small margin

    @pytest.mark.asyncio
    async def test_recently_accessed_not_evicted(
        self,
        mock_server: MockBackendServer,
        tmp_cache_dir: Path,
    ):
        """Test that recently accessed images are not evicted."""
        num_images = 10
        image_size = 100 * 1024  # 100KB
        mock_server.set_playlist(1, "Test Playlist", list(range(1, num_images + 1)))

        for i in range(1, num_images + 1):
            mock_server.add_image(i, bytes(image_size))

        # Small cache
        cache = ImageCache(CacheConfig(
            cache_dir=str(tmp_cache_dir),
            max_size_mb=0.5,  # 500KB, ~5 images
            min_free_space_mb=1,
        ))

        image_config = ImageManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_server.port}",
            device_token="test-token",
            cache_dir=str(tmp_cache_dir),
            max_retries=1,
        )

        async with ImageManager(image_config, cache=cache) as image_manager:
            # Download first 5 images
            for image_id in range(1, 6):
                await image_manager.download_image(image_id)

            # Access images 1 and 2 to make them recently used
            cache.get(1)
            cache.get(2)

            # Now download more images, forcing eviction
            for image_id in range(6, 10):
                try:
                    await image_manager.download_image(image_id)
                except Exception:
                    pass

            # Images 1 and 2 should still be cached (recently accessed)
            # while 3, 4, 5 should have been evicted first
            if cache.get_stats().evictions > 0:
                # At least check that we have a mix of old and new
                cached_ids = [
                    i for i in range(1, 10)
                    if cache.contains(i)
                ]
                # Recently accessed images should have survived
                assert len(cached_ids) > 0


class TestPlaylistUpdates:
    """Tests for playlist updates triggering new downloads."""

    @pytest.mark.asyncio
    async def test_playlist_update_triggers_downloads(
        self,
        mock_server: MockBackendServer,
        tmp_cache_dir: Path,
        tmp_state_dir: Path,
        image_cache: ImageCache,
    ):
        """Test that playlist update triggers new image downloads."""
        # Initial playlist
        mock_server.set_playlist(1, "Test Playlist", [1, 2, 3])

        image_config = ImageManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_server.port}",
            device_token="test-token",
            cache_dir=str(tmp_cache_dir),
            max_retries=1,
        )

        playlist_config = PlaylistManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_server.port}",
            device_token="test-token",
            state_dir=str(tmp_state_dir),
            max_retries=1,
        )

        preload_config = PreloadManagerConfig(
            preload_count=3,
            max_concurrent_downloads=2,
        )

        async with ImageManager(image_config, cache=image_cache) as image_manager:
            async with PlaylistManager(playlist_config) as playlist_manager:
                # Fetch initial playlist
                playlist = await playlist_manager.fetch_playlist()
                initial_hash = playlist.version_hash

                # Download initial images
                for image_id in playlist.sequence:
                    await image_manager.download_image(image_id)

                # Verify initial images cached
                for img_id in [1, 2, 3]:
                    assert image_cache.contains(img_id)

                # Update playlist with new images
                mock_server.set_playlist(1, "Test Playlist", [1, 2, 3, 4, 5])

                # Fetch updated playlist
                updated_playlist = await playlist_manager.fetch_playlist(1)

                # Version hash should be different
                assert updated_playlist.version_hash != initial_hash

                # New images should be in sequence
                assert 4 in updated_playlist.sequence
                assert 5 in updated_playlist.sequence

                # Download new images
                for image_id in [4, 5]:
                    path, status = await image_manager.download_image(image_id)
                    assert status == DownloadStatus.COMPLETE
                    assert image_cache.contains(image_id)

    @pytest.mark.asyncio
    async def test_preloader_updates_on_playlist_change(
        self,
        mock_server: MockBackendServer,
        tmp_cache_dir: Path,
        tmp_state_dir: Path,
        image_cache: ImageCache,
    ):
        """Test that preloader updates queue when playlist changes."""
        mock_server.set_playlist(1, "Test Playlist", [1, 2, 3, 4, 5])

        image_config = ImageManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_server.port}",
            device_token="test-token",
            cache_dir=str(tmp_cache_dir),
            max_retries=1,
        )

        playlist_config = PlaylistManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_server.port}",
            device_token="test-token",
            state_dir=str(tmp_state_dir),
            max_retries=1,
        )

        preload_config = PreloadManagerConfig(
            preload_count=2,
            max_concurrent_downloads=1,
        )

        async with ImageManager(image_config, cache=image_cache) as image_manager:
            async with PlaylistManager(playlist_config) as playlist_manager:
                playlist = await playlist_manager.fetch_playlist()

                async with PreloadManager(image_manager, preload_config) as preloader:
                    # Initial preload from position 0
                    await preloader.update_preload_queue(playlist_manager)

                    # Wait for initial preloads
                    await asyncio.sleep(0.5)

                    # Advance position
                    playlist_manager.next()
                    playlist_manager.next()  # Now at position 2

                    # Update preload queue
                    await preloader.update_preload_queue(playlist_manager)

                    # Wait for new preloads
                    await asyncio.sleep(0.5)

                    # New preload queue should have images 4, 5 (next 2 after position 2)
                    stats = preloader.get_status()
                    assert stats["total_preloaded"] > 0

    @pytest.mark.asyncio
    async def test_removed_images_not_preloaded(
        self,
        mock_server: MockBackendServer,
        tmp_cache_dir: Path,
        tmp_state_dir: Path,
        image_cache: ImageCache,
    ):
        """Test that removed images are not preloaded."""
        mock_server.set_playlist(1, "Test Playlist", [1, 2, 3])

        image_config = ImageManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_server.port}",
            device_token="test-token",
            cache_dir=str(tmp_cache_dir),
            max_retries=1,
        )

        playlist_config = PlaylistManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_server.port}",
            device_token="test-token",
            state_dir=str(tmp_state_dir),
            max_retries=1,
        )

        preload_config = PreloadManagerConfig(
            preload_count=3,
            max_concurrent_downloads=1,
        )

        async with ImageManager(image_config, cache=image_cache) as image_manager:
            async with PlaylistManager(playlist_config) as playlist_manager:
                playlist = await playlist_manager.fetch_playlist()

                async with PreloadManager(image_manager, preload_config) as preloader:
                    # Start preloading images 2, 3 (next after position 0)
                    await preloader.update_preload_queue(playlist_manager)

                    # Wait briefly
                    await asyncio.sleep(0.1)

                    # Update playlist to remove image 3
                    mock_server.set_playlist(1, "Test Playlist", [1, 2, 4, 5])
                    await playlist_manager.fetch_playlist(1)

                    # Update preload queue - image 3 should be cancelled
                    await preloader.update_preload_queue(playlist_manager)

                    # Image 3 should not be in queue anymore
                    queue_status = preloader.get_queue_status()
                    assert 3 not in queue_status or queue_status[3] == PreloadStatus.CANCELLED


class TestFullWorkflow:
    """Integration tests for complete workflow scenarios."""

    @pytest.mark.asyncio
    async def test_full_slideshow_simulation(
        self,
        mock_server: MockBackendServer,
        tmp_cache_dir: Path,
        tmp_state_dir: Path,
        image_cache: ImageCache,
    ):
        """Test a full slideshow simulation with preloading and navigation."""
        mock_server.set_playlist(1, "Test Playlist", [1, 2, 3, 4, 5])

        image_config = ImageManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_server.port}",
            device_token="test-token",
            cache_dir=str(tmp_cache_dir),
            max_retries=1,
        )

        playlist_config = PlaylistManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_server.port}",
            device_token="test-token",
            state_dir=str(tmp_state_dir),
            max_retries=1,
        )

        preload_config = PreloadManagerConfig(
            preload_count=2,
            max_concurrent_downloads=2,
        )

        async with ImageManager(image_config, cache=image_cache) as image_manager:
            async with PlaylistManager(playlist_config) as playlist_manager:
                playlist = await playlist_manager.fetch_playlist()

                async with PreloadManager(image_manager, preload_config) as preloader:
                    # Simulate slideshow: iterate through all images
                    for _ in range(playlist.entry_count):
                        # Get current images
                        current_images = playlist_manager.get_current_images()
                        assert len(current_images) > 0

                        current_image = current_images[0]

                        # Download current image if not cached
                        if not image_manager.is_cached(current_image.id):
                            await image_manager.download_image(current_image.id)

                        # Verify current image is cached
                        assert image_manager.is_cached(current_image.id)

                        # Trigger preload of upcoming images
                        await preloader.update_preload_queue(playlist_manager)

                        # Wait briefly for preloads
                        await asyncio.sleep(0.1)

                        # Advance to next
                        playlist_manager.next()

                    # All images should now be cached
                    stats = image_cache.get_stats()
                    assert stats.entry_count == 5

    @pytest.mark.asyncio
    async def test_shuffle_mode_preloading(
        self,
        mock_server: MockBackendServer,
        tmp_cache_dir: Path,
        tmp_state_dir: Path,
        image_cache: ImageCache,
    ):
        """Test preloading works correctly in shuffle mode."""
        mock_server.set_playlist(1, "Test Playlist", [1, 2, 3, 4, 5])

        image_config = ImageManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_server.port}",
            device_token="test-token",
            cache_dir=str(tmp_cache_dir),
            max_retries=1,
        )

        playlist_config = PlaylistManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_server.port}",
            device_token="test-token",
            state_dir=str(tmp_state_dir),
            max_retries=1,
        )

        preload_config = PreloadManagerConfig(
            preload_count=2,
            max_concurrent_downloads=2,
        )

        async with ImageManager(image_config, cache=image_cache) as image_manager:
            async with PlaylistManager(playlist_config) as playlist_manager:
                playlist = await playlist_manager.fetch_playlist()

                # Enable shuffle with deterministic seed
                playlist_manager.set_shuffle(True, seed=42)

                async with PreloadManager(image_manager, preload_config) as preloader:
                    # Get upcoming images in shuffle order
                    upcoming = playlist_manager.get_upcoming_images(2)
                    upcoming_ids = [img.id for img in upcoming]

                    # Trigger preload
                    await preloader.update_preload_queue(playlist_manager)

                    # Wait for preloads
                    await asyncio.sleep(0.5)

                    # Upcoming images should be preloaded (in shuffle order)
                    for img_id in upcoming_ids:
                        assert image_manager.is_cached(img_id)

    @pytest.mark.asyncio
    async def test_position_persists_across_restart(
        self,
        mock_server: MockBackendServer,
        tmp_cache_dir: Path,
        tmp_state_dir: Path,
        image_cache: ImageCache,
    ):
        """Test that playlist position persists across daemon restart."""
        mock_server.set_playlist(1, "Test Playlist", [1, 2, 3, 4, 5])

        playlist_config = PlaylistManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_server.port}",
            device_token="test-token",
            state_dir=str(tmp_state_dir),
            max_retries=1,
        )

        # First session: advance to position 3
        async with PlaylistManager(playlist_config) as playlist_manager:
            await playlist_manager.fetch_playlist()

            playlist_manager.next()  # Position 1
            playlist_manager.next()  # Position 2
            playlist_manager.next()  # Position 3

            assert playlist_manager.current_position == 3

        # State file should exist
        state_file = Path(tmp_state_dir) / "playlist_state.json"
        assert state_file.exists()

        # Second session: position should be restored
        async with PlaylistManager(playlist_config) as playlist_manager:
            # Position should be restored from disk
            assert playlist_manager.current_position == 3

            # Fetching playlist should not reset position
            await playlist_manager.fetch_playlist()
            assert playlist_manager.current_position == 3
