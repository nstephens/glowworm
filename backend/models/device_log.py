from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base
import enum

class LogLevel(str, enum.Enum):
    """Log level enumeration"""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"

class DeviceLog(Base):
    """Logs from display devices for remote troubleshooting"""
    __tablename__ = "device_logs"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey('display_devices.id'), nullable=False, index=True)
    log_level = Column(Enum(LogLevel, values_callable=lambda x: [e.value for e in x]), nullable=False, index=True, default=LogLevel.INFO)
    message = Column(Text, nullable=False)
    context = Column(JSON, nullable=True)  # Additional structured data (e.g., playlist info, errors, etc.)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    # Relationships
    device = relationship("DisplayDevice", backref="logs")

    def __repr__(self):
        return f"<DeviceLog(id={self.id}, device_id={self.device_id}, level='{self.log_level}', message='{self.message[:50]}...')>"

    def to_dict(self):
        """Convert log to dictionary"""
        return {
            "id": self.id,
            "device_id": self.device_id,
            "device_name": self.device.device_name if self.device else None,
            "device_token": self.device.device_token if self.device else None,
            "log_level": self.log_level.value.lower(),  # Return lowercase for frontend
            "message": self.message,
            "context": self.context,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

