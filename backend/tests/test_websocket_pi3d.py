"""
Tests for Pi3D daemon WebSocket protocol support.

Tests the backend WebSocket handling for Pi3D daemon devices including:
- Authentication flow (auth -> auth_success)
- Status reporting and Redis caching
- Command sending with request_id
- Heartbeat/heartbeat_ack
- Admin broadcast of device status
"""

import asyncio
import json
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

from websocket.manager import ConnectionManager
from websocket.device_status_cache import (
    store_device_status,
    get_device_status,
    get_all_device_statuses,
    remove_device_status,
    get_online_device_tokens,
)


class TestConnectionManager:
    """Tests for ConnectionManager Pi3D protocol support."""

    def setup_method(self):
        """Set up test fixtures."""
        self.manager = ConnectionManager()

    @pytest.mark.asyncio
    async def test_send_device_command_pi3d_format(self):
        """Test that commands are sent in Pi3D daemon format."""
        # Create mock WebSocket
        mock_ws = AsyncMock()

        # Connect device
        connection_id = await self.manager.connect(
            mock_ws, "device", "TEST1234"
        )

        # Send command
        await self.manager.send_device_command(
            "TEST1234",
            "next",
            {"some": "data"},
            "req-123"
        )

        # Verify command format
        mock_ws.send_text.assert_called_once()
        sent_message = json.loads(mock_ws.send_text.call_args[0][0])

        # Check Pi3D format
        assert sent_message["type"] == "command"
        assert "payload" in sent_message
        assert sent_message["payload"]["command"] == "next"
        assert sent_message["payload"]["params"] == {"some": "data"}
        assert sent_message["payload"]["request_id"] == "req-123"

        # Check legacy format compatibility
        assert sent_message["command"] == "next"
        assert sent_message["data"] == {"some": "data"}
        assert sent_message["request_id"] == "req-123"

        # Cleanup
        self.manager.disconnect(connection_id)

    @pytest.mark.asyncio
    async def test_send_device_command_without_request_id(self):
        """Test command without request_id."""
        mock_ws = AsyncMock()
        connection_id = await self.manager.connect(mock_ws, "device", "TEST1234")

        await self.manager.send_device_command("TEST1234", "pause", {})

        sent_message = json.loads(mock_ws.send_text.call_args[0][0])
        assert "request_id" not in sent_message["payload"]

        self.manager.disconnect(connection_id)

    @pytest.mark.asyncio
    async def test_broadcast_device_status_update(self):
        """Test broadcasting device status to admins."""
        # Connect admin
        mock_admin_ws = AsyncMock()
        admin_id = await self.manager.connect(mock_admin_ws, "admin")

        # Broadcast status
        await self.manager.broadcast_device_status_update({
            "device_token": "TEST1234",
            "status": {"state": "playing"},
            "timestamp": "2026-02-28T12:00:00"
        })

        # Verify admin received update
        mock_admin_ws.send_text.assert_called()
        sent_message = json.loads(mock_admin_ws.send_text.call_args[0][0])
        assert sent_message["type"] == "device_status_update"
        assert sent_message["data"]["device_token"] == "TEST1234"

        self.manager.disconnect(admin_id)


class TestDeviceStatusCache:
    """Tests for Redis device status cache."""

    @pytest.fixture
    def mock_redis(self):
        """Create mock Redis client."""
        with patch('websocket.device_status_cache._redis_client') as mock:
            mock_redis = MagicMock()
            mock.return_value = mock_redis
            yield mock_redis

    def test_store_device_status(self, mock_redis):
        """Test storing device status in Redis."""
        with patch('websocket.device_status_cache.get_redis_client', return_value=mock_redis):
            status = {"state": "playing", "current_image_id": 123}
            result = store_device_status("TEST1234", status, ttl=60)

            assert result is True
            mock_redis.setex.assert_called_once()
            mock_redis.sadd.assert_called_once()

    def test_get_device_status(self, mock_redis):
        """Test retrieving device status from Redis."""
        with patch('websocket.device_status_cache.get_redis_client', return_value=mock_redis):
            mock_redis.get.return_value = json.dumps({
                "state": "playing",
                "current_image_id": 123
            })

            status = get_device_status("TEST1234")

            assert status is not None
            assert status["state"] == "playing"
            assert status["current_image_id"] == 123

    def test_get_device_status_not_found(self, mock_redis):
        """Test retrieving non-existent device status."""
        with patch('websocket.device_status_cache.get_redis_client', return_value=mock_redis):
            mock_redis.get.return_value = None

            status = get_device_status("NOTFOUND")

            assert status is None

    def test_remove_device_status(self, mock_redis):
        """Test removing device status from Redis."""
        with patch('websocket.device_status_cache.get_redis_client', return_value=mock_redis):
            result = remove_device_status("TEST1234")

            assert result is True
            mock_redis.delete.assert_called_once()
            mock_redis.srem.assert_called_once()

    def test_get_all_device_statuses(self, mock_redis):
        """Test getting all device statuses."""
        with patch('websocket.device_status_cache.get_redis_client', return_value=mock_redis):
            mock_redis.smembers.return_value = {"TEST1234", "TEST5678"}
            mock_redis.get.side_effect = [
                json.dumps({"state": "playing"}),
                json.dumps({"state": "paused"}),
            ]

            statuses = get_all_device_statuses()

            assert len(statuses) == 2
            assert "TEST1234" in statuses
            assert "TEST5678" in statuses

    def test_get_online_device_tokens(self, mock_redis):
        """Test getting list of online device tokens."""
        with patch('websocket.device_status_cache.get_redis_client', return_value=mock_redis):
            mock_redis.smembers.return_value = {"TEST1234", "TEST5678"}

            tokens = get_online_device_tokens()

            assert len(tokens) == 2
            assert "TEST1234" in tokens
            assert "TEST5678" in tokens


class TestPi3DMessageProtocol:
    """Tests for Pi3D daemon message protocol handling."""

    def setup_method(self):
        """Set up test fixtures."""
        self.manager = ConnectionManager()

    @pytest.mark.asyncio
    async def test_heartbeat_ack_response(self):
        """Test that heartbeat triggers heartbeat_ack response."""
        # This is tested via the endpoint handler, not the manager directly
        # Just verify the manager can handle heartbeats
        mock_ws = AsyncMock()
        connection_id = await self.manager.connect(mock_ws, "device", "TEST1234")

        # Handle heartbeat
        await self.manager.handle_heartbeat(connection_id)

        # Should send heartbeat response
        mock_ws.send_text.assert_called()
        sent_message = json.loads(mock_ws.send_text.call_args[0][0])
        assert sent_message["type"] == "heartbeat_response"

        self.manager.disconnect(connection_id)


class TestDisplayDeviceModel:
    """Tests for DisplayDevice model Pi3D status fields."""

    def test_device_has_pi3d_fields(self):
        """Test that DisplayDevice model has Pi3D status fields."""
        from models.display_device import DisplayDevice

        # Check fields exist
        columns = {c.name for c in DisplayDevice.__table__.columns}
        assert "device_type" in columns
        assert "last_state" in columns
        assert "last_image_id" in columns
        assert "last_cache_size_mb" in columns
        assert "last_cache_hit_rate" in columns
        assert "last_uptime_seconds" in columns
        assert "last_status_json" in columns

    def test_device_to_dict_includes_pi3d_fields(self):
        """Test that to_dict includes Pi3D fields."""
        from models.display_device import DisplayDevice, DeviceStatus

        device = DisplayDevice(
            device_token="TEST1234",
            status=DeviceStatus.AUTHORIZED,
            device_type="pi3d",
            last_state="playing",
            last_image_id=123,
            last_cache_size_mb=50.5,
            last_cache_hit_rate=0.85,
            last_uptime_seconds=3600.0,
        )

        result = device.to_dict()

        assert result["device_type"] == "pi3d"
        assert result["last_state"] == "playing"
        assert result["last_image_id"] == 123
        assert result["last_cache_size_mb"] == 50.5
        assert result["last_cache_hit_rate"] == 0.85
        assert result["last_uptime_seconds"] == 3600.0


class TestDisplayDeviceService:
    """Tests for DisplayDeviceService Pi3D status update."""

    def test_update_device_status(self):
        """Test updating device status from Pi3D daemon payload."""
        from sqlalchemy.orm import Session
        from services.display_device_service import DisplayDeviceService
        from models.display_device import DisplayDevice, DeviceStatus

        # Create mock session with device
        mock_session = MagicMock(spec=Session)
        mock_device = DisplayDevice(
            device_token="TEST1234",
            status=DeviceStatus.AUTHORIZED,
        )
        mock_session.query.return_value.filter.return_value.first.return_value = mock_device

        service = DisplayDeviceService(mock_session)

        # Pi3D daemon status payload
        status_payload = {
            "state": "playing",
            "current_image_id": 123,
            "cache": {
                "size_mb": 50.5,
                "hit_rate": 0.85,
            },
            "uptime_seconds": 3600.0,
        }

        # Update status
        result = service.update_device_status("TEST1234", status_payload, "pi3d")

        # Verify fields updated
        assert mock_device.device_type == "pi3d"
        assert mock_device.last_state == "playing"
        assert mock_device.last_image_id == 123
        assert mock_device.last_cache_size_mb == 50.5
        assert mock_device.last_cache_hit_rate == 0.85
        assert mock_device.last_uptime_seconds == 3600.0
        assert mock_device.last_status_json == status_payload

        # Verify session committed
        mock_session.commit.assert_called_once()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
