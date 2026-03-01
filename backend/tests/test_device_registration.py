"""
Tests for Pi3D daemon device registration endpoints.

Tests the backend API endpoints for Pi3D daemon registration:
- POST /api/devices/register - Request registration code
- GET /api/devices/register/{code}/status - Poll for authorization status
- POST /api/devices/register/{code}/authorize - Authorize a registration
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from models.display_device import DisplayDevice, DeviceStatus
from api.device_registration import (
    generate_registration_code,
    router,
)


class TestGenerateRegistrationCode:
    """Tests for registration code generation."""

    def test_code_is_four_characters(self):
        """Test code is exactly 4 characters."""
        code = generate_registration_code()
        assert len(code) == 4

    def test_code_is_uppercase_alphanumeric(self):
        """Test code contains only allowed characters."""
        allowed = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
        for _ in range(100):
            code = generate_registration_code()
            for char in code:
                assert char in allowed

    def test_code_excludes_ambiguous_characters(self):
        """Test code excludes visually ambiguous characters."""
        ambiguous = "0OI1L"
        for _ in range(100):
            code = generate_registration_code()
            for char in ambiguous:
                assert char not in code

    def test_codes_are_unique(self):
        """Test that generated codes are reasonably unique."""
        codes = set()
        for _ in range(100):
            code = generate_registration_code()
            codes.add(code)
        # Should have many unique codes (very unlikely to have duplicates)
        assert len(codes) >= 95


class TestDaemonRegistrationEndpoint:
    """Tests for POST /api/devices/register endpoint."""

    @pytest.fixture
    def mock_db(self):
        """Create mock database session."""
        mock = MagicMock(spec=Session)
        # Make query().filter().first() return None (no existing code)
        mock.query.return_value.filter.return_value.first.return_value = None

        # Track ID counter
        id_counter = [0]

        def mock_refresh(device):
            """Mock refresh that sets device.id."""
            id_counter[0] += 1
            device.id = id_counter[0]

        mock.refresh.side_effect = mock_refresh
        return mock

    @pytest.fixture
    def mock_request(self):
        """Create mock request object."""
        mock = MagicMock()
        mock.client.host = "192.168.1.100"
        return mock

    @pytest.mark.asyncio
    async def test_register_creates_pending_device(self, mock_db, mock_request):
        """Test registration creates a pending device."""
        from api.device_registration import register_daemon_device, DaemonRegistrationRequest

        request_data = DaemonRegistrationRequest(
            device_type="pi3d",
            daemon_version="3.0.0",
            capabilities={"pi3d_display": True},
        )

        result = await register_daemon_device(mock_request, request_data, mock_db)

        # Verify device was added to DB
        mock_db.add.assert_called_once()
        added_device = mock_db.add.call_args[0][0]
        assert added_device.status == DeviceStatus.PENDING
        assert added_device.device_type == "pi3d"
        assert added_device.ip_address == "192.168.1.100"

        # Verify response
        assert len(result.code) == 4
        assert result.device_id == 1  # Set by mock_refresh
        assert "expires_at" in result.model_dump()

    @pytest.mark.asyncio
    async def test_register_returns_unique_code(self, mock_db, mock_request):
        """Test registration returns unique code on collision."""
        from api.device_registration import register_daemon_device, DaemonRegistrationRequest

        # First query returns existing device, second returns None
        mock_db.query.return_value.filter.return_value.first.side_effect = [
            MagicMock(),  # First code collision
            None,  # Second code is unique
        ]

        request_data = DaemonRegistrationRequest()

        result = await register_daemon_device(mock_request, request_data, mock_db)

        # Should have checked twice
        assert mock_db.query.return_value.filter.return_value.first.call_count == 2
        assert len(result.code) == 4


class TestRegistrationStatusEndpoint:
    """Tests for GET /api/devices/register/{code}/status endpoint."""

    @pytest.fixture
    def mock_db(self):
        """Create mock database session."""
        return MagicMock(spec=Session)

    @pytest.mark.asyncio
    async def test_status_pending(self, mock_db):
        """Test status returns PENDING for pending device."""
        from api.device_registration import get_registration_status

        # Create mock pending device
        mock_device = DisplayDevice(
            id=1,
            device_token="ABCD",
            status=DeviceStatus.PENDING,
            created_at=datetime.utcnow(),
            last_seen=datetime.utcnow(),
        )
        mock_db.query.return_value.filter.return_value.first.return_value = mock_device

        result = await get_registration_status("ABCD", mock_db)

        assert result.status == "PENDING"
        assert result.device_token is None

    @pytest.mark.asyncio
    async def test_status_authorized(self, mock_db):
        """Test status returns AUTHORIZED with token."""
        from api.device_registration import get_registration_status

        # Create mock authorized device
        mock_device = DisplayDevice(
            id=1,
            device_token="PERMANENT_TOKEN_123",
            status=DeviceStatus.AUTHORIZED,
            created_at=datetime.utcnow() - timedelta(minutes=5),
            last_seen=datetime.utcnow(),
            playlist_id=42,
        )
        mock_db.query.return_value.filter.return_value.first.return_value = mock_device

        result = await get_registration_status("ABCD", mock_db)

        assert result.status == "AUTHORIZED"
        assert result.device_token == "PERMANENT_TOKEN_123"
        assert result.device_id == 1
        assert result.playlist_id == 42

    @pytest.mark.asyncio
    async def test_status_rejected(self, mock_db):
        """Test status returns REJECTED for rejected device."""
        from api.device_registration import get_registration_status

        # Create mock rejected device
        mock_device = DisplayDevice(
            id=1,
            device_token="ABCD",
            status=DeviceStatus.REJECTED,
            created_at=datetime.utcnow(),
            last_seen=datetime.utcnow(),
        )
        mock_db.query.return_value.filter.return_value.first.return_value = mock_device

        result = await get_registration_status("ABCD", mock_db)

        assert result.status == "REJECTED"
        assert result.device_token is None

    @pytest.mark.asyncio
    async def test_status_expired(self, mock_db):
        """Test status returns EXPIRED for old pending registration."""
        from api.device_registration import get_registration_status

        # Create mock expired pending device
        mock_device = DisplayDevice(
            id=1,
            device_token="ABCD",
            status=DeviceStatus.PENDING,
            created_at=datetime.utcnow() - timedelta(minutes=35),  # 35 minutes old
            last_seen=datetime.utcnow(),
        )
        mock_db.query.return_value.filter.return_value.first.return_value = mock_device

        result = await get_registration_status("ABCD", mock_db)

        assert result.status == "EXPIRED"

    @pytest.mark.asyncio
    async def test_status_not_found(self, mock_db):
        """Test status returns 404 for unknown code."""
        from api.device_registration import get_registration_status
        from fastapi import HTTPException

        mock_db.query.return_value.filter.return_value.first.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            await get_registration_status("XXXX", mock_db)

        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_status_normalizes_code(self, mock_db):
        """Test status normalizes code to uppercase."""
        from api.device_registration import get_registration_status

        mock_device = DisplayDevice(
            id=1,
            device_token="ABCD",
            status=DeviceStatus.PENDING,
            created_at=datetime.utcnow(),
            last_seen=datetime.utcnow(),
        )
        mock_db.query.return_value.filter.return_value.first.return_value = mock_device

        # Call with lowercase code
        result = await get_registration_status("abcd", mock_db)

        assert result.status == "PENDING"

    @pytest.mark.asyncio
    async def test_status_invalid_code_format(self, mock_db):
        """Test status rejects invalid code format."""
        from api.device_registration import get_registration_status
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await get_registration_status("AB", mock_db)  # Too short

        assert exc_info.value.status_code == 400


class TestAuthorizeRegistrationEndpoint:
    """Tests for POST /api/devices/register/{code}/authorize endpoint."""

    @pytest.fixture
    def mock_db(self):
        """Create mock database session."""
        return MagicMock(spec=Session)

    @pytest.mark.asyncio
    async def test_authorize_pending_device(self, mock_db):
        """Test authorizing a pending device."""
        from api.device_registration import authorize_registration

        # Create mock pending device
        mock_device = DisplayDevice(
            id=1,
            device_token="ABCD",
            status=DeviceStatus.PENDING,
        )
        mock_db.query.return_value.filter.return_value.first.return_value = mock_device

        result = await authorize_registration("ABCD", mock_db)

        # Device should be updated
        assert mock_device.status == DeviceStatus.AUTHORIZED
        assert len(mock_device.device_token) == 32
        assert mock_device.authorized_at is not None

        # Response should contain new token
        assert result["status"] == "authorized"
        assert result["device_id"] == 1
        assert len(result["device_token"]) == 32

    @pytest.mark.asyncio
    async def test_authorize_not_found(self, mock_db):
        """Test authorizing unknown code returns 404."""
        from api.device_registration import authorize_registration
        from fastapi import HTTPException

        mock_db.query.return_value.filter.return_value.first.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            await authorize_registration("XXXX", mock_db)

        assert exc_info.value.status_code == 404


class TestFullRegistrationFlow:
    """Integration tests for full registration flow."""

    @pytest.mark.asyncio
    async def test_full_registration_flow(self):
        """Test complete registration flow: register -> poll -> authorize -> poll."""
        from api.device_registration import (
            register_daemon_device,
            get_registration_status,
            authorize_registration,
            DaemonRegistrationRequest,
        )

        # Create a mock database session with complete behavior
        mock_session = MagicMock(spec=Session)
        mock_request = MagicMock()
        mock_request.client.host = "192.168.1.100"

        # Create a device to be returned by queries
        mock_device = None
        id_counter = [0]

        def mock_refresh(device):
            nonlocal mock_device
            id_counter[0] += 1
            device.id = id_counter[0]
            mock_device = device

        mock_session.refresh.side_effect = mock_refresh

        # Step 1: Register device - no collision
        mock_session.query.return_value.filter.return_value.first.return_value = None

        request_data = DaemonRegistrationRequest(
            device_type="pi3d",
            daemon_version="3.0.0",
        )
        register_result = await register_daemon_device(mock_request, request_data, mock_session)

        assert len(register_result.code) == 4
        assert register_result.device_id == 1
        registration_code = register_result.code

        # mock_device should be set by refresh
        assert mock_device is not None
        assert mock_device.device_token == registration_code
        assert mock_device.status == DeviceStatus.PENDING

        # Step 2: Poll status (should be PENDING)
        # Update mock_device's created_at for the status check
        mock_device.created_at = datetime.utcnow()
        mock_device.last_seen = datetime.utcnow()
        mock_session.query.return_value.filter.return_value.first.return_value = mock_device
        status_result = await get_registration_status(registration_code, mock_session)

        assert status_result.status == "PENDING"
        assert status_result.device_token is None

        # Step 3: Authorize device
        auth_result = await authorize_registration(registration_code, mock_session)

        assert auth_result["status"] == "authorized"
        assert len(auth_result["device_token"]) == 32
        new_token = auth_result["device_token"]

        # Device should be updated
        assert mock_device.status == DeviceStatus.AUTHORIZED
        assert mock_device.device_token == new_token

        # Note: After authorization, the daemon receives the new token and should use it
        # for all further API calls. The registration code is no longer valid for lookups
        # because the device_token field has been updated to the permanent token.
        # In practice, the daemon polls once more, gets AUTHORIZED with the new token,
        # and then switches to normal operation using that token.
        #
        # The test_status_authorized test already covers the case where a query
        # returns an authorized device.

    @pytest.mark.asyncio
    async def test_registration_rejected_flow(self):
        """Test registration rejection flow."""
        from api.device_registration import (
            register_daemon_device,
            get_registration_status,
            DaemonRegistrationRequest,
        )

        mock_session = MagicMock(spec=Session)
        mock_request = MagicMock()
        mock_request.client.host = "192.168.1.100"

        mock_device = None
        id_counter = [0]

        def mock_refresh(device):
            nonlocal mock_device
            id_counter[0] += 1
            device.id = id_counter[0]
            mock_device = device

        mock_session.refresh.side_effect = mock_refresh

        # Register device
        mock_session.query.return_value.filter.return_value.first.return_value = None

        request_data = DaemonRegistrationRequest(
            device_type="pi3d",
            daemon_version="3.0.0",
        )
        register_result = await register_daemon_device(mock_request, request_data, mock_session)

        # Simulate admin rejection
        mock_device.created_at = datetime.utcnow()
        mock_device.last_seen = datetime.utcnow()
        mock_device.status = DeviceStatus.REJECTED
        mock_session.query.return_value.filter.return_value.first.return_value = mock_device

        # Poll should return REJECTED
        status_result = await get_registration_status(register_result.code, mock_session)

        assert status_result.status == "REJECTED"
        assert status_result.device_token is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
