#!/bin/bash
#
# Glowworm Daemon Installation Script for Display Devices
# Automatically configures daemon using display device's existing authorization
#
# Usage (on Raspberry Pi display device):
#   curl -sSL https://raw.githubusercontent.com/nstephens/glowworm/unstable/daemon/scripts/install-on-display.sh | sudo bash
#
# This script:
# - Detects if already authorized as display device
# - Auto-extracts server URL and device token from browser cookies
# - Installs daemon without manual configuration
# - Perfect for display devices already showing slideshows
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║     Glowworm Daemon - Display Device Installation         ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}❌ This script must be run as root${NC}"
  echo "   Please run: sudo bash install-on-display.sh"
  exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VER=$VERSION_ID
else
    echo -e "${RED}❌ Cannot detect OS${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Detected OS: $OS $VER${NC}"

# Detect if Raspberry Pi
IS_PI=false
if grep -q "Raspberry Pi" /proc/cpuinfo 2>/dev/null; then
    IS_PI=true
    PI_MODEL=$(cat /proc/cpuinfo | grep "Model" | cut -d: -f2 | xargs)
    echo -e "${GREEN}✅ Raspberry Pi detected: $PI_MODEL${NC}"
else
    echo -e "${YELLOW}⚠️  Not a Raspberry Pi - CEC may not work${NC}"
fi

# Check Python version
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)
REQUIRED_VERSION="3.10"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$PYTHON_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo -e "${RED}❌ Python $REQUIRED_VERSION or higher is required${NC}"
    echo "   Found: Python $PYTHON_VERSION"
    exit 1
fi

echo -e "${GREEN}✅ Python version: $PYTHON_VERSION${NC}"
echo ""

# Try to auto-detect device token from browser
echo -e "${BLUE}🔍 Attempting to auto-detect device token from browser...${NC}"
echo ""

TOKEN_DETECTED=false
DEVICE_TOKEN=""

# Check for Chromium cookie database
CHROMIUM_COOKIES_PATHS=(
    "/home/pi/.config/chromium/Default/Cookies"
    "/home/$SUDO_USER/.config/chromium/Default/Cookies"
    "/root/.config/chromium/Default/Cookies"
)

for COOKIE_PATH in "${CHROMIUM_COOKIES_PATHS[@]}"; do
    if [ -f "$COOKIE_PATH" ]; then
        echo -e "${YELLOW}Found Chromium cookies: $COOKIE_PATH${NC}"
        
        # Try to extract device_token cookie using sqlite3
        if command -v sqlite3 &> /dev/null; then
            # Get device token from cookie
            DEVICE_TOKEN=$(sqlite3 "$COOKIE_PATH" "SELECT value FROM cookies WHERE name='device_token' LIMIT 1;" 2>/dev/null || echo "")
            
            if [ -n "$DEVICE_TOKEN" ]; then
                echo -e "${GREEN}✅ Device token found: $DEVICE_TOKEN${NC}"
                echo ""
                TOKEN_DETECTED=true
                break
            fi
        else
            echo -e "${YELLOW}   sqlite3 not installed, cannot read cookies${NC}"
        fi
    fi
done

if [ "$TOKEN_DETECTED" = false ]; then
    echo -e "${YELLOW}⚠️  Could not auto-detect device token${NC}"
    echo "   This is normal if:"
    echo "   - Browser not running as Glowworm display"
    echo "   - Device not yet authorized"
    echo "   - Different browser used"
    echo ""
fi

# Install system dependencies
echo -e "${BLUE}📦 Installing system dependencies...${NC}"

# Install sqlite3 for future cookie reading
apt-get update -qq
apt-get install -y -qq \
    python3 \
    python3-venv \
    python3-full \
    cec-utils \
    libcec6 \
    python3-cec \
    systemd \
    sqlite3 \
    curl

echo -e "${GREEN}✅ System dependencies installed${NC}"

# Create installation directory
INSTALL_DIR="/opt/glowworm-daemon"
echo ""
echo -e "${BLUE}📁 Creating installation directory: $INSTALL_DIR${NC}"
mkdir -p "$INSTALL_DIR"

# Create virtual environment
echo ""
echo -e "${BLUE}🐍 Creating Python virtual environment...${NC}"
python3 -m venv "$INSTALL_DIR/venv"
echo -e "${GREEN}✅ Virtual environment created${NC}"

# Install daemon package in venv
echo ""
echo -e "${BLUE}📦 Installing Glowworm daemon package...${NC}"
"$INSTALL_DIR/venv/bin/pip" install --quiet --upgrade pip
"$INSTALL_DIR/venv/bin/pip" install --quiet glowworm-daemon

# Create symlink to daemon executable
ln -sf "$INSTALL_DIR/venv/bin/glowworm-daemon" /usr/local/bin/glowworm-daemon
ln -sf "$INSTALL_DIR/venv/bin/glowworm-daemon-setup" /usr/local/bin/glowworm-daemon-setup

# Verify installation
if ! command -v glowworm-daemon &> /dev/null; then
    echo -e "${RED}❌ Installation failed - daemon executable not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Glowworm daemon installed${NC}"
echo ""

# Configuration
if [ "$TOKEN_DETECTED" = true ]; then
    echo -e "${BLUE}🔧 Semi-automatic configuration (token detected)...${NC}"
    echo ""
    echo -e "${GREEN}✅ Device token detected: $DEVICE_TOKEN${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  Server URL needed${NC}"
    echo "   Enter your Glowworm frontend URL (same as admin UI)"
    echo "   Example: http://10.10.10.2:3003"
    echo "   NOT the backend port (8001/8002)"
    echo ""
    
    # Prompt for server URL
    read -p "Server URL: " SERVER_URL
    
    # Validate URL format
    if [[ ! "$SERVER_URL" =~ ^https?:// ]]; then
        echo -e "${RED}❌ Invalid URL format (must start with http:// or https://)${NC}"
        exit 1
    fi
    
    # Create config directory
    mkdir -p /etc/glowworm
    
    # Create configuration file
    cat > /etc/glowworm/daemon.conf << EOF
[daemon]
# Semi-auto configured: Token from browser, URL from user
backend_url = $SERVER_URL
device_token = $DEVICE_TOKEN
poll_interval = 30
log_level = INFO

[cec]
enabled = true
display_address = 0
adapter = /dev/cec0

[fullpageos]
config_path = /boot/firmware/fullpageos.txt
EOF
    
    echo ""
    echo -e "${GREEN}✅ Configuration file created: /etc/glowworm/daemon.conf${NC}"
    echo ""
    echo -e "${BLUE}📋 Configuration:${NC}"
    echo "   Server: $SERVER_URL"
    echo "   Device Token: $DEVICE_TOKEN"
    echo "   CEC Enabled: Yes"
    echo ""
    
    # Create systemd service
    cat > /etc/systemd/system/glowworm-daemon.service << EOF
[Unit]
Description=Glowworm Display Device Daemon
After=network.target

[Service]
Type=simple
User=root
ExecStart=/opt/glowworm-daemon/venv/bin/python3 -m glowworm_daemon.main
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    
    echo -e "${GREEN}✅ Systemd service configured${NC}"
    echo ""
    
else
    # Run interactive setup wizard
    echo -e "${BLUE}🔧 Running interactive setup wizard...${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  IMPORTANT: When prompted for URL, use your Glowworm frontend URL${NC}"
    echo "   Example: http://10.10.10.2:3003 (NOT the backend port 8001/8002)"
    echo "   This should be the same URL you use to access the admin UI."
    echo ""
    echo -e "${YELLOW}⚠️  Device Token: Find in Admin Panel → Displays → Your Device${NC}"
    echo ""
    
    read -p "Press Enter to continue to setup wizard..."
    
    glowworm-daemon-setup
    
    if [ $? -ne 0 ]; then
        echo ""
        echo -e "${YELLOW}⚠️  Setup wizard did not complete successfully${NC}"
        echo "   You can run it again with: sudo glowworm-daemon-setup"
        echo ""
        exit 1
    fi
fi

# Test CEC if on Raspberry Pi
if [ "$IS_PI" = true ]; then
    echo -e "${BLUE}🔍 Testing HDMI CEC...${NC}"
    
    if command -v cec-client &> /dev/null; then
        # Try to scan for CEC devices
        CEC_SCAN=$(echo 'scan' | timeout 5 cec-client -s -d 1 2>/dev/null || echo "")
        
        if echo "$CEC_SCAN" | grep -q "device #0"; then
            echo -e "${GREEN}✅ CEC device detected!${NC}"
            echo "$CEC_SCAN" | grep "device #0" | head -3
        else
            echo -e "${YELLOW}⚠️  No CEC devices detected${NC}"
            echo "   This could mean:"
            echo "   - TV/display doesn't support CEC"
            echo "   - CEC not enabled on TV"
            echo "   - HDMI cable not connected"
            echo "   - TV is off"
            echo ""
            echo "   Daemon will still install but CEC may not work."
            echo "   Check TV settings for 'HDMI-CEC' or brand-specific name."
        fi
    fi
    echo ""
fi

# Final steps
echo -e "${GREEN}======================================"
echo "✅ Installation Complete!"
echo "======================================${NC}"
echo ""
echo -e "${BLUE}Daemon installed successfully!${NC}"
echo ""

if [ "$TOKEN_DETECTED" = true ]; then
    echo -e "${GREEN}✨ Semi-automatic configuration successful!${NC}"
    echo "   (Device token extracted from browser)"
    echo ""
fi

echo -e "${YELLOW}📋 Next Steps:${NC}"
echo ""
echo "1. Start the daemon:"
echo -e "   ${BLUE}sudo systemctl start glowworm-daemon${NC}"
echo ""
echo "2. Enable automatic start on boot:"
echo -e "   ${BLUE}sudo systemctl enable glowworm-daemon${NC}"
echo ""
echo "3. Check daemon status:"
echo -e "   ${BLUE}sudo systemctl status glowworm-daemon${NC}"
echo ""
echo "4. View daemon logs:"
echo -e "   ${BLUE}sudo journalctl -u glowworm-daemon -f${NC}"
echo ""
echo "5. Verify in admin panel:"
echo "   - Navigate to Displays page"
echo "   - Find your display"
echo "   - Daemon status should show: Connected (green)"
echo ""

if [ "$IS_PI" = true ]; then
    echo -e "${YELLOW}💡 Raspberry Pi Tips:${NC}"
    echo "   - Ensure TV's HDMI-CEC is enabled in TV settings"
    echo "   - Test power commands: Admin Panel → Displays → Power On/Off"
    echo "   - Check CEC: echo 'scan' | cec-client -s -d 1"
    echo ""
fi

echo -e "${GREEN}Installation complete! Enjoy your enhanced Glowworm display! 🐛✨${NC}"
echo ""

