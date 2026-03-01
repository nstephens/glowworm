# GlowWorm v3.0 Customer Acceptance Testing Guide

This document provides comprehensive instructions for deploying, configuring, and validating the GlowWorm v3.0 Pi3D-based architecture.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Backend Server Deployment](#backend-server-deployment)
3. [Raspberry Pi Display Setup](#raspberry-pi-display-setup)
4. [Migration from v2 to v3](#migration-from-v2-to-v3)
5. [Acceptance Test Procedures](#acceptance-test-procedures)
6. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

### Backend Server Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| RAM | 2GB | 4GB |
| CPU | 2 cores | 4 cores |
| Storage | 20GB | 50GB+ |
| Docker | 20.10+ | Latest |
| Docker Compose | 2.0+ | Latest |

### Raspberry Pi Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Model | Pi 3B+ | Pi 4 (4GB) or Pi 5 |
| MicroSD | 16GB Class 10 | 32GB+ A2 rated |
| OS | Raspberry Pi OS Lite (Bookworm) | Latest 64-bit |
| Network | WiFi or Ethernet | Ethernet preferred |

### Network Requirements

- [ ] Backend server accessible from Pi devices
- [ ] WebSocket connections allowed (port configurable, default 3003)
- [ ] Pi devices can reach backend HTTP and WebSocket endpoints
- [ ] DNS resolution working on Pi devices

---

## Backend Server Deployment

### Step 1: Prepare the Backend

Ensure the backend is running the latest code with v3 support:

```bash
# Navigate to project directory
cd /path/to/glowworm

# Pull latest changes (if using git)
git checkout v3.0-pi3d

# Rebuild and restart services
docker-compose down
docker-compose build
docker-compose up -d

# Verify services are running
docker-compose ps
```

### Step 2: Run Database Migrations

```bash
# Apply database migrations for v3 fields
docker-compose exec backend alembic upgrade head
```

### Step 3: Verify Backend Health

```bash
# Check API health
curl http://localhost:3003/api/health

# Expected response:
# {"status": "healthy", "version": "3.0.0"}
```

### Step 4: Verify WebSocket Endpoint

```bash
# Test WebSocket endpoint availability
curl -I http://localhost:3003/ws/device

# Should return 101 Switching Protocols or similar
```

### Step 5: Access Admin Interface

1. Open browser to `http://your-server:3003`
2. Log in with admin credentials
3. Navigate to **Displays** section
4. Verify the page loads without errors

### Backend Deployment Verification Checklist

- [ ] All Docker containers running (backend, mysql, redis)
- [ ] API health endpoint returns success
- [ ] Admin interface accessible
- [ ] WebSocket endpoint responding
- [ ] Database migrations applied
- [ ] Existing playlists and images visible

---

## Raspberry Pi Display Setup

### Option A: Fresh Installation

For a new Raspberry Pi without any previous GlowWorm installation.

#### Step 1: Prepare the Pi

```bash
# Flash Raspberry Pi OS Lite (64-bit Bookworm) to SD card
# Boot the Pi and connect via SSH

# Update system
sudo apt update && sudo apt upgrade -y

# Configure GPU memory (required for Pi3D)
sudo raspi-config
# Navigate to: Performance Options > GPU Memory > Set to 128
# Save and exit (don't reboot yet)
```

#### Step 2: Install GlowWorm v3

```bash
# Clone the repository (or download the install script)
git clone https://github.com/your-org/glowworm.git
cd glowworm

# Run the install script
sudo bash pi3d/scripts/install.sh
```

The install script will:
- Install system dependencies (Pi3D, OpenGL ES, etc.)
- Create Python virtual environment
- Install daemon and display packages
- Configure systemd service
- Run the configuration wizard

#### Step 3: Configure the Display

During installation, or afterwards using:

```bash
sudo bash /opt/glowworm/scripts/configure.sh
```

Configure at minimum:
- **Backend URL**: `http://your-server:3003`
- **Display orientation**: `portrait` or `landscape`
- **Display rotation**: `0`, `90`, `180`, or `270`

#### Step 4: Start the Daemon

```bash
# Start the service
sudo systemctl start glowworm-daemon

# Enable autostart on boot
sudo systemctl enable glowworm-daemon

# Check status
sudo systemctl status glowworm-daemon
```

#### Step 5: Register the Device

1. The Pi display will show a 4-character registration code
2. Open the admin interface on your browser
3. Go to **Displays** section
4. Find the pending device with the displayed code
5. Click **Authorize** and assign a playlist
6. The slideshow will begin automatically

### Option B: Migration from v2

For existing v2 installations (FullPageOS / browser-based).

#### Step 1: Run Migration Script

```bash
# SSH into the Raspberry Pi
ssh pi@your-pi-address

# Download or access the migration script
cd /path/to/glowworm

# Run with dry-run first to preview changes
sudo bash pi3d/scripts/migrate-v2-to-v3.sh --dry-run

# If everything looks correct, run the actual migration
sudo bash pi3d/scripts/migrate-v2-to-v3.sh
```

#### Step 2: Install v3 Components

After migration, install the v3 packages:

```bash
sudo bash pi3d/scripts/install.sh
```

#### Step 3: Verify Migration

```bash
# Check that device token was preserved
grep "device_token" /etc/glowworm/config.yaml

# If token exists, the device should reconnect automatically
# If token is empty, follow registration steps above
```

---

## Migration from v2 to v3

### What Gets Preserved

| Data | Preserved | Notes |
|------|-----------|-------|
| Device Token | ✅ Yes | No re-registration needed if token exists |
| Backend URL | ✅ Yes | Migrated to new YAML config |
| CEC Settings | ✅ Yes | Migrated to new config |
| Log Level | ✅ Yes | Migrated to new config |
| Cached Images | ✅ Yes | Moved to new cache directory |
| Playlists | ✅ Yes | Stored on backend, no action needed |
| Images/Albums | ✅ Yes | Stored on backend, no action needed |

### What Gets Removed

| Component | Action |
|-----------|--------|
| FullPageOS config | Backed up and disabled |
| Chromium browser | Stopped, autostart disabled |
| LightDM | Disabled if present |
| Browser display routes | Removed from frontend |

### Rollback Procedure

If you need to revert to v2:

```bash
# Stop v3 service
sudo systemctl stop glowworm-daemon
sudo systemctl disable glowworm-daemon

# Restore v2 config (backup location shown during migration)
sudo cp /var/backup/glowworm-v2/daemon.conf.bak /etc/glowworm/daemon.conf

# Restore FullPageOS if used
sudo mv /boot/firmware/fullpageos.txt.v2backup /boot/firmware/fullpageos.txt

# Re-enable browser services
sudo systemctl enable lightdm
sudo reboot
```

---

## Acceptance Test Procedures

### Test 1: Device Registration Flow

**Objective**: Verify new devices can register and start displaying

**Steps**:
1. Flash a new Pi with Raspberry Pi OS Lite
2. Install GlowWorm v3 using install script
3. Configure backend URL only (leave device_token empty)
4. Start the daemon: `sudo systemctl start glowworm-daemon`
5. Observe the display shows a 4-character code
6. Log into admin interface
7. Find and authorize the pending device
8. Assign a playlist with at least 3 images

**Expected Results**:
- [ ] Registration code displays clearly on screen
- [ ] Device appears in admin pending list within 10 seconds
- [ ] Authorization completes successfully
- [ ] Slideshow begins within 5 seconds of authorization

**Pass Criteria**: All checkboxes checked

---

### Test 2: Slideshow Operation

**Objective**: Verify images display and transition correctly

**Prerequisites**: Authorized device with assigned playlist

**Steps**:
1. Observe slideshow for at least 3 image transitions
2. Check transition smoothness (should be 30+ FPS)
3. Verify images fill/fit screen correctly based on settings
4. Check for any visual artifacts or stuttering

**Expected Results**:
- [ ] Images transition smoothly (no stuttering)
- [ ] Transitions complete in configured duration
- [ ] Images scale/fit correctly
- [ ] No black flashes between images
- [ ] Background color visible during letterboxing

**Pass Criteria**: All checkboxes checked

---

### Test 3: Remote Control Commands

**Objective**: Verify admin can control devices remotely

**Prerequisites**: Authorized device displaying slideshow

**Steps**:
1. Open admin interface, go to Displays
2. Click **Next** button - verify image advances
3. Click **Previous** button - verify image goes back
4. Click **Pause** button - verify slideshow stops
5. Click **Resume** button - verify slideshow continues
6. Click **Reload Playlist** - verify playlist refreshes

**Expected Results**:
- [ ] Next command advances within 2 seconds
- [ ] Previous command goes back within 2 seconds
- [ ] Pause stops slideshow, state indicator shows "Paused"
- [ ] Resume continues from where paused
- [ ] Reload triggers playlist fetch (visible in logs)

**Pass Criteria**: All checkboxes checked

---

### Test 4: Real-Time Status Updates

**Objective**: Verify device status appears in admin UI

**Prerequisites**: Authorized device running slideshow

**Steps**:
1. Open admin interface, go to Displays
2. Observe device card for:
   - Connection status (green dot = online)
   - Current image thumbnail
   - Slideshow state indicator
   - Cache statistics

**Expected Results**:
- [ ] Connection indicator shows green/online
- [ ] Current image thumbnail updates when image changes
- [ ] State indicator shows correct state (Playing/Paused)
- [ ] Cache stats show entry count and size
- [ ] Uptime displays correctly

**Pass Criteria**: All checkboxes checked

---

### Test 5: Offline Operation

**Objective**: Verify device continues operating when backend unavailable

**Prerequisites**: Device with cached images (displayed for a while)

**Steps**:
1. Note current slideshow position
2. Stop backend server: `docker-compose stop`
3. Wait 2 minutes, observe slideshow continues
4. Restart backend: `docker-compose start`
5. Verify device reconnects automatically

**Expected Results**:
- [ ] Slideshow continues from cached images
- [ ] No error displayed on screen
- [ ] Device reconnects within 60 seconds of backend restart
- [ ] Status resumes updating in admin UI

**Pass Criteria**: All checkboxes checked

---

### Test 6: Crash Recovery

**Objective**: Verify system recovers from crashes

**Prerequisites**: Running slideshow

**Steps**:
1. Kill display process: `sudo pkill -9 -f glowworm_display`
2. Wait 15 seconds
3. Observe slideshow resumes automatically
4. Check logs for restart: `sudo journalctl -u glowworm-daemon --since "2 minutes ago"`

**Expected Results**:
- [ ] Display process restarts within 10 seconds
- [ ] Slideshow continues from last position
- [ ] Error screen not shown (or shown briefly)
- [ ] Logs show crash detection and restart

**Pass Criteria**: All checkboxes checked

---

### Test 7: Power Cycle Recovery

**Objective**: Verify system recovers from power loss

**Prerequisites**: Configured and running device

**Steps**:
1. Note current slideshow position
2. Power off the Pi (unplug power)
3. Wait 10 seconds
4. Power on the Pi
5. Wait for boot and service start (1-2 minutes)

**Expected Results**:
- [ ] Service starts automatically on boot
- [ ] Slideshow resumes operation
- [ ] Cached images available immediately
- [ ] WebSocket reconnects to backend

**Pass Criteria**: All checkboxes checked

---

### Test 8: Performance Metrics

**Objective**: Verify system meets performance targets

**Prerequisites**: Running slideshow on Pi 4 or Pi 5

**Steps**:
1. SSH into the Pi
2. Monitor resources during transitions:
   ```bash
   # Watch CPU and memory
   htop

   # In another terminal, check memory
   ps aux | grep glowworm
   ```
3. Check FPS in logs:
   ```bash
   sudo journalctl -u glowworm-daemon | grep -i fps
   ```

**Expected Results**:
- [ ] FPS during transitions: ≥30 FPS
- [ ] RAM usage (total daemon + display): <200MB
- [ ] CPU usage during transition: <30%
- [ ] CPU usage during static display: <5%

**Pass Criteria**: All metrics within targets

---

### Test 9: Cache Management

**Objective**: Verify cache operates correctly

**Prerequisites**: Running slideshow

**Steps**:
1. Check cache size: `du -sh /var/cache/glowworm/images/`
2. In admin UI, click **Clear Cache** button
3. Observe slideshow - should re-download images
4. Check cache rebuilds

**Expected Results**:
- [ ] Clear cache command succeeds
- [ ] Images re-download (may see brief placeholder)
- [ ] Cache rebuilds over time
- [ ] Cache statistics reset in admin UI

**Pass Criteria**: All checkboxes checked

---

### Test 10: Playlist Updates

**Objective**: Verify playlist changes propagate to devices

**Prerequisites**: Running slideshow

**Steps**:
1. Open admin interface
2. Add a new image to the active playlist
3. Wait for playlist refresh (default 5 minutes) or click **Reload Playlist**
4. Observe new image appears in slideshow

**Expected Results**:
- [ ] New image appears in slideshow
- [ ] Position not disrupted (continues from current)
- [ ] Image downloads and caches correctly
- [ ] No restart required

**Pass Criteria**: All checkboxes checked

---

### Test 11: Multi-Device Simultaneous Operation

**Objective**: Verify multiple devices work independently

**Prerequisites**: 2+ registered devices

**Steps**:
1. Assign different playlists to each device
2. Observe each device shows correct playlist
3. Send commands to device A, verify device B unaffected
4. Check backend logs for proper routing

**Expected Results**:
- [ ] Each device shows its assigned playlist
- [ ] Commands route to correct device only
- [ ] Status updates appear for all devices
- [ ] No cross-contamination of commands

**Pass Criteria**: All checkboxes checked

---

### Test 12: 24-Hour Stability

**Objective**: Verify long-term stable operation

**Prerequisites**: Configured device, time (24 hours)

**Steps**:
1. Start stability test:
   ```bash
   sudo bash /opt/glowworm/scripts/test_stability.sh --duration 24
   ```
2. Leave running for 24 hours
3. Review results

**Expected Results**:
- [ ] No crashes in 24 hours
- [ ] Memory growth <50MB over period
- [ ] Slideshow continuously operating
- [ ] All performance metrics stable

**Pass Criteria**: All checkboxes checked

---

## Troubleshooting

### Device Won't Register

**Symptoms**: No registration code displayed, or code not appearing in admin

**Solutions**:
```bash
# Check service status
sudo systemctl status glowworm-daemon

# Check logs for errors
sudo journalctl -u glowworm-daemon -n 50

# Verify backend URL in config
grep "url:" /etc/glowworm/config.yaml

# Test backend connectivity
curl http://your-backend:3003/api/health
```

### Slideshow Not Starting

**Symptoms**: Device authorized but screen stays blank

**Solutions**:
```bash
# Check display process
ps aux | grep glowworm_display

# Check IPC socket
ls -la /run/glowworm/

# Restart the service
sudo systemctl restart glowworm-daemon
```

### Choppy Transitions

**Symptoms**: Transitions stutter or drop frames

**Solutions**:
```bash
# Check GPU memory
vcgencmd get_mem gpu
# Should be 128MB+

# Check CPU throttling
vcgencmd measure_temp
vcgencmd get_throttled

# Reduce FPS target in config if needed
sudo nano /etc/glowworm/config.yaml
# Set fps_target: 24
```

### WebSocket Connection Issues

**Symptoms**: Status not updating, commands not working

**Solutions**:
```bash
# Check WebSocket logs
sudo journalctl -u glowworm-daemon | grep -i websocket

# Verify backend WebSocket endpoint
curl http://your-backend:3003/ws/device

# Check firewall
sudo iptables -L
```

### Cache Issues

**Symptoms**: Images not loading, constant re-downloads

**Solutions**:
```bash
# Check cache directory permissions
ls -la /var/cache/glowworm/images/

# Check disk space
df -h /var/cache/glowworm/

# Check cache database
ls -la /var/cache/glowworm/images/cache.db

# Clear and rebuild cache
sudo rm -rf /var/cache/glowworm/images/*
sudo systemctl restart glowworm-daemon
```

---

## Sign-Off

### Tester Information

| Field | Value |
|-------|-------|
| Tester Name | |
| Date | |
| Environment | |
| Backend Version | |
| Display Version | |

### Test Results Summary

| Test | Pass | Fail | N/A | Notes |
|------|------|------|-----|-------|
| 1. Device Registration | | | | |
| 2. Slideshow Operation | | | | |
| 3. Remote Control | | | | |
| 4. Real-Time Status | | | | |
| 5. Offline Operation | | | | |
| 6. Crash Recovery | | | | |
| 7. Power Cycle Recovery | | | | |
| 8. Performance Metrics | | | | |
| 9. Cache Management | | | | |
| 10. Playlist Updates | | | | |
| 11. Multi-Device | | | | |
| 12. 24-Hour Stability | | | | |

### Final Acceptance

- [ ] All critical tests passed
- [ ] Performance meets requirements
- [ ] Documentation reviewed
- [ ] Ready for production deployment

**Signature**: _________________________ **Date**: _____________
