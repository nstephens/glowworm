from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Enum, ForeignKey, JSON, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base
import secrets
import string
import enum

class DeviceStatus(str, enum.Enum):
    PENDING = "PENDING"
    AUTHORIZED = "AUTHORIZED"
    REJECTED = "REJECTED"
    OFFLINE = "OFFLINE"

class DisplayDevice(Base):
    __tablename__ = "display_devices"

    id = Column(Integer, primary_key=True, index=True)
    device_token = Column(String(255), unique=True, index=True, nullable=False)
    device_name = Column(String(100), nullable=True)
    device_identifier = Column(String(100), nullable=True)  # Custom identifier set by admin
    
    # Status and authorization
    status = Column(Enum(DeviceStatus, values_callable=lambda x: [e.value for e in x]), default=DeviceStatus.PENDING, nullable=False)
    authorized_by_user_id = Column(Integer, nullable=True)  # User who authorized this device
    authorized_at = Column(DateTime(timezone=True), nullable=True)
    
    # Playlist assignment
    playlist_id = Column(Integer, ForeignKey('playlists.id'), nullable=True)  # Assigned playlist for display
    
    # Device information
    user_agent = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)  # IPv6 compatible
    last_seen = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Display resolution information
    screen_width = Column(Integer, nullable=True)
    screen_height = Column(Integer, nullable=True)
    device_pixel_ratio = Column(String(10), nullable=True)  # e.g., "2.0", "1.5"
    orientation = Column(String(20), nullable=False, server_default='portrait')  # 'portrait' or 'landscape'
    
    # Daemon and remote control (CEC)
    cec_input_name = Column(String(64), nullable=True, comment="Selected CEC input name")
    cec_input_address = Column(String(16), nullable=True, comment="Selected CEC input address")
    daemon_enabled = Column(Boolean, default=False, nullable=False, comment="Whether daemon control is enabled")

    # Pi3D daemon status fields (cached from last WebSocket status)
    device_type = Column(String(20), nullable=True, default="pi3d", comment="Device type: pi3d")
    last_state = Column(String(32), nullable=True, comment="Last reported state: playing, paused, stopped, error")
    last_image_id = Column(Integer, nullable=True, comment="ID of currently displayed image")
    last_cache_size_mb = Column(Float, nullable=True, comment="Cache size in MB")
    last_cache_hit_rate = Column(Float, nullable=True, comment="Cache hit rate 0.0-1.0")
    last_cache_entry_count = Column(Integer, nullable=True, comment="Number of cached images")
    last_uptime_seconds = Column(Float, nullable=True, comment="Daemon uptime in seconds")
    last_status_json = Column(JSON, nullable=True, comment="Full last status payload as JSON")
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    playlist = relationship("Playlist", foreign_keys=[playlist_id])
    schedules = relationship("ScheduledPlaylist", back_populates="device", cascade="all, delete-orphan")
    daemon_status = relationship("DeviceDaemonStatus", back_populates="device", uselist=False, cascade="all, delete-orphan")
    commands = relationship("DeviceCommand", back_populates="device", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<DisplayDevice(id={self.id}, device_name='{self.device_name}', status='{self.status}')>"

    @classmethod
    def generate_device_token(cls) -> str:
        """Generate a short device token for easy display"""
        alphabet = string.ascii_uppercase + string.digits
        return ''.join(secrets.choice(alphabet) for _ in range(4))

    def to_dict(self):
        """Convert device to dictionary"""
        return {
            "id": self.id,
            "device_token": self.device_token,
            "device_name": self.device_name,
            "device_identifier": self.device_identifier,
            "status": self.status.value.lower(),  # Convert to lowercase for frontend compatibility
            "playlist_id": self.playlist_id,
            "playlist_name": self.playlist.name if self.playlist else None,
            "authorized_at": self.authorized_at.isoformat() if self.authorized_at else None,
            "last_seen": self.last_seen.isoformat() if self.last_seen else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "screen_width": self.screen_width,
            "screen_height": self.screen_height,
            "device_pixel_ratio": self.device_pixel_ratio,
            "orientation": self.orientation,
            # Pi3D daemon status fields
            "device_type": self.device_type or "pi3d",
            "last_state": self.last_state,
            "last_image_id": self.last_image_id,
            "last_cache_size_mb": self.last_cache_size_mb,
            "last_cache_hit_rate": self.last_cache_hit_rate,
            "last_cache_entry_count": self.last_cache_entry_count,
            "last_uptime_seconds": self.last_uptime_seconds,
        }
