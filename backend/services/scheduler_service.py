"""
Scheduler Service for managing and evaluating scheduled playlist assignments.

Handles CRUD operations for schedules and the core evaluation logic that
determines which playlist should be active on a device at any given time.
"""

import logging
from datetime import datetime, date, time as dt_time
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from sqlalchemy.exc import SQLAlchemyError

from models.scheduled_playlist import ScheduledPlaylist, ScheduleType
from models.display_device import DisplayDevice
from models.playlist import Playlist
from models.user import User
from utils.structured_logging import (
    log_schedule_created,
    log_schedule_updated,
    log_schedule_deleted,
    log_schedule_activation,
    log_schedule_error
)

logger = logging.getLogger(__name__)


class SchedulerService:
    """Service for managing scheduled playlist assignments"""
    
    def __init__(self, db: Session):
        self.db = db
    
    # ==================== CRUD Operations ====================
    
    def create_schedule(
        self,
        device_id: int,
        playlist_id: int,
        schedule_type: ScheduleType,
        name: str,
        description: Optional[str] = None,
        priority: int = 0,
        enabled: bool = True,
        created_by_user_id: Optional[int] = None,
        # Recurring fields
        days_of_week: Optional[List[str]] = None,
        start_time: Optional[dt_time] = None,
        end_time: Optional[dt_time] = None,
        # Specific date fields
        specific_date: Optional[date] = None,
        specific_start_time: Optional[dt_time] = None,
        specific_end_time: Optional[dt_time] = None,
        annual_recurrence: bool = False,
    ) -> ScheduledPlaylist:
        """
        Create a new scheduled playlist.
        
        Args:
            device_id: Display device ID
            playlist_id: Playlist to show
            schedule_type: RECURRING or SPECIFIC_DATE
            name: Schedule name
            description: Optional description
            priority: Priority for conflict resolution (higher wins)
            enabled: Whether schedule is active
            created_by_user_id: User who created the schedule
            days_of_week: For recurring: ["monday", "tuesday", ...]
            start_time: For recurring: start time
            end_time: For recurring: end time
            specific_date: For specific_date: the date
            specific_start_time: For specific_date: start time
            specific_end_time: For specific_date: end time
            annual_recurrence: For specific_date: repeat every year
            
        Returns:
            Created ScheduledPlaylist instance
            
        Raises:
            ValueError: If validation fails
        """
        # Validate device exists
        device = self.db.query(DisplayDevice).filter(DisplayDevice.id == device_id).first()
        if not device:
            raise ValueError(f"Device {device_id} not found")
        
        # Validate playlist exists
        playlist = self.db.query(Playlist).filter(Playlist.id == playlist_id).first()
        if not playlist:
            raise ValueError(f"Playlist {playlist_id} not found")
        
        # Validate schedule type-specific fields
        if schedule_type == ScheduleType.RECURRING:
            if not days_of_week or len(days_of_week) == 0:
                raise ValueError("Recurring schedules must have at least one day of week")
            if not start_time or not end_time:
                raise ValueError("Recurring schedules must have start and end times")
            if start_time >= end_time:
                raise ValueError("Start time must be before end time")
            
            # Validate day names
            valid_days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
            for day in days_of_week:
                if day.lower() not in valid_days:
                    raise ValueError(f"Invalid day of week: {day}")
            
        elif schedule_type == ScheduleType.SPECIFIC_DATE:
            if not specific_date:
                raise ValueError("Specific date schedules must have a date")
            if not specific_start_time or not specific_end_time:
                raise ValueError("Specific date schedules must have start and end times")
            if specific_start_time >= specific_end_time:
                raise ValueError("Start time must be before end time")
        
        # Create schedule
        schedule = ScheduledPlaylist(
            device_id=device_id,
            playlist_id=playlist_id,
            schedule_type=schedule_type,
            name=name,
            description=description,
            priority=priority,
            enabled=enabled,
            created_by_user_id=created_by_user_id,
            # Recurring fields
            days_of_week=days_of_week,
            start_time=start_time,
            end_time=end_time,
            # Specific date fields
            specific_date=specific_date,
            specific_start_time=specific_start_time,
            specific_end_time=specific_end_time,
            annual_recurrence=annual_recurrence,
        )
        
        try:
            self.db.add(schedule)
            self.db.commit()
            self.db.refresh(schedule)
            
            # Structured logging
            log_schedule_created(
                logger,
                schedule_id=schedule.id,
                schedule_name=name,
                device_id=device_id,
                playlist_id=playlist_id,
                schedule_type=schedule_type.value,
                priority=priority,
                created_by_user_id=created_by_user_id
            )
            
            return schedule
            
        except SQLAlchemyError as e:
            self.db.rollback()
            log_schedule_error(
                logger,
                'database_error_create',
                str(e),
                {'device_id': device_id, 'schedule_name': name}
            )
            raise
    
    def get_schedule_by_id(self, schedule_id: int) -> Optional[ScheduledPlaylist]:
        """Get a schedule by ID"""
        return self.db.query(ScheduledPlaylist).filter(ScheduledPlaylist.id == schedule_id).first()
    
    def get_schedules_for_device(self, device_id: int, enabled_only: bool = False) -> List[ScheduledPlaylist]:
        """Get all schedules for a device"""
        query = self.db.query(ScheduledPlaylist).filter(ScheduledPlaylist.device_id == device_id)
        
        if enabled_only:
            query = query.filter(ScheduledPlaylist.enabled == True)
        
        return query.order_by(ScheduledPlaylist.priority.desc(), ScheduledPlaylist.id).all()
    
    def get_all_schedules(
        self,
        device_id: Optional[int] = None,
        playlist_id: Optional[int] = None,
        enabled: Optional[bool] = None,
        schedule_type: Optional[ScheduleType] = None
    ) -> List[ScheduledPlaylist]:
        """Get all schedules with optional filtering"""
        query = self.db.query(ScheduledPlaylist)
        
        if device_id is not None:
            query = query.filter(ScheduledPlaylist.device_id == device_id)
        
        if playlist_id is not None:
            query = query.filter(ScheduledPlaylist.playlist_id == playlist_id)
        
        if enabled is not None:
            query = query.filter(ScheduledPlaylist.enabled == enabled)
        
        if schedule_type is not None:
            query = query.filter(ScheduledPlaylist.schedule_type == schedule_type)
        
        return query.order_by(
            ScheduledPlaylist.device_id,
            ScheduledPlaylist.priority.desc(),
            ScheduledPlaylist.id
        ).all()
    
    def update_schedule(
        self,
        schedule_id: int,
        **kwargs
    ) -> Optional[ScheduledPlaylist]:
        """
        Update a schedule.
        
        Args:
            schedule_id: Schedule ID
            **kwargs: Fields to update
            
        Returns:
            Updated schedule or None if not found
        """
        schedule = self.get_schedule_by_id(schedule_id)
        if not schedule:
            return None
        
        # Validate updates
        if 'start_time' in kwargs and 'end_time' in kwargs:
            if kwargs['start_time'] >= kwargs['end_time']:
                raise ValueError("Start time must be before end time")
        
        if 'days_of_week' in kwargs and len(kwargs['days_of_week']) == 0:
            raise ValueError("Must have at least one day of week")
        
        # Apply updates
        fields_updated = []
        for key, value in kwargs.items():
            if hasattr(schedule, key):
                setattr(schedule, key, value)
                fields_updated.append(key)
        
        try:
            self.db.commit()
            self.db.refresh(schedule)
            
            # Structured logging
            log_schedule_updated(
                logger,
                schedule_id=schedule_id,
                fields_updated=fields_updated,
                updated_by_user_id=None  # Can be passed in if needed
            )
            
            return schedule
            
        except SQLAlchemyError as e:
            self.db.rollback()
            log_schedule_error(
                logger,
                'database_error_update',
                str(e),
                {'schedule_id': schedule_id, 'fields': fields_updated}
            )
            raise
    
    def delete_schedule(self, schedule_id: int) -> bool:
        """Delete a schedule"""
        schedule = self.get_schedule_by_id(schedule_id)
        if not schedule:
            return False
        
        schedule_name = schedule.name
        
        try:
            self.db.delete(schedule)
            self.db.commit()
            
            # Structured logging
            log_schedule_deleted(
                logger,
                schedule_id=schedule_id,
                schedule_name=schedule_name,
                deleted_by_user_id=None  # Can be passed in if needed
            )
            
            return True
            
        except SQLAlchemyError as e:
            self.db.rollback()
            log_schedule_error(
                logger,
                'database_error_delete',
                str(e),
                {'schedule_id': schedule_id}
            )
            raise
    
    # ==================== Schedule Evaluation ====================
    
    def get_active_schedule(
        self,
        device_id: int,
        at_datetime: Optional[datetime] = None
    ) -> Optional[ScheduledPlaylist]:
        """
        Determine which schedule should be active for a device at a given time.
        
        Implements the core evaluation logic with priority-based conflict resolution:
        1. Get all enabled schedules for device
        2. Filter to schedules matching current time
        3. Sort by effective priority (specific dates get +1000 boost)
        4. Return highest priority schedule
        
        Args:
            device_id: Display device ID
            at_datetime: Datetime to evaluate (defaults to now)
            
        Returns:
            Active schedule or None if no schedule matches
        """
        if at_datetime is None:
            at_datetime = datetime.now()
        
        # Get all enabled schedules for device
        schedules = self.db.query(ScheduledPlaylist).filter(
            ScheduledPlaylist.device_id == device_id,
            ScheduledPlaylist.enabled == True
        ).all()
        
        logger.info(f"📋 Found {len(schedules)} enabled schedules for device {device_id}")
        
        if not schedules:
            return None
        
        # Find matching schedules with their effective priorities
        active_schedules: List[Tuple[ScheduledPlaylist, int]] = []
        
        for schedule in schedules:
            is_active = schedule.is_active_at(at_datetime)
            logger.info(
                f"🧪 Schedule '{schedule.name}' (ID: {schedule.id}, type: {schedule.schedule_type.value}) "
                f"is_active_at({at_datetime.strftime('%Y-%m-%d %H:%M:%S')}): {is_active}"
            )
            if is_active:
                effective_priority = schedule.get_effective_priority()
                active_schedules.append((schedule, effective_priority))
                logger.info(f"✓ Added to active_schedules with priority {effective_priority}")
        
        if not active_schedules:
            return None
        
        # Sort by priority (highest first), then by id (stable sort)
        active_schedules.sort(key=lambda x: (-x[1], x[0].id))
        
        return active_schedules[0][0]
    
    def evaluate_all_devices(self) -> Dict[str, Any]:
        """
        Evaluate schedules for all devices and update playlist assignments.
        
        This is the main function called by the Celery Beat task every minute.
        
        Returns:
            Dictionary with evaluation statistics
        """
        evaluated_at = datetime.now()
        devices_evaluated = 0
        devices_changed = 0
        schedules_active = 0
        changes = []
        
        # Get all devices
        devices = self.db.query(DisplayDevice).all()
        
        for device in devices:
            devices_evaluated += 1
            
            # Get active schedule for this device
            logger.info(f"🔍 Evaluating device {device.id} at {evaluated_at.strftime('%Y-%m-%d %H:%M:%S')}")
            active_schedule = self.get_active_schedule(device.id, evaluated_at)
            
            if active_schedule:
                logger.info(f"✓ Found active schedule: {active_schedule.name} for device {device.id}")
            
            # Determine what playlist should be active
            if active_schedule:
                target_playlist_id = active_schedule.playlist_id
                schedules_active += 1
                schedule_name = active_schedule.name
            else:
                # No active schedule, keep current playlist (it's the default)
                target_playlist_id = device.playlist_id
                schedule_name = None
            
            # Check if playlist needs to change
            if device.playlist_id != target_playlist_id:
                old_playlist_id = device.playlist_id
                device.playlist_id = target_playlist_id
                devices_changed += 1
                
                changes.append({
                    'device_id': device.id,
                    'device_name': device.device_name,
                    'old_playlist_id': old_playlist_id,
                    'new_playlist_id': target_playlist_id,
                    'schedule_id': active_schedule.id if active_schedule else None,
                    'schedule_name': schedule_name,
                })
                
                # Structured logging for playlist change
                if active_schedule:
                    log_schedule_activation(
                        logger,
                        schedule_id=active_schedule.id,
                        schedule_name=active_schedule.name,
                        device_id=device.id,
                        device_name=device.device_name,
                        playlist_id=target_playlist_id,
                        old_playlist_id=old_playlist_id,
                        priority=active_schedule.priority,
                        reason=f"Schedule active at {evaluated_at.strftime('%H:%M')}"
                    )
                
                # Human-readable log
                logger.info(
                    f"Schedule change: Device {device.id} ({device.device_name}) "
                    f"playlist {old_playlist_id} → {target_playlist_id} "
                    f"(schedule: {schedule_name})"
                )
        
        # Commit all changes
        if devices_changed > 0:
            try:
                self.db.commit()
            except SQLAlchemyError as e:
                self.db.rollback()
                log_schedule_error(
                    logger,
                    'database_error_commit',
                    str(e),
                    {'devices_changed': devices_changed}
                )
                raise
        
        result = {
            'evaluated_at': evaluated_at.isoformat(),
            'devices_evaluated': devices_evaluated,
            'schedules_active': schedules_active,
            'devices_changed': devices_changed,
            'changes': changes
        }
        
        logger.debug(
            f"Schedule evaluation complete: {devices_evaluated} devices, "
            f"{schedules_active} active schedules, {devices_changed} changes"
        )
        
        return result
    
    def get_conflicting_schedules(
        self,
        device_id: int,
        schedule_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Find schedules that conflict (overlap) with each other on a device.
        
        Args:
            device_id: Device to check
            schedule_id: Optional specific schedule to check conflicts for
            
        Returns:
            List of conflict descriptions
        """
        schedules = self.get_schedules_for_device(device_id, enabled_only=True)
        
        if schedule_id:
            # Filter to only check conflicts for one schedule
            target_schedule = next((s for s in schedules if s.id == schedule_id), None)
            if not target_schedule:
                return []
            schedules = [target_schedule]
        
        conflicts = []
        
        # Check each schedule against all others
        for i, schedule1 in enumerate(schedules):
            for schedule2 in schedules[i+1:]:
                if self._schedules_overlap(schedule1, schedule2):
                    # Determine which wins
                    priority1 = schedule1.get_effective_priority()
                    priority2 = schedule2.get_effective_priority()
                    
                    if priority1 > priority2:
                        winner = schedule1
                        loser = schedule2
                    elif priority2 > priority1:
                        winner = schedule2
                        loser = schedule1
                    else:
                        # Equal priority, first created wins
                        winner = schedule1 if schedule1.id < schedule2.id else schedule2
                        loser = schedule2 if schedule1.id < schedule2.id else schedule1
                    
                    conflicts.append({
                        'schedule1_id': schedule1.id,
                        'schedule1_name': schedule1.name,
                        'schedule2_id': schedule2.id,
                        'schedule2_name': schedule2.name,
                        'winner_id': winner.id,
                        'winner_name': winner.name,
                        'loser_id': loser.id,
                        'loser_name': loser.name,
                        'reason': f"Priority {winner.get_effective_priority()} > {loser.get_effective_priority()}" if priority1 != priority2 else "Created first"
                    })
        
        return conflicts
    
    def _schedules_overlap(self, schedule1: ScheduledPlaylist, schedule2: ScheduledPlaylist) -> bool:
        """Check if two schedules can overlap in time"""
        # Recurring vs Recurring
        if schedule1.schedule_type == ScheduleType.RECURRING and schedule2.schedule_type == ScheduleType.RECURRING:
            # Check if they share any days
            shared_days = set(schedule1.days_of_week or []) & set(schedule2.days_of_week or [])
            if not shared_days:
                return False
            
            # Check if time ranges overlap
            return self._time_ranges_overlap(
                schedule1.start_time, schedule1.end_time,
                schedule2.start_time, schedule2.end_time
            )
        
        # Specific vs Specific
        elif schedule1.schedule_type == ScheduleType.SPECIFIC_DATE and schedule2.schedule_type == ScheduleType.SPECIFIC_DATE:
            # Check if dates match (considering annual recurrence)
            if schedule1.annual_recurrence and schedule2.annual_recurrence:
                # Both annual - check month/day
                dates_match = (
                    schedule1.specific_date.month == schedule2.specific_date.month and
                    schedule1.specific_date.day == schedule2.specific_date.day
                )
            elif schedule1.annual_recurrence or schedule2.annual_recurrence:
                # One annual, one specific - could overlap in future years
                dates_match = (
                    schedule1.specific_date.month == schedule2.specific_date.month and
                    schedule1.specific_date.day == schedule2.specific_date.day
                )
            else:
                # Both specific dates
                dates_match = schedule1.specific_date == schedule2.specific_date
            
            if not dates_match:
                return False
            
            # Check if time ranges overlap
            return self._time_ranges_overlap(
                schedule1.specific_start_time, schedule1.specific_end_time,
                schedule2.specific_start_time, schedule2.specific_end_time
            )
        
        # Recurring vs Specific or vice versa
        else:
            # These can theoretically overlap but it's complex to detect
            # For now, we'll say they can conflict (conservative approach)
            # The priority system will resolve it
            return True
    
    def _time_ranges_overlap(
        self,
        start1: dt_time,
        end1: dt_time,
        start2: dt_time,
        end2: dt_time
    ) -> bool:
        """Check if two time ranges overlap"""
        # Range 1: [start1, end1)
        # Range 2: [start2, end2)
        # Overlap if: start1 < end2 AND start2 < end1
        return start1 < end2 and start2 < end1
    
    def preview_schedule(
        self,
        device_id: int,
        at_date: date,
        at_time: dt_time
    ) -> Dict[str, Any]:
        """
        Preview what schedule would be active at a specific date/time.
        
        Useful for testing and verifying schedule configuration.
        
        Args:
            device_id: Device to preview
            at_date: Date to check
            at_time: Time to check
            
        Returns:
            Dictionary with active schedule and conflicts
        """
        check_datetime = datetime.combine(at_date, at_time)
        
        # Get all enabled schedules for device
        all_schedules = self.get_schedules_for_device(device_id, enabled_only=True)
        
        # Find all matching schedules with priorities
        matching = []
        for schedule in all_schedules:
            if schedule.is_active_at(check_datetime):
                matching.append({
                    'schedule': schedule,
                    'effective_priority': schedule.get_effective_priority()
                })
        
        # Sort by priority
        matching.sort(key=lambda x: (-x['effective_priority'], x['schedule'].id))
        
        # Get device default
        device = self.db.query(DisplayDevice).filter(DisplayDevice.id == device_id).first()
        
        result = {
            'datetime': check_datetime.isoformat(),
            'device_id': device_id,
            'device_name': device.device_name if device else None,
            'active_schedule': None,
            'conflicting_schedules': [],
            'default_playlist_id': device.playlist_id if device else None
        }
        
        if matching:
            # Winner is first in sorted list
            winner = matching[0]
            result['active_schedule'] = {
                'id': winner['schedule'].id,
                'name': winner['schedule'].name,
                'playlist_id': winner['schedule'].playlist_id,
                'priority': winner['schedule'].priority,
                'effective_priority': winner['effective_priority'],
                'schedule_type': winner['schedule'].schedule_type.value,
                'reason': 'Specific date schedule' if winner['schedule'].schedule_type == ScheduleType.SPECIFIC_DATE else 'Recurring schedule'
            }
            
            # Conflicting schedules (losers)
            for conflict in matching[1:]:
                result['conflicting_schedules'].append({
                    'id': conflict['schedule'].id,
                    'name': conflict['schedule'].name,
                    'playlist_id': conflict['schedule'].playlist_id,
                    'priority': conflict['schedule'].priority,
                    'effective_priority': conflict['effective_priority'],
                    'reason': f"Lower priority ({conflict['effective_priority']} < {winner['effective_priority']})"
                })
        
        return result

