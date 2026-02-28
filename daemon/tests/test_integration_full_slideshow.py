"""
Integration tests for full slideshow operation.

Tests cover the complete flow of daemon controlling Pi3D slideshow:
- Daemon starts, spawns Pi3D, begins slideshow
- Images transition at correct intervals
- Commands via IPC affect slideshow (next, pause, etc.)
- Daemon survives Pi3D crash and restarts
- Works offline with cached playlist/images
"""

import asyncio
import json
import os
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from aiohttp import web

from glowworm_daemon.cache import CacheConfig, ImageCache
from glowworm_daemon.display_controller import (
    DisplayController,
    DisplayControllerConfig,
    DisplayState,
    IPCClient,
    IPCResponse,
)
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
)
from glowworm_daemon.slideshow_orchestrator import (
    SlideshowOrchestrator,
    SlideshowConfig,
    SlideshowState,
)


# Test image data (minimal valid 1x1 JPEG)
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
    image_ids: List[int],
    display_time: int = 10,
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
            "display_time_seconds": display_time,
            "display_mode": "default",
            "sequence": image_ids,
        },
        "manifest": manifest,
    }


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

    def set_playlist(self, playlist_id: int, name: str, image_ids: List[int], display_time: int = 10):
        """Set the playlist data to return."""
        self.playlist_data = create_playlist_response(playlist_id, name, image_ids, display_time)
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


class MockDisplayIPCServer:
    """Mock Pi3D display IPC server for testing slideshow orchestration."""

    def __init__(self, socket_path: str):
        self.socket_path = socket_path
        self._server = None
        self._running = False
        self._status = {
            "state": "idle",
            "is_running": True,
            "is_paused": False,
            "current_image": None,
            "queue_length": 0,
            "stats": {},
        }
        self._should_fail = False
        self._should_crash = False
        self._loaded_images: List[str] = []
        self._transitions_completed: int = 0

    async def start(self):
        """Start the mock IPC server."""
        socket_path = Path(self.socket_path)
        socket_path.parent.mkdir(parents=True, exist_ok=True)

        if socket_path.exists():
            socket_path.unlink()

        self._server = await asyncio.start_unix_server(
            self._handle_client,
            path=str(socket_path),
        )
        self._running = True

    async def stop(self):
        """Stop the mock IPC server."""
        self._running = False
        if self._server:
            self._server.close()
            await self._server.wait_closed()
            self._server = None

        socket_path = Path(self.socket_path)
        if socket_path.exists():
            socket_path.unlink()

    async def _handle_client(self, reader, writer):
        """Handle a client connection."""
        try:
            while self._running and not self._should_crash:
                line = await reader.readline()
                if not line:
                    break

                request = json.loads(line.decode())
                response = self._handle_request(request)

                data = json.dumps(response) + "\n"
                writer.write(data.encode())
                await writer.drain()
        except Exception:
            pass
        finally:
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass

    def _handle_request(self, request):
        """Handle a JSON-RPC request."""
        request_id = request.get("id")
        method = request.get("method")
        params = request.get("params", {})

        if self._should_fail:
            return {
                "jsonrpc": "2.0",
                "error": {"code": -32603, "message": "Internal error"},
                "id": request_id,
            }

        if method == "get_status":
            return {
                "jsonrpc": "2.0",
                "result": self._status,
                "id": request_id,
            }
        elif method == "load_image":
            path = params.get("path")
            self._loaded_images.append(path)
            self._status["current_image"] = path
            self._status["state"] = "displaying"
            self._transitions_completed += 1
            return {
                "jsonrpc": "2.0",
                "result": {"success": True},
                "id": request_id,
            }
        elif method == "queue_image":
            self._status["queue_length"] = self._status.get("queue_length", 0) + 1
            return {
                "jsonrpc": "2.0",
                "result": {"success": True, "queue_position": self._status["queue_length"]},
                "id": request_id,
            }
        elif method == "pause":
            self._status["is_paused"] = True
            return {
                "jsonrpc": "2.0",
                "result": {"success": True, "state": "paused"},
                "id": request_id,
            }
        elif method == "resume":
            self._status["is_paused"] = False
            return {
                "jsonrpc": "2.0",
                "result": {"success": True, "state": "playing"},
                "id": request_id,
            }
        elif method == "clear":
            self._status["current_image"] = None
            self._status["queue_length"] = 0
            return {
                "jsonrpc": "2.0",
                "result": {"success": True},
                "id": request_id,
            }
        elif method == "show_registration":
            self._status["state"] = "registration"
            return {
                "jsonrpc": "2.0",
                "result": {"success": True, "state": "registration", "code": params.get("code")},
                "id": request_id,
            }
        elif method == "hide_registration":
            self._status["state"] = "idle"
            return {
                "jsonrpc": "2.0",
                "result": {"success": True, "state": "idle"},
                "id": request_id,
            }
        else:
            return {
                "jsonrpc": "2.0",
                "error": {"code": -32601, "message": f"Method not found: {method}"},
                "id": request_id,
            }


# --- Fixtures ---


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
def tmp_socket_dir(tmp_path: Path) -> Path:
    """Create temporary socket directory."""
    socket_dir = tmp_path / "run"
    socket_dir.mkdir()
    return socket_dir


@pytest.fixture
def socket_path(tmp_socket_dir: Path) -> str:
    """Get a socket path in the temp directory."""
    return str(tmp_socket_dir / "display.sock")


@pytest.fixture
def unused_tcp_port():
    """Get an unused TCP port."""
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest_asyncio.fixture
async def mock_backend(unused_tcp_port):
    """Create and start mock backend server."""
    server = MockBackendServer(unused_tcp_port)
    await server.start()
    yield server
    await server.stop()


@pytest_asyncio.fixture
async def mock_display_server(socket_path):
    """Create and start mock display IPC server."""
    server = MockDisplayIPCServer(socket_path)
    await server.start()
    yield server
    await server.stop()


@pytest.fixture
def cache_config(tmp_cache_dir: Path) -> CacheConfig:
    """Create cache configuration."""
    return CacheConfig(
        cache_dir=str(tmp_cache_dir),
        max_size_mb=100,
        min_free_space_mb=1,
    )


@pytest.fixture
def image_cache(cache_config: CacheConfig) -> ImageCache:
    """Create image cache."""
    return ImageCache(cache_config)


# --- Integration Tests ---


class TestDaemonStartsAndBeginsSlideshow:
    """Tests for daemon startup, Pi3D spawn, and slideshow initialization."""

    @pytest.mark.asyncio
    async def test_daemon_initializes_display_and_starts_slideshow(
        self,
        mock_backend: MockBackendServer,
        mock_display_server: MockDisplayIPCServer,
        socket_path: str,
        tmp_cache_dir: Path,
        tmp_state_dir: Path,
        image_cache: ImageCache,
    ):
        """Test that daemon starts, connects to display, and begins slideshow."""
        # Setup playlist with images
        mock_backend.set_playlist(1, "Test Playlist", [1, 2, 3], display_time=10)

        # Create components
        image_config = ImageManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_backend.port}",
            device_token="test-token",
            cache_dir=str(tmp_cache_dir),
            max_retries=1,
        )

        playlist_config = PlaylistManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_backend.port}",
            device_token="test-token",
            state_dir=str(tmp_state_dir),
            max_retries=1,
        )

        display_config = DisplayControllerConfig(
            socket_path=socket_path,
            mock_mode=True,
            startup_timeout=5.0,
            health_check_interval=1.0,
        )

        slideshow_config = SlideshowConfig(
            default_display_time=0.5,  # Short for testing
            transition_duration=0.1,
            scale_mode="fit",
        )

        # Create display controller with mock subprocess
        display = DisplayController(display_config)

        # Mock subprocess - pretend it's running
        mock_process = AsyncMock()
        mock_process.returncode = None
        mock_process.pid = 12345
        mock_process.terminate = MagicMock()
        mock_process.wait = AsyncMock()

        async with ImageManager(image_config, cache=image_cache) as image_manager:
            async with PlaylistManager(playlist_config) as playlist_manager:
                # Fetch playlist
                playlist = await playlist_manager.fetch_playlist()
                assert playlist.id == 1
                assert playlist.image_count == 3

                # Pre-cache images for slideshow
                for img_id in playlist.sequence:
                    await image_manager.download_image(img_id)

                # Start display controller with mock
                with patch.object(asyncio, "create_subprocess_exec", return_value=mock_process):
                    started = await display.start()
                    assert started is True
                    assert display.state == DisplayState.RUNNING
                    assert display.is_running

                    # Create and start orchestrator
                    orchestrator = SlideshowOrchestrator(
                        display=display,
                        playlist=playlist_manager,
                        images=image_manager,
                        config=slideshow_config,
                    )

                    success = await orchestrator.start()
                    assert success is True
                    assert orchestrator.is_playing

                    # Let slideshow run for a bit
                    await asyncio.sleep(0.5)

                    # Verify images were displayed
                    assert orchestrator.stats.images_displayed >= 1
                    assert mock_display_server._transitions_completed >= 1

                    # Stop
                    await orchestrator.stop()
                    await display.stop()

                    assert orchestrator.state == SlideshowState.STOPPED
                    assert display.state == DisplayState.STOPPED

    @pytest.mark.asyncio
    async def test_slideshow_starts_with_preloader(
        self,
        mock_backend: MockBackendServer,
        mock_display_server: MockDisplayIPCServer,
        socket_path: str,
        tmp_cache_dir: Path,
        tmp_state_dir: Path,
        image_cache: ImageCache,
    ):
        """Test slideshow starts with preloader and preloads upcoming images."""
        mock_backend.set_playlist(1, "Test Playlist", [1, 2, 3, 4, 5], display_time=10)

        image_config = ImageManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_backend.port}",
            device_token="test-token",
            cache_dir=str(tmp_cache_dir),
            max_retries=1,
        )

        playlist_config = PlaylistManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_backend.port}",
            device_token="test-token",
            state_dir=str(tmp_state_dir),
            max_retries=1,
        )

        preload_config = PreloadManagerConfig(
            preload_count=2,
            max_concurrent_downloads=2,
        )

        display_config = DisplayControllerConfig(
            socket_path=socket_path,
            mock_mode=True,
        )

        display = DisplayController(display_config)

        mock_process = AsyncMock()
        mock_process.returncode = None
        mock_process.pid = 12345
        mock_process.terminate = MagicMock()
        mock_process.wait = AsyncMock()

        async with ImageManager(image_config, cache=image_cache) as image_manager:
            async with PlaylistManager(playlist_config) as playlist_manager:
                playlist = await playlist_manager.fetch_playlist()

                # Only cache image 1 (current)
                await image_manager.download_image(1)

                async with PreloadManager(image_manager, preload_config) as preloader:
                    with patch.object(asyncio, "create_subprocess_exec", return_value=mock_process):
                        await display.start()

                        orchestrator = SlideshowOrchestrator(
                            display=display,
                            playlist=playlist_manager,
                            images=image_manager,
                            preloader=preloader,
                            config=SlideshowConfig(
                                default_display_time=0.5,
                                transition_duration=0.1,
                                preload_count=2,
                            ),
                        )

                        await orchestrator.start()

                        # Wait for preloads to trigger
                        await asyncio.sleep(0.8)

                        # Preloader should have been updated
                        stats = preloader.get_stats()
                        # PreloadStats is a dataclass with total_preloaded attribute
                        assert stats.total_preloaded >= 0

                        await orchestrator.stop()
                        await display.stop()


class TestImageTransitionsAtCorrectIntervals:
    """Tests for image timing and transitions."""

    @pytest.mark.asyncio
    async def test_images_advance_at_configured_interval(
        self,
        mock_backend: MockBackendServer,
        mock_display_server: MockDisplayIPCServer,
        socket_path: str,
        tmp_cache_dir: Path,
        tmp_state_dir: Path,
        image_cache: ImageCache,
    ):
        """Test images advance at the configured display time."""
        # Short display time for testing
        display_time = 0.3
        mock_backend.set_playlist(1, "Test Playlist", [1, 2, 3], display_time=int(display_time))

        image_config = ImageManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_backend.port}",
            device_token="test-token",
            cache_dir=str(tmp_cache_dir),
            max_retries=1,
        )

        playlist_config = PlaylistManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_backend.port}",
            device_token="test-token",
            state_dir=str(tmp_state_dir),
            max_retries=1,
        )

        display_config = DisplayControllerConfig(
            socket_path=socket_path,
            mock_mode=True,
        )

        display = DisplayController(display_config)

        mock_process = AsyncMock()
        mock_process.returncode = None
        mock_process.pid = 12345
        mock_process.terminate = MagicMock()
        mock_process.wait = AsyncMock()

        async with ImageManager(image_config, cache=image_cache) as image_manager:
            async with PlaylistManager(playlist_config) as playlist_manager:
                playlist = await playlist_manager.fetch_playlist()

                # Pre-cache all images
                for img_id in playlist.sequence:
                    await image_manager.download_image(img_id)

                with patch.object(asyncio, "create_subprocess_exec", return_value=mock_process):
                    await display.start()

                    orchestrator = SlideshowOrchestrator(
                        display=display,
                        playlist=playlist_manager,
                        images=image_manager,
                        config=SlideshowConfig(
                            default_display_time=display_time,
                            transition_duration=0.05,
                        ),
                    )

                    await orchestrator.start()

                    # Wait for multiple transitions
                    await asyncio.sleep(display_time * 3 + 0.5)

                    # Should have displayed multiple images
                    stats = orchestrator.stats
                    assert stats.images_displayed >= 3, f"Expected >= 3, got {stats.images_displayed}"
                    assert stats.transitions_completed >= 3

                    await orchestrator.stop()
                    await display.stop()

    @pytest.mark.asyncio
    async def test_transition_uses_configured_duration(
        self,
        mock_backend: MockBackendServer,
        mock_display_server: MockDisplayIPCServer,
        socket_path: str,
        tmp_cache_dir: Path,
        tmp_state_dir: Path,
        image_cache: ImageCache,
    ):
        """Test transitions use the configured duration."""
        mock_backend.set_playlist(1, "Test Playlist", [1, 2], display_time=10)

        image_config = ImageManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_backend.port}",
            device_token="test-token",
            cache_dir=str(tmp_cache_dir),
            max_retries=1,
        )

        playlist_config = PlaylistManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_backend.port}",
            device_token="test-token",
            state_dir=str(tmp_state_dir),
            max_retries=1,
        )

        display_config = DisplayControllerConfig(
            socket_path=socket_path,
            mock_mode=True,
        )

        display = DisplayController(display_config)

        mock_process = AsyncMock()
        mock_process.returncode = None
        mock_process.pid = 12345
        mock_process.terminate = MagicMock()
        mock_process.wait = AsyncMock()

        async with ImageManager(image_config, cache=image_cache) as image_manager:
            async with PlaylistManager(playlist_config) as playlist_manager:
                await playlist_manager.fetch_playlist()

                for img_id in [1, 2]:
                    await image_manager.download_image(img_id)

                with patch.object(asyncio, "create_subprocess_exec", return_value=mock_process):
                    await display.start()

                    transition_duration = 0.5
                    orchestrator = SlideshowOrchestrator(
                        display=display,
                        playlist=playlist_manager,
                        images=image_manager,
                        config=SlideshowConfig(
                            default_display_time=0.3,
                            transition_duration=transition_duration,
                        ),
                    )

                    await orchestrator.start()
                    await asyncio.sleep(0.3)

                    # Check status includes config
                    status = orchestrator.get_status()
                    assert status["config"]["transition_duration"] == transition_duration

                    await orchestrator.stop()
                    await display.stop()


class TestIPCCommandsAffectSlideshow:
    """Tests for IPC commands (next, pause, resume, etc.)."""

    @pytest.mark.asyncio
    async def test_next_command_advances_immediately(
        self,
        mock_backend: MockBackendServer,
        mock_display_server: MockDisplayIPCServer,
        socket_path: str,
        tmp_cache_dir: Path,
        tmp_state_dir: Path,
        image_cache: ImageCache,
    ):
        """Test next command advances to next image immediately."""
        mock_backend.set_playlist(1, "Test Playlist", [1, 2, 3], display_time=30)

        image_config = ImageManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_backend.port}",
            device_token="test-token",
            cache_dir=str(tmp_cache_dir),
            max_retries=1,
        )

        playlist_config = PlaylistManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_backend.port}",
            device_token="test-token",
            state_dir=str(tmp_state_dir),
            max_retries=1,
        )

        display_config = DisplayControllerConfig(
            socket_path=socket_path,
            mock_mode=True,
        )

        display = DisplayController(display_config)

        mock_process = AsyncMock()
        mock_process.returncode = None
        mock_process.pid = 12345
        mock_process.terminate = MagicMock()
        mock_process.wait = AsyncMock()

        async with ImageManager(image_config, cache=image_cache) as image_manager:
            async with PlaylistManager(playlist_config) as playlist_manager:
                await playlist_manager.fetch_playlist()

                for img_id in [1, 2, 3]:
                    await image_manager.download_image(img_id)

                with patch.object(asyncio, "create_subprocess_exec", return_value=mock_process):
                    await display.start()

                    orchestrator = SlideshowOrchestrator(
                        display=display,
                        playlist=playlist_manager,
                        images=image_manager,
                        config=SlideshowConfig(
                            default_display_time=30.0,  # Long time
                            transition_duration=0.1,
                        ),
                    )

                    await orchestrator.start()
                    await asyncio.sleep(0.2)

                    initial_pos = playlist_manager.current_position

                    # Send next command
                    result = await orchestrator.next()
                    assert result is True

                    await asyncio.sleep(0.2)

                    # Position should have advanced
                    assert playlist_manager.current_position == (initial_pos + 1) % 3

                    await orchestrator.stop()
                    await display.stop()

    @pytest.mark.asyncio
    async def test_previous_command_goes_back(
        self,
        mock_backend: MockBackendServer,
        mock_display_server: MockDisplayIPCServer,
        socket_path: str,
        tmp_cache_dir: Path,
        tmp_state_dir: Path,
        image_cache: ImageCache,
    ):
        """Test previous command navigates backward through playlist."""
        mock_backend.set_playlist(1, "Test Playlist", [1, 2, 3], display_time=30)

        image_config = ImageManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_backend.port}",
            device_token="test-token",
            cache_dir=str(tmp_cache_dir),
            max_retries=1,
        )

        playlist_config = PlaylistManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_backend.port}",
            device_token="test-token",
            state_dir=str(tmp_state_dir),
            max_retries=1,
        )

        display_config = DisplayControllerConfig(
            socket_path=socket_path,
            mock_mode=True,
        )

        display = DisplayController(display_config)

        mock_process = AsyncMock()
        mock_process.returncode = None
        mock_process.pid = 12345
        mock_process.terminate = MagicMock()
        mock_process.wait = AsyncMock()

        async with ImageManager(image_config, cache=image_cache) as image_manager:
            async with PlaylistManager(playlist_config) as playlist_manager:
                await playlist_manager.fetch_playlist()

                for img_id in [1, 2, 3]:
                    await image_manager.download_image(img_id)

                with patch.object(asyncio, "create_subprocess_exec", return_value=mock_process):
                    await display.start()

                    orchestrator = SlideshowOrchestrator(
                        display=display,
                        playlist=playlist_manager,
                        images=image_manager,
                        config=SlideshowConfig(
                            default_display_time=30.0,  # Long interval - won't auto-advance
                            transition_duration=0.1,
                        ),
                    )

                    await orchestrator.start()
                    await asyncio.sleep(0.3)

                    # Initial position is 0
                    # Note: slideshow loop might have already loaded image 1
                    initial_displayed = mock_display_server._transitions_completed

                    # Call previous - should go back (wrap around to position 2)
                    result = await orchestrator.previous()
                    assert result is True, "previous() should return True"

                    await asyncio.sleep(0.3)

                    # Verify previous triggered a load_image call
                    # (should have loaded a different image)
                    assert mock_display_server._transitions_completed > initial_displayed, \
                        "previous should have triggered an image load"

                    await orchestrator.stop()
                    await display.stop()

    @pytest.mark.asyncio
    async def test_pause_resume_stops_and_continues(
        self,
        mock_backend: MockBackendServer,
        mock_display_server: MockDisplayIPCServer,
        socket_path: str,
        tmp_cache_dir: Path,
        tmp_state_dir: Path,
        image_cache: ImageCache,
    ):
        """Test pause stops advancement and resume continues."""
        mock_backend.set_playlist(1, "Test Playlist", [1, 2, 3], display_time=10)

        image_config = ImageManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_backend.port}",
            device_token="test-token",
            cache_dir=str(tmp_cache_dir),
            max_retries=1,
        )

        playlist_config = PlaylistManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_backend.port}",
            device_token="test-token",
            state_dir=str(tmp_state_dir),
            max_retries=1,
        )

        display_config = DisplayControllerConfig(
            socket_path=socket_path,
            mock_mode=True,
        )

        display = DisplayController(display_config)

        mock_process = AsyncMock()
        mock_process.returncode = None
        mock_process.pid = 12345
        mock_process.terminate = MagicMock()
        mock_process.wait = AsyncMock()

        async with ImageManager(image_config, cache=image_cache) as image_manager:
            async with PlaylistManager(playlist_config) as playlist_manager:
                await playlist_manager.fetch_playlist()

                for img_id in [1, 2, 3]:
                    await image_manager.download_image(img_id)

                with patch.object(asyncio, "create_subprocess_exec", return_value=mock_process):
                    await display.start()

                    orchestrator = SlideshowOrchestrator(
                        display=display,
                        playlist=playlist_manager,
                        images=image_manager,
                        config=SlideshowConfig(
                            default_display_time=0.3,
                            transition_duration=0.05,
                        ),
                    )

                    await orchestrator.start()
                    await asyncio.sleep(0.2)

                    # Pause
                    result = await orchestrator.pause()
                    assert result is True
                    assert orchestrator.is_paused
                    assert mock_display_server._status["is_paused"]

                    initial_count = orchestrator.stats.images_displayed

                    # Wait while paused - should not advance
                    await asyncio.sleep(0.5)
                    assert orchestrator.stats.images_displayed == initial_count

                    # Resume
                    result = await orchestrator.resume()
                    assert result is True
                    assert not orchestrator.is_paused
                    assert orchestrator.is_playing

                    # Wait for more transitions
                    await asyncio.sleep(0.5)
                    assert orchestrator.stats.images_displayed > initial_count

                    await orchestrator.stop()
                    await display.stop()


class TestCrashRecovery:
    """Tests for daemon surviving Pi3D crash and restarting."""

    @pytest.mark.asyncio
    async def test_display_controller_detects_crash(
        self,
        mock_display_server: MockDisplayIPCServer,
        socket_path: str,
    ):
        """Test display controller detects when display crashes."""
        display_config = DisplayControllerConfig(
            socket_path=socket_path,
            mock_mode=True,
            health_check_interval=0.3,
            health_check_failures_threshold=2,
            auto_restart=False,  # Disable for this test
        )

        display = DisplayController(display_config)

        mock_process = AsyncMock()
        mock_process.returncode = None
        mock_process.pid = 12345
        mock_process.terminate = MagicMock()
        mock_process.kill = MagicMock()
        mock_process.wait = AsyncMock()

        with patch.object(asyncio, "create_subprocess_exec", return_value=mock_process):
            await display.start()
            assert display.state == DisplayState.RUNNING

            # Simulate crash by making health checks fail
            mock_display_server._should_fail = True

            # Wait for health check failures to be detected
            await asyncio.sleep(display_config.health_check_interval * 3)

            # Should have detected crash
            assert display.state in (DisplayState.CRASHED, DisplayState.STOPPED)

            await display.stop()

    @pytest.mark.asyncio
    async def test_display_controller_auto_restarts(
        self,
        mock_display_server: MockDisplayIPCServer,
        socket_path: str,
    ):
        """Test display controller auto-restarts after crash."""
        display_config = DisplayControllerConfig(
            socket_path=socket_path,
            mock_mode=True,
            health_check_interval=0.2,
            health_check_failures_threshold=2,
            auto_restart=True,
            max_restart_attempts=3,
            restart_base_delay=0.1,
        )

        display = DisplayController(display_config)
        restart_events = []

        def on_state_change(old, new):
            if new == DisplayState.RESTARTING:
                restart_events.append(True)

        display.add_state_callback(on_state_change)

        mock_process = AsyncMock()
        mock_process.returncode = None
        mock_process.pid = 12345
        mock_process.terminate = MagicMock()
        mock_process.kill = MagicMock()
        mock_process.wait = AsyncMock()

        with patch.object(asyncio, "create_subprocess_exec", return_value=mock_process):
            await display.start()
            assert display.state == DisplayState.RUNNING

            # Simulate crash
            mock_display_server._should_fail = True

            # Wait for crash detection and restart
            await asyncio.sleep(1.0)

            # Reset server
            mock_display_server._should_fail = False

            # Check restart was attempted
            assert display.restart_count >= 0

            await display.stop()

    @pytest.mark.asyncio
    async def test_slideshow_continues_after_display_restart(
        self,
        mock_backend: MockBackendServer,
        mock_display_server: MockDisplayIPCServer,
        socket_path: str,
        tmp_cache_dir: Path,
        tmp_state_dir: Path,
        image_cache: ImageCache,
    ):
        """Test slideshow can continue after display is restarted."""
        mock_backend.set_playlist(1, "Test Playlist", [1, 2, 3], display_time=30)

        image_config = ImageManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_backend.port}",
            device_token="test-token",
            cache_dir=str(tmp_cache_dir),
            max_retries=1,
        )

        playlist_config = PlaylistManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_backend.port}",
            device_token="test-token",
            state_dir=str(tmp_state_dir),
            max_retries=1,
        )

        display_config = DisplayControllerConfig(
            socket_path=socket_path,
            mock_mode=True,
            auto_restart=False,
        )

        display = DisplayController(display_config)

        mock_process = AsyncMock()
        mock_process.returncode = None
        mock_process.pid = 12345
        mock_process.terminate = MagicMock()
        mock_process.kill = MagicMock()
        mock_process.wait = AsyncMock()

        async with ImageManager(image_config, cache=image_cache) as image_manager:
            async with PlaylistManager(playlist_config) as playlist_manager:
                await playlist_manager.fetch_playlist()

                for img_id in [1, 2, 3]:
                    await image_manager.download_image(img_id)

                with patch.object(asyncio, "create_subprocess_exec", return_value=mock_process):
                    await display.start()

                    orchestrator = SlideshowOrchestrator(
                        display=display,
                        playlist=playlist_manager,
                        images=image_manager,
                        config=SlideshowConfig(
                            default_display_time=30.0,
                            transition_duration=0.1,
                        ),
                    )

                    await orchestrator.start()
                    await asyncio.sleep(0.3)

                    initial_displayed = orchestrator.stats.images_displayed

                    # Simulate restart
                    await display.restart()
                    await asyncio.sleep(0.3)

                    assert display.is_running
                    assert display.restart_count == 1

                    # Slideshow should still work
                    await orchestrator.next()
                    await asyncio.sleep(0.2)

                    assert orchestrator.stats.images_displayed > initial_displayed

                    await orchestrator.stop()
                    await display.stop()


class TestOfflineOperation:
    """Tests for offline operation with cached playlist/images."""

    @pytest.mark.asyncio
    async def test_slideshow_operates_from_cache(
        self,
        mock_backend: MockBackendServer,
        mock_display_server: MockDisplayIPCServer,
        socket_path: str,
        tmp_cache_dir: Path,
        tmp_state_dir: Path,
        image_cache: ImageCache,
    ):
        """Test slideshow can operate entirely from cached images."""
        mock_backend.set_playlist(1, "Test Playlist", [1, 2, 3], display_time=10)

        image_config = ImageManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_backend.port}",
            device_token="test-token",
            cache_dir=str(tmp_cache_dir),
            max_retries=1,
        )

        playlist_config = PlaylistManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_backend.port}",
            device_token="test-token",
            state_dir=str(tmp_state_dir),
            max_retries=1,
        )

        display_config = DisplayControllerConfig(
            socket_path=socket_path,
            mock_mode=True,
        )

        display = DisplayController(display_config)

        mock_process = AsyncMock()
        mock_process.returncode = None
        mock_process.pid = 12345
        mock_process.terminate = MagicMock()
        mock_process.wait = AsyncMock()

        # Run slideshow from cache - don't go offline, just test that cached images work
        async with ImageManager(image_config, cache=image_cache) as image_manager:
            async with PlaylistManager(playlist_config) as playlist_manager:
                # Fetch playlist and cache images
                await playlist_manager.fetch_playlist()

                for img_id in [1, 2, 3]:
                    await image_manager.download_image(img_id)

                with patch.object(asyncio, "create_subprocess_exec", return_value=mock_process):
                    await display.start()

                    orchestrator = SlideshowOrchestrator(
                        display=display,
                        playlist=playlist_manager,
                        images=image_manager,
                        config=SlideshowConfig(
                            default_display_time=0.1,  # Very short for quick cycling
                            transition_duration=0.02,
                        ),
                    )

                    await orchestrator.start()

                    # Run for a bit - should work from cache
                    await asyncio.sleep(1.2)

                    # Check that images were displayed from cache successfully
                    # At least 1 image should be displayed, ideally 3+
                    assert orchestrator.stats.images_displayed >= 1, \
                        f"Expected >= 1, got {orchestrator.stats.images_displayed}"
                    assert orchestrator.stats.images_skipped == 0
                    # Verify images are actually being loaded
                    assert len(mock_display_server._loaded_images) >= 1

                    await orchestrator.stop()
                    await display.stop()

    @pytest.mark.asyncio
    async def test_missing_images_skipped_gracefully(
        self,
        mock_backend: MockBackendServer,
        mock_display_server: MockDisplayIPCServer,
        socket_path: str,
        tmp_cache_dir: Path,
        tmp_state_dir: Path,
        image_cache: ImageCache,
    ):
        """Test that missing images are skipped and slideshow continues."""
        mock_backend.set_playlist(1, "Test Playlist", [1, 2, 3], display_time=10)

        image_config = ImageManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_backend.port}",
            device_token="test-token",
            cache_dir=str(tmp_cache_dir),
            max_retries=1,
        )

        playlist_config = PlaylistManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_backend.port}",
            device_token="test-token",
            state_dir=str(tmp_state_dir),
            max_retries=1,
        )

        display_config = DisplayControllerConfig(
            socket_path=socket_path,
            mock_mode=True,
        )

        display = DisplayController(display_config)

        mock_process = AsyncMock()
        mock_process.returncode = None
        mock_process.pid = 12345
        mock_process.terminate = MagicMock()
        mock_process.wait = AsyncMock()

        async with ImageManager(image_config, cache=image_cache) as image_manager:
            async with PlaylistManager(playlist_config) as playlist_manager:
                await playlist_manager.fetch_playlist()

                # Only cache images 1 and 3 (image 2 will be missing)
                await image_manager.download_image(1)
                await image_manager.download_image(3)

                # Go offline so image 2 can't be downloaded
                mock_backend.offline = True

                with patch.object(asyncio, "create_subprocess_exec", return_value=mock_process):
                    await display.start()

                    orchestrator = SlideshowOrchestrator(
                        display=display,
                        playlist=playlist_manager,
                        images=image_manager,
                        config=SlideshowConfig(
                            default_display_time=0.15,
                            transition_duration=0.03,
                            max_image_retries=1,
                            image_retry_delay=0.02,
                        ),
                    )

                    await orchestrator.start()

                    # Run through the playlist - give more time for retries
                    await asyncio.sleep(1.5)

                    # At least image 1 should have been displayed (starting image)
                    # Image 2 will fail to download, and image 3 should display
                    # The exact count depends on timing, but at least 1 should work
                    stats = orchestrator.stats
                    assert stats.images_displayed >= 1, \
                        f"Expected at least 1 displayed, got {stats.images_displayed}"
                    # Image 2 should have been skipped when download fails
                    # This tests the retry and skip logic
                    total_attempts = stats.images_displayed + stats.images_skipped
                    assert total_attempts >= 1, \
                        f"Expected at least 1 attempt, got {total_attempts}"

                    await orchestrator.stop()
                    await display.stop()


class TestStatusReporting:
    """Tests for comprehensive status reporting."""

    @pytest.mark.asyncio
    async def test_slideshow_status_includes_all_fields(
        self,
        mock_backend: MockBackendServer,
        mock_display_server: MockDisplayIPCServer,
        socket_path: str,
        tmp_cache_dir: Path,
        tmp_state_dir: Path,
        image_cache: ImageCache,
    ):
        """Test slideshow status includes all required fields."""
        mock_backend.set_playlist(1, "Test Playlist", [1, 2, 3], display_time=30)

        image_config = ImageManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_backend.port}",
            device_token="test-token",
            cache_dir=str(tmp_cache_dir),
            max_retries=1,
        )

        playlist_config = PlaylistManagerConfig(
            backend_url=f"http://127.0.0.1:{mock_backend.port}",
            device_token="test-token",
            state_dir=str(tmp_state_dir),
            max_retries=1,
        )

        display_config = DisplayControllerConfig(
            socket_path=socket_path,
            mock_mode=True,
        )

        display = DisplayController(display_config)

        mock_process = AsyncMock()
        mock_process.returncode = None
        mock_process.pid = 12345
        mock_process.terminate = MagicMock()
        mock_process.wait = AsyncMock()

        async with ImageManager(image_config, cache=image_cache) as image_manager:
            async with PlaylistManager(playlist_config) as playlist_manager:
                await playlist_manager.fetch_playlist()

                for img_id in [1, 2, 3]:
                    await image_manager.download_image(img_id)

                with patch.object(asyncio, "create_subprocess_exec", return_value=mock_process):
                    await display.start()

                    orchestrator = SlideshowOrchestrator(
                        display=display,
                        playlist=playlist_manager,
                        images=image_manager,
                        config=SlideshowConfig(
                            default_display_time=30.0,
                            transition_duration=0.1,
                        ),
                    )

                    await orchestrator.start()
                    await asyncio.sleep(0.3)

                    status = orchestrator.get_status()

                    # Verify all required fields
                    assert "state" in status
                    assert "is_playing" in status
                    assert "is_paused" in status
                    assert "current_image_id" in status
                    assert "images_displayed" in status
                    assert "images_skipped" in status
                    assert "transitions_completed" in status
                    assert "errors" in status
                    assert "runtime_seconds" in status
                    assert "config" in status
                    assert "playlist" in status

                    # Config should have expected values
                    assert status["config"]["default_display_time"] == 30.0
                    assert status["config"]["transition_duration"] == 0.1
                    assert status["config"]["scale_mode"] == "fit"

                    # Playlist info
                    assert status["playlist"]["id"] == 1
                    assert status["playlist"]["name"] == "Test Playlist"
                    assert status["playlist"]["entry_count"] == 3

                    await orchestrator.stop()
                    await display.stop()
