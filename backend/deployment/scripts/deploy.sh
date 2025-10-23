#!/bin/bash
# GlowWorm Deployment Script
# This script automates the deployment of GlowWorm to a production server

set -euo pipefail

# Configuration
APP_NAME="glowworm"
APP_USER="glowworm"
APP_DIR="/opt/glowworm"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
SERVICE_NAME="glowworm-api"
NGINX_SITE="glowworm"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_error "This script should not be run as root"
        exit 1
    fi
}

# Check if user has sudo privileges
check_sudo() {
    if ! sudo -n true 2>/dev/null; then
        log_error "This script requires sudo privileges"
        exit 1
    fi
}

# Create application user
create_user() {
    log_info "Creating application user: $APP_USER"
    
    if ! id "$APP_USER" &>/dev/null; then
        sudo useradd --system --shell /bin/bash --home-dir "$APP_DIR" --create-home "$APP_USER"
        log_success "Created user: $APP_USER"
    else
        log_info "User $APP_USER already exists"
    fi
}

# Install system dependencies
install_dependencies() {
    log_info "Installing system dependencies"
    
    sudo apt-get update
    sudo apt-get install -y \
        python3 \
        python3-pip \
        python3-venv \
        python3-dev \
        nginx \
        mysql-server \
        git \
        curl \
        wget \
        unzip \
        build-essential \
        libssl-dev \
        libffi-dev \
        libjpeg-dev \
        libpng-dev \
        libfreetype6-dev \
        liblcms2-dev \
        libwebp-dev \
        tcl8.6-dev \
        tk8.6-dev \
        python3-tk \
        libharfbuzz-dev \
        libfribidi-dev \
        libxcb1-dev
    
    log_success "System dependencies installed"
}

# Setup application directory
setup_app_directory() {
    log_info "Setting up application directory: $APP_DIR"
    
    sudo mkdir -p "$APP_DIR"
    sudo chown "$APP_USER:$APP_USER" "$APP_DIR"
    
    # Create necessary subdirectories
    sudo -u "$APP_USER" mkdir -p "$BACKEND_DIR"/{uploads,logs,.taskmaster}
    sudo -u "$APP_USER" mkdir -p "$FRONTEND_DIR"
    
    log_success "Application directory setup complete"
}

# Deploy backend
deploy_backend() {
    log_info "Deploying backend application"
    
    # Copy backend files
    sudo cp -r backend/* "$BACKEND_DIR/"
    sudo chown -R "$APP_USER:$APP_USER" "$BACKEND_DIR"
    
    # Create virtual environment
    sudo -u "$APP_USER" python3 -m venv "$BACKEND_DIR/venv"
    
    # Install Python dependencies
    sudo -u "$APP_USER" "$BACKEND_DIR/venv/bin/pip" install --upgrade pip
    sudo -u "$APP_USER" "$BACKEND_DIR/venv/bin/pip" install -r "$BACKEND_DIR/requirements.txt"
    
    log_success "Backend deployment complete"
}

# Deploy frontend
deploy_frontend() {
    log_info "Deploying frontend application"
    
    if [[ -d "frontend/dist" ]]; then
        sudo cp -r frontend/dist/* "$FRONTEND_DIR/"
        sudo chown -R "$APP_USER:$APP_USER" "$FRONTEND_DIR"
        log_success "Frontend deployment complete"
    else
        log_warning "Frontend dist directory not found. Please build the frontend first."
    fi
}

# Setup systemd service
setup_systemd() {
    log_info "Setting up systemd service"
    
    sudo cp deployment/systemd/glowworm-api.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable "$SERVICE_NAME"
    
    log_success "Systemd service configured"
}

# Setup nginx
setup_nginx() {
    log_info "Setting up nginx configuration"
    
    sudo cp deployment/nginx/glowworm.conf "/etc/nginx/sites-available/$NGINX_SITE"
    sudo ln -sf "/etc/nginx/sites-available/$NGINX_SITE" "/etc/nginx/sites-enabled/"
    
    # Remove default nginx site if it exists
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Test nginx configuration
    sudo nginx -t
    
    log_success "Nginx configuration complete"
}

# Setup database
setup_database() {
    log_info "Setting up database"
    
    # Create database and user
    sudo mysql -e "CREATE DATABASE IF NOT EXISTS glowworm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    sudo mysql -e "CREATE USER IF NOT EXISTS 'glowworm'@'localhost' IDENTIFIED BY 'glowworm_password';"
    sudo mysql -e "GRANT ALL PRIVILEGES ON glowworm.* TO 'glowworm'@'localhost';"
    sudo mysql -e "FLUSH PRIVILEGES;"
    
    log_success "Database setup complete"
}

# Create environment configuration
create_env_config() {
    log_info "Creating environment configuration"
    
    cat > "$BACKEND_DIR/.env" << EOF
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=glowworm
DB_USER=glowworm
DB_PASSWORD=glowworm_password

# Application Configuration
SECRET_KEY=$(openssl rand -hex 32)
UPLOAD_PATH=/opt/glowworm/backend/uploads
MAX_FILE_SIZE=104857600
ALLOWED_ORIGINS=http://localhost:3003,http://127.0.0.1:3003,http://10.10.10.2:3003

# AI Model Configuration (optional)
# ANTHROPIC_API_KEY=your_key_here
# OPENAI_API_KEY=your_key_here
# PERPLEXITY_API_KEY=your_key_here
EOF
    
    sudo chown "$APP_USER:$APP_USER" "$BACKEND_DIR/.env"
    sudo chmod 600 "$BACKEND_DIR/.env"
    
    log_success "Environment configuration created"
}

# Start services
start_services() {
    log_info "Starting services"
    
    sudo systemctl start "$SERVICE_NAME"
    sudo systemctl restart nginx
    
    # Wait for service to start
    sleep 5
    
    if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
        log_success "Services started successfully"
    else
        log_error "Failed to start services"
        sudo systemctl status "$SERVICE_NAME"
        exit 1
    fi
}

# Main deployment function
main() {
    log_info "Starting GlowWorm deployment"
    
    check_root
    check_sudo
    
    create_user
    install_dependencies
    setup_app_directory
    deploy_backend
    deploy_frontend
    setup_database
    create_env_config
    setup_systemd
    setup_nginx
    start_services
    
    log_success "GlowWorm deployment completed successfully!"
    log_info "Application is available at: http://localhost"
    log_info "API documentation: http://localhost/docs"
    log_info "Health check: http://localhost/health"
    
    echo
    log_info "Useful commands:"
    echo "  sudo systemctl status $SERVICE_NAME    # Check service status"
    echo "  sudo systemctl restart $SERVICE_NAME   # Restart service"
    echo "  sudo journalctl -u $SERVICE_NAME -f    # View logs"
    echo "  sudo nginx -t                          # Test nginx config"
    echo "  sudo systemctl reload nginx            # Reload nginx"
}

# Run main function
main "$@"








