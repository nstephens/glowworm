"""
API endpoints for scheduled display actions
Manages power on/off and input switching schedules
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date, time as dt_time
from pydantic import BaseModel

from models.database import get_db
from models.scheduled_action import ScheduledAction, ActionType
from models.display_device import DisplayDevice
from models.user import User
from services.scheduled_action_service import ScheduledActionService
from utils.auth import get_current_user, require_admin
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/scheduler-actions", tags=["Scheduler Actions"])


# Pydantic models for request/response
class ActionDataModel(BaseModel):
    input_name: Optional[str] = None
    input_address: Optional[str] = None


class ScheduledActionCreate(BaseModel):
    device_id: int
    action_type: str  # power_on, power_off, set_input
    action_data: Optional[dict] = None
    schedule_type: str  # recurring, specific_date
    name: str
    description: Optional[str] = None
    priority: int = 0
    enabled: bool = True
    
    # Recurring schedule fields
    days_of_week: Optional[List[str]] = None
    start_time: Optional[str] = None  # HH:MM
    end_time: Optional[str] = None    # HH:MM
    
    # Specific date schedule fields
    specific_date: Optional[str] = None  # YYYY-MM-DD
    specific_start_time: Optional[str] = None  # HH:MM
    specific_end_time: Optional[str] = None    # HH:MM
    annual_recurrence: bool = False


class ScheduledActionUpdate(BaseModel):
    action_type: Optional[str] = None
    action_data: Optional[dict] = None
    schedule_type: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[int] = None
    enabled: Optional[bool] = None
    
    days_of_week: Optional[List[str]] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    
    specific_date: Optional[str] = None
    specific_start_time: Optional[str] = None
    specific_end_time: Optional[str] = None
    annual_recurrence: Optional[bool] = None


# Helper functions
def parse_time(time_str: Optional[str]) -> Optional[dt_time]:
    """Parse time string (HH:MM) to time object"""
    if not time_str:
        return None
    try:
        hour, minute = map(int, time_str.split(':'))
        return dt_time(hour, minute)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail=f"Invalid time format: {time_str}")


def parse_date(date_str: Optional[str]) -> Optional[date]:
    """Parse date string (YYYY-MM-DD) to date object"""
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {date_str}")


# API Endpoints
@router.get("/")
async def get_actions(
    device_id: Optional[int] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get all scheduled actions, optionally filtered by device"""
    try:
        query = db.query(ScheduledAction)
        
        if device_id:
            query = query.filter(ScheduledAction.device_id == device_id)
        
        actions = query.order_by(ScheduledAction.priority.desc(), ScheduledAction.name).all()
        
        return {
            "status_code": 200,
            "data": [action.to_dict() for action in actions]
        }
    
    except Exception as e:
        logger.error(f"Failed to get scheduled actions: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve scheduled actions")


@router.get("/{action_id}")
async def get_action(
    action_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get a specific scheduled action"""
    action = db.query(ScheduledAction).filter(ScheduledAction.id == action_id).first()
    
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    
    return {
        "status_code": 200,
        "data": action.to_dict()
    }


@router.post("/")
async def create_action(
    action_data: ScheduledActionCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create a new scheduled action"""
    try:
        # Validate device exists
        device = db.query(DisplayDevice).filter(DisplayDevice.id == action_data.device_id).first()
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        
        # Validate action type
        try:
            action_type_enum = ActionType(action_data.action_type)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid action type: {action_data.action_type}")
        
        # Parse time/date fields
        if action_data.schedule_type == "recurring":
            start_time = parse_time(action_data.start_time)
            end_time = parse_time(action_data.end_time)
            
            action = ScheduledAction(
                device_id=action_data.device_id,
                action_type=action_type_enum,
                action_data=action_data.action_data,
                schedule_type=action_data.schedule_type,
                name=action_data.name,
                description=action_data.description,
                priority=action_data.priority,
                enabled=action_data.enabled,
                created_by_user_id=current_user.id,
                days_of_week=action_data.days_of_week,
                start_time=start_time,
                end_time=end_time,
            )
        
        elif action_data.schedule_type == "specific_date":
            specific_date = parse_date(action_data.specific_date)
            specific_start_time = parse_time(action_data.specific_start_time)
            specific_end_time = parse_time(action_data.specific_end_time)
            
            action = ScheduledAction(
                device_id=action_data.device_id,
                action_type=action_type_enum,
                action_data=action_data.action_data,
                schedule_type=action_data.schedule_type,
                name=action_data.name,
                description=action_data.description,
                priority=action_data.priority,
                enabled=action_data.enabled,
                created_by_user_id=current_user.id,
                specific_date=specific_date,
                specific_start_time=specific_start_time,
                specific_end_time=specific_end_time,
                annual_recurrence=action_data.annual_recurrence,
            )
        
        else:
            raise HTTPException(status_code=400, detail=f"Invalid schedule type: {action_data.schedule_type}")
        
        db.add(action)
        db.commit()
        db.refresh(action)
        
        logger.info(f"Created scheduled action '{action.name}' (ID: {action.id}) by {current_user.username}")
        
        return {
            "status_code": 201,
            "data": action.to_dict()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create scheduled action: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to create scheduled action")


@router.put("/{action_id}")
async def update_action(
    action_id: int,
    action_data: ScheduledActionUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update a scheduled action"""
    try:
        action = db.query(ScheduledAction).filter(ScheduledAction.id == action_id).first()
        
        if not action:
            raise HTTPException(status_code=404, detail="Action not found")
        
        # Update fields if provided
        if action_data.action_type is not None:
            try:
                action.action_type = ActionType(action_data.action_type)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid action type: {action_data.action_type}")
        
        if action_data.action_data is not None:
            action.action_data = action_data.action_data
        
        if action_data.schedule_type is not None:
            action.schedule_type = action_data.schedule_type
        
        if action_data.name is not None:
            action.name = action_data.name
        
        if action_data.description is not None:
            action.description = action_data.description
        
        if action_data.priority is not None:
            action.priority = action_data.priority
        
        if action_data.enabled is not None:
            action.enabled = action_data.enabled
        
        # Update schedule fields
        if action_data.days_of_week is not None:
            action.days_of_week = action_data.days_of_week
        
        if action_data.start_time is not None:
            action.start_time = parse_time(action_data.start_time)
        
        if action_data.end_time is not None:
            action.end_time = parse_time(action_data.end_time)
        
        if action_data.specific_date is not None:
            action.specific_date = parse_date(action_data.specific_date)
        
        if action_data.specific_start_time is not None:
            action.specific_start_time = parse_time(action_data.specific_start_time)
        
        if action_data.specific_end_time is not None:
            action.specific_end_time = parse_time(action_data.specific_end_time)
        
        if action_data.annual_recurrence is not None:
            action.annual_recurrence = action_data.annual_recurrence
        
        db.commit()
        db.refresh(action)
        
        logger.info(f"Updated scheduled action '{action.name}' (ID: {action.id}) by {current_user.username}")
        
        return {
            "status_code": 200,
            "data": action.to_dict()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to update scheduled action: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update scheduled action")


@router.delete("/{action_id}")
async def delete_action(
    action_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete a scheduled action"""
    try:
        action = db.query(ScheduledAction).filter(ScheduledAction.id == action_id).first()
        
        if not action:
            raise HTTPException(status_code=404, detail="Action not found")
        
        action_name = action.name
        
        db.delete(action)
        db.commit()
        
        logger.info(f"Deleted scheduled action '{action_name}' (ID: {action_id}) by {current_user.username}")
        
        return {
            "status_code": 200,
            "message": "Action deleted successfully"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete scheduled action: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete scheduled action")


@router.patch("/{action_id}/toggle")
async def toggle_action(
    action_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Toggle action enabled/disabled"""
    try:
        action = db.query(ScheduledAction).filter(ScheduledAction.id == action_id).first()
        
        if not action:
            raise HTTPException(status_code=404, detail="Action not found")
        
        action.enabled = not action.enabled
        db.commit()
        db.refresh(action)
        
        logger.info(
            f"Toggled scheduled action '{action.name}' (ID: {action.id}) "
            f"to {'enabled' if action.enabled else 'disabled'} by {current_user.username}"
        )
        
        return {
            "status_code": 200,
            "data": action.to_dict()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to toggle scheduled action: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to toggle scheduled action")


@router.get("/devices/{device_id}/active")
async def get_active_actions(
    device_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get currently active actions for a device"""
    try:
        device = db.query(DisplayDevice).filter(DisplayDevice.id == device_id).first()
        if not device:
            raise HTTPException(status_code=404, detail="Device not found")
        
        active_actions = ScheduledActionService.get_active_actions(db, device_id)
        
        return {
            "status_code": 200,
            "data": {
                "device_id": device_id,
                "active_actions": [action.to_dict() for action in active_actions],
                "checked_at": datetime.now().isoformat(),
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get active actions for device {device_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve active actions")

