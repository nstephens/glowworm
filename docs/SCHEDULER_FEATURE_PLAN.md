# Playlist Scheduler Feature - Design Plan

## 🎯 Goal

Enable automatic playlist switching based on time schedules, supporting both recurring (day of week) and specific date schedules.

## Current Architecture

**Display Device → Playlist Assignment:**
- DisplayDevice has `playlist_id` field (static assignment)
- Admin manually assigns playlist via `/admin/devices/{id}/playlist`
- Playlist stays until manually changed

## New Architecture

**Display Device → Schedule → Playlists:**
- Add ScheduledPlaylist table for schedule rules
- Background scheduler service evaluates rules
- Automatically switches `playlist_id` based on active schedule
- WebSocket notification to displays when playlist changes

## Database Schema

### New Table: `scheduled_playlists`

```sql
CREATE TABLE scheduled_playlists (
    id INT PRIMARY KEY AUTO_INCREMENT,
    device_id INT NOT NULL,  -- FK to display_devices
    playlist_id INT NOT NULL,  -- FK to playlists
    
    -- Schedule Type
    schedule_type ENUM('recurring', 'specific_date') NOT NULL,
    
    -- Recurring Schedule (day of week + time)
    days_of_week JSON,  -- Array: ["monday", "wednesday", "friday"]
    start_time TIME,  -- e.g., "09:00:00"
    end_time TIME,  -- e.g., "17:00:00"
    
    -- Specific Date Schedule
    specific_date DATE,  -- e.g., "2025-12-25"
    specific_start_time TIME,  -- e.g., "00:00:00"
    specific_end_time TIME,  -- e.g., "23:59:59"
    
    -- Metadata
    name VARCHAR(128),  -- e.g., "Work Hours", "Christmas Day"
    description TEXT,  -- Optional description
    priority INT DEFAULT 0,  -- Higher priority wins if overlapping
    enabled BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by_user_id INT,  -- FK to users
    
    -- Constraints
    FOREIGN KEY (device_id) REFERENCES display_devices(id) ON DELETE CASCADE,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    INDEX idx_device_enabled (device_id, enabled),
    INDEX idx_schedule_type (schedule_type)
);
```

### Schedule Evaluation Logic

**Priority Order:**
1. Specific date schedules (highest priority)
2. Recurring schedules by priority value
3. Default device playlist (fallback)

**Example:**
```
Device: Living Room Display
- Default: "General Photos" (playlist_id=1)
- Schedule 1: "Work Day Motivation" Mon-Fri 7am-6pm (playlist_id=2, priority=1)
- Schedule 2: "Weekend Relaxation" Sat-Sun all day (playlist_id=3, priority=1)
- Schedule 3: "Christmas 2025" Dec 25, 2025 all day (playlist_id=4, priority=10)

Result:
- Dec 25, 2025: Shows Christmas playlist (specific date wins)
- Monday 10am: Shows Work Day Motivation
- Saturday 2pm: Shows Weekend Relaxation
- Monday 7pm: Shows General Photos (outside schedule window)
```

## Backend Components

### 1. Model (`backend/models/scheduled_playlist.py`)

```python
class ScheduleType(enum.Enum):
    RECURRING = "recurring"
    SPECIFIC_DATE = "specific_date"

class ScheduledPlaylist(Base):
    __tablename__ = "scheduled_playlists"
    
    id = Column(Integer, primary_key=True)
    device_id = Column(Integer, ForeignKey('display_devices.id'), nullable=False)
    playlist_id = Column(Integer, ForeignKey('playlists.id'), nullable=False)
    
    schedule_type = Column(Enum(ScheduleType))
    
    # Recurring
    days_of_week = Column(JSON)  # ["monday", "tuesday", ...]
    start_time = Column(Time)
    end_time = Column(Time)
    
    # Specific Date
    specific_date = Column(Date)
    specific_start_time = Column(Time)
    specific_end_time = Column(Time)
    
    # Metadata
    name = Column(String(128))
    description = Column(Text)
    priority = Column(Integer, default=0)
    enabled = Column(Boolean, default=True)
    
    # Relationships
    device = relationship("DisplayDevice", back_populates="schedules")
    playlist = relationship("Playlist")
```

### 2. Service (`backend/services/scheduler_service.py`)

```python
class SchedulerService:
    def create_schedule(...)
    def update_schedule(...)
    def delete_schedule(...)
    def get_schedules_for_device(device_id)
    def get_active_schedule(device_id, at_time=None)  # Returns active schedule now or at specific time
    def evaluate_all_schedules()  # Called by background task
```

### 3. Background Task (`backend/tasks/scheduler_tasks.py`)

```python
@celery_app.task
def evaluate_schedules():
    """
    Runs every minute to check if any devices need playlist changes.
    Updates device.playlist_id when schedule changes.
    Sends WebSocket notification to affected displays.
    """
```

**Celery Beat Configuration:**
```python
celery_app.conf.beat_schedule = {
    'evaluate-schedules': {
        'task': 'tasks.scheduler_tasks.evaluate_schedules',
        'schedule': 60.0,  # Every 60 seconds
    },
}
```

### 4. API Endpoints (`backend/api/scheduler.py`)

```python
# Admin endpoints
POST   /api/scheduler/schedules              # Create schedule
GET    /api/scheduler/schedules              # List all schedules
GET    /api/scheduler/schedules/{id}         # Get schedule details
PUT    /api/scheduler/schedules/{id}         # Update schedule
DELETE /api/scheduler/schedules/{id}         # Delete schedule

# Device-specific
GET    /api/scheduler/devices/{id}/schedules # Get schedules for device
GET    /api/scheduler/devices/{id}/active    # Get currently active schedule
POST   /api/scheduler/devices/{id}/preview   # Preview schedule for date/time

# Testing
POST   /api/scheduler/evaluate-now           # Force immediate evaluation (testing)
```

## Frontend Components

### 1. Schedule Manager UI (`frontend/src/pages/Scheduler.tsx`)

**Features:**
- List all schedules grouped by device
- Create/edit/delete schedules
- Visual calendar view showing schedule coverage
- Conflict detection and warnings

### 2. Schedule Form (`frontend/src/components/ScheduleForm.tsx`)

**Fields:**
- Device selection
- Playlist selection
- Schedule type (Recurring vs Specific Date)
- For Recurring:
  - Day of week checkboxes
  - Start time picker
  - End time picker
- For Specific Date:
  - Date picker
  - All day toggle or time range
- Name and description
- Priority (for conflict resolution)
- Enabled toggle

### 3. Schedule Calendar View (`frontend/src/components/ScheduleCalendar.tsx`)

**Displays:**
- Weekly view showing recurring schedules
- Monthly view with specific date markers
- Color-coded by playlist
- Hover to see schedule details

### 4. Device Schedule Widget (`frontend/src/components/DeviceScheduleWidget.tsx`)

**On Displays page:**
- Shows current/upcoming schedule for each device
- "Next Change: 5:00 PM → Weekend Playlist"
- Quick access to edit schedules

## Implementation Phases

### Phase 1: Backend Foundation (Start Here)
1. Create `ScheduledPlaylist` model
2. Create Alembic migration
3. Create `SchedulerService` with CRUD operations
4. Create API endpoints
5. Add validation and conflict detection

### Phase 2: Background Scheduler
1. Create Celery task for schedule evaluation
2. Configure Celery Beat
3. Implement schedule matching logic
4. Add WebSocket notifications for playlist changes
5. Add logging and monitoring

### Phase 3: Frontend UI
1. Create Scheduler page and navigation
2. Build schedule creation form
3. Add schedule list/edit/delete
4. Implement calendar visualization
5. Add to Displays page (show active schedule)

### Phase 4: Testing & Polish
1. Unit tests for schedule evaluation logic
2. Integration tests for time-based switching
3. Timezone handling
4. Conflict resolution UX
5. Documentation

## Edge Cases to Handle

### Time Conflicts
**Scenario:** Two schedules overlap
**Solution:** Higher priority wins, tie goes to more specific (specific_date > recurring)

### Timezone
**Storage:** All times in UTC
**Display:** Convert to device's timezone (add timezone field to DisplayDevice?)
**Evaluation:** Use device timezone for schedule matching

### Schedule Gaps
**Scenario:** No active schedule at current time
**Solution:** Fall back to device's default `playlist_id`

### Disabled Schedules
**Scenario:** Schedule exists but `enabled=false`
**Solution:** Skip during evaluation, acts like it doesn't exist

### Deleted Playlist
**Scenario:** Playlist assigned to schedule is deleted
**Solution:** CASCADE delete schedule OR mark as invalid

### Multiple Devices
**Scenario:** Want same schedule on multiple devices
**Solution:** Create separate schedules per device (simpler) OR add device_group concept (future)

## Data Examples

### Recurring Schedule
```json
{
  "id": 1,
  "device_id": 5,
  "playlist_id": 12,
  "schedule_type": "recurring",
  "name": "Weekday Morning Motivation",
  "days_of_week": ["monday", "tuesday", "wednesday", "thursday", "friday"],
  "start_time": "07:00:00",
  "end_time": "12:00:00",
  "priority": 1,
  "enabled": true
}
```

### Specific Date Schedule
```json
{
  "id": 2,
  "device_id": 5,
  "playlist_id": 15,
  "schedule_type": "specific_date",
  "name": "Christmas 2025",
  "specific_date": "2025-12-25",
  "specific_start_time": "00:00:00",
  "specific_end_time": "23:59:59",
  "priority": 10,
  "enabled": true
}
```

## WebSocket Integration

### New Event Types
```javascript
// Notify display that playlist changed due to schedule
{
  type: "playlist_scheduled_change",
  device_token: "abc123",
  old_playlist_id: 5,
  new_playlist_id: 12,
  schedule_name: "Weekday Morning Motivation",
  scheduled_until: "2025-11-08T12:00:00Z"
}

// Notify admin of schedule evaluation
{
  type: "schedule_evaluated",
  changes_count: 3,
  devices_affected: [5, 7, 9]
}
```

## Future Enhancements (Not in Initial Scope)

- **Display Power Scheduling:** Same framework, different action type
- **Volume/Brightness Scheduling:** Adjust settings by time
- **Conditional Schedules:** Based on weather, events, etc.
- **Schedule Templates:** Copy schedules across devices
- **Device Groups:** Assign schedules to multiple devices at once
- **Blackout Periods:** Don't show certain content during specific times

## Success Criteria

✅ Can create recurring schedules (day of week + time range)  
✅ Can create specific date schedules (holidays, etc.)  
✅ Scheduler evaluates every minute and switches playlists  
✅ Display devices receive WebSocket notification and reload playlist  
✅ Admin UI shows active schedule for each device  
✅ Priority system resolves conflicts correctly  
✅ Fallback to default playlist when no schedule active  

## Technical Considerations

### Performance
- Schedule evaluation should be fast (< 100ms for 100 devices)
- Use database indexes on device_id, enabled, schedule_type
- Cache schedule rules in memory (invalidate on changes)

### Reliability
- If scheduler fails, devices keep showing current playlist
- Missed evaluations don't cause issues (evaluates current time, not deltas)
- Graceful degradation if WebSocket fails

### Scalability
- Stateless evaluation (no memory between runs)
- Can run multiple scheduler instances (each evaluates independently)
- Database as single source of truth

---

**Ready to start implementing Phase 1: Backend Foundation?**

