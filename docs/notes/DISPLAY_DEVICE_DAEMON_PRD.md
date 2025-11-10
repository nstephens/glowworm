# Product Requirements Document: Display Device Daemon

## Executive Summary

Create an optional daemon service that runs on display devices (Raspberry Pi with FullPageOS) to enable host-level control operations that cannot be performed from a browser. This daemon will communicate with the main Glowworm backend to enable remote management of device configuration and connected displays.

## Problem Statement

Currently, the Glowworm display client runs entirely in a browser, which limits control to web-based operations. Critical device and display management tasks require host-level access:

1. **Browser Configuration**: Cannot update the launch URL without physical access to edit `/boot/firmware/fullpageos.txt`
2. **Display Control**: Cannot control the connected TV/monitor (power, input switching) via HDMI CEC
3. **Scheduled Power Management**: Cannot turn displays off/on at scheduled times to save energy
4. **Input Management**: Cannot ensure display is on correct input for playback

These limitations require physical access to devices for routine maintenance and prevent automated power management.

## Goals

### Primary Goals
1. Enable remote browser URL updates for FullPageOS devices
2. Implement HDMI CEC control for connected displays (power, input switching)
3. Integrate display power management with the existing playlist scheduler
4. Provide input scanning and selection in the web UI

### Secondary Goals
1. Make the daemon optional (devices work without it, just with limited features)
2. Ensure secure communication between daemon and backend
3. Provide status monitoring for daemon health
4. Enable future host-level features (system updates, reboots, etc.)

### Non-Goals (Future Enhancements)
1. Support for non-FullPageOS systems (initially)
2. Video output resolution management
3. Audio control
4. Multi-display support per device

## Success Metrics

1. **Functionality**: Admin can update device URLs remotely (100% success rate)
2. **CEC Control**: Display power on/off works reliably (>95% success rate)
3. **Input Switching**: Correct input selected automatically (>90% success rate)
4. **Scheduler Integration**: Displays turn on/off at scheduled times (100% accuracy)
5. **Daemon Health**: Daemon reconnects automatically if disconnected (<5 minute recovery)
6. **Security**: All daemon commands require authentication (0 unauthorized commands)

## User Stories

### Story 1: Remote URL Update
**As an** administrator  
**I want to** update the display device's browser URL remotely  
**So that** I can fix configuration issues or change the URL without physical access

**Acceptance Criteria:**
- Can change URL from admin UI
- Device automatically reloads browser with new URL
- Changes persist across reboots
- Validation prevents invalid URLs

### Story 2: Display Power Management
**As an** administrator  
**I want to** turn displays on/off remotely  
**So that** I can save energy and manage display lifecycles

**Acceptance Criteria:**
- Can turn display on via CEC command
- Can turn display off via CEC command
- Status shows current power state
- Commands work reliably (>95% success)

### Story 3: Input Source Selection
**As an** administrator  
**I want to** see available HDMI inputs and select the correct one  
**So that** the display shows the Raspberry Pi output correctly

**Acceptance Criteria:**
- Daemon scans and reports available inputs
- UI shows list of inputs with friendly names
- Admin can select desired input
- Display switches to selected input
- Selection persists (daemon ensures correct input on startup)

### Story 4: Scheduled Display Power
**As an** administrator  
**I want to** schedule displays to turn off at night and on in the morning  
**So that** I save energy and extend display lifespan automatically

**Acceptance Criteria:**
- Can create "power off" schedules
- Can create "power on" schedules
- Scheduler triggers daemon commands at scheduled times
- Displays turn on/off reliably
- Input is correct when display turns back on

## Technical Architecture

### Components

#### 1. Device Daemon (Python Service)
**Location**: Runs on Raspberry Pi as systemd service  
**Responsibilities:**
- Communicate with Glowworm backend via WebSocket or polling
- Execute host-level commands (file edits, CEC commands)
- Report device and display status
- Handle command queue from backend

**Technology Stack:**
- Python 3.10+
- `python-cec` or `cec-client` for HDMI CEC
- `systemd` for service management
- `requests` or `websockets` for backend communication

#### 2. Backend API Extensions
**Location**: Glowworm backend (`backend/api/device_daemon.py`)  
**Responsibilities:**
- Provide endpoints for daemon registration and commands
- Queue commands for daemon execution
- Track daemon health and status
- Integrate with scheduler for automated actions

**New Endpoints:**
```
POST   /api/device-daemon/register          - Daemon registers with backend
GET    /api/device-daemon/commands/{device} - Poll for pending commands
POST   /api/device-daemon/status             - Report status/results
PUT    /api/devices/{id}/browser-url         - Update device browser URL
POST   /api/devices/{id}/display/power       - Power on/off display
GET    /api/devices/{id}/display/inputs      - Get available inputs
POST   /api/devices/{id}/display/input       - Switch input
```

#### 3. Database Schema Extensions

**New Table: `device_daemon_status`**
```sql
CREATE TABLE device_daemon_status (
    id INT PRIMARY KEY AUTO_INCREMENT,
    device_id INT NOT NULL,
    daemon_version VARCHAR(32),
    daemon_status ENUM('online', 'offline') DEFAULT 'offline',
    last_heartbeat TIMESTAMP,
    capabilities JSON,  -- ['cec_control', 'url_update', ...]
    cec_available BOOLEAN DEFAULT FALSE,
    cec_devices JSON,   -- List of detected CEC devices
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (device_id) REFERENCES display_devices(id) ON DELETE CASCADE,
    UNIQUE KEY unique_device (device_id),
    INDEX idx_daemon_status (daemon_status, last_heartbeat)
);
```

**New Table: `device_commands`**
```sql
CREATE TABLE device_commands (
    id INT PRIMARY KEY AUTO_INCREMENT,
    device_id INT NOT NULL,
    command_type ENUM('update_url', 'cec_power_on', 'cec_power_off', 'cec_set_input', 'cec_scan_inputs') NOT NULL,
    command_data JSON,  -- Additional parameters
    status ENUM('pending', 'sent', 'completed', 'failed') DEFAULT 'pending',
    result JSON,        -- Command execution result
    error_message TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_by_user_id INT,
    
    FOREIGN KEY (device_id) REFERENCES display_devices(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_device_pending (device_id, status),
    INDEX idx_created_at (created_at)
);
```

**Extend `display_devices` table:**
```sql
ALTER TABLE display_devices ADD COLUMN browser_url VARCHAR(512);
ALTER TABLE display_devices ADD COLUMN cec_input_name VARCHAR(64);
ALTER TABLE display_devices ADD COLUMN cec_input_address VARCHAR(16);
ALTER TABLE display_devices ADD COLUMN daemon_enabled BOOLEAN DEFAULT FALSE;
```

#### 4. Frontend UI Components

**Device Settings Enhancement:**
- Browser URL configuration field
- CEC control panel with power buttons
- Input selector dropdown
- Daemon status indicator

**Scheduler Integration:**
- New action types: "Power On Display", "Power Off Display", "Set Input"
- Schedule form supports display actions in addition to playlist changes
- Preview shows display power state changes

### Communication Flow

#### Daemon Registration
```
1. Daemon starts on Pi
2. POST /api/device-daemon/register with device_token
3. Backend creates/updates device_daemon_status record
4. Backend returns device_id and poll interval
5. Daemon enters polling loop
```

#### Command Execution
```
1. Admin triggers command via UI (e.g., "Power Off Display")
2. Backend creates device_commands record (status: pending)
3. Daemon polls GET /api/device-daemon/commands/{device}
4. Backend returns pending commands
5. Daemon executes CEC command
6. Daemon reports result via POST /api/device-daemon/status
7. Backend updates device_commands (status: completed)
8. WebSocket notifies admin UI of completion
```

#### Heartbeat
```
Every 60 seconds:
1. Daemon sends heartbeat with capabilities
2. Backend updates last_heartbeat timestamp
3. Backend marks daemon offline if heartbeat >5 minutes old
```

## Feature Requirements

### Feature 1: Remote Browser URL Update

**Requirements:**
1. Admin can update browser URL via device settings page
2. Daemon receives command to update `/boot/firmware/fullpageos.txt`
3. Daemon validates URL format before writing
4. Daemon backs up original file before modification
5. Daemon triggers browser reload after URL change
6. Change is logged and reported to backend

**FullPageOS.txt Format:**
```ini
kiosk_url=http://10.10.10.2:3000/display/device-token
```

**Implementation:**
```python
def update_browser_url(new_url: str):
    # Backup current config
    shutil.copy('/boot/firmware/fullpageos.txt', '/boot/firmware/fullpageos.txt.bak')
    
    # Read current config
    with open('/boot/firmware/fullpageos.txt', 'r') as f:
        content = f.read()
    
    # Replace kiosk_url line
    new_content = re.sub(r'kiosk_url=.*', f'kiosk_url={new_url}', content)
    
    # Write new config (requires root or sudo)
    with open('/boot/firmware/fullpageos.txt', 'w') as f:
        f.write(new_content)
    
    # Reload browser (send F5 via xdotool or restart chromium)
    os.system('sudo systemctl restart fullpageos')
```

### Feature 2: HDMI CEC Display Control

**Requirements:**
1. Daemon detects if CEC is available on system
2. Daemon can send power on command to display
3. Daemon can send power off command to display
4. Daemon can query display power status
5. Commands have timeout and retry logic
6. Status reported back to backend

**CEC Commands:**
```bash
# Power on
echo 'on 0' | cec-client -s -d 1

# Power off  
echo 'standby 0' | cec-client -s -d 1

# Get power status
echo 'pow 0' | cec-client -s -d 1

# Scan devices
echo 'scan' | cec-client -s -d 1
```

**Implementation:**
```python
import subprocess

class CECController:
    def __init__(self):
        self.available = self._check_cec_available()
    
    def _check_cec_available(self) -> bool:
        """Check if CEC is available on system"""
        try:
            subprocess.run(['which', 'cec-client'], check=True, capture_output=True)
            return True
        except subprocess.CalledProcessError:
            return False
    
    def power_on(self) -> bool:
        """Turn display on"""
        if not self.available:
            return False
        try:
            result = subprocess.run(
                ['cec-client', '-s', '-d', '1'],
                input=b'on 0\n',
                capture_output=True,
                timeout=10
            )
            return result.returncode == 0
        except Exception as e:
            logger.error(f"CEC power on failed: {e}")
            return False
    
    def power_off(self) -> bool:
        """Turn display off"""
        if not self.available:
            return False
        try:
            result = subprocess.run(
                ['cec-client', '-s', '-d', '1'],
                input=b'standby 0\n',
                capture_output=True,
                timeout=10
            )
            return result.returncode == 0
        except Exception as e:
            logger.error(f"CEC power off failed: {e}")
            return False
    
    def scan_inputs(self) -> list:
        """Scan for available HDMI inputs"""
        # Implementation depends on specific CEC capabilities
        pass
```

### Feature 3: Input Source Management

**Requirements:**
1. Daemon scans for available HDMI inputs on display
2. Results include input numbers and names (e.g., "HDMI 1", "HDMI 2")
3. Admin can select desired input from UI dropdown
4. Daemon switches display to selected input
5. Daemon ensures correct input on startup/power-on
6. Input preference saved in database

**CEC Input Commands:**
```bash
# Get active source
echo 'as' | cec-client -s -d 1

# Set active source (example: HDMI 1)
echo 'tx 4F:82:10:00' | cec-client -s -d 1

# Scan for devices
echo 'scan' | cec-client -s -d 1
```

### Feature 4: Scheduler Integration for Display Actions

**Requirements:**
1. Extend ScheduledPlaylist model with action_type field
2. Support action types: `playlist_change`, `display_power_on`, `display_power_off`, `set_input`
3. Scheduler evaluation triggers both playlist AND display actions
4. Display actions queue as device_commands for daemon execution
5. Preview shows both playlist and display state changes
6. Conflict resolution works across action types

**Extended Schedule Model:**
```python
class ScheduledAction(Base):
    __tablename__ = "scheduled_actions"
    
    id = Column(Integer, primary_key=True)
    device_id = Column(Integer, ForeignKey('display_devices.id'))
    schedule_type = Column(Enum(ScheduleType))  # recurring, specific_date
    action_type = Column(Enum(ActionType))  # playlist_change, power_on, power_off, set_input
    
    # Time configuration (same as current scheduler)
    days_of_week = Column(JSON)
    start_time = Column(Time)
    # ... etc
    
    # Action-specific data
    playlist_id = Column(Integer, ForeignKey('playlists.id'), nullable=True)  # For playlist_change
    cec_input = Column(String(16), nullable=True)  # For set_input
    
    # Common fields
    name = Column(String(128))
    priority = Column(Integer)
    enabled = Column(Boolean)
```

## Implementation Plan

### Phase 1: Daemon Foundation (Core Infrastructure)
1. Create Python daemon service skeleton
2. Implement backend registration and authentication
3. Set up command polling mechanism
4. Create device_daemon_status and device_commands tables
5. Build basic admin UI for daemon status

### Phase 2: URL Update Feature
1. Implement FullPageOS.txt parser and updater
2. Add URL validation and backup logic
3. Create backend API endpoint for URL updates
4. Build UI for browser URL configuration
5. Test with FullPageOS device

### Phase 3: CEC Discovery and Status
1. Integrate cec-client library
2. Implement CEC availability detection
3. Build CEC device scanning
4. Report CEC capabilities to backend
5. Display CEC status in UI

### Phase 4: CEC Control (Power & Inputs)
1. Implement power on/off commands
2. Implement input scanning
3. Implement input switching
4. Create UI controls for power and input
5. Add command history and logging

### Phase 5: Scheduler Integration
1. Extend scheduler with action_type support
2. Create display action schedule UI
3. Integrate with command queue system
4. Add preview for display state changes
5. Test end-to-end scheduled power management

## Technical Specifications

### Daemon Architecture

**Installation:**
```bash
# On Raspberry Pi
curl -sSL https://raw.githubusercontent.com/user/glowworm/main/scripts/install-daemon.sh | bash

# Or manual
sudo pip3 install glowworm-daemon
sudo systemctl enable glowworm-daemon
sudo systemctl start glowworm-daemon
```

**Configuration File:** `/etc/glowworm/daemon.conf`
```ini
[daemon]
backend_url = http://10.10.10.2:8002
device_token = abc123...
poll_interval = 30
log_level = INFO

[cec]
enabled = true
display_address = 0
adapter = /dev/cec0

[fullpageos]
config_path = /boot/firmware/fullpageos.txt
```

**Systemd Service:** `/etc/systemd/system/glowworm-daemon.service`
```ini
[Unit]
Description=Glowworm Display Device Daemon
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/glowworm-daemon
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Security Considerations

1. **Authentication**
   - Daemon uses device_token for API authentication
   - All commands verified against device ownership
   - Command signatures prevent replay attacks

2. **Command Validation**
   - URL validation prevents malicious URLs
   - CEC commands limited to safe operations
   - File operations restricted to specific paths

3. **Privilege Management**
   - Daemon runs as root (required for /boot/firmware access and CEC)
   - Backend APIs require admin authentication
   - Command execution is logged and auditable

4. **Rate Limiting**
   - Commands rate-limited to prevent abuse
   - Maximum 10 commands per device per minute
   - Polling interval enforced server-side

### Error Handling

1. **Daemon Offline**
   - Backend marks daemon offline after 5 minutes without heartbeat
   - UI shows warning indicator
   - Commands queue until daemon reconnects
   - Queued commands expire after 1 hour

2. **Command Failures**
   - Daemon reports failures with error messages
   - Backend retries transient failures (max 3 attempts)
   - Permanent failures logged and shown to admin
   - Failed commands cleaned up after 24 hours

3. **CEC Unavailable**
   - Daemon gracefully degrades without CEC
   - UI disables CEC controls when unavailable
   - Capabilities reported in daemon status
   - Clear error messages for users

## API Specification

### Daemon Registration
```http
POST /api/device-daemon/register
Authorization: Bearer {device_token}

Request:
{
  "daemon_version": "1.0.0",
  "capabilities": ["url_update", "cec_control"],
  "system_info": {
    "os": "FullPageOS 0.13.0",
    "arch": "armv7l",
    "cec_available": true
  }
}

Response:
{
  "device_id": 8,
  "poll_interval": 30,
  "config": {
    "cec_enabled": true,
    "log_level": "INFO"
  }
}
```

### Command Polling
```http
GET /api/device-daemon/commands/{device_id}
Authorization: Bearer {device_token}

Response:
{
  "commands": [
    {
      "id": 123,
      "type": "update_url",
      "data": {
        "new_url": "http://10.10.10.2:3000/display/new-token"
      },
      "created_at": "2025-11-08T14:00:00Z"
    },
    {
      "id": 124,
      "type": "cec_power_on",
      "data": {},
      "created_at": "2025-11-08T14:01:00Z"
    }
  ]
}
```

### Status Report
```http
POST /api/device-daemon/status
Authorization: Bearer {device_token}

Request:
{
  "daemon_status": "online",
  "completed_commands": [
    {
      "command_id": 123,
      "status": "success",
      "execution_time": 1.5,
      "result": {
        "url_updated": true,
        "browser_reloaded": true
      }
    }
  ],
  "heartbeat": {
    "cec_available": true,
    "cec_devices": [
      {
        "address": "0",
        "type": "TV",
        "vendor": "Samsung",
        "power_status": "on"
      }
    ]
  }
}

Response:
{
  "acknowledged": true,
  "next_poll": 30
}
```

### Update Browser URL
```http
PUT /api/devices/{device_id}/browser-url
Authorization: Session cookie (admin only)

Request:
{
  "url": "http://10.10.10.2:3000/display/device-token"
}

Response:
{
  "success": true,
  "command_id": 123,
  "message": "URL update queued for device"
}
```

### Display Power Control
```http
POST /api/devices/{device_id}/display/power
Authorization: Session cookie (admin only)

Request:
{
  "action": "on"  // or "off"
}

Response:
{
  "success": true,
  "command_id": 124,
  "message": "Power command queued"
}
```

### Input Management
```http
GET /api/devices/{device_id}/display/inputs

Response:
{
  "inputs": [
    {
      "address": "1.0.0.0",
      "name": "HDMI 1",
      "type": "Playback"
    },
    {
      "address": "2.0.0.0",
      "name": "HDMI 2",
      "type": "Playback"
    }
  ],
  "active_input": "1.0.0.0"
}

POST /api/devices/{device_id}/display/input

Request:
{
  "input_address": "1.0.0.0"
}

Response:
{
  "success": true,
  "command_id": 125,
  "message": "Input change queued"
}
```

## User Interface Mockup

### Device Settings Panel
```
┌─────────────────────────────────────────────────┐
│ Device: Living Room Display                     │
│ Status: ● Online   Daemon: ● Active             │
├─────────────────────────────────────────────────┤
│                                                 │
│ Browser Configuration                           │
│ ┌─────────────────────────────────────────────┐ │
│ │ URL: http://10.10.10.2:3000/display/abc123  │ │
│ └─────────────────────────────────────────────┘ │
│ [Update URL]                                    │
│                                                 │
│ Display Control (HDMI CEC)                      │
│ Power: ● On   │  [Turn Off]  [Turn On]          │
│                                                 │
│ Input Source:                                   │
│ ┌─────────────────────────────────────────────┐ │
│ │ ▼ HDMI 1 (Raspberry Pi)                     │ │
│ └─────────────────────────────────────────────┘ │
│   Options: HDMI 1, HDMI 2, HDMI 3              │
│ [Scan Inputs]  [Apply]                          │
│                                                 │
│ Daemon Status:                                  │
│ Version: 1.0.0                                  │
│ Last Seen: 5 seconds ago                        │
│ Capabilities: URL Update, CEC Control           │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Scheduler with Display Actions
```
┌─────────────────────────────────────────────────┐
│ Create Schedule                                  │
├─────────────────────────────────────────────────┤
│                                                 │
│ Action Type:                                    │
│ ○ Change Playlist                               │
│ ● Power Control                                 │
│ ○ Set Input                                     │
│                                                 │
│ Power Action:                                   │
│ ● Turn On Display                               │
│ ○ Turn Off Display                              │
│                                                 │
│ Time: [09:00 AM] to [09:01 AM]                  │
│ Days: [Mon] [Tue] [Wed] [Thu] [Fri]             │
│                                                 │
│ [Create Schedule]                               │
└─────────────────────────────────────────────────┘
```

## Dependencies

### Daemon Dependencies
```
python3 >= 3.10
python-cec >= 0.2.7  (or cec-client command-line tool)
requests >= 2.31.0
systemd (for service management)
```

### System Dependencies (Raspberry Pi)
```
cec-utils  (provides cec-client)
libcec6
python3-cec (optional, for Python bindings)
```

**Installation:**
```bash
sudo apt-get update
sudo apt-get install -y cec-utils libcec6 python3-cec
```

## Testing Strategy

### Unit Tests
1. URL update logic with various URL formats
2. CEC command formatting and parsing
3. Command queue management
4. Heartbeat timing logic

### Integration Tests
1. Daemon registration flow
2. Command execution end-to-end
3. Status reporting accuracy
4. Scheduler triggering daemon commands

### Hardware Tests
1. Actual CEC power on/off on real TV
2. Input switching on real display
3. FullPageOS.txt update and browser reload
4. Daemon survival across network interruptions

### Stress Tests
1. Multiple commands in rapid succession
2. Daemon offline/online cycles
3. Long-running daemon stability (7+ days)
4. Concurrent commands to multiple devices

## Rollout Plan

### Phase 1: Opt-In Beta (Week 1-2)
- Deploy daemon as optional component
- Test with 1-2 devices
- Gather feedback on CEC compatibility
- Refine command execution logic

### Phase 2: Feature Complete (Week 3-4)
- Add scheduler integration
- Complete UI for all features
- Documentation and setup guide
- Installation script for easy deployment

### Phase 3: Production Ready (Week 5+)
- Auto-update mechanism for daemon
- Monitoring and alerting
- Recovery procedures
- Full documentation

## Open Questions

1. **How to handle daemon updates?**
   - Auto-update via backend trigger?
   - Manual update script?
   - Version compatibility checking?

2. **What if CEC is not available?**
   - Graceful degradation (daemon still runs for URL updates)
   - UI clearly indicates unavailable features
   - Alternative control methods?

3. **How to handle multiple displays per device?**
   - CEC can address multiple displays
   - UI needs multi-display selector
   - Defer to future version?

4. **Daemon security hardening?**
   - Command signing?
   - Rate limiting?
   - Audit logging?

5. **Fallback communication method?**
   - If WebSocket fails, use HTTP polling?
   - Frequency of polling vs WebSocket?

## Success Criteria

Feature is considered complete when:

- [x] Daemon can be installed on Raspberry Pi
- [x] Daemon registers with backend successfully
- [x] Admin can update browser URL remotely
- [x] Browser reloads with new URL automatically
- [x] CEC power on/off works on compatible displays
- [x] Input scanning reports available inputs
- [x] Input switching works reliably
- [x] Scheduler can trigger display power actions
- [x] All operations logged and monitored
- [x] Documentation complete for setup and usage

## Timeline Estimate

- **Phase 1** (Daemon Foundation): 2-3 days
- **Phase 2** (URL Update): 1 day
- **Phase 3** (CEC Discovery): 1 day
- **Phase 4** (CEC Control): 2 days
- **Phase 5** (Scheduler Integration): 2 days

**Total: ~8-10 days** for complete implementation

## Future Enhancements

1. **System Management**
   - Remote reboot/shutdown
   - System updates
   - Log collection

2. **Advanced CEC**
   - Volume control
   - Source cycling
   - Display information query

3. **Display Health Monitoring**
   - Temperature monitoring
   - Display error detection
   - Automatic problem reporting

4. **Multi-Display Support**
   - Control multiple connected displays
   - Independent scheduling per display
   - Display grouping

---

**Priority:** High  
**Complexity:** Medium-High  
**Risk:** Medium (requires hardware testing with various displays)  
**Dependencies:** None (new feature, integrates with existing scheduler)

