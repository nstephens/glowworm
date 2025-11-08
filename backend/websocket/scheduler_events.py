"""
WebSocket event types and payload structures for scheduler notifications.

Defines standardized event types and payload formats for communicating
playlist schedule changes to displays and admins in real-time.
"""

from typing import Dict, Any, Optional
from datetime import datetime


# Event type constants for scheduler
WS_EVENT_PLAYLIST_SCHEDULED_CHANGE = "playlist:scheduled_change"
WS_EVENT_SCHEDULE_EVALUATED = "schedule:evaluated"
WS_EVENT_SCHEDULE_CREATED = "schedule:created"
WS_EVENT_SCHEDULE_UPDATED = "schedule:updated"
WS_EVENT_SCHEDULE_DELETED = "schedule:deleted"


def playlist_scheduled_change_event(
    device_id: int,
    device_name: Optional[str],
    old_playlist_id: Optional[int],
    new_playlist_id: int,
    schedule_id: Optional[int],
    schedule_name: Optional[str],
    changed_at: str,
    active_until: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create event for playlist change due to schedule.
    
    Args:
        device_id: Display device ID
        device_name: Display device name
        old_playlist_id: Previous playlist ID
        new_playlist_id: New playlist ID
        schedule_id: Schedule that triggered the change (None if reverting to default)
        schedule_name: Name of the schedule
        changed_at: ISO timestamp of change
        active_until: ISO timestamp when schedule ends (optional)
        
    Returns:
        Event payload dict
    """
    return {
        "type": WS_EVENT_PLAYLIST_SCHEDULED_CHANGE,
        "device_id": device_id,
        "device_name": device_name,
        "old_playlist_id": old_playlist_id,
        "new_playlist_id": new_playlist_id,
        "schedule_id": schedule_id,
        "schedule_name": schedule_name,
        "changed_at": changed_at,
        "active_until": active_until,
        "timestamp": datetime.now().isoformat()
    }


def schedule_evaluated_event(
    evaluated_at: str,
    devices_evaluated: int,
    schedules_active: int,
    devices_changed: int,
    duration: float
) -> Dict[str, Any]:
    """
    Create event for schedule evaluation completion (admin monitoring).
    
    Args:
        evaluated_at: ISO timestamp of evaluation
        devices_evaluated: Number of devices checked
        schedules_active: Number of active schedules found
        devices_changed: Number of devices with playlist changes
        duration: Evaluation duration in seconds
        
    Returns:
        Event payload dict
    """
    return {
        "type": WS_EVENT_SCHEDULE_EVALUATED,
        "evaluated_at": evaluated_at,
        "devices_evaluated": devices_evaluated,
        "schedules_active": schedules_active,
        "devices_changed": devices_changed,
        "duration": duration,
        "timestamp": datetime.now().isoformat()
    }


def schedule_created_event(schedule_id: int, schedule_name: str, device_id: int) -> Dict[str, Any]:
    """Create event for schedule creation (admin notification)"""
    return {
        "type": WS_EVENT_SCHEDULE_CREATED,
        "schedule_id": schedule_id,
        "schedule_name": schedule_name,
        "device_id": device_id,
        "timestamp": datetime.now().isoformat()
    }


def schedule_updated_event(schedule_id: int, schedule_name: str, device_id: int) -> Dict[str, Any]:
    """Create event for schedule update (admin notification)"""
    return {
        "type": WS_EVENT_SCHEDULE_UPDATED,
        "schedule_id": schedule_id,
        "schedule_name": schedule_name,
        "device_id": device_id,
        "timestamp": datetime.now().isoformat()
    }


def schedule_deleted_event(schedule_id: int, device_id: int) -> Dict[str, Any]:
    """Create event for schedule deletion (admin notification)"""
    return {
        "type": WS_EVENT_SCHEDULE_DELETED,
        "schedule_id": schedule_id,
        "device_id": device_id,
        "timestamp": datetime.now().isoformat()
    }

