# Testing Display Device Daemon Feature

## Overview

This guide covers testing the Display Device Daemon feature from the `feature/device-daemon` branch before merging to `unstable`.

## Prerequisites

- Development environment at `/home/nick/websites/glowworm/docker-publish`
- Raspberry Pi with FullPageOS (for daemon testing)
- Same network access for Raspberry Pi and dev server

---

## Part 1: Deploy Backend + Frontend (Dev Environment)

### Step 1: Ensure You're on the Feature Branch

```bash
cd /home/nick/websites/glowworm
git status
# Should show: On branch feature/device-daemon

# If not, switch to it:
git checkout feature/device-daemon
git pull origin feature/device-daemon
```

### Step 2: Rebuild Docker Images with Feature Branch Code

```bash
cd /home/nick/websites/glowworm/docker-publish

# Stop current containers
docker compose down

# Rebuild images with new code (includes migrations and new API endpoints)
docker compose build glowworm-backend-dev glowworm-frontend-dev

# Start all services
docker compose up -d

# Watch logs to ensure clean startup
docker compose logs -f glowworm-backend-dev | head -50
```

### Step 3: Verify Backend Migrations

The new feature includes 2 database migrations:
- `2024110900_add_device_daemon_tables` (daemon status, commands)
- `2024110901_add_scheduled_actions_table` (scheduler actions)

```bash
# Check migration status
cd /home/nick/websites/glowworm/docker-publish
docker compose exec glowworm-backend-dev alembic current

# Migrations should run automatically on startup, but if needed:
docker compose exec glowworm-backend-dev alembic upgrade head

# Verify new tables exist
docker compose exec glowworm-mysql-dev mysql -u root -proot glowworm -e "SHOW TABLES LIKE 'device_%';"
# Should show: device_commands, device_daemon_status

docker compose exec glowworm-mysql-dev mysql -u root -proot glowworm -e "SHOW TABLES LIKE 'scheduled_actions';"
```

### Step 4: Verify API Endpoints

```bash
# Test health endpoint (via frontend proxy)
curl http://10.10.10.2:3003/health

# Test daemon health endpoint
curl http://10.10.10.2:3003/api/device-daemon/health

# Both should return JSON with status: healthy
```

### Step 5: Access Admin UI

1. Open browser: `http://10.10.10.2:3003`
2. Login with admin credentials
3. Navigate to **Displays** page
4. You should see your existing devices

---

## Part 2: Install and Test Daemon on Raspberry Pi

### Step 1: Prepare Raspberry Pi

**Requirements:**
- Raspberry Pi with FullPageOS
- Connected to same network as dev server
- SSH access enabled

```bash
# SSH into your Raspberry Pi
ssh pi@<raspberry-pi-ip>

# Update system
sudo apt-get update
```

### Step 2: Install Daemon (Manual Method for Testing)

Since the package isn't published to PyPI yet, we'll install from the Git repository:

```bash
# Install dependencies
sudo apt-get install -y python3-pip cec-utils libcec6 python3-cec git

# Clone the repository (feature branch)
cd /tmp
git clone -b feature/device-daemon https://github.com/nstephens/glowworm.git

# Install daemon package in development mode
cd glowworm/daemon
sudo pip3 install -e .

# Verify installation
which glowworm-daemon
glowworm-daemon --help 2>/dev/null || echo "Daemon installed"
```

### Step 3: Get Device Token

1. On your computer, go to Glowworm admin UI: `http://10.10.10.2:3003/admin/displays`
2. Your Raspberry Pi should show as a new device (if browser is running)
3. **Authorize** the device
4. Note the **device token** (4-character code, e.g., "AB12")

### Step 4: Configure Daemon

On the Raspberry Pi:

```bash
# Create config directory
sudo mkdir -p /etc/glowworm

# Create configuration file
sudo nano /etc/glowworm/daemon.conf
```

Add this configuration (adjust values):

```ini
[daemon]
# Use the frontend URL you use to access admin UI
backend_url = http://10.10.10.2:3003
device_token = AB12
poll_interval = 30
log_level = DEBUG
log_file = /var/log/glowworm/daemon.log
max_retries = 3
retry_delay = 5

[cec]
enabled = true
display_address = 0
adapter = /dev/cec0
timeout = 5

[fullpageos]
config_path = /boot/firmware/fullpageos.txt
backup_enabled = true
```

Save and exit (Ctrl+X, Y, Enter).

```bash
# Create log directory
sudo mkdir -p /var/log/glowworm

# Set permissions
sudo chmod 600 /etc/glowworm/daemon.conf
```

### Step 5: Test Daemon in Foreground (Manual Test)

**Run daemon manually first to see debug output:**

```bash
# Run in foreground with debug logging
sudo python3 -m glowworm_daemon.main
```

**Expected output:**
```
============================================================
Glowworm Display Device Daemon v1.0.0
============================================================
Backend URL: http://10.10.10.2:3003
Device Token: AB12****
Poll Interval: 30s
CEC Enabled: True
Log Level: DEBUG
Daemon started successfully
Testing backend connectivity...
✓ Backend connectivity OK
Registering with backend (attempt 1/5)...
✓ Successfully registered with backend
  Recommended poll interval: 30s
  Capabilities: ['url_update', 'cec_control']
No pending commands
```

**If you see errors:**
- **"Cannot reach backend"**: Check backend_url in config
- **"Authentication failed"**: Check device_token matches admin UI
- **"Device not authorized"**: Authorize device in admin UI first

Press `Ctrl+C` to stop.

### Step 6: Install as Systemd Service

**Create systemd service file:**

```bash
sudo nano /etc/systemd/system/glowworm-daemon.service
```

Add:

```ini
[Unit]
Description=Glowworm Display Device Daemon
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
Group=root
ExecStart=/opt/glowworm-daemon/venv/bin/python -m glowworm_daemon.main
Restart=always
RestartSec=10
Environment="PYTHONUNBUFFERED=1"
Environment="PATH=/opt/glowworm-daemon/venv/bin:/usr/local/bin:/usr/bin:/bin"
StandardOutput=journal
StandardError=journal
SyslogIdentifier=glowworm-daemon
WorkingDirectory=/var/lib/glowworm

[Install]
WantedBy=multi-user.target
```

**Start the service:**

```bash
# Create working directory
sudo mkdir -p /var/lib/glowworm

# Reload systemd
sudo systemctl daemon-reload

# Start daemon
sudo systemctl start glowworm-daemon

# Check status
sudo systemctl status glowworm-daemon

# Should show: active (running)

# Enable on boot
sudo systemctl enable glowworm-daemon
```

### Step 7: Monitor Daemon Logs

```bash
# Follow live logs
sudo journalctl -u glowworm-daemon -f

# Or check log file
sudo tail -f /var/log/glowworm/daemon.log
```

**Look for:**
- ✓ Registration success
- ✓ Regular polling every 30s
- ✓ CEC availability detection
- ✓ No errors

---

## Part 3: Test Features End-to-End

### Test 1: Browser URL Update

**In Admin UI:**
1. Go to **Displays** page
2. Find your Raspberry Pi device
3. Look for "Daemon Control" section (or expand device card)
4. In "Browser URL Configuration" field, enter:
   ```
   http://10.10.10.2:3003/display/YOUR-DEVICE-TOKEN
   ```
5. Click **Update Browser URL**
6. Should see: "Browser URL update queued"

**On Raspberry Pi:**
```bash
# Watch daemon logs
sudo journalctl -u glowworm-daemon -f

# You should see:
# Executing command #X: update_url
# Updating browser URL to: http://...
# Created backup: /boot/firmware/fullpageos.txt.bak...
# Config file updated successfully
# ✓ Browser reloaded via systemctl restart
# Command #X completed successfully
```

**Verify:**
```bash
# Check config was updated
sudo cat /boot/firmware/fullpageos.txt | grep kiosk_url

# Check backup was created
ls -l /boot/firmware/fullpageos.txt.bak*

# Browser should reload with new URL within 30 seconds
```

### Test 2: CEC Power Control (If Display Supports CEC)

**Check CEC is available:**
```bash
# On Raspberry Pi
sudo cec-client -l

# Should show CEC adapter

# Test manually first
echo "scan" | cec-client -s -d 1
# Should list connected CEC devices
```

**In Admin UI:**
1. Go to daemon control section for the device
2. Click **Power Off** button
3. Should see: "Power off command queued"

**On Raspberry Pi:**
```bash
# Watch logs
sudo journalctl -u glowworm-daemon -f

# Should see:
# Executing command #Y: cec_power_off
# Sending CEC standby to display 0
# ✓ CEC standby command sent successfully
```

**Display should turn off!**

4. Click **Power On** to test power on
5. Display should turn back on

### Test 3: HDMI Input Scanning and Switching

**In Admin UI:**
1. Daemon control section
2. Click **Scan Inputs** button
3. Wait ~15 seconds for scan to complete
4. Refresh page
5. Input dropdown should populate with detected devices

**Select an input:**
1. Choose an input from dropdown
2. Click **Switch Input**
3. Monitor should switch to that input

**On Raspberry Pi:**
```bash
# Logs should show:
# Executing command #Z: cec_scan_inputs
# Scanning for CEC devices...
# Found 3 CEC device(s)
# ✓ CEC scan successful
```

### Test 4: Scheduled Display Actions

**Create a power schedule:**
1. Go to **Scheduler** page (if you have it)
2. Or manually in database:

```bash
# On dev server
cd /home/nick/websites/glowworm/docker-publish

docker compose exec glowworm-mysql-dev mysql -u root -proot glowworm

# Insert a test schedule (power off in 2 minutes)
INSERT INTO scheduled_actions (
  device_id, action_type, schedule_type, 
  days_of_week, start_time, end_time,
  name, priority, enabled
) VALUES (
  YOUR_DEVICE_ID,
  'power_off',
  'recurring',
  '["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]',
  ADDTIME(CURRENT_TIME(), '00:02:00'),  -- 2 minutes from now
  '23:59:00',
  'Test Power Off',
  10,
  1
);
```

**Watch for automatic execution:**
```bash
# On dev server - watch scheduler
docker compose logs -f glowworm-celery-worker-dev | grep -i action

# On Raspberry Pi - watch daemon
sudo journalctl -u glowworm-daemon -f
```

**After 2 minutes**, display should turn off automatically!

---

## Part 4: Test Database Schema

### Verify Tables Were Created

```bash
cd /home/nick/websites/glowworm/docker-publish

# Connect to MySQL
docker compose exec glowworm-mysql-dev mysql -u root -proot glowworm

# Check device_daemon_status table
DESCRIBE device_daemon_status;

# Check device_commands table  
DESCRIBE device_commands;

# Check scheduled_actions table
DESCRIBE scheduled_actions;

# Check display_devices has new columns
DESCRIBE display_devices;
# Should show: browser_url, cec_input_name, cec_input_address, daemon_enabled

# View daemon registration
SELECT * FROM device_daemon_status;

# View command history
SELECT id, device_id, command_type, status, created_at 
FROM device_commands 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## Part 5: Rollback if Needed

### If You Need to Revert

**Stop and remove feature code:**

```bash
cd /home/nick/websites/glowworm
git checkout unstable  # Or main

cd /home/nick/websites/glowworm/docker-publish
docker compose down
docker compose build
docker compose up -d
```

**Rollback database migrations:**

```bash
# Check current migration
docker compose exec glowworm-backend-dev alembic current

# Downgrade 2 migrations
docker compose exec glowworm-backend-dev alembic downgrade -2

# Or downgrade to specific revision before daemon feature
docker compose exec glowworm-backend-dev alembic downgrade 1c0cd51f0957
```

**Remove daemon from Raspberry Pi:**

```bash
# SSH to Raspberry Pi
ssh pi@<raspberry-pi-ip>

# Stop and disable service
sudo systemctl stop glowworm-daemon
sudo systemctl disable glowworm-daemon

# Remove files
sudo rm /etc/systemd/system/glowworm-daemon.service
sudo systemctl daemon-reload

# Remove virtual environment and installation
sudo rm -rf /opt/glowworm-daemon

# Remove symlinks
sudo rm -f /usr/local/bin/glowworm-daemon
sudo rm -f /usr/local/bin/glowworm-daemon-setup

# Remove configuration
sudo rm -rf /etc/glowworm
sudo rm -rf /var/log/glowworm
```

---

## Testing Checklist

### Backend Integration
- [ ] Migrations run successfully
- [ ] New tables created (device_daemon_status, device_commands, scheduled_actions)
- [ ] New columns added to display_devices
- [ ] API endpoints respond correctly (`/api/device-daemon/*`)
- [ ] Authentication works (Bearer token)
- [ ] Rate limiting works (try 11 rapid polls)

### Daemon Installation
- [ ] Python package installs without errors
- [ ] Configuration file created
- [ ] Systemd service starts successfully
- [ ] Logs show registration success
- [ ] Daemon polls every 30 seconds
- [ ] CEC detection works (if applicable)

### URL Update Feature
- [ ] URL update command queued in admin UI
- [ ] Daemon receives command
- [ ] FullPageOS config updated
- [ ] Backup created
- [ ] Browser reloads with new URL
- [ ] Command marked as completed

### CEC Control (If Hardware Supports)
- [ ] CEC availability detected
- [ ] Power off command works
- [ ] Power on command works
- [ ] Input scanning discovers devices
- [ ] Input switching works
- [ ] Commands reported as completed

### Scheduler Integration
- [ ] Scheduled actions can be created
- [ ] Celery Beat evaluates actions
- [ ] Commands created for active schedules
- [ ] Power actions execute correctly
- [ ] Timezone handling works

### Admin UI
- [ ] DeviceDaemonControl component renders
- [ ] URL form works
- [ ] Power buttons work
- [ ] Input selector works
- [ ] Error/success messages display
- [ ] Loading states work

---

## Common Issues During Testing

### Issue: Daemon can't reach backend

**Check:**
```bash
# On Raspberry Pi
curl http://10.10.10.2:3003/health
curl http://10.10.10.2:3003/api/device-daemon/health
```

**Fix:** Verify `backend_url` in `/etc/glowworm/daemon.conf` uses port **3003** (frontend), not 8001/8002.

### Issue: Migration fails

**Check migration status:**
```bash
docker compose exec glowworm-backend-dev alembic current
docker compose exec glowworm-backend-dev alembic history
```

**Manual migration:**
```bash
docker compose exec glowworm-backend-dev alembic upgrade head
```

### Issue: CEC not working

**Test CEC manually:**
```bash
# On Raspberry Pi
sudo cec-client -l  # List adapters
echo "scan" | cec-client -s -d 1  # Scan devices
echo "pow 0" | cec-client -s -d 1  # Check power status
```

**Common fixes:**
- Enable CEC in TV settings
- Try different display_address (0-15)
- Reboot Raspberry Pi
- Check HDMI cable supports CEC

### Issue: Daemon not polling

**Check logs:**
```bash
sudo journalctl -u glowworm-daemon -n 100 --no-pager
```

**Common causes:**
- Wrong device_token
- Device not authorized
- Network connectivity
- Backend URL incorrect (should be 3003, not 8001/8002)

---

## Performance Testing

### Load Testing Daemon

**Create multiple test commands:**

```bash
# On dev server
cd /home/nick/websites/glowworm/docker-publish

# Python shell in backend container
docker compose exec glowworm-backend-dev python3
```

```python
from models import database
from models.device_command import DeviceCommand, CommandType, CommandStatus

db = database.SessionLocal()

# Create 10 test commands
for i in range(10):
    cmd = DeviceCommand(
        device_id=YOUR_DEVICE_ID,  # Replace with your device ID
        command_type=CommandType.UPDATE_URL,
        command_data={"url": f"http://test{i}.com"},
        status=CommandStatus.PENDING
    )
    db.add(cmd)

db.commit()
print("Created 10 test commands")
db.close()
```

**Monitor daemon processing:**
```bash
# On Raspberry Pi
sudo journalctl -u glowworm-daemon -f

# Should process all 10 commands in batches (max 10 per poll)
```

---

## Production Deployment Checklist (When Ready)

Before merging to `unstable`:

- [ ] All tests pass
- [ ] No errors in daemon logs
- [ ] CEC control tested on real hardware
- [ ] URL updates tested and verified
- [ ] Scheduler integration tested
- [ ] Admin UI tested thoroughly
- [ ] Database migrations verified
- [ ] Performance acceptable
- [ ] Documentation accurate
- [ ] Security reviewed (token storage, permissions)

---

## Next Steps After Testing

### If Tests Pass

```bash
cd /home/nick/websites/glowworm

# Merge to unstable
git checkout unstable
git pull origin unstable
git merge feature/device-daemon
git push origin unstable

# Deploy to production when ready
# (See deployment instructions)
```

### If Issues Found

1. Fix issues on `feature/device-daemon` branch
2. Commit fixes
3. Push to feature branch
4. Rebuild Docker images
5. Re-test

---

## Quick Reference: Useful Commands

### Dev Server (Docker)

```bash
cd /home/nick/websites/glowworm/docker-publish

# Rebuild and restart backend
docker compose build glowworm-backend-dev
docker compose restart glowworm-backend-dev

# Watch backend logs
docker compose logs -f glowworm-backend-dev

# Watch Celery (for scheduler)
docker compose logs -f glowworm-celery-worker-dev

# Database access
docker compose exec glowworm-mysql-dev mysql -u root -proot glowworm

# Check migrations
docker compose exec glowworm-backend-dev alembic current
```

### Raspberry Pi (Daemon)

```bash
# Start/stop/restart daemon
sudo systemctl start glowworm-daemon
sudo systemctl stop glowworm-daemon
sudo systemctl restart glowworm-daemon

# View logs
sudo journalctl -u glowworm-daemon -f
sudo journalctl -u glowworm-daemon -n 100
sudo tail -f /var/log/glowworm/daemon.log

# Test CEC manually
echo "scan" | cec-client -s -d 1
echo "on 0" | cec-client -s -d 1
echo "standby 0" | cec-client -s -d 1

# Check config
sudo cat /etc/glowworm/daemon.conf

# Run daemon in foreground (for debugging)
sudo systemctl stop glowworm-daemon
sudo /opt/glowworm-daemon/venv/bin/python -m glowworm_daemon.main
```

---

## Support During Testing

If you encounter issues:
1. Check logs on both dev server and Raspberry Pi
2. Verify network connectivity
3. Confirm database migrations applied
4. Review configuration files
5. Test individual components (CEC, URL update) separately

Good luck with testing! 🚀

