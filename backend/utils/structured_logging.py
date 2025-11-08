"""
Structured logging utilities for the scheduler system.

Provides helper functions for logging events with structured data
that can be easily parsed and analyzed.
"""

import logging
from datetime import datetime
from typing import Any, Dict, Optional


def log_structured(
    logger: logging.Logger,
    level: int,
    message: str,
    event_type: str,
    **extra_fields
) -> None:
    """
    Log a message with structured data.
    
    Args:
        logger: Logger instance
        level: Logging level (logging.INFO, logging.ERROR, etc.)
        message: Human-readable message
        event_type: Event type identifier for filtering/parsing
        **extra_fields: Additional structured data
    """
    extra = {
        'event_type': event_type,
        'timestamp': datetime.now().isoformat(),
        **extra_fields
    }
    logger.log(level, message, extra=extra)


def log_schedule_activation(
    logger: logging.Logger,
    schedule_id: int,
    schedule_name: str,
    device_id: int,
    device_name: str,
    playlist_id: int,
    old_playlist_id: Optional[int],
    priority: int,
    reason: str
) -> None:
    """Log a schedule activation event with full context."""
    log_structured(
        logger,
        logging.INFO,
        f"Schedule '{schedule_name}' activated on device '{device_name}'",
        event_type='schedule_activated',
        schedule_id=schedule_id,
        schedule_name=schedule_name,
        device_id=device_id,
        device_name=device_name,
        playlist_id=playlist_id,
        old_playlist_id=old_playlist_id,
        priority=priority,
        reason=reason
    )


def log_schedule_evaluation(
    logger: logging.Logger,
    devices_evaluated: int,
    schedules_active: int,
    devices_changed: int,
    duration_seconds: float,
    changes: list
) -> None:
    """Log a schedule evaluation summary."""
    log_structured(
        logger,
        logging.INFO,
        f"Schedule evaluation complete: {devices_evaluated} devices, {schedules_active} active, {devices_changed} changes in {duration_seconds:.2f}s",
        event_type='schedule_evaluation_complete',
        devices_evaluated=devices_evaluated,
        schedules_active=schedules_active,
        devices_changed=devices_changed,
        duration_seconds=duration_seconds,
        changes_count=len(changes)
    )


def log_schedule_error(
    logger: logging.Logger,
    error_type: str,
    error_message: str,
    context: Dict[str, Any]
) -> None:
    """Log a scheduler error with context."""
    log_structured(
        logger,
        logging.ERROR,
        f"Scheduler error ({error_type}): {error_message}",
        event_type='scheduler_error',
        error_type=error_type,
        error_message=error_message,
        **context
    )


def log_schedule_created(
    logger: logging.Logger,
    schedule_id: int,
    schedule_name: str,
    device_id: int,
    playlist_id: int,
    schedule_type: str,
    priority: int,
    created_by_user_id: Optional[int]
) -> None:
    """Log schedule creation."""
    log_structured(
        logger,
        logging.INFO,
        f"Created schedule '{schedule_name}' (ID: {schedule_id})",
        event_type='schedule_created',
        schedule_id=schedule_id,
        schedule_name=schedule_name,
        device_id=device_id,
        playlist_id=playlist_id,
        schedule_type=schedule_type,
        priority=priority,
        created_by_user_id=created_by_user_id
    )


def log_schedule_updated(
    logger: logging.Logger,
    schedule_id: int,
    fields_updated: list,
    updated_by_user_id: Optional[int]
) -> None:
    """Log schedule update."""
    log_structured(
        logger,
        logging.INFO,
        f"Updated schedule {schedule_id}: {', '.join(fields_updated)}",
        event_type='schedule_updated',
        schedule_id=schedule_id,
        fields_updated=fields_updated,
        updated_by_user_id=updated_by_user_id
    )


def log_schedule_deleted(
    logger: logging.Logger,
    schedule_id: int,
    schedule_name: str,
    deleted_by_user_id: Optional[int]
) -> None:
    """Log schedule deletion."""
    log_structured(
        logger,
        logging.INFO,
        f"Deleted schedule {schedule_id} ('{schedule_name}')",
        event_type='schedule_deleted',
        schedule_id=schedule_id,
        schedule_name=schedule_name,
        deleted_by_user_id=deleted_by_user_id
    )


def log_performance_metric(
    logger: logging.Logger,
    metric_name: str,
    value: float,
    unit: str = 'seconds',
    **context
) -> None:
    """Log a performance metric."""
    log_structured(
        logger,
        logging.DEBUG,
        f"Performance: {metric_name} = {value}{unit}",
        event_type='performance_metric',
        metric_name=metric_name,
        value=value,
        unit=unit,
        **context
    )

