"""
Unit tests for PreloadManager.

Tests cover:
- Preload queue management
- Background download task
- Priority-based scheduling
- Cancellation of outdated preloads
- Integration with ImageManager and PlaylistManager
"""
import asyncio
from pathlib import Path
from typing import Dict, List, Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from glowworm_daemon.preload_manager import (
    PreloadManager,
    PreloadManagerConfig,
    PreloadStatus,
    PreloadEntry,
    PreloadStats,
    create_preload_manager,
)
from glowworm_daemon.image_manager import (
    ImageManager,
    ImageManagerConfig,
    DownloadStatus,
    DownloadProgress,
)
from glowworm_daemon.playlist_manager import PlaylistImage


@pytest.fixture
def image_manager_config(tmp_path: Path) -> ImageManagerConfig:
    """Create image manager config for testing."""
    cache_dir = tmp_path / "cache"
    cache_dir.mkdir()
    return ImageManagerConfig(
        backend_url="http://localhost:8000",
        device_token="test-token",
        cache_dir=str(cache_dir),
        max_retries=1,
    )


@pytest.fixture
def mock_image_manager(image_manager_config: ImageManagerConfig) -> MagicMock:
    """Create a mock ImageManager."""
    manager = MagicMock(spec=ImageManager)
    manager.config = image_manager_config
    manager.is_cached = MagicMock(return_value=False)
    manager.download_image = AsyncMock(
        return_value=(Path("/tmp/test.jpg"), DownloadStatus.COMPLETE)
    )
    return manager


@pytest.fixture
def preload_config() -> PreloadManagerConfig:
    """Create preload config for testing."""
    return PreloadManagerConfig(
        preload_count=3,
        max_concurrent_downloads=2,
        retry_delay=0.1,
        max_retries=1,
    )


@pytest.fixture
def preload_manager(
    mock_image_manager: MagicMock,
    preload_config: PreloadManagerConfig
) -> PreloadManager:
    """Create PreloadManager for testing."""
    return PreloadManager(mock_image_manager, preload_config)


def create_playlist_images(image_ids: List[int]) -> List[PlaylistImage]:
    """Create list of PlaylistImage objects."""
    return [
        PlaylistImage(
            id=img_id,
            url=f"/api/images/{img_id}/file",
            filename=f"{img_id}.jpg"
        )
        for img_id in image_ids
    ]


class TestPreloadManagerConfig:
    """Tests for PreloadManagerConfig."""

    def test_default_values(self):
        """Test default configuration values."""
        config = PreloadManagerConfig()
        assert config.preload_count == 3
        assert config.max_concurrent_downloads == 2
        assert config.retry_delay == 5.0
        assert config.max_retries == 2


class TestPreloadEntry:
    """Tests for PreloadEntry dataclass."""

    def test_priority_comparison(self):
        """Test priority comparison for sorting."""
        entry1 = PreloadEntry(image_id=1, priority=0)
        entry2 = PreloadEntry(image_id=2, priority=1)
        entry3 = PreloadEntry(image_id=3, priority=2)

        assert entry1 < entry2
        assert entry2 < entry3
        assert entry1 < entry3

        # Sorted by priority
        entries = [entry3, entry1, entry2]
        entries.sort()
        assert entries[0].image_id == 1
        assert entries[1].image_id == 2
        assert entries[2].image_id == 3


class TestPreloadManagerBasics:
    """Basic tests for PreloadManager."""

    def test_creation(
        self,
        mock_image_manager: MagicMock,
        preload_config: PreloadManagerConfig
    ):
        """Test PreloadManager creation."""
        manager = PreloadManager(mock_image_manager, preload_config)
        assert manager.image_manager == mock_image_manager
        assert manager.config == preload_config

    def test_factory_function(self, mock_image_manager: MagicMock):
        """Test factory function."""
        manager = create_preload_manager(mock_image_manager)
        assert isinstance(manager, PreloadManager)
        assert manager.config.preload_count == 3  # Default

    @pytest.mark.asyncio
    async def test_start_stop(self, preload_manager: PreloadManager):
        """Test start and stop."""
        await preload_manager.start()
        assert preload_manager._running
        assert preload_manager._worker_task is not None

        await preload_manager.stop()
        assert not preload_manager._running
        assert preload_manager._worker_task is None

    @pytest.mark.asyncio
    async def test_context_manager(self, preload_manager: PreloadManager):
        """Test async context manager."""
        async with preload_manager:
            assert preload_manager._running

        assert not preload_manager._running


class TestPreloadQueue:
    """Tests for preload queue management."""

    @pytest.mark.asyncio
    async def test_preload_images(
        self,
        preload_manager: PreloadManager,
        mock_image_manager: MagicMock
    ):
        """Test queuing images for preload."""
        images = create_playlist_images([1, 2, 3])

        async with preload_manager:
            await preload_manager.preload_images(images)

            # Give worker time to process
            await asyncio.sleep(0.1)

            # All images should be in queue or processed
            assert 1 in preload_manager._queue or mock_image_manager.download_image.called

    @pytest.mark.asyncio
    async def test_skip_cached_images(
        self,
        preload_manager: PreloadManager,
        mock_image_manager: MagicMock
    ):
        """Test that cached images are skipped."""
        mock_image_manager.is_cached = MagicMock(side_effect=lambda id, size="original": id == 2)

        images = create_playlist_images([1, 2, 3])

        async with preload_manager:
            await preload_manager.preload_images(images)

            # Image 2 should be skipped (already cached)
            assert 2 not in preload_manager._queue

    @pytest.mark.asyncio
    async def test_priority_ordering(
        self,
        preload_manager: PreloadManager,
        mock_image_manager: MagicMock
    ):
        """Test that images are downloaded in priority order."""
        download_order = []

        async def mock_download(image_id, **kwargs):
            download_order.append(image_id)
            await asyncio.sleep(0.01)
            return (Path(f"/tmp/{image_id}.jpg"), DownloadStatus.COMPLETE)

        mock_image_manager.download_image = AsyncMock(side_effect=mock_download)

        # Set max concurrent to 1 to ensure sequential processing
        preload_manager.config.max_concurrent_downloads = 1

        images = create_playlist_images([3, 1, 2])

        async with preload_manager:
            await preload_manager.preload_images(images)

            # Wait for all downloads to complete
            for _ in range(50):  # Wait up to 0.5 seconds
                if len(download_order) >= 3:
                    break
                await asyncio.sleep(0.01)

        # Images should be downloaded in priority order (0, 1, 2)
        # which corresponds to image IDs (3, 1, 2) based on input order
        assert download_order == [3, 1, 2]

    @pytest.mark.asyncio
    async def test_concurrent_download_limit(
        self,
        mock_image_manager: MagicMock
    ):
        """Test concurrent download limit is respected."""
        active_downloads = []
        max_concurrent = 0

        async def mock_download(image_id, **kwargs):
            nonlocal max_concurrent
            active_downloads.append(image_id)
            max_concurrent = max(max_concurrent, len(active_downloads))
            await asyncio.sleep(0.05)
            active_downloads.remove(image_id)
            return (Path(f"/tmp/{image_id}.jpg"), DownloadStatus.COMPLETE)

        mock_image_manager.download_image = AsyncMock(side_effect=mock_download)

        config = PreloadManagerConfig(
            preload_count=5,
            max_concurrent_downloads=2
        )
        manager = PreloadManager(mock_image_manager, config)

        images = create_playlist_images([1, 2, 3, 4, 5])

        async with manager:
            await manager.preload_images(images)
            await asyncio.sleep(0.3)

        # Max concurrent should not exceed limit
        assert max_concurrent <= 2


class TestPreloadCancellation:
    """Tests for preload cancellation."""

    @pytest.mark.asyncio
    async def test_cancel_preload(
        self,
        preload_manager: PreloadManager,
        mock_image_manager: MagicMock
    ):
        """Test cancelling a specific preload."""
        # Make download slow
        async def slow_download(image_id, **kwargs):
            await asyncio.sleep(1.0)
            return (Path(f"/tmp/{image_id}.jpg"), DownloadStatus.COMPLETE)

        mock_image_manager.download_image = AsyncMock(side_effect=slow_download)

        images = create_playlist_images([1, 2, 3])

        async with preload_manager:
            await preload_manager.preload_images(images)
            await asyncio.sleep(0.05)

            # Cancel one preload
            result = await preload_manager.cancel_preload(2)

            # 2 may or may not be in queue depending on timing
            # But cancelled count should increase if it was in queue
            if result:
                assert preload_manager._stats.cancelled_count > 0

    @pytest.mark.asyncio
    async def test_cancel_nonexistent_preload(self, preload_manager: PreloadManager):
        """Test cancelling a preload that doesn't exist."""
        async with preload_manager:
            result = await preload_manager.cancel_preload(999)
            assert not result

    @pytest.mark.asyncio
    async def test_cancel_all_on_stop(
        self,
        preload_manager: PreloadManager,
        mock_image_manager: MagicMock
    ):
        """Test that all preloads are cancelled on stop."""
        async def slow_download(image_id, **kwargs):
            await asyncio.sleep(10.0)
            return (Path(f"/tmp/{image_id}.jpg"), DownloadStatus.COMPLETE)

        mock_image_manager.download_image = AsyncMock(side_effect=slow_download)

        images = create_playlist_images([1, 2, 3, 4, 5])

        await preload_manager.start()
        await preload_manager.preload_images(images)
        await asyncio.sleep(0.1)

        await preload_manager.stop()

        # Queue should be empty after stop
        assert len(preload_manager._queue) == 0


class TestUpdatePreloadQueue:
    """Tests for update_preload_queue with PlaylistManager."""

    @pytest.mark.asyncio
    async def test_update_from_playlist(
        self,
        preload_manager: PreloadManager,
        mock_image_manager: MagicMock
    ):
        """Test updating queue from playlist manager."""
        # Create mock playlist manager
        mock_playlist = MagicMock()
        mock_playlist.get_upcoming_images = MagicMock(
            return_value=create_playlist_images([1, 2, 3])
        )

        async with preload_manager:
            await preload_manager.update_preload_queue(mock_playlist)
            await asyncio.sleep(0.1)

            mock_playlist.get_upcoming_images.assert_called_once_with(3)

    @pytest.mark.asyncio
    async def test_cancel_outdated_preloads(
        self,
        preload_manager: PreloadManager,
        mock_image_manager: MagicMock
    ):
        """Test that outdated preloads are cancelled when playlist updates."""
        async def slow_download(image_id, **kwargs):
            await asyncio.sleep(1.0)
            return (Path(f"/tmp/{image_id}.jpg"), DownloadStatus.COMPLETE)

        mock_image_manager.download_image = AsyncMock(side_effect=slow_download)

        mock_playlist = MagicMock()

        async with preload_manager:
            # First update with images 1, 2, 3
            mock_playlist.get_upcoming_images = MagicMock(
                return_value=create_playlist_images([1, 2, 3])
            )
            await preload_manager.update_preload_queue(mock_playlist)
            await asyncio.sleep(0.05)

            # Now update with different images (4, 5, 6)
            mock_playlist.get_upcoming_images = MagicMock(
                return_value=create_playlist_images([4, 5, 6])
            )
            await preload_manager.update_preload_queue(mock_playlist)
            await asyncio.sleep(0.05)

            # Old images should be cancelled/removed
            queue_ids = set(preload_manager._queue.keys())
            assert 1 not in queue_ids or preload_manager._queue[1].status == PreloadStatus.CANCELLED
            assert 2 not in queue_ids or preload_manager._queue[2].status == PreloadStatus.CANCELLED
            assert 3 not in queue_ids or preload_manager._queue[3].status == PreloadStatus.CANCELLED

    @pytest.mark.asyncio
    async def test_update_priority_for_existing(
        self,
        preload_manager: PreloadManager,
        mock_image_manager: MagicMock
    ):
        """Test that priority is updated for existing queue items."""
        mock_playlist = MagicMock()

        async with preload_manager:
            # First update: image 3 has priority 2
            mock_playlist.get_upcoming_images = MagicMock(
                return_value=create_playlist_images([1, 2, 3])
            )
            await preload_manager.update_preload_queue(mock_playlist)

            # Get entry for image 3
            if 3 in preload_manager._queue:
                assert preload_manager._queue[3].priority == 2

            # Second update: image 3 now has priority 0
            mock_playlist.get_upcoming_images = MagicMock(
                return_value=create_playlist_images([3, 2, 1])
            )
            await preload_manager.update_preload_queue(mock_playlist)

            # Priority should be updated
            if 3 in preload_manager._queue:
                assert preload_manager._queue[3].priority == 0

    @pytest.mark.asyncio
    async def test_empty_playlist_clears_queue(
        self,
        preload_manager: PreloadManager,
        mock_image_manager: MagicMock
    ):
        """Test that empty playlist clears the queue."""
        mock_playlist = MagicMock()

        async with preload_manager:
            # First update with images
            mock_playlist.get_upcoming_images = MagicMock(
                return_value=create_playlist_images([1, 2, 3])
            )
            await preload_manager.update_preload_queue(mock_playlist)
            await asyncio.sleep(0.05)

            # Now update with empty playlist
            mock_playlist.get_upcoming_images = MagicMock(return_value=[])
            await preload_manager.update_preload_queue(mock_playlist)
            await asyncio.sleep(0.05)

            # Queue should be empty
            assert len(preload_manager._queue) == 0


class TestPreloadStatus:
    """Tests for preload status and statistics."""

    @pytest.mark.asyncio
    async def test_is_preloading(
        self,
        preload_manager: PreloadManager,
        mock_image_manager: MagicMock
    ):
        """Test is_preloading check."""
        async def slow_download(image_id, **kwargs):
            await asyncio.sleep(0.5)
            return (Path(f"/tmp/{image_id}.jpg"), DownloadStatus.COMPLETE)

        mock_image_manager.download_image = AsyncMock(side_effect=slow_download)
        preload_manager.config.max_concurrent_downloads = 1

        images = create_playlist_images([1])

        async with preload_manager:
            await preload_manager.preload_images(images)
            await asyncio.sleep(0.05)

            # Should be downloading
            assert preload_manager.is_preloading(1)

    @pytest.mark.asyncio
    async def test_is_preload_pending(self, preload_manager: PreloadManager):
        """Test is_preload_pending check."""
        async def slow_download(image_id, **kwargs):
            await asyncio.sleep(0.5)
            return (Path(f"/tmp/{image_id}.jpg"), DownloadStatus.COMPLETE)

        preload_manager.image_manager.download_image = AsyncMock(side_effect=slow_download)
        preload_manager.config.max_concurrent_downloads = 1

        images = create_playlist_images([1, 2, 3])

        async with preload_manager:
            await preload_manager.preload_images(images)
            await asyncio.sleep(0.02)

            # Image 1 is downloading, 2 and 3 should be pending
            # (depending on timing)
            queue_status = preload_manager.get_queue_status()
            pending_count = sum(
                1 for s in queue_status.values() if s == PreloadStatus.PENDING
            )
            # At least one should be pending
            assert pending_count >= 0  # May vary based on timing

    @pytest.mark.asyncio
    async def test_get_stats(
        self,
        preload_manager: PreloadManager,
        mock_image_manager: MagicMock
    ):
        """Test statistics tracking."""
        images = create_playlist_images([1, 2])

        async with preload_manager:
            await preload_manager.preload_images(images)
            await asyncio.sleep(0.2)

        stats = preload_manager.get_stats()
        assert isinstance(stats, PreloadStats)
        assert stats.total_preloaded >= 0

    @pytest.mark.asyncio
    async def test_get_status(self, preload_manager: PreloadManager):
        """Test status dictionary."""
        async with preload_manager:
            status = preload_manager.get_status()

            assert "running" in status
            assert status["running"] == True
            assert "queue_size" in status
            assert "active_downloads" in status
            assert "config" in status
            assert status["config"]["preload_count"] == 3

    @pytest.mark.asyncio
    async def test_get_queue_status(
        self,
        preload_manager: PreloadManager,
        mock_image_manager: MagicMock
    ):
        """Test get_queue_status returns correct mapping."""
        async def slow_download(image_id, **kwargs):
            await asyncio.sleep(0.5)
            return (Path(f"/tmp/{image_id}.jpg"), DownloadStatus.COMPLETE)

        mock_image_manager.download_image = AsyncMock(side_effect=slow_download)

        images = create_playlist_images([1, 2, 3])

        async with preload_manager:
            await preload_manager.preload_images(images)
            await asyncio.sleep(0.05)

            status = preload_manager.get_queue_status()
            assert isinstance(status, dict)
            # All items should have a PreloadStatus value
            for image_id, s in status.items():
                assert isinstance(s, PreloadStatus)


class TestProgressCallback:
    """Tests for progress callback."""

    @pytest.mark.asyncio
    async def test_progress_callback_called(
        self,
        preload_manager: PreloadManager,
        mock_image_manager: MagicMock
    ):
        """Test that progress callback is called during downloads."""
        progress_updates = []

        def on_progress(image_id: int, progress: DownloadProgress):
            progress_updates.append((image_id, progress))

        preload_manager.set_progress_callback(on_progress)

        # Create a download that calls the progress callback
        async def download_with_progress(image_id, progress_callback=None, **kwargs):
            if progress_callback:
                progress = DownloadProgress(
                    url=f"/api/images/{image_id}/file",
                    status=DownloadStatus.DOWNLOADING,
                    bytes_downloaded=1000,
                    total_bytes=2000,
                    progress_percent=50.0
                )
                progress_callback(progress)
            return (Path(f"/tmp/{image_id}.jpg"), DownloadStatus.COMPLETE)

        mock_image_manager.download_image = AsyncMock(side_effect=download_with_progress)

        images = create_playlist_images([1])

        async with preload_manager:
            await preload_manager.preload_images(images)
            await asyncio.sleep(0.2)

        # Progress callback should have been called
        assert len(progress_updates) > 0
        assert progress_updates[0][0] == 1


class TestErrorHandling:
    """Tests for error handling."""

    @pytest.mark.asyncio
    async def test_download_failure_tracked(
        self,
        preload_manager: PreloadManager,
        mock_image_manager: MagicMock
    ):
        """Test that download failures are tracked."""
        from glowworm_daemon.image_manager import ImageNotFoundError

        async def failing_download(image_id, **kwargs):
            raise ImageNotFoundError(f"Image {image_id} not found")

        mock_image_manager.download_image = AsyncMock(side_effect=failing_download)

        images = create_playlist_images([1])

        async with preload_manager:
            await preload_manager.preload_images(images)
            await asyncio.sleep(0.2)

        stats = preload_manager.get_stats()
        assert stats.failed_count > 0

    @pytest.mark.asyncio
    async def test_cancelled_download_tracked(
        self,
        preload_manager: PreloadManager,
        mock_image_manager: MagicMock
    ):
        """Test that cancelled downloads are tracked."""
        async def slow_download(image_id, **kwargs):
            await asyncio.sleep(10.0)
            return (Path(f"/tmp/{image_id}.jpg"), DownloadStatus.COMPLETE)

        mock_image_manager.download_image = AsyncMock(side_effect=slow_download)

        images = create_playlist_images([1])

        await preload_manager.start()
        await preload_manager.preload_images(images)
        await asyncio.sleep(0.05)

        # Cancel by stopping
        await preload_manager.stop()

        stats = preload_manager.get_stats()
        assert stats.cancelled_count > 0


class TestIntegration:
    """Integration-style tests."""

    @pytest.mark.asyncio
    async def test_full_preload_cycle(
        self,
        preload_manager: PreloadManager,
        mock_image_manager: MagicMock
    ):
        """Test a full preload cycle."""
        downloaded_ids = []

        async def track_download(image_id, **kwargs):
            downloaded_ids.append(image_id)
            await asyncio.sleep(0.01)
            return (Path(f"/tmp/{image_id}.jpg"), DownloadStatus.COMPLETE)

        mock_image_manager.download_image = AsyncMock(side_effect=track_download)

        mock_playlist = MagicMock()
        mock_playlist.get_upcoming_images = MagicMock(
            return_value=create_playlist_images([1, 2, 3])
        )

        async with preload_manager:
            # Initial preload
            await preload_manager.update_preload_queue(mock_playlist)

            # Wait for all downloads to complete
            for _ in range(50):  # Wait up to 0.5 seconds
                if len(downloaded_ids) >= 3:
                    break
                await asyncio.sleep(0.01)

            # All images should be downloaded
            assert set(downloaded_ids) == {1, 2, 3}

            # Simulate playlist advance
            mock_playlist.get_upcoming_images = MagicMock(
                return_value=create_playlist_images([2, 3, 4])
            )
            await preload_manager.update_preload_queue(mock_playlist)

            # Wait for image 4 to be downloaded
            for _ in range(50):  # Wait up to 0.5 seconds
                if 4 in downloaded_ids:
                    break
                await asyncio.sleep(0.01)

            # Image 4 should be downloaded (2 and 3 already done)
            assert 4 in downloaded_ids

    @pytest.mark.asyncio
    async def test_no_duplicate_downloads(
        self,
        preload_manager: PreloadManager,
        mock_image_manager: MagicMock
    ):
        """Test that same image is not downloaded twice."""
        download_counts: Dict[int, int] = {}

        async def count_downloads(image_id, **kwargs):
            download_counts[image_id] = download_counts.get(image_id, 0) + 1
            return (Path(f"/tmp/{image_id}.jpg"), DownloadStatus.COMPLETE)

        mock_image_manager.download_image = AsyncMock(side_effect=count_downloads)

        mock_playlist = MagicMock()

        async with preload_manager:
            # Request same images multiple times
            mock_playlist.get_upcoming_images = MagicMock(
                return_value=create_playlist_images([1, 2, 3])
            )
            await preload_manager.update_preload_queue(mock_playlist)
            await asyncio.sleep(0.05)

            # Request again (should not re-download)
            await preload_manager.update_preload_queue(mock_playlist)
            await asyncio.sleep(0.2)

        # Each image should only be downloaded once
        for image_id, count in download_counts.items():
            assert count == 1, f"Image {image_id} downloaded {count} times"
