"""
Scheduled Action Model
Supports display control actions (power, input) on schedules
Works alongside ScheduledPlaylist for complete automation
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, ForeignKey, Enum, Boolean, Time, Date
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base
import enum
from datetime import datetime, date, time as dt_time, timedelta
from typing import Optional


class ActionType(str, enum.Enum):
    """Types of scheduled actions"""
    POWER_ON = "power_on"
    POWER_OFF = "power_off"
    SET_INPUT = "set_input"


class ScheduledAction(Base):
    """
    Scheduled display actions for devices with daemon support
    
    Enables automated display control:
    - Power on/off at specific times
    - HDMI input switching
    - Integration with playlist schedules
    
    Uses same schedule types as ScheduledPlaylist (recurring, specific_date)
    """
    __tablename__ = "scheduled_actions"
    
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("display_devices.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Action configuration
    action_type = Column(
        Enum(ActionType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        index=True
    )
    action_data = Column(JSON, nullable=True, comment="Action-specific parameters (e.g., input_address)")
    
    # Schedule type (same as ScheduledPlaylist)
    schedule_type = Column(
        String(20),  # Using String instead of Enum to reuse ScheduleType from scheduled_playlist
        nullable=False,
        index=True
    )
    
    # Recurring schedule fields
    days_of_week = Column(JSON, nullable=True)
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    
    # Specific date schedule fields
    specific_date = Column(Date, nullable=True)
    specific_start_time = Column(Time, nullable=True)
    specific_end_time = Column(Time, nullable=True)
    annual_recurrence = Column(Boolean, default=False, nullable=False)
    
    # Metadata
    name = Column(String(128), nullable=False, index=True)
    description = Column(Text, nullable=True)
    priority = Column(Integer, default=0, nullable=False, index=True)
    enabled = Column(Boolean, default=True, nullable=False, index=True)
    
    # Execution tracking (for persistent catch-up)
    last_executed_at = Column(DateTime(timezone=True), nullable=True)
    catch_up_window_minutes = Column(Integer, default=10, nullable=False)
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Relationships
    device = relationship("DisplayDevice")
    created_by = relationship("User")
    
    def __repr__(self):
        return (
            f"<ScheduledAction(id={self.id}, name='{self.name}', "
            f"action='{self.action_type}', device_id={self.device_id})>"
        )
    
    def to_dict(self):
        """Convert scheduled action to dictionary"""
        return {
            "id": self.id,
            "device_id": self.device_id,
            "action_type": self.action_type.value if self.action_type else None,
            "action_data": self.action_data,
            "schedule_type": self.schedule_type,
            "days_of_week": self.days_of_week,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "specific_date": self.specific_date.isoformat() if self.specific_date else None,
            "specific_start_time": self.specific_start_time.isoformat() if self.specific_start_time else None,
            "specific_end_time": self.specific_end_time.isoformat() if self.specific_end_time else None,
            "annual_recurrence": self.annual_recurrence,
            "name": self.name,
            "description": self.description,
            "priority": self.priority,
            "enabled": self.enabled,
            "last_executed_at": self.last_executed_at.isoformat() if self.last_executed_at else None,
            "catch_up_window_minutes": self.catch_up_window_minutes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by_user_id": self.created_by_user_id,
        }
    
    def is_active_at(self, check_time: datetime) -> bool:
        """
        Check if action is active at given time
        
        Args:
            check_time: Datetime to check (should be in local timezone)
        
        Returns:
            True if action should be active at this time
        """
        if not self.enabled:
            return False
        
        if self.schedule_type == "recurring":
            return self._check_recurring_schedule(check_time)
        elif self.schedule_type == "specific_date":
            return self._check_specific_date_schedule(check_time)
        
        return False
    
    def _check_recurring_schedule(self, check_time: datetime) -> bool:
        """Check if recurring schedule is active"""
        if not self.days_of_week or not self.start_time:
            return False
        
        day_name = check_time.strftime("%A").lower()
        
        if day_name not in [d.lower() for d in self.days_of_week]:
            return False
        
        current_time = check_time.time()
        
        if self.end_time:
            return self.start_time <= current_time <= self.end_time
        else:
            return current_time >= self.start_time
    
    def _check_specific_date_schedule(self, check_time: datetime) -> bool:
        """Check if specific date schedule is active"""
        if not self.specific_date or not self.specific_start_time:
            return False
        
        check_date = check_time.date()
        
        # Check if date matches
        if self.annual_recurrence:
            # Match month and day only
            matches_date = (
                check_date.month == self.specific_date.month and
                check_date.day == self.specific_date.day
            )
        else:
            matches_date = check_date == self.specific_date
        
        if not matches_date:
            return False
        
        # Check time range
        current_time = check_time.time()
        
        if self.specific_end_time:
            return self.specific_start_time <= current_time <= self.specific_end_time
        else:
            return current_time >= self.specific_start_time
    
    def should_execute_at(self, check_time: datetime) -> bool:
        """
        Check if action should execute at given time, with catch-up logic
        
        This method implements persistent execution:
        - Returns True if action is currently active AND hasn't executed yet
        - Returns True if action was recently scheduled but missed (within catch-up window)
        - Returns False if action already executed for this occurrence
        
        Args:
            check_time: Datetime to check (should be in local timezone)
        
        Returns:
            True if action should execute now (create command)
        """
        if not self.enabled:
            return False
        
        # Check if action is scheduled for this time
        if self.schedule_type == "recurring":
            return self._should_execute_recurring(check_time)
        elif self.schedule_type == "specific_date":
            return self._should_execute_specific_date(check_time)
        
        return False
    
    def _should_execute_recurring(self, check_time: datetime) -> bool:
        """Check if recurring action should execute with catch-up"""
        if not self.days_of_week or not self.start_time:
            return False
        
        day_name = check_time.strftime("%A").lower()
        if day_name not in [d.lower() for d in self.days_of_week]:
            return False
        
        current_time = check_time.time()
        
        # For recurring actions, we only care about the start_time (the trigger point)
        # Calculate when the action should have triggered today
        trigger_datetime = datetime.combine(check_time.date(), self.start_time)
        
        # Check if we're within the catch-up window after the trigger time
        time_since_trigger = (check_time - trigger_datetime).total_seconds() / 60
        
        # If we're before the trigger time, not ready yet
        if time_since_trigger < 0:
            return False
        
        # If we're past the catch-up window, missed it for today
        if time_since_trigger > self.catch_up_window_minutes:
            return False
        
        # Check if we already executed for this occurrence
        if self.last_executed_at:
            # If we executed today after the trigger time, don't execute again
            if (self.last_executed_at.date() == check_time.date() and
                self.last_executed_at.time() >= self.start_time):
                return False
        
        # We're within window and haven't executed yet
        return True
    
    def _should_execute_specific_date(self, check_time: datetime) -> bool:
        """Check if specific date action should execute with catch-up"""
        if not self.specific_date or not self.specific_start_time:
            return False
        
        check_date = check_time.date()
        
        # Check if date matches
        if self.annual_recurrence:
            matches_date = (
                check_date.month == self.specific_date.month and
                check_date.day == self.specific_date.day
            )
        else:
            matches_date = check_date == self.specific_date
        
        if not matches_date:
            return False
        
        # Calculate when the action should have triggered
        trigger_datetime = datetime.combine(check_date, self.specific_start_time)
        
        # Check if we're within the catch-up window after the trigger time
        time_since_trigger = (check_time - trigger_datetime).total_seconds() / 60
        
        # If we're before the trigger time, not ready yet
        if time_since_trigger < 0:
            return False
        
        # If we're past the catch-up window, missed it
        if time_since_trigger > self.catch_up_window_minutes:
            return False
        
        # Check if we already executed for this occurrence
        if self.last_executed_at:
            # For specific dates, check if we executed on this date after the trigger time
            if (self.last_executed_at.date() == check_date and
                self.last_executed_at.time() >= self.specific_start_time):
                return False
        
        # We're within window and haven't executed yet
        return True

