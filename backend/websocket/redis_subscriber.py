"""
Redis pub/sub subscriber that forwards messages to WebSocket clients.

Runs as a background task in the FastAPI app, listening for messages from
Celery workers and broadcasting them to connected WebSocket clients.
"""

import asyncio
import json
import logging
import os
from typing import Optional
import redis.asyncio as aioredis
from .manager import connection_manager

logger = logging.getLogger(__name__)

# Global subscriber task
_subscriber_task: Optional[asyncio.Task] = None


async def redis_subscriber_task():
    """
    Background task that subscribes to Redis pub/sub and forwards to WebSocket clients.
    
    This bridges the gap between Celery workers (separate processes) and the
    FastAPI app's WebSocket connections.
    """
    redis_url = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
    channel = 'glowworm:processing:updates'
    
    logger.info(f"Starting Redis subscriber for channel: {channel}")
    
    retry_count = 0
    max_retries = 5
    
    while retry_count < max_retries:
        try:
            # Create Redis connection
            redis_client = aioredis.from_url(redis_url, decode_responses=True)
            pubsub = redis_client.pubsub()
            
            # Subscribe to the processing updates channel
            await pubsub.subscribe(channel)
            logger.info(f"Subscribed to Redis channel: {channel}")
            
            # Reset retry count on successful connection
            retry_count = 0
            
            # Listen for messages
            async for message in pubsub.listen():
                if message['type'] == 'message':
                    try:
                        # Parse the event payload
                        event_payload = json.loads(message['data'])
                        
                        # Broadcast to all admin WebSocket connections
                        await connection_manager.broadcast_image_processing_update(event_payload)
                        
                        logger.debug(f"Broadcasted {event_payload.get('type')} for image {event_payload.get('image_id')}")
                        
                    except json.JSONDecodeError as e:
                        logger.error(f"❌ Failed to parse Redis message: {e}")
                    except Exception as e:
                        logger.error(f"❌ Failed to broadcast message: {e}", exc_info=True)
            
        except asyncio.CancelledError:
            logger.info("🛑 Redis subscriber task cancelled")
            break
        except Exception as e:
            retry_count += 1
            logger.error(f"❌ Redis subscriber error (attempt {retry_count}/{max_retries}): {e}")
            if retry_count < max_retries:
                await asyncio.sleep(5)  # Wait before retry
            else:
                logger.error("❌ Max retries reached, Redis subscriber stopped")
                break
        finally:
            try:
                await pubsub.unsubscribe(channel)
                await redis_client.close()
            except:
                pass


async def start_redis_subscriber():
    """Start the Redis subscriber background task"""
    global _subscriber_task
    
    if _subscriber_task is None or _subscriber_task.done():
        _subscriber_task = asyncio.create_task(redis_subscriber_task())
        logger.info("Redis subscriber task started")
    
    return _subscriber_task


async def stop_redis_subscriber():
    """Stop the Redis subscriber background task"""
    global _subscriber_task
    
    if _subscriber_task and not _subscriber_task.done():
        _subscriber_task.cancel()
        try:
            await _subscriber_task
        except asyncio.CancelledError:
            pass
        logger.info("🛑 Redis subscriber task stopped")

