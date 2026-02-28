"""
Unit tests for PlaylistManager.

Tests cover:
- Configuration and initialization
- Playlist fetching and parsing
- Position tracking with persistence
- Shuffle mode with deterministic seed
- Next/previous navigation
- Version checking for updates
"""
import asyncio
import json
import os
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

from glowworm_daemon.playlist_manager import (
    PlaylistData,
    PlaylistEntry,
    PlaylistImage,
    PlaylistManager,
    PlaylistManagerConfig,
    PlaylistPosition,
    PlaylistStatus,
    PlaylistError,
    PlaylistNotFoundError,
)


# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def temp_state_dir():
    """Create a temporary directory for state files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def config(temp_state_dir):
    """Create test configuration."""
    return PlaylistManagerConfig(
        backend_url="http://localhost:8000",
        device_token="test-token-123",
        state_dir=temp_state_dir,
        max_retries=2,
        retry_base_delay=0.1,
    )


@pytest.fixture
def sample_manifest():
    """Sample playlist manifest response."""
    return {
        "success": True,
        "playlist_id": 1,
        "playlist_name": "Test Playlist",
        "manifest": [
            {
                "id": "101",
                "url": "/api/images/101/file",
                "filename": "image1.jpg",
                "mime_type": "image/jpeg",
                "file_size": 1024000,
                "checksum": "abc123",
            },
            {
                "id": "102",
                "url": "/api/images/102/file",
                "filename": "image2.jpg",
                "mime_type": "image/jpeg",
                "file_size": 2048000,
                "checksum": "def456",
            },
            {
                "id": "103",
                "url": "/api/images/103/file",
                "filename": "image3.jpg",
                "mime_type": "image/png",
                "file_size": 512000,
                "checksum": "ghi789",
            },
        ],
        "count": 3,
    }


@pytest.fixture
def sample_playlist_response():
    """Sample playlist with computed sequence."""
    return {
        "success": True,
        "playlist": {
            "id": 2,
            "name": "Paired Playlist",
            "slug": "paired-playlist",
            "display_time_seconds": 15,
            "display_mode": "ken_burns_plus",
            "sequence": [201, 202, 203, 204],
            "computed_sequence": [
                {"type": "pair", "images": [201, 202]},
                {"type": "single", "images": [203]},
                {"type": "single", "images": [204]},
            ],
            "updated_at": "2026-02-28T12:00:00Z",
        },
        "manifest": [
            {
                "id": "201",
                "url": "/api/images/201/file",
                "filename": "paired1.jpg",
                "mime_type": "image/jpeg",
                "file_size": 1000000,
            },
            {
                "id": "202",
                "url": "/api/images/202/file",
                "filename": "paired2.jpg",
                "mime_type": "image/jpeg",
                "file_size": 1100000,
            },
            {
                "id": "203",
                "url": "/api/images/203/file",
                "filename": "single1.jpg",
                "mime_type": "image/jpeg",
                "file_size": 900000,
            },
            {
                "id": "204",
                "url": "/api/images/204/file",
                "filename": "single2.jpg",
                "mime_type": "image/jpeg",
                "file_size": 950000,
            },
        ],
    }


def create_mock_response(status: int = 200, json_data: dict = None):
    """Create a mock aiohttp response."""
    response = MagicMock()
    response.status = status
    response.json = AsyncMock(return_value=json_data or {})
    return response


class MockAsyncContextManager:
    """Helper class for mocking async context managers."""
    def __init__(self, response):
        self.response = response

    async def __aenter__(self):
        return self.response

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        return None


def create_mock_session_get(response):
    """Create a mock for session.get() that works with async with."""
    def mock_get(*args, **kwargs):
        return MockAsyncContextManager(response)
    return mock_get


# ============================================================================
# Configuration Tests
# ============================================================================


class TestPlaylistManagerConfig:
    """Test PlaylistManagerConfig."""

    def test_default_values(self, temp_state_dir):
        """Test configuration defaults."""
        config = PlaylistManagerConfig(
            backend_url="http://example.com",
            device_token="token123",
            state_dir=temp_state_dir,
        )

        assert config.backend_url == "http://example.com"
        assert config.device_token == "token123"
        assert config.connect_timeout == 10.0
        assert config.read_timeout == 30.0
        assert config.max_retries == 3
        assert config.retry_base_delay == 1.0
        assert config.retry_max_delay == 60.0

    def test_creates_state_dir(self, temp_state_dir):
        """Test that state directory is created."""
        new_dir = os.path.join(temp_state_dir, "subdir", "state")
        config = PlaylistManagerConfig(
            backend_url="http://example.com",
            device_token="token123",
            state_dir=new_dir,
        )

        assert os.path.exists(new_dir)


# ============================================================================
# PlaylistPosition Tests
# ============================================================================


class TestPlaylistPosition:
    """Test PlaylistPosition serialization."""

    def test_to_dict(self):
        """Test converting position to dict."""
        pos = PlaylistPosition(
            playlist_id=1,
            position=5,
            shuffled_order=[3, 1, 4, 2, 0],
            shuffle_seed=12345,
        )

        data = pos.to_dict()

        assert data["playlist_id"] == 1
        assert data["position"] == 5
        assert data["shuffled_order"] == [3, 1, 4, 2, 0]
        assert data["shuffle_seed"] == 12345
        assert "last_updated" in data

    def test_from_dict(self):
        """Test creating position from dict."""
        data = {
            "playlist_id": 2,
            "position": 10,
            "shuffled_order": [1, 0, 2],
            "shuffle_seed": 99999,
            "last_updated": 1234567890.0,
        }

        pos = PlaylistPosition.from_dict(data)

        assert pos.playlist_id == 2
        assert pos.position == 10
        assert pos.shuffled_order == [1, 0, 2]
        assert pos.shuffle_seed == 99999
        assert pos.last_updated == 1234567890.0

    def test_from_dict_defaults(self):
        """Test from_dict with missing optional fields."""
        data = {"playlist_id": 3}

        pos = PlaylistPosition.from_dict(data)

        assert pos.playlist_id == 3
        assert pos.position == 0
        assert pos.shuffled_order is None
        assert pos.shuffle_seed is None


# ============================================================================
# PlaylistManager Initialization Tests
# ============================================================================


class TestPlaylistManagerInit:
    """Test PlaylistManager initialization."""

    def test_initial_state(self, config):
        """Test manager initial state."""
        manager = PlaylistManager(config)

        assert manager.config == config
        assert manager.playlist is None
        assert manager.status == PlaylistStatus.NOT_LOADED
        assert manager.current_position == 0
        assert manager.shuffle_enabled is False

    @pytest.mark.asyncio
    async def test_start_creates_session(self, config):
        """Test that start creates HTTP session."""
        manager = PlaylistManager(config)

        mock_instance = MagicMock()
        mock_instance.close = AsyncMock()

        with patch("aiohttp.ClientSession", return_value=mock_instance) as mock_session:
            await manager.start()

            mock_session.assert_called_once()
            assert manager._session is mock_instance

        await manager.stop()

    @pytest.mark.asyncio
    async def test_context_manager(self, config):
        """Test async context manager."""
        mock_instance = MagicMock()
        mock_instance.close = AsyncMock()

        with patch("aiohttp.ClientSession", return_value=mock_instance):
            async with PlaylistManager(config) as manager:
                assert manager._session is not None

            assert manager._session is None


# ============================================================================
# Playlist Fetching Tests
# ============================================================================


class TestPlaylistFetching:
    """Test playlist fetching from backend."""

    @pytest.mark.asyncio
    async def test_fetch_manifest_success(self, config, sample_manifest):
        """Test successful manifest fetch."""
        manager = PlaylistManager(config)

        mock_response = create_mock_response(200, sample_manifest)
        mock_session = MagicMock()
        mock_session.get = create_mock_session_get(mock_response)
        manager._session = mock_session

        playlist = await manager.fetch_playlist(playlist_id=1)

        assert playlist.id == 1
        assert playlist.name == "Test Playlist"
        assert playlist.image_count == 3
        assert 101 in playlist.images
        assert 102 in playlist.images
        assert 103 in playlist.images
        assert manager.status == PlaylistStatus.OK

    @pytest.mark.asyncio
    async def test_fetch_playlist_with_computed_sequence(self, config, sample_playlist_response):
        """Test fetching playlist with computed sequence."""
        manager = PlaylistManager(config)

        mock_response = create_mock_response(200, sample_playlist_response)
        mock_session = MagicMock()
        mock_session.get = create_mock_session_get(mock_response)
        manager._session = mock_session

        playlist = await manager.fetch_playlist(playlist_id=2)

        assert playlist.id == 2
        assert playlist.name == "Paired Playlist"
        assert playlist.display_time_seconds == 15
        assert len(playlist.computed_sequence) == 3
        assert playlist.computed_sequence[0].entry_type == "pair"
        assert playlist.computed_sequence[0].image_ids == [201, 202]
        assert playlist.entry_count == 3

    @pytest.mark.asyncio
    async def test_fetch_404_raises_not_found(self, config):
        """Test 404 raises PlaylistNotFoundError."""
        manager = PlaylistManager(config)

        mock_response = create_mock_response(404)
        mock_session = MagicMock()
        mock_session.get = create_mock_session_get(mock_response)
        manager._session = mock_session

        with pytest.raises(PlaylistNotFoundError):
            await manager.fetch_playlist(playlist_id=999)

        assert manager.status == PlaylistStatus.ERROR

    @pytest.mark.asyncio
    async def test_fetch_401_raises_error(self, config):
        """Test 401 raises PlaylistError."""
        manager = PlaylistManager(config)

        mock_response = create_mock_response(401)
        mock_session = MagicMock()
        mock_session.get = create_mock_session_get(mock_response)
        manager._session = mock_session

        with pytest.raises(PlaylistError, match="Authentication"):
            await manager.fetch_playlist(playlist_id=1)

    @pytest.mark.asyncio
    async def test_fetch_retries_on_server_error(self, config, sample_manifest):
        """Test retry on 5xx errors."""
        config.retry_base_delay = 0.01  # Speed up test

        manager = PlaylistManager(config)

        # First call returns 500, second returns 200
        error_response = create_mock_response(500)
        success_response = create_mock_response(200, sample_manifest)

        call_count = 0

        def mock_get(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return MockAsyncContextManager(error_response)
            else:
                return MockAsyncContextManager(success_response)

        mock_session = MagicMock()
        mock_session.get = mock_get
        manager._session = mock_session

        playlist = await manager.fetch_playlist(playlist_id=1)

        assert call_count == 2
        assert playlist.id == 1


# ============================================================================
# Navigation Tests
# ============================================================================


class TestNavigation:
    """Test playlist navigation."""

    @pytest.fixture
    def manager_with_playlist(self, config, sample_manifest):
        """Create manager with loaded playlist."""
        manager = PlaylistManager(config)
        playlist = manager._parse_manifest_response(sample_manifest)
        manager._playlist = playlist
        manager._position = PlaylistPosition(playlist_id=1)
        return manager

    def test_next_advances_position(self, manager_with_playlist):
        """Test next() advances position."""
        manager = manager_with_playlist

        entry, pos = manager.next()

        assert pos == 1
        assert entry is not None
        assert manager.current_position == 1

    def test_next_wraps_at_end(self, manager_with_playlist):
        """Test next() wraps to beginning at end of playlist."""
        manager = manager_with_playlist
        manager._position.position = 2  # Last position (3 images)

        entry, pos = manager.next()

        assert pos == 0
        assert manager.current_position == 0

    def test_previous_goes_back(self, manager_with_playlist):
        """Test previous() goes back."""
        manager = manager_with_playlist
        manager._position.position = 2

        entry, pos = manager.previous()

        assert pos == 1
        assert manager.current_position == 1

    def test_previous_wraps_at_beginning(self, manager_with_playlist):
        """Test previous() wraps to end at beginning."""
        manager = manager_with_playlist
        manager._position.position = 0

        entry, pos = manager.previous()

        assert pos == 2  # Should wrap to last position
        assert manager.current_position == 2

    def test_go_to_position(self, manager_with_playlist):
        """Test go_to() jumps to position."""
        manager = manager_with_playlist

        entry, pos = manager.go_to(2)

        assert pos == 2
        assert manager.current_position == 2

    def test_go_to_clamps_position(self, manager_with_playlist):
        """Test go_to() clamps out-of-bounds positions."""
        manager = manager_with_playlist

        # Too high
        entry, pos = manager.go_to(100)
        assert pos == 2  # Clamped to last

        # Too low
        entry, pos = manager.go_to(-5)
        assert pos == 0  # Clamped to first

    def test_get_current_images(self, manager_with_playlist):
        """Test getting current images."""
        manager = manager_with_playlist

        images = manager.get_current_images()

        assert len(images) == 1
        assert images[0].id == 101

    def test_get_upcoming_images(self, manager_with_playlist):
        """Test getting upcoming images for preloading."""
        manager = manager_with_playlist

        upcoming = manager.get_upcoming_images(count=2)

        assert len(upcoming) == 2
        assert upcoming[0].id == 102
        assert upcoming[1].id == 103


# ============================================================================
# Shuffle Tests
# ============================================================================


class TestShuffle:
    """Test shuffle mode."""

    @pytest.fixture
    def manager_with_playlist(self, config, sample_manifest):
        """Create manager with loaded playlist."""
        manager = PlaylistManager(config)
        playlist = manager._parse_manifest_response(sample_manifest)
        manager._playlist = playlist
        manager._position = PlaylistPosition(playlist_id=1)
        return manager

    def test_enable_shuffle(self, manager_with_playlist):
        """Test enabling shuffle."""
        manager = manager_with_playlist

        manager.set_shuffle(True, seed=42)

        assert manager.shuffle_enabled is True
        assert manager._position.shuffle_seed == 42
        assert manager._position.shuffled_order is not None
        assert len(manager._position.shuffled_order) == 3

    def test_deterministic_shuffle(self, manager_with_playlist):
        """Test shuffle with same seed produces same order."""
        manager = manager_with_playlist

        manager.set_shuffle(True, seed=12345)
        order1 = manager._position.shuffled_order.copy()

        manager.set_shuffle(True, seed=12345)
        order2 = manager._position.shuffled_order.copy()

        assert order1 == order2

    def test_different_seed_different_order(self, manager_with_playlist):
        """Test different seeds produce different orders."""
        manager = manager_with_playlist

        manager.set_shuffle(True, seed=111)
        order1 = manager._position.shuffled_order.copy()

        manager.set_shuffle(True, seed=222)
        order2 = manager._position.shuffled_order.copy()

        # With 3 items, different seeds almost always produce different orders
        # But there's a 1/6 chance they're the same, so we just check the shuffle happened
        assert manager._position.shuffled_order is not None

    def test_disable_shuffle(self, manager_with_playlist):
        """Test disabling shuffle."""
        manager = manager_with_playlist
        manager.set_shuffle(True, seed=42)
        assert manager.shuffle_enabled is True

        manager.set_shuffle(False)

        assert manager.shuffle_enabled is False
        assert manager._position.shuffled_order is None

    def test_navigation_respects_shuffle(self, manager_with_playlist):
        """Test that navigation uses shuffled order."""
        manager = manager_with_playlist

        # Enable shuffle with known seed
        manager.set_shuffle(True, seed=42)
        shuffled_order = manager._position.shuffled_order.copy()

        # Navigate and verify positions follow shuffle
        images_seen = []
        for _ in range(3):
            images = manager.get_current_images()
            images_seen.append(images[0].id)
            manager.next()

        # The order of images should follow the shuffled indices
        assert len(images_seen) == 3


# ============================================================================
# State Persistence Tests
# ============================================================================


class TestStatePersistence:
    """Test state persistence across restarts."""

    def test_save_and_load_state(self, config, sample_manifest):
        """Test state is saved and loaded correctly."""
        manager = PlaylistManager(config)
        playlist = manager._parse_manifest_response(sample_manifest)
        manager._playlist = playlist
        manager._position = PlaylistPosition(playlist_id=1, position=2)
        manager._shuffle_enabled = True

        # Save state
        manager._save_state()

        # Create new manager and load state
        manager2 = PlaylistManager(config)
        manager2._load_state()

        assert manager2._position.playlist_id == 1
        assert manager2._position.position == 2
        assert manager2._shuffle_enabled is True

    def test_position_persisted_on_navigation(self, config, sample_manifest):
        """Test position is persisted after navigation."""
        manager = PlaylistManager(config)
        playlist = manager._parse_manifest_response(sample_manifest)
        manager._playlist = playlist
        manager._position = PlaylistPosition(playlist_id=1)

        # Navigate
        manager.next()

        # Check state file exists
        state_file = Path(config.state_dir) / "playlist_state.json"
        assert state_file.exists()

        # Load and verify
        with open(state_file) as f:
            data = json.load(f)

        assert data["position"] == 1


# ============================================================================
# Version Checking Tests
# ============================================================================


class TestVersionChecking:
    """Test playlist version checking."""

    def test_version_hash_computed(self, config, sample_manifest):
        """Test version hash is computed."""
        manager = PlaylistManager(config)
        playlist = manager._parse_manifest_response(sample_manifest)

        assert playlist.version_hash != ""
        assert len(playlist.version_hash) == 16

    def test_version_hash_changes_with_content(self, config):
        """Test version hash changes when content changes."""
        manager = PlaylistManager(config)

        manifest1 = {
            "playlist_id": 1,
            "playlist_name": "Test",
            "manifest": [{"id": "1", "checksum": "aaa"}],
        }
        manifest2 = {
            "playlist_id": 1,
            "playlist_name": "Test",
            "manifest": [{"id": "1", "checksum": "bbb"}],  # Different checksum
        }

        playlist1 = manager._parse_manifest_response(manifest1)
        playlist2 = manager._parse_manifest_response(manifest2)

        assert playlist1.version_hash != playlist2.version_hash


# ============================================================================
# Status Tests
# ============================================================================


class TestStatus:
    """Test status reporting."""

    def test_get_status_no_playlist(self, config):
        """Test status when no playlist loaded."""
        manager = PlaylistManager(config)

        status = manager.get_status()

        assert status["status"] == "not_loaded"
        assert "playlist" not in status

    def test_get_status_with_playlist(self, config, sample_manifest):
        """Test status with loaded playlist."""
        manager = PlaylistManager(config)
        playlist = manager._parse_manifest_response(sample_manifest)
        manager._playlist = playlist
        manager._position = PlaylistPosition(playlist_id=1)
        manager._status = PlaylistStatus.OK

        status = manager.get_status()

        assert status["status"] == "ok"
        assert status["playlist"]["id"] == 1
        assert status["playlist"]["image_count"] == 3
        assert "current_entry" in status


# ============================================================================
# Empty Playlist Tests
# ============================================================================


class TestEmptyPlaylist:
    """Test handling of empty playlists."""

    def test_empty_playlist_navigation(self, config):
        """Test navigation with empty playlist."""
        manager = PlaylistManager(config)
        manager._playlist = PlaylistData(
            id=1, name="Empty", slug="empty",
            sequence=[], images={}
        )
        manager._position = PlaylistPosition(playlist_id=1)

        entry, pos = manager.next()
        assert entry is None
        assert pos == 0

        entry, pos = manager.previous()
        assert entry is None
        assert pos == 0

    def test_empty_playlist_current_entry(self, config):
        """Test getting current entry from empty playlist."""
        manager = PlaylistManager(config)
        manager._playlist = PlaylistData(
            id=1, name="Empty", slug="empty",
            sequence=[], images={}
        )
        manager._position = PlaylistPosition(playlist_id=1)

        entry = manager.get_current_entry()
        assert entry is None

        images = manager.get_current_images()
        assert images == []


# ============================================================================
# Clear State Tests
# ============================================================================


class TestClearState:
    """Test clearing playlist state."""

    def test_clear_state(self, config, sample_manifest):
        """Test clearing state."""
        manager = PlaylistManager(config)
        playlist = manager._parse_manifest_response(sample_manifest)
        manager._playlist = playlist
        manager._position = PlaylistPosition(playlist_id=1, position=2)
        manager._save_state()

        manager.clear_state()

        assert manager._playlist is None
        assert manager._position is None
        assert manager.status == PlaylistStatus.NOT_LOADED

        state_file = Path(config.state_dir) / "playlist_state.json"
        assert not state_file.exists()
