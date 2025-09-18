from sqlalchemy import Column, Integer, String, Boolean, JSON, DateTime, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base
import enum

class DisplayMode(enum.Enum):
    DEFAULT = "default"
    AUTO_SORT = "auto_sort"
    MOVEMENT = "movement"

class Playlist(Base):
    __tablename__ = "playlists"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False, index=True)
    slug = Column(String(64), nullable=False, unique=True, index=True)
    is_default = Column(Boolean, default=False, nullable=True)
    sequence = Column(JSON, nullable=True)  # Array of image IDs in display order
    display_time_seconds = Column(Integer, nullable=True)  # Time to display each image in seconds
    display_mode = Column(Enum(DisplayMode), default=DisplayMode.DEFAULT, nullable=True)  # Display mode for the playlist
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=True)
    
    # Relationships
    images = relationship("Image", back_populates="playlist", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Playlist(id={self.id}, name='{self.name}', slug='{self.slug}')>"

    def _get_default_display_time(self):
        """Get default display time from settings"""
        try:
            from services.config_service import config_service
            return config_service.default_display_time_seconds
        except Exception:
            return 30  # Fallback to hardcoded value if settings not available

    def to_dict(self):
        """Convert playlist to dictionary"""
        try:
            # Handle display_mode safely - if it's None or invalid, default to DEFAULT
            display_mode_value = DisplayMode.DEFAULT.value  # Use .value for lowercase
            if self.display_mode:
                if hasattr(self.display_mode, 'value'):
                    display_mode_value = self.display_mode.value
                else:
                    # If it's a string, convert to lowercase
                    display_mode_value = str(self.display_mode).lower()
            
            return {
                "id": self.id,
                "name": self.name,
                "slug": self.slug,
                "is_default": self.is_default,
                "sequence": self.sequence,
                "display_time_seconds": self.display_time_seconds,
                "display_mode": display_mode_value,
                "created_at": self.created_at.isoformat() if self.created_at else None,
                "updated_at": self.updated_at.isoformat() if self.updated_at else None,
                "image_count": len(self.images) if self.images else 0
            }
        except Exception as e:
            # Log the error and return a safe default
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error converting playlist {self.id} to dict: {e}")
            return {
                "id": self.id,
                "name": self.name or "Unknown",
                "slug": self.slug or f"playlist-{self.id}",
                "is_default": self.is_default or False,
                "sequence": self.sequence or [],
                "display_time_seconds": self.display_time_seconds or self._get_default_display_time(),
                "display_mode": DisplayMode.DEFAULT.value,
                "created_at": None,
                "updated_at": None,
                "image_count": 0
            }
