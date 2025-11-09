# Glowworm Display Device Daemon

Optional daemon service that runs on Raspberry Pi display devices to enable host-level control.

## Features

- Remote browser URL updates (FullPageOS configuration)
- HDMI CEC display control (power on/off, input switching)
- Integration with Glowworm scheduler for automated display management
- Secure communication with Glowworm backend

## Installation

```bash
# On Raspberry Pi with FullPageOS
curl -sSL https://raw.githubusercontent.com/yourusername/glowworm/main/daemon/scripts/install.sh | sudo bash
```

Or manual installation:

```bash
# Create virtual environment (PEP 668 compliant)
sudo mkdir -p /opt/glowworm-daemon
sudo python3 -m venv /opt/glowworm-daemon/venv

# Install in venv
sudo /opt/glowworm-daemon/venv/bin/pip install glowworm-daemon

# Create symlinks
sudo ln -sf /opt/glowworm-daemon/venv/bin/glowworm-daemon /usr/local/bin/
sudo ln -sf /opt/glowworm-daemon/venv/bin/glowworm-daemon-setup /usr/local/bin/

# Run setup
sudo glowworm-daemon-setup
```

## Requirements

- Python 3.10+
- Raspberry Pi with FullPageOS
- cec-utils (for HDMI CEC control)
- systemd

## Configuration

Configuration file: `/etc/glowworm/daemon.conf`

```ini
[daemon]
# Use the frontend URL (same as admin UI), NOT the backend URL
# The frontend proxies /api/ requests to the backend
backend_url = http://10.10.10.2:3003
device_token = your-device-token-here
poll_interval = 30
log_level = INFO

[cec]
enabled = true
display_address = 0
adapter = /dev/cec0

[fullpageos]
config_path = /boot/firmware/fullpageos.txt
```

## Usage

```bash
# Start daemon
sudo systemctl start glowworm-daemon

# Enable on boot
sudo systemctl enable glowworm-daemon

# Check status
sudo systemctl status glowworm-daemon

# View logs
sudo journalctl -u glowworm-daemon -f
```

## Development

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install in development mode
pip install -e .
pip install -e ".[dev]"

# Run tests
pytest tests/

# Run locally (for testing)
python -m glowworm_daemon.main

# Deactivate when done
deactivate
```

## Documentation

Full documentation available in `docs/DAEMON_GUIDE.md`

