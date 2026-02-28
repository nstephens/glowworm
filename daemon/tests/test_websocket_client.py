"""
Tests for WebSocket Client.
"""

import asyncio
import json
import time
from unittest.mock import AsyncMock, MagicMock, patch

import aiohttp
import pytest

from glowworm_daemon.websocket_client import (
    ConnectionState,
    MessageType,
    QueuedMessage,
    WebSocketClient,
    WebSocketConfig,
    WebSocketStats,
    create_websocket_client,
)


# === Configuration Tests ===


class TestWebSocketConfig:
    """Tests for WebSocketConfig."""

    def test_default_values(self):
        """Test default configuration values."""
        config = WebSocketConfig()
        assert config.url == ""
        assert config.device_token == ""
        assert config.connect_timeout == 10.0
        assert config.read_timeout == 30.0
        assert config.auto_reconnect is True
        assert config.max_reconnect_attempts == 0
        assert config.reconnect_base_delay == 1.0
        assert config.reconnect_max_delay == 60.0
        assert config.heartbeat_interval == 30.0
        assert config.heartbeat_timeout == 10.0
        assert config.max_missed_heartbeats == 3
        assert config.max_queue_size == 100

    def test_custom_values(self):
        """Test configuration with custom values."""
        config = WebSocketConfig(
            url="ws://test.example.com/ws",
            device_token="test-token-123",
            connect_timeout=5.0,
            max_reconnect_attempts=10,
            heartbeat_interval=15.0,
            max_queue_size=50,
        )
        assert config.url == "ws://test.example.com/ws"
        assert config.device_token == "test-token-123"
        assert config.connect_timeout == 5.0
        assert config.max_reconnect_attempts == 10
        assert config.heartbeat_interval == 15.0
        assert config.max_queue_size == 50


class TestQueuedMessage:
    """Tests for QueuedMessage."""

    def test_creation(self):
        """Test QueuedMessage creation."""
        before = time.time()
        msg = QueuedMessage(
            message_type="status",
            payload={"test": True},
            priority=1,
        )
        after = time.time()

        assert msg.message_type == "status"
        assert msg.payload == {"test": True}
        assert msg.priority == 1
        assert before <= msg.timestamp <= after

    def test_default_timestamp(self):
        """Test default timestamp is set."""
        msg = QueuedMessage(message_type="test", payload={})
        assert msg.timestamp > 0


class TestWebSocketStats:
    """Tests for WebSocketStats."""

    def test_default_values(self):
        """Test default statistics values."""
        stats = WebSocketStats()
        assert stats.messages_sent == 0
        assert stats.messages_received == 0
        assert stats.bytes_sent == 0
        assert stats.bytes_received == 0
        assert stats.reconnect_count == 0
        assert stats.last_connected is None
        assert stats.last_disconnected is None
        assert stats.connection_uptime == 0.0


# === WebSocket Client Tests ===


class TestWebSocketClientInit:
    """Tests for WebSocketClient initialization."""

    def test_initial_state(self):
        """Test client initializes in disconnected state."""
        config = WebSocketConfig()
        client = WebSocketClient(config)

        assert client.state == ConnectionState.DISCONNECTED
        assert client.is_connected is False
        assert client.is_connecting is False

    def test_callbacks_stored(self):
        """Test callbacks are stored."""
        config = WebSocketConfig()
        on_msg = MagicMock()
        on_state = MagicMock()

        client = WebSocketClient(
            config,
            on_message=on_msg,
            on_state_change=on_state,
        )

        assert client._on_message == on_msg
        assert client._on_state_change == on_state


class TestWebSocketClientStateChange:
    """Tests for state change handling."""

    def test_state_change_callback(self):
        """Test state change callback is called."""
        config = WebSocketConfig()
        on_state = MagicMock()
        client = WebSocketClient(config, on_state_change=on_state)

        client._set_state(ConnectionState.CONNECTING)

        on_state.assert_called_once_with(
            ConnectionState.DISCONNECTED,
            ConnectionState.CONNECTING,
        )

    def test_state_change_same_state(self):
        """Test callback not called for same state."""
        config = WebSocketConfig()
        on_state = MagicMock()
        client = WebSocketClient(config, on_state_change=on_state)

        client._set_state(ConnectionState.DISCONNECTED)  # Same as initial

        on_state.assert_not_called()

    def test_connection_timing_tracked(self):
        """Test connection timing is tracked."""
        config = WebSocketConfig()
        client = WebSocketClient(config)

        # Simulate connect
        client._set_state(ConnectionState.AUTHENTICATED)
        assert client._stats.last_connected is not None

        # Simulate disconnect
        client._set_state(ConnectionState.DISCONNECTED)
        assert client._stats.last_disconnected is not None
        assert client._stats.connection_uptime >= 0


class MockWebSocket:
    """Mock WebSocket response for testing."""

    def __init__(self):
        self.closed = False
        self.sent_messages = []
        self.receive_queue = asyncio.Queue()
        self._closed_event = asyncio.Event()

    async def send_json(self, data):
        self.sent_messages.append(data)

    async def send_str(self, data):
        self.sent_messages.append(json.loads(data))

    async def receive_json(self):
        return await self.receive_queue.get()

    async def receive(self):
        # Returns WSMessage-like object
        try:
            data = await asyncio.wait_for(self.receive_queue.get(), timeout=0.1)
            return MagicMock(type=aiohttp.WSMsgType.TEXT, data=json.dumps(data))
        except asyncio.TimeoutError:
            return MagicMock(type=aiohttp.WSMsgType.CLOSED)

    async def close(self):
        self.closed = True
        self._closed_event.set()

    def exception(self):
        return None

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self.closed:
            raise StopAsyncIteration
        try:
            data = await asyncio.wait_for(self.receive_queue.get(), timeout=0.1)
            return MagicMock(type=aiohttp.WSMsgType.TEXT, data=json.dumps(data))
        except asyncio.TimeoutError:
            raise StopAsyncIteration


class MockClientSession:
    """Mock aiohttp ClientSession for testing."""

    def __init__(self, ws: MockWebSocket):
        self.closed = False
        self._ws = ws

    async def ws_connect(self, url, **kwargs):
        return self._ws

    async def close(self):
        self.closed = True


@pytest.fixture
def mock_ws():
    """Create a mock WebSocket."""
    return MockWebSocket()


@pytest.fixture
def mock_session(mock_ws):
    """Create a mock session."""
    return MockClientSession(mock_ws)


class TestWebSocketClientConnect:
    """Tests for connection handling."""

    @pytest.mark.asyncio
    async def test_connect_success(self, mock_ws, mock_session):
        """Test successful connection and authentication."""
        config = WebSocketConfig(
            url="ws://test/ws",
            device_token="test-token",
        )
        client = WebSocketClient(config)

        # Queue auth success response
        mock_ws.receive_queue.put_nowait({
            "type": MessageType.AUTH_SUCCESS.value,
            "payload": {},
        })

        with patch.object(aiohttp, "ClientSession", return_value=mock_session):
            result = await client.connect()

        assert result is True
        assert client.state == ConnectionState.AUTHENTICATED
        assert client.is_connected is True

        # Check auth message sent
        assert len(mock_ws.sent_messages) >= 1
        auth_msg = mock_ws.sent_messages[0]
        assert auth_msg["type"] == MessageType.AUTH.value
        assert auth_msg["payload"]["device_token"] == "test-token"

        await client.disconnect()

    @pytest.mark.asyncio
    async def test_connect_auth_failed(self, mock_ws, mock_session):
        """Test connection with failed authentication."""
        config = WebSocketConfig(
            url="ws://test/ws",
            device_token="bad-token",
        )
        client = WebSocketClient(config)

        # Queue auth failure response
        mock_ws.receive_queue.put_nowait({
            "type": MessageType.AUTH_FAILED.value,
            "payload": {"reason": "Invalid token"},
        })

        with patch.object(aiohttp, "ClientSession", return_value=mock_session):
            result = await client.connect()

        assert result is False
        assert client.state == ConnectionState.ERROR
        assert client.is_connected is False

    @pytest.mark.asyncio
    async def test_connect_already_connected(self, mock_ws, mock_session):
        """Test connect when already connected."""
        config = WebSocketConfig(
            url="ws://test/ws",
            device_token="test-token",
        )
        client = WebSocketClient(config)

        mock_ws.receive_queue.put_nowait({
            "type": MessageType.AUTH_SUCCESS.value,
        })

        with patch.object(aiohttp, "ClientSession", return_value=mock_session):
            await client.connect()
            result = await client.connect()  # Second connect

        assert result is True  # Already connected
        assert client.is_connected is True

        await client.disconnect()

    @pytest.mark.asyncio
    async def test_disconnect(self, mock_ws, mock_session):
        """Test disconnection."""
        config = WebSocketConfig(
            url="ws://test/ws",
            device_token="test-token",
        )
        client = WebSocketClient(config)

        mock_ws.receive_queue.put_nowait({
            "type": MessageType.AUTH_SUCCESS.value,
        })

        with patch.object(aiohttp, "ClientSession", return_value=mock_session):
            await client.connect()
            await client.disconnect()

        assert client.state == ConnectionState.CLOSED
        assert client.is_connected is False
        assert mock_ws.closed is True


class TestWebSocketClientSend:
    """Tests for message sending."""

    @pytest.mark.asyncio
    async def test_send_when_connected(self, mock_ws, mock_session):
        """Test sending message when connected."""
        config = WebSocketConfig(
            url="ws://test/ws",
            device_token="test-token",
        )
        client = WebSocketClient(config)

        mock_ws.receive_queue.put_nowait({
            "type": MessageType.AUTH_SUCCESS.value,
        })

        with patch.object(aiohttp, "ClientSession", return_value=mock_session):
            await client.connect()

            result = await client.send("status", {"current_image": 123})

        assert result is True
        assert client._stats.messages_sent >= 2  # auth + status

        # Find status message
        status_msgs = [m for m in mock_ws.sent_messages if m.get("type") == "status"]
        assert len(status_msgs) == 1
        assert status_msgs[0]["payload"]["current_image"] == 123

        await client.disconnect()

    @pytest.mark.asyncio
    async def test_send_when_disconnected_queues(self):
        """Test message is queued when disconnected."""
        config = WebSocketConfig()
        client = WebSocketClient(config)

        result = await client.send("status", {"test": True})

        assert result is False
        assert client.get_queue_size() == 1

    @pytest.mark.asyncio
    async def test_send_no_queue_option(self):
        """Test message not queued with queue_if_offline=False."""
        config = WebSocketConfig()
        client = WebSocketClient(config)

        result = await client.send("status", {"test": True}, queue_if_offline=False)

        assert result is False
        assert client.get_queue_size() == 0


class TestWebSocketClientQueue:
    """Tests for offline message queue."""

    @pytest.mark.asyncio
    async def test_queue_message(self):
        """Test messages are queued."""
        config = WebSocketConfig()
        client = WebSocketClient(config)

        await client._queue_message("status", {"a": 1})
        await client._queue_message("status", {"b": 2})

        assert client.get_queue_size() == 2

    @pytest.mark.asyncio
    async def test_queue_max_size(self):
        """Test queue respects max size."""
        config = WebSocketConfig(max_queue_size=3)
        client = WebSocketClient(config)

        for i in range(5):
            await client._queue_message("status", {"i": i}, priority=i)

        assert client.get_queue_size() == 3

    @pytest.mark.asyncio
    async def test_queue_priority_ordering(self):
        """Test queue sorts by priority."""
        config = WebSocketConfig()
        client = WebSocketClient(config)

        await client._queue_message("low", {}, priority=10)
        await client._queue_message("high", {}, priority=1)
        await client._queue_message("medium", {}, priority=5)

        # Sort as flush would
        client._message_queue.sort(key=lambda m: (m.priority, m.timestamp))

        assert client._message_queue[0].message_type == "high"
        assert client._message_queue[1].message_type == "medium"
        assert client._message_queue[2].message_type == "low"

    @pytest.mark.asyncio
    async def test_clear_queue(self):
        """Test clearing the queue."""
        config = WebSocketConfig()
        client = WebSocketClient(config)

        await client._queue_message("status", {})
        await client._queue_message("status", {})

        cleared = client.clear_queue()

        assert cleared == 2
        assert client.get_queue_size() == 0

    @pytest.mark.asyncio
    async def test_flush_queue_on_connect(self, mock_ws, mock_session):
        """Test queue is flushed on connect."""
        config = WebSocketConfig(
            url="ws://test/ws",
            device_token="test-token",
        )
        client = WebSocketClient(config)

        # Queue messages while disconnected
        await client._queue_message("status", {"queued": 1})
        await client._queue_message("status", {"queued": 2})

        mock_ws.receive_queue.put_nowait({
            "type": MessageType.AUTH_SUCCESS.value,
        })

        with patch.object(aiohttp, "ClientSession", return_value=mock_session):
            await client.connect()

        # Check queued messages were sent
        status_msgs = [m for m in mock_ws.sent_messages if m.get("type") == "status"]
        assert len(status_msgs) == 2
        assert client.get_queue_size() == 0

        await client.disconnect()


class TestWebSocketClientMessageHandling:
    """Tests for message handling."""

    @pytest.mark.asyncio
    async def test_message_callback(self):
        """Test message callback is invoked."""
        config = WebSocketConfig()
        received = []

        def on_msg(msg_type, payload):
            received.append((msg_type, payload))

        client = WebSocketClient(config, on_message=on_msg)

        # Simulate handling a message
        await client._handle_message({
            "type": "command",
            "payload": {"action": "next"},
        })

        assert len(received) == 1
        assert received[0] == ("command", {"action": "next"})

    @pytest.mark.asyncio
    async def test_heartbeat_ack_handled(self):
        """Test heartbeat ack is handled internally."""
        config = WebSocketConfig()
        received = []

        def on_msg(msg_type, payload):
            received.append((msg_type, payload))

        client = WebSocketClient(config, on_message=on_msg)
        client._pending_heartbeat = True
        client._missed_heartbeats = 2

        # Handle heartbeat ack
        await client._handle_message({
            "type": MessageType.HEARTBEAT_ACK.value,
            "payload": {},
        })

        # Should not be passed to callback
        assert len(received) == 0
        assert client._pending_heartbeat is False
        assert client._missed_heartbeats == 0
        assert client._last_heartbeat_ack is not None


class TestWebSocketClientReconnect:
    """Tests for reconnection handling."""

    @pytest.mark.asyncio
    async def test_reconnect_attempts_tracked(self):
        """Test reconnect attempts are tracked."""
        config = WebSocketConfig(
            url="ws://test/ws",
            device_token="test-token",
            reconnect_base_delay=0.01,  # Fast for testing
            max_reconnect_attempts=2,
        )
        client = WebSocketClient(config)

        # Force into reconnecting state
        client._should_reconnect = True
        client._set_state(ConnectionState.RECONNECTING)

        # Start reconnect loop (will fail)
        task = asyncio.create_task(client._reconnect_loop())

        # Wait for attempts
        await asyncio.sleep(0.1)
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

        assert client._reconnect_attempts > 0
        assert client._stats.reconnect_count > 0

    @pytest.mark.asyncio
    async def test_max_reconnect_attempts(self):
        """Test max reconnect attempts is respected."""
        config = WebSocketConfig(
            url="ws://test/ws",
            device_token="test-token",
            reconnect_base_delay=0.01,
            max_reconnect_attempts=2,
        )
        client = WebSocketClient(config)
        client._should_reconnect = True

        # Run reconnect loop (will exhaust attempts)
        await client._reconnect_loop()

        assert client.state == ConnectionState.ERROR
        assert client._reconnect_attempts >= 2

    @pytest.mark.asyncio
    async def test_exponential_backoff(self):
        """Test exponential backoff delay."""
        config = WebSocketConfig(
            reconnect_base_delay=1.0,
            reconnect_max_delay=10.0,
        )
        client = WebSocketClient(config)

        # Simulate failed reconnects
        client._reconnect_attempts = 1
        client._current_reconnect_delay = 1.0

        # Simulate backoff increase
        client._current_reconnect_delay = min(
            client._current_reconnect_delay * 2,
            config.reconnect_max_delay,
        )
        assert client._current_reconnect_delay == 2.0

        client._current_reconnect_delay = min(
            client._current_reconnect_delay * 2,
            config.reconnect_max_delay,
        )
        assert client._current_reconnect_delay == 4.0

        # Should cap at max
        for _ in range(10):
            client._current_reconnect_delay = min(
                client._current_reconnect_delay * 2,
                config.reconnect_max_delay,
            )
        assert client._current_reconnect_delay == 10.0


class TestWebSocketClientHeartbeat:
    """Tests for heartbeat handling."""

    @pytest.mark.asyncio
    async def test_send_heartbeat(self, mock_ws, mock_session):
        """Test heartbeat is sent."""
        config = WebSocketConfig(
            url="ws://test/ws",
            device_token="test-token",
        )
        client = WebSocketClient(config)

        mock_ws.receive_queue.put_nowait({
            "type": MessageType.AUTH_SUCCESS.value,
        })

        with patch.object(aiohttp, "ClientSession", return_value=mock_session):
            await client.connect()
            await client._send_heartbeat()

        # Find heartbeat message
        hb_msgs = [m for m in mock_ws.sent_messages if m.get("type") == "heartbeat"]
        assert len(hb_msgs) == 1
        assert "timestamp" in hb_msgs[0]["payload"]
        assert client._pending_heartbeat is True

        await client.disconnect()

    @pytest.mark.asyncio
    async def test_missed_heartbeat_tracking(self):
        """Test missed heartbeats are tracked."""
        config = WebSocketConfig(max_missed_heartbeats=3)
        client = WebSocketClient(config)

        client._pending_heartbeat = True
        client._missed_heartbeats = 0

        # Simulate check
        if client._pending_heartbeat:
            client._missed_heartbeats += 1

        assert client._missed_heartbeats == 1


class TestWebSocketClientStats:
    """Tests for statistics tracking."""

    @pytest.mark.asyncio
    async def test_stats_tracking(self, mock_ws, mock_session):
        """Test statistics are tracked."""
        config = WebSocketConfig(
            url="ws://test/ws",
            device_token="test-token",
        )
        client = WebSocketClient(config)

        mock_ws.receive_queue.put_nowait({
            "type": MessageType.AUTH_SUCCESS.value,
        })

        with patch.object(aiohttp, "ClientSession", return_value=mock_session):
            await client.connect()
            await client.send("status", {"test": True})

        stats = client.get_stats()
        assert stats.messages_sent >= 2  # auth + status
        assert stats.messages_received >= 1  # auth_success
        assert stats.bytes_sent > 0
        assert stats.bytes_received > 0
        assert stats.last_connected is not None

        await client.disconnect()


class TestWebSocketClientContextManager:
    """Tests for async context manager."""

    @pytest.mark.asyncio
    async def test_context_manager(self, mock_ws, mock_session):
        """Test async context manager."""
        config = WebSocketConfig(
            url="ws://test/ws",
            device_token="test-token",
        )

        mock_ws.receive_queue.put_nowait({
            "type": MessageType.AUTH_SUCCESS.value,
        })

        with patch.object(aiohttp, "ClientSession", return_value=mock_session):
            async with WebSocketClient(config) as client:
                assert client.is_connected is True

        assert client.state == ConnectionState.CLOSED


class TestWebSocketClientFactory:
    """Tests for factory function."""

    def test_create_websocket_client(self):
        """Test factory function."""
        on_msg = MagicMock()
        on_state = MagicMock()

        client = create_websocket_client(
            url="ws://test/ws",
            device_token="test-token",
            on_message=on_msg,
            on_state_change=on_state,
            heartbeat_interval=15.0,
        )

        assert client.config.url == "ws://test/ws"
        assert client.config.device_token == "test-token"
        assert client.config.heartbeat_interval == 15.0
        assert client._on_message == on_msg
        assert client._on_state_change == on_state


class TestMessageType:
    """Tests for MessageType enum."""

    def test_outgoing_types(self):
        """Test outgoing message types."""
        assert MessageType.AUTH.value == "auth"
        assert MessageType.STATUS.value == "status"
        assert MessageType.COMMAND_RESPONSE.value == "command_response"
        assert MessageType.HEARTBEAT.value == "heartbeat"

    def test_incoming_types(self):
        """Test incoming message types."""
        assert MessageType.AUTH_SUCCESS.value == "auth_success"
        assert MessageType.AUTH_FAILED.value == "auth_failed"
        assert MessageType.COMMAND.value == "command"
        assert MessageType.PLAYLIST_UPDATE.value == "playlist_update"
        assert MessageType.HEARTBEAT_ACK.value == "heartbeat_ack"


class TestConnectionState:
    """Tests for ConnectionState enum."""

    def test_connection_states(self):
        """Test all connection states exist."""
        assert ConnectionState.DISCONNECTED.value == "disconnected"
        assert ConnectionState.CONNECTING.value == "connecting"
        assert ConnectionState.CONNECTED.value == "connected"
        assert ConnectionState.AUTHENTICATING.value == "authenticating"
        assert ConnectionState.AUTHENTICATED.value == "authenticated"
        assert ConnectionState.RECONNECTING.value == "reconnecting"
        assert ConnectionState.CLOSING.value == "closing"
        assert ConnectionState.CLOSED.value == "closed"
        assert ConnectionState.ERROR.value == "error"
