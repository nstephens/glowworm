#!/bin/bash
#
# GlowWorm v3.0 Pi3D Display Installation Script
# For Raspberry Pi with Raspberry Pi OS Lite (64-bit)
#
# Usage: curl -sSL <url> | sudo bash
#
# This script installs:
# - glowworm-daemon (orchestration and backend communication)
# - glowworm-display (Pi3D-based GPU-accelerated rendering)
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Installation directories
INSTALL_DIR="/opt/glowworm"
CONFIG_DIR="/etc/glowworm"
LOG_DIR="/var/log/glowworm"
STATE_DIR="/var/lib/glowworm"
CACHE_DIR="/var/cache/glowworm"
RUN_DIR="/run/glowworm"

# Version
VERSION="3.0.0"

# Print banner
print_banner() {
    echo -e "${CYAN}"
    echo "========================================"
    echo "   GlowWorm v${VERSION} Installation"
    echo "   Pi3D GPU-Accelerated Display"
    echo "========================================"
    echo -e "${NC}"
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}Error: This script must be run as root${NC}"
        echo "Please run: sudo bash install.sh"
        exit 1
    fi
    echo -e "${GREEN}[OK]${NC} Running as root"
}

# Detect OS and architecture
detect_system() {
    echo -e "\n${BLUE}Detecting system...${NC}"

    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VER=$VERSION_ID
    else
        echo -e "${RED}Error: Cannot detect OS${NC}"
        exit 1
    fi

    # Check architecture
    ARCH=$(uname -m)
    if [[ "$ARCH" != "aarch64" && "$ARCH" != "armv7l" ]]; then
        echo -e "${YELLOW}Warning: Non-ARM architecture detected ($ARCH)${NC}"
        echo "Pi3D performance may be limited on non-Raspberry Pi hardware"
    fi

    # Check for Raspberry Pi
    IS_PI=false
    PI_MODEL=""
    if grep -q "Raspberry Pi" /proc/cpuinfo 2>/dev/null; then
        IS_PI=true
        PI_MODEL=$(grep "Model" /proc/cpuinfo | cut -d: -f2 | xargs)
        echo -e "${GREEN}[OK]${NC} Raspberry Pi detected: $PI_MODEL"
    else
        echo -e "${YELLOW}Warning: Not running on Raspberry Pi${NC}"
        echo "Some features (CEC, GPU acceleration) may not work"
    fi

    echo -e "${GREEN}[OK]${NC} OS: $OS $VER ($ARCH)"
}

# Check Python version
check_python() {
    echo -e "\n${BLUE}Checking Python...${NC}"

    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}Error: Python 3 not found${NC}"
        exit 1
    fi

    PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)
    REQUIRED_VERSION="3.11"

    if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$PYTHON_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
        echo -e "${RED}Error: Python $REQUIRED_VERSION or higher is required${NC}"
        echo "Found: Python $PYTHON_VERSION"
        exit 1
    fi

    echo -e "${GREEN}[OK]${NC} Python version: $PYTHON_VERSION"
}

# Check for systemd
check_systemd() {
    echo -e "\n${BLUE}Checking systemd...${NC}"

    if ! command -v systemctl &> /dev/null; then
        echo -e "${RED}Error: systemd is required${NC}"
        echo "This script requires systemd for service management"
        exit 1
    fi

    echo -e "${GREEN}[OK]${NC} systemd detected"
}

# Install system dependencies
install_dependencies() {
    echo -e "\n${BLUE}Installing system dependencies...${NC}"

    apt-get update -qq

    # Base dependencies
    PACKAGES=(
        python3
        python3-venv
        python3-pip
        python3-dev
        python3-numpy
        git
        curl
    )

    # Pi3D dependencies (handle both Bookworm and Trixie package names)
    if apt-cache show libopengles2 &>/dev/null; then
        PACKAGES+=(libopengles2)
    elif apt-cache show libgles2 &>/dev/null; then
        PACKAGES+=(libgles2)
    fi

    PACKAGES+=(
        libegl1
        libgles2-mesa-dev
        libegl1-mesa-dev
        libdrm-dev
        libgbm-dev
    )

    # Image processing dependencies
    PACKAGES+=(
        libjpeg-dev
        libpng-dev
        libfreetype6-dev
        libfontconfig1-dev
    )

    # CEC dependencies (for HDMI power control)
    if [ "$IS_PI" = true ]; then
        PACKAGES+=(
            cec-utils
            libcec-dev
        )
    fi

    apt-get install -y -qq "${PACKAGES[@]}"

    echo -e "${GREEN}[OK]${NC} System dependencies installed"
}

# Create directory structure
create_directories() {
    echo -e "\n${BLUE}Creating directories...${NC}"

    # Main installation directory
    mkdir -p "$INSTALL_DIR"

    # Configuration directory
    mkdir -p "$CONFIG_DIR"
    chmod 755 "$CONFIG_DIR"

    # Log directory
    mkdir -p "$LOG_DIR"
    chmod 755 "$LOG_DIR"

    # State directory (playlist position, etc.)
    mkdir -p "$STATE_DIR"
    chmod 755 "$STATE_DIR"

    # Cache directory (downloaded images)
    mkdir -p "$CACHE_DIR/images"
    chmod 755 "$CACHE_DIR"
    chmod 755 "$CACHE_DIR/images"

    # Runtime directory (sockets)
    mkdir -p "$RUN_DIR"
    chmod 755 "$RUN_DIR"

    echo -e "${GREEN}[OK]${NC} Directories created"
}

# Create virtual environment
create_venv() {
    echo -e "\n${BLUE}Creating Python virtual environment...${NC}"

    # Remove old venv if exists
    if [ -d "$INSTALL_DIR/venv" ]; then
        rm -rf "$INSTALL_DIR/venv"
    fi

    python3 -m venv "$INSTALL_DIR/venv"

    # Upgrade pip
    "$INSTALL_DIR/venv/bin/pip" install --quiet --upgrade pip wheel setuptools

    echo -e "${GREEN}[OK]${NC} Virtual environment created"
}

# Install GlowWorm packages
install_packages() {
    echo -e "\n${BLUE}Installing GlowWorm packages...${NC}"

    # Get the script directory to find local packages
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    REPO_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

    # Check if we're running from the repository
    if [ -d "$REPO_ROOT/daemon" ] && [ -d "$REPO_ROOT/display" ]; then
        echo "Installing from local repository..."

        # Install daemon package
        "$INSTALL_DIR/venv/bin/pip" install --quiet "$REPO_ROOT/daemon"

        # Install display package
        "$INSTALL_DIR/venv/bin/pip" install --quiet "$REPO_ROOT/display"
    else
        # Install from GitHub
        echo "Installing from GitHub..."
        "$INSTALL_DIR/venv/bin/pip" install --quiet \
            "git+https://github.com/nstephens/glowworm.git@main#subdirectory=daemon"
        "$INSTALL_DIR/venv/bin/pip" install --quiet \
            "git+https://github.com/nstephens/glowworm.git@main#subdirectory=display"
    fi

    # Create symlinks to executables
    ln -sf "$INSTALL_DIR/venv/bin/glowworm-daemon" /usr/local/bin/glowworm-daemon
    ln -sf "$INSTALL_DIR/venv/bin/glowworm-display" /usr/local/bin/glowworm-display

    # Verify installation
    if ! "$INSTALL_DIR/venv/bin/python" -c "import glowworm_daemon; import glowworm_display" 2>/dev/null; then
        echo -e "${RED}Error: Package installation failed${NC}"
        exit 1
    fi

    echo -e "${GREEN}[OK]${NC} GlowWorm packages installed"
}

# Install systemd services
install_services() {
    echo -e "\n${BLUE}Installing systemd services...${NC}"

    # Get the script directory
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    SYSTEMD_DIR="$(dirname "$SCRIPT_DIR")/systemd"

    # Daemon service
    cat > /etc/systemd/system/glowworm-daemon.service << 'EOF'
[Unit]
Description=GlowWorm Display Daemon
Documentation=https://github.com/nstephens/glowworm
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
Group=root

# Main process
ExecStart=/opt/glowworm/venv/bin/python -m glowworm_daemon.main
ExecStopPost=/bin/rm -f /run/glowworm/display.sock

# Restart configuration
Restart=always
RestartSec=10
StartLimitInterval=300
StartLimitBurst=5

# Security (relaxed for GPIO/GPU access)
NoNewPrivileges=true

# Resource limits
CPUQuota=80%
MemoryMax=256M

# Environment
Environment="PYTHONUNBUFFERED=1"
Environment="PATH=/opt/glowworm/venv/bin:/usr/local/bin:/usr/bin:/bin"

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=glowworm-daemon

# Working directory
WorkingDirectory=/var/lib/glowworm

# Runtime directory
RuntimeDirectory=glowworm
RuntimeDirectoryMode=0755

[Install]
WantedBy=multi-user.target
EOF

    # Create tmpfiles.d config for /run/glowworm
    cat > /etc/tmpfiles.d/glowworm.conf << 'EOF'
# GlowWorm runtime directory
d /run/glowworm 0755 root root -
EOF

    # Reload systemd
    systemctl daemon-reload

    # Create runtime directory now
    systemd-tmpfiles --create

    echo -e "${GREEN}[OK]${NC} Systemd services installed"
}

# Create default configuration
create_default_config() {
    echo -e "\n${BLUE}Creating default configuration...${NC}"

    CONFIG_FILE="$CONFIG_DIR/config.yaml"

    if [ -f "$CONFIG_FILE" ]; then
        echo -e "${YELLOW}Configuration file already exists${NC}"
        echo "Backing up to $CONFIG_FILE.backup"
        cp "$CONFIG_FILE" "$CONFIG_FILE.backup"
    fi

    cat > "$CONFIG_FILE" << 'EOF'
# GlowWorm v3.0 Configuration
# Edit this file to configure your display

# Backend connection
backend:
  url: "http://localhost:3003"  # Your GlowWorm frontend URL
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
EOF

    chmod 600 "$CONFIG_FILE"

    echo -e "${GREEN}[OK]${NC} Default configuration created: $CONFIG_FILE"
}

# Configure GPU memory (Raspberry Pi specific)
configure_gpu() {
    if [ "$IS_PI" != true ]; then
        return
    fi

    echo -e "\n${BLUE}Configuring GPU memory...${NC}"

    CONFIG_TXT="/boot/config.txt"
    if [ -f "/boot/firmware/config.txt" ]; then
        CONFIG_TXT="/boot/firmware/config.txt"
    fi

    if [ -f "$CONFIG_TXT" ]; then
        # Check current GPU memory
        CURRENT_GPU=$(grep "^gpu_mem" "$CONFIG_TXT" 2>/dev/null | tail -1 | cut -d= -f2)

        if [ -z "$CURRENT_GPU" ] || [ "$CURRENT_GPU" -lt 128 ]; then
            echo -e "${YELLOW}GPU memory is set to ${CURRENT_GPU:-default} MB${NC}"
            echo "For optimal performance, 128MB or higher is recommended"

            read -p "Would you like to set GPU memory to 128MB? (y/n) [y]: " response
            response=${response:-y}

            if [[ "$response" =~ ^[Yy] ]]; then
                # Backup config
                cp "$CONFIG_TXT" "$CONFIG_TXT.backup"

                # Remove existing gpu_mem lines
                sed -i '/^gpu_mem/d' "$CONFIG_TXT"

                # Add new gpu_mem setting
                echo "" >> "$CONFIG_TXT"
                echo "# GlowWorm GPU memory setting" >> "$CONFIG_TXT"
                echo "gpu_mem=128" >> "$CONFIG_TXT"

                echo -e "${GREEN}[OK]${NC} GPU memory set to 128MB"
                echo -e "${YELLOW}Note: Reboot required for this change to take effect${NC}"
            fi
        else
            echo -e "${GREEN}[OK]${NC} GPU memory: ${CURRENT_GPU}MB"
        fi
    fi
}

# Run configuration wizard
run_wizard() {
    echo -e "\n${BLUE}Configuration Wizard${NC}"
    echo "========================================"

    CONFIG_FILE="$CONFIG_DIR/config.yaml"

    # Backend URL
    echo ""
    echo "Enter the URL of your GlowWorm server."
    echo "This is the URL you use to access the admin interface."
    echo "Example: http://192.168.1.100:3003"
    echo ""
    read -p "GlowWorm Server URL: " BACKEND_URL

    if [ -z "$BACKEND_URL" ]; then
        echo -e "${YELLOW}Using default: http://localhost:3003${NC}"
        BACKEND_URL="http://localhost:3003"
    fi

    # Display orientation
    echo ""
    echo "Display orientation (portrait/landscape):"
    read -p "Orientation [portrait]: " ORIENTATION
    ORIENTATION=${ORIENTATION:-portrait}

    # Display rotation
    echo ""
    echo "Display rotation (0, 90, 180, 270):"
    read -p "Rotation [0]: " ROTATION
    ROTATION=${ROTATION:-0}

    # CEC
    echo ""
    read -p "Enable HDMI-CEC power control? (y/n) [n]: " CEC_ENABLED
    if [[ "$CEC_ENABLED" =~ ^[Yy] ]]; then
        CEC_ENABLED="True"
    else
        CEC_ENABLED="False"
    fi

    # Update configuration
    "$INSTALL_DIR/venv/bin/python" << PYTHON_SCRIPT
import yaml

with open("$CONFIG_FILE", "r") as f:
    config = yaml.safe_load(f)

config["backend"]["url"] = "$BACKEND_URL"
config["display"]["orientation"] = "$ORIENTATION"
config["display"]["rotation"] = int("$ROTATION")
config["cec"]["enabled"] = $CEC_ENABLED

with open("$CONFIG_FILE", "w") as f:
    yaml.dump(config, f, default_flow_style=False, sort_keys=False)

print("Configuration updated")
PYTHON_SCRIPT

    echo -e "${GREEN}[OK]${NC} Configuration saved"

    # Test connection
    echo ""
    echo -e "${BLUE}Testing connection to server...${NC}"

    if curl -s --connect-timeout 5 "${BACKEND_URL}/health" > /dev/null 2>&1; then
        echo -e "${GREEN}[OK]${NC} Server is reachable"
    else
        echo -e "${YELLOW}Warning: Could not reach server at $BACKEND_URL${NC}"
        echo "The daemon will retry when started"
    fi
}

# Print completion message
print_completion() {
    echo ""
    echo -e "${GREEN}========================================"
    echo "   Installation Complete!"
    echo "========================================${NC}"
    echo ""
    echo "GlowWorm v${VERSION} has been installed successfully."
    echo ""
    echo -e "${CYAN}Configuration file:${NC}"
    echo "  $CONFIG_DIR/config.yaml"
    echo ""
    echo -e "${CYAN}Quick Start:${NC}"
    echo ""
    echo "1. Start the daemon:"
    echo -e "   ${YELLOW}sudo systemctl start glowworm-daemon${NC}"
    echo ""
    echo "2. Enable automatic start on boot:"
    echo -e "   ${YELLOW}sudo systemctl enable glowworm-daemon${NC}"
    echo ""
    echo "3. Check status:"
    echo -e "   ${YELLOW}sudo systemctl status glowworm-daemon${NC}"
    echo ""
    echo "4. View logs:"
    echo -e "   ${YELLOW}sudo journalctl -u glowworm-daemon -f${NC}"
    echo ""
    echo -e "${CYAN}Device Registration:${NC}"
    echo "When the daemon starts, it will display a registration code."
    echo "Enter this code in your GlowWorm admin interface to authorize"
    echo "the device."
    echo ""

    if [ "$IS_PI" = true ]; then
        echo -e "${CYAN}Raspberry Pi Notes:${NC}"
        echo "- For best performance, ensure GPU memory is 128MB or higher"
        echo "- Check GPU memory: vcgencmd get_mem gpu"
        echo "- HDMI-CEC control can be enabled in config.yaml"
        echo ""
    fi
}

# Main installation flow
main() {
    print_banner
    check_root
    detect_system
    check_python
    check_systemd
    install_dependencies
    create_directories
    create_venv
    install_packages
    install_services
    create_default_config
    configure_gpu
    run_wizard
    print_completion
}

# Run main function
main "$@"
