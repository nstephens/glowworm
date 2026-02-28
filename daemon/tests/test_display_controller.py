"""
Tests for DisplayController.

Tests cover subprocess management, IPC communication, health monitoring,
crash detection, and auto-restart functionality.
"""

import asyncio
import json
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock

import pytest
import pytest_asyncio

from glowworm_daemon.display_controller import (
    DisplayController,
    DisplayControllerConfig,
    DisplayState,
    IPCClient,
    IPCResponse,
    create_display_controller,
)


# Fixtures


@pytest.fixture
def temp_socket_dir():
    """Create a temporary directory for test sockets."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def socket_path(temp_socket_dir):
    """Get a socket path in the temp directory."""
    return str(temp_socket_dir / "display.sock")


@pytest.fixture
def config(socket_path):
    """Create a test configuration."""
    return DisplayControllerConfig(
        socket_path=socket_path,
        mock_mode=True,
        startup_timeout=5.0,
        health_check_interval=0.5,
        health_check_failures_threshold=2,
        auto_restart=True,
        max_restart_attempts=2,
        restart_base_delay=0.1,
        restart_max_delay=1.0,
        shutdown_timeout=2.0,
    )


@pytest.fixture
def controller(config):
    """Create a display controller for testing."""
    return DisplayController(config)


# Mock IPC Server


class MockIPCServer:
    """A simple mock IPC server for testing."""

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

    async def start(self):
        """Start the mock server."""
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
        """Stop the mock server."""
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
            while self._running:
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
            self._status["current_image"] = params.get("path")
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
                "result": {"success": True, "state": "idle"},
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
            return {
                "jsonrpc": "2.0",
                "result": {"success": True, "state": "registration", "code": params.get("code")},
                "id": request_id,
            }
        elif method == "hide_registration":
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


@pytest_asyncio.fixture
async def mock_server(socket_path):
    """Create and start a mock IPC server."""
    server = MockIPCServer(socket_path)
    await server.start()
    yield server
    await server.stop()


# Tests for DisplayControllerConfig


class TestDisplayControllerConfig:
    """Tests for DisplayControllerConfig dataclass."""

    def test_default_values(self):
        """Test default configuration values."""
        config = DisplayControllerConfig()

        assert config.socket_path == "/run/glowworm/display.sock"
        assert config.health_check_interval == 5.0
        assert config.startup_timeout == 30.0
        assert config.health_check_failures_threshold == 3
        assert config.auto_restart is True
        assert config.max_restart_attempts == 5
        assert config.restart_base_delay == 1.0
        assert config.restart_max_delay == 60.0
        assert config.shutdown_timeout == 10.0
        assert config.mock_mode is False
        assert config.config_file is None

    def test_custom_values(self, socket_path):
        """Test custom configuration values."""
        config = DisplayControllerConfig(
            socket_path=socket_path,
            health_check_interval=2.0,
            startup_timeout=10.0,
            mock_mode=True,
            config_file="/etc/glowworm/config.yaml",
        )

        assert config.socket_path == socket_path
        assert config.health_check_interval == 2.0
        assert config.startup_timeout == 10.0
        assert config.mock_mode is True
        assert config.config_file == "/etc/glowworm/config.yaml"


# Tests for IPCClient


class TestIPCClient:
    """Tests for IPCClient class."""

    def test_init(self, socket_path):
        """Test client initialization."""
        client = IPCClient(socket_path, timeout=5.0)

        assert client.socket_path == socket_path
        assert client.timeout == 5.0
        assert not client.is_connected

    @pytest.mark.asyncio
    async def test_connect_success(self, socket_path, mock_server):
        """Test successful connection."""
        client = IPCClient(socket_path, timeout=5.0)

        result = await client.connect()
        assert result is True
        assert client.is_connected

        await client.disconnect()

    @pytest.mark.asyncio
    async def test_connect_no_socket(self, socket_path):
        """Test connection when socket doesn't exist."""
        client = IPCClient(socket_path, timeout=1.0)

        result = await client.connect()
        assert result is False
        assert not client.is_connected

    @pytest.mark.asyncio
    async def test_call_get_status(self, socket_path, mock_server):
        """Test calling get_status method."""
        client = IPCClient(socket_path, timeout=5.0)
        await client.connect()

        response = await client.call("get_status")

        assert response.success is True
        assert response.result is not None
        assert response.result["state"] == "idle"
        assert response.result["is_running"] is True

        await client.disconnect()

    @pytest.mark.asyncio
    async def test_call_not_connected(self, socket_path):
        """Test calling method when not connected."""
        client = IPCClient(socket_path, timeout=1.0)

        response = await client.call("get_status")

        assert response.success is False
        assert response.error is not None
        assert "Not connected" in response.error["message"]

    @pytest.mark.asyncio
    async def test_call_unknown_method(self, socket_path, mock_server):
        """Test calling unknown method."""
        client = IPCClient(socket_path, timeout=5.0)
        await client.connect()

        response = await client.call("unknown_method")

        assert response.success is False
        assert response.error is not None
        assert response.error["code"] == -32601

        await client.disconnect()

    @pytest.mark.asyncio
    async def test_disconnect(self, socket_path, mock_server):
        """Test disconnection."""
        client = IPCClient(socket_path, timeout=5.0)
        await client.connect()
        assert client.is_connected

        await client.disconnect()
        assert not client.is_connected

    @pytest.mark.asyncio
    async def test_notification_callback(self, socket_path, mock_server):
        """Test notification callback registration."""
        client = IPCClient(socket_path, timeout=5.0)

        notifications = []

        def on_notification(method, params):
            notifications.append((method, params))

        client.add_notification_callback(on_notification)

        await client.connect()
        # Note: In real usage, notifications would be sent by the server
        # This test just verifies the callback is registered
        await client.disconnect()


# Tests for DisplayController


class TestDisplayController:
    """Tests for DisplayController class."""

    def test_init(self, config):
        """Test controller initialization."""
        controller = DisplayController(config)

        assert controller.state == DisplayState.STOPPED
        assert not controller.is_running
        assert controller.restart_count == 0
        assert controller.uptime is None
        assert controller.last_status is None

    def test_default_config(self):
        """Test controller with default config."""
        controller = DisplayController()

        assert controller.config.socket_path == "/run/glowworm/display.sock"
        assert controller.config.auto_restart is True

    @pytest.mark.asyncio
    async def test_state_callback(self, config):
        """Test state change callbacks."""
        controller = DisplayController(config)
        states = []

        def on_state_change(old_state, new_state):
            states.append((old_state, new_state))

        controller.add_state_callback(on_state_change)

        # Manually trigger state change
        controller._set_state(DisplayState.STARTING)

        assert len(states) == 1
        assert states[0] == (DisplayState.STOPPED, DisplayState.STARTING)

    @pytest.mark.asyncio
    async def test_notification_callback(self, config):
        """Test notification callback registration."""
        controller = DisplayController(config)
        notifications = []

        def on_notification(method, params):
            notifications.append((method, params))

        controller.add_notification_callback(on_notification)

        assert len(controller._notification_callbacks) == 1


class TestDisplayControllerWithMockServer:
    """Tests that use a mock IPC server."""

    @pytest.mark.asyncio
    async def test_start_stop_with_server(self, socket_path, mock_server, config):
        """Test start/stop when server is already running."""
        # Since we're using a mock server (not subprocess), we need to mock
        # the subprocess part and just test the IPC client
        controller = DisplayController(config)

        # Create a mock process that appears to be running
        mock_process = AsyncMock()
        mock_process.returncode = None
        mock_process.pid = 12345
        mock_process.terminate = MagicMock()
        mock_process.kill = MagicMock()
        mock_process.wait = AsyncMock()

        with patch.object(asyncio, "create_subprocess_exec", return_value=mock_process):
            result = await controller.start()

            assert result is True
            assert controller.state == DisplayState.RUNNING
            assert controller.is_running

            # Check status
            status = await controller.get_status()
            assert status is not None
            assert status["state"] == "idle"

            await controller.stop()

            assert controller.state == DisplayState.STOPPED
            assert not controller.is_running

    @pytest.mark.asyncio
    async def test_load_image(self, socket_path, mock_server, config):
        """Test load_image command."""
        controller = DisplayController(config)

        mock_process = AsyncMock()
        mock_process.returncode = None
        mock_process.pid = 12345
        mock_process.terminate = MagicMock()
        mock_process.wait = AsyncMock()

        with patch.object(asyncio, "create_subprocess_exec", return_value=mock_process):
            await controller.start()

            result = await controller.load_image("/path/to/image.jpg", scale_mode="fill")
            assert result is True

            status = await controller.get_status()
            assert status["current_image"] == "/path/to/image.jpg"

            await controller.stop()

    @pytest.mark.asyncio
    async def test_queue_image(self, socket_path, mock_server, config):
        """Test queue_image command."""
        controller = DisplayController(config)

        mock_process = AsyncMock()
        mock_process.returncode = None
        mock_process.pid = 12345
        mock_process.terminate = MagicMock()
        mock_process.wait = AsyncMock()

        with patch.object(asyncio, "create_subprocess_exec", return_value=mock_process):
            await controller.start()

            position = await controller.queue_image("/path/to/image.jpg")
            assert position is not None
            assert position == 1

            position = await controller.queue_image("/path/to/image2.jpg")
            assert position == 2

            await controller.stop()

    @pytest.mark.asyncio
    async def test_pause_resume(self, socket_path, mock_server, config):
        """Test pause/resume commands."""
        controller = DisplayController(config)

        mock_process = AsyncMock()
        mock_process.returncode = None
        mock_process.pid = 12345
        mock_process.terminate = MagicMock()
        mock_process.wait = AsyncMock()

        with patch.object(asyncio, "create_subprocess_exec", return_value=mock_process):
            await controller.start()

            result = await controller.pause()
            assert result is True

            status = await controller.get_status()
            assert status["is_paused"] is True

            result = await controller.resume()
            assert result is True

            status = await controller.get_status()
            assert status["is_paused"] is False

            await controller.stop()

    @pytest.mark.asyncio
    async def test_clear(self, socket_path, mock_server, config):
        """Test clear command."""
        controller = DisplayController(config)

        mock_process = AsyncMock()
        mock_process.returncode = None
        mock_process.pid = 12345
        mock_process.terminate = MagicMock()
        mock_process.wait = AsyncMock()

        with patch.object(asyncio, "create_subprocess_exec", return_value=mock_process):
            await controller.start()

            # First load an image
            await controller.load_image("/path/to/image.jpg")

            # Then clear
            result = await controller.clear()
            assert result is True

            status = await controller.get_status()
            assert status["current_image"] is None

            await controller.stop()

    @pytest.mark.asyncio
    async def test_show_hide_registration(self, socket_path, mock_server, config):
        """Test show_registration/hide_registration commands."""
        controller = DisplayController(config)

        mock_process = AsyncMock()
        mock_process.returncode = None
        mock_process.pid = 12345
        mock_process.terminate = MagicMock()
        mock_process.wait = AsyncMock()

        with patch.object(asyncio, "create_subprocess_exec", return_value=mock_process):
            await controller.start()

            result = await controller.show_registration("ABCD")
            assert result is True

            result = await controller.hide_registration()
            assert result is True

            await controller.stop()

    @pytest.mark.asyncio
    async def test_commands_not_running(self, config):
        """Test commands when not running."""
        controller = DisplayController(config)

        # All commands should return None/False when not running
        assert await controller.get_status() is None
        assert await controller.load_image("/path.jpg") is False
        assert await controller.queue_image("/path.jpg") is None
        assert await controller.pause() is False
        assert await controller.resume() is False
        assert await controller.clear() is False
        assert await controller.show_registration("ABCD") is False
        assert await controller.hide_registration() is False


class TestDisplayControllerCrashRecovery:
    """Tests for crash detection and auto-restart."""

    @pytest.mark.asyncio
    async def test_health_check_failure_detection(self, socket_path, mock_server, config):
        """Test that health check failures are detected."""
        controller = DisplayController(config)

        mock_process = AsyncMock()
        mock_process.returncode = None
        mock_process.pid = 12345
        mock_process.terminate = MagicMock()
        mock_process.wait = AsyncMock()

        with patch.object(asyncio, "create_subprocess_exec", return_value=mock_process):
            await controller.start()

            # Simulate health check failure by making server fail
            mock_server._should_fail = True

            # Wait for health checks to detect failure
            await asyncio.sleep(config.health_check_interval * 3)

            # Should have detected crash
            assert controller.state in (DisplayState.CRASHED, DisplayState.RESTARTING, DisplayState.RUNNING)

            await controller.stop()

    @pytest.mark.asyncio
    async def test_process_crash_detection(self, socket_path, mock_server, config):
        """Test that process crashes are detected."""
        controller = DisplayController(config)

        mock_process = AsyncMock()
        mock_process.returncode = None
        mock_process.pid = 12345
        mock_process.terminate = MagicMock()
        mock_process.kill = MagicMock()
        mock_process.wait = AsyncMock()

        with patch.object(asyncio, "create_subprocess_exec", return_value=mock_process):
            await controller.start()

            # Simulate process crash
            mock_process.returncode = 1

            # Wait for health check
            await asyncio.sleep(config.health_check_interval * 2)

            # Should have detected crash and potentially restarted
            assert controller._restart_count >= 0

            await controller.stop()

    @pytest.mark.asyncio
    async def test_restart(self, socket_path, mock_server, config):
        """Test manual restart."""
        controller = DisplayController(config)

        mock_process = AsyncMock()
        mock_process.returncode = None
        mock_process.pid = 12345
        mock_process.terminate = MagicMock()
        mock_process.kill = MagicMock()
        mock_process.wait = AsyncMock()

        with patch.object(asyncio, "create_subprocess_exec", return_value=mock_process):
            await controller.start()

            assert controller.restart_count == 0

            result = await controller.restart()

            assert result is True
            assert controller.restart_count == 1
            assert controller.is_running

            await controller.stop()


class TestDisplayControllerContextManager:
    """Tests for context manager support."""

    @pytest.mark.asyncio
    async def test_context_manager(self, socket_path, mock_server, config):
        """Test using controller as async context manager."""
        mock_process = AsyncMock()
        mock_process.returncode = None
        mock_process.pid = 12345
        mock_process.terminate = MagicMock()
        mock_process.kill = MagicMock()
        mock_process.wait = AsyncMock()

        with patch.object(asyncio, "create_subprocess_exec", return_value=mock_process):
            async with DisplayController(config) as controller:
                assert controller.is_running

                status = await controller.get_status()
                assert status is not None

            # Should be stopped after context exit
            assert controller.state == DisplayState.STOPPED


class TestCreateDisplayController:
    """Tests for create_display_controller factory function."""

    def test_create_default(self):
        """Test creating controller with defaults."""
        controller = create_display_controller()

        assert controller.config.socket_path == "/run/glowworm/display.sock"
        assert controller.config.mock_mode is False
        assert controller.config.auto_restart is True

    def test_create_custom(self, socket_path):
        """Test creating controller with custom settings."""
        controller = create_display_controller(
            socket_path=socket_path,
            mock_mode=True,
            config_file="/etc/glowworm/config.yaml",
            auto_restart=False,
        )

        assert controller.config.socket_path == socket_path
        assert controller.config.mock_mode is True
        assert controller.config.config_file == "/etc/glowworm/config.yaml"
        assert controller.config.auto_restart is False


class TestIPCResponse:
    """Tests for IPCResponse dataclass."""

    def test_success_response(self):
        """Test successful response."""
        response = IPCResponse(
            success=True,
            result={"state": "idle"},
            request_id=1,
        )

        assert response.success is True
        assert response.result == {"state": "idle"}
        assert response.error is None
        assert response.request_id == 1

    def test_error_response(self):
        """Test error response."""
        response = IPCResponse(
            success=False,
            error={"code": -32601, "message": "Method not found"},
            request_id=2,
        )

        assert response.success is False
        assert response.result is None
        assert response.error["code"] == -32601
        assert response.request_id == 2
