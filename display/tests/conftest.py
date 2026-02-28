"""
Pytest fixtures and test harness for GlowWorm Display Engine.

Provides fixtures for testing with mocked Pi3D on development machines,
as well as test images and IPC server setup.
"""

import asyncio
import os
import shutil
import tempfile
from pathlib import Path
from typing import AsyncGenerator, Generator

import pytest

from glowworm_display.config import DisplayConfig, Orientation, Rotation
from glowworm_display.display import Display
from glowworm_display.image_loader import ImageLoader
from glowworm_display.ipc_server import IPCServer, IPCServerConfig
from glowworm_display.renderer import Renderer


# Test image directory
TEST_IMAGES_DIR = Path(__file__).parent / "test_images"


def create_test_image(
    path: Path,
    width: int = 800,
    height: int = 600,
    color: tuple[int, int, int] = (255, 0, 0),
) -> Path:
    """
    Create a test image with a solid color.

    Args:
        path: Path to save the image
        width: Image width in pixels
        height: Image height in pixels
        color: RGB color tuple

    Returns:
        Path to the created image
    """
    from PIL import Image

    img = Image.new("RGB", (width, height), color)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path)
    return path


@pytest.fixture
def temp_dir() -> Generator[Path, None, None]:
    """Create a temporary directory for test files."""
    temp_path = Path(tempfile.mkdtemp())
    yield temp_path
    shutil.rmtree(temp_path, ignore_errors=True)


@pytest.fixture
def test_images(temp_dir: Path) -> dict[str, Path]:
    """
    Create test images for testing.

    Returns a dict with paths to:
    - red: 800x600 red image (landscape)
    - green: 800x600 green image (landscape)
    - blue: 800x600 blue image (landscape)
    - portrait: 600x800 portrait image
    """
    images_dir = temp_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)

    return {
        "red": create_test_image(images_dir / "red.jpg", 800, 600, (255, 0, 0)),
        "green": create_test_image(images_dir / "green.jpg", 800, 600, (0, 255, 0)),
        "blue": create_test_image(images_dir / "blue.jpg", 800, 600, (0, 0, 255)),
        "portrait": create_test_image(images_dir / "portrait.jpg", 600, 800, (128, 128, 128)),
    }


@pytest.fixture
def display_config() -> DisplayConfig:
    """Create a default display configuration for testing."""
    return DisplayConfig(
        width=1920,
        height=1080,
        fps_target=60,
        orientation=Orientation.LANDSCAPE,
        rotation=Rotation.DEG_0,
        background_color="#000000",
    )


@pytest.fixture
def mock_display(display_config: DisplayConfig) -> Generator[Display, None, None]:
    """
    Create a mock display instance for testing.

    This uses the mock mode which doesn't require actual Pi3D.
    """
    display = Display(config=display_config, mock=True)
    display.initialize()
    yield display
    display.cleanup()


@pytest.fixture
def mock_image_loader(mock_display: Display) -> ImageLoader:
    """Create a mock image loader for testing."""
    return ImageLoader(
        display_width=mock_display.width,
        display_height=mock_display.height,
        rotation=Rotation.DEG_0,
        mock=True,
    )


@pytest.fixture
def mock_renderer(
    mock_display: Display,
    mock_image_loader: ImageLoader,
) -> Generator[Renderer, None, None]:
    """
    Create a mock renderer for testing.

    Includes display, image loader, and renderer with mock mode enabled.
    """
    renderer = Renderer(
        display=mock_display,
        image_loader=mock_image_loader,
        default_transition_duration=0.1,  # Fast transitions for testing
        mock=True,
    )
    yield renderer


@pytest.fixture
def ipc_socket_path(temp_dir: Path) -> str:
    """Generate a unique socket path for testing."""
    return str(temp_dir / "test_display.sock")


@pytest.fixture
async def ipc_server(
    ipc_socket_path: str,
    mock_renderer: Renderer,
) -> AsyncGenerator[IPCServer, None]:
    """
    Create and start an IPC server for testing.

    The server is started and will be stopped after the test.
    """
    config = IPCServerConfig(socket_path=ipc_socket_path)
    server = IPCServer(config=config, renderer=mock_renderer)
    await server.start()
    yield server
    await server.stop()


class IPCTestClient:
    """
    Simple test client for IPC server communication.

    Used in integration tests to send commands and receive responses.
    """

    def __init__(self, socket_path: str):
        """
        Initialize the test client.

        Args:
            socket_path: Path to the Unix socket
        """
        self.socket_path = socket_path
        self._reader: asyncio.StreamReader | None = None
        self._writer: asyncio.StreamWriter | None = None
        self._request_id = 0

    async def connect(self) -> None:
        """Connect to the IPC server."""
        self._reader, self._writer = await asyncio.open_unix_connection(self.socket_path)

    async def close(self) -> None:
        """Close the connection."""
        if self._writer:
            self._writer.close()
            await self._writer.wait_closed()

    async def send_request(
        self,
        method: str,
        params: dict | None = None,
    ) -> dict:
        """
        Send a JSON-RPC request and wait for response.

        Handles interleaved notifications by discarding them and
        waiting for the actual response.

        Args:
            method: The method name to call
            params: Optional parameters

        Returns:
            The JSON-RPC response dict
        """
        import json

        if not self._writer or not self._reader:
            raise RuntimeError("Not connected")

        self._request_id += 1
        request = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params or {},
            "id": self._request_id,
        }

        # Send request
        data = json.dumps(request) + "\n"
        self._writer.write(data.encode("utf-8"))
        await self._writer.drain()

        # Read response, skipping any notifications (messages without 'id')
        while True:
            line = await asyncio.wait_for(self._reader.readline(), timeout=5.0)
            response = json.loads(line.decode("utf-8"))

            # Check if this is a notification (no 'id' field) or our response
            if "id" in response:
                return response
            # Otherwise it's a notification, discard and read next

    async def __aenter__(self) -> "IPCTestClient":
        """Async context manager entry."""
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Async context manager exit."""
        await self.close()


@pytest.fixture
def ipc_client(ipc_socket_path: str) -> IPCTestClient:
    """Create an IPC test client."""
    return IPCTestClient(ipc_socket_path)
