from fastapi import APIRouter, Depends, HTTPException, Request, Response, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import logging

from models.database import get_db
from models.display_device import DisplayDevice, DeviceStatus
from models.device_log import DeviceLog, LogLevel
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
    device_id: int
    device_token: str
    status: str
    message: str

class DeviceAuthorizationRequest(BaseModel):
    device_name: Optional[str] = None
    device_identifier: Optional[str] = None

class DeviceUpdateRequest(BaseModel):
    device_name: Optional[str] = None
    device_identifier: Optional[str] = None

class DeviceOrientationRequest(BaseModel):
    orientation: str  # 'portrait' or 'landscape'

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
    screen_width: Optional[int]
    screen_height: Optional[int]
    device_pixel_ratio: Optional[str]
    orientation: str

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
        
        logger.info(f"Device registered: {device.device_token[:8]}... (ID: {device.id})")
        logger.info(f"Set cookie 'glowworm_display' with token: {device.device_token[:8]}...")
        
        return DeviceRegistrationResponse(
            device_id=device.id,
            device_token=device.device_token,
            status=device.status.value.lower(),
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
        if device.status.value == 'AUTHORIZED':
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

@router.put("/admin/devices/{device_id}/orientation")
async def update_device_orientation(
    device_id: int,
    orientation_data: DeviceOrientationRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update device orientation and trigger playlist re-computation (admin only)"""
    try:
        # Validate orientation value
        if orientation_data.orientation not in ['portrait', 'landscape']:
            raise HTTPException(
                status_code=400, 
                detail="Orientation must be 'portrait' or 'landscape'"
            )
        
        service = DisplayDeviceService(db)
        device = service.get_device_by_id(device_id)
        
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        
        # Update orientation
        device.orientation = orientation_data.orientation
        db.commit()
        db.refresh(device)
        
        # Get affected playlists and trigger re-computation
        affected_playlists = []
        if device.playlist_id:
            from models.playlist import Playlist
            from models.image import Image
            from services.image_pairing_service import image_classification_service
            from services.playlist_variant_service import PlaylistVariantService
            
            playlist = db.query(Playlist).filter(Playlist.id == device.playlist_id).first()
            if playlist:
                affected_playlists.append(playlist.id)
                
                # Re-compute pairing sequence for new orientation
                images = db.query(Image).filter(Image.playlist_id == playlist.id).all()
                image_data = [{'id': img.id, 'width': img.width, 'height': img.height} for img in images]
                
                # Get current sequence order
                if playlist.sequence:
                    image_map = {img['id']: img for img in image_data}
                    ordered_images = [image_map[img_id] for img_id in playlist.sequence if img_id in image_map]
                else:
                    ordered_images = image_data
                
                # Compute new pairing for new orientation
                computed = image_classification_service.compute_sequence(ordered_images, orientation_data.orientation)
                playlist.computed_sequence = computed
                db.commit()
                
                # Auto-generate variants for new orientation
                try:
                    variant_service = PlaylistVariantService(db)
                    variant_result = variant_service.generate_variants_for_playlist(playlist.id)
                    logger.info(f"Auto-generated {variant_result.get('count', 0)} variants after orientation change")
                except Exception as e:
                    logger.error(f"Auto variant generation failed (non-fatal): {e}")
        
        logger.info(f"Device {device_id} orientation updated to {orientation_data.orientation} by {current_user.username}")
        
        return {
            "success": True,
            "message": "Orientation updated successfully",
            "device": DeviceResponse.from_device(device),
            "affected_playlists": affected_playlists
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update orientation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to update orientation")

@router.get("/debug-cookies")
async def debug_cookies(request: Request):
    """Debug endpoint to check cookie handling"""
    return {
        "all_cookies": dict(request.cookies),
        "glowworm_display_cookie": cookie_manager.get_display_device_cookie(request),
        "query_token": request.query_params.get('device_token'),
        "header_token": request.headers.get('X-Device-Token')
    }

@router.post("/update-resolution")
async def update_device_resolution(
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """Update device resolution information (no auth required for display devices)"""
    try:
        # Get device token from query parameters, headers, or cookie
        device_token = (request.query_params.get('device_token') or 
                       request.headers.get('X-Device-Token') or
                       cookie_manager.get_display_device_cookie(request))
        
        logger.info(f"Update resolution request - query: {request.query_params.get('device_token')}, header: {request.headers.get('X-Device-Token')}, cookie: {cookie_manager.get_display_device_cookie(request)}")
        logger.info(f"All cookies: {list(request.cookies.keys())}")
        
        if not device_token:
            raise HTTPException(status_code=400, detail="Device token required")
        
        # Get resolution data from request body
        body = await request.json()
        screen_width = body.get('screen_width')
        screen_height = body.get('screen_height')
        device_pixel_ratio = body.get('device_pixel_ratio', '1.0')
        
        if not screen_width or not screen_height:
            raise HTTPException(status_code=400, detail="Screen width and height required")
        
        # Update device resolution
        service = DisplayDeviceService(db)
        device = service.update_device_resolution(
            device_token=device_token,
            screen_width=screen_width,
            screen_height=screen_height,
            device_pixel_ratio=device_pixel_ratio
        )
        
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        
        logger.info(f"Updated resolution for device {device_token[:8]}...: {screen_width}x{screen_height} (DPR: {device_pixel_ratio})")
        
        return {"message": "Device resolution updated successfully", "device": DeviceResponse.from_device(device)}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update device resolution failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to update device resolution")

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
        # Get device token from cookie using the cookie manager
        device_token = cookie_manager.get_display_device_cookie(request)
        
        logger.info(f"Cookie validation request - token present: {bool(device_token)}")
        logger.info(f"All cookies in request: {list(request.cookies.keys())}")
        
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
        
        # Cookie is valid - return device info
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

# Device logging endpoints
class DeviceLogRequest(BaseModel):
    log_level: str  # "debug", "info", "warning", "error", "critical"
    message: str
    context: Optional[dict] = None

class DeviceLogResponse(BaseModel):
    id: int
    device_id: int
    device_name: Optional[str]
    device_token: str
    log_level: str
    message: str
    context: Optional[dict]
    created_at: str

    @classmethod
    def from_log(cls, log: DeviceLog) -> "DeviceLogResponse":
        return cls(**log.to_dict())

@router.post("/logs")
async def submit_device_log(
    request: Request,
    log_data: DeviceLogRequest,
    db: Session = Depends(get_db)
):
    """Submit a log entry from a display device (no auth required)"""
    try:
        # Get device token from cookie, query param, or header
        device_token = (request.query_params.get('device_token') or 
                       request.headers.get('X-Device-Token') or
                       cookie_manager.get_display_device_cookie(request))
        
        if not device_token:
            raise HTTPException(status_code=400, detail="Device token required")
        
        # Get device
        service = DisplayDeviceService(db)
        device = service.get_device_by_token(device_token)
        
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        
        # Validate log level (accept lowercase from frontend, convert to uppercase for DB)
        try:
            log_level_enum = LogLevel(log_data.log_level.upper())
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid log level: {log_data.log_level}")
        
        # Create log entry
        device_log = DeviceLog(
            device_id=device.id,
            log_level=log_level_enum,
            message=log_data.message,
            context=log_data.context
        )
        
        db.add(device_log)
        db.commit()
        db.refresh(device_log)
        
        logger.info(f"Log received from device {device_token[:8]}... [{log_level_enum.value.upper()}]: {log_data.message[:50]}")
        
        return {"success": True, "message": "Log submitted successfully", "log_id": device_log.id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Submit device log failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit log")

@router.get("/admin/logs", response_model=List[DeviceLogResponse])
async def get_device_logs(
    device_id: Optional[int] = Query(None, description="Filter by device ID"),
    device_name: Optional[str] = Query(None, description="Filter by device name (partial match)"),
    log_level: Optional[str] = Query(None, description="Filter by log level (debug, info, warning, error, critical)"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of logs to return"),
    offset: int = Query(0, ge=0, description="Number of logs to skip"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get device logs with optional filtering (admin only)"""
    try:
        print(f"[ADMIN_LOGS] Received request - log_level={log_level}, limit={limit}, offset={offset}")
        # Start with base query
        query = db.query(DeviceLog).join(DisplayDevice)
        
        # Apply filters
        if device_id:
            query = query.filter(DeviceLog.device_id == device_id)
        
        if device_name:
            query = query.filter(DisplayDevice.device_name.like(f"%{device_name}%"))
        
        if log_level:
            try:
                log_level_enum = LogLevel(log_level.upper())
                print(f"[ADMIN_LOGS] Filtering: '{log_level}' -> {log_level_enum} (value: {log_level_enum.value})")
                query = query.filter(DeviceLog.log_level == log_level_enum)
            except ValueError as e:
                print(f"[ADMIN_LOGS] Invalid log level: '{log_level}' - {e}")
                raise HTTPException(status_code=400, detail=f"Invalid log level: {log_level}")
        
        # Order by most recent first
        query = query.order_by(DeviceLog.created_at.desc())
        
        # Apply pagination
        query = query.offset(offset).limit(limit)
        
        # Execute query
        logs = query.all()
        print(f"[ADMIN_LOGS] Query returned {len(logs)} logs")
        if logs:
            # Log first few results to verify filtering
            sample_levels = [str(log.log_level) for log in logs[:3]]
            print(f"[ADMIN_LOGS] Sample log levels: {sample_levels}")
        
        result = [DeviceLogResponse.from_log(log) for log in logs]
        print(f"[ADMIN_LOGS] Returning {len(result)} results")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get device logs failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to get device logs")

@router.delete("/admin/logs")
async def clear_device_logs(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Clear all display device logs from database (admin only)"""
    try:
        count = db.query(DeviceLog).delete()
        db.commit()
        
        logger.info(f"Cleared {count} display device log entries by admin {current_user.username}")
        
        return {"success": True, "message": f"Cleared {count} display device log entries", "count": count}
        
    except Exception as e:
        db.rollback()
        logger.error(f"Clear device logs failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear device logs")
