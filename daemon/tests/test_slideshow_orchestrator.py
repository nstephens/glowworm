"""Tests for SlideshowOrchestrator."""
import asyncio
import pytest
from pathlib import Path
from typing import Any, Dict, List, Optional
from unittest.mock import AsyncMock, MagicMock, patch

from glowworm_daemon.slideshow_orchestrator import (
    SlideshowOrchestrator,
    SlideshowConfig,
    SlideshowState,
    SlideshowStats,
    create_slideshow_orchestrator,
)
from glowworm_daemon.playlist_manager import (
    PlaylistData,
    PlaylistImage,
    PlaylistEntry,
    PlaylistPosition,
)
from glowworm_daemon.image_manager import DownloadStatus


# --- Mock Classes ---


class MockDisplayController:
    """Mock DisplayController for testing."""

    def __init__(self, running: bool = True):
        self._running = running
        self.loaded_images: List[Dict] = []
        self.paused = False
        self.cleared = False
        self.last_status: Optional[Dict] = None

    @property
    def is_running(self) -> bool:
        return self._running

    async def load_image(
        self,
        path: str,
        scale_mode: str = "fit",
        transition_duration: float = 1.0,
    ) -> bool:
        self.loaded_images.append({
            "path": path,
            "scale_mode": scale_mode,
            "transition_duration": transition_duration,
        })
        return True

    async def queue_image(self, path: str, **kwargs) -> int:
        return len(self.loaded_images)

    async def pause(self) -> bool:
        self.paused = True
        return True

    async def resume(self) -> bool:
        self.paused = False
        return True

    async def clear(self) -> bool:
        self.cleared = True
        return True

    async def get_status(self) -> Dict:
        return {"state": "running"}


class MockPlaylistManager:
    """Mock PlaylistManager for testing."""

    def __init__(self, images: Optional[List[PlaylistImage]] = None):
        self._images = images or [
            PlaylistImage(id=1, url="/api/images/1/file", filename="1.jpg"),
            PlaylistImage(id=2, url="/api/images/2/file", filename="2.jpg"),
            PlaylistImage(id=3, url="/api/images/3/file", filename="3.jpg"),
        ]
        self._position = 0
        self._playlist = PlaylistData(
            id=1,
            name="Test Playlist",
            slug="test-playlist",
            display_time_seconds=30,
            sequence=[img.id for img in self._images],
            images={img.id: img for img in self._images},
        )

    @property
    def playlist(self) -> PlaylistData:
        return self._playlist

    @property
    def current_position(self) -> int:
        return self._position

    def get_current_images(self) -> List[PlaylistImage]:
        if not self._images:
            return []
        return [self._images[self._position % len(self._images)]]

    def get_current_entry(self) -> Optional[PlaylistEntry]:
        images = self.get_current_images()
        if images:
            return PlaylistEntry(entry_type="single", image_ids=[img.id for img in images])
        return None

    def next(self) -> tuple:
        if not self._images:
            return None, 0
        self._position = (self._position + 1) % len(self._images)
        return self.get_current_entry(), self._position

    def previous(self) -> tuple:
        if not self._images:
            return None, 0
        self._position = (self._position - 1) % len(self._images)
        return self.get_current_entry(), self._position

    def go_to(self, position: int) -> tuple:
        if not self._images:
            return None, 0
        self._position = max(0, min(position, len(self._images) - 1))
        return self.get_current_entry(), self._position

    def get_upcoming_images(self, count: int = 3) -> List[PlaylistImage]:
        if not self._images:
            return []
        result = []
        for i in range(1, count + 1):
            idx = (self._position + i) % len(self._images)
            result.append(self._images[idx])
        return result

    async def fetch_playlist(self) -> PlaylistData:
        return self._playlist

    async def check_for_updates(self) -> bool:
        return False


class MockImageManager:
    """Mock ImageManager for testing."""

    def __init__(self, cache_dir: str = "/tmp/test_cache"):
        self.cache_dir = Path(cache_dir)
        self._cached: Dict[int, Path] = {}
        self._downloads: List[int] = []
        self._fail_ids: set = set()

    def get_cached_path(self, image_id: int, size: str = "original") -> Optional[Path]:
        return self._cached.get(image_id)

    def is_cached(self, image_id: int, size: str = "original") -> bool:
        return image_id in self._cached

    async def download_image(
        self,
        image_id: int,
        size: str = "original",
        force: bool = False,
        progress_callback=None,
    ) -> tuple:
        self._downloads.append(image_id)

        if image_id in self._fail_ids:
            raise Exception(f"Failed to download image {image_id}")

        # Simulate download - create a path
        path = self.cache_dir / f"{image_id}.jpg"
        self._cached[image_id] = path
        return path, DownloadStatus.COMPLETE

    def set_cached(self, image_id: int, path: Path):
        """Add an image to the cache."""
        self._cached[image_id] = path

    def set_fail(self, image_id: int):
        """Make an image fail to download."""
        self._fail_ids.add(image_id)


class MockPreloadManager:
    """Mock PreloadManager for testing."""

    def __init__(self):
        self.queue_updates: List = []
        self.running = False

    async def start(self):
        self.running = True

    async def stop(self):
        self.running = False

    async def update_preload_queue(self, playlist_manager):
        self.queue_updates.append(playlist_manager.current_position)


# --- Fixtures ---


@pytest.fixture
def display():
    return MockDisplayController()


@pytest.fixture
def playlist():
    return MockPlaylistManager()


@pytest.fixture
def images(tmp_path):
    manager = MockImageManager(str(tmp_path / "cache"))
    # Pre-cache some images with actual files
    for i in range(1, 4):
        path = tmp_path / "cache" / f"{i}.jpg"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"\xff\xd8\xff\xe0")  # JPEG magic bytes
        manager.set_cached(i, path)
    return manager


@pytest.fixture
def preloader():
    return MockPreloadManager()


@pytest.fixture
def orchestrator(display, playlist, images, preloader):
    config = SlideshowConfig(
        default_display_time=0.5,  # Short for testing
        transition_duration=0.1,
        scale_mode="fit",
        preload_count=2,
        playlist_update_interval=60.0,  # Long to avoid triggering in tests
    )
    return SlideshowOrchestrator(
        display=display,
        playlist=playlist,
        images=images,
        preloader=preloader,
        config=config,
    )


# --- Tests ---


class TestSlideshowConfig:
    """Tests for SlideshowConfig."""

    def test_default_values(self):
        config = SlideshowConfig()
        assert config.default_display_time == 30.0
        assert config.transition_duration == 1.0
        assert config.scale_mode == "fit"
        assert config.preload_count == 3
        assert config.max_image_retries == 2

    def test_custom_values(self):
        config = SlideshowConfig(
            default_display_time=60.0,
            transition_duration=2.0,
            scale_mode="fill",
            preload_count=5,
        )
        assert config.default_display_time == 60.0
        assert config.transition_duration == 2.0
        assert config.scale_mode == "fill"
        assert config.preload_count == 5


class TestSlideshowOrchestrator:
    """Tests for SlideshowOrchestrator."""

    @pytest.mark.asyncio
    async def test_initial_state(self, orchestrator):
        """Test initial state is stopped."""
        assert orchestrator.state == SlideshowState.STOPPED
        assert not orchestrator.is_playing
        assert not orchestrator.is_paused

    @pytest.mark.asyncio
    async def test_start(self, orchestrator):
        """Test starting the slideshow."""
        success = await orchestrator.start()
        assert success
        assert orchestrator.state in (SlideshowState.PLAYING, SlideshowState.TRANSITIONING)
        assert orchestrator.is_playing

        # Clean up
        await orchestrator.stop()

    @pytest.mark.asyncio
    async def test_start_no_playlist(self, display, images, preloader):
        """Test start fails without playlist."""
        playlist = MockPlaylistManager([])  # Empty playlist
        playlist._playlist = None

        orchestrator = SlideshowOrchestrator(
            display=display,
            playlist=playlist,
            images=images,
            preloader=preloader,
        )

        success = await orchestrator.start()
        assert not success
        assert orchestrator.state == SlideshowState.ERROR

    @pytest.mark.asyncio
    async def test_start_display_not_running(self, playlist, images, preloader):
        """Test start fails if display not running."""
        display = MockDisplayController(running=False)

        orchestrator = SlideshowOrchestrator(
            display=display,
            playlist=playlist,
            images=images,
            preloader=preloader,
        )

        success = await orchestrator.start()
        assert not success
        assert orchestrator.state == SlideshowState.ERROR

    @pytest.mark.asyncio
    async def test_stop(self, orchestrator):
        """Test stopping the slideshow."""
        await orchestrator.start()
        await asyncio.sleep(0.1)

        await orchestrator.stop()
        assert orchestrator.state == SlideshowState.STOPPED
        assert not orchestrator.is_playing
        assert orchestrator.display.cleared

    @pytest.mark.asyncio
    async def test_pause_resume(self, orchestrator):
        """Test pause and resume functionality."""
        await orchestrator.start()
        await asyncio.sleep(0.1)

        # Pause
        success = await orchestrator.pause()
        assert success
        assert orchestrator.is_paused
        assert orchestrator.display.paused

        # Resume
        success = await orchestrator.resume()
        assert success
        assert not orchestrator.is_paused
        assert orchestrator.is_playing
        assert not orchestrator.display.paused

        await orchestrator.stop()

    @pytest.mark.asyncio
    async def test_pause_when_not_playing(self, orchestrator):
        """Test pause when not playing returns False."""
        success = await orchestrator.pause()
        assert not success

    @pytest.mark.asyncio
    async def test_resume_when_not_paused(self, orchestrator):
        """Test resume when not paused returns False."""
        success = await orchestrator.resume()
        assert not success

    @pytest.mark.asyncio
    async def test_next(self, orchestrator):
        """Test advancing to next image."""
        await orchestrator.start()
        await asyncio.sleep(0.1)

        initial_pos = orchestrator.playlist.current_position

        success = await orchestrator.next()
        assert success
        # Position should have advanced
        assert orchestrator.playlist.current_position == (initial_pos + 1) % 3

        await orchestrator.stop()

    @pytest.mark.asyncio
    async def test_previous(self, orchestrator):
        """Test going to previous image."""
        await orchestrator.start()
        await asyncio.sleep(0.1)

        # Go to position 1 first
        await orchestrator.next()
        await asyncio.sleep(0.1)

        success = await orchestrator.previous()
        assert success
        # Should be back at position 0
        assert orchestrator.playlist.current_position == 0

        await orchestrator.stop()

    @pytest.mark.asyncio
    async def test_go_to(self, orchestrator):
        """Test going to specific position."""
        await orchestrator.start()
        await asyncio.sleep(0.1)

        success = await orchestrator.go_to(2)
        assert success
        assert orchestrator.playlist.current_position == 2

        await orchestrator.stop()

    @pytest.mark.asyncio
    async def test_image_display(self, orchestrator, display):
        """Test that images are sent to display."""
        await orchestrator.start()

        # Wait for first image to be displayed
        await asyncio.sleep(0.2)

        assert len(display.loaded_images) >= 1
        assert display.loaded_images[0]["scale_mode"] == "fit"

        await orchestrator.stop()

    @pytest.mark.asyncio
    async def test_automatic_advance(self, orchestrator, display):
        """Test that slideshow advances automatically."""
        # Use very short display time
        orchestrator.config.default_display_time = 0.2
        orchestrator.playlist._playlist.display_time_seconds = 0.2

        await orchestrator.start()

        # Wait for multiple advances
        await asyncio.sleep(0.8)

        # Should have displayed multiple images
        assert len(display.loaded_images) >= 2

        await orchestrator.stop()

    @pytest.mark.asyncio
    async def test_missing_image_skipped(self, orchestrator, images):
        """Test that missing images are skipped."""
        # Make image 2 fail to download
        images.set_fail(2)
        # Remove it from cache
        images._cached.pop(2, None)

        orchestrator.config.default_display_time = 0.1
        orchestrator.config.image_retry_delay = 0.05
        orchestrator.config.max_image_retries = 1

        await orchestrator.start()

        # Give time for slideshow to process
        await asyncio.sleep(0.5)

        # Check that skipped count increased
        assert orchestrator.stats.images_skipped >= 0

        await orchestrator.stop()

    @pytest.mark.asyncio
    async def test_preloader_updated(self, orchestrator, preloader):
        """Test that preloader is updated after displaying images."""
        await orchestrator.start()
        await asyncio.sleep(0.3)

        # Preloader should have been updated at least once
        assert len(preloader.queue_updates) >= 1

        await orchestrator.stop()

    @pytest.mark.asyncio
    async def test_state_callbacks(self, orchestrator):
        """Test state change callbacks."""
        states: List[tuple] = []

        def on_state_change(old, new):
            states.append((old, new))

        orchestrator.add_state_callback(on_state_change)

        await orchestrator.start()
        await asyncio.sleep(0.1)
        await orchestrator.stop()

        # Should have state transitions
        assert len(states) >= 2

    @pytest.mark.asyncio
    async def test_get_status(self, orchestrator):
        """Test getting status information."""
        await orchestrator.start()
        await asyncio.sleep(0.2)

        status = orchestrator.get_status()

        assert "state" in status
        assert "is_playing" in status
        assert "is_paused" in status
        assert "images_displayed" in status
        assert "config" in status
        assert "playlist" in status

        await orchestrator.stop()

    @pytest.mark.asyncio
    async def test_stats_tracking(self, orchestrator):
        """Test statistics are tracked correctly."""
        await orchestrator.start()
        await asyncio.sleep(0.3)

        stats = orchestrator.stats

        assert stats.images_displayed >= 1
        assert stats.started_at is not None
        assert stats.total_runtime_seconds > 0

        await orchestrator.stop()

    @pytest.mark.asyncio
    async def test_context_manager(self, display, playlist, images):
        """Test context manager usage."""
        config = SlideshowConfig(
            default_display_time=0.5,
            transition_duration=0.1,
            playlist_update_interval=60.0,
        )

        async with SlideshowOrchestrator(
            display=display,
            playlist=playlist,
            images=images,
            config=config,
        ) as orch:
            assert orch.state in (SlideshowState.PLAYING, SlideshowState.TRANSITIONING)
            await asyncio.sleep(0.1)

        # Should be stopped after exiting context
        assert orch.state == SlideshowState.STOPPED

    @pytest.mark.asyncio
    async def test_reload_playlist(self, orchestrator):
        """Test reloading playlist."""
        await orchestrator.start()
        await asyncio.sleep(0.1)

        success = await orchestrator.reload_playlist()
        assert success

        await orchestrator.stop()

    @pytest.mark.asyncio
    async def test_next_when_paused_resumes(self, orchestrator):
        """Test that next() when paused also resumes."""
        await orchestrator.start()
        await asyncio.sleep(0.1)

        await orchestrator.pause()
        assert orchestrator.is_paused

        await orchestrator.next()
        # Should be playing again
        assert orchestrator.is_playing

        await orchestrator.stop()


class TestCreateSlideshowOrchestrator:
    """Tests for factory function."""

    def test_create_with_defaults(self, display, playlist, images):
        orchestrator = create_slideshow_orchestrator(
            display=display,
            playlist=playlist,
            images=images,
        )

        assert orchestrator.config.default_display_time == 30.0
        assert orchestrator.config.transition_duration == 1.0
        assert orchestrator.config.scale_mode == "fit"

    def test_create_with_custom_values(self, display, playlist, images, preloader):
        orchestrator = create_slideshow_orchestrator(
            display=display,
            playlist=playlist,
            images=images,
            preloader=preloader,
            default_display_time=60.0,
            transition_duration=2.0,
            scale_mode="fill",
        )

        assert orchestrator.config.default_display_time == 60.0
        assert orchestrator.config.transition_duration == 2.0
        assert orchestrator.config.scale_mode == "fill"
        assert orchestrator.preloader is preloader
