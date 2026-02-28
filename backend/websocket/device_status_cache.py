"""
Device status caching in Redis for quick access.

Stores Pi3D device status updates in Redis with TTL for:
- Quick status lookup by device token
- Status persistence across WebSocket disconnections
- Admin dashboard real-time updates
"""

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

import redis

logger = logging.getLogger(__name__)

# Redis connection for device status
_redis_client: Optional[redis.Redis] = None

# Default TTL for device status (5 minutes)
DEFAULT_STATUS_TTL = 300

# Redis key prefixes
DEVICE_STATUS_PREFIX = "glowworm:device:status:"
DEVICE_ONLINE_SET = "glowworm:devices:online"


def get_redis_client() -> redis.Redis:
    """Get or create Redis client for device status."""
    global _redis_client

    if _redis_client is None:
        redis_url = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
        _redis_client = redis.from_url(redis_url, decode_responses=True)
        logger.info(f"Device status Redis client connected: {redis_url}")

    return _redis_client


def store_device_status(
    device_token: str,
    status: Dict[str, Any],
    ttl: int = DEFAULT_STATUS_TTL,
) -> bool:
    """
    Store device status in Redis.

    Args:
        device_token: Device token
        status: Status payload from device
        ttl: Time-to-live in seconds

    Returns:
        True if stored successfully
    """
    try:
        client = get_redis_client()
        key = f"{DEVICE_STATUS_PREFIX}{device_token}"

        # Add timestamp if not present
        if "received_at" not in status:
            status["received_at"] = datetime.now().isoformat()

        # Store status
        client.setex(key, ttl, json.dumps(status))

        # Add to online devices set
        client.sadd(DEVICE_ONLINE_SET, device_token)
        client.expire(DEVICE_ONLINE_SET, ttl)

        logger.debug(f"Stored status for device {device_token[:8]}...")
        return True

    except Exception as e:
        logger.error(f"Failed to store device status: {e}")
        return False


def get_device_status(device_token: str) -> Optional[Dict[str, Any]]:
    """
    Get device status from Redis.

    Args:
        device_token: Device token

    Returns:
        Status dict or None if not found
    """
    try:
        client = get_redis_client()
        key = f"{DEVICE_STATUS_PREFIX}{device_token}"

        data = client.get(key)
        if data:
            return json.loads(data)
        return None

    except Exception as e:
        logger.error(f"Failed to get device status: {e}")
        return None


def get_all_device_statuses() -> Dict[str, Dict[str, Any]]:
    """
    Get status for all online devices.

    Returns:
        Dict mapping device_token -> status
    """
    try:
        client = get_redis_client()

        # Get all online device tokens
        tokens = client.smembers(DEVICE_ONLINE_SET)

        statuses = {}
        for token in tokens:
            status = get_device_status(token)
            if status:
                statuses[token] = status

        return statuses

    except Exception as e:
        logger.error(f"Failed to get all device statuses: {e}")
        return {}


def remove_device_status(device_token: str) -> bool:
    """
    Remove device status from Redis (on disconnect).

    Args:
        device_token: Device token

    Returns:
        True if removed successfully
    """
    try:
        client = get_redis_client()
        key = f"{DEVICE_STATUS_PREFIX}{device_token}"

        # Remove status
        client.delete(key)

        # Remove from online set
        client.srem(DEVICE_ONLINE_SET, device_token)

        logger.debug(f"Removed status for device {device_token[:8]}...")
        return True

    except Exception as e:
        logger.error(f"Failed to remove device status: {e}")
        return False


def get_online_device_count() -> int:
    """Get count of online devices."""
    try:
        client = get_redis_client()
        return client.scard(DEVICE_ONLINE_SET)
    except Exception as e:
        logger.error(f"Failed to get online device count: {e}")
        return 0


def get_online_device_tokens() -> List[str]:
    """Get list of online device tokens."""
    try:
        client = get_redis_client()
        return list(client.smembers(DEVICE_ONLINE_SET))
    except Exception as e:
        logger.error(f"Failed to get online device tokens: {e}")
        return []
