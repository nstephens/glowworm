"""
Device Command Model
Manages command queue for device daemons
"""
from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, Enum, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base
import enum


class CommandType(str, enum.Enum):
    """Available command types"""
    UPDATE_URL = "update_url"
    CEC_POWER_ON = "cec_power_on"
    CEC_POWER_OFF = "cec_power_off"
    CEC_SET_INPUT = "cec_set_input"
    CEC_SCAN_INPUTS = "cec_scan_inputs"


class CommandStatus(str, enum.Enum):
    """Command execution status"""
    PENDING = "pending"
    SENT = "sent"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"


class DeviceCommand(Base):
    """Command queue for device daemons"""
    __tablename__ = "device_commands"
    
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(
        Integer,
        ForeignKey('display_devices.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    
    # Command details
    command_type = Column(
        Enum(CommandType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    command_data = Column(JSON, nullable=True, comment="Command parameters")
    
    # Status tracking
    status = Column(
        Enum(CommandStatus, values_callable=lambda x: [e.value for e in x]),
        default=CommandStatus.PENDING,
        nullable=False,
        index=True,
    )
    result = Column(JSON, nullable=True, comment="Command execution result")
    error_message = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Created by user (for audit trail)
    created_by_user_id = Column(
        Integer,
        ForeignKey('users.id', ondelete='SET NULL'),
        nullable=True,
    )
    
    # Relationships
    device = relationship("DisplayDevice", back_populates="commands")
    created_by = relationship("User")
    
    def __repr__(self):
        return (
            f"<DeviceCommand(id={self.id}, device_id={self.device_id}, "
            f"type='{self.command_type}', status='{self.status}')>"
        )
    
    def to_dict(self):
        """Convert command to dictionary"""
        return {
            "id": self.id,
            "device_id": self.device_id,
            "command_type": self.command_type.value if self.command_type else None,
            "command_data": self.command_data,
            "status": self.status.value if self.status else None,
            "result": self.result,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "created_by_user_id": self.created_by_user_id,
        }

