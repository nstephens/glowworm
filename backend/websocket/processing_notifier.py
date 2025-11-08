"""
Helper functions for emitting image processing WebSocket notifications.

Provides a simple interface for background tasks to send real-time processing
updates to connected clients via Redis pub/sub (cross-process communication).
"""

import logging
from typing import Optional, Dict, Any
from .redis_bridge import publish_processing_update
from .events import (
    WS_EVENT_THUMBNAIL_COMPLETE,
    WS_EVENT_THUMBNAIL_FAILED,
    WS_EVENT_VARIANT_COMPLETE,
    WS_EVENT_VARIANT_FAILED,
    WS_EVENT_PROCESSING_COMPLETE,
    WS_EVENT_PROCESSING_FAILED,
    thumbnail_complete_event,
    thumbnail_failed_event,
    variant_complete_event,
    variant_failed_event,
    processing_complete_event,
    processing_failed_event
)

logger = logging.getLogger(__name__)


def emit_processing_update_sync(event_payload: Dict[str, Any]):
    """
    Emit a processing update from a synchronous context (Celery workers).
    
    Uses Redis pub/sub to bridge between Celery workers (separate processes)
    and the FastAPI app (which has the WebSocket connections).
    
    Args:
        event_payload: Event dict from websocket.events module
    """
    try:
        publish_processing_update(event_payload)
    except Exception as e:
        logger.warning(f"Failed to publish processing update: {e}")


# Convenience functions for common events

def notify_thumbnail_complete(image_id: int, thumbnail_count: int):
    """Notify that thumbnail processing completed"""
    event = thumbnail_complete_event(image_id, thumbnail_count)
    emit_processing_update_sync(event)


def notify_thumbnail_failed(image_id: int, error: str):
    """Notify that thumbnail processing failed"""
    event = thumbnail_failed_event(image_id, error)
    emit_processing_update_sync(event)


def notify_variant_complete(image_id: int, variant_count: int):
    """Notify that variant processing completed"""
    event = variant_complete_event(image_id, variant_count)
    emit_processing_update_sync(event)


def notify_variant_failed(image_id: int, error: str):
    """Notify that variant processing failed"""
    event = variant_failed_event(image_id, error)
    emit_processing_update_sync(event)


def notify_processing_complete(image_id: int):
    """Notify that all processing completed successfully"""
    event = processing_complete_event(image_id)
    emit_processing_update_sync(event)


def notify_processing_failed(image_id: int, error: str, stage: Optional[str] = None):
    """Notify that processing failed"""
    event = processing_failed_event(image_id, error, stage)
    emit_processing_update_sync(event)

