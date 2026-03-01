# GlowWorm Pi3D Display - Installation Guide

This guide covers setting up GlowWorm's Pi3D-based display system on a Raspberry Pi.

## Requirements

### Hardware

- **Raspberry Pi 3B+, 4, or 5** (Pi 4 4GB+ recommended)
- **MicroSD card** (16GB+ recommended)
- **HDMI display** (any resolution, 1080p recommended)
- **Network connectivity** (WiFi or Ethernet)
- **Power supply** (appropriate for your Pi model)

### Software

- **Raspberry Pi OS Lite (64-bit)** - Bookworm or newer
- **Python 3.11+** (included in Raspberry Pi OS Bookworm)
- **GlowWorm backend server** already running and accessible

## Quick Install

Run this single command on your Raspberry Pi:

```bash
curl -sSL https://raw.githubusercontent.com/nstephens/glowworm/main/pi3d/scripts/install.sh | sudo bash
```

The installer will:
1. Detect your Raspberry Pi hardware
2. Install required system dependencies
3. Create a Python virtual environment
4. Install GlowWorm daemon and display packages
5. Set up the systemd service
6. Run the configuration wizard
7. Optionally configure GPU memory

## Manual Installation

### Step 1: Prepare the Raspberry Pi

1. **Flash Raspberry Pi OS Lite (64-bit)** to your microSD card using [Raspberry Pi Imager](https://www.raspberrypi.com/software/)

2. **Configure headless setup** (optional):
   - Enable SSH in the imager settings
   - Configure WiFi credentials
   - Set hostname and user account

3. **Boot and update the system**:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

### Step 2: Install Dependencies

```bash
# Base packages
sudo apt install -y python3 python3-venv python3-pip python3-dev python3-numpy git curl

# Pi3D and OpenGL ES dependencies
sudo apt install -y libopengles2 libegl1 libgles2-mesa-dev libegl1-mesa-dev libdrm-dev libgbm-dev

# Image processing
sudo apt install -y libjpeg-dev libpng-dev libfreetype6-dev libfontconfig1-dev

# CEC support (optional, for HDMI power control)
sudo apt install -y cec-utils libcec-dev
```

### Step 3: Create Directory Structure

```bash
sudo mkdir -p /opt/glowworm
sudo mkdir -p /etc/glowworm
sudo mkdir -p /var/log/glowworm
sudo mkdir -p /var/lib/glowworm
sudo mkdir -p /var/cache/glowworm/images
sudo mkdir -p /run/glowworm
```

### Step 4: Create Virtual Environment

```bash
sudo python3 -m venv /opt/glowworm/venv
sudo /opt/glowworm/venv/bin/pip install --upgrade pip wheel setuptools
```

### Step 5: Install GlowWorm Packages

**From GitHub:**
```bash
sudo /opt/glowworm/venv/bin/pip install \
    "git+https://github.com/nstephens/glowworm.git@main#subdirectory=daemon"
sudo /opt/glowworm/venv/bin/pip install \
    "git+https://github.com/nstephens/glowworm.git@main#subdirectory=display"
```

**From local repository:**
```bash
# Clone the repository first
git clone https://github.com/nstephens/glowworm.git
cd glowworm

# Install packages
sudo /opt/glowworm/venv/bin/pip install ./daemon
sudo /opt/glowworm/venv/bin/pip install ./display
```

### Step 6: Create Symlinks

```bash
sudo ln -sf /opt/glowworm/venv/bin/glowworm-daemon /usr/local/bin/glowworm-daemon
sudo ln -sf /opt/glowworm/venv/bin/glowworm-display /usr/local/bin/glowworm-display
```

### Step 7: Create Configuration File

Create `/etc/glowworm/config.yaml`:

```yaml
# GlowWorm v3.0 Configuration

# Backend connection
backend:
  url: "http://YOUR_SERVER_IP:3003"  # Your GlowWorm server URL
  device_token: ""  # Set during device registration

# Display settings
display:
  orientation: portrait  # portrait or landscape
  rotation: 0  # 0, 90, 180, 270
  background_color: "#000000"
  fps_target: 30
  fullscreen: true

# Slideshow settings
slideshow:
  display_time: 30.0  # seconds per image
  transition_duration: 2.0  # seconds
  scale_mode: fit  # fit, fill, stretch
  preload_count: 3

# Cache settings
cache:
  directory: /var/cache/glowworm/images
  max_size_mb: 500
  min_free_space_mb: 100

# State persistence
state:
  directory: /var/lib/glowworm

# IPC settings
ipc:
  socket_path: /run/glowworm/display.sock
  timeout: 5.0

# Logging
logging:
  level: INFO
  file: /var/log/glowworm/daemon.log

# CEC control (HDMI power management)
cec:
  enabled: false
  display_address: 0
  adapter: /dev/cec0
  timeout: 5
```

Set appropriate permissions:
```bash
sudo chmod 600 /etc/glowworm/config.yaml
```

### Step 8: Install Systemd Service

Create `/etc/systemd/system/glowworm-daemon.service`:

```ini
[Unit]
Description=GlowWorm Display Daemon
Documentation=https://github.com/nstephens/glowworm
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
Group=root
ExecStart=/opt/glowworm/venv/bin/python -m glowworm_daemon.main
ExecStopPost=/bin/rm -f /run/glowworm/display.sock
Restart=always
RestartSec=10
StartLimitInterval=300
StartLimitBurst=5
NoNewPrivileges=true
CPUQuota=80%
MemoryMax=256M
Environment="PYTHONUNBUFFERED=1"
Environment="PATH=/opt/glowworm/venv/bin:/usr/local/bin:/usr/bin:/bin"
StandardOutput=journal
StandardError=journal
SyslogIdentifier=glowworm-daemon
WorkingDirectory=/var/lib/glowworm
RuntimeDirectory=glowworm
RuntimeDirectoryMode=0755

[Install]
WantedBy=multi-user.target
```

Reload systemd and enable the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable glowworm-daemon
```

### Step 9: Configure GPU Memory (Recommended)

For optimal Pi3D performance, set GPU memory to 128MB or higher:

1. Edit `/boot/firmware/config.txt` (or `/boot/config.txt` on older systems):
   ```bash
   sudo nano /boot/firmware/config.txt
   ```

2. Add or modify:
   ```
   gpu_mem=128
   ```

3. Reboot:
   ```bash
   sudo reboot
   ```

## Starting the Service

```bash
# Start the daemon
sudo systemctl start glowworm-daemon

# Check status
sudo systemctl status glowworm-daemon

# View logs
sudo journalctl -u glowworm-daemon -f
```

## Device Registration

When the daemon starts without a device token, it enters registration mode:

1. **A registration code appears on screen** (4 characters)
2. **Open your GlowWorm admin interface** in a web browser
3. **Navigate to Devices** and look for pending devices
4. **Enter the registration code** and authorize the device
5. **The device will automatically start the slideshow**

The device token is saved to the configuration file automatically.

## Verification

After installation, verify everything is working:

```bash
# Check daemon is running
sudo systemctl status glowworm-daemon

# Check logs for errors
sudo journalctl -u glowworm-daemon --no-pager -n 50

# Test display package
/opt/glowworm/venv/bin/python -c "import glowworm_display; print('Display OK')"

# Test daemon package
/opt/glowworm/venv/bin/python -c "import glowworm_daemon; print('Daemon OK')"

# Check GPU memory
vcgencmd get_mem gpu
```

## Uninstallation

Use the uninstall script:

```bash
sudo bash /path/to/glowworm/pi3d/scripts/uninstall.sh
```

Or manually:

```bash
# Stop and disable service
sudo systemctl stop glowworm-daemon
sudo systemctl disable glowworm-daemon

# Remove service file
sudo rm /etc/systemd/system/glowworm-daemon.service
sudo systemctl daemon-reload

# Remove installation
sudo rm -rf /opt/glowworm

# Remove symlinks
sudo rm -f /usr/local/bin/glowworm-daemon
sudo rm -f /usr/local/bin/glowworm-display

# Optionally remove config, state, cache, logs
# sudo rm -rf /etc/glowworm
# sudo rm -rf /var/lib/glowworm
# sudo rm -rf /var/cache/glowworm
# sudo rm -rf /var/log/glowworm
```

## Next Steps

- [Configuration Reference](configuration.md) - All configuration options
- [Troubleshooting](troubleshooting.md) - Common issues and solutions
- [Developer Documentation](development.md) - Architecture and IPC protocol
