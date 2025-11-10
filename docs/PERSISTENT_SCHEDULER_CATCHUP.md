# Persistent Scheduler Catch-Up System

## Overview

The Device Actions Scheduler now implements **persistent, catch-up execution** that survives server failures, daemon downtime, and power outages.

## Problem Solved

**Before:** If the scheduler evaluation happened at 9:26:00 but the server was unresponsive (CPU spike, restart, etc.), the 9:26 power-on action would be missed forever. When the server recovered at 9:27, it would see the time had passed and skip the action.

**Now:** The system tracks execution and catches up on missed actions within a configurable window (default: 10 minutes).

## How It Works

### New Database Fields

```sql
last_executed_at          DATETIME  -- When action last created a command
catch_up_window_minutes   INT       -- How long to retry missed actions (default: 10)
```

### Execution Flow

1. **Celery Beat** runs every minute (as before)
2. For each enabled action, checks: "Should this execute **right now**?"
   - ✅ Is it the scheduled time OR within catch-up window?
   - ✅ Has it NOT executed yet for this occurrence?
   - ✅ Is the catch-up window still valid? (scheduled_time + window_minutes >= now)
3. **Creates command** if conditions met
4. **Updates `last_executed_at`** to prevent duplicates
5. Command persists in queue until daemon picks it up

### Benefits

- **Survives server failures**: Actions execute when server comes back online
- **Survives daemon offline**: Commands queue up until daemon reconnects
- **Survives power outages**: After reboot, actions execute if within window
- **No duplicate executions**: `last_executed_at` prevents re-running
- **Configurable tolerance**: Set catch-up window per action (e.g., 10 min for power, 2 min for input)

## Testing the System

### Test 1: Missed Action Recovery

**Current schedule:**
- Power OFF: 9:43 PM
- Power ON: 9:48 PM

**Scenario:** Server responsive but daemon offline

1. **Before 9:43 PM**: Stop the daemon
   ```bash
   sudo systemctl stop glowworm-daemon
   ```

2. **At 9:43 PM**: Celery creates the power_off command (even though daemon is offline)

3. **At 9:44 PM** (1 min late): Start the daemon
   ```bash
   sudo systemctl start glowworm-daemon
   ```

4. **Expected:** Daemon polls, gets the 1-minute-old command, executes it immediately

**Result:** Display turns off even though daemon was offline during scheduled time! ✅

### Test 2: Server Downtime Recovery

**Scenario:** Entire backend goes down

1. **Before 9:43 PM**: Stop backend
   ```bash
   cd /home/nick/websites/glowworm/docker-publish
   docker compose stop glowworm-backend-dev glowworm-celery-worker-dev
   ```

2. **At 9:46 PM** (3 min late): Restart backend
   ```bash
   docker compose start glowworm-backend-dev glowworm-celery-worker-dev
   ```

3. **Expected:** 
   - Celery beat starts
   - Evaluates schedules
   - Finds "power_off at 9:43" missed by 3 minutes
   - Still within 10-minute window → **creates command**
   - Updates `last_executed_at = 9:46 PM`
   - Daemon picks up and executes

**Result:** Display turns off despite 3-minute server outage! ✅

### Test 3: Catch-Up Window Expiration

**Scenario:** Server down too long

1. **Before 9:43 PM**: Stop backend (as above)

2. **At 9:54 PM** (11 min late): Restart backend

3. **Expected:**
   - Celery evaluates: "9:43 power_off missed by 11 minutes"
   - 11 minutes > 10-minute window → **skip, too stale**
   - No command created

**Result:** Old action not executed (prevents unexpected behavior hours later) ✅

## Code Architecture

### Model: `ScheduledAction`

New method: `should_execute_at(check_time)`
- Replaces ephemeral `is_active_at()` 
- Implements catch-up logic
- Checks `last_executed_at` to prevent duplicates
- Returns `True` if action should create command NOW

### Service: `ScheduledActionService`

New method: `get_executable_actions()`
- Uses `should_execute_at()` for all checks
- Sorts by priority
- Returns actions that should execute (with catch-up)

Updated: `evaluate_and_execute_actions()`
- Uses `get_executable_actions()` instead of deprecated `get_active_actions()`
- Updates `last_executed_at` after creating command
- Prevents duplicate executions

### Migration: `2024111000_exec_tracking`

```sql
ALTER TABLE scheduled_actions 
  ADD COLUMN last_executed_at DATETIME NULL,
  ADD COLUMN catch_up_window_minutes INT NOT NULL DEFAULT 10;

CREATE INDEX idx_scheduled_actions_last_executed 
  ON scheduled_actions (last_executed_at);
```

## Configuration

### Per-Action Catch-Up Window

You can customize the tolerance for each action:

```sql
-- Power actions: 10 min window (default)
UPDATE scheduled_actions 
SET catch_up_window_minutes = 10 
WHERE action_type IN ('power_on', 'power_off');

-- Input switching: 2 min window (more time-sensitive)
UPDATE scheduled_actions 
SET catch_up_window_minutes = 2 
WHERE action_type = 'set_input';

-- Critical actions: 30 min window (must execute)
UPDATE scheduled_actions 
SET catch_up_window_minutes = 30 
WHERE priority >= 90;
```

### System-Wide Polling

- Celery beat: Every 1 minute (configurable in `backend/tasks/scheduler_tasks.py`)
- Daemon polling: Every 5 seconds (configurable in daemon config)

## Monitoring

### Check Last Execution

```sql
SELECT 
  name,
  action_type,
  start_time,
  last_executed_at,
  TIMESTAMPDIFF(MINUTE, last_executed_at, NOW()) as minutes_since_last 
FROM scheduled_actions 
WHERE enabled = 1;
```

### View Pending Commands

```sql
SELECT 
  dc.id,
  dc.command_type,
  dc.status,
  TIMESTAMPDIFF(MINUTE, dc.created_at, NOW()) as age_minutes,
  dd.name as device_name
FROM device_commands dc
JOIN display_devices dd ON dc.device_id = dd.id
WHERE dc.status = 'pending'
ORDER BY dc.created_at;
```

## Troubleshooting

### Action Not Executing

1. **Check if action is enabled:**
   ```sql
   SELECT * FROM scheduled_actions WHERE name = 'Off at night';
   ```

2. **Check last execution time:**
   - If `last_executed_at` is recent, action already ran for this occurrence
   - Wait for next scheduled time

3. **Check catch-up window:**
   - If current time is > (start_time + catch_up_window_minutes), too late
   - Increase `catch_up_window_minutes` if needed

4. **Check daemon status:**
   ```bash
   sudo systemctl status glowworm-daemon
   ```

5. **Check command queue:**
   - Commands might be created but stuck (daemon offline, network issue)

### Duplicate Executions

This should NOT happen due to `last_executed_at` tracking. If it does:
1. Check for database replication lag
2. Verify Celery isn't running multiple beat processes
3. Check logs for errors during `last_executed_at` update

## Performance Impact

- **Minimal overhead**: One additional datetime comparison per action evaluation
- **Indexed lookups**: `last_executed_at` is indexed for fast queries
- **No polling changes**: Still evaluates every minute (same as before)
- **Database writes**: One additional UPDATE per action execution (acceptable)

## Migration Notes

### Automatic Migration

All existing actions automatically get:
- `last_executed_at = NULL` (will execute on next matching schedule)
- `catch_up_window_minutes = 10` (10-minute default)

### Backward Compatibility

- Old code calling `get_active_actions()` still works (deprecated warning in docstring)
- New code should use `get_executable_actions()` for catch-up support

## Future Enhancements

- **UI controls** for catch-up window per action
- **Execution history** table (audit log of when actions ran)
- **Alerting** for actions that consistently miss their window
- **Smart windows** that adjust based on action type (power=10min, input=2min)

---

**Status:** ✅ Implemented and Ready for Testing
**Date:** November 9, 2025
**Feature:** Persistent catch-up execution for scheduled device actions

