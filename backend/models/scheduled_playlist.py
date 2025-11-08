from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, ForeignKey, Enum, Boolean, Time, Date
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base
import enum
from datetime import datetime, date, time as dt_time
from typing import Optional, List


class ScheduleType(str, enum.Enum):
    """Type of schedule: recurring (day of week) or specific date"""
    RECURRING = "recurring"
    SPECIFIC_DATE = "specific_date"


class ScheduledPlaylist(Base):
    """
    Scheduled playlist assignments for display devices.
    
    Enables automatic playlist switching based on time schedules:
    - Recurring schedules: Day of week + time range (e.g., Mon-Fri 9am-5pm)
    - Specific date schedules: Exact calendar dates (e.g., Christmas 2025)
    
    Priority system handles overlapping schedules:
    - Higher priority number wins
    - Specific dates automatically get +1000 priority boost
    - If equal priority, first created wins
    """
    __tablename__ = "scheduled_playlists"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("display_devices.id", ondelete="CASCADE"), nullable=False, index=True)
    playlist_id = Column(Integer, ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Schedule type determines which fields are used
    schedule_type = Column(
        Enum(ScheduleType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        index=True
    )
    
    # Recurring schedule fields (used when schedule_type = RECURRING)
    days_of_week = Column(JSON, nullable=True)  # Array: ["monday", "tuesday", "wednesday", ...]
    start_time = Column(Time, nullable=True)  # e.g., 09:00:00
    end_time = Column(Time, nullable=True)  # e.g., 17:00:00
    
    # Specific date schedule fields (used when schedule_type = SPECIFIC_DATE)
    specific_date = Column(Date, nullable=True)  # e.g., 2025-12-25
    specific_start_time = Column(Time, nullable=True)  # e.g., 00:00:00
    specific_end_time = Column(Time, nullable=True)  # e.g., 23:59:59
    annual_recurrence = Column(Boolean, default=False, nullable=False)  # Repeat every year for specific dates
    
    # Metadata
    name = Column(String(128), nullable=False, index=True)
    description = Column(Text, nullable=True)
    priority = Column(Integer, default=0, nullable=False, index=True)  # Higher number = higher priority
    enabled = Column(Boolean, default=True, nullable=False, index=True)
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Relationships
    device = relationship("DisplayDevice", back_populates="schedules")
    playlist = relationship("Playlist")
    created_by = relationship("User")

    def __repr__(self):
        return f"<ScheduledPlaylist(id={self.id}, name='{self.name}', device_id={self.device_id}, type='{self.schedule_type}')>"

    def to_dict(self):
        """Convert scheduled playlist to dictionary"""
        base_dict = {
            "id": self.id,
            "device_id": self.device_id,
            "playlist_id": self.playlist_id,
            "schedule_type": self.schedule_type.value,
            "name": self.name,
            "description": self.description,
            "priority": self.priority,
            "enabled": self.enabled,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "created_by_user_id": self.created_by_user_id,
        }
        
        # Add type-specific fields
        if self.schedule_type == ScheduleType.RECURRING:
            base_dict.update({
                "days_of_week": self.days_of_week,
                "start_time": self.start_time.isoformat() if self.start_time else None,
                "end_time": self.end_time.isoformat() if self.end_time else None,
            })
        elif self.schedule_type == ScheduleType.SPECIFIC_DATE:
            base_dict.update({
                "specific_date": self.specific_date.isoformat() if self.specific_date else None,
                "specific_start_time": self.specific_start_time.isoformat() if self.specific_start_time else None,
                "specific_end_time": self.specific_end_time.isoformat() if self.specific_end_time else None,
                "annual_recurrence": self.annual_recurrence,
            })
        
        return base_dict

    def is_active_at(self, check_datetime: Optional[datetime] = None) -> bool:
        """
        Check if this schedule is active at a given datetime.
        
        Args:
            check_datetime: The datetime to check (defaults to now)
            
        Returns:
            True if schedule matches the given datetime
        """
        if not self.enabled:
            return False
        
        if check_datetime is None:
            check_datetime = datetime.now()
        
        if self.schedule_type == ScheduleType.RECURRING:
            # Check day of week
            current_day = check_datetime.strftime('%A').lower()
            if self.days_of_week and current_day not in self.days_of_week:
                return False
            
            # Check time range
            current_time = check_datetime.time()
            if self.start_time and self.end_time:
                return self.start_time <= current_time < self.end_time
            
            return False
        
        elif self.schedule_type == ScheduleType.SPECIFIC_DATE:
            # Check date match
            current_date = check_datetime.date()
            
            if self.annual_recurrence:
                # Match month and day only (ignore year)
                if self.specific_date:
                    matches_date = (
                        current_date.month == self.specific_date.month and
                        current_date.day == self.specific_date.day
                    )
                else:
                    return False
            else:
                # Exact date match
                if self.specific_date:
                    matches_date = current_date == self.specific_date
                else:
                    return False
            
            if not matches_date:
                return False
            
            # Check time range
            current_time = check_datetime.time()
            if self.specific_start_time and self.specific_end_time:
                return self.specific_start_time <= current_time < self.specific_end_time
            
            return False
        
        return False

    def get_effective_priority(self) -> int:
        """
        Get the effective priority for conflict resolution.
        
        Specific date schedules get automatic +1000 boost to ensure
        they take precedence over recurring schedules.
        """
        if self.schedule_type == ScheduleType.SPECIFIC_DATE:
            return self.priority + 1000
        return self.priority

