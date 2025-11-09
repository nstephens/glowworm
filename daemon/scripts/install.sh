#!/bin/bash
#
# Glowworm Display Device Daemon Installation Script
# For Raspberry Pi with FullPageOS
#
# Usage: curl -sSL <url> | sudo bash
#

set -e

echo "======================================"
echo "Glowworm Daemon Installation"
echo "======================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "❌ This script must be run as root"
  echo "   Please run: sudo bash install.sh"
  exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VER=$VERSION_ID
else
    echo "❌ Cannot detect OS"
    exit 1
fi

echo "✅ Detected OS: $OS $VER"

# Check Python version
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)
REQUIRED_VERSION="3.10"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$PYTHON_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Python $REQUIRED_VERSION or higher is required"
    echo "   Found: Python $PYTHON_VERSION"
    exit 1
fi

echo "✅ Python version: $PYTHON_VERSION"

# Install system dependencies
echo ""
echo "📦 Installing system dependencies..."

apt-get update -qq
apt-get install -y -qq \
    python3-pip \
    python3-venv \
    cec-utils \
    libcec6 \
    python3-cec \
    systemd

echo "✅ System dependencies installed"

# Install Python package
echo ""
echo "🐍 Installing Glowworm daemon Python package..."

pip3 install --upgrade pip
pip3 install glowworm-daemon

# Verify installation
if ! command -v glowworm-daemon &> /dev/null; then
    echo "⚠️  glowworm-daemon not found in PATH"
    echo "   Trying to link manually..."
    
    # Try to find it
    DAEMON_PATH=$(find /usr/local -name glowworm-daemon 2>/dev/null | head -1)
    if [ -n "$DAEMON_PATH" ]; then
        ln -sf "$DAEMON_PATH" /usr/local/bin/glowworm-daemon
        echo "✅ Created symlink to $DAEMON_PATH"
    else
        echo "❌ Could not find glowworm-daemon executable"
        exit 1
    fi
fi

echo "✅ Glowworm daemon installed"

# Run setup wizard
echo ""
echo "🔧 Running setup wizard..."
echo ""
echo "⚠️  IMPORTANT: When prompted for URL, use your Glowworm frontend URL"
echo "   Example: http://10.10.10.2:3003 (NOT the backend port 8001/8002)"
echo "   This should be the same URL you use to access the admin UI."
echo ""

glowworm-daemon-setup

# Check if setup completed successfully
if [ $? -eq 0 ]; then
    echo ""
    echo "======================================"
    echo "✅ Installation Complete!"
    echo "======================================"
    echo ""
    echo "The daemon has been installed and configured."
    echo ""
    echo "To start the daemon now:"
    echo "  sudo systemctl start glowworm-daemon"
    echo ""
    echo "To enable automatic start on boot:"
    echo "  sudo systemctl enable glowworm-daemon"
    echo ""
    echo "To check daemon status:"
    echo "  sudo systemctl status glowworm-daemon"
    echo ""
    echo "To view daemon logs:"
    echo "  sudo journalctl -u glowworm-daemon -f"
    echo ""
else
    echo ""
    echo "⚠️  Setup wizard did not complete successfully"
    echo "   You can run it again with: sudo glowworm-daemon-setup"
    echo ""
    exit 1
fi

