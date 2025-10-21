#!/bin/bash

# Glowworm Quick Start Script
# For end users to quickly deploy Glowworm with Docker

set -e

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
    
    if [ -f docker/env.example ]; then
        cp docker/env.example .env
    else
        # Create a minimal .env if example doesn't exist
        cat > .env << 'EOF'
# Glowworm Configuration
# IMPORTANT: Change these default passwords!

MYSQL_ROOT_PASSWORD=change_this_root_password
MYSQL_PASSWORD=change_this_app_password
SECRET_KEY=change_this_secret_key_to_something_random

MYSQL_DATABASE=glowworm
MYSQL_USER=glowworm
MYSQL_HOST=glowworm-mysql
MYSQL_PORT=3306

SERVER_BASE_URL=http://localhost
BACKEND_PORT=8001
FRONTEND_PORT=80

DEFAULT_DISPLAY_TIME_SECONDS=30
UPLOAD_DIRECTORY=uploads
DISPLAY_NETWORK_INTERFACE=localhost

LOG_LEVEL=INFO
EOF
    fi
    
    echo -e "${RED}⚠️  IMPORTANT: You must edit the .env file with secure passwords!${NC}"
    echo ""
    echo "Required changes in .env:"
    echo "  1. MYSQL_ROOT_PASSWORD - Set a strong password"
    echo "  2. MYSQL_PASSWORD - Set a strong password"
    echo "  3. SECRET_KEY - Set a random secret key"
    echo ""
    echo "Optional changes:"
    echo "  4. SERVER_BASE_URL - Set to your server's IP or domain"
    echo "  5. FRONTEND_PORT - Change if port 80 is in use"
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
if grep -q "change_this" .env; then
    echo -e "${RED}❌ Error: .env file still contains default passwords${NC}"
    echo ""
    echo "Please edit .env and replace:"
    echo "  - change_this_root_password"
    echo "  - change_this_app_password"
    echo "  - change_this_secret_key_to_something_random"
    echo ""
    echo "With strong, unique values."
    exit 1
fi

echo -e "${GREEN}✅ Configuration file ready${NC}"
echo ""

# Check which docker-compose file to use
if [ -f docker-compose.prod.yml ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
    echo -e "${BLUE}Using production configuration (pre-built images)${NC}"
elif [ -f docker-compose.yml ]; then
    COMPOSE_FILE="docker-compose.yml"
    echo -e "${BLUE}Using local configuration${NC}"
else
    echo -e "${RED}❌ No docker-compose file found${NC}"
    echo ""
    echo "Please download docker-compose.yml from:"
    echo "  https://raw.githubusercontent.com/yourusername/glowworm/main/docker-compose.prod.yml"
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
echo -e "${BLUE}🌐 Access the application:${NC}"
echo "   📱 Web Interface: http://localhost"
echo "   🔌 Direct API: http://localhost:8001/api"
echo ""
echo -e "${BLUE}📚 Next steps:${NC}"
echo "   1. Open http://localhost in your browser"
echo "   2. Complete the setup wizard"
echo "   3. Create an admin account"
echo "   4. Upload images and create playlists"
echo "   5. Register display devices"
echo ""
echo -e "${BLUE}💡 Useful commands:${NC}"
echo "   View logs:    $DOCKER_COMPOSE -f $COMPOSE_FILE logs -f"
echo "   Stop:         $DOCKER_COMPOSE -f $COMPOSE_FILE down"
echo "   Restart:      $DOCKER_COMPOSE -f $COMPOSE_FILE restart"
echo "   Update:       $DOCKER_COMPOSE -f $COMPOSE_FILE pull && $DOCKER_COMPOSE -f $COMPOSE_FILE up -d"
echo ""
echo -e "${GREEN}🎉 Enjoy Glowworm!${NC}"
echo ""

