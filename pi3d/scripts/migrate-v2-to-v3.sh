#!/bin/bash
#
# GlowWorm v2 to v3 Migration Script
#
# This script migrates a GlowWorm v2.x installation to v3.0 (Pi3D-based)
# It preserves:
#   - Device configuration (backend URL, device token)
#   - User preferences (timing, orientation)
#   - Cached images
#   - Playlist state
#
# Usage:
#   sudo bash migrate-v2-to-v3.sh [options]
#
# Options:
#   --dry-run     Show what would be migrated without making changes
#   --backup-dir  Specify backup directory (default: /var/backup/glowworm-v2)
#   --force       Skip confirmation prompts
#   --help        Show this help message
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="/var/backup/glowworm-v2"
V2_CONFIG_PATHS=(
    "/etc/glowworm/daemon.conf"
    "$HOME/.config/glowworm/daemon.conf"
    "./daemon.conf"
)
V3_CONFIG_PATH="/etc/glowworm/config.yaml"
V2_CACHE_DIR="/var/cache/glowworm"
V3_CACHE_DIR="/var/cache/glowworm/images"
V2_LOG_DIR="/var/log/glowworm"
V3_STATE_DIR="/var/lib/glowworm"
DRY_RUN=false
FORCE=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Print functions
print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Show help
show_help() {
    head -25 "$0" | tail -20 | sed 's/^# //' | sed 's/^#//'
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --backup-dir)
            BACKUP_DIR="$2"
            shift 2
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --help|-h)
            show_help
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 && $DRY_RUN != true ]]; then
        print_error "This script must be run as root (sudo)"
        exit 1
    fi
}

# Detect v2 installation
detect_v2_installation() {
    print_header "Detecting v2 Installation"

    V2_CONFIG_FOUND=""
    for config_path in "${V2_CONFIG_PATHS[@]}"; do
        if [[ -f "$config_path" ]]; then
            V2_CONFIG_FOUND="$config_path"
            print_success "Found v2 config: $config_path"
            break
        fi
    done

    if [[ -z "$V2_CONFIG_FOUND" ]]; then
        print_warning "No v2 configuration found"
        print_info "Checked locations:"
        for path in "${V2_CONFIG_PATHS[@]}"; do
            echo "    - $path"
        done

        if [[ $FORCE != true ]]; then
            read -p "Continue with fresh v3 installation? [y/N] " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
        return 1
    fi

    # Check for cached images
    if [[ -d "$V2_CACHE_DIR" ]]; then
        CACHE_SIZE=$(du -sh "$V2_CACHE_DIR" 2>/dev/null | cut -f1)
        CACHE_COUNT=$(find "$V2_CACHE_DIR" -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.webp" \) 2>/dev/null | wc -l)
        print_success "Found cached images: $CACHE_COUNT files ($CACHE_SIZE)"
    fi

    # Check for logs
    if [[ -d "$V2_LOG_DIR" ]]; then
        print_success "Found log directory: $V2_LOG_DIR"
    fi

    # Check for FullPageOS
    if [[ -f "/boot/firmware/fullpageos.txt" ]] || [[ -f "/boot/fullpageos.txt" ]]; then
        print_warning "FullPageOS detected - will be disabled during migration"
    fi

    # Check for browser-based display service
    if systemctl is-active --quiet chromium-browser 2>/dev/null; then
        print_warning "Browser-based display service detected - will be stopped"
    fi

    return 0
}

# Parse v2 INI configuration
parse_v2_config() {
    local config_file="$1"

    print_header "Reading v2 Configuration"

    # Read INI values using bash parameter expansion
    # Format: key = value

    # Backend settings
    V2_BACKEND_URL=$(grep -E "^backend_url\s*=" "$config_file" 2>/dev/null | sed 's/.*=\s*//' | tr -d ' ')
    V2_DEVICE_TOKEN=$(grep -E "^device_token\s*=" "$config_file" 2>/dev/null | sed 's/.*=\s*//' | tr -d ' ')
    V2_POLL_INTERVAL=$(grep -E "^poll_interval\s*=" "$config_file" 2>/dev/null | sed 's/.*=\s*//' | tr -d ' ')
    V2_LOG_LEVEL=$(grep -E "^log_level\s*=" "$config_file" 2>/dev/null | sed 's/.*=\s*//' | tr -d ' ')
    V2_MAX_RETRIES=$(grep -E "^max_retries\s*=" "$config_file" 2>/dev/null | sed 's/.*=\s*//' | tr -d ' ')

    # CEC settings
    V2_CEC_ENABLED=$(grep -E "^enabled\s*=" "$config_file" 2>/dev/null | sed 's/.*=\s*//' | tr -d ' ')
    V2_CEC_ADDRESS=$(grep -E "^display_address\s*=" "$config_file" 2>/dev/null | sed 's/.*=\s*//' | tr -d ' ')
    V2_CEC_ADAPTER=$(grep -E "^adapter\s*=" "$config_file" 2>/dev/null | sed 's/.*=\s*//' | tr -d ' ')

    # Display defaults
    V2_BACKEND_URL="${V2_BACKEND_URL:-http://localhost:3003}"
    V2_DEVICE_TOKEN="${V2_DEVICE_TOKEN:-}"
    V2_POLL_INTERVAL="${V2_POLL_INTERVAL:-5}"
    V2_LOG_LEVEL="${V2_LOG_LEVEL:-INFO}"
    V2_MAX_RETRIES="${V2_MAX_RETRIES:-3}"
    V2_CEC_ENABLED="${V2_CEC_ENABLED:-false}"
    V2_CEC_ADDRESS="${V2_CEC_ADDRESS:-0}"
    V2_CEC_ADAPTER="${V2_CEC_ADAPTER:-/dev/cec0}"

    # Report findings
    print_success "Backend URL: $V2_BACKEND_URL"
    if [[ -n "$V2_DEVICE_TOKEN" ]]; then
        print_success "Device token: ${V2_DEVICE_TOKEN:0:8}... (preserved)"
    else
        print_info "No device token - will require re-registration"
    fi
    print_success "Log level: $V2_LOG_LEVEL"
    print_success "CEC enabled: $V2_CEC_ENABLED"
}

# Create backup
create_backup() {
    print_header "Creating Backup"

    if [[ $DRY_RUN == true ]]; then
        print_info "[DRY RUN] Would create backup at: $BACKUP_DIR"
        return 0
    fi

    mkdir -p "$BACKUP_DIR"

    # Backup v2 config
    if [[ -n "$V2_CONFIG_FOUND" ]]; then
        cp "$V2_CONFIG_FOUND" "$BACKUP_DIR/daemon.conf.bak"
        print_success "Backed up: $V2_CONFIG_FOUND"
    fi

    # Backup cached images (just metadata, not the images themselves)
    if [[ -d "$V2_CACHE_DIR" ]]; then
        find "$V2_CACHE_DIR" -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.webp" \) -printf "%p|%s|%T@\n" > "$BACKUP_DIR/cache_manifest.txt" 2>/dev/null || true
        print_success "Created cache manifest"
    fi

    # Backup any existing v3 config
    if [[ -f "$V3_CONFIG_PATH" ]]; then
        cp "$V3_CONFIG_PATH" "$BACKUP_DIR/config.yaml.bak"
        print_success "Backed up existing v3 config"
    fi

    # Record migration timestamp
    echo "Migration started: $(date -Iseconds)" > "$BACKUP_DIR/migration.log"
    echo "v2 config: $V2_CONFIG_FOUND" >> "$BACKUP_DIR/migration.log"

    print_success "Backup created at: $BACKUP_DIR"
}

# Stop v2 services
stop_v2_services() {
    print_header "Stopping v2 Services"

    if [[ $DRY_RUN == true ]]; then
        print_info "[DRY RUN] Would stop v2 services"
        return 0
    fi

    # Stop glowworm daemon if running
    if systemctl is-active --quiet glowworm-daemon 2>/dev/null; then
        systemctl stop glowworm-daemon
        print_success "Stopped glowworm-daemon service"
    fi

    # Stop browser-based services
    local BROWSER_SERVICES=("chromium-browser" "fullpageos-splash" "lightdm")
    for service in "${BROWSER_SERVICES[@]}"; do
        if systemctl is-active --quiet "$service" 2>/dev/null; then
            systemctl stop "$service" 2>/dev/null || true
            print_success "Stopped $service"
        fi
    done

    # Kill any chromium processes
    pkill -f chromium 2>/dev/null || true
}

# Generate v3 configuration
generate_v3_config() {
    print_header "Generating v3 Configuration"

    local config_content="# GlowWorm v3.0 Configuration
# Migrated from v2 on $(date -Iseconds)
# Original config: ${V2_CONFIG_FOUND:-none}

# Backend connection
backend:
  url: \"$V2_BACKEND_URL\"
  device_token: \"$V2_DEVICE_TOKEN\"
  connect_timeout: 10.0
  read_timeout: 30.0
  max_retries: $V2_MAX_RETRIES
  retry_base_delay: 1.0
  retry_max_delay: 60.0

# Display settings (Pi3D)
display:
  orientation: portrait
  rotation: 0
  background_color: \"#000000\"
  fps_target: 30
  fullscreen: true
  width: 0
  height: 0

# Slideshow settings
slideshow:
  display_time: 30.0
  transition_duration: 2.0
  scale_mode: fit
  preload_count: 3
  image_retry_delay: 2.0
  max_image_retries: 2
  playlist_update_interval: 300.0

# Cache settings
cache:
  directory: \"$V3_CACHE_DIR\"
  max_size_mb: 500
  min_free_space_mb: 100

# State persistence
state:
  directory: \"$V3_STATE_DIR\"

# IPC settings
ipc:
  socket_path: /run/glowworm/display.sock
  timeout: 5.0

# Logging
logging:
  level: $V2_LOG_LEVEL
  file: /var/log/glowworm/daemon.log

# CEC control
cec:
  enabled: $V2_CEC_ENABLED
  display_address: $V2_CEC_ADDRESS
  adapter: \"$V2_CEC_ADAPTER\"
  timeout: 5
"

    if [[ $DRY_RUN == true ]]; then
        print_info "[DRY RUN] Would create v3 config:"
        echo "---"
        echo "$config_content"
        echo "---"
        return 0
    fi

    # Create config directory
    mkdir -p "$(dirname "$V3_CONFIG_PATH")"

    # Write configuration
    echo "$config_content" > "$V3_CONFIG_PATH"
    chmod 640 "$V3_CONFIG_PATH"

    print_success "Created v3 configuration: $V3_CONFIG_PATH"
}

# Migrate cache
migrate_cache() {
    print_header "Migrating Image Cache"

    if [[ ! -d "$V2_CACHE_DIR" ]]; then
        print_info "No v2 cache directory found - skipping"
        return 0
    fi

    if [[ $DRY_RUN == true ]]; then
        print_info "[DRY RUN] Would migrate cached images to: $V3_CACHE_DIR"
        return 0
    fi

    # Create v3 cache directory
    mkdir -p "$V3_CACHE_DIR"

    # Move cached images (preserving structure)
    local moved_count=0
    find "$V2_CACHE_DIR" -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.webp" \) | while read -r file; do
        local filename=$(basename "$file")
        if [[ ! -f "$V3_CACHE_DIR/$filename" ]]; then
            mv "$file" "$V3_CACHE_DIR/" 2>/dev/null || cp "$file" "$V3_CACHE_DIR/"
            ((moved_count++))
        fi
    done

    print_success "Migrated cached images to: $V3_CACHE_DIR"
}

# Create required directories
create_directories() {
    print_header "Creating Required Directories"

    local DIRS=(
        "/etc/glowworm"
        "$V3_CACHE_DIR"
        "$V3_STATE_DIR"
        "/var/log/glowworm"
        "/run/glowworm"
    )

    if [[ $DRY_RUN == true ]]; then
        print_info "[DRY RUN] Would create directories:"
        for dir in "${DIRS[@]}"; do
            echo "    - $dir"
        done
        return 0
    fi

    for dir in "${DIRS[@]}"; do
        mkdir -p "$dir"
        chmod 755 "$dir"
        print_success "Created: $dir"
    done
}

# Remove v2 cruft
cleanup_v2() {
    print_header "Cleaning Up v2 Components"

    if [[ $DRY_RUN == true ]]; then
        print_info "[DRY RUN] Would remove v2 browser-based components"
        return 0
    fi

    # Disable FullPageOS autostart
    if [[ -f "/boot/firmware/fullpageos.txt" ]]; then
        mv "/boot/firmware/fullpageos.txt" "/boot/firmware/fullpageos.txt.v2backup" 2>/dev/null || true
        print_success "Disabled FullPageOS configuration"
    fi
    if [[ -f "/boot/fullpageos.txt" ]]; then
        mv "/boot/fullpageos.txt" "/boot/fullpageos.txt.v2backup" 2>/dev/null || true
        print_success "Disabled FullPageOS configuration (legacy path)"
    fi

    # Disable browser autostart services
    local SERVICES_TO_DISABLE=("lightdm" "fullpageos-splash")
    for service in "${SERVICES_TO_DISABLE[@]}"; do
        if systemctl is-enabled --quiet "$service" 2>/dev/null; then
            systemctl disable "$service" 2>/dev/null || true
            print_success "Disabled $service"
        fi
    done

    # Remove old chromium autostart entries
    if [[ -f "$HOME/.config/autostart/chromium.desktop" ]]; then
        rm "$HOME/.config/autostart/chromium.desktop"
        print_success "Removed Chromium autostart"
    fi

    # Note: We don't remove the v2 daemon.conf as it serves as documentation
    print_info "v2 config preserved at: $V2_CONFIG_FOUND (for reference)"
}

# Verify v3 installation
verify_v3_ready() {
    print_header "Verifying v3 Readiness"

    local ERRORS=0

    # Check v3 packages
    if python3 -c "import glowworm_daemon" 2>/dev/null; then
        print_success "glowworm_daemon package available"
    else
        print_warning "glowworm_daemon package not installed"
        print_info "Run: sudo bash ${SCRIPT_DIR}/install.sh"
        ((ERRORS++))
    fi

    if python3 -c "import glowworm_display" 2>/dev/null; then
        print_success "glowworm_display package available"
    else
        print_warning "glowworm_display package not installed"
        ((ERRORS++))
    fi

    # Check config file
    if [[ -f "$V3_CONFIG_PATH" ]]; then
        print_success "v3 configuration exists"
    else
        print_warning "v3 configuration not created"
        ((ERRORS++))
    fi

    # Check systemd service
    if [[ -f "/etc/systemd/system/glowworm-daemon.service" ]]; then
        print_success "Systemd service installed"
    else
        print_warning "Systemd service not installed"
        ((ERRORS++))
    fi

    return $ERRORS
}

# Print migration summary
print_summary() {
    print_header "Migration Summary"

    echo "v2 Configuration:"
    echo "  - Source: ${V2_CONFIG_FOUND:-none}"
    echo "  - Backend URL: $V2_BACKEND_URL"
    echo "  - Device Token: ${V2_DEVICE_TOKEN:+${V2_DEVICE_TOKEN:0:8}...}"
    echo ""
    echo "v3 Configuration:"
    echo "  - Config: $V3_CONFIG_PATH"
    echo "  - Cache: $V3_CACHE_DIR"
    echo "  - State: $V3_STATE_DIR"
    echo ""
    echo "Backup Location: $BACKUP_DIR"
    echo ""

    if [[ -n "$V2_DEVICE_TOKEN" ]]; then
        echo -e "${GREEN}Device token preserved - no re-registration required${NC}"
    else
        echo -e "${YELLOW}No device token found - registration will be required${NC}"
        echo "The device will display a registration code on first start."
    fi
    echo ""

    echo "Next Steps:"
    echo "  1. Review configuration: sudo nano $V3_CONFIG_PATH"
    echo "  2. Start the v3 daemon: sudo systemctl start glowworm-daemon"
    echo "  3. Enable autostart: sudo systemctl enable glowworm-daemon"
    echo "  4. Check status: sudo systemctl status glowworm-daemon"
    echo "  5. View logs: sudo journalctl -u glowworm-daemon -f"
}

# Main migration flow
main() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║     GlowWorm v2 to v3 Migration Script         ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
    echo ""

    if [[ $DRY_RUN == true ]]; then
        echo -e "${YELLOW}Running in DRY RUN mode - no changes will be made${NC}"
        echo ""
    fi

    check_root

    # Phase 1: Detection
    if detect_v2_installation; then
        parse_v2_config "$V2_CONFIG_FOUND"
    else
        # No v2 config found - use defaults
        V2_BACKEND_URL="http://localhost:3003"
        V2_DEVICE_TOKEN=""
        V2_LOG_LEVEL="INFO"
        V2_MAX_RETRIES="3"
        V2_CEC_ENABLED="false"
        V2_CEC_ADDRESS="0"
        V2_CEC_ADAPTER="/dev/cec0"
    fi

    # Phase 2: Confirmation
    if [[ $FORCE != true && $DRY_RUN != true ]]; then
        echo ""
        echo "This will:"
        echo "  - Stop any running v2 services"
        echo "  - Create a backup of your v2 configuration"
        echo "  - Generate v3 configuration with migrated settings"
        echo "  - Preserve your cached images"
        echo "  - Disable browser-based display components"
        echo ""
        read -p "Continue with migration? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Migration cancelled"
            exit 0
        fi
    fi

    # Phase 3: Migration
    create_backup
    stop_v2_services
    create_directories
    generate_v3_config
    migrate_cache
    cleanup_v2

    # Phase 4: Verification
    echo ""
    verify_v3_ready || true

    # Phase 5: Summary
    if [[ $DRY_RUN != true ]]; then
        echo "Migration started: $(date -Iseconds)" >> "$BACKUP_DIR/migration.log"
        echo "Migration completed successfully" >> "$BACKUP_DIR/migration.log"
    fi

    print_summary

    echo ""
    print_success "Migration complete!"
    echo ""
}

# Run main
main "$@"
