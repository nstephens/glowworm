# Glowworm Daemon - Developer Guide

## Architecture Overview

The Glowworm Display Device Daemon is a Python service that runs on Raspberry Pi devices to enable remote control operations. It uses a polling architecture to communicate with the Glowworm backend.

### Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     Raspberry Pi Device                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Glowworm Daemon (Python Service)                         │  │
│  │  ┌────────────┐  ┌──────────────┐  ┌─────────────────┐   │  │
│  │  │  Main Loop │→ │Command Queue │→ │ Command         │   │  │
│  │  │            │  │              │  │ Executors       │   │  │
│  │  └────────────┘  └──────────────┘  └─────────────────┘   │  │
│  │        ↓                                     ↓            │  │
│  │  ┌────────────┐                      ┌─────────────────┐   │  │
│  │  │  Polling   │                      │  CEC Controller │   │  │
│  │  │  (30s)     │                      │  URL Updater    │   │  │
│  │  └────────────┘                      └─────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
│         ↕ HTTP (port 3003)                    ↓                 │
│  ┌──────────────────┐              ┌──────────────────────┐     │
│  │  FullPageOS      │              │  HDMI CEC Bus        │     │
│  │  Config          │              │  (Display Control)   │     │
│  └──────────────────┘              └──────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
                   ↕ HTTP to Frontend
┌─────────────────────────────────────────────────────────────────┐
│              Glowworm Frontend (Port 3003)                      │
│  ┌──────────────────────┐                                       │
│  │  Nginx/Vite Proxy    │→ Proxies /api/* to backend            │
│  │  Routes /api/* →     │                                       │
│  └──────────────────────┘                                       │
└─────────────────────────────────────────────────────────────────┘
                   ↕ Internal Network
┌─────────────────────────────────────────────────────────────────┐
│              Glowworm Backend (Port 8001/8002)                  │
│  ┌──────────────────────┐  ┌───────────────┐  ┌─────────────┐  │
│  │  Device Daemon API   │→ │ Command Queue │→ │  Database   │  │
│  │  (/api/device-daemon)│  │   Service     │  │             │  │
│  └──────────────────────┘  └───────────────┘  └─────────────┘  │
│  ┌──────────────────────┐                                       │
│  │  Scheduler Service   │→ Creates commands for scheduled       │
│  │  (Celery Beat)       │   actions                             │
│  └──────────────────────┘                                       │
└─────────────────────────────────────────────────────────────────┘

**Key Architecture Point:**
The daemon connects to the frontend URL (e.g., http://10.10.10.2:3003),
which then proxies /api/* requests to the backend. This maintains a
single entry point and works with the existing proxy configuration.
```

## Database Schema

### device_daemon_status
Tracks daemon instances and their capabilities.

```sql
CREATE TABLE device_daemon_status (
  id INT PRIMARY KEY,
  device_id INT NOT NULL UNIQUE,
  daemon_version VARCHAR(32),
  daemon_status ENUM('online', 'offline'),
  last_heartbeat TIMESTAMP,
  capabilities JSON,
  cec_available BOOLEAN,
  cec_devices JSON,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES display_devices(id)
);
```

### device_commands
Command queue for daemon execution.

```sql
CREATE TABLE device_commands (
  id INT PRIMARY KEY,
  device_id INT NOT NULL,
  command_type ENUM('update_url', 'cec_power_on', 'cec_power_off', 
                   'cec_set_input', 'cec_scan_inputs'),
  command_data JSON,
  status ENUM('pending', 'sent', 'completed', 'failed', 'timeout'),
  result JSON,
  error_message TEXT,
  created_at TIMESTAMP,
  sent_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_by_user_id INT,
  FOREIGN KEY (device_id) REFERENCES display_devices(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);
```

### scheduled_actions
Scheduled display control actions.

```sql
CREATE TABLE scheduled_actions (
  id INT PRIMARY KEY,
  device_id INT NOT NULL,
  action_type ENUM('power_on', 'power_off', 'set_input'),
  action_data JSON,
  schedule_type VARCHAR(20),  -- 'recurring' or 'specific_date'
  days_of_week JSON,
  start_time TIME,
  end_time TIME,
  specific_date DATE,
  specific_start_time TIME,
  specific_end_time TIME,
  annual_recurrence BOOLEAN,
  name VARCHAR(128),
  description TEXT,
  priority INT,
  enabled BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  created_by_user_id INT
);
```

## API Reference

### Authentication

All daemon endpoints require Bearer token authentication:

```http
Authorization: Bearer {device_token}
```

### Register Daemon

**Important:** All API calls go through the frontend URL (which proxies to backend).

```http
POST http://10.10.10.2:3003/api/device-daemon/register
Authorization: Bearer {device_token}
Content-Type: application/json

{
  "daemon_version": "1.0.0",
  "capabilities": {
    "url_update": true,
    "cec_control": true
  }
}
```

The frontend (Nginx/Vite) proxies `/api/*` to the backend automatically.

Response:
```json
{
  "status": "registered",
  "message": "Daemon registered successfully",
  "poll_interval": 30
}
```

### Poll for Commands

```http
GET /api/device-daemon/commands/poll
Authorization: Bearer {device_token}
```

Response:
```json
{
  "commands": [
    {
      "id": 123,
      "type": "update_url",
      "parameters": {
        "url": "http://10.10.10.2:3000/display/new-token"
      },
      "created_at": "2024-11-09T14:00:00Z"
    }
  ],
  "count": 1
}
```

### Report Command Result

```http
POST /api/device-daemon/commands/123/result
Authorization: Bearer {device_token}
Content-Type: application/json

{
  "status": "completed",
  "result": {
    "url": "http://10.10.10.2:3000/display/new-token",
    "browser_reloaded": true,
    "reload_method": "systemctl_restart"
  },
  "completed_at": "2024-11-09T14:00:05Z"
}
```

## Extending the Daemon

### Adding New Command Types

1. **Create Executor Class:**

```python
# daemon/glowworm_daemon/command_executor.py

class MyCustomExecutor(CommandExecutor):
    def validate(self, command_data: Dict[str, Any]) -> bool:
        # Validate command parameters
        return "required_param" in command_data
    
    def execute(self, command_data: Dict[str, Any]) -> Dict[str, Any]:
        # Execute command
        result = do_something(command_data["required_param"])
        
        return {
            "status": "success",
            "result": result,
        }
```

2. **Register in Factory:**

```python
# In CommandExecutorFactory.__init__
self._executors["my_custom_command"] = MyCustomExecutor
```

3. **Add Backend Support:**

```python
# backend/models/device_command.py
class CommandType(str, enum.Enum):
    # ... existing types ...
    MY_CUSTOM_COMMAND = "my_custom_command"
```

4. **Create API Endpoint:**

```python
# backend/api/device_daemon.py
@router.post("/devices/{device_id}/my-custom-action")
async def my_custom_action(device_id: int, db: Session = Depends(get_db)):
    command = DeviceCommandService.create_command(
        db=db,
        device_id=device_id,
        command_type=CommandType.MY_CUSTOM_COMMAND,
        command_data={"required_param": "value"},
    )
    return {"status": "queued", "command_id": command.id}
```

## Testing

### Unit Tests

```bash
cd daemon
pytest tests/
```

### Manual Testing

```python
# Test configuration
python3 -m glowworm_daemon.config

# Test logging
python3 -m glowworm_daemon.logging_config

# Test CEC controller
python3 -m glowworm_daemon.cec_controller

# Test command executors
python3 -m glowworm_daemon.command_executor
```

### Integration Testing

1. Set up test backend
2. Configure daemon with test credentials
3. Run daemon in foreground:
   ```bash
   python3 -m glowworm_daemon.main
   ```
4. Create test commands via admin UI
5. Verify execution in logs

## Performance Considerations

- **Polling Interval:** 30s default balances responsiveness and load
- **Command Batch Size:** Max 10 commands per poll
- **Timeout Settings:** Configurable per command type
- **Log Rotation:** 10MB files, 5 backups
- **Resource Limits:** 256MB memory, 50% CPU (systemd)

## Development Setup

### Modern Virtual Environment Approach (PEP 668 Compliant)

```bash
# Clone repository
git clone https://github.com/yourusername/glowworm.git
cd glowworm/daemon

# Create virtual environment
python3 -m venv venv

# Activate venv
source venv/bin/activate

# Install in development mode
pip install --upgrade pip
pip install -e .
pip install -e ".[dev]"  # Include dev dependencies

# Run locally
python -m glowworm_daemon.main

# Run tests
pytest tests/ -v

# Deactivate when done
deactivate
```

### For System-Wide Installation (Production)

```bash
# Create system venv
sudo mkdir -p /opt/glowworm-daemon
sudo python3 -m venv /opt/glowworm-daemon/venv

# Install package
sudo /opt/glowworm-daemon/venv/bin/pip install glowworm-daemon

# Create symlinks
sudo ln -sf /opt/glowworm-daemon/venv/bin/glowworm-daemon /usr/local/bin/
sudo ln -sf /opt/glowworm-daemon/venv/bin/glowworm-daemon-setup /usr/local/bin/
```

## Debugging

Enable debug logging:

```ini
[daemon]
log_level = DEBUG
```

Watch logs:

```bash
sudo journalctl -u glowworm-daemon -f --since "1 minute ago"
```

Common debug scenarios:

```python
# In daemon code
from .logging_config import debug_context

logger = get_logger(__name__)

with debug_context(logger):
    # Temporary debug logging
    logger.debug("Detailed debug information here")
```

## Contributing

See `CONTRIBUTING.md` for contribution guidelines.

## License

MIT License - See `LICENSE` file for details.

