import asyncio
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from models import Image, Playlist
from services.image_service import ImageService
from services.image_storage_service import image_storage_service
from services.image_optimization_service import image_optimization_service
from services.caching_service import cached, invalidate_cache

logger = logging.getLogger(__name__)

class SlideshowPreloadService:
    """Service for preloading images for slideshow performance in home network"""
    
    def __init__(self):
        self.preload_queue = asyncio.Queue()
        self.preload_status = {}
        self.preload_worker_running = False
    
    async def start_preload_worker(self):
        """Start the background preload worker"""
        if not self.preload_worker_running:
            self.preload_worker_running = True
            asyncio.create_task(self._preload_worker())
    
    async def stop_preload_worker(self):
        """Stop the background preload worker"""
        self.preload_worker_running = False
    
    async def _preload_worker(self):
        """Background worker for processing preload requests"""
        while self.preload_worker_running:
            try:
                # Wait for preload request
                request = await asyncio.wait_for(self.preload_queue.get(), timeout=1.0)
                
                playlist_id, formats, priority = request
                
                # Process preload request
                await self._process_preload_request(playlist_id, formats, priority)
                
                # Mark task as done
                self.preload_queue.task_done()
                
            except asyncio.TimeoutError:
                # No requests, continue
                continue
            except Exception as e:
                logger.error(f"Preload worker error: {e}")
                await asyncio.sleep(1)
    
    async def _process_preload_request(self, playlist_id: int, formats: List[str], priority: str = "normal"):
        """Process a preload request"""
        try:
            # Get playlist images
            db = next(self._get_db())
            image_service = ImageService(db)
            
            if playlist_id == -1:  # All images
                images = image_service.get_all_images(limit=1000)
            else:
                images = image_service.get_images_by_playlist(playlist_id)
            
            if not images:
                return
            
            # Get image paths
            image_paths = []
            for image in images:
                file_path = image_storage_service.get_image_path(image.filename)
                if file_path and file_path.exists():
                    image_paths.append(str(file_path))
            
            if not image_paths:
                return
            
            # Update status
            self.preload_status[playlist_id] = {
                'status': 'processing',
                'total_images': len(image_paths),
                'processed': 0,
                'started_at': datetime.utcnow(),
                'formats': formats
            }
            
            # Preload images
            preload_results = image_optimization_service.preload_images(image_paths, formats)
            
            # Update status
            self.preload_status[playlist_id] = {
                'status': 'completed',
                'total_images': len(image_paths),
                'processed': sum(1 for success in preload_results.values() if success),
                'started_at': self.preload_status[playlist_id]['started_at'],
                'completed_at': datetime.utcnow(),
                'formats': formats,
                'results': preload_results
            }
            
            logger.info(f"Preloaded {len(image_paths)} images for playlist {playlist_id}")
            
        except Exception as e:
            logger.error(f"Failed to process preload request for playlist {playlist_id}: {e}")
            self.preload_status[playlist_id] = {
                'status': 'error',
                'error': str(e),
                'started_at': self.preload_status.get(playlist_id, {}).get('started_at'),
                'failed_at': datetime.utcnow()
            }
    
    def _get_db(self):
        """Get database session"""
        from models import get_db
        return get_db()
    
    async def queue_preload(self, playlist_id: int, formats: List[str] = ["webp", "avif"], priority: str = "normal"):
        """Queue images for preloading"""
        try:
            await self.preload_queue.put((playlist_id, formats, priority))
            
            # Initialize status
            if playlist_id not in self.preload_status:
                self.preload_status[playlist_id] = {
                    'status': 'queued',
                    'queued_at': datetime.utcnow(),
                    'formats': formats
                }
            
            logger.info(f"Queued preload request for playlist {playlist_id}")
            
        except Exception as e:
            logger.error(f"Failed to queue preload request: {e}")
            raise
    
    def get_preload_status(self, playlist_id: int) -> Optional[Dict[str, Any]]:
        """Get preload status for a playlist"""
        return self.preload_status.get(playlist_id)
    
    def get_all_preload_status(self) -> Dict[str, Any]:
        """Get all preload statuses"""
        return {
            'queue_size': self.preload_queue.qsize(),
            'worker_running': self.preload_worker_running,
            'statuses': self.preload_status
        }
    
    @cached(prefix="playlist_preload_recommendations", ttl_seconds=300)  # Cache for 5 minutes
    def get_playlist_preload_recommendations(self, playlist_id: int, db: Session) -> Dict[str, Any]:
        """Get preload recommendations for a playlist"""
        try:
            image_service = ImageService(db)
            
            if playlist_id == -1:  # All images
                images = image_service.get_all_images(limit=1000)
            else:
                images = image_service.get_images_by_playlist(playlist_id)
            
            if not images:
                return {
                    'recommended': False,
                    'reason': 'No images in playlist',
                    'image_count': 0
                }
            
            # Calculate total size
            total_size = sum(image.file_size for image in images)
            total_size_mb = total_size / (1024 * 1024)
            
            # Determine if preloading is recommended
            recommended = len(images) <= 100 and total_size_mb <= 500  # Reasonable limits for home network
            
            return {
                'recommended': recommended,
                'image_count': len(images),
                'total_size_mb': round(total_size_mb, 2),
                'estimated_preload_time_seconds': len(images) * 0.5,  # Rough estimate
                'formats_recommended': ['webp', 'avif'] if recommended else ['webp'],
                'reason': 'Within reasonable limits for home network' if recommended else 'Too many images or too large for preloading'
            }
            
        except Exception as e:
            logger.error(f"Failed to get preload recommendations: {e}")
            return {
                'recommended': False,
                'reason': f'Error: {str(e)}',
                'image_count': 0
            }
    
    def clear_preload_status(self, playlist_id: int):
        """Clear preload status for a playlist"""
        if playlist_id in self.preload_status:
            del self.preload_status[playlist_id]
    
    def clear_all_preload_status(self):
        """Clear all preload statuses"""
        self.preload_status.clear()
    
    async def preload_playlist_images(self, playlist_id: int, formats: List[str] = ["webp", "avif"]) -> Dict[str, Any]:
        """Preload images for a specific playlist"""
        try:
            # Queue the preload request
            await self.queue_preload(playlist_id, formats)
            
            # Wait for completion (with timeout)
            timeout = 60  # 1 minute timeout
            start_time = datetime.utcnow()
            
            while (datetime.utcnow() - start_time).seconds < timeout:
                status = self.get_preload_status(playlist_id)
                if status and status['status'] in ['completed', 'error']:
                    return status
                
                await asyncio.sleep(0.5)
            
            # Timeout
            return {
                'status': 'timeout',
                'message': 'Preload request timed out'
            }
            
        except Exception as e:
            logger.error(f"Failed to preload playlist images: {e}")
            return {
                'status': 'error',
                'error': str(e)
            }
    
    def get_preload_cache_stats(self) -> Dict[str, Any]:
        """Get preload cache statistics"""
        cache_stats = image_optimization_service.get_cache_stats()
        
        return {
            'preload_cache': cache_stats,
            'queue_status': {
                'queue_size': self.preload_queue.qsize(),
                'worker_running': self.preload_worker_running,
                'active_preloads': len([s for s in self.preload_status.values() if s['status'] == 'processing'])
            }
        }

# Global instance
slideshow_preload_service = SlideshowPreloadService()
