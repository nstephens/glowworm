# GlowWorm Pi3D Display Daemon

The GlowWorm display daemon runs on Raspberry Pi devices to provide GPU-accelerated photo slideshows with smooth transitions.

## Features

- GPU-accelerated display using Pi3D
- Smooth cross-fade transitions at 30+ FPS
- Low memory usage (<200MB RAM)
- Offline image caching with LRU eviction
- WebSocket connection for real-time control
- Automatic crash recovery and restart
- Remote control via admin panel
- HDMI CEC display control (power on/off)

## Requirements

- Raspberry Pi 3B+, 4, or 5
- Raspberry Pi OS (64-bit recommended)
- Python 3.10+
- Display connected via HDMI

## Installation

### Quick Install (Recommended)

```bash
curl -sSL https://your-server/install.sh | sudo bash
```

The installer will:
- Install Pi3D and dependencies
- Set up the GlowWorm daemon service
- Configure display settings
- Prompt for your GlowWorm server URL
- Display a 4-character registration code

### Manual Installation

```bash
# Create virtual environment
sudo mkdir -p /opt/glowworm
sudo python3 -m venv /opt/glowworm/venv

# Install packages
sudo /opt/glowworm/venv/bin/pip install glowworm-daemon glowworm-display

# Run setup
sudo /opt/glowworm/venv/bin/glowworm-daemon-setup
```

## Configuration

Configuration file: `/etc/glowworm/config.yaml`

```yaml
backend:
  url: "http://your-server:3003"
  device_token: ""  # Set during registration

display:
  orientation: portrait  # portrait or landscape
  rotation: 0  # 0, 90, 180, 270
  background_color: "#000000"
  fps_target: 30

slideshow:
  display_time: 30.0  # seconds per image
  transition_duration: 2.0
  scale_mode: fit  # fit, fill, stretch
  preload_count: 3

cache:
  directory: /var/cache/glowworm/images
  max_size_mb: 500
  min_free_space_mb: 100

cec:
  enabled: true
  display_address: 0
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

## Registration Process

1. Install the daemon on your Raspberry Pi
2. The Pi will display a 4-character registration code
3. In the GlowWorm admin panel, go to **Devices**
4. Authorize the device using the registration code
5. Assign a playlist to the device
6. The slideshow starts automatically

## Remote Control

From the admin panel, you can:
- Play/pause the slideshow
- Skip to next/previous image
- Reload the playlist
- Clear the image cache
- Monitor connection status
- View cache statistics

## Development

```bash
# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install in development mode
pip install -e daemon/
pip install -e display/

# Run tests
pytest daemon/tests/
pytest display/tests/

# Run daemon in mock mode (no Pi3D hardware required)
glowworm-daemon --mock
```

## Documentation

- [Installation Guide](https://github.com/nstephens/glowworm/wiki/Raspberry-Pi-Setup)
- [Configuration Reference](https://github.com/nstephens/glowworm/wiki/Configuration)
- [Troubleshooting](https://github.com/nstephens/glowworm/wiki/Troubleshooting)
