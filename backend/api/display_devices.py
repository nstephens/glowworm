from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import logging

from models.database import get_db
from models.display_device import DisplayDevice, DeviceStatus
from models.user import User
from services.display_device_service import DisplayDeviceService
from utils.middleware import require_admin, get_current_user
from utils.cookies import cookie_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/display-devices", tags=["display-devices"])

# Pydantic models for request/response
class DeviceRegistrationRequest(BaseModel):
    user_agent: Optional[str] = None

class DeviceRegistrationResponse(BaseModel):
    device_token: str
    status: str
    message: str

class DeviceAuthorizationRequest(BaseModel):
    device_name: Optional[str] = None
    device_identifier: Optional[str] = None

class DeviceUpdateRequest(BaseModel):
    device_name: Optional[str] = None
    device_identifier: Optional[str] = None

class DeviceResponse(BaseModel):
    id: int
    device_token: str
    device_name: Optional[str]
    device_identifier: Optional[str]
    status: str
    playlist_id: Optional[int]
    playlist_name: Optional[str]
    authorized_at: Optional[str]
    last_seen: str
    created_at: str
    updated_at: str

    @classmethod
    def from_device(cls, device: DisplayDevice) -> "DeviceResponse":
        return cls(**device.to_dict())

# Display device endpoints (no auth required for registration)
@router.post("/register", response_model=DeviceRegistrationResponse)
async def register_device(
    request: Request,
    response: Response,
    registration_data: DeviceRegistrationRequest,
    db: Session = Depends(get_db)
):
    """Register a new display device"""
    try:
        service = DisplayDeviceService(db)
        
        # Get client IP
        client_ip = request.client.host if request.client else None
        
        # Register the device
        device = service.register_device(
            user_agent=registration_data.user_agent,
            ip_address=client_ip
        )
        
        # Set device token cookie
        cookie_manager.set_display_device_cookie(response, device.device_token)
        
        logger.info(f"Device registered: {device.device_token[:8]}...")
        
        return DeviceRegistrationResponse(
            device_token=device.device_token,
            status=device.status.value,
            message="Device registered successfully. Waiting for authorization."
        )
        
    except Exception as e:
        logger.error(f"Device registration failed: {e}")
        raise HTTPException(status_code=500, detail="Device registration failed")

@router.get("/status", response_model=DeviceResponse)
async def get_device_status(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """Get the current device's status"""
    try:
        # Get device token from cookie
        device_token = cookie_manager.get_display_device_cookie(request)
        if not device_token:
            raise HTTPException(status_code=401, detail="Device not registered")
        
        service = DisplayDeviceService(db)
        device = service.get_device_by_token(device_token)
        
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        
        # Update last seen
        service.update_device_last_seen(device_token)
        
        # For authorized devices, ensure the cookie is properly set to maintain authentication
        if device.status.value == 'authorized':
            cookie_manager.set_display_device_cookie(response, device.device_token)
        
        return DeviceResponse.from_device(device)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get device status failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to get device status")

# Admin endpoints (require admin authentication)
@router.get("/admin/devices", response_model=List[DeviceResponse])
async def get_all_devices(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get all display devices (admin only)"""
    try:
        service = DisplayDeviceService(db)
        devices = service.get_all_devices()
        
        return [DeviceResponse.from_device(device) for device in devices]
        
    except Exception as e:
        logger.error(f"Get all devices failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to get devices")

@router.get("/admin/devices/pending", response_model=List[DeviceResponse])
async def get_pending_devices(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get pending devices awaiting authorization (admin only)"""
    try:
        service = DisplayDeviceService(db)
        devices = service.get_pending_devices()
        
        return [DeviceResponse.from_device(device) for device in devices]
        
    except Exception as e:
        logger.error(f"Get pending devices failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to get pending devices")

@router.post("/admin/devices/{device_id}/authorize")
async def authorize_device(
    device_id: int,
    auth_data: DeviceAuthorizationRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Authorize a display device (admin only)"""
    try:
        service = DisplayDeviceService(db)
        device = service.authorize_device(
            device_id=device_id,
            authorized_by_user=current_user,
            device_name=auth_data.device_name,
            device_identifier=auth_data.device_identifier
        )
        
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        
        logger.info(f"Device {device_id} authorized by {current_user.username}")
        
        return {"message": "Device authorized successfully", "device": DeviceResponse.from_device(device)}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authorize device failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to authorize device")

@router.post("/admin/devices/{device_id}/reject")
async def reject_device(
    device_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Reject a display device (admin only)"""
    try:
        service = DisplayDeviceService(db)
        device = service.reject_device(
            device_id=device_id,
            rejected_by_user=current_user
        )
        
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        
        logger.info(f"Device {device_id} rejected by {current_user.username}")
        
        return {"message": "Device rejected", "device": DeviceResponse.from_device(device)}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reject device failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to reject device")

@router.put("/admin/devices/{device_id}")
async def update_device(
    device_id: int,
    update_data: DeviceUpdateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update device information (admin only)"""
    try:
        service = DisplayDeviceService(db)
        device = service.update_device_info(
            device_id=device_id,
            device_name=update_data.device_name,
            device_identifier=update_data.device_identifier
        )
        
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        
        return {"message": "Device updated successfully", "device": DeviceResponse.from_device(device)}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update device failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to update device")

@router.delete("/admin/devices/{device_id}")
async def delete_device(
    device_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete a display device (admin only)"""
    try:
        service = DisplayDeviceService(db)
        success = service.delete_device(device_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Device not found")
        
        return {"message": "Device deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete device failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete device")

class PlaylistAssignmentRequest(BaseModel):
    playlist_id: Optional[int] = None

@router.put("/admin/devices/{device_id}/playlist")
async def assign_playlist_to_device(
    device_id: int,
    assignment_data: PlaylistAssignmentRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Assign a playlist to a display device (admin only)"""
    try:
        service = DisplayDeviceService(db)
        device = service.assign_playlist_to_device(
            device_id=device_id,
            playlist_id=assignment_data.playlist_id
        )
        
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        
        logger.info(f"Playlist {assignment_data.playlist_id} assigned to device {device_id} by {current_user.username}")
        
        return DeviceResponse.from_device(device)
        
    except Exception as e:
        logger.error(f"Assign playlist to device failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to assign playlist to device")

class CookieValidationResponse(BaseModel):
    valid: bool
    device_id: Optional[int] = None
    device_token: Optional[str] = None
    status: str
    message: str
    needs_reregistration: bool = False

@router.get("/validate-cookie")
async def validate_device_cookie(
    request: Request,
    db: Session = Depends(get_db)
):
    """Validate device cookie and return device status information"""
    try:
        # Try to get device token from cookies
        device_token = None
        try:
            cookies = cookie_manager.get_auth_cookies(request)
            # For device cookies, we might need to check a different cookie name
            # Let's check the request cookies directly for device-specific cookies
            device_token = request.cookies.get('device_token')
        except:
            device_token = None
        
        if not device_token:
            return CookieValidationResponse(
                valid=False,
                status="no_cookie",
                message="No device cookie found",
                needs_reregistration=True
            )
        
        # Check if device exists and token is valid
        service = DisplayDeviceService(db)
        device = service.get_device_by_token(device_token)
        
        if not device:
            return CookieValidationResponse(
                valid=False,
                status="invalid_cookie",
                message="Device not found or token invalid",
                needs_reregistration=True
            )
        
        # Check if device is active
        if not device.is_active:
            return CookieValidationResponse(
                valid=False,
                device_id=device.id,
                device_token=device_token,
                status="device_inactive",
                message="Device is inactive",
                needs_reregistration=True
            )
        
        # Cookie is valid
        return CookieValidationResponse(
            valid=True,
            device_id=device.id,
            device_token=device_token,
            status="valid",
            message="Device cookie is valid",
            needs_reregistration=False
        )
        
    except Exception as e:
        logger.error(f"Cookie validation failed: {e}")
        return CookieValidationResponse(
            valid=False,
            status="error",
            message="Failed to validate cookie",
            needs_reregistration=True
        )

@router.post("/admin/devices/{device_id}/reset")
async def reset_device(
    device_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Reset a device to force re-registration (admin only)"""
    try:
        service = DisplayDeviceService(db)
        device = service.get_device_by_id(device_id)
        
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        
        # Reset the device token to force re-registration
        # This will invalidate any existing cookies
        from models.display_device import DisplayDevice
        new_token = DisplayDevice.generate_device_token()
        device.device_token = new_token
        device.status = DeviceStatus.PENDING
        
        db.commit()
        
        logger.info(f"Device {device_id} reset by admin {current_user.username}")
        
        return {
            "success": True,
            "message": "Device reset successfully. Device will need to re-register.",
            "new_token": new_token  # For debugging, not sent to display
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reset device failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to reset device")
