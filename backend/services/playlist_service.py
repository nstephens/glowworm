from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional, Dict, Any
from models import Playlist, Image
from services.query_optimization_service import QueryOptimizationService
from services.caching_service import cached, invalidate_playlist_cache
import re
from utils.logger import get_logger

logger = get_logger(__name__)

class PlaylistService:
    """Service for managing playlist database operations with reference system"""
    
    def __init__(self, db: Session):
        self.db = db
        self.query_optimizer = QueryOptimizationService(db)
    
    def _generate_slug(self, name: str) -> str:
        """Generate URL-friendly slug from name"""
        # Convert to lowercase and replace spaces with hyphens
        slug = re.sub(r'[^\w\s-]', '', name.lower())
        slug = re.sub(r'[-\s]+', '-', slug)
        return slug.strip('-')
    
    def _ensure_unique_slug(self, slug: str, exclude_id: Optional[int] = None) -> str:
        """Ensure slug is unique by appending number if needed"""
        base_slug = slug
        counter = 1
        
        while True:
            query = self.db.query(Playlist).filter(Playlist.slug == slug)
            if exclude_id:
                query = query.filter(Playlist.id != exclude_id)
            
            if not query.first():
                return slug
            
            slug = f"{base_slug}-{counter}"
            counter += 1
    
    def create_playlist(self, name: str, is_default: bool = False) -> Playlist:
        """Create a new playlist"""
        try:
            # Generate unique slug
            slug = self._generate_slug(name)
            slug = self._ensure_unique_slug(slug)
            
            # If this is set as default, unset any existing default
            if is_default:
                self.db.query(Playlist).filter(Playlist.is_default == True).update(
                    {"is_default": False}
                )
            
            playlist = Playlist(
                name=name,
                slug=slug,
                is_default=is_default,
                sequence=[]  # Empty sequence initially
            )
            
            self.db.add(playlist)
            self.db.commit()
            self.db.refresh(playlist)
            
            # Invalidate related caches
            invalidate_playlist_cache()
            
            logger.info(f"Created playlist: {playlist.id}")
            return playlist
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to create playlist: {e}")
            raise
    
    def get_playlist_by_id(self, playlist_id: int) -> Optional[Playlist]:
        """Get playlist by ID"""
        return self.db.query(Playlist).filter(Playlist.id == playlist_id).first()
    
    def get_playlist_by_slug(self, slug: str) -> Optional[Playlist]:
        """Get playlist by slug"""
        return self.db.query(Playlist).filter(Playlist.slug == slug).first()
    
    def get_default_playlist(self) -> Optional[Playlist]:
        """Get the default playlist"""
        return self.db.query(Playlist).filter(Playlist.is_default == True).first()
    
    def get_all_playlists(self) -> List[Playlist]:
        """Get all playlists"""
        return self.db.query(Playlist).all()
    
    def update_playlist(self, playlist_id: int, name: Optional[str] = None, 
                       is_default: Optional[bool] = None, display_time_seconds: Optional[int] = None, 
                       display_mode: Optional[str] = None, show_image_info: Optional[bool] = None,
                       show_exif_date: Optional[bool] = None) -> Optional[Playlist]:
        """Update playlist"""
        try:
            playlist = self.get_playlist_by_id(playlist_id)
            if not playlist:
                return None
            
            # Update name and slug if provided
            if name is not None:
                playlist.name = name
                new_slug = self._generate_slug(name)
                playlist.slug = self._ensure_unique_slug(new_slug, exclude_id=playlist_id)
            
            # Handle default playlist setting
            if is_default is not None:
                if is_default:
                    # Unset any existing default
                    self.db.query(Playlist).filter(Playlist.is_default == True).update(
                        {"is_default": False}
                    )
                playlist.is_default = is_default
            
            # Update display time if provided
            if display_time_seconds is not None:
                playlist.display_time_seconds = display_time_seconds
            
            # Update display mode if provided
            if display_mode is not None:
                from models.playlist import DisplayMode
                try:
                    # Convert string to enum by finding matching value
                    # This supports all display modes dynamically
                    mode_found = False
                    for mode in DisplayMode:
                        if mode.value == display_mode:
                            playlist.display_mode = mode
                            mode_found = True
                            break
                    
                    if not mode_found:
                        logger.warning(f"Invalid display_mode value: {display_mode}, using DEFAULT")
                        playlist.display_mode = DisplayMode.DEFAULT
                except Exception as e:
                    logger.error(f"Error setting display_mode: {e}")
                    playlist.display_mode = DisplayMode.DEFAULT
            
            # Update show_image_info if provided
            if show_image_info is not None:
                playlist.show_image_info = show_image_info
            
            # Update show_exif_date if provided
            if show_exif_date is not None:
                playlist.show_exif_date = show_exif_date
            
            self.db.commit()
            self.db.refresh(playlist)
            
            # Invalidate related caches
            invalidate_playlist_cache(playlist.id)
            
            logger.info(f"Updated playlist: {playlist.id}")
            return playlist
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to update playlist: {e}")
            raise
    
    def delete_playlist(self, playlist_id: int) -> bool:
        """Delete playlist (images are not deleted, just removed from playlist)"""
        try:
            playlist = self.get_playlist_by_id(playlist_id)
            if not playlist:
                return False
            
            # Remove images from playlist (but don't delete the images)
            for image in playlist.images:
                image.playlist_id = None
            
            # Unassign any display devices from this playlist
            from models.display_device import DisplayDevice
            devices_assigned = self.db.query(DisplayDevice).filter(DisplayDevice.playlist_id == playlist_id).all()
            for device in devices_assigned:
                device.playlist_id = None
                logger.info(f"Unassigned device {device.id} from playlist {playlist_id}")
            
            # Delete playlist
            self.db.delete(playlist)
            self.db.commit()
            
            # Invalidate related caches
            invalidate_playlist_cache(playlist_id)
            
            logger.info(f"Deleted playlist: {playlist_id}")
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to delete playlist: {e}")
            raise
    
    def add_image_to_playlist(self, playlist_id: int, image_id: int, position: Optional[int] = None) -> bool:
        """Add image to playlist with optional position"""
        try:
            playlist = self.get_playlist_by_id(playlist_id)
            if not playlist:
                return False
            
            image = self.db.query(Image).filter(Image.id == image_id).first()
            if not image:
                return False
            
            # Add to playlist
            image.playlist_id = playlist_id
            
            # Update sequence
            sequence = playlist.sequence or []
            if position is not None and 0 <= position <= len(sequence):
                sequence.insert(position, image_id)
            else:
                sequence.append(image_id)
            
            playlist.sequence = sequence
            self.db.commit()
            
            logger.info(f"Added image {image_id} to playlist {playlist_id}")
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to add image to playlist: {e}")
            raise
    
    def remove_image_from_playlist(self, playlist_id: int, image_id: int) -> bool:
        """Remove image from playlist"""
        try:
            playlist = self.get_playlist_by_id(playlist_id)
            if not playlist:
                return False
            
            image = self.db.query(Image).filter(
                and_(Image.id == image_id, Image.playlist_id == playlist_id)
            ).first()
            
            if not image:
                return False
            
            # Remove from playlist
            image.playlist_id = None
            
            # Update sequence
            sequence = playlist.sequence or []
            if image_id in sequence:
                sequence.remove(image_id)
                playlist.sequence = sequence
            
            self.db.commit()
            
            logger.info(f"Removed image {image_id} from playlist {playlist_id}")
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to remove image from playlist: {e}")
            raise
    
    def reorder_playlist(self, playlist_id: int, image_ids: List[int]) -> bool:
        """Reorder images in playlist"""
        try:
            playlist = self.get_playlist_by_id(playlist_id)
            if not playlist:
                return False
            
            # Validate that all image IDs belong to this playlist
            playlist_image_ids = [img.id for img in playlist.images]
            if not all(img_id in playlist_image_ids for img_id in image_ids):
                return False
            
            # Update sequence
            playlist.sequence = image_ids
            self.db.commit()
            
            # Invalidate related caches
            invalidate_playlist_cache(playlist_id)
            
            logger.info(f"Reordered playlist {playlist_id}")
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to reorder playlist: {e}")
            raise
    
    def randomize_playlist(self, playlist_id: int) -> bool:
        """Randomize the order of images in playlist"""
        try:
            import random
            
            playlist = self.get_playlist_by_id(playlist_id)
            if not playlist or not playlist.images:
                logger.warning(f"Playlist {playlist_id} not found or has no images")
                return False
            
            # Get all image IDs and shuffle them
            image_ids = [img.id for img in playlist.images]
            logger.debug(f"Before shuffle: {image_ids[:5]}... (showing first 5)")
            random.shuffle(image_ids)
            logger.debug(f"After shuffle: {image_ids[:5]}... (showing first 5)")
            
            # Use the existing reorder_playlist method which should handle the sequence correctly
            return self.reorder_playlist(playlist_id, image_ids)
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to randomize playlist: {e}")
            raise
    
    @cached("playlist_images", ttl_seconds=300)
    def get_playlist_images_ordered(self, playlist_id: int) -> List[Image]:
        """Get playlist images in the correct order - using simple approach"""
        playlist = self.get_playlist_by_id(playlist_id)
        if not playlist:
            return []
        
        # If no sequence is set, return images in default order
        if not playlist.sequence:
            return playlist.images
        
        # Create a mapping of image_id to image object
        image_map = {img.id: img for img in playlist.images}
        
        # Order images according to the sequence
        ordered_images = []
        for image_id in playlist.sequence:
            if image_id in image_map:
                ordered_images.append(image_map[image_id])
        
        # Add any images not in the sequence (shouldn't happen, but safety check)
        for img in playlist.images:
            if img.id not in playlist.sequence:
                ordered_images.append(img)
        
        return ordered_images
    
    @cached("playlist_stats", ttl_seconds=1800)  # Cache for 30 minutes
    def get_playlist_statistics(self) -> Dict[str, Any]:
        """Get playlist statistics - using optimized query with caching"""
        return self.query_optimizer.get_playlist_statistics_optimized()
