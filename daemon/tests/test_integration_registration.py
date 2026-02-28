"""
Integration tests for the complete device registration flow.

Tests cover:
- Fresh daemon displays registration code
- Admin authorizes device
- Daemon detects authorization and starts slideshow
- Device appears correctly in admin device list
- Registration rejection handling
- Registration timeout and retry
"""

import asyncio
import json
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from aiohttp import web

from glowworm_daemon.registration_manager import (
    RegistrationManager,
    RegistrationConfig,
    RegistrationState,
    RegistrationResult,
)
from glowworm_daemon.display_controller import (
    DisplayController,
    DisplayControllerConfig,
    DisplayState,
)


class MockBackendServer:
    """Mock backend server for registration testing."""

    def __init__(self, port: int):
        self.port = port
        self.app = web.Application()
        self.runner: Optional[web.AppRunner] = None

        # State tracking
        self._pending_registrations: Dict[str, Dict] = {}  # code -> device info
        self._authorized_devices: Dict[int, Dict] = {}  # device_id -> device info
        self._rejected_codes: set = set()
        self._request_log: List[Dict] = []
        self._device_id_counter = 0

        # Setup routes
        self.app.router.add_post("/api/devices/register", self._handle_register)
        self.app.router.add_get(
            "/api/devices/register/{code}/status", self._handle_status
        )
        self.app.router.add_post(
            "/api/devices/register/{code}/authorize", self._handle_authorize
        )
        self.app.router.add_get(
            "/api/display-devices/admin/devices", self._handle_list_devices
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

    def get_registration_code(self, device_id: int) -> Optional[str]:
        """Get registration code for a device (for test verification)."""
        for code, info in self._pending_registrations.items():
            if info.get("device_id") == device_id:
                return code
        return None

    def authorize_device(self, code: str, playlist_id: int = 1) -> bool:
        """Authorize a pending registration (simulate admin action)."""
        if code not in self._pending_registrations:
            return False

        device_info = self._pending_registrations[code]
        device_id = device_info["device_id"]

        # Generate permanent token
        permanent_token = f"PERMANENT_TOKEN_{device_id}_{int(time.time())}"

        # Update authorized devices
        self._authorized_devices[device_id] = {
            "device_token": permanent_token,
            "device_id": device_id,
            "playlist_id": playlist_id,
            "status": "AUTHORIZED",
            "device_type": device_info.get("device_type", "pi3d"),
        }

        # Update pending registration with new status and token
        self._pending_registrations[code]["status"] = "AUTHORIZED"
        self._pending_registrations[code]["device_token"] = permanent_token
        self._pending_registrations[code]["playlist_id"] = playlist_id

        return True

    def reject_device(self, code: str) -> bool:
        """Reject a pending registration."""
        if code not in self._pending_registrations:
            return False

        self._pending_registrations[code]["status"] = "REJECTED"
        self._rejected_codes.add(code)
        return True

    async def _handle_register(self, request: web.Request) -> web.Response:
        """Handle POST /api/devices/register."""
        self._request_log.append({
            "endpoint": "register",
            "method": "POST",
            "timestamp": time.time(),
        })

        try:
            data = await request.json()
        except Exception:
            data = {}

        # Generate registration code and device ID
        self._device_id_counter += 1
        code = f"T{self._device_id_counter:03d}"  # Simple test codes: T001, T002, etc.
        device_id = self._device_id_counter

        # Store registration
        self._pending_registrations[code] = {
            "code": code,
            "device_id": device_id,
            "device_type": data.get("device_type", "pi3d"),
            "daemon_version": data.get("daemon_version", "3.0.0"),
            "capabilities": data.get("capabilities", {}),
            "status": "PENDING",
            "created_at": time.time(),
        }

        return web.json_response({
            "code": code,
            "device_id": device_id,
            "expires_at": "2099-12-31T23:59:59",
            "message": "Display this code on your device",
        })

    async def _handle_status(self, request: web.Request) -> web.Response:
        """Handle GET /api/devices/register/{code}/status."""
        code = request.match_info.get("code", "").upper().strip()

        self._request_log.append({
            "endpoint": "status",
            "method": "GET",
            "code": code,
            "timestamp": time.time(),
        })

        if code not in self._pending_registrations:
            return web.json_response(
                {"detail": "Registration code not found"},
                status=404,
            )

        info = self._pending_registrations[code]
        status = info.get("status", "PENDING")

        response = {
            "status": status,
            "message": f"Status: {status}",
        }

        if status == "AUTHORIZED":
            response["device_token"] = info.get("device_token")
            response["device_id"] = info.get("device_id")
            response["playlist_id"] = info.get("playlist_id")

        return web.json_response(response)

    async def _handle_authorize(self, request: web.Request) -> web.Response:
        """Handle POST /api/devices/register/{code}/authorize."""
        code = request.match_info.get("code", "").upper().strip()

        self._request_log.append({
            "endpoint": "authorize",
            "method": "POST",
            "code": code,
            "timestamp": time.time(),
        })

        if code not in self._pending_registrations:
            return web.json_response(
                {"detail": "Registration not found"},
                status=404,
            )

        if self.authorize_device(code):
            info = self._pending_registrations[code]
            return web.json_response({
                "status": "authorized",
                "device_id": info["device_id"],
                "device_token": info["device_token"],
            })
        else:
            return web.json_response(
                {"detail": "Authorization failed"},
                status=400,
            )

    async def _handle_list_devices(self, request: web.Request) -> web.Response:
        """Handle GET /api/display-devices/admin/devices."""
        self._request_log.append({
            "endpoint": "list_devices",
            "method": "GET",
            "timestamp": time.time(),
        })

        # Return both pending and authorized devices
        devices = []

        for code, info in self._pending_registrations.items():
            devices.append({
                "id": info["device_id"],
                "device_token": code if info["status"] == "PENDING" else info.get("device_token", ""),
                "status": info["status"].lower(),
                "device_type": info.get("device_type", "pi3d"),
            })

        return web.json_response({"devices": devices})


class MockDisplayController:
    """Mock display controller for registration testing."""

    def __init__(self):
        self.registration_code: Optional[str] = None
        self.is_showing_registration = False
        self.call_log: List[Dict] = []

    async def show_registration(self, code: str) -> bool:
        """Show registration code on display."""
        self.registration_code = code
        self.is_showing_registration = True
        self.call_log.append({
            "method": "show_registration",
            "code": code,
            "timestamp": time.time(),
        })
        return True

    async def hide_registration(self) -> bool:
        """Hide registration display."""
        self.is_showing_registration = False
        self.call_log.append({
            "method": "hide_registration",
            "timestamp": time.time(),
        })
        return True


@pytest.fixture
def mock_server_port():
    """Get a port for the mock server."""
    # Use a unique port to avoid conflicts
    import random
    return random.randint(50000, 60000)


@pytest_asyncio.fixture
async def mock_backend(mock_server_port):
    """Create and start a mock backend server."""
    server = MockBackendServer(mock_server_port)
    await server.start()
    yield server
    await server.stop()


@pytest_asyncio.fixture
async def registration_config(mock_server_port, tmp_path):
    """Create registration configuration pointing to mock server."""
    config_file = tmp_path / "config.yaml"
    return RegistrationConfig(
        backend_url=f"http://127.0.0.1:{mock_server_port}",
        config_file=str(config_file),
        poll_interval=0.1,  # Fast polling for tests
        authorization_timeout=5.0,
        max_retries=2,
        retry_base_delay=0.1,
        device_type="pi3d",
        daemon_version="3.0.0",
    )


@pytest_asyncio.fixture
async def registration_manager(registration_config):
    """Create a registration manager."""
    manager = RegistrationManager(registration_config)
    await manager.start()
    yield manager
    await manager.stop()


class TestRegistrationCodeDisplay:
    """Tests for registration code display on fresh daemon."""

    @pytest.mark.asyncio
    async def test_fresh_daemon_requests_registration_code(
        self,
        mock_backend: MockBackendServer,
        registration_manager: RegistrationManager,
    ):
        """Test that a fresh daemon (no token) requests a registration code."""
        # Verify daemon needs registration
        assert registration_manager.needs_registration() is True

        # Request code manually (internal method)
        result = await registration_manager._request_registration_code()

        assert result is True
        assert registration_manager.registration_code is not None
        assert len(registration_manager.registration_code) > 0

        # Verify backend received request
        register_requests = [
            r for r in mock_backend._request_log
            if r["endpoint"] == "register"
        ]
        assert len(register_requests) == 1

    @pytest.mark.asyncio
    async def test_registration_code_displayed_on_screen(
        self,
        mock_backend: MockBackendServer,
        registration_manager: RegistrationManager,
    ):
        """Test that registration code is displayed on Pi3D screen."""
        mock_display = MockDisplayController()

        # Run registration (without waiting for authorization, we'll cancel it)
        task = asyncio.create_task(
            registration_manager.run_registration(display_controller=mock_display)
        )

        # Wait for code to be displayed
        await asyncio.sleep(0.3)

        # Verify code is shown
        assert mock_display.is_showing_registration is True
        assert mock_display.registration_code is not None
        assert len(mock_display.registration_code) > 0

        # Cancel registration
        registration_manager.cancel()
        await task

        # Verify hide was called
        assert mock_display.is_showing_registration is False

    @pytest.mark.asyncio
    async def test_daemon_with_token_skips_registration(
        self,
        registration_config: RegistrationConfig,
    ):
        """Test that daemon with existing token doesn't need registration."""
        manager = RegistrationManager(
            registration_config,
            existing_token="EXISTING_TOKEN_12345",
        )

        assert manager.needs_registration() is False

    @pytest.mark.asyncio
    async def test_state_transitions_during_code_request(
        self,
        mock_backend: MockBackendServer,
        registration_manager: RegistrationManager,
    ):
        """Test state transitions during registration code request."""
        states = []

        def on_state_change(old, new):
            states.append((old.value, new.value))

        registration_manager.add_state_callback(on_state_change)

        # Request code
        mock_display = MockDisplayController()
        task = asyncio.create_task(
            registration_manager.run_registration(display_controller=mock_display)
        )

        # Wait for code to be displayed
        await asyncio.sleep(0.3)
        registration_manager.cancel()
        await task

        # Verify state transitions
        assert ("idle", "checking") in states
        assert ("checking", "requesting_code") in states
        assert ("requesting_code", "displaying_code") in states


class TestAdminAuthorization:
    """Tests for admin authorization flow."""

    @pytest.mark.asyncio
    async def test_daemon_detects_authorization(
        self,
        mock_backend: MockBackendServer,
        registration_manager: RegistrationManager,
    ):
        """Test that daemon detects authorization and receives token."""
        mock_display = MockDisplayController()

        # Start registration in background
        task = asyncio.create_task(
            registration_manager.run_registration(display_controller=mock_display)
        )

        # Wait for code to be displayed
        await asyncio.sleep(0.3)

        # Get the registration code
        code = registration_manager.registration_code
        assert code is not None

        # Simulate admin authorization
        mock_backend.authorize_device(code, playlist_id=42)

        # Wait for daemon to detect authorization
        result = await task

        assert result.success is True
        assert result.device_token is not None
        assert "PERMANENT_TOKEN" in result.device_token
        assert registration_manager.state == RegistrationState.COMPLETED

    @pytest.mark.asyncio
    async def test_token_saved_to_config_file(
        self,
        mock_backend: MockBackendServer,
        registration_config: RegistrationConfig,
    ):
        """Test that device token is saved to config file after authorization."""
        manager = RegistrationManager(registration_config)
        await manager.start()

        mock_display = MockDisplayController()

        # Start registration
        task = asyncio.create_task(
            manager.run_registration(display_controller=mock_display)
        )

        # Wait for code and authorize
        await asyncio.sleep(0.3)
        code = manager.registration_code
        mock_backend.authorize_device(code)

        result = await task
        await manager.stop()

        assert result.success is True

        # Verify token was saved
        import yaml
        config_path = Path(registration_config.config_file)
        assert config_path.exists()

        with open(config_path, "r") as f:
            saved_config = yaml.safe_load(f)

        assert "backend" in saved_config
        assert "device_token" in saved_config["backend"]
        assert saved_config["backend"]["device_token"] == result.device_token

    @pytest.mark.asyncio
    async def test_authorization_within_timeout(
        self,
        mock_backend: MockBackendServer,
        registration_manager: RegistrationManager,
    ):
        """Test authorization detected within 10 seconds (spec requirement)."""
        mock_display = MockDisplayController()

        start_time = time.time()

        # Start registration
        task = asyncio.create_task(
            registration_manager.run_registration(display_controller=mock_display)
        )

        # Wait for code
        await asyncio.sleep(0.2)
        code = registration_manager.registration_code

        # Authorize after short delay
        await asyncio.sleep(0.3)
        mock_backend.authorize_device(code)

        result = await task
        elapsed = time.time() - start_time

        assert result.success is True
        # Daemon should detect authorization within a few poll intervals
        # With poll_interval=0.1, should be well under 10 seconds
        assert elapsed < 2.0  # Very generous given our fast poll interval

    @pytest.mark.asyncio
    async def test_registration_display_hidden_after_authorization(
        self,
        mock_backend: MockBackendServer,
        registration_manager: RegistrationManager,
    ):
        """Test that registration display is hidden after authorization."""
        mock_display = MockDisplayController()

        task = asyncio.create_task(
            registration_manager.run_registration(display_controller=mock_display)
        )

        await asyncio.sleep(0.2)
        code = registration_manager.registration_code
        mock_backend.authorize_device(code)

        await task

        # Verify hide_registration was called
        hide_calls = [
            c for c in mock_display.call_log
            if c["method"] == "hide_registration"
        ]
        assert len(hide_calls) == 1


class TestRegistrationRejection:
    """Tests for registration rejection handling."""

    @pytest.mark.asyncio
    async def test_daemon_detects_rejection(
        self,
        mock_backend: MockBackendServer,
        registration_manager: RegistrationManager,
    ):
        """Test that daemon detects registration rejection."""
        mock_display = MockDisplayController()

        task = asyncio.create_task(
            registration_manager.run_registration(display_controller=mock_display)
        )

        # Wait for code and reject
        await asyncio.sleep(0.2)
        code = registration_manager.registration_code
        mock_backend.reject_device(code)

        result = await task

        assert result.success is False
        assert result.rejected is True
        assert registration_manager.state == RegistrationState.REJECTED

    @pytest.mark.asyncio
    async def test_rejection_result_includes_error(
        self,
        mock_backend: MockBackendServer,
        registration_manager: RegistrationManager,
    ):
        """Test that rejection result includes meaningful error message."""
        mock_display = MockDisplayController()

        task = asyncio.create_task(
            registration_manager.run_registration(display_controller=mock_display)
        )

        await asyncio.sleep(0.2)
        code = registration_manager.registration_code
        mock_backend.reject_device(code)

        result = await task

        assert result.rejected is True
        assert result.error is not None
        assert len(result.error) > 0

    @pytest.mark.asyncio
    async def test_display_hidden_after_rejection(
        self,
        mock_backend: MockBackendServer,
        registration_manager: RegistrationManager,
    ):
        """Test that registration display is hidden after rejection."""
        mock_display = MockDisplayController()

        task = asyncio.create_task(
            registration_manager.run_registration(display_controller=mock_display)
        )

        await asyncio.sleep(0.2)
        code = registration_manager.registration_code
        mock_backend.reject_device(code)

        await task

        assert mock_display.is_showing_registration is False


class TestDeviceInAdminList:
    """Tests for device appearing in admin device list."""

    @pytest.mark.asyncio
    async def test_pending_device_in_device_list(
        self,
        mock_backend: MockBackendServer,
        registration_manager: RegistrationManager,
    ):
        """Test that pending device appears in admin device list."""
        # Request registration code
        await registration_manager._request_registration_code()

        # Get admin device list (simulate admin API call)
        import aiohttp
        async with aiohttp.ClientSession() as session:
            port = registration_manager.config.backend_url.split(":")[-1]
            url = f"http://127.0.0.1:{port}/api/display-devices/admin/devices"
            async with session.get(url) as response:
                data = await response.json()

        # Device should be in list with PENDING status
        devices = data.get("devices", [])
        assert len(devices) == 1
        assert devices[0]["status"] == "pending"
        assert devices[0]["device_type"] == "pi3d"

    @pytest.mark.asyncio
    async def test_authorized_device_in_device_list(
        self,
        mock_backend: MockBackendServer,
        registration_manager: RegistrationManager,
    ):
        """Test that authorized device appears in admin device list."""
        mock_display = MockDisplayController()

        # Complete registration
        task = asyncio.create_task(
            registration_manager.run_registration(display_controller=mock_display)
        )

        await asyncio.sleep(0.2)
        code = registration_manager.registration_code
        mock_backend.authorize_device(code)

        await task

        # Get admin device list
        import aiohttp
        async with aiohttp.ClientSession() as session:
            port = registration_manager.config.backend_url.split(":")[-1]
            url = f"http://127.0.0.1:{port}/api/display-devices/admin/devices"
            async with session.get(url) as response:
                data = await response.json()

        # Device should be in list with AUTHORIZED status
        devices = data.get("devices", [])
        assert len(devices) == 1
        assert devices[0]["status"] == "authorized"
        assert devices[0]["device_type"] == "pi3d"


class TestRegistrationTimeout:
    """Tests for registration timeout handling."""

    @pytest.mark.asyncio
    async def test_registration_timeout(self, mock_server_port, tmp_path):
        """Test that registration times out when not authorized."""
        config = RegistrationConfig(
            backend_url=f"http://127.0.0.1:{mock_server_port}",
            config_file=str(tmp_path / "config.yaml"),
            poll_interval=0.1,
            authorization_timeout=0.5,  # Very short timeout for test
            max_retries=1,
        )

        # Start mock server
        server = MockBackendServer(mock_server_port)
        await server.start()

        manager = RegistrationManager(config)
        await manager.start()

        mock_display = MockDisplayController()

        try:
            # Run registration - should timeout
            result = await manager.run_registration(display_controller=mock_display)

            assert result.success is False
            assert result.timed_out is True
            assert "timeout" in result.error.lower()
        finally:
            await manager.stop()
            await server.stop()


class TestRegistrationRetry:
    """Tests for registration retry logic."""

    @pytest.mark.asyncio
    async def test_retry_on_network_error(self, mock_server_port, tmp_path):
        """Test that registration retries on network errors."""
        config = RegistrationConfig(
            backend_url=f"http://127.0.0.1:{mock_server_port}",
            config_file=str(tmp_path / "config.yaml"),
            poll_interval=0.1,
            max_retries=3,
            retry_base_delay=0.1,
        )

        # Don't start server - simulates network error
        manager = RegistrationManager(config)
        await manager.start()

        try:
            result = await manager._request_registration_code()

            # Should fail after retries
            assert result is False
            assert manager.error is not None
            # Error should indicate network issue
            assert "error" in manager.error.lower() or "connect" in manager.error.lower()
        finally:
            await manager.stop()


class TestFullRegistrationFlow:
    """Integration tests for the complete registration flow."""

    @pytest.mark.asyncio
    async def test_complete_registration_to_slideshow_ready(
        self,
        mock_backend: MockBackendServer,
        registration_manager: RegistrationManager,
    ):
        """Test complete flow from fresh daemon to slideshow-ready state."""
        mock_display = MockDisplayController()

        # Track states
        states = []

        def on_state_change(old, new):
            states.append(new.value)

        registration_manager.add_state_callback(on_state_change)

        # Start registration
        task = asyncio.create_task(
            registration_manager.run_registration(display_controller=mock_display)
        )

        # Wait for code display
        await asyncio.sleep(0.2)

        # Verify code is being displayed
        assert mock_display.is_showing_registration is True
        code = mock_display.registration_code
        assert code is not None

        # Admin authorizes
        mock_backend.authorize_device(code, playlist_id=99)

        # Wait for completion
        result = await task

        # Verify success
        assert result.success is True
        assert result.device_token is not None

        # Verify state progression
        assert "checking" in states
        assert "requesting_code" in states
        assert "displaying_code" in states
        assert "authorized" in states
        assert "completed" in states

        # Verify display is cleared
        assert mock_display.is_showing_registration is False

    @pytest.mark.asyncio
    async def test_multiple_registration_attempts(
        self,
        mock_backend: MockBackendServer,
        registration_config: RegistrationConfig,
    ):
        """Test multiple registration attempts (e.g., after rejection)."""
        # First attempt - rejected
        manager1 = RegistrationManager(registration_config)
        await manager1.start()
        mock_display = MockDisplayController()

        task1 = asyncio.create_task(
            manager1.run_registration(display_controller=mock_display)
        )

        await asyncio.sleep(0.2)
        code1 = manager1.registration_code
        mock_backend.reject_device(code1)

        result1 = await task1
        await manager1.stop()

        assert result1.success is False
        assert result1.rejected is True

        # Second attempt - authorized
        manager2 = RegistrationManager(registration_config)
        await manager2.start()

        task2 = asyncio.create_task(
            manager2.run_registration(display_controller=mock_display)
        )

        await asyncio.sleep(0.2)
        code2 = manager2.registration_code
        # Should be a different code
        assert code2 != code1

        mock_backend.authorize_device(code2)

        result2 = await task2
        await manager2.stop()

        assert result2.success is True
        assert result2.device_token is not None

    @pytest.mark.asyncio
    async def test_registration_cancellation(
        self,
        mock_backend: MockBackendServer,
        registration_manager: RegistrationManager,
    ):
        """Test that registration can be cancelled mid-flow."""
        mock_display = MockDisplayController()

        # Start registration
        task = asyncio.create_task(
            registration_manager.run_registration(display_controller=mock_display)
        )

        # Wait for code display
        await asyncio.sleep(0.2)
        assert mock_display.is_showing_registration is True

        # Cancel
        registration_manager.cancel()

        result = await task

        assert result.success is False
        assert "cancelled" in result.error.lower()

        # Display should be hidden
        assert mock_display.is_showing_registration is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
