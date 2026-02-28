"""
Image Manager - HTTP Client for fetching images from backend.

Provides async HTTP client with:
- ETag/Last-Modified header handling for caching
- Retry logic with exponential backoff
- Download progress tracking
"""
import asyncio
import logging
import os
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Callable, Dict, Optional, Tuple
from urllib.parse import urljoin

logger = logging.getLogger(__name__)


class DownloadStatus(Enum):
    """Status of an image download."""
    PENDING = "pending"
    DOWNLOADING = "downloading"
    COMPLETE = "complete"
    CACHED = "cached"  # Server returned 304 Not Modified
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class DownloadProgress:
    """Progress information for an image download."""
    url: str
    status: DownloadStatus
    bytes_downloaded: int = 0
    total_bytes: Optional[int] = None
    progress_percent: float = 0.0
    error: Optional[str] = None

    @property
    def is_complete(self) -> bool:
        return self.status in (DownloadStatus.COMPLETE, DownloadStatus.CACHED)

    @property
    def is_failed(self) -> bool:
        return self.status == DownloadStatus.FAILED


@dataclass
class CacheEntry:
    """Cached metadata for an image."""
    etag: Optional[str] = None
    last_modified: Optional[str] = None
    local_path: Optional[str] = None
    content_type: Optional[str] = None
    file_size: int = 0
    cached_at: float = field(default_factory=time.time)


@dataclass
class ImageManagerConfig:
    """Configuration for ImageManager."""
    backend_url: str
    device_token: str
    cache_dir: str = "/var/cache/glowworm/images"
    connect_timeout: float = 10.0
    read_timeout: float = 60.0
    max_retries: int = 3
    retry_base_delay: float = 1.0  # Base delay for exponential backoff
    retry_max_delay: float = 60.0  # Maximum delay between retries
    chunk_size: int = 65536  # 64KB chunks for streaming downloads

    def __post_init__(self):
        # Ensure cache directory exists
        os.makedirs(self.cache_dir, exist_ok=True)


# Type alias for progress callback
ProgressCallback = Callable[[DownloadProgress], None]


class ImageManagerError(Exception):
    """Base exception for ImageManager errors."""
    pass


class ImageNotFoundError(ImageManagerError):
    """Raised when image is not found on backend (404)."""
    pass


class AuthenticationError(ImageManagerError):
    """Raised when authentication fails (401/403)."""
    pass


class ImageManager:
    """
    HTTP client for fetching images from backend with caching support.

    Features:
    - Async downloads using aiohttp
    - ETag/Last-Modified conditional requests for cache validation
    - Exponential backoff retry on transient failures
    - Progress tracking with callbacks
    - Automatic cache directory management
    """

    def __init__(self, config: ImageManagerConfig):
        self.config = config
        self._session: Optional["aiohttp.ClientSession"] = None
        self._cache_metadata: Dict[str, CacheEntry] = {}
        self._active_downloads: Dict[str, asyncio.Task] = {}

    async def start(self) -> None:
        """Initialize the HTTP session."""
        import aiohttp

        timeout = aiohttp.ClientTimeout(
            connect=self.config.connect_timeout,
            total=None,  # No total timeout - we handle per-request
            sock_read=self.config.read_timeout
        )

        # Create session with default headers
        headers = {
            "User-Agent": "GlowWorm-Daemon/3.0",
            "X-Device-Token": self.config.device_token,
        }

        self._session = aiohttp.ClientSession(
            timeout=timeout,
            headers=headers
        )
        logger.info(f"ImageManager started, cache dir: {self.config.cache_dir}")

    async def stop(self) -> None:
        """Close the HTTP session and cancel active downloads."""
        # Cancel active downloads
        for task in self._active_downloads.values():
            task.cancel()

        if self._active_downloads:
            await asyncio.gather(*self._active_downloads.values(), return_exceptions=True)
            self._active_downloads.clear()

        # Close session
        if self._session:
            await self._session.close()
            self._session = None

        logger.info("ImageManager stopped")

    async def __aenter__(self) -> "ImageManager":
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        await self.stop()

    def _build_url(self, image_id: int, size: str = "original") -> str:
        """Build the URL for fetching an image."""
        # Use the smart endpoint which handles resolution matching
        path = f"/api/images/{image_id}/file"
        if size != "original":
            path += f"?size={size}"
        return urljoin(self.config.backend_url, path)

    def _get_cache_path(self, image_id: int, extension: str = ".jpg") -> Path:
        """Get the local cache path for an image."""
        return Path(self.config.cache_dir) / f"{image_id}{extension}"

    def _get_cache_key(self, image_id: int, size: str = "original") -> str:
        """Get cache key for an image."""
        return f"{image_id}:{size}"

    def get_cached_path(self, image_id: int, size: str = "original") -> Optional[Path]:
        """
        Get path to cached image if it exists.

        Returns:
            Path to cached file, or None if not cached.
        """
        cache_key = self._get_cache_key(image_id, size)
        entry = self._cache_metadata.get(cache_key)

        if entry and entry.local_path:
            path = Path(entry.local_path)
            if path.exists():
                return path

        return None

    def is_cached(self, image_id: int, size: str = "original") -> bool:
        """Check if an image is in the local cache."""
        return self.get_cached_path(image_id, size) is not None

    async def download_image(
        self,
        image_id: int,
        size: str = "original",
        force: bool = False,
        progress_callback: Optional[ProgressCallback] = None
    ) -> Tuple[Path, DownloadStatus]:
        """
        Download an image from the backend.

        Uses conditional requests (If-None-Match, If-Modified-Since) to avoid
        re-downloading unchanged images.

        Args:
            image_id: ID of the image to download
            size: Size variant to download (original, medium, etc.)
            force: Force download even if cached
            progress_callback: Optional callback for progress updates

        Returns:
            Tuple of (local file path, download status)

        Raises:
            ImageNotFoundError: If image doesn't exist on backend
            AuthenticationError: If device token is invalid
            ImageManagerError: On other errors after retries exhausted
        """
        import aiohttp

        if not self._session:
            raise ImageManagerError("ImageManager not started. Call start() first.")

        url = self._build_url(image_id, size)
        cache_key = self._get_cache_key(image_id, size)

        # Check cache unless forced
        cache_entry = self._cache_metadata.get(cache_key)
        cached_path = self.get_cached_path(image_id, size)

        progress = DownloadProgress(
            url=url,
            status=DownloadStatus.PENDING
        )

        def notify_progress():
            if progress_callback:
                try:
                    progress_callback(progress)
                except Exception as e:
                    logger.warning(f"Progress callback error: {e}")

        # Build headers for conditional request
        headers: Dict[str, str] = {}
        if not force and cache_entry:
            if cache_entry.etag:
                headers["If-None-Match"] = cache_entry.etag
            if cache_entry.last_modified:
                headers["If-Modified-Since"] = cache_entry.last_modified

        # Retry loop with exponential backoff
        last_error: Optional[Exception] = None

        for attempt in range(self.config.max_retries):
            try:
                progress.status = DownloadStatus.DOWNLOADING
                progress.bytes_downloaded = 0
                progress.total_bytes = None
                progress.progress_percent = 0.0
                notify_progress()

                async with self._session.get(url, headers=headers) as response:
                    # Handle response status
                    if response.status == 304:
                        # Not Modified - use cached version
                        if cached_path and cached_path.exists():
                            progress.status = DownloadStatus.CACHED
                            logger.debug(f"Image {image_id} unchanged (304)")
                            notify_progress()
                            return cached_path, DownloadStatus.CACHED
                        else:
                            # Cache metadata exists but file is missing, re-download
                            logger.warning(f"Cache entry exists but file missing for {image_id}")
                            # Clear headers and retry
                            headers.clear()
                            continue

                    elif response.status == 404:
                        raise ImageNotFoundError(f"Image {image_id} not found")

                    elif response.status in (401, 403):
                        raise AuthenticationError(f"Authentication failed for image {image_id}")

                    elif response.status >= 500:
                        # Server error - retry
                        raise aiohttp.ServerConnectionError(
                            f"Server error {response.status} for image {image_id}"
                        )

                    elif response.status != 200:
                        raise ImageManagerError(
                            f"Unexpected status {response.status} for image {image_id}"
                        )

                    # Get content info
                    content_length = response.content_length
                    content_type = response.headers.get("Content-Type", "image/jpeg")
                    etag = response.headers.get("ETag")
                    last_modified = response.headers.get("Last-Modified")

                    progress.total_bytes = content_length

                    # Determine file extension from content type
                    extension = self._extension_from_content_type(content_type)
                    local_path = self._get_cache_path(image_id, extension)

                    # Download to temporary file, then rename
                    temp_path = local_path.with_suffix(".tmp")

                    try:
                        with open(temp_path, "wb") as f:
                            async for chunk in response.content.iter_chunked(self.config.chunk_size):
                                f.write(chunk)
                                progress.bytes_downloaded += len(chunk)

                                if content_length:
                                    progress.progress_percent = (
                                        progress.bytes_downloaded / content_length * 100
                                    )
                                notify_progress()

                        # Rename temp file to final path
                        temp_path.rename(local_path)

                    except Exception:
                        # Clean up temp file on error
                        if temp_path.exists():
                            temp_path.unlink()
                        raise

                    # Update cache metadata
                    self._cache_metadata[cache_key] = CacheEntry(
                        etag=etag,
                        last_modified=last_modified,
                        local_path=str(local_path),
                        content_type=content_type,
                        file_size=progress.bytes_downloaded
                    )

                    progress.status = DownloadStatus.COMPLETE
                    progress.progress_percent = 100.0
                    notify_progress()

                    logger.info(
                        f"Downloaded image {image_id} ({progress.bytes_downloaded} bytes)"
                    )
                    return local_path, DownloadStatus.COMPLETE

            except (ImageNotFoundError, AuthenticationError):
                # Don't retry these
                progress.status = DownloadStatus.FAILED
                progress.error = str(last_error)
                notify_progress()
                raise

            except (aiohttp.ClientError, asyncio.TimeoutError, OSError) as e:
                last_error = e

                if attempt < self.config.max_retries - 1:
                    # Calculate backoff delay
                    delay = min(
                        self.config.retry_base_delay * (2 ** attempt),
                        self.config.retry_max_delay
                    )
                    logger.warning(
                        f"Download attempt {attempt + 1} failed for image {image_id}: {e}. "
                        f"Retrying in {delay:.1f}s"
                    )
                    await asyncio.sleep(delay)
                else:
                    logger.error(
                        f"Download failed for image {image_id} after {self.config.max_retries} attempts: {e}"
                    )

        # All retries exhausted
        progress.status = DownloadStatus.FAILED
        progress.error = str(last_error) if last_error else "Unknown error"
        notify_progress()

        raise ImageManagerError(
            f"Failed to download image {image_id} after {self.config.max_retries} attempts: {last_error}"
        )

    async def download_image_to_path(
        self,
        image_id: int,
        destination: Path,
        size: str = "original",
        progress_callback: Optional[ProgressCallback] = None
    ) -> DownloadStatus:
        """
        Download an image directly to a specified path.

        Unlike download_image(), this method downloads directly to the
        destination without using the cache.

        Args:
            image_id: ID of the image to download
            destination: Local path to save the image
            size: Size variant to download
            progress_callback: Optional callback for progress updates

        Returns:
            Download status
        """
        import aiohttp

        if not self._session:
            raise ImageManagerError("ImageManager not started. Call start() first.")

        url = self._build_url(image_id, size)

        progress = DownloadProgress(
            url=url,
            status=DownloadStatus.PENDING
        )

        def notify_progress():
            if progress_callback:
                try:
                    progress_callback(progress)
                except Exception as e:
                    logger.warning(f"Progress callback error: {e}")

        last_error: Optional[Exception] = None

        for attempt in range(self.config.max_retries):
            try:
                progress.status = DownloadStatus.DOWNLOADING
                progress.bytes_downloaded = 0
                notify_progress()

                async with self._session.get(url) as response:
                    if response.status == 404:
                        raise ImageNotFoundError(f"Image {image_id} not found")
                    elif response.status in (401, 403):
                        raise AuthenticationError(f"Authentication failed")
                    elif response.status >= 500:
                        raise aiohttp.ServerConnectionError(f"Server error {response.status}")
                    elif response.status != 200:
                        raise ImageManagerError(f"Unexpected status {response.status}")

                    content_length = response.content_length
                    progress.total_bytes = content_length

                    # Ensure destination directory exists
                    destination.parent.mkdir(parents=True, exist_ok=True)

                    temp_path = destination.with_suffix(".tmp")

                    try:
                        with open(temp_path, "wb") as f:
                            async for chunk in response.content.iter_chunked(self.config.chunk_size):
                                f.write(chunk)
                                progress.bytes_downloaded += len(chunk)

                                if content_length:
                                    progress.progress_percent = (
                                        progress.bytes_downloaded / content_length * 100
                                    )
                                notify_progress()

                        temp_path.rename(destination)

                    except Exception:
                        if temp_path.exists():
                            temp_path.unlink()
                        raise

                    progress.status = DownloadStatus.COMPLETE
                    progress.progress_percent = 100.0
                    notify_progress()

                    return DownloadStatus.COMPLETE

            except (ImageNotFoundError, AuthenticationError):
                progress.status = DownloadStatus.FAILED
                notify_progress()
                raise

            except (aiohttp.ClientError, asyncio.TimeoutError, OSError) as e:
                last_error = e

                if attempt < self.config.max_retries - 1:
                    delay = min(
                        self.config.retry_base_delay * (2 ** attempt),
                        self.config.retry_max_delay
                    )
                    logger.warning(f"Download attempt {attempt + 1} failed: {e}. Retrying in {delay:.1f}s")
                    await asyncio.sleep(delay)

        progress.status = DownloadStatus.FAILED
        progress.error = str(last_error) if last_error else "Unknown error"
        notify_progress()

        raise ImageManagerError(f"Failed to download after {self.config.max_retries} attempts: {last_error}")

    def cancel_download(self, image_id: int, size: str = "original") -> bool:
        """
        Cancel an active download.

        Returns:
            True if a download was cancelled, False if none was active.
        """
        cache_key = self._get_cache_key(image_id, size)
        task = self._active_downloads.pop(cache_key, None)

        if task and not task.done():
            task.cancel()
            logger.info(f"Cancelled download for image {image_id}")
            return True

        return False

    def clear_cache_entry(self, image_id: int, size: str = "original") -> bool:
        """
        Clear cache entry and delete cached file.

        Returns:
            True if entry was cleared, False if not cached.
        """
        cache_key = self._get_cache_key(image_id, size)
        entry = self._cache_metadata.pop(cache_key, None)

        if entry and entry.local_path:
            path = Path(entry.local_path)
            if path.exists():
                path.unlink()
                logger.debug(f"Cleared cache for image {image_id}")
                return True

        return False

    def get_cache_stats(self) -> Dict:
        """Get cache statistics."""
        total_size = 0
        file_count = 0

        cache_dir = Path(self.config.cache_dir)
        if cache_dir.exists():
            for f in cache_dir.iterdir():
                if f.is_file() and not f.suffix == ".tmp":
                    total_size += f.stat().st_size
                    file_count += 1

        return {
            "entries": len(self._cache_metadata),
            "files": file_count,
            "total_size_bytes": total_size,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
            "cache_dir": str(cache_dir)
        }

    @staticmethod
    def _extension_from_content_type(content_type: str) -> str:
        """Get file extension from content type."""
        mapping = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
            "image/gif": ".gif",
            "image/bmp": ".bmp",
        }
        # Handle content type with charset
        ct = content_type.split(";")[0].strip().lower()
        return mapping.get(ct, ".jpg")


def create_image_manager(config: ImageManagerConfig) -> ImageManager:
    """Factory function to create an ImageManager instance."""
    return ImageManager(config)
