import asyncio
import logging
import psutil
import time
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from dataclasses import dataclass
from enum import Enum
import hashlib

from models import Image, Playlist
from services.image_service import ImageService
from services.image_storage_service import image_storage_service
from services.image_optimization_service import image_optimization_service
from services.caching_service import cached, invalidate_cache

logger = logging.getLogger(__name__)

class PreloadPriority(Enum):
    CRITICAL = "critical"  # Current and next image
    HIGH = "high"         # Next 2-3 images
    MEDIUM = "medium"     # Next 5-10 images
    LOW = "low"          # Remaining images
    BACKGROUND = "background"  # All other images

class PreloadStatus(Enum):
    PENDING = "pending"
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

@dataclass
class PreloadTask:
    image_id: int
    image_path: str
    priority: PreloadPriority
    formats: List[str]
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: PreloadStatus = PreloadStatus.PENDING
    retry_count: int = 0
    max_retries: int = 3
    error: Optional[str] = None
    estimated_size: int = 0

@dataclass
class MemoryStats:
    total_memory: int
    available_memory: int
    used_memory: int
    memory_percent: float
    cache_memory: int = 0

class SmartPreloadService:
    """Intelligent image preloading service with memory management and timing optimization"""
    
    def __init__(self):
        self.preload_queue = asyncio.PriorityQueue()
        self.active_tasks: Dict[int, PreloadTask] = {}
        self.completed_tasks: Dict[int, PreloadTask] = {}
        self.failed_tasks: Dict[int, PreloadTask] = {}
        self.worker_running = False
        self.max_concurrent_tasks = 3
        self.memory_threshold_percent = 80.0
        self.max_cache_size_mb = 1000  # 1GB max cache
        self.current_cache_size = 0
        self.slideshow_timing = {}  # Track slideshow timing for optimization
        self.preload_stats = {
            'total_preloaded': 0,
            'total_failed': 0,
            'total_retries': 0,
            'cache_hits': 0,
            'cache_misses': 0,
            'memory_pressure_events': 0
        }
    
    def _get_max_retry_delay(self):
        """Get max retry delay from settings"""
        try:
            from services.config_service import config_service
            return config_service.display_status_check_interval
        except Exception:
            return 30  # Fallback to hardcoded value if settings not available
    
    async def start_worker(self):
        """Start the smart preload worker"""
        if not self.worker_running:
            self.worker_running = True
            asyncio.create_task(self._smart_preload_worker())
            logger.info("Smart preload worker started")
    
    async def stop_worker(self):
        """Stop the smart preload worker"""
        self.worker_running = False
        logger.info("Smart preload worker stopped")
    
    async def _smart_preload_worker(self):
        """Main worker loop for intelligent preloading"""
        while self.worker_running:
            try:
                # Check memory pressure
                memory_stats = self._get_memory_stats()
                if memory_stats.memory_percent > self.memory_threshold_percent:
                    await self._handle_memory_pressure(memory_stats)
                    self.preload_stats['memory_pressure_events'] += 1
                    await asyncio.sleep(2)
                    continue
                
                # Get next task
                try:
                    priority, task = await asyncio.wait_for(
                        self.preload_queue.get(), timeout=1.0
                    )
                except asyncio.TimeoutError:
                    continue
                
                # Check if we can start more tasks
                if len(self.active_tasks) >= self.max_concurrent_tasks:
                    # Put task back in queue
                    await self.preload_queue.put((priority, task))
                    await asyncio.sleep(0.1)
                    continue
                
                # Start task
                asyncio.create_task(self._process_preload_task(task))
                
            except Exception as e:
                logger.error(f"Smart preload worker error: {e}")
                await asyncio.sleep(1)
    
    async def _process_preload_task(self, task: PreloadTask):
        """Process a single preload task"""
        task.status = PreloadStatus.PROCESSING
        task.started_at = datetime.utcnow()
        self.active_tasks[task.image_id] = task
        
        try:
            # Check if already cached
            if self._is_image_cached(task.image_path, task.formats):
                task.status = PreloadStatus.COMPLETED
                task.completed_at = datetime.utcnow()
                self.preload_stats['cache_hits'] += 1
                logger.debug(f"Image {task.image_id} already cached")
            else:
                # Preload the image
                success = await self._preload_single_image(task)
                
                if success:
                    task.status = PreloadStatus.COMPLETED
                    task.completed_at = datetime.utcnow()
                    self.preload_stats['total_preloaded'] += 1
                    logger.debug(f"Successfully preloaded image {task.image_id}")
                else:
                    raise Exception("Preload failed")
            
            # Move to completed tasks
            self.completed_tasks[task.image_id] = task
            if task.image_id in self.active_tasks:
                del self.active_tasks[task.image_id]
            
        except Exception as e:
            task.error = str(e)
            task.retry_count += 1
            self.preload_stats['total_retries'] += 1
            
            if task.retry_count < task.max_retries:
                # Retry with exponential backoff
                retry_delay = min(2 ** task.retry_count, self._get_max_retry_delay())  # Max configurable seconds
                logger.warning(f"Retrying preload for image {task.image_id} in {retry_delay}s (attempt {task.retry_count + 1})")
                
                # Re-queue with lower priority
                retry_priority = self._get_priority_value(task.priority) + 1000
                await self.preload_queue.put((retry_priority, task))
            else:
                # Max retries reached
                task.status = PreloadStatus.FAILED
                task.completed_at = datetime.utcnow()
                self.failed_tasks[task.image_id] = task
                self.preload_stats['total_failed'] += 1
                logger.error(f"Failed to preload image {task.image_id} after {task.max_retries} retries: {e}")
            
            if task.image_id in self.active_tasks:
                del self.active_tasks[task.image_id]
    
    async def _preload_single_image(self, task: PreloadTask) -> bool:
        """Preload a single image with memory management"""
        try:
            # Check memory before preloading
            memory_stats = self._get_memory_stats()
            if memory_stats.memory_percent > self.memory_threshold_percent:
                logger.warning(f"Memory pressure detected ({memory_stats.memory_percent:.1f}%), skipping preload")
                return False
            
            # Estimate memory usage
            estimated_memory = self._estimate_image_memory_usage(task.image_path, task.formats)
            if memory_stats.available_memory < estimated_memory * 2:  # 2x safety factor
                logger.warning(f"Insufficient memory for preload, available: {memory_stats.available_memory}, needed: {estimated_memory}")
                return False
            
            # Perform preload
            image_paths = [task.image_path]
            results = image_optimization_service.preload_images(image_paths, task.formats)
            
            # Update cache size estimate
            self.current_cache_size += estimated_memory
            
            return results.get(task.image_path, False)
            
        except Exception as e:
            logger.error(f"Error preloading image {task.image_id}: {e}")
            return False
    
    def _is_image_cached(self, image_path: str, formats: List[str]) -> bool:
        """Check if image is already cached in optimized formats"""
        try:
            # This would check the actual cache implementation
            # For now, we'll assume it's not cached
            return False
        except Exception:
            return False
    
    def _estimate_image_memory_usage(self, image_path: str, formats: List[str]) -> int:
        """Estimate memory usage for preloading an image"""
        try:
            file_size = Path(image_path).stat().st_size
            # Estimate memory usage as 2x file size for processing + cache
            return file_size * 2 * len(formats)
        except Exception:
            return 1024 * 1024  # Default 1MB estimate
    
    def _get_memory_stats(self) -> MemoryStats:
        """Get current memory statistics"""
        memory = psutil.virtual_memory()
        return MemoryStats(
            total_memory=memory.total,
            available_memory=memory.available,
            used_memory=memory.used,
            memory_percent=memory.percent,
            cache_memory=self.current_cache_size
        )
    
    async def _handle_memory_pressure(self, memory_stats: MemoryStats):
        """Handle memory pressure by clearing cache and reducing active tasks"""
        logger.warning(f"Memory pressure detected: {memory_stats.memory_percent:.1f}% used")
        
        # Clear some completed tasks from memory
        if len(self.completed_tasks) > 10:
            # Remove oldest completed tasks
            sorted_tasks = sorted(
                self.completed_tasks.items(),
                key=lambda x: x[1].completed_at or datetime.min
            )
            
            tasks_to_remove = sorted_tasks[:5]  # Remove 5 oldest
            for image_id, _ in tasks_to_remove:
                del self.completed_tasks[image_id]
            
            logger.info(f"Cleared {len(tasks_to_remove)} completed tasks from memory")
        
        # Reduce cache size estimate
        self.current_cache_size = max(0, self.current_cache_size * 0.8)
        
        # Cancel low priority tasks
        await self._cancel_low_priority_tasks()
    
    async def _cancel_low_priority_tasks(self):
        """Cancel low priority tasks to free up resources"""
        # This would implement task cancellation logic
        # For now, we'll just log the action
        logger.info("Cancelling low priority tasks due to memory pressure")
    
    def _get_priority_value(self, priority: PreloadPriority) -> int:
        """Get numeric priority value for queue ordering"""
        priority_map = {
            PreloadPriority.CRITICAL: 0,
            PreloadPriority.HIGH: 100,
            PreloadPriority.MEDIUM: 200,
            PreloadPriority.LOW: 300,
            PreloadPriority.BACKGROUND: 400
        }
        return priority_map.get(priority, 500)
    
    async def preload_playlist_smart(self, playlist_id: int, current_image_index: int = 0, 
                                   slide_duration: int = 5, formats: List[str] = ["webp", "avif"]) -> Dict[str, Any]:
        """Intelligently preload playlist images based on timing and priority"""
        try:
            # Get playlist images
            db = next(self._get_db())
            image_service = ImageService(db)
            
            if playlist_id == -1:  # All images
                images = image_service.get_all_images(limit=1000)
            else:
                images = image_service.get_images_by_playlist(playlist_id)
            
            if not images:
                return {
                    'status': 'error',
                    'message': 'No images found in playlist'
                }
            
            # Calculate preload priorities based on timing
            preload_tasks = self._calculate_preload_priorities(
                images, current_image_index, slide_duration
            )
            
            # Queue tasks
            queued_count = 0
            for task_data in preload_tasks:
                image = task_data['image']
                priority = task_data['priority']
                estimated_size = self._estimate_image_memory_usage(
                    task_data['image_path'], formats
                )
                
                task = PreloadTask(
                    image_id=image.id,
                    image_path=task_data['image_path'],
                    priority=priority,
                    formats=formats,
                    created_at=datetime.utcnow(),
                    estimated_size=estimated_size
                )
                
                priority_value = self._get_priority_value(priority)
                await self.preload_queue.put((priority_value, task))
                queued_count += 1
            
            logger.info(f"Queued {queued_count} smart preload tasks for playlist {playlist_id}")
            
            return {
                'status': 'queued',
                'queued_count': queued_count,
                'total_images': len(images),
                'current_index': current_image_index,
                'slide_duration': slide_duration
            }
            
        except Exception as e:
            logger.error(f"Failed to queue smart preload: {e}")
            return {
                'status': 'error',
                'error': str(e)
            }
    
    def _calculate_preload_priorities(self, images: List[Image], current_index: int, 
                                    slide_duration: int) -> List[Dict[str, Any]]:
        """Calculate preload priorities based on timing and current position"""
        tasks = []
        
        for i, image in enumerate(images):
            # Get image path
            file_path = image_storage_service.get_image_path(image.filename)
            if not file_path or not file_path.exists():
                continue
            
            # Calculate time until this image is shown
            time_until_show = (i - current_index) * slide_duration
            
            # Determine priority based on timing
            if i == current_index:
                priority = PreloadPriority.CRITICAL
            elif time_until_show <= slide_duration:
                priority = PreloadPriority.CRITICAL
            elif time_until_show <= slide_duration * 2:
                priority = PreloadPriority.HIGH
            elif time_until_show <= slide_duration * 5:
                priority = PreloadPriority.MEDIUM
            elif time_until_show <= slide_duration * 10:
                priority = PreloadPriority.LOW
            else:
                priority = PreloadPriority.BACKGROUND
            
            tasks.append({
                'image': image,
                'image_path': str(file_path),
                'priority': priority,
                'time_until_show': time_until_show,
                'index': i
            })
        
        return tasks
    
    def get_preload_status(self, image_id: Optional[int] = None) -> Dict[str, Any]:
        """Get preload status for specific image or overall status"""
        if image_id:
            # Return status for specific image
            if image_id in self.active_tasks:
                task = self.active_tasks[image_id]
                return {
                    'image_id': image_id,
                    'status': task.status.value,
                    'priority': task.priority.value,
                    'retry_count': task.retry_count,
                    'error': task.error
                }
            elif image_id in self.completed_tasks:
                task = self.completed_tasks[image_id]
                return {
                    'image_id': image_id,
                    'status': task.status.value,
                    'completed_at': task.completed_at.isoformat() if task.completed_at else None,
                    'processing_time': (task.completed_at - task.started_at).total_seconds() if task.completed_at and task.started_at else None
                }
            elif image_id in self.failed_tasks:
                task = self.failed_tasks[image_id]
                return {
                    'image_id': image_id,
                    'status': task.status.value,
                    'error': task.error,
                    'retry_count': task.retry_count
                }
            else:
                return {
                    'image_id': image_id,
                    'status': 'not_found'
                }
        else:
            # Return overall status
            memory_stats = self._get_memory_stats()
            return {
                'worker_running': self.worker_running,
                'queue_size': self.preload_queue.qsize(),
                'active_tasks': len(self.active_tasks),
                'completed_tasks': len(self.completed_tasks),
                'failed_tasks': len(self.failed_tasks),
                'memory_stats': {
                    'total_memory_mb': memory_stats.total_memory // (1024 * 1024),
                    'available_memory_mb': memory_stats.available_memory // (1024 * 1024),
                    'used_memory_percent': memory_stats.memory_percent,
                    'cache_size_mb': memory_stats.cache_memory // (1024 * 1024)
                },
                'stats': self.preload_stats,
                'max_concurrent_tasks': self.max_concurrent_tasks,
                'memory_threshold_percent': self.memory_threshold_percent
            }
    
    def update_slideshow_timing(self, playlist_id: int, current_index: int, slide_duration: int):
        """Update slideshow timing for optimization"""
        self.slideshow_timing[playlist_id] = {
            'current_index': current_index,
            'slide_duration': slide_duration,
            'last_updated': datetime.utcnow()
        }
    
    def get_slideshow_timing(self, playlist_id: int) -> Optional[Dict[str, Any]]:
        """Get current slideshow timing"""
        return self.slideshow_timing.get(playlist_id)
    
    def clear_completed_tasks(self, older_than_hours: int = 1):
        """Clear completed tasks older than specified hours"""
        cutoff_time = datetime.utcnow() - timedelta(hours=older_than_hours)
        
        tasks_to_remove = []
        for image_id, task in self.completed_tasks.items():
            if task.completed_at and task.completed_at < cutoff_time:
                tasks_to_remove.append(image_id)
        
        for image_id in tasks_to_remove:
            del self.completed_tasks[image_id]
        
        logger.info(f"Cleared {len(tasks_to_remove)} old completed tasks")
        return len(tasks_to_remove)
    
    def _get_db(self):
        """Get database session"""
        from models import get_db
        return get_db()

# Global instance
smart_preload_service = SmartPreloadService()



