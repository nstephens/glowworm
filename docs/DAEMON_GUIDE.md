# Glowworm Display Device Daemon Guide

## Overview

The Glowworm Display Device Daemon is an optional service that runs on Raspberry Pi display devices to enable host-level control operations. It provides capabilities that cannot be accomplished from a web browser alone.

## Features

### Remote Browser URL Updates
- Update the FullPageOS kiosk URL remotely from the admin UI
- Automatic browser reload after URL changes
- Timestamped configuration backups
- No need for SSH access to the device

### HDMI CEC Display Control
- Power displays on/off remotely via HDMI CEC
- Switch between HDMI inputs programmatically
- Scan and detect connected CEC devices
- Query display power status
- Automatic display management via scheduler integration

### Scheduler Integration
- Schedule display power on/off at specific times
- Automatic input switching based on schedules
- Coordinate display actions with playlist changes
- Support for recurring and one-time schedules

## Requirements

- **Hardware:** Raspberry Pi (tested on Pi 3, 4, and 5)
- **OS:** FullPageOS 0.13.0 or higher
- **Python:** 3.10 or higher
- **Packages:** cec-utils, libcec6, python3-cec
- **Permissions:** Root access for file modifications and systemd

## Installation

### Quick Install (Recommended)

```bash
curl -sSL https://raw.githubusercontent.com/yourusername/glowworm/main/daemon/scripts/install.sh | sudo bash
```

### Manual Installation

#### 1. Install System Dependencies

```bash
sudo apt-get update
sudo apt-get install -y python3-pip cec-utils libcec6 python3-cec
```

#### 2. Install Python Package

```bash
sudo pip3 install glowworm-daemon
```

#### 3. Run Setup Wizard

```bash
sudo glowworm-daemon-setup
```

The wizard will prompt you for:
- Backend URL (e.g., `http://10.10.10.2:8002`)
- Device Token (from Glowworm admin UI)
- Poll interval (default: 30 seconds)
- Log level (default: INFO)
- CEC configuration

#### 4. Start the Daemon

```bash
# Start immediately
sudo systemctl start glowworm-daemon

# Enable on boot
sudo systemctl enable glowworm-daemon

# Check status
sudo systemctl status glowworm-daemon
```

## Configuration

Configuration file: `/etc/glowworm/daemon.conf`

```ini
[daemon]
# Backend API URL (required)
backend_url = http://10.10.10.2:8002

# Device authentication token (required)
# Get this from the Glowworm admin UI
device_token = ABC123

# Polling interval in seconds
poll_interval = 30

# Log level: DEBUG, INFO, WARNING, ERROR, CRITICAL
log_level = INFO

# Log file location
log_file = /var/log/glowworm/daemon.log

# Connection retry settings
max_retries = 3
retry_delay = 5

[cec]
# Enable HDMI CEC control
enabled = true

# Display logical address (usually 0)
display_address = 0

# CEC adapter device path
adapter = /dev/cec0

# CEC command timeout in seconds
timeout = 5

[fullpageos]
# Path to FullPageOS configuration file
config_path = /boot/firmware/fullpageos.txt

# Create backup before modifying
backup_enabled = true
```

## Getting a Device Token

1. Open Glowworm admin UI
2. Navigate to **Displays** page
3. Your device should appear as "pending"
4. Click **Authorize** and set a device name
5. Copy the device token (4-character code)
6. Use this token in `/etc/glowworm/daemon.conf`

## Usage

### Viewing Logs

```bash
# Follow live logs
sudo journalctl -u glowworm-daemon -f

# View last 100 lines
sudo journalctl -u glowworm-daemon -n 100

# View logs for specific time range
sudo journalctl -u glowworm-daemon --since "1 hour ago"
```

### Managing the Service

```bash
# Start daemon
sudo systemctl start glowworm-daemon

# Stop daemon
sudo systemctl stop glowworm-daemon

# Restart daemon
sudo systemctl restart glowworm-daemon

# Check status
sudo systemctl status glowworm-daemon

# Disable on boot
sudo systemctl disable glowworm-daemon
```

### Testing CEC Functionality

```bash
# Check if CEC is available
which cec-client

# Test CEC communication
echo "scan" | cec-client -s -d 1

# Check your display
echo "pow 0" | cec-client -s -d 1
```

## Troubleshooting

### Daemon Won't Start

**Check logs:**
```bash
sudo journalctl -u glowworm-daemon -n 50
```

**Common issues:**
1. **Invalid device token:** Verify token in config matches admin UI
2. **Backend unreachable:** Check backend_url and network connectivity
3. **Permission denied:** Daemon must run as root

### CEC Not Working

**Verify CEC is available:**
```bash
ls -l /dev/cec*
```

If `/dev/cec0` doesn't exist:
```bash
sudo apt-get install cec-utils libcec6 python3-cec
sudo reboot
```

**Test CEC manually:**
```bash
echo "scan" | cec-client -s -d 1
```

**Common CEC issues:**
1. **No CEC adapter:** Raspberry Pi HDMI port may not support CEC
2. **Display doesn't support CEC:** Check display manual
3. **Incorrect display address:** Try different addresses (0-15)

### URL Updates Not Working

**Check file permissions:**
```bash
ls -l /boot/firmware/fullpageos.txt
```

**Verify config path:**
```bash
cat /etc/glowworm/daemon.conf | grep config_path
```

**Check backup creation:**
```bash
ls -l /boot/firmware/fullpageos.txt.bak*
```

### Connection Issues

**Test backend connectivity:**
```bash
curl http://10.10.10.2:8002/health
```

**Check device authorization:**
- Go to Glowworm admin UI
- Verify device status is "authorized"
- Check device_token matches config

## CEC Compatibility

### Tested Displays
- ✅ Samsung Smart TVs (2015+)
- ✅ LG Smart TVs (2016+)
- ✅ Sony Bravia TVs
- ✅ Generic HDMI monitors with CEC

### Known Limitations
- Some displays require CEC to be enabled in settings
- Older displays may have partial CEC support
- Input switching may not work on all devices
- Power status query is not supported by all displays

### Raspberry Pi Models
- ✅ Pi 3 Model B/B+
- ✅ Pi 4 Model B
- ✅ Pi 5
- ✅ Pi Zero 2 W
- ⚠️ Pi Zero/1 (may be slow)

## Uninstallation

```bash
# Stop and disable service
sudo systemctl stop glowworm-daemon
sudo systemctl disable glowworm-daemon

# Remove service file
sudo rm /etc/systemd/system/glowworm-daemon.service
sudo systemctl daemon-reload

# Uninstall package
sudo pip3 uninstall glowworm-daemon

# Remove configuration (optional)
sudo rm -rf /etc/glowworm
sudo rm -rf /var/log/glowworm
```

## Advanced Configuration

### Custom Poll Interval

For faster response times:
```ini
[daemon]
poll_interval = 10  # Poll every 10 seconds
```

Note: Lower intervals increase backend load.

### Debug Logging

For troubleshooting:
```ini
[daemon]
log_level = DEBUG
```

Then view logs:
```bash
sudo journalctl -u glowworm-daemon -f
```

### Custom CEC Adapter

If using non-standard CEC adapter:
```ini
[cec]
adapter = /dev/cec1  # Or other device
display_address = 1  # Try different addresses
```

## Security Considerations

1. **Device Token Security**
   - Tokens are stored in plain text in config
   - Config file has 600 permissions (root only)
   - Rotate tokens if device is compromised

2. **Root Privileges**
   - Daemon runs as root (required for file modifications)
   - Only install on trusted devices
   - Keep software updated

3. **Network Security**
   - Use HTTPS for backend URL when possible
   - Daemon communicates via REST API
   - Bearer token authentication

## API Integration

See `docs/API.md` for full API documentation.

### Daemon Endpoints

```
POST /api/device-daemon/register
GET /api/device-daemon/commands/poll
POST /api/device-daemon/commands/{id}/result
POST /api/device-daemon/heartbeat
```

### Device Control Endpoints

```
PUT /api/device-daemon/devices/{id}/browser-url
POST /api/device-daemon/devices/{id}/display/power
GET /api/device-daemon/devices/{id}/display/inputs
POST /api/device-daemon/devices/{id}/display/input
POST /api/device-daemon/devices/{id}/display/scan-inputs
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/yourusername/glowworm/issues
- Documentation: https://glowworm.example.com/docs
- Logs: `/var/log/glowworm/daemon.log` and `journalctl -u glowworm-daemon`

## Version History

### v1.0.0 (2024-11-09)
- Initial release
- Browser URL updates
- HDMI CEC control (power, input)
- Scheduler integration
- FullPageOS support

