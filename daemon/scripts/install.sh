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

# Check for systemd
echo ""
echo "🔍 Checking system requirements..."
if ! command -v systemctl &> /dev/null; then
    echo "❌ systemd is required but not found"
    echo "   This script requires systemd to manage the daemon service."
    echo "   Most Raspberry Pi OS installations have systemd by default."
    echo ""
    exit 1
fi
echo "✅ systemd detected"

# Install system dependencies
echo ""
echo "📦 Installing system dependencies..."

apt-get update -qq
apt-get install -y -qq \
    python3 \
    python3-venv \
    python3-full \
    cec-utils \
    libcec6 \
    python3-cec

echo "✅ System dependencies installed"

# Create installation directory
INSTALL_DIR="/opt/glowworm-daemon"
echo ""
echo "📁 Creating installation directory: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

# Create virtual environment
echo ""
echo "🐍 Creating Python virtual environment..."
python3 -m venv "$INSTALL_DIR/venv"
echo "✅ Virtual environment created"

# Install daemon package in venv
echo ""
echo "📦 Installing Glowworm daemon package..."
"$INSTALL_DIR/venv/bin/pip" install --upgrade pip
"$INSTALL_DIR/venv/bin/pip" install glowworm-daemon

# Create symlink to daemon executable
ln -sf "$INSTALL_DIR/venv/bin/glowworm-daemon" /usr/local/bin/glowworm-daemon
ln -sf "$INSTALL_DIR/venv/bin/glowworm-daemon-setup" /usr/local/bin/glowworm-daemon-setup

# Verify installation
if ! command -v glowworm-daemon &> /dev/null; then
    echo "❌ Installation failed - daemon executable not found"
    exit 1
fi

echo "✅ Glowworm daemon installed in virtual environment"

# Run setup wizard
echo ""
echo "🔧 Running setup wizard..."
echo ""
echo "⚠️  IMPORTANT: When prompted for URL, use your Glowworm frontend URL"
echo "   Example: http://10.10.10.2:3003 (NOT the backend port 8001/8002)"
echo "   This should be the same URL you use to access the admin UI."
echo ""

# Call setup directly through venv to ensure modules are found
"$INSTALL_DIR/venv/bin/glowworm-daemon-setup"

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
    echo "   You can run it again with: sudo $INSTALL_DIR/venv/bin/glowworm-daemon-setup"
    echo ""
    exit 1
fi

