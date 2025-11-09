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
from utils.rate_limiter import RateLimiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/device-daemon", tags=["device-daemon"])

# Rate limiter: 10 requests per device per minute
command_rate_limiter = RateLimiter(max_requests=10, time_window=60)

# ============================================================================
# Pydantic Models
# ============================================================================

class DaemonRegistrationRequest(BaseModel):
    """Request to register a daemon with the backend"""
    device_token: str = Field(..., description="Display device token")
    daemon_version: str = Field("1.0.0", description="Daemon version")
    capabilities: Dict[str, bool] = Field(
        default_factory=lambda: {
            "url_update": True,
            "cec_control": False,
            "input_management": False,
        },
        description="Daemon capabilities"
    )

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
    
    # TODO: Store daemon metadata in device_daemon table (Task 3)
    # For now, just acknowledge registration
    
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
            detail="Rate limit exceeded. Max 10 requests per minute."
        )
    
    logger.debug(f"Command poll from device {device.id}")
    
    # TODO: Fetch pending commands from device_commands table (Task 3)
    # For now, return empty list
    
    return CommandPollResponse(
        commands=[],
        count=0,
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
    
    # TODO: Update command status in device_commands table (Task 3)
    # For now, just acknowledge
    
    if result.status == "failed":
        logger.error(f"Command {command_id} failed: {result.error}")
    
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
    
    # Update last seen (already done in authentication)
    # TODO: Store heartbeat data in device_daemon table (Task 3)
    
    return HeartbeatResponse(
        status="ok",
        server_time=datetime.now().isoformat(),
        commands_pending=0,  # TODO: Get actual pending count
    )

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

