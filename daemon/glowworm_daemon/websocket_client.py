"""
WebSocket Client for GlowWorm v3.0.

Provides persistent WebSocket connection from daemon to backend with:
- Authentication using device token
- Auto-reconnect with exponential backoff
- Heartbeat/ping-pong handling
- Message receive handler
- Message send with offline queue
- Connection state tracking
"""

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Optional

import aiohttp

logger = logging.getLogger(__name__)


class ConnectionState(str, Enum):
    """WebSocket connection states."""
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    AUTHENTICATING = "authenticating"
    AUTHENTICATED = "authenticated"
    RECONNECTING = "reconnecting"
    CLOSING = "closing"
    CLOSED = "closed"
    ERROR = "error"


class MessageType(str, Enum):
    """WebSocket message types."""
    # Outgoing
    AUTH = "auth"
    STATUS = "status"
    COMMAND_RESPONSE = "command_response"
    HEARTBEAT = "heartbeat"

    # Incoming
    AUTH_SUCCESS = "auth_success"
    AUTH_FAILED = "auth_failed"
    COMMAND = "command"
    PLAYLIST_UPDATE = "playlist_update"
    CONFIG_UPDATE = "config_update"
    HEARTBEAT_ACK = "heartbeat_ack"


@dataclass
class WebSocketConfig:
    """Configuration for WebSocket client."""
    url: str = ""  # WebSocket URL (ws:// or wss://)
    device_token: str = ""  # Device authentication token

    # Connection settings
    connect_timeout: float = 10.0  # Timeout for connection
    read_timeout: float = 30.0  # Timeout for message reads

    # Reconnect settings
    auto_reconnect: bool = True
    max_reconnect_attempts: int = 0  # 0 = unlimited
    reconnect_base_delay: float = 1.0  # Initial delay
    reconnect_max_delay: float = 60.0  # Maximum delay

    # Heartbeat settings
    heartbeat_interval: float = 30.0  # Seconds between heartbeats
    heartbeat_timeout: float = 10.0  # Timeout waiting for heartbeat ack
    max_missed_heartbeats: int = 3  # Disconnect after this many missed

    # Offline queue settings
    max_queue_size: int = 100  # Maximum messages to queue when offline


@dataclass
class QueuedMessage:
    """A message queued for sending when reconnected."""
    message_type: str
    payload: dict
    timestamp: float = field(default_factory=time.time)
    priority: int = 0  # Lower = higher priority


@dataclass
class WebSocketStats:
    """Statistics for WebSocket connection."""
    messages_sent: int = 0
    messages_received: int = 0
    bytes_sent: int = 0
    bytes_received: int = 0
    reconnect_count: int = 0
    last_connected: Optional[float] = None
    last_disconnected: Optional[float] = None
    last_message_sent: Optional[float] = None
    last_message_received: Optional[float] = None
    connection_uptime: float = 0.0  # Total time connected


# Type aliases for callbacks
MessageHandler = Callable[[str, dict], None]
StateChangeHandler = Callable[[ConnectionState, ConnectionState], None]


class WebSocketClient:
    """
    Persistent WebSocket client for backend communication.

    Handles:
    - Connection with authentication
    - Auto-reconnect with exponential backoff
    - Heartbeat/ping-pong
    - Message queuing when offline
    - State tracking and callbacks
    """

    def __init__(
        self,
        config: WebSocketConfig,
        on_message: Optional[MessageHandler] = None,
        on_state_change: Optional[StateChangeHandler] = None,
    ):
        """
        Initialize WebSocket client.

        Args:
            config: WebSocket configuration
            on_message: Callback for received messages (message_type, payload)
            on_state_change: Callback for state changes (old_state, new_state)
        """
        self.config = config
        self._on_message = on_message
        self._on_state_change = on_state_change

        # State
        self._state = ConnectionState.DISCONNECTED
        self._session: Optional[aiohttp.ClientSession] = None
        self._ws: Optional[aiohttp.ClientWebSocketResponse] = None

        # Tasks
        self._receive_task: Optional[asyncio.Task] = None
        self._heartbeat_task: Optional[asyncio.Task] = None
        self._reconnect_task: Optional[asyncio.Task] = None

        # Reconnection state
        self._reconnect_attempts = 0
        self._current_reconnect_delay = config.reconnect_base_delay
        self._should_reconnect = True

        # Heartbeat state
        self._missed_heartbeats = 0
        self._last_heartbeat_sent: Optional[float] = None
        self._last_heartbeat_ack: Optional[float] = None
        self._pending_heartbeat = False

        # Offline queue
        self._message_queue: list[QueuedMessage] = []
        self._queue_lock = asyncio.Lock()

        # Statistics
        self._stats = WebSocketStats()
        self._connection_start_time: Optional[float] = None

    @property
    def state(self) -> ConnectionState:
        """Current connection state."""
        return self._state

    @property
    def is_connected(self) -> bool:
        """Whether currently connected and authenticated."""
        return self._state == ConnectionState.AUTHENTICATED

    @property
    def is_connecting(self) -> bool:
        """Whether currently attempting to connect."""
        return self._state in (
            ConnectionState.CONNECTING,
            ConnectionState.AUTHENTICATING,
            ConnectionState.RECONNECTING,
        )

    def get_stats(self) -> WebSocketStats:
        """Get connection statistics."""
        # Update connection uptime if currently connected
        if self._connection_start_time and self.is_connected:
            self._stats.connection_uptime += time.time() - self._connection_start_time
            self._connection_start_time = time.time()
        return self._stats

    def _set_state(self, new_state: ConnectionState) -> None:
        """Update state and notify callback."""
        if new_state != self._state:
            old_state = self._state
            self._state = new_state

            # Track connection timing
            if new_state == ConnectionState.AUTHENTICATED:
                self._stats.last_connected = time.time()
                self._connection_start_time = time.time()
            elif old_state == ConnectionState.AUTHENTICATED:
                self._stats.last_disconnected = time.time()
                if self._connection_start_time:
                    self._stats.connection_uptime += time.time() - self._connection_start_time
                    self._connection_start_time = None

            logger.debug(f"State change: {old_state.value} -> {new_state.value}")

            if self._on_state_change:
                try:
                    self._on_state_change(old_state, new_state)
                except Exception as e:
                    logger.error(f"Error in state change callback: {e}")

    async def connect(self) -> bool:
        """
        Connect to the WebSocket server.

        Returns:
            True if connected and authenticated, False otherwise
        """
        if self.is_connected or self.is_connecting:
            logger.warning(f"Already connected/connecting (state={self._state.value})")
            return self.is_connected

        self._should_reconnect = True
        self._set_state(ConnectionState.CONNECTING)

        try:
            # Create session if needed
            if self._session is None or self._session.closed:
                timeout = aiohttp.ClientTimeout(
                    total=self.config.connect_timeout,
                    sock_connect=self.config.connect_timeout,
                )
                self._session = aiohttp.ClientSession(timeout=timeout)

            # Connect to WebSocket with device token in cookie header
            logger.info(f"Connecting to {self.config.url}")
            headers = {"Cookie": f"glowworm_display={self.config.device_token}"}
            self._ws = await self._session.ws_connect(
                self.config.url,
                heartbeat=None,  # We handle heartbeat ourselves
                receive_timeout=self.config.read_timeout,
                headers=headers,
            )

            # Authenticate
            self._set_state(ConnectionState.AUTHENTICATING)
            auth_success = await self._authenticate()

            if not auth_success:
                await self._close_connection()
                self._set_state(ConnectionState.ERROR)
                return False

            # Reset reconnection state on successful connect
            self._reconnect_attempts = 0
            self._current_reconnect_delay = self.config.reconnect_base_delay

            # Start background tasks
            self._receive_task = asyncio.create_task(self._receive_loop())
            self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())

            self._set_state(ConnectionState.AUTHENTICATED)

            # Flush offline queue
            await self._flush_queue()

            return True

        except aiohttp.ClientError as e:
            logger.error(f"Connection error: {e}")
            await self._close_connection()
            self._set_state(ConnectionState.ERROR)
            return False
        except asyncio.TimeoutError:
            logger.error("Connection timeout")
            await self._close_connection()
            self._set_state(ConnectionState.ERROR)
            return False
        except Exception as e:
            logger.error(f"Unexpected connection error: {e}")
            await self._close_connection()
            self._set_state(ConnectionState.ERROR)
            return False

    async def _authenticate(self) -> bool:
        """
        Wait for authentication confirmation from server.

        The device token is sent via cookie header during connection.
        Server sends 'connection_established' on success or closes on failure.

        Returns:
            True if authentication succeeded
        """
        if not self._ws:
            return False

        try:
            # Wait for server's connection_established message
            # The device token was already sent via cookie
            response = await asyncio.wait_for(
                self._ws.receive_json(),
                timeout=self.config.connect_timeout,
            )

            self._stats.messages_received += 1
            self._stats.bytes_received += len(json.dumps(response))

            msg_type = response.get("type", "")
            if msg_type == "connection_established":
                logger.info("Authentication successful (connection established)")
                return True
            elif msg_type == MessageType.AUTH_SUCCESS.value:
                logger.info("Authentication successful")
                return True
            elif msg_type == MessageType.AUTH_FAILED.value:
                reason = response.get("payload", {}).get("reason", "Unknown")
                logger.error(f"Authentication failed: {reason}")
                return False
            else:
                # Treat other messages as success - connection is alive
                logger.info(f"Connected, received: {msg_type}")
                return True

        except asyncio.TimeoutError:
            logger.error("Authentication timeout")
            return False
        except Exception as e:
            logger.error(f"Authentication error: {e}")
            return False

    async def disconnect(self) -> None:
        """Gracefully disconnect from the server."""
        self._should_reconnect = False
        self._set_state(ConnectionState.CLOSING)

        # Cancel tasks
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass
            self._heartbeat_task = None

        if self._receive_task:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass
            self._receive_task = None

        if self._reconnect_task:
            self._reconnect_task.cancel()
            try:
                await self._reconnect_task
            except asyncio.CancelledError:
                pass
            self._reconnect_task = None

        await self._close_connection()
        self._set_state(ConnectionState.CLOSED)

    async def _close_connection(self) -> None:
        """Close WebSocket and session."""
        if self._ws and not self._ws.closed:
            try:
                await self._ws.close()
            except Exception as e:
                logger.debug(f"Error closing WebSocket: {e}")
        self._ws = None

        if self._session and not self._session.closed:
            try:
                await self._session.close()
            except Exception as e:
                logger.debug(f"Error closing session: {e}")
        self._session = None

    async def _receive_loop(self) -> None:
        """Background task for receiving messages."""
        if not self._ws:
            return

        try:
            async for msg in self._ws:
                if msg.type == aiohttp.WSMsgType.TEXT:
                    try:
                        data = json.loads(msg.data)
                        self._stats.messages_received += 1
                        self._stats.bytes_received += len(msg.data)
                        self._stats.last_message_received = time.time()

                        await self._handle_message(data)
                    except json.JSONDecodeError as e:
                        logger.warning(f"Invalid JSON received: {e}")

                elif msg.type == aiohttp.WSMsgType.CLOSED:
                    logger.info("WebSocket closed by server")
                    break

                elif msg.type == aiohttp.WSMsgType.ERROR:
                    logger.error(f"WebSocket error: {self._ws.exception()}")
                    break

                elif msg.type == aiohttp.WSMsgType.PING:
                    await self._ws.pong(msg.data)

        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error(f"Receive loop error: {e}")

        # Connection lost
        if self._state == ConnectionState.AUTHENTICATED:
            self._set_state(ConnectionState.DISCONNECTED)
            if self._should_reconnect and self.config.auto_reconnect:
                self._reconnect_task = asyncio.create_task(self._reconnect_loop())

    async def _handle_message(self, data: dict) -> None:
        """Handle a received message."""
        msg_type = data.get("type", "")
        payload = data.get("payload", {})

        # Handle heartbeat ack
        if msg_type == MessageType.HEARTBEAT_ACK.value:
            self._pending_heartbeat = False
            self._last_heartbeat_ack = time.time()
            self._missed_heartbeats = 0
            return

        # Pass to callback
        if self._on_message:
            try:
                self._on_message(msg_type, payload)
            except Exception as e:
                logger.error(f"Error in message callback: {e}")

    async def _heartbeat_loop(self) -> None:
        """Background task for sending heartbeats."""
        try:
            while True:
                await asyncio.sleep(self.config.heartbeat_interval)

                if not self.is_connected:
                    continue

                # Check for missed heartbeat response
                if self._pending_heartbeat:
                    self._missed_heartbeats += 1
                    logger.warning(
                        f"Missed heartbeat ({self._missed_heartbeats}/"
                        f"{self.config.max_missed_heartbeats})"
                    )

                    if self._missed_heartbeats >= self.config.max_missed_heartbeats:
                        logger.error("Too many missed heartbeats, reconnecting")
                        await self._trigger_reconnect()
                        continue

                # Send heartbeat
                await self._send_heartbeat()

        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error(f"Heartbeat loop error: {e}")

    async def _send_heartbeat(self) -> None:
        """Send a heartbeat message."""
        if not self._ws or self._ws.closed:
            return

        try:
            heartbeat = {
                "type": MessageType.HEARTBEAT.value,
                "payload": {
                    "timestamp": time.time(),
                }
            }
            await self._ws.send_json(heartbeat)
            self._stats.messages_sent += 1
            self._stats.bytes_sent += len(json.dumps(heartbeat))
            self._pending_heartbeat = True
            self._last_heartbeat_sent = time.time()
        except Exception as e:
            logger.error(f"Error sending heartbeat: {e}")

    async def _trigger_reconnect(self) -> None:
        """Trigger a reconnection attempt."""
        if self._ws and not self._ws.closed:
            try:
                await self._ws.close()
            except Exception:
                pass

        self._set_state(ConnectionState.DISCONNECTED)

        if self._should_reconnect and self.config.auto_reconnect:
            self._reconnect_task = asyncio.create_task(self._reconnect_loop())

    async def _reconnect_loop(self) -> None:
        """Background task for reconnection attempts."""
        self._set_state(ConnectionState.RECONNECTING)

        while self._should_reconnect:
            self._reconnect_attempts += 1
            self._stats.reconnect_count += 1

            # Check max attempts
            if (
                self.config.max_reconnect_attempts > 0
                and self._reconnect_attempts > self.config.max_reconnect_attempts
            ):
                logger.error(
                    f"Max reconnect attempts ({self.config.max_reconnect_attempts}) exceeded"
                )
                self._set_state(ConnectionState.ERROR)
                return

            logger.info(
                f"Reconnect attempt {self._reconnect_attempts} "
                f"(delay: {self._current_reconnect_delay:.1f}s)"
            )

            # Wait before reconnecting
            try:
                await asyncio.sleep(self._current_reconnect_delay)
            except asyncio.CancelledError:
                raise

            # Attempt to connect
            self._set_state(ConnectionState.CONNECTING)
            connected = await self.connect()

            if connected:
                logger.info("Reconnection successful")
                return

            # Exponential backoff
            self._current_reconnect_delay = min(
                self._current_reconnect_delay * 2,
                self.config.reconnect_max_delay,
            )

            self._set_state(ConnectionState.RECONNECTING)

    async def send(
        self,
        message_type: str,
        payload: dict,
        queue_if_offline: bool = True,
        priority: int = 0,
    ) -> bool:
        """
        Send a message to the server.

        Args:
            message_type: Type of message to send
            payload: Message payload
            queue_if_offline: Queue message if not connected
            priority: Message priority (lower = higher priority)

        Returns:
            True if sent immediately, False if queued or failed
        """
        message = {
            "type": message_type,
            "payload": payload,
        }

        # Try to send if connected
        if self.is_connected and self._ws and not self._ws.closed:
            try:
                message_json = json.dumps(message)
                await self._ws.send_str(message_json)
                self._stats.messages_sent += 1
                self._stats.bytes_sent += len(message_json)
                self._stats.last_message_sent = time.time()
                return True
            except Exception as e:
                logger.error(f"Error sending message: {e}")
                # Fall through to queue

        # Queue for later
        if queue_if_offline:
            await self._queue_message(message_type, payload, priority)
            return False

        return False

    async def _queue_message(
        self,
        message_type: str,
        payload: dict,
        priority: int = 0,
    ) -> None:
        """Queue a message for sending when reconnected."""
        async with self._queue_lock:
            # Check queue size limit
            if len(self._message_queue) >= self.config.max_queue_size:
                # Remove lowest priority (oldest highest priority number)
                self._message_queue.sort(key=lambda m: (m.priority, m.timestamp))
                removed = self._message_queue.pop()
                logger.warning(f"Queue full, dropped message: {removed.message_type}")

            self._message_queue.append(
                QueuedMessage(
                    message_type=message_type,
                    payload=payload,
                    priority=priority,
                )
            )
            logger.debug(
                f"Queued message: {message_type} (queue size: {len(self._message_queue)})"
            )

    async def _flush_queue(self) -> None:
        """Send all queued messages."""
        async with self._queue_lock:
            if not self._message_queue:
                return

            logger.info(f"Flushing {len(self._message_queue)} queued messages")

            # Sort by priority then timestamp
            self._message_queue.sort(key=lambda m: (m.priority, m.timestamp))

            sent = 0
            failed = []

            for msg in self._message_queue:
                if self.is_connected and self._ws and not self._ws.closed:
                    try:
                        message = {
                            "type": msg.message_type,
                            "payload": msg.payload,
                        }
                        await self._ws.send_json(message)
                        self._stats.messages_sent += 1
                        self._stats.bytes_sent += len(json.dumps(message))
                        sent += 1
                    except Exception as e:
                        logger.error(f"Error sending queued message: {e}")
                        failed.append(msg)
                else:
                    failed.append(msg)

            self._message_queue = failed

            if sent > 0:
                logger.info(f"Sent {sent} queued messages")
            if failed:
                logger.warning(f"{len(failed)} messages still queued")

    def get_queue_size(self) -> int:
        """Get number of messages in offline queue."""
        return len(self._message_queue)

    def clear_queue(self) -> int:
        """
        Clear the offline message queue.

        Returns:
            Number of messages cleared
        """
        count = len(self._message_queue)
        self._message_queue.clear()
        return count

    async def __aenter__(self) -> "WebSocketClient":
        """Async context manager entry."""
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Async context manager exit."""
        await self.disconnect()


def create_websocket_client(
    url: str,
    device_token: str,
    on_message: Optional[MessageHandler] = None,
    on_state_change: Optional[StateChangeHandler] = None,
    **kwargs,
) -> WebSocketClient:
    """
    Factory function to create a WebSocket client.

    Args:
        url: WebSocket URL
        device_token: Device authentication token
        on_message: Message callback
        on_state_change: State change callback
        **kwargs: Additional WebSocketConfig parameters

    Returns:
        Configured WebSocketClient instance
    """
    config = WebSocketConfig(
        url=url,
        device_token=device_token,
        **kwargs,
    )
    return WebSocketClient(
        config=config,
        on_message=on_message,
        on_state_change=on_state_change,
    )


if __name__ == "__main__":
    # Simple test
    import sys

    logging.basicConfig(level=logging.DEBUG)

    async def test():
        def on_msg(msg_type, payload):
            print(f"Received: {msg_type} - {payload}")

        def on_state(old, new):
            print(f"State: {old.value} -> {new.value}")

        client = create_websocket_client(
            url="ws://localhost:3003/ws/device",
            device_token="test-token",
            on_message=on_msg,
            on_state_change=on_state,
        )

        print(f"Initial state: {client.state.value}")
        print(f"Stats: {client.get_stats()}")

        # Test offline queue
        await client.send("status", {"test": True})
        print(f"Queue size: {client.get_queue_size()}")

        print("WebSocket client test completed!")

    asyncio.run(test())
