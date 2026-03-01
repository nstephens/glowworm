#!/bin/bash
#
# GlowWorm v3.0 Uninstallation Script
# Removes all GlowWorm components
#
# Usage: sudo bash uninstall.sh
#

set -e

# Colors
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

# Print banner
echo -e "${CYAN}"
echo "========================================"
echo "   GlowWorm Uninstallation"
echo "========================================"
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root${NC}"
    echo "Please run: sudo bash uninstall.sh"
    exit 1
fi

# Confirmation
echo ""
echo -e "${YELLOW}This will remove GlowWorm and all its components.${NC}"
echo ""
echo "The following will be deleted:"
echo "  - Installation directory: $INSTALL_DIR"
echo "  - Systemd services"
echo "  - Executable symlinks"
echo ""
echo "The following can optionally be preserved:"
echo "  - Configuration: $CONFIG_DIR"
echo "  - State/cache: $STATE_DIR, $CACHE_DIR"
echo "  - Logs: $LOG_DIR"
echo ""
read -p "Continue with uninstallation? (y/n): " confirm

if [[ ! "$confirm" =~ ^[Yy] ]]; then
    echo "Uninstallation cancelled."
    exit 0
fi

# Stop services
echo ""
echo -e "${BLUE}Stopping services...${NC}"

if systemctl is-active --quiet glowworm-daemon 2>/dev/null; then
    systemctl stop glowworm-daemon
    echo "  Stopped glowworm-daemon"
fi

if systemctl is-enabled --quiet glowworm-daemon 2>/dev/null; then
    systemctl disable glowworm-daemon
    echo "  Disabled glowworm-daemon"
fi

echo -e "${GREEN}[OK]${NC} Services stopped"

# Remove systemd service files
echo ""
echo -e "${BLUE}Removing systemd services...${NC}"

if [ -f /etc/systemd/system/glowworm-daemon.service ]; then
    rm -f /etc/systemd/system/glowworm-daemon.service
    echo "  Removed glowworm-daemon.service"
fi

if [ -f /etc/tmpfiles.d/glowworm.conf ]; then
    rm -f /etc/tmpfiles.d/glowworm.conf
    echo "  Removed tmpfiles.d/glowworm.conf"
fi

systemctl daemon-reload
echo -e "${GREEN}[OK]${NC} Systemd services removed"

# Remove symlinks
echo ""
echo -e "${BLUE}Removing executable symlinks...${NC}"

for cmd in glowworm-daemon glowworm-display; do
    if [ -L "/usr/local/bin/$cmd" ]; then
        rm -f "/usr/local/bin/$cmd"
        echo "  Removed /usr/local/bin/$cmd"
    fi
done

echo -e "${GREEN}[OK]${NC} Symlinks removed"

# Remove installation directory
echo ""
echo -e "${BLUE}Removing installation directory...${NC}"

if [ -d "$INSTALL_DIR" ]; then
    rm -rf "$INSTALL_DIR"
    echo "  Removed $INSTALL_DIR"
fi

echo -e "${GREEN}[OK]${NC} Installation directory removed"

# Remove runtime directory
if [ -d "$RUN_DIR" ]; then
    rm -rf "$RUN_DIR"
    echo "  Removed $RUN_DIR"
fi

# Optional: Remove configuration
echo ""
read -p "Remove configuration? ($CONFIG_DIR) (y/n) [n]: " remove_config
if [[ "$remove_config" =~ ^[Yy] ]]; then
    if [ -d "$CONFIG_DIR" ]; then
        rm -rf "$CONFIG_DIR"
        echo -e "${GREEN}[OK]${NC} Configuration removed"
    fi
else
    echo "Configuration preserved at $CONFIG_DIR"
fi

# Optional: Remove state and cache
echo ""
read -p "Remove state and cache? ($STATE_DIR, $CACHE_DIR) (y/n) [n]: " remove_data
if [[ "$remove_data" =~ ^[Yy] ]]; then
    if [ -d "$STATE_DIR" ]; then
        rm -rf "$STATE_DIR"
        echo "  Removed $STATE_DIR"
    fi
    if [ -d "$CACHE_DIR" ]; then
        rm -rf "$CACHE_DIR"
        echo "  Removed $CACHE_DIR"
    fi
    echo -e "${GREEN}[OK]${NC} State and cache removed"
else
    echo "State and cache preserved"
fi

# Optional: Remove logs
echo ""
read -p "Remove logs? ($LOG_DIR) (y/n) [n]: " remove_logs
if [[ "$remove_logs" =~ ^[Yy] ]]; then
    if [ -d "$LOG_DIR" ]; then
        rm -rf "$LOG_DIR"
        echo -e "${GREEN}[OK]${NC} Logs removed"
    fi
else
    echo "Logs preserved at $LOG_DIR"
fi

# Completion message
echo ""
echo -e "${GREEN}========================================"
echo "   Uninstallation Complete"
echo "========================================${NC}"
echo ""
echo "GlowWorm has been removed from your system."
echo ""

# Note about GPU memory settings
if [ -f /boot/config.txt ] || [ -f /boot/firmware/config.txt ]; then
    echo -e "${YELLOW}Note:${NC} GPU memory settings in config.txt were not modified."
    echo "If you want to restore original GPU memory settings, edit:"
    if [ -f /boot/firmware/config.txt ]; then
        echo "  /boot/firmware/config.txt"
    else
        echo "  /boot/config.txt"
    fi
    echo ""
fi

echo "Thank you for using GlowWorm!"
