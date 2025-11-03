"""
Service for tracking regeneration progress and providing real-time updates
"""
import asyncio
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)

@dataclass
class RegenerationProgress:
    """Progress data for regeneration task"""
    task_id: str
    status: str  # 'pending', 'running', 'completed', 'failed'
    total_images: int
    processed_images: int
    error_count: int
    current_image: Optional[str] = None
    display_sizes: list = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        data = asdict(self)
        # Convert datetime objects to ISO strings
        if data['started_at']:
            data['started_at'] = data['started_at'].isoformat()
        if data['completed_at']:
            data['completed_at'] = data['completed_at'].isoformat()
        return data
    
    @property
    def progress_percentage(self) -> float:
        """Calculate progress percentage"""
        if self.total_images == 0:
            return 0.0
        return (self.processed_images / self.total_images) * 100

class RegenerationProgressService:
    """Service for managing regeneration progress tracking"""
    
    def __init__(self):
        self._active_tasks: Dict[str, RegenerationProgress] = {}
        self._websocket_connections: Dict[str, Any] = {}  # task_id -> websocket
    
    def start_task(self, task_id: str, total_images: int, display_sizes: list) -> RegenerationProgress:
        """Start tracking a new regeneration task"""
        progress = RegenerationProgress(
            task_id=task_id,
            status='pending',
            total_images=total_images,
            processed_images=0,
            error_count=0,
            display_sizes=display_sizes,
            started_at=datetime.now()
        )
        
        self._active_tasks[task_id] = progress
        logger.info(f"🔄 Started tracking regeneration task {task_id} for {total_images} images")
        return progress
    
    def update_progress_sync(self, task_id: str, processed_images: int, error_count: int = 0, current_image: str = None):
        """Update progress for a task (synchronous version without WebSocket broadcast)"""
        if task_id not in self._active_tasks:
            logger.warning(f"Task {task_id} not found for progress update")
            return
        
        progress = self._active_tasks[task_id]
        progress.processed_images = processed_images
        progress.error_count = error_count
        progress.current_image = current_image
        progress.status = 'running'
        
        # Log progress every 10 images
        if processed_images % 10 == 0 or processed_images == progress.total_images:
            logger.info(f"📊 Task {task_id}: {processed_images}/{progress.total_images} images processed ({progress.progress_percentage:.1f}%)")
    
    async def update_progress(self, task_id: str, processed_images: int, error_count: int = 0, current_image: str = None):
        """Update progress for a task"""
        if task_id not in self._active_tasks:
            logger.warning(f"Task {task_id} not found for progress update")
            return
        
        progress = self._active_tasks[task_id]
        progress.processed_images = processed_images
        progress.error_count = error_count
        progress.current_image = current_image
        progress.status = 'running'
        
        # Log progress every 10 images
        if processed_images % 10 == 0 or processed_images == progress.total_images:
            logger.info(f"📊 Task {task_id}: {processed_images}/{progress.total_images} images processed ({progress.progress_percentage:.1f}%)")
        
        # Broadcast to websocket
        await self._broadcast_progress(task_id)
    
    def complete_task_sync(self, task_id: str, success: bool = True, error_message: str = None):
        """Mark a task as completed (synchronous version without WebSocket broadcast)"""
        if task_id not in self._active_tasks:
            logger.warning(f"Task {task_id} not found for completion")
            return
        
        progress = self._active_tasks[task_id]
        progress.status = 'completed' if success else 'failed'
        progress.completed_at = datetime.now()
        progress.error_message = error_message
        
        logger.info(f"🎉 Task {task_id} completed: {progress.processed_images}/{progress.total_images} images processed")
    
    async def complete_task(self, task_id: str, success: bool = True, error_message: str = None):
        """Mark a task as completed"""
        if task_id not in self._active_tasks:
            logger.warning(f"Task {task_id} not found for completion")
            return
        
        progress = self._active_tasks[task_id]
        progress.status = 'completed' if success else 'failed'
        progress.completed_at = datetime.now()
        progress.error_message = error_message
        
        logger.info(f"🎉 Task {task_id} completed: {progress.processed_images}/{progress.total_images} images processed")
        
        # Broadcast final update
        await self._broadcast_progress(task_id)
        
        # Clean up after a delay
        asyncio.create_task(self._cleanup_task(task_id))
    
    def get_progress(self, task_id: str) -> Optional[RegenerationProgress]:
        """Get current progress for a task"""
        return self._active_tasks.get(task_id)
    
    def register_websocket(self, task_id: str, websocket):
        """Register a websocket connection for real-time updates"""
        self._websocket_connections[task_id] = websocket
        logger.info(f"📡 Registered websocket for task {task_id}")
    
    def unregister_websocket(self, task_id: str):
        """Unregister websocket connection"""
        if task_id in self._websocket_connections:
            del self._websocket_connections[task_id]
            logger.info(f"📡 Unregistered websocket for task {task_id}")
    
    async def _broadcast_progress(self, task_id: str):
        """Broadcast progress update to websocket"""
        if task_id not in self._websocket_connections:
            return
        
        websocket = self._websocket_connections[task_id]
        progress = self._active_tasks.get(task_id)
        
        if progress:
            try:
                await websocket.send_text(json.dumps({
                    "type": "regeneration_progress",
                    "data": progress.to_dict()
                }))
            except Exception as e:
                logger.error(f"Failed to broadcast progress for task {task_id}: {e}")
                # Remove broken websocket
                self.unregister_websocket(task_id)
    
    async def _cleanup_task(self, task_id: str):
        """Clean up completed task after delay"""
        await asyncio.sleep(300)  # 5 minutes
        if task_id in self._active_tasks:
            del self._active_tasks[task_id]
            logger.info(f"🧹 Cleaned up completed task {task_id}")

# Global instance
regeneration_progress_service = RegenerationProgressService()
