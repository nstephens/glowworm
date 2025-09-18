import hashlib
import os
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import logging

from models import Image, Album, Playlist
from services.image_storage_service import image_storage_service

logger = logging.getLogger(__name__)

class StorageEfficiencyService:
    """Service for managing storage efficiency and preventing duplicate files"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def _calculate_file_hash(self, file_path: Path) -> Optional[str]:
        """Calculate SHA-256 hash of a file"""
        try:
            hash_sha256 = hashlib.sha256()
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    hash_sha256.update(chunk)
            return hash_sha256.hexdigest()
        except Exception as e:
            logger.error(f"Failed to calculate hash for {file_path}: {e}")
            return None
    
    def _calculate_content_hash(self, file_bytes: bytes) -> str:
        """Calculate SHA-256 hash of file content"""
        return hashlib.sha256(file_bytes).hexdigest()
    
    def find_duplicate_files(self) -> List[List[Dict[str, Any]]]:
        """Find duplicate files based on content hash"""
        duplicates = []
        processed_hashes = set()
        
        # Get all images with their file paths
        images = self.db.query(Image).all()
        image_hashes = {}
        
        for image in images:
            file_path = image_storage_service.get_image_path(image.filename)
            if file_path and file_path.exists():
                file_hash = self._calculate_file_hash(file_path)
                if file_hash:
                    if file_hash not in image_hashes:
                        image_hashes[file_hash] = []
                    image_hashes[file_hash].append({
                        'image': image,
                        'file_path': file_path,
                        'hash': file_hash
                    })
        
        # Find groups of duplicates
        for file_hash, image_group in image_hashes.items():
            if len(image_group) > 1 and file_hash not in processed_hashes:
                duplicates.append(image_group)
                processed_hashes.add(file_hash)
        
        return duplicates
    
    def find_similar_images(self, threshold: float = 0.95) -> List[List[Dict[str, Any]]]:
        """Find similar images based on file size and dimensions"""
        similar_groups = []
        processed = set()
        
        # Get images with metadata
        images = self.db.query(Image).filter(
            and_(
                Image.file_size.isnot(None),
                Image.width.isnot(None),
                Image.height.isnot(None)
            )
        ).all()
        
        for i, image1 in enumerate(images):
            if image1.id in processed:
                continue
            
            similar_group = [image1]
            
            for j, image2 in enumerate(images[i+1:], i+1):
                if image2.id in processed:
                    continue
                
                # Calculate similarity based on size and dimensions
                size_ratio = min(image1.file_size, image2.file_size) / max(image1.file_size, image2.file_size)
                width_ratio = min(image1.width, image2.width) / max(image1.width, image2.width)
                height_ratio = min(image1.height, image2.height) / max(image1.height, image2.height)
                
                # Calculate overall similarity
                similarity = (size_ratio + width_ratio + height_ratio) / 3
                
                if similarity >= threshold:
                    similar_group.append(image2)
                    processed.add(image2.id)
            
            if len(similar_group) > 1:
                similar_groups.append(similar_group)
                for img in similar_group:
                    processed.add(img.id)
        
        return similar_groups
    
    def merge_duplicate_images(self, duplicate_group: List[Dict[str, Any]], keep_image_id: int) -> bool:
        """Merge duplicate images by keeping one and updating references"""
        try:
            # Find the image to keep
            keep_image = None
            images_to_remove = []
            
            for item in duplicate_group:
                if item['image'].id == keep_image_id:
                    keep_image = item['image']
                else:
                    images_to_remove.append(item['image'])
            
            if not keep_image:
                return False
            
            # Update all references to point to the kept image
            for image_to_remove in images_to_remove:
                # Update album references
                if image_to_remove.album_id:
                    # If keep image doesn't have an album, assign it
                    if not keep_image.album_id:
                        keep_image.album_id = image_to_remove.album_id
                
                # Update playlist references
                if image_to_remove.playlist_id:
                    # If keep image doesn't have a playlist, assign it
                    if not keep_image.playlist_id:
                        keep_image.playlist_id = image_to_remove.playlist_id
                
                # Delete the duplicate image record
                self.db.delete(image_to_remove)
            
            # Delete physical files for removed images
            for item in duplicate_group:
                if item['image'].id != keep_image_id:
                    image_storage_service.delete_image(item['image'].filename)
            
            self.db.commit()
            logger.info(f"Merged {len(images_to_remove)} duplicate images into image {keep_image_id}")
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to merge duplicate images: {e}")
            return False
    
    def optimize_storage(self) -> Dict[str, Any]:
        """Run storage optimization and return results"""
        results = {
            'duplicate_files_found': 0,
            'similar_images_found': 0,
            'space_saved_bytes': 0,
            'files_removed': 0,
            'optimization_completed': False
        }
        
        try:
            # Find duplicate files
            duplicate_files = self.find_duplicate_files()
            results['duplicate_files_found'] = len(duplicate_files)
            
            # Find similar images
            similar_images = self.find_similar_images()
            results['similar_images_found'] = len(similar_images)
            
            # Calculate potential space savings
            total_space_saved = 0
            total_files_removed = 0
            
            for duplicate_group in duplicate_files:
                if len(duplicate_group) > 1:
                    # Calculate space that could be saved
                    group_size = duplicate_group[0]['image'].file_size or 0
                    space_saved = group_size * (len(duplicate_group) - 1)
                    total_space_saved += space_saved
                    total_files_removed += len(duplicate_group) - 1
            
            results['space_saved_bytes'] = total_space_saved
            results['files_removed'] = total_files_removed
            results['optimization_completed'] = True
            
            logger.info(f"Storage optimization completed: {total_files_removed} files could be removed, {total_space_saved} bytes saved")
            
        except Exception as e:
            logger.error(f"Storage optimization failed: {e}")
            results['error'] = str(e)
        
        return results
    
    def get_storage_statistics(self) -> Dict[str, Any]:
        """Get comprehensive storage statistics"""
        try:
            # Basic statistics
            total_images = self.db.query(Image).count()
            total_size = self.db.query(Image.file_size).filter(Image.file_size.isnot(None)).all()
            total_size_bytes = sum(size[0] for size in total_size if size[0])
            
            # Find duplicates
            duplicate_files = self.find_duplicate_files()
            similar_images = self.find_similar_images()
            
            # Calculate potential savings
            potential_savings = 0
            duplicate_count = 0
            
            for duplicate_group in duplicate_files:
                if len(duplicate_group) > 1:
                    group_size = duplicate_group[0]['image'].file_size or 0
                    potential_savings += group_size * (len(duplicate_group) - 1)
                    duplicate_count += len(duplicate_group) - 1
            
            # File format distribution
            format_stats = {}
            for image in self.db.query(Image.mime_type).distinct():
                if image.mime_type:
                    format_name = image.mime_type.split('/')[-1].upper()
                    count = self.db.query(Image).filter(Image.mime_type == image.mime_type).count()
                    format_stats[format_name] = count
            
            return {
                'total_images': total_images,
                'total_size_bytes': total_size_bytes,
                'total_size_mb': round(total_size_bytes / (1024 * 1024), 2),
                'duplicate_files': len(duplicate_files),
                'similar_images': len(similar_images),
                'potential_duplicates': duplicate_count,
                'potential_savings_bytes': potential_savings,
                'potential_savings_mb': round(potential_savings / (1024 * 1024), 2),
                'format_distribution': format_stats,
                'efficiency_score': round((1 - (potential_savings / total_size_bytes)) * 100, 2) if total_size_bytes > 0 else 100
            }
            
        except Exception as e:
            logger.error(f"Failed to get storage statistics: {e}")
            return {'error': str(e)}
    
    def cleanup_orphaned_files(self) -> Dict[str, Any]:
        """Remove files that don't have database records"""
        try:
            results = {
                'files_checked': 0,
                'orphaned_files_found': 0,
                'files_removed': 0,
                'space_freed_bytes': 0
            }
            
            # Get all image filenames from database
            db_filenames = {img.filename for img in self.db.query(Image.filename).all()}
            
            # Check upload directory for orphaned files
            upload_path = Path(image_storage_service.upload_path)
            if upload_path.exists():
                for file_path in upload_path.rglob('*'):
                    if file_path.is_file() and file_path.suffix.lower() in image_storage_service.SUPPORTED_EXTENSIONS:
                        results['files_checked'] += 1
                        filename = file_path.name
                        
                        if filename not in db_filenames:
                            results['orphaned_files_found'] += 1
                            file_size = file_path.stat().st_size
                            results['space_freed_bytes'] += file_size
                            
                            # Remove the orphaned file
                            file_path.unlink()
                            results['files_removed'] += 1
                            
                            # Remove associated thumbnails
                            for size_name in image_storage_service.THUMBNAIL_SIZES.keys():
                                thumbnail_path = image_storage_service.get_thumbnail_path(filename, size_name)
                                if thumbnail_path and thumbnail_path.exists():
                                    thumbnail_path.unlink()
            
            logger.info(f"Cleanup completed: {results['files_removed']} orphaned files removed, {results['space_freed_bytes']} bytes freed")
            return results
            
        except Exception as e:
            logger.error(f"Failed to cleanup orphaned files: {e}")
            return {'error': str(e)}
