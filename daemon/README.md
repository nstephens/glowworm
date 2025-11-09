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
sudo pip3 install glowworm-daemon
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
backend_url = http://10.10.10.2:8002
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
# Install in development mode
pip3 install -e .

# Run tests
pytest tests/

# Run locally (for testing)
python3 -m glowworm_daemon.main
```

## Documentation

Full documentation available in `docs/DAEMON_GUIDE.md`

