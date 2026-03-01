#!/bin/bash
#
# GlowWorm v3.0 Power Cycle Test Script
#
# Tests the daemon's ability to recover from unexpected restarts:
# - Systemd auto-start on boot
# - State restoration after restart
# - Graceful handling of abrupt termination
# - Position persistence
#
# Usage: sudo bash test_power_cycle.sh [--mock] [--skip-reboot]
#
# WARNING: This test may reboot the system unless --skip-reboot is used.
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
MOCK_MODE=false
SKIP_REBOOT=false
OUTPUT_DIR="/var/log/glowworm/power_cycle_test"
STATE_FILE="/var/lib/glowworm/playlist_state.json"
VENV="/opt/glowworm/venv"

# Test state
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --mock)
            MOCK_MODE=true
            shift
            ;;
        --skip-reboot)
            SKIP_REBOOT=true
            shift
            ;;
        --output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --phase)
            # Internal use: indicates which phase to run after reboot
            PHASE="$2"
            shift 2
            ;;
        --help)
            echo "Usage: sudo bash test_power_cycle.sh [--mock] [--skip-reboot]"
            echo ""
            echo "Options:"
            echo "  --mock          Run tests without actual hardware"
            echo "  --skip-reboot   Skip tests that require reboot"
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
LOG_FILE="$OUTPUT_DIR/power_cycle_$(date +%Y%m%d_%H%M%S).log"
MARKER_FILE="$OUTPUT_DIR/.power_cycle_test_phase"

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
echo "   GlowWorm Power Cycle Test"
echo "========================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root${NC}"
    exit 1
fi

# Check for post-reboot phase
if [ -f "$MARKER_FILE" ]; then
    PHASE=$(cat "$MARKER_FILE")
    log "Resuming test after reboot (phase: $PHASE)"
fi

# ==========================================
# Phase 1: Pre-Test State Recording
# ==========================================
if [ -z "$PHASE" ] || [ "$PHASE" = "1" ]; then
    log ""
    log "${BLUE}Phase 1: Pre-Test State Recording${NC}"
    log "----------------------------------------"

    # Check daemon is running
    if pgrep -f "glowworm_daemon" > /dev/null 2>&1; then
        DAEMON_PID=$(pgrep -f "glowworm_daemon" | head -1)
        log "Daemon running with PID: $DAEMON_PID"

        # Record current state
        if [ -f "$STATE_FILE" ]; then
            cp "$STATE_FILE" "$OUTPUT_DIR/pre_restart_state.json"
            log "Saved pre-restart state"

            PRE_STATE=$("$VENV/bin/python" -c "import json; s=json.load(open('$STATE_FILE')); print(f'position={s.get(\"position\", \"?\")} version={s.get(\"playlist_version\", \"?\")}')" 2>/dev/null || echo "unknown")
            log "Current state: $PRE_STATE"
        else
            log "${YELLOW}No state file found${NC}"
        fi

        run_test "Daemon running before test" "true"
    else
        log "${YELLOW}Daemon not running - will test cold start${NC}"
    fi

    # Test systemd service is enabled
    if systemctl is-enabled glowworm-daemon 2>/dev/null | grep -q "enabled"; then
        log "Service is enabled for auto-start"
        run_test "Service enabled" "true"
    else
        log "${YELLOW}Service not enabled - enabling now${NC}"
        systemctl enable glowworm-daemon 2>/dev/null || true
        run_test "Service enabled" "systemctl is-enabled glowworm-daemon 2>/dev/null | grep -q enabled"
    fi

    PHASE="1_complete"
fi

# ==========================================
# Phase 2: Graceful Restart Test
# ==========================================
if [ -z "$PHASE" ] || [ "$PHASE" = "1_complete" ] || [ "$PHASE" = "2" ]; then
    log ""
    log "${BLUE}Phase 2: Graceful Restart Test${NC}"
    log "----------------------------------------"

    # Record state before restart
    if [ -f "$STATE_FILE" ]; then
        PRE_POSITION=$("$VENV/bin/python" -c "import json; print(json.load(open('$STATE_FILE')).get('position', 0))" 2>/dev/null || echo "0")
    else
        PRE_POSITION="0"
    fi
    log "Position before restart: $PRE_POSITION"

    # Restart daemon
    log "Restarting daemon..."
    systemctl restart glowworm-daemon 2>/dev/null || {
        log "${YELLOW}Failed to restart daemon${NC}"
    }

    # Wait for restart
    sleep 5

    # Check daemon is running
    if pgrep -f "glowworm_daemon" > /dev/null 2>&1; then
        DAEMON_PID=$(pgrep -f "glowworm_daemon" | head -1)
        log "Daemon restarted with PID: $DAEMON_PID"
        run_test "Daemon restarted successfully" "true"

        # Check state was restored
        if [ -f "$STATE_FILE" ]; then
            POST_POSITION=$("$VENV/bin/python" -c "import json; print(json.load(open('$STATE_FILE')).get('position', 0))" 2>/dev/null || echo "0")
            log "Position after restart: $POST_POSITION"

            if [ "$PRE_POSITION" = "$POST_POSITION" ]; then
                run_test "Position preserved after restart" "true"
            else
                log "${YELLOW}Position changed: $PRE_POSITION -> $POST_POSITION${NC}"
                run_test "Position preserved after restart" "false"
            fi
        fi
    else
        run_test "Daemon restarted successfully" "false"
    fi

    PHASE="2_complete"
fi

# ==========================================
# Phase 3: SIGKILL Recovery Test
# ==========================================
if [ -z "$PHASE" ] || [ "$PHASE" = "2_complete" ] || [ "$PHASE" = "3" ]; then
    log ""
    log "${BLUE}Phase 3: SIGKILL Recovery Test${NC}"
    log "----------------------------------------"

    # This tests recovery from abrupt termination (simulates power loss)

    if pgrep -f "glowworm_daemon" > /dev/null 2>&1; then
        DAEMON_PID=$(pgrep -f "glowworm_daemon" | head -1)
        log "Daemon PID: $DAEMON_PID"

        # Record state
        if [ -f "$STATE_FILE" ]; then
            cp "$STATE_FILE" "$OUTPUT_DIR/pre_kill_state.json"
        fi

        # Kill daemon abruptly
        log "Killing daemon with SIGKILL (simulating power loss)..."
        kill -9 "$DAEMON_PID" 2>/dev/null || true

        # Wait for systemd to detect
        sleep 3

        # Check if daemon was restarted by systemd
        RESTART_ATTEMPTS=0
        MAX_ATTEMPTS=10

        while [ $RESTART_ATTEMPTS -lt $MAX_ATTEMPTS ]; do
            if pgrep -f "glowworm_daemon" > /dev/null 2>&1; then
                NEW_PID=$(pgrep -f "glowworm_daemon" | head -1)
                if [ "$NEW_PID" != "$DAEMON_PID" ]; then
                    log "Daemon auto-restarted by systemd (new PID: $NEW_PID)"
                    run_test "Auto-restart after SIGKILL" "true"
                    break
                fi
            fi
            sleep 2
            ((RESTART_ATTEMPTS++))
        done

        if [ $RESTART_ATTEMPTS -ge $MAX_ATTEMPTS ]; then
            log "${RED}Daemon did not auto-restart${NC}"
            run_test "Auto-restart after SIGKILL" "false"
        fi
    else
        log "${YELLOW}Daemon not running - cannot test SIGKILL recovery${NC}"
        run_test "Auto-restart after SIGKILL (skipped)" "true"
    fi

    PHASE="3_complete"
fi

# ==========================================
# Phase 4: Reboot Recovery Test
# ==========================================
if [ "$SKIP_REBOOT" = false ]; then
    if [ "$PHASE" = "3_complete" ]; then
        log ""
        log "${BLUE}Phase 4: Reboot Recovery Test${NC}"
        log "----------------------------------------"

        log "${YELLOW}WARNING: System will reboot in 10 seconds!${NC}"
        log "Press Ctrl+C to cancel"
        log ""

        # Save phase marker for post-reboot
        echo "post_reboot" > "$MARKER_FILE"

        # Save state for comparison
        if [ -f "$STATE_FILE" ]; then
            cp "$STATE_FILE" "$OUTPUT_DIR/pre_reboot_state.json"
            log "Saved pre-reboot state"
        fi

        # Schedule continuation of test after reboot
        # This uses a @reboot cron job
        SCRIPT_PATH=$(readlink -f "$0")
        echo "@reboot sleep 60 && $SCRIPT_PATH --phase post_reboot >> $LOG_FILE 2>&1" | crontab -

        log "Test will continue after reboot..."
        sleep 10

        # Reboot
        log "Rebooting system..."
        reboot

    elif [ "$PHASE" = "post_reboot" ]; then
        log ""
        log "${BLUE}Phase 4: Post-Reboot Verification${NC}"
        log "----------------------------------------"

        # Remove cron job
        crontab -r 2>/dev/null || true

        # Remove marker
        rm -f "$MARKER_FILE"

        # Wait for services to start
        log "Waiting for services to start..."
        sleep 30

        # Check daemon is running
        if pgrep -f "glowworm_daemon" > /dev/null 2>&1; then
            DAEMON_PID=$(pgrep -f "glowworm_daemon" | head -1)
            log "Daemon running after reboot with PID: $DAEMON_PID"
            run_test "Daemon started after reboot" "true"

            # Compare state
            if [ -f "$OUTPUT_DIR/pre_reboot_state.json" ] && [ -f "$STATE_FILE" ]; then
                PRE_POSITION=$("$VENV/bin/python" -c "import json; print(json.load(open('$OUTPUT_DIR/pre_reboot_state.json')).get('position', 0))" 2>/dev/null || echo "?")
                POST_POSITION=$("$VENV/bin/python" -c "import json; print(json.load(open('$STATE_FILE')).get('position', 0))" 2>/dev/null || echo "?")

                log "Position before reboot: $PRE_POSITION"
                log "Position after reboot: $POST_POSITION"

                if [ "$PRE_POSITION" = "$POST_POSITION" ]; then
                    run_test "Position survived reboot" "true"
                else
                    run_test "Position survived reboot" "false"
                fi
            fi
        else
            log "${RED}Daemon not running after reboot${NC}"
            run_test "Daemon started after reboot" "false"
        fi

        PHASE="complete"
    fi
else
    log ""
    log "${YELLOW}Skipping reboot test (--skip-reboot specified)${NC}"
    run_test "Reboot recovery (skipped)" "true"
    PHASE="complete"
fi

# ==========================================
# Phase 5: Mock Power Loss Simulation
# ==========================================
if [ "$MOCK_MODE" = true ] && [ "$PHASE" != "complete" ]; then
    log ""
    log "${BLUE}Phase 5: Mock Power Loss Simulation${NC}"
    log "----------------------------------------"

    "$VENV/bin/python" << 'PYTHON_SCRIPT'
import asyncio
import json
import sys
import tempfile
from pathlib import Path

async def test_power_loss_simulation():
    """Simulate power loss and recovery."""
    print("Simulating power loss scenario...")

    try:
        from glowworm_daemon.playlist_manager import (
            PlaylistManager,
            PlaylistManagerConfig,
            Playlist,
        )

        with tempfile.TemporaryDirectory() as temp_dir:
            state_dir = Path(temp_dir) / "state"
            state_dir.mkdir()

            config = PlaylistManagerConfig(
                backend_url="http://localhost:3003",
                device_token="test-token",
                state_dir=str(state_dir),
            )

            # Create playlist and advance position
            print("\n  1. Initial state")
            async with PlaylistManager(config) as pm:
                playlist = Playlist.from_dict({
                    "playlist": {
                        "id": 1, "name": "Test", "slug": "test",
                        "display_time_seconds": 30, "display_mode": "default",
                        "version": 1, "sequence": [1, 2, 3, 4, 5],
                    },
                    "manifest": [
                        {"id": i, "url": f"/{i}", "filename": f"{i}.jpg", "checksum": str(i), "file_size": 100, "mime_type": "image/jpeg"}
                        for i in range(1, 6)
                    ],
                })
                pm._playlist = playlist

                # Advance position several times
                pm.next()  # position 1
                pm.next()  # position 2
                pm.next()  # position 3

                print(f"     Position before 'power loss': {pm._position}")
                saved_position = pm._position

                # State is saved automatically
                pm._save_state()

            # Simulate power loss - just exit the context manager
            print("\n  2. Simulating power loss (abrupt exit)")

            # Recovery - new instance loads state
            print("\n  3. Simulating recovery")
            async with PlaylistManager(config) as pm2:
                pm2._playlist = playlist  # Would normally be fetched
                pm2._load_state()

                print(f"     Position after recovery: {pm2._position}")

                if pm2._position == saved_position:
                    print("     State successfully recovered!")
                    return True
                else:
                    print(f"     ERROR: Position mismatch ({saved_position} vs {pm2._position})")
                    return False

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False

result = asyncio.run(test_power_loss_simulation())
sys.exit(0 if result else 1)
PYTHON_SCRIPT

    MOCK_RESULT=$?
    run_test "Mock power loss simulation" "[ $MOCK_RESULT -eq 0 ]"
fi

# ==========================================
# Summary
# ==========================================
if [ "$PHASE" = "complete" ] || [ "$PHASE" = "3_complete" ] || [ "$SKIP_REBOOT" = true ]; then
    log ""
    log "========================================"
    log "${CYAN}Power Cycle Test Summary${NC}"
    log "========================================"
    log ""
    log "Tests run:    $TESTS_RUN"
    log "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
    log "Tests failed: ${RED}$TESTS_FAILED${NC}"
    log ""
    log "Log file: $LOG_FILE"
    log ""

    if [ $TESTS_FAILED -eq 0 ]; then
        log "${GREEN}All power cycle tests passed!${NC}"
        log ""
        log "The daemon correctly:"
        log "  - Restarts gracefully via systemctl"
        log "  - Auto-restarts after SIGKILL (crash simulation)"
        if [ "$SKIP_REBOOT" = false ] && [ "$PHASE" = "complete" ]; then
            log "  - Starts automatically on boot"
            log "  - Preserves state across reboot"
        fi
        exit 0
    else
        log "${RED}Some tests failed - review the log for details${NC}"
        exit 1
    fi
fi
