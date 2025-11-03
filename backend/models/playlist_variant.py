"""
Playlist variant model for resolution-specific playlists
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Enum, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
import enum

class PlaylistVariantType(str, enum.Enum):
    """Types of playlist variants based on resolution"""
    ORIGINAL = "original"  # Original resolution, no filtering
    PORTRAIT_2K = "2k_portrait"  # 1080x1920
    PORTRAIT_4K = "4k_portrait"  # 2160x3840
    LANDSCAPE_2K = "2k_landscape"  # 1920x1080
    LANDSCAPE_4K = "4k_landscape"  # 3840x2160
    CUSTOM = "custom"  # Custom resolution

    @classmethod
    def get_variant_type_for_resolution(cls, width: int, height: int):
        """Determine variant type based on resolution"""
        if width == 1080 and height == 1920:
            return cls.PORTRAIT_2K
        elif width == 2160 and height == 3840:
            return cls.PORTRAIT_4K
        elif width == 1920 and height == 1080:
            return cls.LANDSCAPE_2K
        elif width == 3840 and height == 2160:
            return cls.LANDSCAPE_4K
        else:
            # Fallback to custom for other resolutions
            return cls.CUSTOM

class PlaylistVariant(Base):
    __tablename__ = "playlist_variants"

    id = Column(Integer, primary_key=True, index=True)
    playlist_id = Column(Integer, ForeignKey('playlists.id'), nullable=False, index=True)
    variant_type = Column(Enum(PlaylistVariantType, values_callable=lambda x: [e.value for e in x]), nullable=False, index=True)
    target_width = Column(Integer, nullable=True)  # Target width for this variant
    target_height = Column(Integer, nullable=True)  # Target height for this variant
    
    # Optimized sequence for this resolution
    optimized_sequence = Column(JSON, nullable=True)  # Array of image IDs optimized for this resolution
    image_count = Column(Integer, default=0)  # Number of images in this variant
    
    # Filtering criteria used to create this variant
    min_width = Column(Integer, nullable=True)  # Minimum image width to include
    max_width = Column(Integer, nullable=True)  # Maximum image width to include
    min_height = Column(Integer, nullable=True)  # Minimum image height to include
    max_height = Column(Integer, nullable=True)  # Maximum image height to include
    preferred_orientation = Column(String(20), nullable=True)  # 'portrait', 'landscape', or None
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    playlist = relationship("Playlist", back_populates="variants")

    def __repr__(self):
        return f"<PlaylistVariant(id={self.id}, playlist_id={self.playlist_id}, type='{self.variant_type}', images={self.image_count})>"

    def to_dict(self):
        """Convert playlist variant to dictionary"""
        return {
            "id": self.id,
            "playlist_id": self.playlist_id,
            "variant_type": self.variant_type.value,
            "target_width": self.target_width,
            "target_height": self.target_height,
            "optimized_sequence": self.optimized_sequence or [],
            "image_count": self.image_count,
            "min_width": self.min_width,
            "max_width": self.max_width,
            "min_height": self.min_height,
            "max_height": self.max_height,
            "preferred_orientation": self.preferred_orientation,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

    @classmethod
    def get_variant_type_for_resolution(cls, width: int, height: int) -> 'PlaylistVariantType':
        """Determine variant type based on resolution"""
        if width == 1080 and height == 1920:
            return PlaylistVariantType.PORTRAIT_2K
        elif width == 2160 and height == 3840:
            return PlaylistVariantType.PORTRAIT_4K
        elif width == 1920 and height == 1080:
            return PlaylistVariantType.LANDSCAPE_2K
        elif width == 3840 and height == 2160:
            return PlaylistVariantType.LANDSCAPE_4K
        else:
            return PlaylistVariantType.CUSTOM

    def get_resolution_string(self) -> str:
        """Get resolution as string (e.g., '1080x1920')"""
        if self.target_width and self.target_height:
            return f"{self.target_width}x{self.target_height}"
        return self.variant_type.value
