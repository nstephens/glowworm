"""
Pi3D Daemon Device Registration API endpoints.

Handles device registration flow for Pi3D daemon devices:
1. POST /api/devices/register - Request registration code
2. GET /api/devices/register/{code}/status - Poll for authorization status

This is separate from the browser-based registration in display_devices.py
which uses cookies for session management.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime, timedelta
import logging
import secrets
import string

from models.database import get_db
from models.display_device import DisplayDevice, DeviceStatus
from services.display_device_service import DisplayDeviceService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/devices", tags=["device-registration"])


# ============================================================================
# Pydantic Models
# ============================================================================


class DaemonRegistrationRequest(BaseModel):
    """Request to register a new Pi3D daemon device."""
    device_type: str = Field(
        default="pi3d",
        description="Device type (pi3d, browser)",
    )
    daemon_version: str = Field(
        default="3.0.0",
        description="Daemon version string",
    )
    capabilities: Dict[str, bool] = Field(
        default_factory=lambda: {
            "pi3d_display": True,
            "websocket": True,
            "cec_control": False,
        },
        description="Device capabilities",
    )


class DaemonRegistrationResponse(BaseModel):
    """Response with registration code for display."""
    code: str = Field(..., description="4-character registration code")
    device_id: int = Field(..., description="Device ID in database")
    expires_at: str = Field(..., description="When registration code expires")
    message: str = Field(default="Display this code on your device")


class RegistrationStatusResponse(BaseModel):
    """Response for polling registration status."""
    status: str = Field(
        ...,
        description="Registration status: PENDING, AUTHORIZED, REJECTED, EXPIRED",
    )
    device_token: Optional[str] = Field(
        None,
        description="Device token (only present when AUTHORIZED)",
    )
    device_id: Optional[int] = Field(
        None,
        description="Device ID (present when AUTHORIZED)",
    )
    playlist_id: Optional[int] = Field(
        None,
        description="Assigned playlist ID (present when AUTHORIZED)",
    )
    message: str = Field(
        default="",
        description="Human-readable status message",
    )


# ============================================================================
# Helper Functions
# ============================================================================


def generate_registration_code() -> str:
    """
    Generate a 4-character alphanumeric registration code.

    Uses uppercase letters and digits for easy reading on display.
    Excludes visually ambiguous characters (0, O, I, 1, L).
    """
    # Exclude visually ambiguous characters
    alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
    return ''.join(secrets.choice(alphabet) for _ in range(4))


# ============================================================================
# API Endpoints
# ============================================================================


@router.post("/register", response_model=DaemonRegistrationResponse)
async def register_daemon_device(
    request: Request,
    registration_data: DaemonRegistrationRequest,
    db: Session = Depends(get_db),
):
    """
    Register a new Pi3D daemon device.

    This endpoint is called by the daemon when it starts without a device token.
    It creates a pending device record and returns a 4-character registration
    code that should be displayed on the Pi3D screen for admin authorization.

    The daemon should then poll GET /api/devices/register/{code}/status
    to check for authorization.
    """
    try:
        # Get client IP
        client_ip = request.client.host if request.client else None

        # Generate registration code (used for authorization lookup)
        registration_code = generate_registration_code()

        # Check for code collision (very unlikely but be safe)
        max_attempts = 10
        for _ in range(max_attempts):
            existing = db.query(DisplayDevice).filter(
                DisplayDevice.device_token == registration_code,
                DisplayDevice.status == DeviceStatus.PENDING,
            ).first()

            if not existing:
                break
            registration_code = generate_registration_code()

        # Calculate expiry (30 minutes from now)
        expires_at = datetime.utcnow() + timedelta(minutes=30)

        # Create device record with registration code as token
        # The token will be replaced with a proper one on authorization
        device = DisplayDevice(
            device_token=registration_code,
            status=DeviceStatus.PENDING,
            ip_address=client_ip,
            user_agent=f"Pi3D Daemon {registration_data.daemon_version}",
            device_type=registration_data.device_type,
            last_seen=datetime.utcnow(),
        )

        db.add(device)
        db.commit()
        db.refresh(device)

        logger.info(
            f"Pi3D daemon registration started: code={registration_code}, "
            f"device_id={device.id}, ip={client_ip}, version={registration_data.daemon_version}"
        )

        return DaemonRegistrationResponse(
            code=registration_code,
            device_id=device.id,
            expires_at=expires_at.isoformat(),
            message="Display this code on your device and authorize via admin panel",
        )

    except Exception as e:
        logger.error(f"Daemon registration failed: {e}")
        raise HTTPException(status_code=500, detail="Device registration failed")


@router.get("/register/{code}/status", response_model=RegistrationStatusResponse)
async def get_registration_status(
    code: str,
    db: Session = Depends(get_db),
):
    """
    Poll for registration authorization status.

    The daemon calls this endpoint to check if the admin has authorized
    the device registration. Returns the device token when authorized.

    Status values:
    - PENDING: Waiting for admin authorization
    - AUTHORIZED: Admin approved, device_token is returned
    - REJECTED: Admin rejected the registration
    - EXPIRED: Registration code has expired (30 minutes)
    """
    # Normalize code to uppercase
    code = code.upper().strip()

    if len(code) != 4:
        raise HTTPException(
            status_code=400,
            detail="Invalid registration code format",
        )

    # Find device by registration code
    device = db.query(DisplayDevice).filter(
        DisplayDevice.device_token == code,
    ).first()

    # Also check if device was authorized and token was replaced
    if not device:
        # Check if there's a device with this code that was already authorized
        # This happens when device was authorized but daemon hasn't received the new token yet
        # We need to search by the old registration code pattern
        # Actually, we can't do this reliably - just return not found
        raise HTTPException(
            status_code=404,
            detail="Registration code not found or expired",
        )

    # Check for expiration (30 minutes after creation)
    if device.status == DeviceStatus.PENDING:
        age = datetime.utcnow() - device.created_at.replace(tzinfo=None)
        if age > timedelta(minutes=30):
            logger.info(f"Registration code {code} expired")
            return RegistrationStatusResponse(
                status="EXPIRED",
                message="Registration code has expired. Please restart registration.",
            )

    # Update last seen
    device.last_seen = datetime.utcnow()
    db.commit()

    if device.status == DeviceStatus.PENDING:
        return RegistrationStatusResponse(
            status="PENDING",
            message="Waiting for admin authorization",
        )

    elif device.status == DeviceStatus.AUTHORIZED:
        logger.info(f"Registration {code} authorized, returning token to daemon")
        return RegistrationStatusResponse(
            status="AUTHORIZED",
            device_token=device.device_token,
            device_id=device.id,
            playlist_id=device.playlist_id,
            message="Device authorized successfully",
        )

    elif device.status == DeviceStatus.REJECTED:
        logger.info(f"Registration {code} was rejected")
        return RegistrationStatusResponse(
            status="REJECTED",
            message="Device registration was rejected by administrator",
        )

    else:
        # Unknown status
        return RegistrationStatusResponse(
            status="PENDING",
            message="Unknown status, please retry",
        )


@router.post("/register/{code}/authorize")
async def authorize_registration(
    code: str,
    db: Session = Depends(get_db),
):
    """
    Authorize a pending device registration.

    This is an internal endpoint called when admin authorizes a device.
    It generates a permanent device token and marks the device as authorized.

    Note: The main authorization flow goes through the admin API at
    /api/display-devices/admin/devices/{device_id}/authorize
    This endpoint is provided as an alternative for direct code authorization.
    """
    # Normalize code
    code = code.upper().strip()

    # Find pending device
    device = db.query(DisplayDevice).filter(
        DisplayDevice.device_token == code,
        DisplayDevice.status == DeviceStatus.PENDING,
    ).first()

    if not device:
        raise HTTPException(
            status_code=404,
            detail="Pending registration not found",
        )

    # Generate permanent device token
    permanent_token = ''.join(
        secrets.choice(string.ascii_uppercase + string.digits)
        for _ in range(32)
    )

    # Update device
    device.device_token = permanent_token
    device.status = DeviceStatus.AUTHORIZED
    device.authorized_at = datetime.utcnow()

    db.commit()
    db.refresh(device)

    logger.info(
        f"Registration {code} authorized: device_id={device.id}, "
        f"new_token={permanent_token[:8]}..."
    )

    return {
        "status": "authorized",
        "device_id": device.id,
        "device_token": permanent_token,
        "message": "Device authorized successfully",
    }
