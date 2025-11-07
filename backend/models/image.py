from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey, Enum, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base

class Image(Base):
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(256), nullable=False, index=True)
    original_filename = Column(String(256), nullable=False)
    album_id = Column(Integer, ForeignKey("albums.id"), nullable=True, index=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String(64), nullable=True)
    file_hash = Column(String(64), nullable=True, index=True)  # MD5 hash for duplicate detection
    exif = Column(JSON, nullable=True)
    dominant_colors = Column(JSON, nullable=True)  # Array of hex color strings ["#FF5733", "#33FF57", "#3357FF"]
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    
    # Background processing status fields
    processing_status = Column(
        Enum('pending', 'processing', 'complete', 'failed', name='processing_status_enum'),
        default='pending',
        nullable=False,
        index=True
    )
    thumbnail_status = Column(
        Enum('pending', 'processing', 'complete', 'failed', name='thumbnail_status_enum'),
        default='pending',
        nullable=False,
        index=True
    )
    variant_status = Column(
        Enum('pending', 'processing', 'complete', 'failed', name='variant_status_enum'),
        default='pending',
        nullable=False,
        index=True
    )
    processing_error = Column(Text, nullable=True)
    processing_attempts = Column(Integer, default=0, nullable=False)
    last_processing_attempt = Column(DateTime(timezone=True), nullable=True)
    processing_completed_at = Column(DateTime(timezone=True), nullable=True)
    
    playlist_id = Column(Integer, ForeignKey("playlists.id"), nullable=True, index=True)
    
    # Relationships
    album = relationship("Album", back_populates="images")
    playlist = relationship("Playlist", back_populates="images")

    def __repr__(self):
        return f"<Image(id={self.id}, filename='{self.filename}', original_filename='{self.original_filename}')>"

    def _get_upload_directory(self):
        """Get upload directory from settings"""
        try:
            from services.config_service import config_service
            return config_service.upload_directory
        except Exception:
            return "uploads"  # Fallback to hardcoded value if settings not available

    def to_dict(self):
        """Convert image to dictionary"""
        # Return relative URLs - let the frontend construct full URLs based on protocol
        # This prevents mixed content errors when accessing via HTTPS reverse proxy
        return {
            "id": self.id,
            "filename": self.filename,
            "original_filename": self.original_filename,
            "file_path": self.file_path,
            "album_id": self.album_id,
            "width": self.width,
            "height": self.height,
            "file_size": self.file_size,
            "mime_type": self.mime_type,
            "file_hash": self.file_hash,
            "exif": self.exif,
            "dominant_colors": self.dominant_colors,
            "uploaded_at": self.uploaded_at.isoformat() if self.uploaded_at else None,
            "playlist_id": self.playlist_id,
            "url": f"/api/images/{self.id}/file",
            "thumbnail_url": f"/api/images/{self.id}/file?size=medium&v={self.id}_{self.album_id or 0}",
            # Processing status fields
            "processing_status": self.processing_status,
            "thumbnail_status": self.thumbnail_status,
            "variant_status": self.variant_status,
            "processing_error": self.processing_error,
            "processing_attempts": self.processing_attempts,
            "last_processing_attempt": self.last_processing_attempt.isoformat() if self.last_processing_attempt else None,
            "processing_completed_at": self.processing_completed_at.isoformat() if self.processing_completed_at else None
        }

    @property
    def file_path(self):
        """Get the file path for this image"""
        from services.image_storage_service import image_storage_service
        actual_path = image_storage_service.get_image_path(self.filename)
        if actual_path:
            # Return relative path from project root
            return str(actual_path.relative_to(actual_path.parts[0]))
        return f"{self._get_upload_directory()}/{self.filename}"

    @property
    def thumbnail_path(self):
        """Get the thumbnail path for this image"""
        # This will be implemented in the storage service
        name, ext = self.filename.rsplit('.', 1)
        return f"{self._get_upload_directory()}/thumbnails/{name}_thumb.{ext}"
