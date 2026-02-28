"""
Preload Manager - Background preloading of upcoming images.

Provides background preloading with:
- Preload queue based on playlist position
- Priority-based download scheduling
- Cancellation of outdated preloads
- Integration with ImageManager and PlaylistManager
"""
import asyncio
import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Dict, List, Optional, Set, TYPE_CHECKING

if TYPE_CHECKING:
    from .image_manager import ImageManager, DownloadProgress
    from .playlist_manager import PlaylistManager, PlaylistImage

logger = logging.getLogger(__name__)


class PreloadStatus(Enum):
    """Status of a preload operation."""
    PENDING = "pending"
    DOWNLOADING = "downloading"
    COMPLETE = "complete"
    CACHED = "cached"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class PreloadEntry:
    """An entry in the preload queue."""
    image_id: int
    priority: int  # Lower is higher priority (0 = next image)
    status: PreloadStatus = PreloadStatus.PENDING
    task: Optional[asyncio.Task] = None
    error: Optional[str] = None

    def __lt__(self, other: "PreloadEntry") -> bool:
        """Compare by priority for heap operations."""
        return self.priority < other.priority


@dataclass
class PreloadManagerConfig:
    """Configuration for PreloadManager."""
    preload_count: int = 3  # Number of images to preload ahead
    max_concurrent_downloads: int = 2  # Max concurrent downloads
    retry_delay: float = 5.0  # Delay before retrying failed downloads
    max_retries: int = 2  # Max retries for failed downloads


@dataclass
class PreloadStats:
    """Statistics for preload operations."""
    pending_count: int = 0
    downloading_count: int = 0
    completed_count: int = 0
    failed_count: int = 0
    cancelled_count: int = 0
    total_preloaded: int = 0
    total_bytes_downloaded: int = 0


# Type alias for progress callback
PreloadProgressCallback = Callable[[int, "DownloadProgress"], None]


class PreloadManager:
    """
    Background preloading of upcoming images.

    Features:
    - Maintains preload queue based on playlist position
    - Priority-based scheduling (next images have highest priority)
    - Limits concurrent downloads to avoid resource contention
    - Cancels preloads for images no longer needed (playlist changed)
    - Skips already-cached images
    """

    def __init__(
        self,
        image_manager: "ImageManager",
        config: Optional[PreloadManagerConfig] = None
    ):
        self.image_manager = image_manager
        self.config = config or PreloadManagerConfig()

        self._queue: Dict[int, PreloadEntry] = {}  # image_id -> entry
        self._active_downloads: int = 0
        self._running: bool = False
        self._worker_task: Optional[asyncio.Task] = None
        self._queue_event: asyncio.Event = asyncio.Event()
        self._lock: asyncio.Lock = asyncio.Lock()

        # Statistics
        self._stats = PreloadStats()
        self._progress_callback: Optional[PreloadProgressCallback] = None

        # Track which playlist position triggered the current preloads
        self._current_preload_set: Set[int] = set()

    def set_progress_callback(
        self,
        callback: Optional[PreloadProgressCallback]
    ) -> None:
        """Set callback for preload progress updates."""
        self._progress_callback = callback

    async def start(self) -> None:
        """Start the preload worker."""
        if self._running:
            return

        self._running = True
        self._worker_task = asyncio.create_task(self._worker_loop())
        logger.info("PreloadManager started")

    async def stop(self) -> None:
        """Stop the preload worker and cancel pending downloads."""
        self._running = False
        self._queue_event.set()  # Wake up worker

        # Cancel all active downloads
        async with self._lock:
            for entry in self._queue.values():
                if entry.task and not entry.task.done():
                    entry.task.cancel()
                    entry.status = PreloadStatus.CANCELLED
                    self._stats.cancelled_count += 1
            self._queue.clear()

        # Wait for worker to finish
        if self._worker_task:
            try:
                await asyncio.wait_for(self._worker_task, timeout=5.0)
            except asyncio.TimeoutError:
                self._worker_task.cancel()
            self._worker_task = None

        logger.info("PreloadManager stopped")

    async def __aenter__(self) -> "PreloadManager":
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        await self.stop()

    async def update_preload_queue(
        self,
        playlist_manager: "PlaylistManager"
    ) -> None:
        """
        Update the preload queue based on current playlist position.

        Cancels downloads for images no longer needed and queues
        new images for preloading.

        Args:
            playlist_manager: The playlist manager to get upcoming images from
        """
        # Get upcoming images
        upcoming = playlist_manager.get_upcoming_images(self.config.preload_count)

        if not upcoming:
            # Clear queue if no upcoming images
            await self._cancel_all()
            return

        # Get set of upcoming image IDs with priorities
        upcoming_ids: Dict[int, int] = {}
        for i, image in enumerate(upcoming):
            upcoming_ids[image.id] = i  # Priority = position in upcoming list

        async with self._lock:
            # Cancel downloads for images no longer needed
            to_remove = []
            for image_id, entry in self._queue.items():
                if image_id not in upcoming_ids:
                    if entry.task and not entry.task.done():
                        entry.task.cancel()
                        self._stats.cancelled_count += 1
                    to_remove.append(image_id)
                    logger.debug(f"Cancelled preload for image {image_id} (no longer needed)")

            for image_id in to_remove:
                del self._queue[image_id]

            # Add new images to queue
            for image_id, priority in upcoming_ids.items():
                if image_id in self._queue:
                    # Update priority if already in queue
                    entry = self._queue[image_id]
                    entry.priority = priority
                elif self.image_manager.is_cached(image_id):
                    # Already cached, no need to preload
                    logger.debug(f"Image {image_id} already cached, skipping preload")
                else:
                    # Add new entry
                    self._queue[image_id] = PreloadEntry(
                        image_id=image_id,
                        priority=priority
                    )
                    self._stats.pending_count += 1
                    logger.debug(f"Queued preload for image {image_id} (priority {priority})")

            self._current_preload_set = set(upcoming_ids.keys())

        # Wake up worker
        self._queue_event.set()

    async def preload_images(
        self,
        images: List["PlaylistImage"]
    ) -> None:
        """
        Preload a specific list of images.

        Args:
            images: List of PlaylistImage objects to preload
        """
        async with self._lock:
            for i, image in enumerate(images):
                if image.id not in self._queue and not self.image_manager.is_cached(image.id):
                    self._queue[image.id] = PreloadEntry(
                        image_id=image.id,
                        priority=i
                    )
                    self._stats.pending_count += 1

        # Wake up worker
        self._queue_event.set()

    async def cancel_preload(self, image_id: int) -> bool:
        """
        Cancel preload for a specific image.

        Args:
            image_id: ID of the image to cancel preload for

        Returns:
            True if preload was cancelled, False if not found
        """
        async with self._lock:
            entry = self._queue.pop(image_id, None)

            if entry:
                if entry.task and not entry.task.done():
                    entry.task.cancel()
                entry.status = PreloadStatus.CANCELLED
                self._stats.cancelled_count += 1
                logger.debug(f"Cancelled preload for image {image_id}")
                return True

        return False

    async def _cancel_all(self) -> None:
        """Cancel all pending and active preloads."""
        async with self._lock:
            for entry in self._queue.values():
                if entry.task and not entry.task.done():
                    entry.task.cancel()
                    self._stats.cancelled_count += 1
            self._queue.clear()
            self._current_preload_set.clear()

    async def _worker_loop(self) -> None:
        """Main worker loop that processes the preload queue."""
        while self._running:
            try:
                # Wait for queue event or timeout
                try:
                    await asyncio.wait_for(
                        self._queue_event.wait(),
                        timeout=1.0
                    )
                except asyncio.TimeoutError:
                    pass

                self._queue_event.clear()

                if not self._running:
                    break

                # Process pending downloads
                await self._process_queue()

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception(f"Error in preload worker: {e}")
                await asyncio.sleep(1.0)

    async def _process_queue(self) -> None:
        """Process pending items in the queue."""
        async with self._lock:
            # Find pending items sorted by priority
            pending = [
                entry for entry in self._queue.values()
                if entry.status == PreloadStatus.PENDING
            ]
            pending.sort(key=lambda e: e.priority)

            # Start downloads up to concurrent limit
            for entry in pending:
                if self._active_downloads >= self.config.max_concurrent_downloads:
                    break

                if entry.task is None or entry.task.done():
                    entry.status = PreloadStatus.DOWNLOADING
                    entry.task = asyncio.create_task(
                        self._download_image(entry.image_id)
                    )
                    self._active_downloads += 1
                    self._stats.pending_count = max(0, self._stats.pending_count - 1)
                    self._stats.downloading_count += 1

    async def _download_image(self, image_id: int) -> None:
        """Download a single image."""
        from .image_manager import DownloadStatus

        entry: Optional[PreloadEntry] = None

        try:
            async with self._lock:
                entry = self._queue.get(image_id)
                if not entry:
                    return

            def progress_callback(progress: "DownloadProgress"):
                if self._progress_callback:
                    self._progress_callback(image_id, progress)

            # Download the image
            path, status = await self.image_manager.download_image(
                image_id,
                progress_callback=progress_callback
            )

            async with self._lock:
                entry = self._queue.get(image_id)
                if entry:
                    if status in (DownloadStatus.COMPLETE, DownloadStatus.CACHED):
                        entry.status = PreloadStatus.COMPLETE
                        self._stats.completed_count += 1
                        self._stats.total_preloaded += 1
                        logger.info(f"Preloaded image {image_id}")
                    else:
                        entry.status = PreloadStatus.FAILED
                        self._stats.failed_count += 1
                        logger.warning(f"Failed to preload image {image_id}")

        except asyncio.CancelledError:
            async with self._lock:
                entry = self._queue.get(image_id)
                if entry:
                    entry.status = PreloadStatus.CANCELLED
            raise

        except Exception as e:
            logger.warning(f"Preload failed for image {image_id}: {e}")
            async with self._lock:
                entry = self._queue.get(image_id)
                if entry:
                    entry.status = PreloadStatus.FAILED
                    entry.error = str(e)
                    self._stats.failed_count += 1

        finally:
            async with self._lock:
                self._active_downloads = max(0, self._active_downloads - 1)
                self._stats.downloading_count = max(
                    0, self._stats.downloading_count - 1
                )
            # Wake up worker to process more items
            self._queue_event.set()

    def is_preloading(self, image_id: int) -> bool:
        """Check if an image is currently being preloaded."""
        entry = self._queue.get(image_id)
        return entry is not None and entry.status == PreloadStatus.DOWNLOADING

    def is_preload_pending(self, image_id: int) -> bool:
        """Check if an image is pending preload."""
        entry = self._queue.get(image_id)
        return entry is not None and entry.status == PreloadStatus.PENDING

    def get_queue_status(self) -> Dict[int, PreloadStatus]:
        """Get status of all items in the queue."""
        return {
            image_id: entry.status
            for image_id, entry in self._queue.items()
        }

    def get_stats(self) -> PreloadStats:
        """Get preload statistics."""
        return PreloadStats(
            pending_count=sum(
                1 for e in self._queue.values()
                if e.status == PreloadStatus.PENDING
            ),
            downloading_count=self._active_downloads,
            completed_count=self._stats.completed_count,
            failed_count=self._stats.failed_count,
            cancelled_count=self._stats.cancelled_count,
            total_preloaded=self._stats.total_preloaded,
            total_bytes_downloaded=self._stats.total_bytes_downloaded
        )

    def get_status(self) -> Dict:
        """Get comprehensive status information."""
        stats = self.get_stats()
        return {
            "running": self._running,
            "queue_size": len(self._queue),
            "active_downloads": self._active_downloads,
            "pending": stats.pending_count,
            "downloading": stats.downloading_count,
            "completed": stats.completed_count,
            "failed": stats.failed_count,
            "cancelled": stats.cancelled_count,
            "total_preloaded": stats.total_preloaded,
            "config": {
                "preload_count": self.config.preload_count,
                "max_concurrent_downloads": self.config.max_concurrent_downloads,
            }
        }


def create_preload_manager(
    image_manager: "ImageManager",
    config: Optional[PreloadManagerConfig] = None
) -> PreloadManager:
    """Factory function to create a PreloadManager instance."""
    return PreloadManager(image_manager, config)
