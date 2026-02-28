"""Tests for RegistrationManager."""

import asyncio
import json
import pytest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from glowworm_daemon.registration_manager import (
    RegistrationManager,
    RegistrationConfig,
    RegistrationState,
    RegistrationResult,
    create_registration_manager,
)


class TestRegistrationConfig:
    """Test RegistrationConfig dataclass."""

    def test_default_values(self):
        """Test default configuration values."""
        config = RegistrationConfig()

        assert config.backend_url == "http://localhost:3003"
        assert config.config_file == "/etc/glowworm/config.yaml"
        assert config.poll_interval == 5.0
        assert config.authorization_timeout == 600.0
        assert config.max_retries == 3
        assert config.retry_base_delay == 2.0
        assert config.retry_max_delay == 30.0
        assert config.device_type == "pi3d"
        assert config.daemon_version == "3.0.0"

    def test_custom_values(self):
        """Test custom configuration values."""
        config = RegistrationConfig(
            backend_url="https://example.com",
            config_file="/custom/config.yaml",
            poll_interval=10.0,
            authorization_timeout=300.0,
        )

        assert config.backend_url == "https://example.com"
        assert config.config_file == "/custom/config.yaml"
        assert config.poll_interval == 10.0
        assert config.authorization_timeout == 300.0


class TestRegistrationResult:
    """Test RegistrationResult dataclass."""

    def test_success_result(self):
        """Test successful registration result."""
        result = RegistrationResult(
            success=True,
            device_token="token-123",
        )

        assert result.success is True
        assert result.device_token == "token-123"
        assert result.error is None
        assert result.rejected is False
        assert result.timed_out is False

    def test_rejected_result(self):
        """Test rejected registration result."""
        result = RegistrationResult(
            success=False,
            error="Rejected by admin",
            rejected=True,
        )

        assert result.success is False
        assert result.rejected is True
        assert result.error == "Rejected by admin"

    def test_timeout_result(self):
        """Test timeout registration result."""
        result = RegistrationResult(
            success=False,
            error="Authorization timeout",
            timed_out=True,
        )

        assert result.success is False
        assert result.timed_out is True


class TestRegistrationManager:
    """Test RegistrationManager class."""

    def test_initialization(self):
        """Test manager initialization."""
        config = RegistrationConfig(backend_url="http://localhost:3003")
        manager = RegistrationManager(config)

        assert manager.state == RegistrationState.IDLE
        assert manager.registration_code is None
        assert manager.error is None
        assert manager.needs_registration() is True

    def test_initialization_with_token(self):
        """Test manager initialization with existing token."""
        config = RegistrationConfig()
        manager = RegistrationManager(config, existing_token="existing-token-123")

        assert manager.needs_registration() is False

    def test_initialization_with_empty_token(self):
        """Test manager initialization with empty token."""
        config = RegistrationConfig()
        manager = RegistrationManager(config, existing_token="")

        assert manager.needs_registration() is True

    def test_initialization_with_whitespace_token(self):
        """Test manager initialization with whitespace-only token."""
        config = RegistrationConfig()
        manager = RegistrationManager(config, existing_token="   ")

        assert manager.needs_registration() is True

    def test_state_callback(self):
        """Test state change callback."""
        config = RegistrationConfig()
        manager = RegistrationManager(config)

        states = []

        def on_state_change(old, new):
            states.append((old, new))

        manager.add_state_callback(on_state_change)
        manager._set_state(RegistrationState.CHECKING)

        assert len(states) == 1
        assert states[0] == (RegistrationState.IDLE, RegistrationState.CHECKING)

    def test_state_callback_no_duplicate(self):
        """Test state callback doesn't fire for same state."""
        config = RegistrationConfig()
        manager = RegistrationManager(config)

        states = []

        def on_state_change(old, new):
            states.append((old, new))

        manager.add_state_callback(on_state_change)
        manager._set_state(RegistrationState.CHECKING)
        manager._set_state(RegistrationState.CHECKING)  # Same state again

        assert len(states) == 1

    def test_cancel(self):
        """Test registration cancellation."""
        config = RegistrationConfig()
        manager = RegistrationManager(config)

        manager.cancel()
        assert manager._stop_requested is True


class TestRegistrationManagerAsync:
    """Async tests for RegistrationManager."""

    @pytest.fixture
    def config(self, tmp_path):
        """Create test configuration."""
        config_file = tmp_path / "config.yaml"
        return RegistrationConfig(
            backend_url="http://localhost:3003",
            config_file=str(config_file),
            poll_interval=0.1,  # Fast polling for tests
            authorization_timeout=5.0,
            max_retries=1,
            retry_base_delay=0.1,
        )

    @pytest.fixture
    def manager(self, config):
        """Create test manager."""
        return RegistrationManager(config)

    @pytest.mark.asyncio
    async def test_context_manager(self, manager):
        """Test async context manager."""
        async with manager:
            assert manager._session is not None

        assert manager._session is None

    @pytest.mark.asyncio
    async def test_start_stop(self, manager):
        """Test start and stop."""
        await manager.start()
        assert manager._session is not None

        await manager.stop()
        assert manager._session is None

    @pytest.mark.asyncio
    async def test_request_registration_code_success(self, manager):
        """Test successful registration code request."""
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            "code": "ABCD",
            "device_id": 123,
        })

        mock_session = MagicMock()
        mock_session.post = MagicMock(return_value=AsyncContextManager(mock_response))
        mock_session.close = AsyncMock()

        await manager.start()
        manager._session = mock_session
        result = await manager._request_registration_code()
        await manager.stop()

        assert result is True
        assert manager._registration_code == "ABCD"
        assert manager._registration_id == 123

    @pytest.mark.asyncio
    async def test_request_registration_code_alternative_fields(self, manager):
        """Test registration code with alternative field names."""
        mock_response = MagicMock()
        mock_response.status = 201
        mock_response.json = AsyncMock(return_value={
            "registration_code": "WXYZ",
            "id": 456,
        })

        mock_session = MagicMock()
        mock_session.post = MagicMock(return_value=AsyncContextManager(mock_response))
        mock_session.close = AsyncMock()

        await manager.start()
        manager._session = mock_session
        result = await manager._request_registration_code()
        await manager.stop()

        assert result is True
        assert manager._registration_code == "WXYZ"
        assert manager._registration_id == 456

    @pytest.mark.asyncio
    async def test_request_registration_code_failure(self, manager):
        """Test failed registration code request."""
        mock_response = MagicMock()
        mock_response.status = 500
        mock_response.text = AsyncMock(return_value="Server error")

        mock_session = MagicMock()
        mock_session.post = MagicMock(return_value=AsyncContextManager(mock_response))
        mock_session.close = AsyncMock()

        await manager.start()
        manager._session = mock_session
        result = await manager._request_registration_code()
        await manager.stop()

        assert result is False
        assert manager.error is not None
        assert "500" in manager.error

    @pytest.mark.asyncio
    async def test_poll_for_authorization_success(self, manager):
        """Test successful authorization polling."""
        manager._registration_code = "ABCD"

        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            "status": "AUTHORIZED",
            "device_token": "new-token-123",
        })

        mock_session = MagicMock()
        mock_session.get = MagicMock(return_value=AsyncContextManager(mock_response))
        mock_session.close = AsyncMock()

        await manager.start()
        manager._session = mock_session
        result = await manager._poll_for_authorization()
        await manager.stop()

        assert result.success is True
        assert result.device_token == "new-token-123"

    @pytest.mark.asyncio
    async def test_poll_for_authorization_alternative_token_field(self, manager):
        """Test authorization with alternative token field name."""
        manager._registration_code = "ABCD"

        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            "status": "AUTHORIZED",
            "token": "alt-token-456",
        })

        mock_session = MagicMock()
        mock_session.get = MagicMock(return_value=AsyncContextManager(mock_response))
        mock_session.close = AsyncMock()

        await manager.start()
        manager._session = mock_session
        result = await manager._poll_for_authorization()
        await manager.stop()

        assert result.success is True
        assert result.device_token == "alt-token-456"

    @pytest.mark.asyncio
    async def test_poll_for_authorization_rejected(self, manager):
        """Test rejected authorization."""
        manager._registration_code = "ABCD"

        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            "status": "REJECTED",
        })

        mock_session = MagicMock()
        mock_session.get = MagicMock(return_value=AsyncContextManager(mock_response))
        mock_session.close = AsyncMock()

        await manager.start()
        manager._session = mock_session
        result = await manager._poll_for_authorization()
        await manager.stop()

        assert result.success is False
        assert result.rejected is True

    @pytest.mark.asyncio
    async def test_poll_for_authorization_pending_then_authorized(self, manager):
        """Test pending status followed by authorization."""
        manager._registration_code = "ABCD"

        call_count = [0]

        async def mock_json():
            call_count[0] += 1
            if call_count[0] < 3:
                return {"status": "PENDING"}
            return {"status": "AUTHORIZED", "device_token": "token-123"}

        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.json = mock_json

        mock_session = MagicMock()
        mock_session.get = MagicMock(return_value=AsyncContextManager(mock_response))
        mock_session.close = AsyncMock()

        await manager.start()
        manager._session = mock_session
        result = await manager._poll_for_authorization()
        await manager.stop()

        assert result.success is True
        assert result.device_token == "token-123"
        assert call_count[0] >= 3

    @pytest.mark.asyncio
    async def test_poll_for_authorization_timeout(self, config, tmp_path):
        """Test authorization timeout."""
        config.authorization_timeout = 0.3  # Very short timeout
        config.poll_interval = 0.1
        manager = RegistrationManager(config)
        manager._registration_code = "ABCD"

        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={"status": "PENDING"})

        mock_session = MagicMock()
        mock_session.get = MagicMock(return_value=AsyncContextManager(mock_response))
        mock_session.close = AsyncMock()

        await manager.start()
        manager._session = mock_session
        result = await manager._poll_for_authorization()
        await manager.stop()

        assert result.success is False
        assert result.timed_out is True

    @pytest.mark.asyncio
    async def test_poll_for_authorization_code_expired(self, manager):
        """Test expired registration code."""
        manager._registration_code = "ABCD"

        mock_response = MagicMock()
        mock_response.status = 404

        mock_session = MagicMock()
        mock_session.get = MagicMock(return_value=AsyncContextManager(mock_response))
        mock_session.close = AsyncMock()

        await manager.start()
        manager._session = mock_session
        result = await manager._poll_for_authorization()
        await manager.stop()

        assert result.success is False
        assert "expired" in result.error.lower()

    @pytest.mark.asyncio
    async def test_poll_for_authorization_no_code(self, manager):
        """Test polling without registration code."""
        manager._registration_code = None

        async with manager:
            result = await manager._poll_for_authorization()

        assert result.success is False
        assert result.error is not None

    @pytest.mark.asyncio
    async def test_poll_for_authorization_cancelled(self, manager):
        """Test polling cancellation."""
        manager._registration_code = "ABCD"

        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={"status": "PENDING"})

        mock_session = MagicMock()
        mock_session.get = MagicMock(return_value=AsyncContextManager(mock_response))
        mock_session.close = AsyncMock()

        await manager.start()
        manager._session = mock_session
        manager._stop_requested = True  # Cancel before polling
        result = await manager._poll_for_authorization()
        await manager.stop()

        assert result.success is False
        assert "cancelled" in result.error.lower()

    @pytest.mark.asyncio
    async def test_save_token(self, manager, config, tmp_path):
        """Test token saving to config file."""
        async with manager:
            result = await manager._save_token("test-token-123")

        assert result is True

        # Verify token was saved
        import yaml
        with open(config.config_file, "r") as f:
            saved_config = yaml.safe_load(f)

        assert saved_config["backend"]["device_token"] == "test-token-123"

    @pytest.mark.asyncio
    async def test_save_token_updates_existing_config(self, manager, config, tmp_path):
        """Test token saving preserves existing config."""
        # Create existing config
        import yaml
        existing = {
            "backend": {"url": "https://example.com"},
            "display": {"orientation": "portrait"},
        }
        with open(config.config_file, "w") as f:
            yaml.dump(existing, f)

        async with manager:
            result = await manager._save_token("new-token-456")

        assert result is True

        # Verify existing settings preserved
        with open(config.config_file, "r") as f:
            saved_config = yaml.safe_load(f)

        assert saved_config["backend"]["device_token"] == "new-token-456"
        assert saved_config["backend"]["url"] == "https://example.com"
        assert saved_config["display"]["orientation"] == "portrait"

    @pytest.mark.asyncio
    async def test_run_registration_success(self, manager, config):
        """Test full registration flow success."""
        # Mock responses
        mock_code_response = MagicMock()
        mock_code_response.status = 200
        mock_code_response.json = AsyncMock(return_value={
            "code": "TEST",
            "device_id": 99,
        })

        mock_auth_response = MagicMock()
        mock_auth_response.status = 200
        mock_auth_response.json = AsyncMock(return_value={
            "status": "AUTHORIZED",
            "device_token": "final-token-789",
        })

        mock_session = MagicMock()
        mock_session.post = MagicMock(return_value=AsyncContextManager(mock_code_response))
        mock_session.get = MagicMock(return_value=AsyncContextManager(mock_auth_response))
        mock_session.close = AsyncMock()

        # Mock display controller
        mock_display = AsyncMock()
        mock_display.show_registration = AsyncMock(return_value=True)
        mock_display.hide_registration = AsyncMock(return_value=True)

        await manager.start()
        manager._session = mock_session
        result = await manager.run_registration(display_controller=mock_display)
        await manager.stop()

        assert result.success is True
        assert result.device_token == "final-token-789"
        assert manager.state == RegistrationState.COMPLETED

        # Verify display was updated
        mock_display.show_registration.assert_called_once_with("TEST")
        mock_display.hide_registration.assert_called_once()

    @pytest.mark.asyncio
    async def test_run_registration_no_display(self, manager):
        """Test registration without display controller."""
        # Mock responses
        mock_code_response = MagicMock()
        mock_code_response.status = 200
        mock_code_response.json = AsyncMock(return_value={
            "code": "TEST",
            "device_id": 99,
        })

        mock_auth_response = MagicMock()
        mock_auth_response.status = 200
        mock_auth_response.json = AsyncMock(return_value={
            "status": "AUTHORIZED",
            "device_token": "token-no-display",
        })

        mock_session = MagicMock()
        mock_session.post = MagicMock(return_value=AsyncContextManager(mock_code_response))
        mock_session.get = MagicMock(return_value=AsyncContextManager(mock_auth_response))
        mock_session.close = AsyncMock()

        await manager.start()
        manager._session = mock_session
        result = await manager.run_registration(display_controller=None)
        await manager.stop()

        assert result.success is True
        assert result.device_token == "token-no-display"

    @pytest.mark.asyncio
    async def test_run_registration_rejected(self, manager):
        """Test registration flow rejection."""
        # Mock responses
        mock_code_response = MagicMock()
        mock_code_response.status = 200
        mock_code_response.json = AsyncMock(return_value={
            "code": "TEST",
            "device_id": 99,
        })

        mock_auth_response = MagicMock()
        mock_auth_response.status = 200
        mock_auth_response.json = AsyncMock(return_value={
            "status": "REJECTED",
        })

        mock_session = MagicMock()
        mock_session.post = MagicMock(return_value=AsyncContextManager(mock_code_response))
        mock_session.get = MagicMock(return_value=AsyncContextManager(mock_auth_response))
        mock_session.close = AsyncMock()

        await manager.start()
        manager._session = mock_session
        result = await manager.run_registration()
        await manager.stop()

        assert result.success is False
        assert result.rejected is True
        assert manager.state == RegistrationState.REJECTED

    @pytest.mark.asyncio
    async def test_run_registration_code_failure(self, manager):
        """Test registration flow when code request fails."""
        mock_response = MagicMock()
        mock_response.status = 500
        mock_response.text = AsyncMock(return_value="Server error")

        mock_session = MagicMock()
        mock_session.post = MagicMock(return_value=AsyncContextManager(mock_response))
        mock_session.close = AsyncMock()

        await manager.start()
        manager._session = mock_session
        result = await manager.run_registration()
        await manager.stop()

        assert result.success is False
        assert manager.state == RegistrationState.ERROR


class TestFactoryFunction:
    """Test factory function."""

    def test_create_registration_manager(self):
        """Test factory function creates manager with correct settings."""
        manager = create_registration_manager(
            backend_url="https://custom.example.com",
            config_file="/custom/path/config.yaml",
            existing_token="existing-token",
            poll_interval=15.0,
        )

        assert manager.config.backend_url == "https://custom.example.com"
        assert manager.config.config_file == "/custom/path/config.yaml"
        assert manager.config.poll_interval == 15.0
        assert manager.needs_registration() is False


# Helper class for async context manager mocking
class AsyncContextManager:
    """Helper for mocking async context managers."""

    def __init__(self, return_value):
        self.return_value = return_value

    async def __aenter__(self):
        return self.return_value

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass
