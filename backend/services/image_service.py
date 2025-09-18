from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional, Dict, Any
from models import Image, Album, Playlist
from services.image_storage_service import image_storage_service
from services.query_optimization_service import QueryOptimizationService
from services.caching_service import cached, invalidate_image_cache
import logging

logger = logging.getLogger(__name__)

class ImageService:
    """Service for managing image database operations"""
    
    def __init__(self, db: Session):
        self.db = db
        self.query_optimizer = QueryOptimizationService(db)
    
    def create_image(
        self,
        filename: str,
        original_filename: str,
        width: int,
        height: int,
        file_size: int,
        mime_type: str,
        file_hash: Optional[str] = None,
        exif_data: Optional[Dict[str, Any]] = None,
        album_id: Optional[int] = None,
        playlist_id: Optional[int] = None
    ) -> Image:
        """Create a new image record in the database"""
        try:
            image = Image(
                filename=filename,
                original_filename=original_filename,
                width=width,
                height=height,
                file_size=file_size,
                mime_type=mime_type,
                file_hash=file_hash,
                exif=exif_data,
                album_id=album_id,
                playlist_id=playlist_id
            )
            
            self.db.add(image)
            self.db.commit()
            self.db.refresh(image)
            
            # Invalidate related caches
            invalidate_image_cache()
            
            logger.info(f"Created image record: {image.id}")
            return image
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to create image record: {e}")
            raise
    
    def get_image_by_id(self, image_id: int) -> Optional[Image]:
        """Get image by ID"""
        return self.db.query(Image).filter(Image.id == image_id).first()
    
    def get_image_by_filename(self, filename: str) -> Optional[Image]:
        """Get image by filename"""
        return self.db.query(Image).filter(Image.filename == filename).first()
    
    def get_image_by_hash(self, file_hash: str) -> Optional[Image]:
        """Get image by file hash for duplicate detection"""
        return self.db.query(Image).filter(Image.file_hash == file_hash).first()
    
    def check_duplicate_by_hash(self, file_hash: str) -> bool:
        """Check if an image with the given hash already exists"""
        return self.get_image_by_hash(file_hash) is not None
    
    def get_images_by_album(self, album_id: int) -> List[Image]:
        """Get all images in an album"""
        return self.db.query(Image).filter(Image.album_id == album_id).all()
    
    def get_images_by_playlist(self, playlist_id: int) -> List[Image]:
        """Get all images in a playlist"""
        return self.db.query(Image).filter(Image.playlist_id == playlist_id).all()
    
    @cached("image_list", ttl_seconds=300)
    def get_all_images(self, limit: int = 100, offset: int = 0) -> List[Image]:
        """Get all images with pagination - using optimized query with caching"""
        return self.query_optimizer.get_images_optimized(limit=limit, offset=offset)
    
    @cached("image_search", ttl_seconds=600)
    def search_images(self, query: str) -> List[Image]:
        """Search images by filename or original filename - using optimized query with caching"""
        return self.query_optimizer.search_images_optimized(query)
    
    def update_image(self, image_id: int, **kwargs) -> Optional[Image]:
        """Update image record"""
        try:
            image = self.get_image_by_id(image_id)
            if not image:
                return None
            
            for key, value in kwargs.items():
                if hasattr(image, key):
                    setattr(image, key, value)
            
            self.db.commit()
            self.db.refresh(image)
            
            # Invalidate related caches
            invalidate_image_cache(image.id)
            
            logger.info(f"Updated image record: {image.id}")
            return image
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to update image record: {e}")
            raise
    
    def delete_image(self, image_id: int) -> bool:
        """Delete image record and associated files"""
        try:
            image = self.get_image_by_id(image_id)
            if not image:
                return False
            
            # Delete physical files
            success = image_storage_service.delete_image(image.filename)
            if not success:
                logger.warning(f"Failed to delete physical files for image {image_id}")
            
            # Delete database record
            self.db.delete(image)
            self.db.commit()
            
            # Invalidate related caches
            invalidate_image_cache(image_id)
            
            logger.info(f"Deleted image record: {image_id}")
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to delete image record: {e}")
            raise
    
    @cached("image_stats", ttl_seconds=1800)  # Cache for 30 minutes
    def get_image_statistics(self) -> Dict[str, Any]:
        """Get image statistics - using optimized query with caching"""
        return self.query_optimizer.get_image_statistics_optimized()
    
    @cached("duplicate_images", ttl_seconds=3600)  # Cache for 1 hour
    def get_duplicate_images(self) -> List[List[Image]]:
        """Find potential duplicate images based on file size and dimensions - using optimized query with caching"""
        return self.query_optimizer.get_duplicate_images_optimized()
