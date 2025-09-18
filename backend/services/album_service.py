from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional, Dict, Any
from models import Album, Image
import logging

logger = logging.getLogger(__name__)

class AlbumService:
    """Service for managing album database operations"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_album(self, name: str) -> Album:
        """Create a new album"""
        try:
            album = Album(name=name)
            self.db.add(album)
            self.db.commit()
            self.db.refresh(album)
            
            logger.info(f"Created album: {album.id}")
            return album
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to create album: {e}")
            raise
    
    def get_album_by_id(self, album_id: int) -> Optional[Album]:
        """Get album by ID"""
        return self.db.query(Album).filter(Album.id == album_id).first()
    
    def get_album_by_name(self, name: str) -> Optional[Album]:
        """Get album by name"""
        return self.db.query(Album).filter(Album.name == name).first()
    
    def get_all_albums(self) -> List[Album]:
        """Get all albums"""
        return self.db.query(Album).all()
    
    def update_album(self, album_id: int, name: str) -> Optional[Album]:
        """Update album name"""
        try:
            album = self.get_album_by_id(album_id)
            if not album:
                return None
            
            album.name = name
            self.db.commit()
            self.db.refresh(album)
            
            logger.info(f"Updated album: {album.id}")
            return album
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to update album: {e}")
            raise
    
    def delete_album(self, album_id: int) -> bool:
        """Delete album and move images to default album"""
        try:
            album = self.get_album_by_id(album_id)
            if not album:
                return False
            
            # Move all images to default album (album_id = None)
            for image in album.images:
                image.album_id = None
            
            # Delete album
            self.db.delete(album)
            self.db.commit()
            
            logger.info(f"Deleted album: {album_id}")
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to delete album: {e}")
            raise
    
    def add_image_to_album(self, album_id: int, image_id: int) -> bool:
        """Add image to album"""
        try:
            album = self.get_album_by_id(album_id)
            if not album:
                return False
            
            image = self.db.query(Image).filter(Image.id == image_id).first()
            if not image:
                return False
            
            image.album_id = album_id
            self.db.commit()
            
            logger.info(f"Added image {image_id} to album {album_id}")
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to add image to album: {e}")
            raise
    
    def remove_image_from_album(self, album_id: int, image_id: int) -> bool:
        """Remove image from album"""
        try:
            image = self.db.query(Image).filter(
                and_(Image.id == image_id, Image.album_id == album_id)
            ).first()
            
            if not image:
                return False
            
            image.album_id = None
            self.db.commit()
            
            logger.info(f"Removed image {image_id} from album {album_id}")
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to remove image from album: {e}")
            raise
    
    def get_album_statistics(self) -> Dict[str, Any]:
        """Get album statistics"""
        total_albums = self.db.query(Album).count()
        albums_with_images = self.db.query(Album).join(Image).distinct().count()
        
        return {
            'total_albums': total_albums,
            'albums_with_images': albums_with_images,
            'empty_albums': total_albums - albums_with_images
        }
