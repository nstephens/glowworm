from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field, validator
from datetime import datetime, date, time as dt_time
import logging

from models import get_db
from models.user import User
from models.scheduled_playlist import ScheduledPlaylist, ScheduleType
from models.display_device import DisplayDevice
from models.playlist import Playlist
from utils.middleware import require_admin
from services.scheduler_service import SchedulerService
from utils.csrf import csrf_protection
from websocket.scheduler_events import schedule_created_event, schedule_updated_event, schedule_deleted_event
from websocket.redis_bridge import publish_processing_update

logger = logging.getLogger(__name__)

# ==================== Pydantic Models ====================

class ScheduleCreateRequest(BaseModel):
    """Request model for creating a schedule"""
    device_id: int
    playlist_id: int
    schedule_type: str  # 'recurring' or 'specific_date'
    name: str = Field(..., min_length=1, max_length=128)
    description: Optional[str] = None
    priority: int = Field(default=0, ge=0, le=100)
    enabled: bool = True
    
    # Recurring schedule fields
    days_of_week: Optional[List[str]] = None
    start_time: Optional[str] = None  # HH:MM:SS format
    end_time: Optional[str] = None  # HH:MM:SS format
    
    # Specific date schedule fields
    specific_date: Optional[str] = None  # YYYY-MM-DD format
    specific_start_time: Optional[str] = None  # HH:MM:SS format
    specific_end_time: Optional[str] = None  # HH:MM:SS format
    annual_recurrence: bool = False
    
    @validator('schedule_type')
    def validate_schedule_type(cls, v):
        if v not in ['recurring', 'specific_date']:
            raise ValueError('schedule_type must be "recurring" or "specific_date"')
        return v
    
    @validator('days_of_week')
    def validate_days_of_week(cls, v, values):
        if values.get('schedule_type') == 'recurring':
            if not v or len(v) == 0:
                raise ValueError('Recurring schedules must have at least one day of week')
            valid_days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
            for day in v:
                if day.lower() not in valid_days:
                    raise ValueError(f'Invalid day of week: {day}')
        return v


class ScheduleUpdateRequest(BaseModel):
    """Request model for updating a schedule"""
    device_id: Optional[int] = None
    playlist_id: Optional[int] = None
    name: Optional[str] = Field(None, min_length=1, max_length=128)
    description: Optional[str] = None
    priority: Optional[int] = Field(None, ge=0, le=100)
    enabled: Optional[bool] = None
    
    # Recurring fields
    days_of_week: Optional[List[str]] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    
    # Specific date fields
    specific_date: Optional[str] = None
    specific_start_time: Optional[str] = None
    specific_end_time: Optional[str] = None
    annual_recurrence: Optional[bool] = None


class SchedulePreviewRequest(BaseModel):
    """Request model for schedule preview"""
    date: str  # YYYY-MM-DD format
    time: str  # HH:MM:SS format


# ==================== Router ====================

router = APIRouter(prefix="/api/scheduler", tags=["scheduler"])


# ==================== Helper Functions ====================

def parse_time(time_str: str) -> dt_time:
    """Parse HH:MM:SS string to time object"""
    try:
        return datetime.strptime(time_str, "%H:%M:%S").time()
    except ValueError:
        try:
            # Also accept HH:MM format
            return datetime.strptime(time_str, "%H:%M").time()
        except ValueError:
            raise ValueError(f"Invalid time format: {time_str}. Expected HH:MM:SS or HH:MM")


def parse_date(date_str: str) -> date:
    """Parse YYYY-MM-DD string to date object"""
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise ValueError(f"Invalid date format: {date_str}. Expected YYYY-MM-DD")


# ==================== Endpoints ====================

@router.post("/schedules")
async def create_schedule(
    request: Request,
    schedule_data: ScheduleCreateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a new schedule (admin only)"""
    try:
        csrf_protection.require_csrf_token(request)
        
        scheduler_service = SchedulerService(db)
        
        # Parse schedule type
        schedule_type = ScheduleType(schedule_data.schedule_type)
        
        # Parse time fields based on schedule type
        if schedule_type == ScheduleType.RECURRING:
            start_time = parse_time(schedule_data.start_time) if schedule_data.start_time else None
            end_time = parse_time(schedule_data.end_time) if schedule_data.end_time else None
            
            schedule = scheduler_service.create_schedule(
                device_id=schedule_data.device_id,
                playlist_id=schedule_data.playlist_id,
                schedule_type=schedule_type,
                name=schedule_data.name,
                description=schedule_data.description,
                priority=schedule_data.priority,
                enabled=schedule_data.enabled,
                created_by_user_id=current_user.id,
                days_of_week=schedule_data.days_of_week,
                start_time=start_time,
                end_time=end_time
            )
        else:  # SPECIFIC_DATE
            specific_date = parse_date(schedule_data.specific_date) if schedule_data.specific_date else None
            specific_start_time = parse_time(schedule_data.specific_start_time) if schedule_data.specific_start_time else None
            specific_end_time = parse_time(schedule_data.specific_end_time) if schedule_data.specific_end_time else None
            
            schedule = scheduler_service.create_schedule(
                device_id=schedule_data.device_id,
                playlist_id=schedule_data.playlist_id,
                schedule_type=schedule_type,
                name=schedule_data.name,
                description=schedule_data.description,
                priority=schedule_data.priority,
                enabled=schedule_data.enabled,
                created_by_user_id=current_user.id,
                specific_date=specific_date,
                specific_start_time=specific_start_time,
                specific_end_time=specific_end_time,
                annual_recurrence=schedule_data.annual_recurrence
            )
        
        # Send WebSocket notification to admins
        try:
            event = schedule_created_event(schedule.id, schedule.name, schedule.device_id)
            publish_processing_update(event)
        except Exception as e:
            logger.warning(f"Failed to send schedule created notification: {e}")
        
        logger.info(f"Schedule '{schedule.name}' (ID: {schedule.id}) created by {current_user.username}")
        
        return {
            "status_code": 200,
            "message": "Schedule created successfully",
            "data": schedule.to_dict()
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create schedule: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to create schedule")


@router.get("/schedules")
async def get_schedules(
    device_id: Optional[int] = None,
    playlist_id: Optional[int] = None,
    enabled: Optional[bool] = None,
    schedule_type: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List all schedules with optional filtering (admin only)"""
    try:
        scheduler_service = SchedulerService(db)
        
        # Parse schedule_type filter
        type_filter = None
        if schedule_type:
            try:
                type_filter = ScheduleType(schedule_type)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid schedule_type: {schedule_type}")
        
        schedules = scheduler_service.get_all_schedules(
            device_id=device_id,
            playlist_id=playlist_id,
            enabled=enabled,
            schedule_type=type_filter
        )
        
        # Enrich with related data and computed fields
        now = datetime.now()
        result = []
        
        for schedule in schedules:
            schedule_dict = schedule.to_dict()
            
            # Add device info
            if schedule.device:
                schedule_dict['device_name'] = schedule.device.device_name
            
            # Add playlist info
            if schedule.playlist:
                schedule_dict['playlist_name'] = schedule.playlist.name
            
            # Add computed fields
            schedule_dict['is_active'] = schedule.is_active_at(now)
            
            result.append(schedule_dict)
        
        return {
            "status_code": 200,
            "data": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get schedules: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve schedules")


@router.get("/schedules/{schedule_id}")
async def get_schedule(
    schedule_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get schedule details (admin only)"""
    try:
        scheduler_service = SchedulerService(db)
        schedule = scheduler_service.get_schedule_by_id(schedule_id)
        
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        # Enrich with related data
        schedule_dict = schedule.to_dict()
        
        if schedule.device:
            schedule_dict['device_name'] = schedule.device.device_name
        
        if schedule.playlist:
            schedule_dict['playlist_name'] = schedule.playlist.name
            # Count images in playlist
            image_count = db.query(Image).filter(Image.playlist_id == schedule.playlist_id).count()
            schedule_dict['playlist_image_count'] = image_count
        
        if schedule.created_by:
            schedule_dict['created_by'] = schedule.created_by.username
        
        # Add computed fields
        schedule_dict['is_active'] = schedule.is_active_at(datetime.now())
        
        return {
            "status_code": 200,
            "data": schedule_dict
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get schedule {schedule_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve schedule")


@router.put("/schedules/{schedule_id}")
async def update_schedule(
    request: Request,
    schedule_id: int,
    update_data: ScheduleUpdateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update a schedule (admin only)"""
    try:
        csrf_protection.require_csrf_token(request)
        
        scheduler_service = SchedulerService(db)
        
        # Build update dict with parsed time fields
        updates = {}
        
        for field in ['device_id', 'playlist_id', 'name', 'description', 'priority', 'enabled', 'days_of_week', 'annual_recurrence']:
            value = getattr(update_data, field)
            if value is not None:
                updates[field] = value
        
        # Parse time fields if provided
        if update_data.start_time:
            updates['start_time'] = parse_time(update_data.start_time)
        if update_data.end_time:
            updates['end_time'] = parse_time(update_data.end_time)
        if update_data.specific_start_time:
            updates['specific_start_time'] = parse_time(update_data.specific_start_time)
        if update_data.specific_end_time:
            updates['specific_end_time'] = parse_time(update_data.specific_end_time)
        if update_data.specific_date:
            updates['specific_date'] = parse_date(update_data.specific_date)
        
        schedule = scheduler_service.update_schedule(schedule_id, **updates)
        
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        # Send WebSocket notification
        try:
            event = schedule_updated_event(schedule.id, schedule.name, schedule.device_id)
            publish_processing_update(event)
        except Exception as e:
            logger.warning(f"Failed to send schedule updated notification: {e}")
        
        logger.info(f"Schedule {schedule_id} updated by {current_user.username}")
        
        return {
            "status_code": 200,
            "message": "Schedule updated successfully",
            "data": schedule.to_dict()
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update schedule {schedule_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update schedule")


@router.delete("/schedules/{schedule_id}")
async def delete_schedule(
    request: Request,
    schedule_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete a schedule (admin only)"""
    try:
        csrf_protection.require_csrf_token(request)
        
        scheduler_service = SchedulerService(db)
        
        # Get schedule before deleting (for notification)
        schedule = scheduler_service.get_schedule_by_id(schedule_id)
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        device_id = schedule.device_id
        
        # Delete schedule
        success = scheduler_service.delete_schedule(schedule_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Schedule not found")
        
        # Send WebSocket notification
        try:
            event = schedule_deleted_event(schedule_id, device_id)
            publish_processing_update(event)
        except Exception as e:
            logger.warning(f"Failed to send schedule deleted notification: {e}")
        
        logger.info(f"Schedule {schedule_id} deleted by {current_user.username}")
        
        return {
            "status_code": 200,
            "message": "Schedule deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete schedule {schedule_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete schedule")


@router.get("/devices/{device_id}/schedules")
async def get_device_schedules(
    device_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get all schedules for a specific device (admin only)"""
    try:
        scheduler_service = SchedulerService(db)
        schedules = scheduler_service.get_schedules_for_device(device_id)
        
        # Enrich with computed fields
        now = datetime.now()
        result = []
        
        for schedule in schedules:
            schedule_dict = schedule.to_dict()
            schedule_dict['is_active'] = schedule.is_active_at(now)
            
            if schedule.playlist:
                schedule_dict['playlist_name'] = schedule.playlist.name
            
            result.append(schedule_dict)
        
        return {
            "status_code": 200,
            "data": result
        }
        
    except Exception as e:
        logger.error(f"Failed to get schedules for device {device_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve device schedules")


@router.get("/devices/{device_id}/active")
async def get_active_schedule(
    device_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get currently active schedule for a device (admin only)"""
    try:
        scheduler_service = SchedulerService(db)
        
        # Get device
        device = db.query(DisplayDevice).filter(DisplayDevice.id == device_id).first()
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        
        # Get active schedule
        active_schedule = scheduler_service.get_active_schedule(device_id)
        
        if active_schedule:
            # Active schedule found
            result = {
                "schedule_id": active_schedule.id,
                "schedule_name": active_schedule.name,
                "playlist_id": active_schedule.playlist_id,
                "playlist_name": active_schedule.playlist.name if active_schedule.playlist else None,
                "is_default": False,
                "priority": active_schedule.priority,
                "schedule_type": active_schedule.schedule_type.value
            }
        else:
            # No active schedule, using default
            result = {
                "schedule_id": None,
                "playlist_id": device.playlist_id,
                "playlist_name": device.playlist.name if device.playlist else None,
                "is_default": True
            }
        
        return {
            "status_code": 200,
            "data": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get active schedule for device {device_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve active schedule")


@router.post("/devices/{device_id}/preview")
async def preview_schedule(
    device_id: int,
    preview_data: SchedulePreviewRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Preview what schedule would be active at a specific date/time (admin only)"""
    try:
        scheduler_service = SchedulerService(db)
        
        # Parse date and time
        preview_date = parse_date(preview_data.date)
        preview_time = parse_time(preview_data.time)
        
        # Get preview
        result = scheduler_service.preview_schedule(device_id, preview_date, preview_time)
        
        return {
            "status_code": 200,
            "data": result
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to preview schedule for device {device_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to preview schedule")


@router.post("/evaluate-now")
async def evaluate_now(
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Force immediate schedule evaluation (admin/testing only)"""
    try:
        csrf_protection.require_csrf_token(request)
        
        # Run evaluation synchronously
        from tasks.scheduler_tasks import evaluate_schedules
        
        # Call the function directly (not via Celery) for immediate result
        scheduler_service = SchedulerService(db)
        result = scheduler_service.evaluate_all_devices()
        
        logger.info(f"Manual schedule evaluation triggered by {current_user.username}")
        
        return {
            "status_code": 200,
            "message": "Schedule evaluation completed",
            "data": result
        }
        
    except Exception as e:
        logger.error(f"Failed to evaluate schedules: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to evaluate schedules")

