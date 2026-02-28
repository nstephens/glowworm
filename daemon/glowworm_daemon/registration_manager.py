"""
Registration Manager for GlowWorm Daemon.

Handles device registration flow:
1. Detect missing device token in config
2. Request registration code from backend
3. Display code via Pi3D display engine
4. Poll backend for authorization status
5. Save token and switch to normal mode on authorization
6. Handle registration rejection
"""

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Optional

import aiohttp

logger = logging.getLogger(__name__)


class RegistrationState(str, Enum):
    """State of the registration process."""

    IDLE = "idle"
    CHECKING = "checking"  # Checking if registration is needed
    REQUESTING_CODE = "requesting_code"  # Requesting registration code from backend
    DISPLAYING_CODE = "displaying_code"  # Showing code on display, polling for authorization
    AUTHORIZED = "authorized"  # Device has been authorized
    REJECTED = "rejected"  # Device was rejected
    ERROR = "error"  # Registration error occurred
    COMPLETED = "completed"  # Registration completed, token saved


@dataclass
class RegistrationConfig:
    """Configuration for the registration manager."""

    # Backend URL (base URL for API calls)
    backend_url: str = "http://localhost:3003"

    # Path to config file where token should be saved
    config_file: str = "/etc/glowworm/config.yaml"

    # Polling interval in seconds when waiting for authorization
    poll_interval: float = 5.0

    # Maximum time to wait for authorization (in seconds)
    authorization_timeout: float = 600.0  # 10 minutes

    # Number of retries for API requests
    max_retries: int = 3

    # Retry delay base (exponential backoff)
    retry_base_delay: float = 2.0

    # Maximum retry delay
    retry_max_delay: float = 30.0

    # Device info to send during registration
    device_type: str = "pi3d"
    daemon_version: str = "3.0.0"


@dataclass
class RegistrationResult:
    """Result of a registration attempt."""

    success: bool
    device_token: Optional[str] = None
    error: Optional[str] = None
    rejected: bool = False
    timed_out: bool = False


# Type for state change callback
StateChangeCallback = Callable[[RegistrationState, RegistrationState], None]


class RegistrationManager:
    """
    Manages device registration flow for GlowWorm daemon.

    The registration flow is:
    1. Check if device token exists in config
    2. If no token, request registration code from backend
    3. Display code on Pi3D display using DisplayController
    4. Poll backend for authorization status
    5. On authorization: save token to config file
    6. On rejection: notify and optionally retry

    Usage:
        manager = RegistrationManager(config)

        if manager.needs_registration():
            result = await manager.run_registration(display_controller)
            if result.success:
                # Token saved, proceed to normal operation
                pass
    """

    def __init__(
        self,
        config: RegistrationConfig,
        existing_token: Optional[str] = None,
    ) -> None:
        """
        Initialize the registration manager.

        Args:
            config: Registration configuration
            existing_token: Current device token (if any)
        """
        self.config = config
        self._token = existing_token
        self._state = RegistrationState.IDLE
        self._registration_code: Optional[str] = None
        self._registration_id: Optional[int] = None
        self._error: Optional[str] = None
        self._session: Optional[aiohttp.ClientSession] = None
        self._state_callbacks: list[StateChangeCallback] = []
        self._stop_requested = False

        logger.info(
            f"RegistrationManager initialized: "
            f"backend={config.backend_url}, "
            f"has_token={bool(existing_token)}"
        )

    @property
    def state(self) -> RegistrationState:
        """Get current registration state."""
        return self._state

    @property
    def registration_code(self) -> Optional[str]:
        """Get current registration code."""
        return self._registration_code

    @property
    def error(self) -> Optional[str]:
        """Get last error message."""
        return self._error

    def add_state_callback(self, callback: StateChangeCallback) -> None:
        """Add a callback for state changes."""
        self._state_callbacks.append(callback)

    def _set_state(self, new_state: RegistrationState) -> None:
        """Set state and notify callbacks."""
        if new_state == self._state:
            return

        old_state = self._state
        self._state = new_state
        logger.info(f"Registration state: {old_state.value} -> {new_state.value}")

        for callback in self._state_callbacks:
            try:
                callback(old_state, new_state)
            except Exception as e:
                logger.warning(f"State callback error: {e}")

    def needs_registration(self) -> bool:
        """
        Check if device registration is needed.

        Returns:
            True if no valid token exists
        """
        return not self._token or len(self._token.strip()) == 0

    async def start(self) -> None:
        """Start the registration manager (initialize HTTP session)."""
        if not self._session:
            self._session = aiohttp.ClientSession()
            logger.debug("Registration manager HTTP session started")

    async def stop(self) -> None:
        """Stop the registration manager."""
        self._stop_requested = True
        if self._session:
            await self._session.close()
            self._session = None
        logger.debug("Registration manager stopped")

    async def __aenter__(self) -> "RegistrationManager":
        """Context manager entry."""
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Context manager exit."""
        await self.stop()

    async def run_registration(
        self,
        display_controller: Optional[Any] = None,
    ) -> RegistrationResult:
        """
        Run the full registration flow.

        Args:
            display_controller: DisplayController instance for showing registration code

        Returns:
            RegistrationResult with success status and token
        """
        self._stop_requested = False
        self._error = None

        try:
            self._set_state(RegistrationState.CHECKING)

            # Ensure session is started
            if not self._session:
                await self.start()

            # Step 1: Request registration code
            self._set_state(RegistrationState.REQUESTING_CODE)
            code_result = await self._request_registration_code()

            if not code_result:
                self._set_state(RegistrationState.ERROR)
                return RegistrationResult(
                    success=False,
                    error=self._error or "Failed to get registration code"
                )

            # Step 2: Display code on Pi3D
            self._set_state(RegistrationState.DISPLAYING_CODE)

            if display_controller:
                success = await display_controller.show_registration(self._registration_code)
                if not success:
                    logger.warning("Failed to display registration code on display")
            else:
                logger.info(f"Registration code: {self._registration_code}")
                logger.info("(No display controller provided - code logged only)")

            # Step 3: Poll for authorization
            result = await self._poll_for_authorization()

            # Step 4: Hide registration display
            if display_controller:
                await display_controller.hide_registration()

            if result.success:
                self._set_state(RegistrationState.AUTHORIZED)

                # Step 5: Save token to config
                if result.device_token:
                    await self._save_token(result.device_token)
                    self._token = result.device_token

                self._set_state(RegistrationState.COMPLETED)
            elif result.rejected:
                self._set_state(RegistrationState.REJECTED)
            else:
                self._set_state(RegistrationState.ERROR)

            return result

        except Exception as e:
            logger.error(f"Registration error: {e}")
            self._error = str(e)
            self._set_state(RegistrationState.ERROR)
            return RegistrationResult(success=False, error=str(e))

    async def _request_registration_code(self) -> bool:
        """
        Request a registration code from the backend.

        Returns:
            True if successful, False otherwise
        """
        url = f"{self.config.backend_url}/api/devices/register"

        payload = {
            "device_type": self.config.device_type,
            "daemon_version": self.config.daemon_version,
            "capabilities": {
                "pi3d_display": True,
                "websocket": True,
                "cec_control": False,  # Will be updated after registration
            },
        }

        for attempt in range(self.config.max_retries):
            try:
                logger.info(f"Requesting registration code (attempt {attempt + 1})")

                async with self._session.post(
                    url,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=30),
                ) as response:
                    if response.status == 200 or response.status == 201:
                        data = await response.json()
                        self._registration_code = data.get("code") or data.get("registration_code")
                        self._registration_id = data.get("device_id") or data.get("id")

                        if self._registration_code:
                            logger.info(f"Got registration code: {self._registration_code}")
                            return True
                        else:
                            self._error = "No registration code in response"
                            logger.error(self._error)
                    else:
                        body = await response.text()
                        self._error = f"Backend returned {response.status}: {body[:200]}"
                        logger.warning(self._error)

            except aiohttp.ClientError as e:
                self._error = f"Network error: {e}"
                logger.warning(f"Request failed (attempt {attempt + 1}): {e}")
            except Exception as e:
                self._error = f"Unexpected error: {e}"
                logger.error(f"Request failed (attempt {attempt + 1}): {e}")

            # Wait before retry
            if attempt < self.config.max_retries - 1:
                delay = min(
                    self.config.retry_base_delay * (2 ** attempt),
                    self.config.retry_max_delay,
                )
                logger.info(f"Retrying in {delay:.1f}s...")
                await asyncio.sleep(delay)

        return False

    async def _poll_for_authorization(self) -> RegistrationResult:
        """
        Poll the backend for authorization status.

        Returns:
            RegistrationResult with outcome
        """
        if not self._registration_code:
            return RegistrationResult(
                success=False,
                error="No registration code to poll for"
            )

        url = f"{self.config.backend_url}/api/devices/register/{self._registration_code}/status"
        start_time = time.time()

        while not self._stop_requested:
            # Check timeout
            elapsed = time.time() - start_time
            if elapsed > self.config.authorization_timeout:
                logger.warning("Authorization timeout")
                return RegistrationResult(
                    success=False,
                    error="Authorization timeout",
                    timed_out=True,
                )

            try:
                async with self._session.get(
                    url,
                    timeout=aiohttp.ClientTimeout(total=30),
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        status = data.get("status", "").upper()

                        if status == "AUTHORIZED":
                            device_token = data.get("device_token") or data.get("token")

                            if device_token:
                                logger.info("Device authorized!")
                                return RegistrationResult(
                                    success=True,
                                    device_token=device_token,
                                )
                            else:
                                logger.warning("Authorized but no token in response")

                        elif status == "REJECTED":
                            logger.warning("Device registration rejected")
                            return RegistrationResult(
                                success=False,
                                error="Registration rejected by administrator",
                                rejected=True,
                            )

                        elif status == "PENDING":
                            # Still waiting, continue polling
                            logger.debug(f"Still pending... ({elapsed:.0f}s elapsed)")

                        else:
                            logger.debug(f"Unknown status: {status}")

                    elif response.status == 404:
                        # Registration code expired or invalid
                        return RegistrationResult(
                            success=False,
                            error="Registration code expired or invalid",
                        )

                    else:
                        body = await response.text()
                        logger.warning(f"Poll returned {response.status}: {body[:200]}")

            except aiohttp.ClientError as e:
                logger.warning(f"Poll network error: {e}")
            except Exception as e:
                logger.error(f"Poll error: {e}")

            # Wait before next poll
            await asyncio.sleep(self.config.poll_interval)

        # Stop was requested
        return RegistrationResult(
            success=False,
            error="Registration cancelled",
        )

    async def _save_token(self, token: str) -> bool:
        """
        Save the device token to config file.

        Args:
            token: Device token to save

        Returns:
            True if saved successfully
        """
        config_path = Path(self.config.config_file)

        try:
            # Ensure directory exists
            config_path.parent.mkdir(parents=True, exist_ok=True)

            # Load existing config if present
            config_data = {}
            if config_path.exists():
                import yaml
                with open(config_path, "r") as f:
                    config_data = yaml.safe_load(f) or {}

            # Update device token
            if "backend" not in config_data:
                config_data["backend"] = {}
            config_data["backend"]["device_token"] = token

            # Write config
            import yaml
            with open(config_path, "w") as f:
                yaml.dump(config_data, f, default_flow_style=False, sort_keys=False)

            logger.info(f"Device token saved to {config_path}")
            return True

        except Exception as e:
            logger.error(f"Failed to save token to {config_path}: {e}")
            return False

    def cancel(self) -> None:
        """Cancel ongoing registration."""
        self._stop_requested = True
        logger.info("Registration cancelled")


def create_registration_manager(
    backend_url: str,
    config_file: str = "/etc/glowworm/config.yaml",
    existing_token: Optional[str] = None,
    poll_interval: float = 5.0,
) -> RegistrationManager:
    """
    Create a registration manager with common settings.

    Args:
        backend_url: Backend URL for API calls
        config_file: Path to config file for saving token
        existing_token: Current device token (if any)
        poll_interval: Polling interval when waiting for authorization

    Returns:
        RegistrationManager instance
    """
    config = RegistrationConfig(
        backend_url=backend_url,
        config_file=config_file,
        poll_interval=poll_interval,
    )
    return RegistrationManager(config, existing_token)
