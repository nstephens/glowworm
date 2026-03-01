#!/bin/bash
#
# GlowWorm v3.0 Configuration Wizard
# Interactive configuration for Pi3D display
#
# Usage: sudo bash configure.sh
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Paths
CONFIG_DIR="/etc/glowworm"
CONFIG_FILE="$CONFIG_DIR/config.yaml"
INSTALL_DIR="/opt/glowworm"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root${NC}"
    echo "Please run: sudo bash configure.sh"
    exit 1
fi

# Check if GlowWorm is installed
if [ ! -d "$INSTALL_DIR/venv" ]; then
    echo -e "${RED}Error: GlowWorm is not installed${NC}"
    echo "Please run install.sh first"
    exit 1
fi

# Print banner
echo -e "${CYAN}"
echo "========================================"
echo "   GlowWorm Configuration Wizard"
echo "========================================"
echo -e "${NC}"

# Create config directory if needed
mkdir -p "$CONFIG_DIR"

# Load existing config if present
BACKEND_URL=""
ORIENTATION="portrait"
ROTATION="0"
DISPLAY_TIME="30"
TRANSITION_DURATION="2"
CEC_ENABLED="false"
CACHE_MAX_SIZE="500"

if [ -f "$CONFIG_FILE" ]; then
    echo -e "${BLUE}Loading existing configuration...${NC}"

    # Parse existing values using Python
    eval $("$INSTALL_DIR/venv/bin/python" << 'PYTHON_SCRIPT'
import yaml
import os

config_file = "/etc/glowworm/config.yaml"
if os.path.exists(config_file):
    with open(config_file, "r") as f:
        config = yaml.safe_load(f) or {}

    backend = config.get("backend", {})
    display = config.get("display", {})
    slideshow = config.get("slideshow", {})
    cec = config.get("cec", {})
    cache = config.get("cache", {})

    print(f'BACKEND_URL="{backend.get("url", "")}"')
    print(f'ORIENTATION="{display.get("orientation", "portrait")}"')
    print(f'ROTATION="{display.get("rotation", 0)}"')
    print(f'DISPLAY_TIME="{slideshow.get("display_time", 30)}"')
    print(f'TRANSITION_DURATION="{slideshow.get("transition_duration", 2)}"')
    print(f'CEC_ENABLED="{str(cec.get("enabled", False)).lower()}"')
    print(f'CACHE_MAX_SIZE="{cache.get("max_size_mb", 500)}"')
PYTHON_SCRIPT
)

    echo -e "${GREEN}[OK]${NC} Configuration loaded"
fi

# Menu function
show_menu() {
    echo ""
    echo -e "${CYAN}Configuration Menu${NC}"
    echo "========================================"
    echo "1) Server URL:           $BACKEND_URL"
    echo "2) Display Orientation:  $ORIENTATION"
    echo "3) Display Rotation:     ${ROTATION}°"
    echo "4) Image Display Time:   ${DISPLAY_TIME}s"
    echo "5) Transition Duration:  ${TRANSITION_DURATION}s"
    echo "6) HDMI-CEC Control:     $CEC_ENABLED"
    echo "7) Cache Size:           ${CACHE_MAX_SIZE}MB"
    echo "----------------------------------------"
    echo "s) Save and exit"
    echo "t) Test connection"
    echo "r) Reset to defaults"
    echo "q) Quit without saving"
    echo ""
}

# Configure backend URL
configure_backend() {
    echo ""
    echo -e "${BLUE}Backend Server URL${NC}"
    echo "Enter the URL of your GlowWorm server."
    echo "This is the URL you use to access the admin interface."
    echo "Example: http://192.168.1.100:3003"
    echo ""
    read -p "URL [$BACKEND_URL]: " input
    if [ -n "$input" ]; then
        BACKEND_URL="$input"
    fi
}

# Configure orientation
configure_orientation() {
    echo ""
    echo -e "${BLUE}Display Orientation${NC}"
    echo "Choose the display orientation:"
    echo "  1) portrait"
    echo "  2) landscape"
    echo ""
    read -p "Selection [$ORIENTATION]: " input
    case "$input" in
        1) ORIENTATION="portrait" ;;
        2) ORIENTATION="landscape" ;;
        portrait|landscape) ORIENTATION="$input" ;;
        "") ;;  # Keep current
        *) echo -e "${YELLOW}Invalid selection${NC}" ;;
    esac
}

# Configure rotation
configure_rotation() {
    echo ""
    echo -e "${BLUE}Display Rotation${NC}"
    echo "Choose the display rotation (degrees):"
    echo "  0) No rotation"
    echo "  90) 90° clockwise"
    echo "  180) Upside down"
    echo "  270) 90° counter-clockwise"
    echo ""
    read -p "Rotation [$ROTATION]: " input
    case "$input" in
        0|90|180|270) ROTATION="$input" ;;
        "") ;;  # Keep current
        *) echo -e "${YELLOW}Invalid rotation${NC}" ;;
    esac
}

# Configure display time
configure_display_time() {
    echo ""
    echo -e "${BLUE}Image Display Time${NC}"
    echo "How long to display each image (in seconds)."
    echo "Recommended: 20-60 seconds"
    echo ""
    read -p "Display time [$DISPLAY_TIME]: " input
    if [ -n "$input" ]; then
        if [[ "$input" =~ ^[0-9]+$ ]] && [ "$input" -ge 5 ]; then
            DISPLAY_TIME="$input"
        else
            echo -e "${YELLOW}Invalid value (must be at least 5)${NC}"
        fi
    fi
}

# Configure transition duration
configure_transition() {
    echo ""
    echo -e "${BLUE}Transition Duration${NC}"
    echo "Duration of the cross-fade between images (in seconds)."
    echo "Recommended: 1-5 seconds"
    echo ""
    read -p "Transition duration [$TRANSITION_DURATION]: " input
    if [ -n "$input" ]; then
        if [[ "$input" =~ ^[0-9.]+$ ]]; then
            TRANSITION_DURATION="$input"
        else
            echo -e "${YELLOW}Invalid value${NC}"
        fi
    fi
}

# Configure CEC
configure_cec() {
    echo ""
    echo -e "${BLUE}HDMI-CEC Control${NC}"
    echo "Enable HDMI-CEC to control TV/monitor power?"
    echo "This allows the daemon to turn the display on/off."
    echo ""
    read -p "Enable CEC? (y/n) [$CEC_ENABLED]: " input
    case "$input" in
        [Yy]|yes) CEC_ENABLED="true" ;;
        [Nn]|no) CEC_ENABLED="false" ;;
        "") ;;  # Keep current
    esac
}

# Configure cache size
configure_cache() {
    echo ""
    echo -e "${BLUE}Cache Size${NC}"
    echo "Maximum size of the image cache (in MB)."
    echo "Larger cache means more images stored locally."
    echo "Recommended: 500-2000MB depending on SD card size"
    echo ""
    read -p "Cache size [$CACHE_MAX_SIZE]: " input
    if [ -n "$input" ]; then
        if [[ "$input" =~ ^[0-9]+$ ]] && [ "$input" -ge 100 ]; then
            CACHE_MAX_SIZE="$input"
        else
            echo -e "${YELLOW}Invalid value (must be at least 100)${NC}"
        fi
    fi
}

# Test connection
test_connection() {
    echo ""
    echo -e "${BLUE}Testing connection to $BACKEND_URL ...${NC}"

    if [ -z "$BACKEND_URL" ]; then
        echo -e "${YELLOW}No backend URL configured${NC}"
        return
    fi

    # Try to connect
    if curl -s --connect-timeout 5 "$BACKEND_URL/health" > /dev/null 2>&1; then
        echo -e "${GREEN}[OK]${NC} Server is reachable"
    else
        echo -e "${YELLOW}Warning: Could not reach server${NC}"
        echo "Please check the URL and ensure the server is running"
    fi
}

# Reset to defaults
reset_defaults() {
    echo ""
    read -p "Reset all settings to defaults? (y/n): " input
    if [[ "$input" =~ ^[Yy] ]]; then
        BACKEND_URL="http://localhost:3003"
        ORIENTATION="portrait"
        ROTATION="0"
        DISPLAY_TIME="30"
        TRANSITION_DURATION="2"
        CEC_ENABLED="false"
        CACHE_MAX_SIZE="500"
        echo -e "${GREEN}[OK]${NC} Settings reset to defaults"
    fi
}

# Save configuration
save_config() {
    echo ""
    echo -e "${BLUE}Saving configuration...${NC}"

    # Create/update config file using Python
    "$INSTALL_DIR/venv/bin/python" << PYTHON_SCRIPT
import yaml
import os

config = {
    "backend": {
        "url": "$BACKEND_URL",
        "device_token": "",
    },
    "display": {
        "orientation": "$ORIENTATION",
        "rotation": int("$ROTATION"),
        "background_color": "#000000",
        "fps_target": 30,
        "fullscreen": True,
    },
    "slideshow": {
        "display_time": float("$DISPLAY_TIME"),
        "transition_duration": float("$TRANSITION_DURATION"),
        "scale_mode": "fit",
        "preload_count": 3,
    },
    "cache": {
        "directory": "/var/cache/glowworm/images",
        "max_size_mb": int("$CACHE_MAX_SIZE"),
        "min_free_space_mb": 100,
    },
    "state": {
        "directory": "/var/lib/glowworm",
    },
    "ipc": {
        "socket_path": "/run/glowworm/display.sock",
        "timeout": 5.0,
    },
    "logging": {
        "level": "INFO",
        "file": "/var/log/glowworm/daemon.log",
    },
    "cec": {
        "enabled": ${CEC_ENABLED:-false},
        "display_address": 0,
        "adapter": "/dev/cec0",
        "timeout": 5,
    },
}

# Try to preserve device_token from existing config
config_file = "$CONFIG_FILE"
if os.path.exists(config_file):
    try:
        with open(config_file, "r") as f:
            old_config = yaml.safe_load(f) or {}
        old_token = old_config.get("backend", {}).get("device_token", "")
        if old_token:
            config["backend"]["device_token"] = old_token
            print(f"Preserved device token: {old_token[:8]}...")
    except Exception:
        pass

with open(config_file, "w") as f:
    yaml.dump(config, f, default_flow_style=False, sort_keys=False)

os.chmod(config_file, 0o600)
print("Configuration saved to", config_file)
PYTHON_SCRIPT

    echo -e "${GREEN}[OK]${NC} Configuration saved"

    # Offer to restart daemon if running
    if systemctl is-active --quiet glowworm-daemon; then
        echo ""
        read -p "Restart daemon to apply changes? (y/n): " input
        if [[ "$input" =~ ^[Yy] ]]; then
            systemctl restart glowworm-daemon
            echo -e "${GREEN}[OK]${NC} Daemon restarted"
        fi
    fi
}

# Main menu loop
while true; do
    show_menu
    read -p "Select option: " choice

    case "$choice" in
        1) configure_backend ;;
        2) configure_orientation ;;
        3) configure_rotation ;;
        4) configure_display_time ;;
        5) configure_transition ;;
        6) configure_cec ;;
        7) configure_cache ;;
        s|S)
            save_config
            echo ""
            echo -e "${GREEN}Configuration complete!${NC}"
            exit 0
            ;;
        t|T) test_connection ;;
        r|R) reset_defaults ;;
        q|Q)
            echo "Exiting without saving..."
            exit 0
            ;;
        *)
            echo -e "${YELLOW}Invalid option${NC}"
            ;;
    esac
done
