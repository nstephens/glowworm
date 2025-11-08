"""
Celery application configuration for GlowWorm background task processing.

This module configures Celery to handle asynchronous image processing tasks
including thumbnail generation, variant creation, and bulk regeneration jobs.
"""

from celery import Celery
import os
import logging

logger = logging.getLogger(__name__)

# Get configuration from environment variables
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0')

# Create Celery app instance
celery_app = Celery(
    'glowworm',
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
    include=['tasks.image_processing', 'tasks.scheduler_tasks']  # Import task modules
)

# Celery configuration
celery_app.conf.update(
    # Serialization
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    
    # Timezone
    timezone='UTC',
    enable_utc=True,
    
    # Task execution
    task_track_started=True,
    task_time_limit=300,  # 5 minute hard limit per task
    task_soft_time_limit=240,  # 4 minute soft limit (sends signal)
    
    # Worker configuration
    worker_prefetch_multiplier=1,  # Take 1 task at a time for better distribution
    worker_max_tasks_per_child=1000,  # Restart worker after 1000 tasks to prevent memory leaks
    worker_disable_rate_limits=False,
    
    # Result backend
    result_expires=3600,  # Results expire after 1 hour
    result_extended=True,  # Store additional task metadata
    
    # Task routing - different queues for different priorities
    task_routes={
        'tasks.image_processing.process_thumbnails': {'queue': 'high_priority'},
        'tasks.image_processing.process_variants': {'queue': 'normal_priority'},
        'tasks.image_processing.process_full_image': {'queue': 'high_priority'},
        'tasks.image_processing.bulk_regenerate_variants': {'queue': 'low_priority'},
        'tasks.image_processing.bulk_regenerate_thumbnails': {'queue': 'low_priority'},
        'tasks.scheduler_tasks.evaluate_schedules': {'queue': 'normal_priority'},
        'tasks.scheduler_tasks.force_evaluate_now': {'queue': 'high_priority'},
    },
    
    # Task default queue
    task_default_queue='normal_priority',
    task_default_exchange='glowworm',
    task_default_routing_key='normal',
    
    # Retry configuration
    task_acks_late=True,  # Acknowledge task after completion (enables retry on worker crash)
    task_reject_on_worker_lost=True,  # Reject task if worker is lost
    
    # Logging
    worker_redirect_stdouts_level='INFO',
)

# Task queue configuration - Define queues with proper Queue objects
from kombu import Queue, Exchange

default_exchange = Exchange('glowworm', type='direct')

celery_app.conf.task_queues = [
    Queue('high_priority', exchange=default_exchange, routing_key='high', priority=10),
    Queue('normal_priority', exchange=default_exchange, routing_key='normal', priority=5),
    Queue('low_priority', exchange=default_exchange, routing_key='low', priority=1),
]

# Celery Beat schedule - periodic tasks
celery_app.conf.beat_schedule = {
    'evaluate-playlist-schedules': {
        'task': 'tasks.scheduler_tasks.evaluate_schedules',
        'schedule': 60.0,  # Every 60 seconds
    },
}

logger.info(f"📋 Celery app initialized with broker: {CELERY_BROKER_URL}")
logger.info(f"📋 Result backend: {CELERY_RESULT_BACKEND}")
logger.info(f"📋 Task queues configured: high_priority, normal_priority, low_priority")
logger.info(f"⏰ Celery Beat schedule configured: evaluate schedules every 60 seconds")

if __name__ == '__main__':
    celery_app.start()

