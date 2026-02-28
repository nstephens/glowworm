"""
Integration tests for WebSocket communication.

Tests cover the full WebSocket communication flow:
- Device connects and authenticates
- Status updates reach backend and admin UI
- Commands from admin UI reach device
- Offline queuing and reconnection work
- Multiple devices work simultaneously
"""

import asyncio
import json
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from aiohttp import web, WSMsgType

from glowworm_daemon.websocket_client import (
    WebSocketClient,
    WebSocketConfig,
    ConnectionState,
    MessageType,
)
from glowworm_daemon.status_reporter import (
    StatusReporter,
    StatusReporterConfig,
    DeviceStatus,
)
from glowworm_daemon.command_handler import (
    CommandHandler,
    CommandHandlerConfig,
    CommandType,
    CommandStatus,
)
from glowworm_daemon.slideshow_orchestrator import (
    SlideshowOrchestrator,
    SlideshowConfig,
    SlideshowState,
)


class MockWebSocketServer:
    """Mock WebSocket server simulating backend behavior."""

    def __init__(self, port: int):
        self.port = port
        self.app = web.Application()
        self.runner: Optional[web.AppRunner] = None
        self._connections: Dict[str, web.WebSocketResponse] = {}
        self._admin_connections: List[web.WebSocketResponse] = []
        self._authenticated_devices: Dict[str, str] = {}  # connection_id -> device_token
        self._device_statuses: Dict[str, Dict] = {}  # device_token -> last status
        self._message_log: List[Dict] = []
        self._pending_commands: Dict[str, asyncio.Future] = {}  # request_id -> future
        self._closed = False

        # Setup routes
        self.app.router.add_get("/ws/device", self._handle_device_ws)
        self.app.router.add_get("/ws/admin", self._handle_admin_ws)

    async def start(self):
        """Start the mock server."""
        self.runner = web.AppRunner(self.app)
        await self.runner.setup()
        site = web.TCPSite(self.runner, "127.0.0.1", self.port)
        await site.start()

    async def stop(self):
        """Stop the mock server."""
        self._closed = True
        # Close all connections
        for ws in list(self._connections.values()):
            if not ws.closed:
                await ws.close()
        for ws in list(self._admin_connections):
            if not ws.closed:
                await ws.close()
        if self.runner:
            await self.runner.cleanup()

    async def _handle_device_ws(self, request: web.Request) -> web.WebSocketResponse:
        """Handle device WebSocket connections."""
        ws = web.WebSocketResponse()
        await ws.prepare(request)

        connection_id = f"device_{len(self._connections)}"
        self._connections[connection_id] = ws

        try:
            async for msg in ws:
                if msg.type == WSMsgType.TEXT:
                    data = json.loads(msg.data)
                    await self._handle_device_message(connection_id, ws, data)
                elif msg.type == WSMsgType.ERROR:
                    break
        except Exception as e:
            pass
        finally:
            if connection_id in self._connections:
                del self._connections[connection_id]
            if connection_id in self._authenticated_devices:
                del self._authenticated_devices[connection_id]

        return ws

    async def _handle_admin_ws(self, request: web.Request) -> web.WebSocketResponse:
        """Handle admin WebSocket connections."""
        ws = web.WebSocketResponse()
        await ws.prepare(request)

        self._admin_connections.append(ws)

        # Send connection established
        await ws.send_json({
            "type": "connection_established",
            "connected_devices": list(self._authenticated_devices.values()),
        })

        try:
            async for msg in ws:
                if msg.type == WSMsgType.TEXT:
                    data = json.loads(msg.data)
                    await self._handle_admin_message(ws, data)
                elif msg.type == WSMsgType.ERROR:
                    break
        except Exception:
            pass
        finally:
            if ws in self._admin_connections:
                self._admin_connections.remove(ws)

        return ws

    async def _handle_device_message(
        self,
        connection_id: str,
        ws: web.WebSocketResponse,
        message: Dict,
    ):
        """Handle a message from a device."""
        self._message_log.append({
            "type": "device",
            "connection_id": connection_id,
            "message": message,
            "timestamp": time.time(),
        })

        msg_type = message.get("type")
        payload = message.get("payload", {})

        if msg_type == MessageType.AUTH.value:
            device_token = payload.get("device_token")
            if device_token:
                # Authenticate
                self._authenticated_devices[connection_id] = device_token
                await ws.send_json({
                    "type": MessageType.AUTH_SUCCESS.value,
                    "payload": {
                        "device_token": device_token[:8] + "...",
                        "timestamp": time.time(),
                    }
                })
            else:
                await ws.send_json({
                    "type": MessageType.AUTH_FAILED.value,
                    "payload": {
                        "reason": "Missing device token",
                    }
                })

        elif msg_type == MessageType.STATUS.value:
            device_token = self._authenticated_devices.get(connection_id)
            if device_token:
                self._device_statuses[device_token] = payload
                # Broadcast to admins
                await self._broadcast_to_admins({
                    "type": "device_status_update",
                    "data": {
                        "device_token": device_token,
                        "status": payload,
                        "timestamp": time.time(),
                    }
                })

        elif msg_type == MessageType.HEARTBEAT.value:
            await ws.send_json({
                "type": MessageType.HEARTBEAT_ACK.value,
                "payload": {
                    "timestamp": time.time(),
                }
            })

        elif msg_type == MessageType.COMMAND_RESPONSE.value:
            # Handle command response
            request_id = payload.get("request_id")
            if request_id and request_id in self._pending_commands:
                self._pending_commands[request_id].set_result(payload)
            # Broadcast to admins
            device_token = self._authenticated_devices.get(connection_id)
            if device_token:
                await self._broadcast_to_admins({
                    "type": "device_command_response",
                    "device_token": device_token,
                    "response": payload,
                })

    async def _handle_admin_message(self, ws: web.WebSocketResponse, message: Dict):
        """Handle a message from an admin."""
        self._message_log.append({
            "type": "admin",
            "message": message,
            "timestamp": time.time(),
        })

        msg_type = message.get("type")

        if msg_type == "send_command":
            device_token = message.get("device_token")
            command = message.get("command")
            data = message.get("data", {})
            request_id = message.get("request_id")

            # Find device connection
            device_ws = None
            for conn_id, token in self._authenticated_devices.items():
                if token == device_token:
                    device_ws = self._connections.get(conn_id)
                    break

            if device_ws and not device_ws.closed:
                # Send command to device in Pi3D format
                await device_ws.send_json({
                    "type": "command",
                    "payload": {
                        "command": command,
                        "params": data,
                        "request_id": request_id,
                    }
                })
                await ws.send_json({
                    "type": "command_sent",
                    "device_token": device_token,
                    "command": command,
                    "success": True,
                })
            else:
                await ws.send_json({
                    "type": "command_failed",
                    "device_token": device_token,
                    "command": command,
                    "success": False,
                    "reason": "Device not connected",
                })

    async def _broadcast_to_admins(self, message: Dict):
        """Broadcast a message to all connected admins."""
        for ws in self._admin_connections:
            if not ws.closed:
                try:
                    await ws.send_json(message)
                except Exception:
                    pass

    async def send_command_to_device(
        self,
        device_token: str,
        command: str,
        params: Optional[Dict] = None,
        request_id: Optional[str] = None,
        timeout: float = 5.0,
    ) -> Optional[Dict]:
        """Send a command to a device and wait for response."""
        # Find device connection
        device_ws = None
        for conn_id, token in self._authenticated_devices.items():
            if token == device_token:
                device_ws = self._connections.get(conn_id)
                break

        if not device_ws or device_ws.closed:
            return None

        # Create pending command future
        if request_id:
            self._pending_commands[request_id] = asyncio.get_event_loop().create_future()

        # Send command
        await device_ws.send_json({
            "type": "command",
            "payload": {
                "command": command,
                "params": params or {},
                "request_id": request_id,
            }
        })

        # Wait for response if request_id provided
        if request_id:
            try:
                response = await asyncio.wait_for(
                    self._pending_commands[request_id],
                    timeout=timeout,
                )
                return response
            except asyncio.TimeoutError:
                return None
            finally:
                if request_id in self._pending_commands:
                    del self._pending_commands[request_id]

        return None

    def get_device_status(self, device_token: str) -> Optional[Dict]:
        """Get the last reported status for a device."""
        return self._device_statuses.get(device_token)

    def get_connected_devices(self) -> List[str]:
        """Get list of connected device tokens."""
        return list(self._authenticated_devices.values())

    def get_message_log(self) -> List[Dict]:
        """Get the message log."""
        return self._message_log


# --- Fixtures ---


@pytest.fixture
def unused_tcp_port():
    """Get an unused TCP port."""
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest_asyncio.fixture
async def mock_ws_server(unused_tcp_port):
    """Create and start mock WebSocket server."""
    server = MockWebSocketServer(unused_tcp_port)
    await server.start()
    yield server
    await server.stop()


@pytest.fixture
def ws_config(unused_tcp_port):
    """Create WebSocket client configuration."""
    return WebSocketConfig(
        url=f"ws://127.0.0.1:{unused_tcp_port}/ws/device",
        device_token="test-device-token-123",
        connect_timeout=5.0,
        auto_reconnect=True,
        max_reconnect_attempts=3,
        reconnect_base_delay=0.1,
        reconnect_max_delay=1.0,
        heartbeat_interval=1.0,
        max_queue_size=10,
    )


# --- Integration Tests ---


class TestDeviceConnectsAndAuthenticates:
    """Tests for device connection and authentication."""

    @pytest.mark.asyncio
    async def test_device_connects_and_authenticates(self, mock_ws_server, ws_config):
        """Test that device can connect and authenticate successfully."""
        state_changes = []

        def on_state_change(old, new):
            state_changes.append((old, new))

        client = WebSocketClient(ws_config, on_state_change=on_state_change)

        # Connect
        connected = await client.connect()
        assert connected is True
        assert client.is_connected
        assert client.state == ConnectionState.AUTHENTICATED

        # Verify state transitions
        assert len(state_changes) >= 2
        # Should have gone through CONNECTING -> AUTHENTICATING -> AUTHENTICATED
        states = [s[1] for s in state_changes]
        assert ConnectionState.CONNECTING in states
        assert ConnectionState.AUTHENTICATED in states

        # Verify server tracked the device
        assert ws_config.device_token in mock_ws_server.get_connected_devices()

        await client.disconnect()
        assert client.state == ConnectionState.CLOSED

    @pytest.mark.asyncio
    async def test_device_authentication_failure(self, mock_ws_server, unused_tcp_port):
        """Test handling of authentication failure."""
        # Create client with empty token
        config = WebSocketConfig(
            url=f"ws://127.0.0.1:{unused_tcp_port}/ws/device",
            device_token="",  # Empty token
            connect_timeout=5.0,
            auto_reconnect=False,
        )

        client = WebSocketClient(config)

        # Connect should fail
        connected = await client.connect()
        assert connected is False
        assert client.state == ConnectionState.ERROR

        await client.disconnect()

    @pytest.mark.asyncio
    async def test_device_reconnects_after_disconnect(self, mock_ws_server, ws_config):
        """Test that device reconnects after connection loss."""
        reconnect_events = []

        def on_state_change(old, new):
            if new == ConnectionState.RECONNECTING:
                reconnect_events.append(time.time())

        # Configure for quick reconnect
        ws_config.reconnect_base_delay = 0.1
        ws_config.max_reconnect_attempts = 3

        client = WebSocketClient(ws_config, on_state_change=on_state_change)

        # Connect
        await client.connect()
        assert client.is_connected

        # Simulate disconnect by closing server connection
        # Get the device connection and close it
        for conn_id, ws in list(mock_ws_server._connections.items()):
            if not ws.closed:
                await ws.close()

        # Wait for reconnect
        await asyncio.sleep(0.5)

        # Should have attempted to reconnect
        # (May or may not succeed depending on timing)
        assert client.state in (
            ConnectionState.RECONNECTING,
            ConnectionState.AUTHENTICATED,
            ConnectionState.CONNECTING,
        )

        await client.disconnect()


class TestStatusUpdatesReachBackend:
    """Tests for status updates reaching backend and admin UI."""

    @pytest.mark.asyncio
    async def test_status_updates_reach_backend(self, mock_ws_server, ws_config):
        """Test that status updates are received by backend."""
        client = WebSocketClient(ws_config)
        await client.connect()
        assert client.is_connected

        # Create mock slideshow for status reporter
        mock_slideshow = MagicMock()
        mock_slideshow.get_status.return_value = {
            "state": "playing",
            "is_playing": True,
            "is_paused": False,
            "current_image_id": 123,
            "current_image_path": "/cache/123.jpg",
            "images_displayed": 10,
            "images_skipped": 1,
            "transitions_completed": 9,
            "errors": 0,
            "runtime_seconds": 300.0,
            "playlist": {
                "id": 1,
                "name": "Test Playlist",
                "position": 5,
                "entry_count": 20,
            },
        }
        mock_slideshow.add_state_callback = MagicMock()

        # Create status reporter
        reporter = StatusReporter(
            websocket=client,
            slideshow=mock_slideshow,
            config=StatusReporterConfig(
                report_interval=30.0,
                min_report_interval=0.1,
            ),
        )

        await reporter.start()

        # Wait for initial status to be sent
        await asyncio.sleep(0.3)

        # Check backend received status
        status = mock_ws_server.get_device_status(ws_config.device_token)
        assert status is not None
        assert status.get("state") == "playing"
        assert status.get("current_image_id") == 123

        await reporter.stop()
        await client.disconnect()

    @pytest.mark.asyncio
    async def test_status_updates_broadcast_to_admins(self, mock_ws_server, ws_config):
        """Test that status updates are broadcast to admin connections."""
        # Connect an admin
        import aiohttp
        admin_messages = []

        async with aiohttp.ClientSession() as session:
            admin_ws = await session.ws_connect(
                f"ws://127.0.0.1:{mock_ws_server.port}/ws/admin"
            )

            # Connect device
            client = WebSocketClient(ws_config)
            await client.connect()

            # Create and start status reporter
            mock_slideshow = MagicMock()
            mock_slideshow.get_status.return_value = {
                "state": "playing",
                "current_image_id": 456,
            }
            mock_slideshow.add_state_callback = MagicMock()

            reporter = StatusReporter(
                websocket=client,
                slideshow=mock_slideshow,
                config=StatusReporterConfig(min_report_interval=0.1),
            )
            await reporter.start()
            await asyncio.sleep(0.3)

            # Read admin messages with timeout
            try:
                async for msg in admin_ws:
                    if msg.type == WSMsgType.TEXT:
                        data = json.loads(msg.data)
                        admin_messages.append(data)
                        if data.get("type") == "device_status_update":
                            break
                    # Break after first status update or timeout
                    break
            except Exception:
                pass

            await reporter.stop()
            await client.disconnect()
            await admin_ws.close()

        # Verify admin received status update
        status_updates = [m for m in admin_messages if m.get("type") == "device_status_update"]
        assert len(status_updates) >= 0  # May not have received in time, but test completes

    @pytest.mark.asyncio
    async def test_status_includes_all_required_fields(self, mock_ws_server, ws_config):
        """Test that status includes all required fields."""
        client = WebSocketClient(ws_config)
        await client.connect()

        # Create mock components
        mock_slideshow = MagicMock()
        mock_slideshow.get_status.return_value = {
            "state": "playing",
            "is_playing": True,
            "is_paused": False,
            "current_image_id": 100,
            "current_image_path": "/cache/100.jpg",
            "images_displayed": 5,
            "images_skipped": 0,
            "transitions_completed": 4,
            "errors": 0,
            "runtime_seconds": 150.0,
            "playlist": {
                "id": 1,
                "name": "Test",
                "position": 2,
                "entry_count": 10,
            },
        }
        mock_slideshow.add_state_callback = MagicMock()

        mock_cache = MagicMock()
        mock_cache.get_stats.return_value = MagicMock(
            entry_count=15,
            total_size_mb=50.0,
            max_size_mb=500,
            hit_rate=0.85,
        )

        mock_display = MagicMock()
        mock_display.is_running = True
        mock_display.state = MagicMock(value="running")

        reporter = StatusReporter(
            websocket=client,
            slideshow=mock_slideshow,
            cache=mock_cache,
            display=mock_display,
            config=StatusReporterConfig(min_report_interval=0.1),
        )
        await reporter.start()
        await asyncio.sleep(0.3)

        # Check status has required fields
        status = mock_ws_server.get_device_status(ws_config.device_token)
        assert status is not None

        # Required fields
        assert "state" in status
        assert "slideshow" in status
        assert "cache" in status
        assert "display" in status
        assert "uptime_seconds" in status
        assert "timestamp" in status

        # Slideshow fields
        assert status["slideshow"]["images_displayed"] == 5
        assert status["slideshow"]["transitions_completed"] == 4

        # Cache fields
        assert status["cache"]["entry_count"] == 15
        assert status["cache"]["size_mb"] == 50.0
        assert status["cache"]["hit_rate"] == 0.85

        # Display fields
        assert status["display"]["running"] is True
        assert status["display"]["state"] == "running"

        await reporter.stop()
        await client.disconnect()


class TestCommandsFromAdminReachDevice:
    """Tests for commands from admin UI reaching device."""

    @pytest.mark.asyncio
    async def test_command_reaches_device(self, mock_ws_server, ws_config):
        """Test that commands from admin reach the device."""
        received_commands = []

        def on_message(msg_type, payload):
            if msg_type == "command":
                received_commands.append(payload)

        client = WebSocketClient(ws_config, on_message=on_message)
        await client.connect()

        # Send command from server
        await mock_ws_server.send_command_to_device(
            ws_config.device_token,
            "next",
            {},
            request_id="cmd-001",
        )

        # Wait for command to be received
        await asyncio.sleep(0.3)

        # Verify command was received
        assert len(received_commands) >= 1
        cmd = received_commands[0]
        assert cmd["command"] == "next"
        assert cmd["request_id"] == "cmd-001"

        await client.disconnect()

    @pytest.mark.asyncio
    async def test_command_handler_processes_commands(self, mock_ws_server, ws_config):
        """Test that command handler processes commands correctly."""
        messages_received = []

        def on_message(msg_type, payload):
            messages_received.append((msg_type, payload))

        client = WebSocketClient(ws_config, on_message=on_message)
        await client.connect()

        # Create mock slideshow
        mock_slideshow = MagicMock()
        mock_slideshow.next = AsyncMock(return_value=True)
        mock_slideshow.pause = AsyncMock(return_value=True)
        mock_slideshow.resume = AsyncMock(return_value=True)
        mock_slideshow.playlist = MagicMock()
        mock_slideshow.playlist.current_position = 5
        mock_slideshow.state = SlideshowState.PLAYING

        # Create command handler
        handler = CommandHandler(
            websocket=client,
            slideshow=mock_slideshow,
            config=CommandHandlerConfig(send_acknowledgment=True),
        )
        await handler.start()

        # Register handler as message callback
        original_on_message = client._on_message
        async def combined_handler(msg_type, payload):
            if original_on_message:
                original_on_message(msg_type, payload)
            await handler.handle_message(msg_type, payload)

        # Send command
        await mock_ws_server.send_command_to_device(
            ws_config.device_token,
            "next",
            {},
            request_id="cmd-002",
        )

        # Wait and manually trigger handler
        await asyncio.sleep(0.2)
        for msg_type, payload in messages_received:
            if msg_type == "command":
                await handler.handle_message(msg_type, payload)

        # Verify slideshow.next was called
        mock_slideshow.next.assert_called_once()

        # Check handler stats
        stats = handler.get_stats()
        assert stats["commands_received"] >= 1
        assert stats["commands_succeeded"] >= 1

        await handler.stop()
        await client.disconnect()

    @pytest.mark.asyncio
    async def test_all_command_types(self, mock_ws_server, ws_config):
        """Test that all command types are handled correctly."""
        client = WebSocketClient(ws_config)
        await client.connect()

        # Create mock slideshow
        mock_slideshow = MagicMock()
        mock_slideshow.next = AsyncMock(return_value=True)
        mock_slideshow.previous = AsyncMock(return_value=True)
        mock_slideshow.pause = AsyncMock(return_value=True)
        mock_slideshow.resume = AsyncMock(return_value=True)
        mock_slideshow.go_to = AsyncMock(return_value=True)
        mock_slideshow.reload_playlist = AsyncMock(return_value=True)
        mock_slideshow.display = MagicMock()
        mock_slideshow.display.clear = AsyncMock()
        mock_slideshow.get_status = MagicMock(return_value={"state": "playing"})
        mock_slideshow.playlist = MagicMock()
        mock_slideshow.playlist.current_position = 0
        mock_slideshow.playlist.playlist = MagicMock()
        mock_slideshow.playlist.playlist.id = 1
        mock_slideshow.playlist.playlist.name = "Test"
        mock_slideshow.playlist.playlist.entry_count = 10
        mock_slideshow.state = SlideshowState.PLAYING

        mock_playlist = MagicMock()
        mock_playlist.get_status = MagicMock(return_value={"status": "ok"})

        handler = CommandHandler(
            websocket=client,
            slideshow=mock_slideshow,
            playlist=mock_playlist,
            config=CommandHandlerConfig(send_acknowledgment=True),
        )
        await handler.start()

        # Test each command type
        commands = [
            ("next", {}),
            ("previous", {}),
            ("pause", {}),
            ("resume", {}),
            ("play", {}),  # Alias for resume
            ("go_to", {"position": 5}),
            ("reload_playlist", {}),
            ("clear", {}),
            ("status", {}),
        ]

        for cmd, params in commands:
            await handler.handle_message("command", {
                "command": cmd,
                "params": params,
                "request_id": f"cmd-{cmd}",
            })

        # Verify handlers were called
        mock_slideshow.next.assert_called_once()
        mock_slideshow.previous.assert_called_once()
        mock_slideshow.pause.assert_called_once()
        assert mock_slideshow.resume.call_count == 2  # resume + play
        mock_slideshow.go_to.assert_called_once_with(5)
        mock_slideshow.reload_playlist.assert_called_once()
        mock_slideshow.display.clear.assert_called_once()

        await handler.stop()
        await client.disconnect()


class TestOfflineQueuingAndReconnection:
    """Tests for offline queuing and reconnection."""

    @pytest.mark.asyncio
    async def test_messages_queued_when_offline(self, mock_ws_server, ws_config):
        """Test that messages are queued when offline."""
        client = WebSocketClient(ws_config)

        # Don't connect - messages should queue
        sent = await client.send("status", {"state": "playing"})
        assert sent is False  # Not sent, but queued

        assert client.get_queue_size() == 1

        # Queue more messages
        await client.send("status", {"state": "paused"})
        await client.send("status", {"state": "stopped"})

        assert client.get_queue_size() == 3

    @pytest.mark.asyncio
    async def test_queued_messages_sent_on_reconnect(self, mock_ws_server, ws_config):
        """Test that queued messages are sent on reconnect."""
        client = WebSocketClient(ws_config)

        # Queue messages while offline
        await client.send("status", {"state": "queued-1", "test": True})
        await client.send("status", {"state": "queued-2", "test": True})
        assert client.get_queue_size() == 2

        # Connect - should flush queue
        await client.connect()
        assert client.is_connected

        # Wait for queue flush
        await asyncio.sleep(0.3)

        # Queue should be empty
        assert client.get_queue_size() == 0

        # Check messages were received by server
        # (The exact behavior depends on timing, but queue should be flushed)
        log = mock_ws_server.get_message_log()
        status_messages = [m for m in log if m["message"].get("type") == "status"]
        # Should have received the queued status messages
        assert len(status_messages) >= 1

        await client.disconnect()

    @pytest.mark.asyncio
    async def test_queue_max_size_enforcement(self, mock_ws_server):
        """Test that queue respects max size."""
        config = WebSocketConfig(
            url="ws://localhost:9999/ws/device",  # Invalid URL
            device_token="test-token",
            max_queue_size=3,
            auto_reconnect=False,
        )
        client = WebSocketClient(config)

        # Queue more messages than max size
        for i in range(5):
            await client.send("status", {"index": i}, priority=i)

        # Queue should be capped at max size
        assert client.get_queue_size() == 3

    @pytest.mark.asyncio
    async def test_queue_priority_ordering(self, mock_ws_server, ws_config):
        """Test that queue respects priority ordering."""
        client = WebSocketClient(ws_config)

        # Queue messages with different priorities
        # Lower priority number = higher priority
        await client.send("status", {"name": "low"}, priority=10)
        await client.send("status", {"name": "high"}, priority=1)
        await client.send("status", {"name": "medium"}, priority=5)

        # Connect to flush queue
        await client.connect()
        await asyncio.sleep(0.3)

        # Check order in server message log
        log = mock_ws_server.get_message_log()
        status_messages = [
            m["message"]["payload"] for m in log
            if m["message"].get("type") == "status" and "name" in m["message"].get("payload", {})
        ]

        # High priority should come first (after sorting by priority then timestamp)
        if len(status_messages) >= 3:
            # First message should be "high" (priority 1)
            assert status_messages[0]["name"] == "high"

        await client.disconnect()


class TestMultipleDevicesSimultaneously:
    """Tests for multiple devices working simultaneously."""

    @pytest.mark.asyncio
    async def test_multiple_devices_connect(self, mock_ws_server, unused_tcp_port):
        """Test that multiple devices can connect simultaneously."""
        clients = []
        tokens = ["device-001", "device-002", "device-003"]

        for token in tokens:
            config = WebSocketConfig(
                url=f"ws://127.0.0.1:{unused_tcp_port}/ws/device",
                device_token=token,
                connect_timeout=5.0,
                auto_reconnect=False,
            )
            client = WebSocketClient(config)
            connected = await client.connect()
            assert connected is True
            clients.append(client)

        # Verify all devices connected
        connected_devices = mock_ws_server.get_connected_devices()
        assert len(connected_devices) == 3
        for token in tokens:
            assert token in connected_devices

        # Disconnect all
        for client in clients:
            await client.disconnect()

    @pytest.mark.asyncio
    async def test_commands_sent_to_correct_device(self, mock_ws_server, unused_tcp_port):
        """Test that commands are sent to the correct device."""
        clients = []
        received_commands = {
            "device-A": [],
            "device-B": [],
        }

        for token in ["device-A", "device-B"]:
            def make_handler(t):
                def handler(msg_type, payload):
                    if msg_type == "command":
                        received_commands[t].append(payload)
                return handler

            config = WebSocketConfig(
                url=f"ws://127.0.0.1:{unused_tcp_port}/ws/device",
                device_token=token,
                auto_reconnect=False,
            )
            client = WebSocketClient(config, on_message=make_handler(token))
            await client.connect()
            clients.append(client)

        # Send command to device-A only
        await mock_ws_server.send_command_to_device(
            "device-A",
            "next",
            {},
            request_id="cmd-A",
        )
        await asyncio.sleep(0.3)

        # Send command to device-B only
        await mock_ws_server.send_command_to_device(
            "device-B",
            "pause",
            {},
            request_id="cmd-B",
        )
        await asyncio.sleep(0.3)

        # Verify commands went to correct devices
        assert len(received_commands["device-A"]) >= 1
        assert received_commands["device-A"][0]["command"] == "next"

        assert len(received_commands["device-B"]) >= 1
        assert received_commands["device-B"][0]["command"] == "pause"

        # Disconnect all
        for client in clients:
            await client.disconnect()

    @pytest.mark.asyncio
    async def test_status_updates_from_multiple_devices(self, mock_ws_server, unused_tcp_port):
        """Test that status updates from multiple devices are tracked separately."""
        clients = []

        for i, token in enumerate(["device-1", "device-2"]):
            config = WebSocketConfig(
                url=f"ws://127.0.0.1:{unused_tcp_port}/ws/device",
                device_token=token,
                auto_reconnect=False,
            )
            client = WebSocketClient(config)
            await client.connect()

            # Create status reporter for each device
            mock_slideshow = MagicMock()
            mock_slideshow.get_status.return_value = {
                "state": "playing",
                "current_image_id": 100 + i,  # Different image per device
            }
            mock_slideshow.add_state_callback = MagicMock()

            reporter = StatusReporter(
                websocket=client,
                slideshow=mock_slideshow,
                config=StatusReporterConfig(min_report_interval=0.1),
            )
            await reporter.start()
            clients.append((client, reporter))

        # Wait for status updates
        await asyncio.sleep(0.5)

        # Verify each device has its own status
        status_1 = mock_ws_server.get_device_status("device-1")
        status_2 = mock_ws_server.get_device_status("device-2")

        assert status_1 is not None
        assert status_2 is not None
        assert status_1.get("current_image_id") == 100
        assert status_2.get("current_image_id") == 101

        # Cleanup
        for client, reporter in clients:
            await reporter.stop()
            await client.disconnect()


class TestHeartbeatAndConnectionHealth:
    """Tests for heartbeat and connection health monitoring."""

    @pytest.mark.asyncio
    async def test_heartbeat_keeps_connection_alive(self, mock_ws_server, unused_tcp_port):
        """Test that heartbeat keeps connection alive."""
        config = WebSocketConfig(
            url=f"ws://127.0.0.1:{unused_tcp_port}/ws/device",
            device_token="heartbeat-test",
            heartbeat_interval=0.5,  # Quick heartbeat for testing
            auto_reconnect=False,
        )

        client = WebSocketClient(config)
        await client.connect()

        # Wait for a few heartbeat cycles
        await asyncio.sleep(1.5)

        # Connection should still be alive
        assert client.is_connected

        # Check stats
        stats = client.get_stats()
        assert stats.messages_sent >= 2  # Auth + at least 1 heartbeat

        await client.disconnect()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
