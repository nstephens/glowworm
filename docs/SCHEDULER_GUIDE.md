# Playlist Scheduler - Complete Guide

## Table of Contents
1. [Overview](#overview)
2. [Admin Guide](#admin-guide)
3. [API Documentation](#api-documentation)
4. [Developer Guide](#developer-guide)
5. [Troubleshooting](#troubleshooting)

---

## Overview

The Playlist Scheduler allows you to automatically change what playlist displays on your devices based on time and date. This is perfect for:
- **Weekday/Weekend Schedules**: Show work-related content during the week, family photos on weekends
- **Holiday Schedules**: Automatically switch to holiday-themed playlists
- **Event-Based**: Birthday playlists, seasonal content, special occasions
- **Time-of-Day**: Morning, afternoon, evening content rotation

### Key Features
- ✅ **Recurring Schedules**: Play playlists on specific days of the week
- ✅ **Specific Date Schedules**: One-time or annually recurring dates
- ✅ **Priority-Based Conflict Resolution**: Automatically handles overlapping schedules
- ✅ **Real-Time Updates**: Devices update automatically via WebSocket
- ✅ **Preview & Simulation**: Test schedules before they go live
- ✅ **Conflict Detection**: Warns you about overlapping schedules

---

## Admin Guide

### Creating Your First Schedule

1. **Navigate to Scheduler**
   - From the admin dashboard, click **Scheduler** in the sidebar
   - You'll see the scheduler page with stats and any existing schedules

2. **Click "Create Schedule"**
   - Click the blue **Create Schedule** button in the top right

3. **Fill Out the Form**

   **Basic Information:**
   - **Name**: Give your schedule a descriptive name (e.g., "Weekend Morning Photos")
   - **Description** (optional): Add notes about what this schedule does

   **Device & Playlist:**
   - **Device**: Select which display this schedule applies to
   - **Playlist**: Choose which playlist to show

   **Schedule Type:**
   - **Recurring**: For schedules that repeat on specific days of the week
   - **Specific Date**: For one-time events or annually recurring dates

4. **Configure Schedule Details**

   **For Recurring Schedules:**
   - Select one or more days of the week (click the badges to toggle)
   - Set start time (when the playlist begins playing)
   - Set end time (when to stop and return to default)
   
   **For Specific Date Schedules:**
   - Select the date
   - Set start and end times
   - Enable "Repeat annually" for birthdays, holidays, etc.

5. **Set Priority**
   - Use the slider to set priority (0-100)
   - Higher numbers = higher priority
   - **Important**: Specific date schedules automatically get +1000 priority boost

6. **Click "Create Schedule"**

### Understanding the Priority System

When multiple schedules overlap, the system uses these rules to decide which playlist to show:

1. **Specific Date Schedules** always win over Recurring schedules
   - Specific dates get +1000 priority automatically
   - Example: Christmas playlist (specific date, priority 0) beats Weekly schedule (recurring, priority 100)

2. **Higher Priority Number** wins when schedule types are the same
   - Example: Important Meeting (priority 50) beats Regular Schedule (priority 10)

3. **First Created** wins when priorities are equal
   - The schedule created first takes precedence

**Priority Recommendations:**
- Default/background schedules: 0-20
- Regular scheduled content: 20-50
- Important events: 50-80
- Critical/override: 80-100

### Managing Conflicts

The system will warn you when creating schedules that conflict with existing ones:

**Conflict Warnings:**
- **Green "Will Override" badge**: Your new schedule has higher priority and will take precedence
- **Red "Will Be Overridden" badge**: An existing schedule has higher priority and will win

**To Resolve Conflicts:**
1. Adjust the priority slider in the form
2. The warning updates in real-time as you change priority
3. Continue when you're satisfied with the resolution

**Example:**
```
Creating: "Weekend Photos" (Recurring: Sat-Sun, 9am-5pm, Priority: 10)
Conflicts with: "Family Breakfast" (Recurring: Sat-Sun, 9am-11am, Priority: 50)

Result: "Family Breakfast" wins from 9-11am, "Weekend Photos" plays 11am-5pm
```

### Using Schedule Preview

The Preview feature lets you simulate any date/time to see which schedule would be active:

1. Select a device from the dropdown
2. Pick a date and time
3. Click "Preview Schedule"
4. See which schedule would be active and why
5. See any conflicting schedules that would be overridden

**Use Cases:**
- Verify holiday schedules before the date
- Check weekend coverage
- Debug unexpected playlist changes
- Plan new schedules without conflicts

### Managing Devices with Schedules

Each authorized device card shows:
- **Active Schedule**: Currently playing schedule (if any)
- **Default Playlist**: Falls back to this when no schedule is active
- **Quick Link**: Jump to schedule management

**Click "Manage Schedules"** to see all schedules for that device.

### Best Practices

1. **Start Simple**
   - Create basic schedules first
   - Test thoroughly before adding complex overlaps

2. **Use Descriptive Names**
   - "Weekday 9-5 Office Photos" is better than "Schedule 1"
   - Include time ranges in names for clarity

3. **Document Special Dates**
   - Use descriptions to explain why schedules exist
   - Note annual recurring schedules clearly

4. **Check Conflicts**
   - Review conflict warnings carefully
   - Use preview to verify behavior

5. **Monitor Changes**
   - Check device cards to see active schedules
   - Use "Evaluate Now" to force immediate updates

### Common Scenarios

#### Weekend Schedule
```
Name: "Weekend Family Photos"
Type: Recurring
Days: Saturday, Sunday  
Time: 8:00 AM - 10:00 PM
Priority: 20
```

#### Holiday Schedule
```
Name: "Christmas Day"
Type: Specific Date
Date: December 25
Time: 12:00 AM - 11:59 PM
Annual: Yes
Priority: 0 (specific date boost makes it 1000)
```

#### Birthday Schedule
```
Name: "Mom's Birthday"
Type: Specific Date
Date: May 15
Time: 12:00 AM - 11:59 PM
Annual: Yes
Priority: 0
```

#### Work Hours Schedule
```
Name: "Office Hours Slideshow"
Type: Recurring
Days: Monday, Tuesday, Wednesday, Thursday, Friday
Time: 9:00 AM - 5:00 PM
Priority: 10
```

---

## API Documentation

Base URL: `/api/scheduler`

All endpoints require authentication. Include session cookie or auth token.

### Endpoints

#### GET /schedules
List all schedules with optional filtering.

**Query Parameters:**
- `device_id` (optional): Filter by device
- `playlist_id` (optional): Filter by playlist
- `enabled` (optional): Filter by enabled status
- `schedule_type` (optional): Filter by type ('recurring' or 'specific_date')

**Response:**
```json
[
  {
    "id": 1,
    "device_id": 5,
    "playlist_id": 10,
    "schedule_type": "recurring",
    "name": "Weekend Photos",
    "description": "Family photos for weekends",
    "priority": 20,
    "enabled": true,
    "days_of_week": ["saturday", "sunday"],
    "start_time": "09:00:00",
    "end_time": "21:00:00",
    "created_at": "2025-11-08T10:00:00Z",
    "updated_at": "2025-11-08T10:00:00Z",
    "device_name": "Living Room Display",
    "playlist_name": "Weekend Collection"
  }
]
```

#### GET /schedules/{id}
Get a specific schedule by ID.

**Response:** Single schedule object (same format as list)

#### POST /schedules
Create a new schedule.

**Request Body (Recurring):**
```json
{
  "device_id": 5,
  "playlist_id": 10,
  "schedule_type": "recurring",
  "name": "Weekend Photos",
  "description": "Family photos for weekends",
  "priority": 20,
  "enabled": true,
  "days_of_week": ["saturday", "sunday"],
  "start_time": "09:00:00",
  "end_time": "21:00:00"
}
```

**Request Body (Specific Date):**
```json
{
  "device_id": 5,
  "playlist_id": 15,
  "schedule_type": "specific_date",
  "name": "Christmas Day",
  "priority": 0,
  "enabled": true,
  "specific_date": "2025-12-25",
  "specific_start_time": "00:00:00",
  "specific_end_time": "23:59:00",
  "annual_recurrence": true
}
```

**Response:** Created schedule object (201 Created)

#### PUT /schedules/{id}
Update an existing schedule.

**Request Body:** Any fields from create (partial updates supported)

**Response:** Updated schedule object

#### DELETE /schedules/{id}
Delete a schedule.

**Response:**
```json
{
  "message": "Schedule deleted successfully"
}
```

#### GET /devices/{device_id}/schedules
Get all schedules for a specific device.

**Response:** Array of schedule objects for that device

#### GET /devices/{device_id}/active
Get the currently active schedule for a device.

**Response:**
```json
{
  "schedule_id": 1,
  "schedule_name": "Weekend Photos",
  "playlist_id": 10,
  "playlist_name": "Weekend Collection",
  "active_since": "2025-11-08T09:00:00Z",
  "active_until": "2025-11-08T21:00:00Z",
  "is_default": false
}
```

If no schedule is active:
```json
{
  "schedule_id": null,
  "playlist_id": 3,
  "playlist_name": "Default Playlist",
  "is_default": true
}
```

#### POST /devices/{device_id}/preview
Simulate what schedule would be active at a specific date/time.

**Request Body:**
```json
{
  "date": "2025-12-25",
  "time": "14:00:00"
}
```

**Response:**
```json
{
  "datetime": "2025-12-25T14:00:00Z",
  "active_schedule": {
    "id": 5,
    "name": "Christmas Day",
    "playlist_id": 15,
    "playlist_name": "Holiday Photos",
    "priority": 0,
    "reason": "Specific date schedule"
  },
  "conflicting_schedules": [
    {
      "id": 2,
      "name": "Weekend Photos",
      "priority": 20,
      "reason": "Lower priority (20 < 1000)"
    }
  ]
}
```

#### POST /evaluate-now
Force immediate schedule evaluation (admin only).

**Response:**
```json
{
  "evaluated_at": "2025-11-08T14:30:00Z",
  "devices_evaluated": 5,
  "schedules_active": 3,
  "playlists_changed": 2,
  "devices_updated": [1, 3],
  "duration": 0.125
}
```

### Error Responses

All endpoints return standard error format:

```json
{
  "detail": "Device not found",
  "status_code": 404
}
```

**Common Error Codes:**
- `400`: Validation error (bad request data)
- `401`: Not authenticated
- `403`: Not authorized (admin required)
- `404`: Resource not found
- `422`: Unprocessable entity (validation failed)
- `500`: Internal server error

---

## Developer Guide

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Scheduler System                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐       ┌──────────────┐      ┌──────────────┐  │
│  │   Celery    │──────>│  Scheduler   │─────>│   Database   │  │
│  │ Beat Task   │ 60s   │   Service    │      │   Updates    │  │
│  └─────────────┘       └──────────────┘      └──────────────┘  │
│         │                      │                     │          │
│         │                      v                     │          │
│         │              ┌──────────────┐              │          │
│         │              │  Redis Pub   │              │          │
│         │              │   /Sub       │              │          │
│         │              └──────────────┘              │          │
│         │                      │                     │          │
│         v                      v                     v          │
│  ┌─────────────┐       ┌──────────────┐      ┌──────────────┐  │
│  │  WebSocket  │<──────│    Redis     │      │  FastAPI     │  │
│  │  Notifier   │       │  Subscriber  │      │  Endpoints   │  │
│  └─────────────┘       └──────────────┘      └──────────────┘  │
│         │                                            │          │
│         v                                            v          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │            Display Devices (WebSocket Clients)           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Database Schema

**Table: `scheduled_playlists`**

```sql
CREATE TABLE scheduled_playlists (
    id INT PRIMARY KEY AUTO_INCREMENT,
    device_id INT NOT NULL,
    playlist_id INT NOT NULL,
    schedule_type ENUM('recurring', 'specific_date') NOT NULL,
    
    -- Recurring fields
    days_of_week JSON,  -- ["monday", "tuesday", ...]
    start_time TIME,
    end_time TIME,
    
    -- Specific date fields
    specific_date DATE,
    specific_start_time TIME,
    specific_end_time TIME,
    annual_recurrence BOOLEAN DEFAULT FALSE,
    
    -- Common fields
    name VARCHAR(128) NOT NULL,
    description TEXT,
    priority INT DEFAULT 0,
    enabled BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by_user_id INT,
    
    FOREIGN KEY (device_id) REFERENCES display_devices(id) ON DELETE CASCADE,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_device_enabled (device_id, enabled),
    INDEX idx_schedule_type (schedule_type),
    INDEX idx_priority (priority)
);
```

### Service Layer

**File:** `backend/services/scheduler_service.py`

**Key Methods:**

- `get_active_schedule(device_id, at_datetime)` - Determines which schedule is active
- `evaluate_all_devices()` - Evaluates all devices and updates playlists
- `get_conflicting_schedules(device_id)` - Finds overlapping schedules
- `create_schedule(...)` - Creates new schedule with validation
- `update_schedule(schedule_id, **kwargs)` - Updates schedule
- `delete_schedule(schedule_id)` - Deletes schedule

**Priority Calculation:**
```python
def get_effective_priority(schedule):
    if schedule.schedule_type == ScheduleType.SPECIFIC_DATE:
        return schedule.priority + 1000
    return schedule.priority
```

### Celery Configuration

**File:** `backend/celery_app.py`

**Beat Schedule:**
```python
celery_app.conf.beat_schedule = {
    'evaluate_playlist_schedules': {
        'task': 'tasks.scheduler_tasks.evaluate_schedules',
        'schedule': 60.0,  # Every 60 seconds
    },
}
```

**Tasks:**
- `evaluate_schedules`: Main evaluation task (runs every 60s)
- `force_evaluate_now`: Manual evaluation trigger

### WebSocket Events

The scheduler sends two types of WebSocket events:

**1. Playlist Scheduled Change** (`playlist:scheduled_change`)
```json
{
  "type": "playlist:scheduled_change",
  "timestamp": "2025-11-08T14:30:00Z",
  "data": {
    "device_id": 5,
    "device_name": "Living Room",
    "old_playlist_id": 3,
    "new_playlist_id": 10,
    "schedule_id": 7,
    "schedule_name": "Weekend Photos",
    "changed_at": "2025-11-08T14:30:00Z"
  }
}
```

**2. Schedule Evaluation Summary** (`scheduler:evaluated`)
```json
{
  "type": "scheduler:evaluated",
  "timestamp": "2025-11-08T14:30:00Z",
  "data": {
    "evaluated_at": "2025-11-08T14:30:00Z",
    "devices_evaluated": 5,
    "schedules_active": 3,
    "devices_changed": [1, 3],
    "duration": 0.125
  }
}
```

### Frontend Components

**Main Components:**
- `SchedulerPage`: Main scheduler management page
- `ScheduleForm`: Create/edit form with validation and conflict detection
- `ScheduleList`: List of schedules grouped by device
- `ScheduleCard`: Individual schedule display
- `SchedulePreview`: Simulation and conflict preview
- `ScheduleWidget`: Shows active schedule on device cards

**Hooks:**
- `useScheduleConflicts`: Real-time conflict detection

### Adding New Schedule Types

To extend the system with new schedule types:

1. **Update Database Schema** (`backend/models/scheduled_playlist.py`)
   ```python
   class ScheduleType(str, enum.Enum):
       RECURRING = "recurring"
       SPECIFIC_DATE = "specific_date"
       YOUR_NEW_TYPE = "your_new_type"
   ```

2. **Add Migration** (create new Alembic migration)

3. **Update Service Logic** (`backend/services/scheduler_service.py`)
   - Add validation in `create_schedule()`
   - Update `is_active_at()` logic in model

4. **Update Frontend Types** (`frontend/src/types/index.ts`)
   ```typescript
   export type ScheduleType = 'recurring' | 'specific_date' | 'your_new_type';
   ```

5. **Update Form** (`frontend/src/components/scheduler/ScheduleForm.tsx`)
   - Add new type button
   - Add conditional field rendering
   - Add validation logic

### Structured Logging

The scheduler uses structured logging for monitoring:

```python
from utils.structured_logging import log_schedule_activation

log_schedule_activation(
    logger,
    schedule_id=schedule.id,
    schedule_name=schedule.name,
    device_id=device.id,
    device_name=device.name,
    playlist_id=new_playlist_id,
    old_playlist_id=old_playlist_id,
    priority=schedule.priority,
    reason="Schedule active at 14:30"
)
```

**Event Types:**
- `schedule_created`: New schedule created
- `schedule_updated`: Schedule modified
- `schedule_deleted`: Schedule removed
- `schedule_activated`: Schedule became active
- `schedule_evaluation_complete`: Evaluation cycle finished
- `scheduler_error`: Error occurred
- `performance_metric`: Performance measurement

**Log Filtering:**
```bash
# View only schedule activations
docker compose logs glowworm-celery-worker-dev | grep "event_type.*schedule_activated"

# View evaluation summaries
docker compose logs glowworm-celery-worker-dev | grep "event_type.*schedule_evaluation_complete"

# View errors
docker compose logs glowworm-celery-worker-dev | grep "event_type.*scheduler_error"
```

---

## Troubleshooting

### Schedules Not Activating

**Check:**
1. Is the schedule enabled? (Check the badge - should say "Enabled")
2. Is the current time within the schedule range?
3. Are there higher priority schedules overriding it?
4. Is Celery Beat running? Check: `docker compose ps glowworm-celery-worker-dev`

**Debug:**
```bash
# Check Celery logs
cd /home/nick/websites/glowworm/docker-publish
docker compose logs --tail=100 glowworm-celery-worker-dev

# Look for evaluation logs:
# "🕒 Starting schedule evaluation"
# "✅ Schedule evaluation complete"

# Force immediate evaluation
curl -X POST http://localhost:3001/api/scheduler/evaluate-now -H "Cookie: your-session-cookie"
```

### Device Not Updating

**Check:**
1. Is the device authorized? (Check Displays page)
2. Is WebSocket connected? (Check device page, look for connection indicator)
3. Did the evaluation actually change the playlist? (Check logs)

**Debug:**
```bash
# Check Redis subscriber
docker compose logs glowworm-backend-dev | grep "Redis subscriber"

# Check WebSocket messages
# Open browser console on display device, look for:
# "WebSocket connected"
# "Received playlist_update"
```

### Conflict Resolution Not Working

**Check:**
1. Review the priority values (remember: specific dates get +1000)
2. Use the Preview feature to simulate and verify
3. Check creation dates if priorities are equal

**Debug:**
- Use Schedule Preview with the exact date/time in question
- Check conflict warnings in the form when editing

### Performance Issues

**Check:**
1. Number of devices and schedules
2. Evaluation duration (should be <1 second typically)
3. Database query performance

**Debug:**
```bash
# Check evaluation time in logs
docker compose logs glowworm-celery-worker-dev | grep "evaluation complete"

# Look for: "in 0.12s" (duration)
```

**Optimize:**
- Add database indexes (already included)
- Reduce number of schedules if excessive (>100 per device)
- Consider archiving old specific date schedules

### Celery Not Running

**Symptoms:**
- No automatic evaluation
- "Evaluate Now" works but schedules don't change on their own

**Fix:**
```bash
cd /home/nick/websites/glowworm/docker-publish

# Check if Celery worker is running
docker compose ps glowworm-celery-worker-dev

# If not running, start it
docker compose up -d glowworm-celery-worker-dev

# Check logs for errors
docker compose logs --tail=50 glowworm-celery-worker-dev
```

### WebSocket Not Connecting

**Symptoms:**
- Device doesn't auto-update when playlist changes
- No real-time notifications

**Fix:**
```bash
# Check backend logs for Redis subscriber
docker compose logs glowworm-backend-dev | grep "Redis subscriber"

# Should see: "Redis subscriber task started"

# Check WebSocket endpoint is available
curl http://localhost:3001/api/ws/device/your-token
# Should upgrade to WebSocket connection

# Restart backend if needed
docker compose restart glowworm-backend-dev
```

### Common Error Messages

**"Device not found"**
- Device ID doesn't exist or was deleted
- Check Displays page for valid device IDs

**"Playlist not found"**
- Playlist ID doesn't exist or was deleted
- Check Playlists page for valid playlist IDs

**"Start time must be before end time"**
- Time range validation failed
- Ensure start < end (can't create overnight schedules spanning midnight yet)

**"At least one day must be selected"**
- Recurring schedule needs days of week
- Click at least one day badge in the form

---

## Quick Reference

### Key Files

**Backend:**
- `backend/models/scheduled_playlist.py` - Database model
- `backend/services/scheduler_service.py` - Business logic
- `backend/tasks/scheduler_tasks.py` - Celery tasks
- `backend/api/scheduler.py` - REST API endpoints
- `backend/websocket/scheduler_events.py` - WebSocket event definitions
- `backend/utils/structured_logging.py` - Logging utilities

**Frontend:**
- `frontend/src/pages/Scheduler.tsx` - Main scheduler page
- `frontend/src/components/scheduler/ScheduleForm.tsx` - Create/edit form
- `frontend/src/components/scheduler/ScheduleList.tsx` - Schedule listing
- `frontend/src/components/scheduler/ScheduleCard.tsx` - Individual schedule
- `frontend/src/components/scheduler/SchedulePreview.tsx` - Preview tool
- `frontend/src/components/scheduler/ScheduleWidget.tsx` - Device card widget
- `frontend/src/hooks/useScheduleConflicts.ts` - Conflict detection

### Configuration

**Celery Beat Interval:** 60 seconds (configurable in `celery_app.py`)

**Priority Boost for Specific Dates:** +1000 (hardcoded in model)

**WebSocket Redis Channel:** `glowworm:processing:updates`

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review logs: `docker compose logs glowworm-celery-worker-dev`
3. Use the Preview feature to debug schedule behavior
4. Check GitHub issues or create a new one

---

**Last Updated:** November 8, 2025  
**Version:** 1.0.0  
**Feature:** Playlist Scheduler

