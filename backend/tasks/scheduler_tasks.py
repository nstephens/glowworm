"""
Celery tasks for playlist scheduler operations.

Handles periodic schedule evaluation and playlist assignment updates
for display devices based on time-based schedules.
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
import time
from utils.structured_logging import (
    log_schedule_evaluation,
    log_schedule_error,
    log_performance_metric
)
from services.scheduler_service import SchedulerService
from services.scheduled_action_service import ScheduledActionService
from websocket.redis_bridge import publish_processing_update
from websocket.scheduler_events import playlist_scheduled_change_event, schedule_evaluated_event

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


@celery_app.task(base=DatabaseTask, bind=True, name='tasks.scheduler_tasks.evaluate_schedules')
def evaluate_schedules(self):
    """
    Evaluate all playlist schedules and update device assignments.
    
    This task runs every 60 seconds via Celery Beat to:
    1. Check all devices with enabled schedules
    2. Determine which schedule (if any) is currently active
    3. Update device playlist_id if changed
    4. Send WebSocket notifications to affected displays
    
    The task is idempotent - safe to run multiple times with same result.
    
    Returns:
        dict: Evaluation statistics and results
    """
    start_time = time.time()
    logger.info("🕒 Starting schedule evaluation", extra={
        'event_type': 'schedule_evaluation_start',
        'timestamp': datetime.now().isoformat()
    })
    
    try:
        # Create service with database session
        scheduler_service = SchedulerService(self.db)
        
        # Evaluate all devices for playlist schedules
        eval_start = time.time()
        result = scheduler_service.evaluate_all_devices()
        eval_duration = time.time() - eval_start
        
        # Also evaluate scheduled display actions
        action_result = ScheduledActionService.evaluate_all_devices(self.db)
        result['actions_evaluated'] = action_result.get('devices_evaluated', 0)
        result['actions_executed'] = action_result.get('actions_executed', 0)
        result['action_commands'] = action_result.get('commands_created', [])
        
        log_performance_metric(
            logger,
            'schedule_evaluation_core',
            eval_duration,
            devices=result['devices_evaluated'],
            changes=result['devices_changed']
        )
        
        # Send WebSocket notifications for playlist changes
        notifications_sent = 0
        notifications_failed = 0
        
        if result['changes']:
            for change in result['changes']:
                try:
                    # Create standardized playlist change event
                    event_payload = playlist_scheduled_change_event(
                        device_id=change['device_id'],
                        device_name=change['device_name'],
                        old_playlist_id=change['old_playlist_id'],
                        new_playlist_id=change['new_playlist_id'],
                        schedule_id=change['schedule_id'],
                        schedule_name=change['schedule_name'],
                        changed_at=result['evaluated_at']
                    )
                    
                    # Publish via Redis pub/sub (will be forwarded to WebSocket clients)
                    publish_processing_update(event_payload)
                    notifications_sent += 1
                    logger.debug(f"📤 Sent playlist change notification for device {change['device_id']}")
                    
                except Exception as notify_error:
                    # Don't fail the task if notification fails
                    notifications_failed += 1
                    log_schedule_error(
                        logger,
                        'notification_failed',
                        str(notify_error),
                        {'device_id': change['device_id']}
                    )
        
        # Send evaluation summary to admins
        try:
            duration = time.time() - start_time
            summary_event = schedule_evaluated_event(
                evaluated_at=result['evaluated_at'],
                devices_evaluated=result['devices_evaluated'],
                schedules_active=result['schedules_active'],
                devices_changed=result['devices_changed'],
                duration=duration
            )
            publish_processing_update(summary_event)
        except Exception as e:
            logger.warning(f"Failed to send evaluation summary: {e}")
        
        duration = time.time() - start_time
        result['duration'] = round(duration, 3)
        result['notifications_sent'] = notifications_sent
        result['notifications_failed'] = notifications_failed
        
        # Log structured summary
        log_schedule_evaluation(
            logger,
            devices_evaluated=result['devices_evaluated'],
            schedules_active=result['schedules_active'],
            devices_changed=result['devices_changed'],
            duration_seconds=duration,
            changes=result['changes']
        )
        
        # Human-readable log
        if result['devices_changed'] > 0:
            logger.info(
                f"✅ Schedule evaluation complete in {duration:.2f}s: "
                f"{result['devices_evaluated']} devices, "
                f"{result['schedules_active']} active schedules, "
                f"{result['devices_changed']} playlist changes"
            )
        else:
            logger.debug(
                f"✅ Schedule evaluation complete in {duration:.2f}s: "
                f"{result['devices_evaluated']} devices, no changes"
            )
        
        return result
        
    except Exception as e:
        duration = time.time() - start_time
        
        # Structured error logging
        log_schedule_error(
            logger,
            'evaluation_exception',
            str(e),
            {'duration_seconds': duration}
        )
        
        # Human-readable error log
        logger.error(f"❌ Schedule evaluation failed after {duration:.2f}s: {e}", exc_info=True)
        
        # Return error result but don't fail the task
        # (we want it to retry next minute)
        return {
            'evaluated_at': datetime.now().isoformat(),
            'error': str(e),
            'error_type': type(e).__name__,
            'devices_evaluated': 0,
            'schedules_active': 0,
            'devices_changed': 0,
            'duration': round(duration, 3),
            'success': False
        }


@celery_app.task(base=DatabaseTask, bind=True, name='tasks.scheduler_tasks.force_evaluate_now')
def force_evaluate_now(self):
    """
    Force immediate schedule evaluation (for testing/admin use).
    
    This is the same as evaluate_schedules but can be triggered manually
    via API endpoint for testing or immediate evaluation after schedule changes.
    
    Returns:
        dict: Evaluation statistics and results
    """
    logger.info("🔔 Force evaluation triggered", extra={
        'event_type': 'force_evaluation_triggered',
        'timestamp': datetime.now().isoformat()
    })
    return evaluate_schedules.apply().get()

