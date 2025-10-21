#!/bin/bash

# Glowworm Quick Start Script
# For end users to quickly deploy Glowworm with Docker

set -e

# Configuration
REPO_BASE="https://raw.githubusercontent.com/nstephens/glowworm/main"

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
    
    # Create .env from embedded template
    cat > .env << 'EOF'
# Glowworm Docker Environment Configuration
# 
# SECURITY WARNING: Do NOT use default passwords!
# Generate strong, random passwords for production use.
#
# Quick password generation:
#   openssl rand -base64 32
#   or use: https://passwordsgenerator.net/

# ===========================================
# MYSQL CONFIGURATION
# ===========================================
# REQUIRED: Replace with strong, unique passwords (minimum 20 characters)
MYSQL_ROOT_PASSWORD=CHANGE_ME_TO_STRONG_PASSWORD
MYSQL_PASSWORD=CHANGE_ME_TO_STRONG_PASSWORD

# Database settings
MYSQL_DATABASE=glowworm
MYSQL_USER=glowworm
MYSQL_HOST=glowworm-mysql
MYSQL_PORT=3306

# ===========================================
# BACKEND CONFIGURATION
# ===========================================
# REQUIRED: Generate a secure random secret key for JWT tokens
# Run: openssl rand -base64 32
SECRET_KEY=CHANGE_ME_TO_RANDOM_SECRET_KEY

# Server settings
# IMPORTANT: Set SERVER_BASE_URL to your server's IP address or domain
# Example: http://192.168.1.100:8001 or http://myserver.local:8001
SERVER_BASE_URL=http://localhost:8001
BACKEND_PORT=8001
FRONTEND_PORT=80

# Application settings
DEFAULT_DISPLAY_TIME_SECONDS=30
UPLOAD_DIRECTORY=uploads

# ===========================================
# NETWORK CONFIGURATION
# ===========================================
# Change these to your actual network interface IP if needed
# For local development, localhost should work fine
DISPLAY_NETWORK_INTERFACE=localhost

# ===========================================
# DEVELOPMENT SETTINGS (Optional)
# ===========================================
# Uncomment for development
# DEBUG=true
# LOG_LEVEL=DEBUG
EOF
    
    echo -e "${RED}⚠️  SECURITY CRITICAL: You must set secure passwords!${NC}"
    echo ""
    echo -e "${YELLOW}Generate secure passwords:${NC}"
    echo "  openssl rand -base64 32"
    echo ""
    echo -e "${YELLOW}REQUIRED changes in .env:${NC}"
    echo "  1. MYSQL_ROOT_PASSWORD - Replace CHANGE_ME_TO_STRONG_PASSWORD"
    echo "  2. MYSQL_PASSWORD - Replace CHANGE_ME_TO_STRONG_PASSWORD"
    echo "  3. SECRET_KEY - Replace CHANGE_ME_TO_RANDOM_SECRET_KEY"
    echo ""
    echo -e "${BLUE}Optional but RECOMMENDED for headless servers:${NC}"
    echo "  4. SERVER_BASE_URL - Set to your server's IP address"
    echo "     Example: http://192.168.1.100:8001"
    echo "  5. FRONTEND_PORT - Change if port 80 is in use"
    echo ""
    echo -e "${YELLOW}💡 Find your server's IP address:${NC}"
    echo "  hostname -I"
    echo ""
    echo -e "${BLUE}For headless servers:${NC}"
    echo "  Set SERVER_BASE_URL to http://YOUR_SERVER_IP:8001"
    echo "  This allows displays and clients to connect from other devices"
    echo ""
    
    # Open editor if available
    if command -v nano &> /dev/null; then
        read -p "Press Enter to edit .env with nano (or Ctrl+C to edit manually)..."
        nano .env
    elif command -v vi &> /dev/null; then
        read -p "Press Enter to edit .env with vi (or Ctrl+C to edit manually)..."
        vi .env
    else
        echo -e "${YELLOW}Please edit .env file manually with your text editor.${NC}"
        read -p "Press Enter after editing .env file..."
    fi
    
    echo ""
fi

# Validate .env has been edited
if grep -q "CHANGE_ME" .env; then
    echo -e "${RED}❌ SECURITY ERROR: .env file contains default placeholder values${NC}"
    echo ""
    echo "You MUST replace ALL placeholders in .env:"
    echo "  ❌ CHANGE_ME_TO_STRONG_PASSWORD"
    echo "  ❌ CHANGE_ME_TO_RANDOM_SECRET_KEY"
    echo ""
    echo "Generate secure passwords:"
    echo "  openssl rand -base64 32"
    echo ""
    echo "Glowworm will NOT start with default passwords for security reasons."
    exit 1
fi

# Additional validation for empty or weak passwords
if grep -qE "(MYSQL_ROOT_PASSWORD=|MYSQL_PASSWORD=|SECRET_KEY=)$" .env; then
    echo -e "${RED}❌ SECURITY ERROR: Empty password detected in .env${NC}"
    echo ""
    echo "All passwords must be set to strong, unique values."
    exit 1
fi

echo -e "${GREEN}✅ Configuration file ready${NC}"
echo ""

# Download required files if they don't exist
if [ ! -f docker-compose.yml ]; then
    echo -e "${YELLOW}📥 Downloading docker-compose.yml...${NC}"
    curl -sS -o docker-compose.yml "$REPO_BASE/docker-compose.yml"
fi

# Download docker config files if they don't exist
if [ ! -f docker/mysql/init.sql ]; then
    echo -e "${YELLOW}📥 Downloading docker configuration files...${NC}"
    mkdir -p docker/{mysql,nginx,scripts}
    curl -sS -o docker/mysql/init.sql "$REPO_BASE/docker/mysql/init.sql"
    curl -sS -o docker/nginx/frontend.conf "$REPO_BASE/docker/nginx/frontend.conf"
    curl -sS -o docker/scripts/wait-for-mysql.sh "$REPO_BASE/docker/scripts/wait-for-mysql.sh"
    chmod +x docker/scripts/wait-for-mysql.sh
    echo -e "${GREEN}✅ Configuration files downloaded${NC}"
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
    echo "   📱 From this server:    http://localhost"
    echo "   📱 From other devices:  http://$SERVER_IP"
    echo "   🔌 Direct API:          http://$SERVER_IP:8001/api"
else
    echo "   📱 Web Interface: http://localhost (if local)"
    echo "   📱 From network:  http://YOUR_SERVER_IP (replace with your server's IP)"
    echo "   🔌 Direct API:    http://YOUR_SERVER_IP:8001/api"
fi
echo ""
echo -e "${YELLOW}💡 For headless/remote servers:${NC}"
echo "   Find your server IP: ${GREEN}hostname -I${NC}"
echo "   Access from any device: ${GREEN}http://<SERVER_IP>${NC}"
echo ""
echo -e "${BLUE}📚 Next steps:${NC}"
echo "   1. Open the web interface in your browser"
echo "   2. Complete the setup wizard"
echo "   3. Create an admin account"
echo "   4. Upload images and create playlists"
echo "   5. Register display devices from any device on your network"
echo ""
echo -e "${BLUE}💡 Useful commands:${NC}"
echo "   View logs:    $DOCKER_COMPOSE -f $COMPOSE_FILE logs -f"
echo "   Stop:         $DOCKER_COMPOSE -f $COMPOSE_FILE down"
echo "   Restart:      $DOCKER_COMPOSE -f $COMPOSE_FILE restart"
echo "   Update:       $DOCKER_COMPOSE -f $COMPOSE_FILE pull && $DOCKER_COMPOSE -f $COMPOSE_FILE up -d"
echo ""
echo -e "${GREEN}🎉 Enjoy Glowworm!${NC}"
echo ""

