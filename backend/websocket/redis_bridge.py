"""
Redis pub/sub bridge for WebSocket notifications across processes.

Allows Celery workers (separate processes) to send WebSocket notifications
to the FastAPI app's WebSocket connections via Redis pub/sub.
"""

import json
import logging
import os
import redis
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Redis connection for pub/sub
redis_client: Optional[redis.Redis] = None

def get_redis_client() -> redis.Redis:
    """Get or create Redis client for pub/sub"""
    global redis_client
    
    if redis_client is None:
        redis_url = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
        redis_client = redis.from_url(redis_url, decode_responses=True)
        logger.info(f"📡 Redis pub/sub client connected: {redis_url}")
    
    return redis_client


def publish_processing_update(event_payload: Dict[str, Any]):
    """
    Publish an image processing update to Redis pub/sub channel.
    
    This is called from Celery workers to send notifications across processes.
    The FastAPI app subscribes to this channel and broadcasts to WebSocket clients.
    
    Args:
        event_payload: Event dict from websocket.events module
    """
    try:
        client = get_redis_client()
        channel = 'glowworm:processing:updates'
        message = json.dumps(event_payload)
        
        client.publish(channel, message)
        logger.info(f"📤 Published to Redis: {event_payload.get('type')} for image {event_payload.get('image_id')}")
        
    except Exception as e:
        logger.error(f"❌ Failed to publish to Redis: {e}", exc_info=True)

