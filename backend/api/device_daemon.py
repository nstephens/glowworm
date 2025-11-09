"""
Device Daemon API endpoints
Handles communication with Raspberry Pi display device daemons
"""
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime, timedelta
import logging
import secrets

from models.database import get_db
from models.display_device import DisplayDevice, DeviceStatus
from models.device_daemon_status import DeviceDaemonStatus, DaemonStatus
from models.device_command import DeviceCommand, CommandType, CommandStatus
from services.device_daemon_service import DeviceDaemonService, DeviceCommandService
from utils.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/device-daemon", tags=["device-daemon"])

# Rate limiter: 20 requests per device per minute
# Allows 5-second polling (12 req/min) with headroom
# For LAN deployments with authenticated devices, this is safe
command_rate_limiter = RateLimiter(max_requests=20, time_window=60)

# ============================================================================
# Pydantic Models
# ============================================================================

class DaemonRegistrationRequest(BaseModel):
    """Request to register a daemon with the backend"""
    daemon_version: str = Field("1.0.0", description="Daemon version")
    capabilities: Dict[str, bool] = Field(
        default_factory=lambda: {
            "url_update": True,
            "cec_control": False,
            "input_management": False,
        },
        description="Daemon capabilities"
    )
    system_info: Optional[Dict[str, Any]] = Field(None, description="System information including CEC availability")
    # Note: device_token comes from Authorization header, not request body

class DaemonRegistrationResponse(BaseModel):
    """Response from daemon registration"""
    status: str
    message: str
    poll_interval: int = Field(30, description="Recommended poll interval in seconds")

class CommandRequest(BaseModel):
    """Base command structure"""
    id: int
    type: str
    parameters: Dict[str, Any]
    created_at: str

class CommandPollResponse(BaseModel):
    """Response from command polling"""
    commands: List[CommandRequest]
    count: int

class CommandResultRequest(BaseModel):
    """Request to report command execution result"""
    status: str = Field(..., description="completed, failed, or timeout")
    result: Dict[str, Any] = Field(default_factory=dict)
    error: Optional[str] = None
    completed_at: str

class CommandResultResponse(BaseModel):
    """Response after reporting command result"""
    status: str
    message: str

class HeartbeatRequest(BaseModel):
    """Daemon heartbeat/status update"""
    daemon_version: str
    uptime_seconds: float
    last_command_id: Optional[int] = None
    system_info: Optional[Dict[str, Any]] = None

class HeartbeatResponse(BaseModel):
    """Response to heartbeat"""
    status: str
    server_time: str
    commands_pending: int

# ============================================================================
# Authentication Middleware
# ============================================================================

async def get_daemon_device(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> DisplayDevice:
    """
    Authenticate daemon requests using Bearer token
    
    Args:
        authorization: Authorization header (Bearer <token>)
        db: Database session
    
    Returns:
        DisplayDevice object if authenticated
    
    Raises:
        HTTPException: If authentication fails
    """
    if not authorization:
        logger.warning("Daemon request missing Authorization header")
        raise HTTPException(
            status_code=401,
            detail="Authorization header required"
        )
    
    # Parse Bearer token
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        logger.warning(f"Invalid Authorization format: {authorization[:20]}...")
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization format. Use: Bearer <token>"
        )
    
    device_token = parts[1]
    
    # Find device by token
    device = db.query(DisplayDevice).filter(
        DisplayDevice.device_token == device_token
    ).first()
    
    if not device:
        logger.warning(f"Device not found for token: {device_token[:4]}...")
        raise HTTPException(
            status_code=401,
            detail="Invalid device token"
        )
    
    # Check if device is authorized
    if device.status != DeviceStatus.AUTHORIZED:
        logger.warning(
            f"Device {device.id} attempted daemon access but status is {device.status}"
        )
        raise HTTPException(
            status_code=403,
            detail=f"Device not authorized (status: {device.status.value})"
        )
    
    # Update last seen
    device.last_seen = datetime.now()
    db.commit()
    
    logger.debug(f"Daemon authenticated for device {device.id}")
    return device

# ============================================================================
# API Endpoints
# ============================================================================

@router.post("/register", response_model=DaemonRegistrationResponse)
async def register_daemon(
    request: DaemonRegistrationRequest,
    device: DisplayDevice = Depends(get_daemon_device),
    db: Session = Depends(get_db),
):
    """
    Register a daemon with the backend
    
    Daemons should call this endpoint on startup to announce their presence
    and capabilities.
    """
    logger.info(
        f"Daemon registration for device {device.id} "
        f"(version: {request.daemon_version})"
    )
    
    # Enable daemon control on the device (auto-enable when daemon registers)
    if not device.daemon_enabled:
        device.daemon_enabled = True
        db.commit()
        logger.info(f"Auto-enabled daemon control for device {device.id}")
    
    # Register daemon in database
    daemon_status = DeviceDaemonService.register_daemon(
        db=db,
        device_id=device.id,
        daemon_version=request.daemon_version,
        capabilities=request.capabilities,
    )
    
    # Update CEC info from system_info if provided
    if request.system_info:
        if 'cec_available' in request.system_info:
            daemon_status.cec_available = request.system_info['cec_available']
        if 'cec_devices' in request.system_info:
            daemon_status.cec_devices = request.system_info['cec_devices']
        db.commit()
        db.refresh(daemon_status)
    
    logger.info(
        f"Daemon registered for device {device.id}: "
        f"capabilities={list(request.capabilities.keys())}"
    )
    
    return DaemonRegistrationResponse(
        status="registered",
        message="Daemon registered successfully",
        poll_interval=30,
    )

@router.get("/commands/poll", response_model=CommandPollResponse)
async def poll_commands(
    device: DisplayDevice = Depends(get_daemon_device),
    db: Session = Depends(get_db),
):
    """
    Poll for pending commands
    
    Daemons should call this endpoint periodically to check for new commands.
    Rate limited to 10 requests per minute per device.
    """
    # Check rate limit
    if not command_rate_limiter.check_rate_limit(f"device_{device.id}"):
        logger.warning(f"Rate limit exceeded for device {device.id}")
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Max 20 requests per minute."
        )
    
    logger.debug(f"Command poll from device {device.id}")
    
    # Update heartbeat
    DeviceDaemonService.update_heartbeat(db=db, device_id=device.id)
    
    # Fetch pending commands
    commands = DeviceCommandService.get_pending_commands(
        db=db,
        device_id=device.id,
        limit=10,
    )
    
    # Convert to response format
    command_list = [
        CommandRequest(
            id=cmd.id,
            type=cmd.command_type.value,
            parameters=cmd.command_data or {},
            created_at=cmd.created_at.isoformat(),
        )
        for cmd in commands
    ]
    
    if command_list:
        logger.info(f"Sending {len(command_list)} command(s) to device {device.id}")
    
    return CommandPollResponse(
        commands=command_list,
        count=len(command_list),
    )

@router.post("/commands/{command_id}/result", response_model=CommandResultResponse)
async def report_command_result(
    command_id: int,
    result: CommandResultRequest,
    device: DisplayDevice = Depends(get_daemon_device),
    db: Session = Depends(get_db),
):
    """
    Report command execution result
    
    Daemons call this endpoint after executing a command to report
    success or failure.
    """
    logger.info(
        f"Command result for #{command_id} from device {device.id}: {result.status}"
    )
    
    # Map status string to enum
    status_map = {
        "completed": CommandStatus.COMPLETED,
        "failed": CommandStatus.FAILED,
        "timeout": CommandStatus.TIMEOUT,
    }
    
    command_status = status_map.get(result.status, CommandStatus.FAILED)
    
    # Update command in database
    command = DeviceCommandService.update_command_status(
        db=db,
        command_id=command_id,
        status=command_status,
        result=result.result,
        error_message=result.error,
    )
    
    if not command:
        raise HTTPException(
            status_code=404,
            detail=f"Command {command_id} not found"
        )
    
    # Verify command belongs to this device
    if command.device_id != device.id:
        logger.warning(
            f"Device {device.id} attempted to update command {command_id} "
            f"belonging to device {command.device_id}"
        )
        raise HTTPException(
            status_code=403,
            detail="Command does not belong to this device"
        )
    
    if result.status == "failed":
        logger.error(f"Command {command_id} failed: {result.error}")
    else:
        logger.info(f"Command {command_id} completed successfully")
    
    return CommandResultResponse(
        status="acknowledged",
        message="Result recorded successfully",
    )

@router.post("/heartbeat", response_model=HeartbeatResponse)
async def daemon_heartbeat(
    heartbeat: HeartbeatRequest,
    device: DisplayDevice = Depends(get_daemon_device),
    db: Session = Depends(get_db),
):
    """
    Daemon heartbeat/status update
    
    Daemons can optionally send heartbeats to report their status and uptime.
    """
    logger.debug(
        f"Heartbeat from device {device.id} "
        f"(uptime: {heartbeat.uptime_seconds:.1f}s)"
    )
    
    # Update heartbeat with system info
    DeviceDaemonService.update_heartbeat(
        db=db,
        device_id=device.id,
        system_info=heartbeat.system_info,
    )
    
    # Count pending commands
    pending_count = db.query(DeviceCommand).filter(
        DeviceCommand.device_id == device.id,
        DeviceCommand.status == CommandStatus.PENDING,
    ).count()
    
    return HeartbeatResponse(
        status="ok",
        server_time=datetime.now().isoformat(),
        commands_pending=pending_count,
    )

# ============================================================================
# Device Control Endpoints
# ============================================================================

class URLUpdateRequest(BaseModel):
    """Request to update device browser URL"""
    url: str = Field(..., description="New browser URL")

class PowerControlRequest(BaseModel):
    """Request to control display power"""
    power: str = Field(..., description="on or off")

class InputSelectRequest(BaseModel):
    """Request to select HDMI input"""
    input_address: str = Field(..., description="CEC input address")
    input_name: Optional[str] = Field(None, description="Human-readable input name")

@router.put("/devices/{device_id}/browser-url")
async def update_browser_url(
    device_id: int,
    request: URLUpdateRequest,
    db: Session = Depends(get_db),
):
    """
    Queue a browser URL update command for a device
    
    This endpoint allows admins to remotely update the browser URL
    on a display device running the daemon.
    """
    # Verify device exists and has daemon enabled
    device = db.query(DisplayDevice).filter(DisplayDevice.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    if not device.daemon_enabled:
        raise HTTPException(
            status_code=400,
            detail="Daemon control not enabled for this device"
        )
    
    # Create command
    command = DeviceCommandService.create_command(
        db=db,
        device_id=device_id,
        command_type=CommandType.UPDATE_URL,
        command_data={"url": request.url},
    )
    
    # Update device's browser_url field
    device.browser_url = request.url
    db.commit()
    
    logger.info(f"Queued URL update for device {device_id}: {request.url}")
    
    return {
        "status": "queued",
        "message": "URL update command queued",
        "command_id": command.id,
    }

@router.post("/devices/{device_id}/display/power")
async def control_display_power(
    device_id: int,
    request: PowerControlRequest,
    db: Session = Depends(get_db),
):
    """
    Queue a display power control command
    
    Uses HDMI CEC to turn display on or off.
    """
    # Verify device exists and has daemon enabled
    device = db.query(DisplayDevice).filter(DisplayDevice.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    if not device.daemon_enabled:
        raise HTTPException(
            status_code=400,
            detail="Daemon control not enabled for this device"
        )
    
    # Check if CEC is available
    daemon_status = DeviceDaemonService.get_daemon_status(db, device_id)
    if not daemon_status or not daemon_status.cec_available:
        raise HTTPException(
            status_code=400,
            detail="CEC control not available on this device"
        )
    
    # Determine command type
    if request.power.lower() == "on":
        command_type = CommandType.CEC_POWER_ON
    elif request.power.lower() == "off":
        command_type = CommandType.CEC_POWER_OFF
    else:
        raise HTTPException(
            status_code=400,
            detail="Power must be 'on' or 'off'"
        )
    
    # Create command
    command = DeviceCommandService.create_command(
        db=db,
        device_id=device_id,
        command_type=command_type,
        command_data={},
    )
    
    logger.info(f"Queued power {request.power} for device {device_id}")
    
    return {
        "status": "queued",
        "message": f"Power {request.power} command queued",
        "command_id": command.id,
    }

@router.get("/devices/{device_id}/display/inputs")
async def get_display_inputs(
    device_id: int,
    db: Session = Depends(get_db),
):
    """
    Get available HDMI inputs from device's CEC scan
    
    Returns the list of detected CEC devices from the daemon's
    last scan or status update.
    """
    # Verify device exists
    device = db.query(DisplayDevice).filter(DisplayDevice.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    # Get daemon status
    daemon_status = DeviceDaemonService.get_daemon_status(db, device_id)
    if not daemon_status:
        raise HTTPException(
            status_code=404,
            detail="No daemon registered for this device"
        )
    
    if not daemon_status.cec_available:
        return {
            "cec_available": False,
            "inputs": [],
            "message": "CEC not available on this device",
        }
    
    return {
        "cec_available": True,
        "inputs": daemon_status.cec_devices or [],
        "current_input": {
            "name": device.cec_input_name,
            "address": device.cec_input_address,
        } if device.cec_input_name else None,
    }

@router.post("/devices/{device_id}/display/input")
async def select_display_input(
    device_id: int,
    request: InputSelectRequest,
    db: Session = Depends(get_db),
):
    """
    Queue a command to select HDMI input via CEC
    """
    # Verify device exists and has daemon enabled
    device = db.query(DisplayDevice).filter(DisplayDevice.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    if not device.daemon_enabled:
        raise HTTPException(
            status_code=400,
            detail="Daemon control not enabled for this device"
        )
    
    # Check if CEC is available
    daemon_status = DeviceDaemonService.get_daemon_status(db, device_id)
    if not daemon_status or not daemon_status.cec_available:
        raise HTTPException(
            status_code=400,
            detail="CEC control not available on this device"
        )
    
    # Create command
    command = DeviceCommandService.create_command(
        db=db,
        device_id=device_id,
        command_type=CommandType.CEC_SET_INPUT,
        command_data={
            "input_address": request.input_address,
            "input_name": request.input_name,
        },
    )
    
    # Update device's selected input
    device.cec_input_address = request.input_address
    device.cec_input_name = request.input_name
    db.commit()
    
    logger.info(
        f"Queued input switch for device {device_id}: "
        f"{request.input_name or request.input_address}"
    )
    
    return {
        "status": "queued",
        "message": "Input switch command queued",
        "command_id": command.id,
    }

@router.post("/devices/{device_id}/display/scan-inputs")
async def scan_display_inputs(
    device_id: int,
    db: Session = Depends(get_db),
):
    """
    Queue a command to scan for available CEC inputs
    
    The daemon will scan for connected CEC devices and report them
    back via the next status update.
    """
    # Verify device exists and has daemon enabled
    device = db.query(DisplayDevice).filter(DisplayDevice.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    if not device.daemon_enabled:
        raise HTTPException(
            status_code=400,
            detail="Daemon control not enabled for this device"
        )
    
    # Create command
    command = DeviceCommandService.create_command(
        db=db,
        device_id=device_id,
        command_type=CommandType.CEC_SCAN_INPUTS,
        command_data={},
    )
    
    logger.info(f"Queued CEC scan for device {device_id}")
    
    return {
        "status": "queued",
        "message": "CEC input scan command queued",
        "command_id": command.id,
    }

@router.get("/health")
async def health_check():
    """
    Health check endpoint for daemon connectivity testing
    """
    return {
        "status": "healthy",
        "service": "device-daemon-api",
        "timestamp": datetime.now().isoformat(),
    }

