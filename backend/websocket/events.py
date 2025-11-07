"""
WebSocket event types and payload structures for image processing notifications.

Defines standardized event types and payload formats for communicating
background image processing status updates to clients in real-time.
"""

from typing import Dict, Any, Optional
from datetime import datetime
import json


# Event type constants for image processing
WS_EVENT_PROCESSING_STARTED = "image:processing:started"
WS_EVENT_THUMBNAIL_STARTED = "image:processing:thumbnail_started"
WS_EVENT_THUMBNAIL_COMPLETE = "image:processing:thumbnail_complete"
WS_EVENT_THUMBNAIL_FAILED = "image:processing:thumbnail_failed"
WS_EVENT_VARIANT_STARTED = "image:processing:variant_started"
WS_EVENT_VARIANT_COMPLETE = "image:processing:variant_complete"
WS_EVENT_VARIANT_FAILED = "image:processing:variant_failed"
WS_EVENT_PROCESSING_COMPLETE = "image:processing:complete"
WS_EVENT_PROCESSING_FAILED = "image:processing:failed"


def create_processing_event(
    event_type: str,
    image_id: int,
    status: Optional[str] = None,
    error: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Create a standardized WebSocket event payload for image processing updates.
    
    Args:
        event_type: The type of event (use WS_EVENT_* constants)
        image_id: The ID of the image being processed
        status: Optional processing status (pending, processing, complete, failed)
        error: Optional error message if processing failed
        metadata: Optional additional metadata (e.g., thumbnail count, variant sizes)
        
    Returns:
        Dict containing the standardized event payload
        
    Example:
        event = create_processing_event(
            WS_EVENT_THUMBNAIL_COMPLETE,
            image_id=123,
            status='complete',
            metadata={'thumbnail_count': 3}
        )
    """
    payload = {
        "type": event_type,
        "image_id": image_id,
        "timestamp": datetime.now().isoformat()
    }
    
    if status:
        payload["status"] = status
    
    if error:
        payload["error"] = error
    
    if metadata:
        payload["metadata"] = metadata
    
    return payload


def serialize_event(event: Dict[str, Any]) -> str:
    """
    Serialize an event payload to JSON string for WebSocket transmission.
    
    Args:
        event: Event payload dict from create_processing_event()
        
    Returns:
        JSON string ready for WebSocket transmission
    """
    return json.dumps(event)


# Convenience functions for common events

def thumbnail_started_event(image_id: int) -> Dict[str, Any]:
    """Create event for thumbnail processing started"""
    return create_processing_event(
        WS_EVENT_THUMBNAIL_STARTED,
        image_id,
        status='processing'
    )


def thumbnail_complete_event(image_id: int, thumbnail_count: int) -> Dict[str, Any]:
    """Create event for thumbnail processing complete"""
    return create_processing_event(
        WS_EVENT_THUMBNAIL_COMPLETE,
        image_id,
        status='complete',
        metadata={'thumbnail_count': thumbnail_count}
    )


def thumbnail_failed_event(image_id: int, error: str) -> Dict[str, Any]:
    """Create event for thumbnail processing failed"""
    return create_processing_event(
        WS_EVENT_THUMBNAIL_FAILED,
        image_id,
        status='failed',
        error=error
    )


def variant_started_event(image_id: int) -> Dict[str, Any]:
    """Create event for variant processing started"""
    return create_processing_event(
        WS_EVENT_VARIANT_STARTED,
        image_id,
        status='processing'
    )


def variant_complete_event(image_id: int, variant_count: int) -> Dict[str, Any]:
    """Create event for variant processing complete"""
    return create_processing_event(
        WS_EVENT_VARIANT_COMPLETE,
        image_id,
        status='complete',
        metadata={'variant_count': variant_count}
    )


def variant_failed_event(image_id: int, error: str) -> Dict[str, Any]:
    """Create event for variant processing failed"""
    return create_processing_event(
        WS_EVENT_VARIANT_FAILED,
        image_id,
        status='failed',
        error=error
    )


def processing_complete_event(image_id: int) -> Dict[str, Any]:
    """Create event for all processing complete"""
    return create_processing_event(
        WS_EVENT_PROCESSING_COMPLETE,
        image_id,
        status='complete',
        metadata={'all_stages_complete': True}
    )


def processing_failed_event(image_id: int, error: str, stage: Optional[str] = None) -> Dict[str, Any]:
    """Create event for processing failed"""
    metadata = {'stage': stage} if stage else None
    return create_processing_event(
        WS_EVENT_PROCESSING_FAILED,
        image_id,
        status='failed',
        error=error,
        metadata=metadata
    )

