"""
Device Daemon Status Model
Tracks daemon instances running on display devices
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON, Enum, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base
import enum


class DaemonStatus(str, enum.Enum):
    """Daemon online/offline status"""
    ONLINE = "online"
    OFFLINE = "offline"


class DeviceDaemonStatus(Base):
    """Daemon status tracking for display devices"""
    __tablename__ = "device_daemon_status"
    
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(
        Integer,
        ForeignKey('display_devices.id', ondelete='CASCADE'),
        nullable=False,
        unique=True,
        index=True,
    )
    
    # Daemon information
    daemon_version = Column(String(32), nullable=True)
    daemon_status = Column(
        Enum(DaemonStatus, values_callable=lambda x: [e.value for e in x]),
        default=DaemonStatus.OFFLINE,
        nullable=False,
        index=True,
    )
    last_heartbeat = Column(DateTime(timezone=True), nullable=True, index=True)
    
    # Capabilities
    capabilities = Column(JSON, nullable=True, comment="List of daemon capabilities")
    cec_available = Column(Boolean, default=False, nullable=False)
    cec_devices = Column(JSON, nullable=True, comment="List of detected CEC devices")
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    device = relationship("DisplayDevice", back_populates="daemon_status")
    
    def __repr__(self):
        return (
            f"<DeviceDaemonStatus(id={self.id}, device_id={self.device_id}, "
            f"status='{self.daemon_status}', version='{self.daemon_version}')>"
        )
    
    def to_dict(self):
        """Convert daemon status to dictionary"""
        return {
            "id": self.id,
            "device_id": self.device_id,
            "daemon_version": self.daemon_version,
            "daemon_status": self.daemon_status.value if self.daemon_status else None,
            "last_heartbeat": self.last_heartbeat.isoformat() if self.last_heartbeat else None,
            "capabilities": self.capabilities,
            "cec_available": self.cec_available,
            "cec_devices": self.cec_devices,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

