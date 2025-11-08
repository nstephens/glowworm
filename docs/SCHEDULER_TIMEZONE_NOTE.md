# Scheduler Timezone Important Note

## ⚠️ Current Limitation: UTC Time Only

**All schedule times are currently in UTC timezone.**

### What This Means

When you create a schedule in the UI:
- If you want it to activate at **3:00 PM EST**, you must enter **8:00 PM (20:00)**
- If you want it to activate at **9:00 AM EST**, you must enter **2:00 PM (14:00)**

### Time Conversion Reference

EST (UTC-5) to UTC conversion:
```
Local EST    →    UTC
12:00 AM     →    05:00 AM
06:00 AM     →    11:00 AM
12:00 PM     →    05:00 PM (17:00)
03:00 PM     →    08:00 PM (20:00)
06:00 PM     →    11:00 PM (23:00)
```

**Formula**: UTC = Local EST + 5 hours

### Why This Happens

The Docker containers run in UTC timezone by default. While we've added:
- `TZ: America/New_York` environment variable
- `/etc/localtime` and `/etc/timezone` volume mounts

Python's `datetime.now()` still returns UTC because the base image doesn't include the `tzdata` package.

### Permanent Solutions

**Option 1: Rebuild with tzdata** (Recommended for production)
Add to `Dockerfile.backend`:
```dockerfile
RUN apt-get update && apt-get install -y tzdata && rm -rf /var/lib/apt/lists/*
ENV TZ=America/New_York
```

Then rebuild:
```bash
cd /home/nick/websites/glowworm/docker-publish
docker compose build glowworm-backend-dev
docker compose up -d
```

**Option 2: Implement Task 13** (Full timezone support)
- Store timezone per device
- Convert all times to device timezone
- Handle DST transitions
- Complexity: ~2-3 hours of work

**Option 3: Use UTC everywhere** (Simplest)
- Document that all times are UTC
- Train users to convert times
- Works fine for single-timezone deployments

### Current Workaround

**For testing right now:**
1. Note your local time
2. Add 5 hours (for EST)
3. Enter that UTC time in the schedule form
4. Schedule will activate at your local time

**Example:**
- Want activation at local 3:46 PM EST?
- Enter 8:46 PM (20:46) in the form
- Schedule activates at your local 3:46 PM

### Testing Your Schedules

You can verify your schedule will work by checking:
1. Current UTC time: `date -u`
2. Your schedule time in database (already in UTC)
3. They should match when you want activation

Or use the **Preview feature** - it works correctly and will show you if a schedule would be active at a given UTC time.

---

**Status**: Known limitation - documented in Task 13 (Timezone Handling) which was deferred  
**Impact**: Medium - works fine once users understand UTC time entry  
**Fix Priority**: Low for single-timezone deployments, High for multi-timezone

