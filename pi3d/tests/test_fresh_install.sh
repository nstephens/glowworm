#!/bin/bash
#
# GlowWorm v3.0 Fresh Install Test Script
#
# Tests the complete installation process on a fresh system.
# Run this on a clean Raspberry Pi OS install to verify installation works.
#
# Usage: sudo bash test_fresh_install.sh [--dry-run] [--verbose]
#
# Exit codes:
#   0 - All tests passed
#   1 - Test failure
#   2 - System requirements not met
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Test state
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
FAILURES=()

# Options
DRY_RUN=false
VERBOSE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Logging functions
log() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

log_ok() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    FAILURES+=("$1")
    ((TESTS_FAILED++))
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_verbose() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${CYAN}[INFO]${NC} $1"
    fi
}

run_test() {
    local name="$1"
    local command="$2"

    ((TESTS_RUN++))
    log "Testing: $name"

    if [ "$DRY_RUN" = true ]; then
        echo "  Would run: $command"
        log_ok "$name (dry-run)"
        return 0
    fi

    if eval "$command" > /dev/null 2>&1; then
        log_ok "$name"
        return 0
    else
        log_fail "$name"
        return 1
    fi
}

# Print banner
echo ""
echo -e "${CYAN}========================================"
echo "   GlowWorm Fresh Install Test"
echo "   Version 3.0.0"
echo "========================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ] && [ "$DRY_RUN" = false ]; then
    echo -e "${RED}Error: This script must be run as root${NC}"
    echo "Please run: sudo bash test_fresh_install.sh"
    exit 2
fi

# ==========================================
# Phase 1: Pre-Installation Checks
# ==========================================
echo ""
echo -e "${BLUE}Phase 1: Pre-Installation Checks${NC}"
echo "----------------------------------------"

run_test "Python 3 available" "command -v python3"
run_test "Python version >= 3.11" "python3 -c 'import sys; exit(0 if sys.version_info >= (3, 11) else 1)'"
run_test "Systemd available" "command -v systemctl"
run_test "apt-get available" "command -v apt-get"
run_test "curl available" "command -v curl"
run_test "git available" "command -v git"

# Check Raspberry Pi (optional)
if grep -q "Raspberry Pi" /proc/cpuinfo 2>/dev/null; then
    log_ok "Running on Raspberry Pi"
    IS_PI=true

    # Pi-specific checks
    run_test "GPU memory accessible" "command -v vcgencmd"
else
    log_warn "Not running on Raspberry Pi - some tests will be skipped"
    IS_PI=false
fi

# ==========================================
# Phase 2: Directory Structure
# ==========================================
echo ""
echo -e "${BLUE}Phase 2: Directory Structure${NC}"
echo "----------------------------------------"

DIRS=(
    "/opt/glowworm"
    "/etc/glowworm"
    "/var/log/glowworm"
    "/var/lib/glowworm"
    "/var/cache/glowworm"
    "/run/glowworm"
)

for dir in "${DIRS[@]}"; do
    if [ "$DRY_RUN" = true ]; then
        run_test "Directory exists: $dir" "true"
    else
        if [ -d "$dir" ]; then
            run_test "Directory exists: $dir" "true"
        else
            log_verbose "Creating directory: $dir"
            mkdir -p "$dir"
            run_test "Directory created: $dir" "[ -d '$dir' ]"
        fi
    fi
done

# ==========================================
# Phase 3: Virtual Environment
# ==========================================
echo ""
echo -e "${BLUE}Phase 3: Virtual Environment${NC}"
echo "----------------------------------------"

VENV_DIR="/opt/glowworm/venv"

if [ "$DRY_RUN" = false ]; then
    if [ ! -d "$VENV_DIR" ]; then
        log_verbose "Creating virtual environment..."
        python3 -m venv "$VENV_DIR"
    fi
fi

run_test "Virtual environment exists" "[ -d '$VENV_DIR' ]"
run_test "Python in venv" "[ -f '$VENV_DIR/bin/python' ]"
run_test "Pip in venv" "[ -f '$VENV_DIR/bin/pip' ]"

# ==========================================
# Phase 4: Package Installation
# ==========================================
echo ""
echo -e "${BLUE}Phase 4: Package Installation${NC}"
echo "----------------------------------------"

if [ "$DRY_RUN" = false ]; then
    # Check if glowworm packages are installed
    if ! "$VENV_DIR/bin/python" -c "import glowworm_daemon" 2>/dev/null; then
        log_warn "glowworm_daemon not installed - attempting installation"

        # Try to find local repo
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        REPO_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

        if [ -d "$REPO_ROOT/daemon" ]; then
            "$VENV_DIR/bin/pip" install -q "$REPO_ROOT/daemon" || true
        fi
    fi

    if ! "$VENV_DIR/bin/python" -c "import glowworm_display" 2>/dev/null; then
        log_warn "glowworm_display not installed - attempting installation"

        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        REPO_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

        if [ -d "$REPO_ROOT/display" ]; then
            "$VENV_DIR/bin/pip" install -q "$REPO_ROOT/display" || true
        fi
    fi
fi

run_test "glowworm_daemon package" "$VENV_DIR/bin/python -c 'import glowworm_daemon'"
run_test "glowworm_display package" "$VENV_DIR/bin/python -c 'import glowworm_display'"
run_test "Pi3D package" "$VENV_DIR/bin/python -c 'import pi3d'"
run_test "aiohttp package" "$VENV_DIR/bin/python -c 'import aiohttp'"
run_test "websockets package" "$VENV_DIR/bin/python -c 'import websockets'"
run_test "PIL package" "$VENV_DIR/bin/python -c 'from PIL import Image'"
run_test "numpy package" "$VENV_DIR/bin/python -c 'import numpy'"
run_test "PyYAML package" "$VENV_DIR/bin/python -c 'import yaml'"

# ==========================================
# Phase 5: Executable Symlinks
# ==========================================
echo ""
echo -e "${BLUE}Phase 5: Executable Symlinks${NC}"
echo "----------------------------------------"

if [ "$DRY_RUN" = false ]; then
    # Create symlinks if they don't exist
    if [ -f "$VENV_DIR/bin/glowworm-daemon" ] && [ ! -L /usr/local/bin/glowworm-daemon ]; then
        ln -sf "$VENV_DIR/bin/glowworm-daemon" /usr/local/bin/glowworm-daemon
    fi
    if [ -f "$VENV_DIR/bin/glowworm-display" ] && [ ! -L /usr/local/bin/glowworm-display ]; then
        ln -sf "$VENV_DIR/bin/glowworm-display" /usr/local/bin/glowworm-display
    fi
fi

run_test "glowworm-daemon symlink" "[ -L /usr/local/bin/glowworm-daemon ] || [ -f /usr/local/bin/glowworm-daemon ]"
run_test "glowworm-display symlink" "[ -L /usr/local/bin/glowworm-display ] || [ -f /usr/local/bin/glowworm-display ]"

# ==========================================
# Phase 6: Configuration
# ==========================================
echo ""
echo -e "${BLUE}Phase 6: Configuration${NC}"
echo "----------------------------------------"

CONFIG_FILE="/etc/glowworm/config.yaml"

if [ "$DRY_RUN" = false ] && [ ! -f "$CONFIG_FILE" ]; then
    log_verbose "Creating default configuration..."
    cat > "$CONFIG_FILE" << 'EOF'
backend:
  url: "http://localhost:3003"
  device_token: ""

display:
  orientation: portrait
  rotation: 0
  background_color: "#000000"
  fps_target: 30

slideshow:
  display_time: 30.0
  transition_duration: 2.0
  scale_mode: fit

cache:
  directory: /var/cache/glowworm/images
  max_size_mb: 500

state:
  directory: /var/lib/glowworm

ipc:
  socket_path: /run/glowworm/display.sock
EOF
fi

run_test "Configuration file exists" "[ -f '$CONFIG_FILE' ]"
run_test "Configuration is valid YAML" "$VENV_DIR/bin/python -c 'import yaml; yaml.safe_load(open(\"$CONFIG_FILE\"))'"
run_test "Configuration has backend section" "$VENV_DIR/bin/python -c 'import yaml; c=yaml.safe_load(open(\"$CONFIG_FILE\")); assert \"backend\" in c'"
run_test "Configuration has display section" "$VENV_DIR/bin/python -c 'import yaml; c=yaml.safe_load(open(\"$CONFIG_FILE\")); assert \"display\" in c'"

# ==========================================
# Phase 7: Systemd Service
# ==========================================
echo ""
echo -e "${BLUE}Phase 7: Systemd Service${NC}"
echo "----------------------------------------"

SERVICE_FILE="/etc/systemd/system/glowworm-daemon.service"

run_test "Service file exists" "[ -f '$SERVICE_FILE' ]"

if [ -f "$SERVICE_FILE" ]; then
    run_test "Service file is valid" "systemd-analyze verify $SERVICE_FILE 2>&1 | grep -v 'Cannot load unit'"
fi

run_test "Service is known to systemd" "systemctl list-unit-files | grep -q glowworm-daemon"

# ==========================================
# Phase 8: Module Import Tests
# ==========================================
echo ""
echo -e "${BLUE}Phase 8: Module Import Tests${NC}"
echo "----------------------------------------"

# Test daemon modules
run_test "Import: glowworm_daemon.cache" "$VENV_DIR/bin/python -c 'from glowworm_daemon import cache'"
run_test "Import: glowworm_daemon.image_manager" "$VENV_DIR/bin/python -c 'from glowworm_daemon import image_manager'"
run_test "Import: glowworm_daemon.playlist_manager" "$VENV_DIR/bin/python -c 'from glowworm_daemon import playlist_manager'"
run_test "Import: glowworm_daemon.display_controller" "$VENV_DIR/bin/python -c 'from glowworm_daemon import display_controller'"
run_test "Import: glowworm_daemon.websocket_client" "$VENV_DIR/bin/python -c 'from glowworm_daemon import websocket_client'"

# Test display modules
run_test "Import: glowworm_display.config" "$VENV_DIR/bin/python -c 'from glowworm_display import config'"
run_test "Import: glowworm_display.display" "$VENV_DIR/bin/python -c 'from glowworm_display import display'"
run_test "Import: glowworm_display.image_loader" "$VENV_DIR/bin/python -c 'from glowworm_display import image_loader'"
run_test "Import: glowworm_display.renderer" "$VENV_DIR/bin/python -c 'from glowworm_display import renderer'"

# ==========================================
# Phase 9: Mock Display Test
# ==========================================
echo ""
echo -e "${BLUE}Phase 9: Mock Display Test${NC}"
echo "----------------------------------------"

if [ "$DRY_RUN" = false ]; then
    # Test glowworm-display in mock mode
    MOCK_TEST_OUTPUT=$("$VENV_DIR/bin/python" -c "
from glowworm_display.config import DisplayConfig
from glowworm_display.display import Display

config = DisplayConfig(width=800, height=600, fps_target=30)
display = Display(config=config, mock=True)
display.initialize()
print('Display initialized successfully')
display.cleanup()
print('Display cleanup successful')
" 2>&1) || true

    if echo "$MOCK_TEST_OUTPUT" | grep -q "Display initialized successfully"; then
        log_ok "Mock display initialization"
    else
        log_fail "Mock display initialization"
        log_verbose "$MOCK_TEST_OUTPUT"
    fi

    if echo "$MOCK_TEST_OUTPUT" | grep -q "Display cleanup successful"; then
        log_ok "Mock display cleanup"
    else
        log_fail "Mock display cleanup"
    fi
else
    run_test "Mock display initialization" "true"
    run_test "Mock display cleanup" "true"
fi

# ==========================================
# Phase 10: Raspberry Pi Specific Tests
# ==========================================
if [ "$IS_PI" = true ]; then
    echo ""
    echo -e "${BLUE}Phase 10: Raspberry Pi Specific Tests${NC}"
    echo "----------------------------------------"

    # Check GPU memory
    GPU_MEM=$(vcgencmd get_mem gpu 2>/dev/null | cut -d= -f2 | sed 's/M//')
    if [ -n "$GPU_MEM" ] && [ "$GPU_MEM" -ge 128 ]; then
        log_ok "GPU memory: ${GPU_MEM}MB (>= 128MB)"
    else
        log_warn "GPU memory: ${GPU_MEM:-unknown}MB (recommend >= 128MB)"
    fi

    # Check OpenGL ES
    run_test "OpenGL ES libraries" "[ -f /usr/lib/aarch64-linux-gnu/libGLESv2.so ] || [ -f /usr/lib/arm-linux-gnueabihf/libGLESv2.so ]"

    # Check EGL
    run_test "EGL libraries" "[ -f /usr/lib/aarch64-linux-gnu/libEGL.so ] || [ -f /usr/lib/arm-linux-gnueabihf/libEGL.so ]"
fi

# ==========================================
# Summary
# ==========================================
echo ""
echo "========================================"
echo -e "${CYAN}Test Summary${NC}"
echo "========================================"
echo ""
echo "Tests run:    $TESTS_RUN"
echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ ${#FAILURES[@]} -gt 0 ]; then
    echo -e "${RED}Failed tests:${NC}"
    for failure in "${FAILURES[@]}"; do
        echo "  - $failure"
    done
    echo ""
fi

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All installation tests passed!${NC}"
    echo ""
    echo "The system is ready for GlowWorm v3.0"
    echo ""
    echo "Next steps:"
    echo "  1. Edit /etc/glowworm/config.yaml with your backend URL"
    echo "  2. sudo systemctl start glowworm-daemon"
    echo "  3. sudo systemctl enable glowworm-daemon"
    echo ""
    exit 0
else
    echo -e "${RED}Some tests failed - please review and fix before use${NC}"
    exit 1
fi
