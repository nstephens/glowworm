"""
Celery tasks for image processing operations.

These tasks handle thumbnail generation, variant creation, and full image processing
in a distributed, scalable manner using Celery workers.
"""

import sys
import os

# Ensure /app is in Python path for Celery workers
if '/app' not in sys.path:
    sys.path.insert(0, '/app')

from celery import Task
from celery_app import celery_app
from datetime import datetime
import logging
from websocket.processing_notifier import (
    notify_thumbnail_complete,
    notify_variant_complete,
    notify_processing_complete,
    notify_processing_failed
)

logger = logging.getLogger(__name__)


class DatabaseTask(Task):
    """
    Base task class that handles database session management.
    
    Each task gets its own database session that's properly closed
    after execution to prevent connection leaks.
    """
    _db = None
    
    @property
    def db(self):
        if self._db is None:
            from models import database as db_module
            db_module.ensure_database_initialized()
            self._db = db_module.SessionLocal()
        return self._db
    
    def after_return(self, *args, **kwargs):
        """Close database session after task completes"""
        if self._db is not None:
            self._db.close()
            self._db = None


@celery_app.task(base=DatabaseTask, bind=True, name='tasks.image_processing.process_thumbnails')
def process_thumbnails(self, image_id: int, filename: str, user_id: int):
    """
    Generate thumbnails (150px, 300px, 600px) for an image.
    
    Args:
        image_id: Database ID of the image
        filename: Stored filename (hash-based)
        user_id: User who owns the image
        
    Returns:
        dict: Status and result information
    """
    # Import here to ensure sys.path is set first
    import sys
    if '/app' not in sys.path:
        sys.path.insert(0, '/app')
    
    from models import Image
    from services.image_storage_service import image_storage_service
    from utils.retry import image_processing_circuit_breaker
    
    logger.info(f"🔄 [Task] Processing thumbnails for image {image_id}: {filename}")
    
    try:
        # Get image from database
        image = self.db.query(Image).filter(Image.id == image_id).first()
        if not image:
            logger.error(f"Image {image_id} not found in database")
            return {'status': 'error', 'message': 'Image not found'}
        
        # Update status to processing
        image.thumbnail_status = 'processing'
        image.processing_status = 'processing'
        image.processing_attempts += 1
        image.last_processing_attempt = datetime.now()
        self.db.commit()
        
        # Check circuit breaker
        if image_processing_circuit_breaker.is_open(image_id):
            error_msg = f"Circuit breaker open after {image_processing_circuit_breaker.get_failure_count(image_id)} failures"
            logger.warning(f"⚠️ {error_msg} for image {image_id}")
            image.thumbnail_status = 'failed'
            image.processing_status = 'failed'
            image.processing_error = error_msg
            self.db.commit()
            return {'status': 'skipped', 'message': error_msg}
        
        # Process thumbnails
        try:
            image_storage_service.process_thumbnails(filename, user_id)
            
            # Update status to complete
            image.thumbnail_status = 'complete'
            # Mark overall as complete only if variants are also done
            if image.variant_status == 'complete':
                image.processing_status = 'complete'
                image.processing_completed_at = datetime.now()
            image.processing_error = None
            self.db.commit()
            
            # Reset circuit breaker
            image_processing_circuit_breaker.record_success(image_id)
            
            logger.info(f"✅ [Task] Thumbnails complete for image {image_id}")
            return {'status': 'success', 'image_id': image_id}
            
        except Exception as e:
            logger.error(f"❌ [Task] Thumbnail processing failed for image {image_id}: {e}")
            image.thumbnail_status = 'failed'
            image.processing_status = 'failed'
            image.processing_error = str(e)
            self.db.commit()
            
            # Record failure
            image_processing_circuit_breaker.record_failure(image_id)
            
            raise  # Re-raise for Celery retry mechanism
            
    except Exception as e:
        logger.error(f"❌ [Task] Error in thumbnail task for image {image_id}: {e}")
        self.db.rollback()
        raise


@celery_app.task(base=DatabaseTask, bind=True, name='tasks.image_processing.process_variants')
def process_variants(self, image_id: int, filename: str, user_id: int):
    """
    Generate display-sized variants for an image.
    
    Generates variants matching configured display sizes (e.g., 1080x1920, 2160x3840).
    
    Args:
        image_id: Database ID of the image
        filename: Stored filename (hash-based)
        user_id: User who owns the image
        
    Returns:
        dict: Status and result information
    """
    # Import here to ensure sys.path is set first
    import sys
    if '/app' not in sys.path:
        sys.path.insert(0, '/app')
    
    from models import Image
    from services.image_storage_service import image_storage_service
    from utils.retry import image_processing_circuit_breaker
    
    logger.info(f"🔄 [Task] Processing variants for image {image_id}: {filename}")
    
    try:
        # Get image from database
        image = self.db.query(Image).filter(Image.id == image_id).first()
        if not image:
            logger.error(f"Image {image_id} not found in database")
            return {'status': 'error', 'message': 'Image not found'}
        
        # Update status to processing
        image.variant_status = 'processing'
        image.processing_status = 'processing'
        image.processing_attempts += 1
        image.last_processing_attempt = datetime.now()
        self.db.commit()
        
        # Check circuit breaker
        if image_processing_circuit_breaker.is_open(image_id):
            error_msg = f"Circuit breaker open after {image_processing_circuit_breaker.get_failure_count(image_id)} failures"
            logger.warning(f"⚠️ {error_msg} for image {image_id}")
            image.variant_status = 'failed'
            image.processing_status = 'failed'
            image.processing_error = error_msg
            self.db.commit()
            return {'status': 'skipped', 'message': error_msg}
        
        # Process variants
        try:
            image_storage_service.process_variants(filename, user_id)
            
            # Update status to complete
            image.variant_status = 'complete'
            # Mark overall as complete only if thumbnails are also done
            if image.thumbnail_status == 'complete':
                image.processing_status = 'complete'
                image.processing_completed_at = datetime.now()
            image.processing_error = None
            self.db.commit()
            
            # Reset circuit breaker
            image_processing_circuit_breaker.record_success(image_id)
            
            logger.info(f"✅ [Task] Variants complete for image {image_id}")
            return {'status': 'success', 'image_id': image_id}
            
        except Exception as e:
            logger.error(f"❌ [Task] Variant processing failed for image {image_id}: {e}")
            image.variant_status = 'failed'
            image.processing_status = 'failed'
            image.processing_error = str(e)
            self.db.commit()
            
            # Record failure
            image_processing_circuit_breaker.record_failure(image_id)
            
            raise  # Re-raise for Celery retry mechanism
            
    except Exception as e:
        logger.error(f"❌ [Task] Error in variant task for image {image_id}: {e}")
        self.db.rollback()
        raise


@celery_app.task(base=DatabaseTask, bind=True, name='tasks.image_processing.process_full_image')
def process_full_image(self, image_id: int, filename: str, user_id: int):
    """
    Process both thumbnails AND variants for an image.
    
    Used for new uploads to generate all necessary image variations in one job.
    
    Args:
        image_id: Database ID of the image
        filename: Stored filename (hash-based)
        user_id: User who owns the image
        
    Returns:
        dict: Status and result information
    """
    # Import here to ensure sys.path is set first
    import sys
    if '/app' not in sys.path:
        sys.path.insert(0, '/app')
    
    from models import Image
    from services.image_storage_service import image_storage_service
    from utils.retry import image_processing_circuit_breaker
    
    logger.info(f"🔄 [Task] Full processing for image {image_id}: {filename}")
    
    try:
        # Get image from database
        image = self.db.query(Image).filter(Image.id == image_id).first()
        if not image:
            logger.error(f"Image {image_id} not found in database")
            return {'status': 'error', 'message': 'Image not found'}
        
        # Update status to processing
        image.thumbnail_status = 'processing'
        image.variant_status = 'processing'
        image.processing_status = 'processing'
        image.processing_attempts += 1
        image.last_processing_attempt = datetime.now()
        self.db.commit()
        
        # Check circuit breaker
        if image_processing_circuit_breaker.is_open(image_id):
            error_msg = f"Circuit breaker open after {image_processing_circuit_breaker.get_failure_count(image_id)} failures"
            logger.warning(f"⚠️ {error_msg} for image {image_id}")
            image.thumbnail_status = 'failed'
            image.variant_status = 'failed'
            image.processing_status = 'failed'
            image.processing_error = error_msg
            self.db.commit()
            return {'status': 'skipped', 'message': error_msg}
        
        # Process both thumbnails and variants
        try:
            # Step 1: Thumbnails
            thumbnail_paths = image_storage_service.process_thumbnails(filename, user_id)
            image.thumbnail_status = 'complete'
            self.db.commit()
            logger.info(f"✅ [Task] Thumbnails complete for image {image_id}")
            
            # Notify via WebSocket
            notify_thumbnail_complete(image_id, len(thumbnail_paths))
            
            # Step 2: Variants
            variant_paths = image_storage_service.process_variants(filename, user_id)
            image.variant_status = 'complete'
            image.processing_status = 'complete'
            image.processing_completed_at = datetime.now()
            image.processing_error = None
            self.db.commit()
            logger.info(f"✅ [Task] Variants complete for image {image_id}")
            
            # Notify via WebSocket
            notify_variant_complete(image_id, len(variant_paths))
            
            # Reset circuit breaker
            image_processing_circuit_breaker.record_success(image_id)
            
            logger.info(f"🎉 [Task] Full processing complete for image {image_id}")
            
            # Notify complete via WebSocket
            notify_processing_complete(image_id)
            
            return {'status': 'success', 'image_id': image_id}
            
        except Exception as e:
            logger.error(f"❌ [Task] Full processing failed for image {image_id}: {e}")
            # Mark both as failed if either fails
            image.thumbnail_status = 'failed'
            image.variant_status = 'failed'
            image.processing_status = 'failed'
            image.processing_error = str(e)
            self.db.commit()
            
            # Record failure
            image_processing_circuit_breaker.record_failure(image_id)
            
            # Notify failure via WebSocket
            notify_processing_failed(image_id, str(e))
            
            raise  # Re-raise for Celery retry mechanism
            
    except Exception as e:
        logger.error(f"❌ [Task] Error in full processing task for image {image_id}: {e}")
        self.db.rollback()
        raise


@celery_app.task(base=DatabaseTask, bind=True, name='tasks.image_processing.generate_playlist_variants')
def generate_playlist_variants(self, playlist_id: int):
    """
    Generate all variants for a playlist in the background.
    
    This is used after playlist reorder/randomize operations to avoid blocking
    the API response while generating scaled images for all display resolutions.
    
    Args:
        playlist_id: Database ID of the playlist
        
    Returns:
        dict: Status and result information
    """
    # Import here to ensure sys.path is set first
    import sys
    if '/app' not in sys.path:
        sys.path.insert(0, '/app')
    
    from models import Playlist
    from services.playlist_variant_service import PlaylistVariantService
    
    logger.info(f"🔄 [Task] Generating variants for playlist {playlist_id}")
    
    try:
        # Check playlist exists
        playlist = self.db.query(Playlist).filter(Playlist.id == playlist_id).first()
        if not playlist:
            logger.error(f"Playlist {playlist_id} not found in database")
            return {'status': 'error', 'message': 'Playlist not found'}
        
        # Generate variants
        variant_service = PlaylistVariantService(self.db)
        variant_result = variant_service.generate_variants_for_playlist(playlist_id)
        
        logger.info(f"✅ [Task] Generated {variant_result.get('count', 0)} variants for playlist {playlist_id}")
        return {'status': 'success', 'playlist_id': playlist_id, 'variants': variant_result.get('count', 0)}
        
    except Exception as e:
        logger.error(f"❌ [Task] Playlist variant generation failed for playlist {playlist_id}: {e}")
        self.db.rollback()
        raise

