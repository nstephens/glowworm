"""
Helper functions for emitting image processing WebSocket notifications.

Provides a simple interface for background tasks to send real-time processing
updates to connected clients without dealing with async/sync context issues.
"""

import asyncio
import logging
from typing import Optional, Dict, Any
from .manager import connection_manager
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
    Emit a processing update from a synchronous context (like background tasks).
    
    This function handles the async/sync bridge, allowing synchronous background
    tasks to emit WebSocket events to connected clients.
    
    Args:
        event_payload: Event dict from websocket.events module
    """
    try:
        # Try to get the running event loop
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            # No running loop, create a new one
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        # Create a coroutine for the broadcast
        async def _broadcast():
            await connection_manager.broadcast_image_processing_update(event_payload)
        
        # Run it in the event loop
        if loop.is_running():
            # If loop is already running, schedule the coroutine
            asyncio.create_task(_broadcast())
        else:
            # If loop is not running, run it until complete
            loop.run_until_complete(_broadcast())
            
        logger.debug(f"Emitted WebSocket event: {event_payload.get('type')}")
        
    except Exception as e:
        # Don't let WebSocket errors break the processing
        logger.warning(f"Failed to emit WebSocket update: {e}")


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

