"""
Tests for ImageManager HTTP client.
"""
import asyncio
import os
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from glowworm_daemon.image_manager import (
    ImageManager,
    ImageManagerConfig,
    ImageManagerError,
    ImageNotFoundError,
    AuthenticationError,
    DownloadStatus,
    DownloadProgress,
    CacheEntry,
)


@pytest.fixture
def temp_cache_dir():
    """Create a temporary cache directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def config(temp_cache_dir):
    """Create test configuration."""
    return ImageManagerConfig(
        backend_url="http://localhost:8000",
        device_token="test-token-123",
        cache_dir=temp_cache_dir,
        max_retries=3,
        retry_base_delay=0.01,  # Fast retries for tests
        retry_max_delay=0.1,
    )


@pytest.fixture
def image_manager(config):
    """Create ImageManager instance."""
    return ImageManager(config)


class TestImageManagerConfig:
    """Tests for ImageManagerConfig."""

    def test_default_values(self, temp_cache_dir):
        """Test default configuration values."""
        config = ImageManagerConfig(
            backend_url="http://test.com",
            device_token="token",
            cache_dir=temp_cache_dir,
        )
        assert config.connect_timeout == 10.0
        assert config.read_timeout == 60.0
        assert config.max_retries == 3
        assert config.retry_base_delay == 1.0
        assert config.retry_max_delay == 60.0
        assert config.chunk_size == 65536

    def test_cache_dir_created(self, temp_cache_dir):
        """Test that cache directory is created if it doesn't exist."""
        new_cache_dir = os.path.join(temp_cache_dir, "new_cache")
        config = ImageManagerConfig(
            backend_url="http://test.com",
            device_token="token",
            cache_dir=new_cache_dir,
        )
        assert os.path.exists(config.cache_dir)


class TestCacheEntry:
    """Tests for CacheEntry."""

    def test_defaults(self):
        """Test default values."""
        entry = CacheEntry()
        assert entry.etag is None
        assert entry.last_modified is None
        assert entry.local_path is None
        assert entry.file_size == 0
        assert entry.cached_at > 0

    def test_with_values(self):
        """Test with provided values."""
        entry = CacheEntry(
            etag='"abc123"',
            last_modified="Wed, 21 Oct 2025 07:28:00 GMT",
            local_path="/cache/image.jpg",
            file_size=1024,
        )
        assert entry.etag == '"abc123"'
        assert entry.last_modified == "Wed, 21 Oct 2025 07:28:00 GMT"
        assert entry.local_path == "/cache/image.jpg"
        assert entry.file_size == 1024


class TestDownloadProgress:
    """Tests for DownloadProgress."""

    def test_is_complete(self):
        """Test is_complete property."""
        progress = DownloadProgress(url="http://test.com", status=DownloadStatus.COMPLETE)
        assert progress.is_complete is True

        progress = DownloadProgress(url="http://test.com", status=DownloadStatus.CACHED)
        assert progress.is_complete is True

        progress = DownloadProgress(url="http://test.com", status=DownloadStatus.DOWNLOADING)
        assert progress.is_complete is False

    def test_is_failed(self):
        """Test is_failed property."""
        progress = DownloadProgress(url="http://test.com", status=DownloadStatus.FAILED)
        assert progress.is_failed is True

        progress = DownloadProgress(url="http://test.com", status=DownloadStatus.COMPLETE)
        assert progress.is_failed is False


class TestImageManager:
    """Tests for ImageManager."""

    def test_build_url(self, image_manager):
        """Test URL building."""
        url = image_manager._build_url(123)
        assert url == "http://localhost:8000/api/images/123/file"

        url = image_manager._build_url(123, "medium")
        assert url == "http://localhost:8000/api/images/123/file?size=medium"

    def test_get_cache_path(self, image_manager):
        """Test cache path generation."""
        path = image_manager._get_cache_path(123)
        assert path.name == "123.jpg"

        path = image_manager._get_cache_path(456, ".png")
        assert path.name == "456.png"

    def test_get_cache_key(self, image_manager):
        """Test cache key generation."""
        key = image_manager._get_cache_key(123)
        assert key == "123:original"

        key = image_manager._get_cache_key(456, "medium")
        assert key == "456:medium"

    def test_extension_from_content_type(self):
        """Test content type to extension mapping."""
        assert ImageManager._extension_from_content_type("image/jpeg") == ".jpg"
        assert ImageManager._extension_from_content_type("image/png") == ".png"
        assert ImageManager._extension_from_content_type("image/webp") == ".webp"
        assert ImageManager._extension_from_content_type("image/gif") == ".gif"
        assert ImageManager._extension_from_content_type("image/jpeg; charset=utf-8") == ".jpg"
        assert ImageManager._extension_from_content_type("unknown/type") == ".jpg"

    def test_is_cached_no_entry(self, image_manager):
        """Test is_cached when no entry exists."""
        assert image_manager.is_cached(999) is False

    def test_get_cached_path_no_entry(self, image_manager):
        """Test get_cached_path when no entry exists."""
        assert image_manager.get_cached_path(999) is None


class TestImageManagerAsync:
    """Async tests for ImageManager."""

    @pytest.mark.asyncio
    async def test_start_stop(self, image_manager):
        """Test start and stop lifecycle."""
        await image_manager.start()
        assert image_manager._session is not None

        await image_manager.stop()
        assert image_manager._session is None

    @pytest.mark.asyncio
    async def test_context_manager(self, config):
        """Test async context manager."""
        async with ImageManager(config) as manager:
            assert manager._session is not None
        assert manager._session is None

    @pytest.mark.asyncio
    async def test_download_not_started(self, image_manager):
        """Test download fails if manager not started."""
        with pytest.raises(ImageManagerError, match="not started"):
            await image_manager.download_image(123)

    @pytest.mark.asyncio
    async def test_download_image_success(self, config):
        """Test successful image download."""
        async with ImageManager(config) as manager:
            # Disable persistent cache to test in-memory behavior
            manager._cache = None
            # Mock response
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.content_length = 1000
            mock_response.headers = {
                "Content-Type": "image/jpeg",
                "ETag": '"abc123"',
                "Last-Modified": "Wed, 21 Oct 2025 07:28:00 GMT",
            }

            # Create async iterator for chunks
            async def mock_iter_chunked(chunk_size):
                yield b"x" * 500
                yield b"y" * 500

            mock_response.content.iter_chunked = mock_iter_chunked

            # Mock session.get
            mock_context = AsyncMock()
            mock_context.__aenter__.return_value = mock_response
            manager._session.get = MagicMock(return_value=mock_context)

            # Track progress
            progress_calls = []

            def on_progress(progress):
                progress_calls.append(progress)

            path, status = await manager.download_image(123, progress_callback=on_progress)

            assert status == DownloadStatus.COMPLETE
            assert path.exists()
            assert path.read_bytes() == b"x" * 500 + b"y" * 500

            # Check progress was tracked
            assert len(progress_calls) >= 2
            assert progress_calls[-1].status == DownloadStatus.COMPLETE

            # Check cache metadata
            cache_key = manager._get_cache_key(123)
            assert cache_key in manager._cache_metadata
            entry = manager._cache_metadata[cache_key]
            assert entry.etag == '"abc123"'
            assert entry.file_size == 1000

    @pytest.mark.asyncio
    async def test_download_image_304_cached(self, config):
        """Test 304 Not Modified response uses cache."""
        async with ImageManager(config) as manager:
            # Disable persistent cache to test in-memory behavior
            manager._cache = None
            # Pre-populate cache
            cache_path = manager._get_cache_path(123)
            cache_path.write_bytes(b"cached content")
            cache_key = manager._get_cache_key(123)
            manager._cache_metadata[cache_key] = CacheEntry(
                etag='"abc123"',
                local_path=str(cache_path),
                file_size=15,
            )

            # Mock 304 response
            mock_response = AsyncMock()
            mock_response.status = 304

            mock_context = AsyncMock()
            mock_context.__aenter__.return_value = mock_response
            manager._session.get = MagicMock(return_value=mock_context)

            path, status = await manager.download_image(123)

            assert status == DownloadStatus.CACHED
            assert path == cache_path

    @pytest.mark.asyncio
    async def test_download_image_404(self, config):
        """Test 404 raises ImageNotFoundError."""
        async with ImageManager(config) as manager:
            mock_response = AsyncMock()
            mock_response.status = 404

            mock_context = AsyncMock()
            mock_context.__aenter__.return_value = mock_response
            manager._session.get = MagicMock(return_value=mock_context)

            with pytest.raises(ImageNotFoundError):
                await manager.download_image(123)

    @pytest.mark.asyncio
    async def test_download_image_401(self, config):
        """Test 401 raises AuthenticationError."""
        async with ImageManager(config) as manager:
            mock_response = AsyncMock()
            mock_response.status = 401

            mock_context = AsyncMock()
            mock_context.__aenter__.return_value = mock_response
            manager._session.get = MagicMock(return_value=mock_context)

            with pytest.raises(AuthenticationError):
                await manager.download_image(123)

    @pytest.mark.asyncio
    async def test_download_image_retry_on_server_error(self, config):
        """Test retry on 5xx server error."""
        async with ImageManager(config) as manager:
            call_count = 0

            def mock_get(*args, **kwargs):
                nonlocal call_count
                call_count += 1

                mock_response = AsyncMock()
                if call_count < 3:
                    mock_response.status = 503
                else:
                    # Success on 3rd attempt
                    mock_response.status = 200
                    mock_response.content_length = 100
                    mock_response.headers = {"Content-Type": "image/jpeg"}

                    async def mock_iter_chunked(chunk_size):
                        yield b"x" * 100

                    mock_response.content.iter_chunked = mock_iter_chunked

                context = AsyncMock()
                context.__aenter__.return_value = mock_response
                return context

            manager._session.get = mock_get

            path, status = await manager.download_image(123)

            assert call_count == 3
            assert status == DownloadStatus.COMPLETE

    @pytest.mark.asyncio
    async def test_download_image_max_retries_exceeded(self, config):
        """Test failure after max retries."""
        async with ImageManager(config) as manager:
            mock_response = AsyncMock()
            mock_response.status = 503

            mock_context = AsyncMock()
            mock_context.__aenter__.return_value = mock_response
            manager._session.get = MagicMock(return_value=mock_context)

            with pytest.raises(ImageManagerError, match="Failed to download"):
                await manager.download_image(123)

    @pytest.mark.asyncio
    async def test_clear_cache_entry(self, config):
        """Test clearing cache entry."""
        async with ImageManager(config) as manager:
            # Disable persistent cache to test in-memory behavior
            manager._cache = None
            # Create cached file
            cache_path = manager._get_cache_path(123)
            cache_path.write_bytes(b"cached content")
            cache_key = manager._get_cache_key(123)
            manager._cache_metadata[cache_key] = CacheEntry(
                local_path=str(cache_path),
            )

            assert cache_path.exists()
            assert manager.clear_cache_entry(123) is True
            assert not cache_path.exists()
            assert cache_key not in manager._cache_metadata

    @pytest.mark.asyncio
    async def test_clear_cache_entry_not_cached(self, config):
        """Test clearing non-existent cache entry."""
        async with ImageManager(config) as manager:
            assert manager.clear_cache_entry(999) is False

    @pytest.mark.asyncio
    async def test_get_cache_stats(self, config):
        """Test cache statistics (in-memory fallback)."""
        async with ImageManager(config) as manager:
            # Disable persistent cache to test in-memory behavior
            manager._cache = None
            # Create some cached files
            for i in range(3):
                path = manager._get_cache_path(i)
                path.write_bytes(b"x" * 100)
                manager._cache_metadata[f"{i}:original"] = CacheEntry(
                    local_path=str(path),
                    file_size=100,
                )

            stats = manager.get_cache_stats()

            assert stats["entries"] == 3
            # Note: file count may be higher due to cache.db file from persistent cache init
            assert stats["files"] >= 3
            assert stats["total_size_bytes"] >= 300

    @pytest.mark.asyncio
    async def test_download_image_to_path(self, config, temp_cache_dir):
        """Test downloading image to specific path."""
        async with ImageManager(config) as manager:
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.content_length = 100
            mock_response.headers = {"Content-Type": "image/jpeg"}

            async def mock_iter_chunked(chunk_size):
                yield b"image data"

            mock_response.content.iter_chunked = mock_iter_chunked

            mock_context = AsyncMock()
            mock_context.__aenter__.return_value = mock_response
            manager._session.get = MagicMock(return_value=mock_context)

            dest = Path(temp_cache_dir) / "custom" / "image.jpg"
            status = await manager.download_image_to_path(123, dest)

            assert status == DownloadStatus.COMPLETE
            assert dest.exists()
            assert dest.read_bytes() == b"image data"

    @pytest.mark.asyncio
    async def test_conditional_request_headers(self, config):
        """Test that conditional headers are sent when cached."""
        async with ImageManager(config) as manager:
            # Disable persistent cache to test in-memory behavior
            manager._cache = None
            # Pre-populate cache metadata
            cache_path = manager._get_cache_path(123)
            cache_path.write_bytes(b"cached")
            cache_key = manager._get_cache_key(123)
            manager._cache_metadata[cache_key] = CacheEntry(
                etag='"abc123"',
                last_modified="Wed, 21 Oct 2025 07:28:00 GMT",
                local_path=str(cache_path),
            )

            # Track headers
            sent_headers = None

            def capture_headers(*args, **kwargs):
                nonlocal sent_headers
                sent_headers = kwargs.get("headers", {})

                mock_response = AsyncMock()
                mock_response.status = 304

                context = AsyncMock()
                context.__aenter__.return_value = mock_response
                return context

            manager._session.get = capture_headers

            await manager.download_image(123)

            assert sent_headers is not None
            assert sent_headers.get("If-None-Match") == '"abc123"'
            assert sent_headers.get("If-Modified-Since") == "Wed, 21 Oct 2025 07:28:00 GMT"

    @pytest.mark.asyncio
    async def test_force_download_ignores_cache(self, config):
        """Test that force=True ignores cache."""
        async with ImageManager(config) as manager:
            # Pre-populate cache metadata
            cache_key = manager._get_cache_key(123)
            manager._cache_metadata[cache_key] = CacheEntry(
                etag='"abc123"',
            )

            sent_headers = None

            def capture_headers(*args, **kwargs):
                nonlocal sent_headers
                sent_headers = kwargs.get("headers", {})

                mock_response = AsyncMock()
                mock_response.status = 200
                mock_response.content_length = 100
                mock_response.headers = {"Content-Type": "image/jpeg"}

                async def mock_iter_chunked(chunk_size):
                    yield b"new content"

                mock_response.content.iter_chunked = mock_iter_chunked

                context = AsyncMock()
                context.__aenter__.return_value = mock_response
                return context

            manager._session.get = capture_headers

            await manager.download_image(123, force=True)

            # Should not send conditional headers
            assert "If-None-Match" not in sent_headers
            assert "If-Modified-Since" not in sent_headers
