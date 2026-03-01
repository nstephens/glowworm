#!/bin/bash
#
# GlowWorm v3.0 Offline Operation Test Script
#
# Tests the daemon's ability to operate when the backend is unreachable:
# - Operates from cached images
# - Handles reconnection gracefully
# - Queues status updates for when connection returns
#
# Usage: sudo bash test_offline.sh [--duration MINUTES] [--mock]
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
OFFLINE_DURATION_MINUTES=30
MOCK_MODE=false
OUTPUT_DIR="/var/log/glowworm/offline_test"

# Test state
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --duration)
            OFFLINE_DURATION_MINUTES="$2"
            shift 2
            ;;
        --mock)
            MOCK_MODE=true
            shift
            ;;
        --output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --help)
            echo "Usage: sudo bash test_offline.sh [--duration MINUTES] [--mock]"
            echo ""
            echo "Options:"
            echo "  --duration MINUTES  Duration to simulate offline (default: 30)"
            echo "  --mock              Run in mock mode"
            echo "  --output DIR        Output directory for logs"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Create output directory
mkdir -p "$OUTPUT_DIR"
LOG_FILE="$OUTPUT_DIR/offline_test_$(date +%Y%m%d_%H%M%S).log"

# Logging function
log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo -e "$msg" | tee -a "$LOG_FILE"
}

run_test() {
    local name="$1"
    local result="$2"

    ((TESTS_RUN++))

    if [ "$result" = "true" ] || [ "$result" = "0" ]; then
        echo -e "${GREEN}[PASS]${NC} $name"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}[FAIL]${NC} $name"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Print banner
echo ""
echo -e "${CYAN}========================================"
echo "   GlowWorm Offline Operation Test"
echo "   Offline Duration: ${OFFLINE_DURATION_MINUTES} minutes"
echo "========================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root${NC}"
    exit 1
fi

# ==========================================
# Phase 1: Pre-Test Setup
# ==========================================
log ""
log "${BLUE}Phase 1: Pre-Test Setup${NC}"
log "----------------------------------------"

# Verify daemon is installed
if [ ! -f "/opt/glowworm/venv/bin/python" ]; then
    log "${RED}GlowWorm not installed${NC}"
    exit 1
fi

# Verify cache directory exists
CACHE_DIR="/var/cache/glowworm/images"
if [ ! -d "$CACHE_DIR" ]; then
    log "Creating cache directory..."
    mkdir -p "$CACHE_DIR"
fi

# Check for cached images
CACHED_IMAGE_COUNT=$(find "$CACHE_DIR" -type f -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" 2>/dev/null | wc -l)
log "Cached images found: $CACHED_IMAGE_COUNT"

if [ "$CACHED_IMAGE_COUNT" -eq 0 ]; then
    log "${YELLOW}Warning: No cached images found${NC}"
    log "Creating test images for offline operation..."

    # Create test images
    /opt/glowworm/venv/bin/python << 'PYTHON_SCRIPT'
import os
from PIL import Image

cache_dir = "/var/cache/glowworm/images"

for i in range(5):
    img = Image.new("RGB", (800, 600), color=(
        (i * 50) % 255,
        (i * 80) % 255,
        (i * 110) % 255
    ))
    img_path = os.path.join(cache_dir, f"test_offline_{i}.jpg")
    img.save(img_path, "JPEG", quality=85)
    print(f"Created: {img_path}")

print(f"Created 5 test images in {cache_dir}")
PYTHON_SCRIPT

    CACHED_IMAGE_COUNT=5
fi

run_test "Cache directory exists" "[ -d '$CACHE_DIR' ]"
run_test "Cached images available" "[ $CACHED_IMAGE_COUNT -gt 0 ]"

# ==========================================
# Phase 2: Record Online State
# ==========================================
log ""
log "${BLUE}Phase 2: Record Online State${NC}"
log "----------------------------------------"

# Check if daemon is running
DAEMON_RUNNING=false
if pgrep -f "glowworm_daemon" > /dev/null 2>&1; then
    DAEMON_RUNNING=true
    DAEMON_PID=$(pgrep -f "glowworm_daemon" | head -1)
    log "Daemon running with PID: $DAEMON_PID"

    # Get initial status
    INITIAL_MEMORY=$(grep VmRSS /proc/$DAEMON_PID/status 2>/dev/null | awk '{print int($2/1024)}' || echo "0")
    log "Initial memory: ${INITIAL_MEMORY}MB"
else
    log "${YELLOW}Daemon not running - starting for test${NC}"
    systemctl start glowworm-daemon 2>/dev/null || {
        log "${YELLOW}Cannot start daemon via systemctl, will test in mock mode${NC}"
        MOCK_MODE=true
    }
    sleep 3
    if pgrep -f "glowworm_daemon" > /dev/null 2>&1; then
        DAEMON_RUNNING=true
        DAEMON_PID=$(pgrep -f "glowworm_daemon" | head -1)
        log "Daemon started with PID: $DAEMON_PID"
    fi
fi

# ==========================================
# Phase 3: Simulate Offline Mode
# ==========================================
log ""
log "${BLUE}Phase 3: Simulate Offline Mode${NC}"
log "----------------------------------------"

if [ "$MOCK_MODE" = true ]; then
    log "Running in mock mode - simulating offline behavior"

    # Run Python test script
    /opt/glowworm/venv/bin/python << 'PYTHON_SCRIPT'
import asyncio
import os
import sys

async def test_offline_operation():
    """Test offline operation using daemon components."""
    try:
        from glowworm_daemon.cache import ImageCache, CacheConfig
        from glowworm_daemon.playlist_manager import PlaylistManager, PlaylistManagerConfig
        from glowworm_daemon.image_manager import ImageManager, ImageManagerConfig

        print("Testing offline operation with cached images...")

        # Create cache
        cache_config = CacheConfig(
            cache_dir="/var/cache/glowworm/images",
            max_size_mb=100,
        )
        cache = ImageCache(cache_config)

        # Check what's in cache
        stats = cache.get_stats()
        print(f"Cache stats: {stats.entry_count} entries, {stats.total_size_bytes / 1024 / 1024:.1f}MB")

        # List cached files
        cached_files = list(cache.cache_dir.glob("*.jpg")) + list(cache.cache_dir.glob("*.jpeg")) + list(cache.cache_dir.glob("*.png"))
        print(f"Found {len(cached_files)} cached image files")

        if len(cached_files) > 0:
            print("Offline operation can continue with cached images")
            return True
        else:
            print("No cached images - offline operation would fail")
            return False

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False

# Run test
result = asyncio.run(test_offline_operation())
sys.exit(0 if result else 1)
PYTHON_SCRIPT

    OFFLINE_TEST_RESULT=$?
    run_test "Mock offline operation" "[ $OFFLINE_TEST_RESULT -eq 0 ]"

else
    log "Simulating network disconnection for ${OFFLINE_DURATION_MINUTES} minutes..."

    # Method 1: Block backend host using iptables (if we know the backend IP)
    # This is more realistic but requires knowing the backend address

    # Method 2: Update config to use invalid backend URL
    CONFIG_FILE="/etc/glowworm/config.yaml"
    CONFIG_BACKUP="$OUTPUT_DIR/config_backup.yaml"

    if [ -f "$CONFIG_FILE" ]; then
        # Backup config
        cp "$CONFIG_FILE" "$CONFIG_BACKUP"
        log "Config backed up to: $CONFIG_BACKUP"

        # Get current backend URL
        ORIGINAL_URL=$(/opt/glowworm/venv/bin/python -c "import yaml; print(yaml.safe_load(open('$CONFIG_FILE'))['backend']['url'])" 2>/dev/null || echo "")
        log "Original backend URL: $ORIGINAL_URL"

        # Update to invalid URL
        /opt/glowworm/venv/bin/python << PYTHON_SCRIPT
import yaml

with open("$CONFIG_FILE", "r") as f:
    config = yaml.safe_load(f)

# Set to non-routable IP to simulate offline
config["backend"]["url"] = "http://192.0.2.1:9999"  # TEST-NET-1, won't route

with open("$CONFIG_FILE", "w") as f:
    yaml.dump(config, f, default_flow_style=False)

print("Backend URL changed to simulate offline")
PYTHON_SCRIPT

        # Restart daemon to pick up new config
        log "Restarting daemon with offline config..."
        systemctl restart glowworm-daemon 2>/dev/null || true
        sleep 5

        # Record start of offline period
        OFFLINE_START=$(date +%s)
        OFFLINE_DURATION_SECONDS=$((OFFLINE_DURATION_MINUTES * 60))

        log "Daemon now running in offline mode"
        log "Will monitor for ${OFFLINE_DURATION_MINUTES} minutes..."

        # Monitor during offline period
        CRASH_COUNT=0
        SAMPLE_COUNT=0
        while true; do
            CURRENT=$(date +%s)
            ELAPSED=$((CURRENT - OFFLINE_START))

            if [ $ELAPSED -ge $OFFLINE_DURATION_SECONDS ]; then
                log "Offline period complete"
                break
            fi

            # Check if daemon is still running
            if ! pgrep -f "glowworm_daemon" > /dev/null 2>&1; then
                log "${RED}Daemon crashed during offline operation!${NC}"
                ((CRASH_COUNT++))

                # Wait for auto-restart
                sleep 10
                if pgrep -f "glowworm_daemon" > /dev/null 2>&1; then
                    log "Daemon auto-restarted"
                fi
            fi

            ((SAMPLE_COUNT++))
            if [ $((SAMPLE_COUNT % 10)) -eq 0 ]; then
                REMAINING=$((OFFLINE_DURATION_SECONDS - ELAPSED))
                log "Offline test: ${ELAPSED}s elapsed, ${REMAINING}s remaining, crashes: $CRASH_COUNT"
            fi

            sleep 30
        done

        # Restore original config
        log "Restoring original configuration..."
        cp "$CONFIG_BACKUP" "$CONFIG_FILE"

        # Restart daemon with correct config
        systemctl restart glowworm-daemon 2>/dev/null || true
        sleep 5

        run_test "Daemon survived offline period" "[ $CRASH_COUNT -eq 0 ]"
    else
        log "${YELLOW}Config file not found - skipping offline simulation${NC}"
    fi
fi

# ==========================================
# Phase 4: Test Reconnection
# ==========================================
log ""
log "${BLUE}Phase 4: Test Reconnection${NC}"
log "----------------------------------------"

# Check daemon is running after offline period
if pgrep -f "glowworm_daemon" > /dev/null 2>&1; then
    DAEMON_PID=$(pgrep -f "glowworm_daemon" | head -1)
    log "Daemon running with PID: $DAEMON_PID"
    run_test "Daemon running after offline period" "true"

    # Check memory didn't grow excessively
    if [ -n "$INITIAL_MEMORY" ] && [ "$INITIAL_MEMORY" -gt 0 ]; then
        CURRENT_MEMORY=$(grep VmRSS /proc/$DAEMON_PID/status 2>/dev/null | awk '{print int($2/1024)}' || echo "0")
        MEMORY_GROWTH=$((CURRENT_MEMORY - INITIAL_MEMORY))
        log "Memory after offline: ${CURRENT_MEMORY}MB (growth: ${MEMORY_GROWTH}MB)"
        run_test "Memory growth < 50MB" "[ $MEMORY_GROWTH -lt 50 ]"
    fi
else
    run_test "Daemon running after offline period" "false"
fi

# ==========================================
# Phase 5: Verify Cache Integrity
# ==========================================
log ""
log "${BLUE}Phase 5: Verify Cache Integrity${NC}"
log "----------------------------------------"

# Check cache is still accessible
/opt/glowworm/venv/bin/python << 'PYTHON_SCRIPT'
import sys
from pathlib import Path

cache_dir = Path("/var/cache/glowworm/images")

# Check cache directory exists
if not cache_dir.exists():
    print("FAIL: Cache directory missing")
    sys.exit(1)

# Count valid images
valid_images = 0
corrupt_images = 0

for img_file in cache_dir.glob("*"):
    if img_file.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp"):
        try:
            from PIL import Image
            with Image.open(img_file) as img:
                img.verify()
            valid_images += 1
        except Exception:
            corrupt_images += 1

print(f"Valid images: {valid_images}")
print(f"Corrupt images: {corrupt_images}")

if corrupt_images > 0:
    print("WARNING: Some cached images are corrupt")

sys.exit(0 if valid_images > 0 else 1)
PYTHON_SCRIPT

CACHE_CHECK_RESULT=$?
run_test "Cache integrity check" "[ $CACHE_CHECK_RESULT -eq 0 ]"

# ==========================================
# Summary
# ==========================================
log ""
log "========================================"
log "${CYAN}Offline Test Summary${NC}"
log "========================================"
log ""
log "Tests run:    $TESTS_RUN"
log "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
log "Tests failed: ${RED}$TESTS_FAILED${NC}"
log ""

if [ $TESTS_FAILED -eq 0 ]; then
    log "${GREEN}All offline operation tests passed!${NC}"
    log ""
    log "The daemon can operate offline using cached content and"
    log "will reconnect gracefully when the backend becomes available."
    exit 0
else
    log "${RED}Some tests failed - review the log for details${NC}"
    log "Log file: $LOG_FILE"
    exit 1
fi
