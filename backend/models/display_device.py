from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Enum, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base
import secrets
import string
import enum

class DeviceStatus(str, enum.Enum):
    PENDING = "pending"
    AUTHORIZED = "authorized"
    REJECTED = "rejected"
    OFFLINE = "offline"

class DisplayDevice(Base):
    __tablename__ = "display_devices"

    id = Column(Integer, primary_key=True, index=True)
    device_token = Column(String(255), unique=True, index=True, nullable=False)
    device_name = Column(String(100), nullable=True)
    device_identifier = Column(String(100), nullable=True)  # Custom identifier set by admin
    
    # Status and authorization
    status = Column(Enum(DeviceStatus), default=DeviceStatus.PENDING, nullable=False)
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
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    playlist = relationship("Playlist", foreign_keys=[playlist_id])

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
            "status": self.status.value,
            "playlist_id": self.playlist_id,
            "playlist_name": self.playlist.name if self.playlist else None,
            "authorized_at": self.authorized_at.isoformat() if self.authorized_at else None,
            "last_seen": self.last_seen.isoformat() if self.last_seen else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "screen_width": self.screen_width,
            "screen_height": self.screen_height,
            "device_pixel_ratio": self.device_pixel_ratio,
        }
