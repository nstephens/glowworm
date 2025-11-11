#!/bin/bash

# Glowworm Quick Start Script
# For end users to quickly deploy Glowworm with Docker

set -e

# Configuration
REPO_BASE="https://raw.githubusercontent.com/nstephens/glowworm/unstable"

# Parse command line arguments
CLEAN_INSTALL=false
for arg in "$@"; do
    case $arg in
        --clean)
            CLEAN_INSTALL=true
            shift
            ;;
        --help|-h)
            echo "Glowworm Quick Start Script"
            echo ""
            echo "Usage: ./quick-start.sh [options]"
            echo ""
            echo "Options:"
            echo "  --clean    Delete existing data and .env for a fresh install"
            echo "  --help     Show this help message"
            echo ""
            exit 0
            ;;
    esac
done

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

clear
echo -e "${BLUE}"
echo "  ____  _                                      "
echo " / ___|_| | _____      ____      _____  _ __ _ __ ___  "
echo "| |  _| | |/ _ \ \ /\ / /\ \ /\ / / _ \| '__| '_ \` _ \ "
echo "| |_| | | | (_) \ V  V /  \ V  V / (_) | |  | | | | | |"
echo " \____|_|_|\___/ \_/\_/    \_/\_/ \___/|_|  |_| |_| |_|"
echo ""
echo -e "${NC}"
echo -e "${GREEN}🐛 Glowworm Digital Signage - Quick Start${NC}"
echo "========================================="
echo ""

# Handle clean install
if [ "$CLEAN_INSTALL" = true ]; then
    echo -e "${YELLOW}🧹 Clean install requested${NC}"
    echo ""
    
    # Stop containers if running
    if [ -f docker-compose.yml ]; then
        echo -e "${YELLOW}Stopping containers and removing volumes...${NC}"
        if command -v docker compose &> /dev/null; then
            DOCKER_COMPOSE="docker compose"
        else
            DOCKER_COMPOSE="docker-compose"
        fi
        $DOCKER_COMPOSE down -v 2>/dev/null || true
        echo -e "${GREEN}✅ Containers and volumes removed${NC}"
    fi
    
    # Delete uploads directory (bind mount)
    if [ -d data/uploads ]; then
        echo -e "${YELLOW}Deleting uploads directory...${NC}"
        rm -rf data/uploads 2>/dev/null || sudo rm -rf data/uploads
        echo -e "${GREEN}✅ Uploads directory deleted${NC}"
    fi
    
    # Delete .env file
    if [ -f .env ]; then
        echo -e "${YELLOW}Deleting .env file...${NC}"
        rm -f .env
        echo -e "${GREEN}✅ .env file deleted${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}✅ Clean install preparation complete${NC}"
    echo -e "${BLUE}Starting fresh installation...${NC}"
    echo ""
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    echo ""
    echo "Please install Docker first:"
    echo "  https://docs.docker.com/get-docker/"
    echo ""
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker compose &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
    echo ""
    echo "Docker Compose is required to run Glowworm."
    echo "It's usually included with Docker Desktop."
    echo ""
    exit 1
fi

# Use docker compose or docker-compose
if command -v docker compose &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

echo -e "${GREEN}✅ Docker is installed${NC}"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}📝 Creating configuration file (.env)...${NC}"
    echo ""
    echo -e "${BLUE}🔐 Generating secure passwords...${NC}"
    
    # Generate secure random passwords
    MYSQL_ROOT_PASS=$(openssl rand -base64 32)
    MYSQL_APP_PASS=$(openssl rand -base64 32)
    SECRET_KEY=$(openssl rand -base64 32)
    
    echo -e "${GREEN}✅ Passwords generated${NC}"
    echo ""
    
    # Detect network interfaces
    echo -e "${BLUE}🔍 Detecting network interfaces...${NC}"
    DETECTED_IPS=$(hostname -I 2>/dev/null || echo "")
    
    # Try to intelligently guess the best interface
    SUGGESTED_IP="localhost"
    if [ -n "$DETECTED_IPS" ]; then
        # Filter for typical LAN addresses, excluding Docker subnets
        for ip in $DETECTED_IPS; do
            # Check if it's a private IP and not a Docker default subnet
            if [[ $ip =~ ^192\.168\. ]] || [[ $ip =~ ^10\. ]] || [[ $ip =~ ^172\.(1[6-9]|2[0-9]|3[0-1])\. ]]; then
                # Exclude common Docker subnets
                if [[ ! $ip =~ ^172\.17\. ]] && [[ ! $ip =~ ^172\.18\. ]]; then
                    SUGGESTED_IP=$ip
                    break
                fi
            fi
        done
    fi
    
    echo -e "${GREEN}✅ Detected interfaces${NC}"
    echo ""
    
    # Create .env with generated passwords
    cat > .env << EOF
# Glowworm Docker Environment Configuration
# 
# Auto-generated secure passwords - DO NOT SHARE THIS FILE
# Generated: $(date)

# ===========================================
# 🌐 NETWORK CONFIGURATION - REVIEW THIS!
# ===========================================
# This is the IP address that display devices use to connect to Glowworm
# 
# Detected network interfaces on this server:
EOF

    # Add detected IPs as commented options
    if [ -n "$DETECTED_IPS" ]; then
        for ip in $DETECTED_IPS; do
            if [ "$ip" = "$SUGGESTED_IP" ]; then
                echo "# - $ip  ← Recommended (typical LAN address)" >> .env
            elif [[ $ip =~ ^127\. ]]; then
                echo "# - $ip  (localhost - only works on this machine)" >> .env
            elif [[ $ip =~ ^172\.17\. ]] || [[ $ip =~ ^172\.18\. ]]; then
                echo "# - $ip  (Docker network - not recommended)" >> .env
            else
                echo "# - $ip" >> .env
            fi
        done
    else
        echo "# (No interfaces detected - using localhost)" >> .env
    fi
    
    cat >> .env << EOF
#
# Choose the interface where display devices will connect:
DISPLAY_NETWORK_INTERFACE=$SUGGESTED_IP

# ===========================================
# ⚙️  ADVANCED SETTINGS (rarely need changes)
# ===========================================
# You probably don't need to change anything below this line unless you have
# specific requirements or are troubleshooting connection issues.

# ===========================================
# MYSQL CONFIGURATION
# ===========================================
# Secure passwords auto-generated
MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASS
MYSQL_PASSWORD=$MYSQL_APP_PASS

# Database settings (internal Docker network)
MYSQL_DATABASE=glowworm
MYSQL_USER=glowworm
MYSQL_HOST=glowworm-mysql
MYSQL_PORT=3306

# ===========================================
# BACKEND CONFIGURATION
# ===========================================
# Secure secret key auto-generated for JWT tokens
SECRET_KEY=$SECRET_KEY

# Server settings (internal use only - backend is not directly exposed)
# This is used internally by the backend for URL generation
# The frontend proxies all API requests, so displays connect via DISPLAY_NETWORK_INTERFACE above
SERVER_BASE_URL=http://localhost:8001
FRONTEND_PORT=3003

# Application settings
DEFAULT_DISPLAY_TIME_SECONDS=30
UPLOAD_DIRECTORY=uploads

# ===========================================
# DEVELOPMENT SETTINGS (Optional)
# ===========================================
# Uncomment for development/debugging
# DEBUG=true
# LOG_LEVEL=DEBUG
EOF
    
    echo -e "${GREEN}✅ Secure passwords generated and saved to .env${NC}"
    echo ""
    echo -e "${YELLOW}📝 Network Configuration:${NC}"
    echo ""
    if [ "$SUGGESTED_IP" != "localhost" ]; then
        echo -e "${GREEN}✅ Auto-detected network interface: $SUGGESTED_IP${NC}"
        echo "   This should work for display devices on your network."
        echo ""
        echo -e "${BLUE}If displays can't connect, you may need to update:${NC}"
        echo "   DISPLAY_NETWORK_INTERFACE in .env file"
        echo "   (See commented options at the top of .env)"
    else
        echo -e "${YELLOW}⚠️  Network interface set to 'localhost'${NC}"
        echo "   This only works if displays run on the same machine."
        echo ""
        echo -e "${BLUE}For remote displays, update in .env:${NC}"
        echo "   DISPLAY_NETWORK_INTERFACE - Set to your server's IP"
        echo "   (See detected interfaces at the top of .env)"
    fi
    echo ""
    
    # Open editor
    EDITOR="${EDITOR:-${VISUAL:-nano}}"
    
    if command -v $EDITOR &> /dev/null; then
        read -p "Press Enter to review/edit .env with $EDITOR (or Ctrl+C to skip)..."
        $EDITOR .env
    elif command -v nano &> /dev/null; then
        read -p "Press Enter to review/edit .env with nano (or Ctrl+C to skip)..."
        nano .env
    elif command -v vi &> /dev/null; then
        read -p "Press Enter to review/edit .env with vi (or Ctrl+C to skip)..."
        vi .env
    else
        echo -e "${YELLOW}No editor found. You can edit .env file manually if needed.${NC}"
        read -p "Press Enter to continue..."
    fi
    
    echo ""
fi

echo -e "${GREEN}✅ Configuration file ready${NC}"
echo ""

# Create uploads directory for image storage
# Note: MySQL and Redis use Docker named volumes (no directory needed)
echo -e "${YELLOW}📁 Creating uploads directory...${NC}"
mkdir -p data/uploads

echo -e "${GREEN}✅ Data directory created${NC}"
echo ""

# Download required files if they don't exist
if [ ! -f docker-compose.yml ]; then
    echo -e "${YELLOW}📥 Downloading docker-compose.yml...${NC}"
    curl -sS -o docker-compose.yml "$REPO_BASE/docker-compose.yml"
    echo -e "${GREEN}✅ docker-compose.yml downloaded${NC}"
fi

# Check which docker-compose file to use
if [ -f docker-compose.yml ]; then
    COMPOSE_FILE="docker-compose.yml"
    echo -e "${BLUE}Using docker-compose configuration${NC}"
else
    echo -e "${RED}❌ docker-compose.yml not found${NC}"
    exit 1
fi

echo ""

# Pull latest images
echo -e "${YELLOW}📥 Pulling latest Glowworm images...${NC}"
echo ""
$DOCKER_COMPOSE -f $COMPOSE_FILE pull

echo ""
echo -e "${GREEN}✅ Images downloaded${NC}"
echo ""

# Start services
echo -e "${YELLOW}🚀 Starting Glowworm...${NC}"
echo ""
$DOCKER_COMPOSE -f $COMPOSE_FILE up -d

echo ""

# Wait for services to be healthy
echo -e "${YELLOW}⏳ Waiting for services to start (this may take a minute)...${NC}"
sleep 5

# Check service status
echo ""
$DOCKER_COMPOSE -f $COMPOSE_FILE ps

echo ""
echo -e "${GREEN}✅ Glowworm is running!${NC}"
echo ""

# Detect server IP
SERVER_IP=$(hostname -I | awk '{print $1}')
if [ -z "$SERVER_IP" ]; then
    SERVER_IP="YOUR_SERVER_IP"
fi

echo -e "${BLUE}🌐 Access the application:${NC}"
if [ "$SERVER_IP" != "YOUR_SERVER_IP" ]; then
    echo "   📱 From this server:    http://localhost:3003"
    echo "   📱 From other devices:  http://$SERVER_IP:3003"
    echo ""
    echo -e "${YELLOW}💡 Backend API is internal only - displays connect via frontend${NC}"
else
    echo "   📱 Web Interface: http://localhost:3003 (if local)"
    echo "   📱 From network:  http://YOUR_SERVER_IP:3003 (replace with your server's IP)"
fi
echo ""
echo -e "${BLUE}📚 Next steps:${NC}"
echo "   1. Open the web interface in your browser"
echo "   2. Create an admin account (Docker auto-setup)"
echo "   3. Login with your admin credentials"
echo "   4. Upload images and create playlists"
echo "   5. Register display devices from any device on your network"
echo ""
echo -e "${BLUE}💾 Data Storage:${NC}"
echo "   Database:  Docker volume 'mysql_data' (managed by Docker)"
echo "   Redis:     Docker volume 'redis_data' (managed by Docker)"
echo "   Images:    ./data/uploads/"
echo "   Backup:    docker compose exec glowworm-mysql mysqldump -u root -p glowworm > backup.sql"
echo ""
echo -e "${BLUE}💡 Useful commands:${NC}"
echo "   View logs:    $DOCKER_COMPOSE -f $COMPOSE_FILE logs -f"
echo "   Stop:         $DOCKER_COMPOSE -f $COMPOSE_FILE down"
echo "   Restart:      $DOCKER_COMPOSE -f $COMPOSE_FILE restart"
echo "   Update:       $DOCKER_COMPOSE -f $COMPOSE_FILE pull && $DOCKER_COMPOSE -f $COMPOSE_FILE up -d"
echo ""
echo -e "${GREEN}🎉 Enjoy Glowworm!${NC}"
echo ""

