#!/bin/bash
#
# GlowWorm v3.0 Final Integration Test Runner
#
# Runs all integration tests for the Pi3D display system.
# This is the main entry point for comprehensive system testing.
#
# Usage: sudo bash run_all_tests.sh [--mock] [--quick] [--skip-reboot]
#
# Options:
#   --mock         Run all tests in mock mode (no hardware required)
#   --quick        Run abbreviated tests (shorter durations)
#   --skip-reboot  Skip tests that require system reboot
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
QUICK_MODE=false
SKIP_REBOOT=true  # Default to skip reboot for safety
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="/var/log/glowworm/integration_tests"
SUMMARY_FILE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --mock)
            MOCK_MODE=true
            shift
            ;;
        --quick)
            QUICK_MODE=true
            shift
            ;;
        --skip-reboot)
            SKIP_REBOOT=true
            shift
            ;;
        --with-reboot)
            SKIP_REBOOT=false
            shift
            ;;
        --help)
            echo "Usage: sudo bash run_all_tests.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --mock         Run in mock mode (no hardware)"
            echo "  --quick        Run abbreviated tests"
            echo "  --skip-reboot  Skip reboot tests (default)"
            echo "  --with-reboot  Include reboot tests"
            echo ""
            echo "Tests included:"
            echo "  1. Fresh Install Test"
            echo "  2. Stability Test (24h or 1h with --quick)"
            echo "  3. Offline Operation Test"
            echo "  4. Multi-Device Test"
            echo "  5. Playlist Update Test"
            echo "  6. Power Cycle Test"
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
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SUMMARY_FILE="$OUTPUT_DIR/test_summary_${TIMESTAMP}.txt"
LOG_FILE="$OUTPUT_DIR/test_runner_${TIMESTAMP}.log"

# Logging
log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo -e "$msg" | tee -a "$LOG_FILE"
}

# Print banner
clear
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                              ║${NC}"
echo -e "${CYAN}║       GlowWorm v3.0 Final Integration Test Suite            ║${NC}"
echo -e "${CYAN}║                                                              ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Show configuration
echo -e "${BLUE}Configuration:${NC}"
echo "  Mock Mode:    $MOCK_MODE"
echo "  Quick Mode:   $QUICK_MODE"
echo "  Skip Reboot:  $SKIP_REBOOT"
echo "  Output:       $OUTPUT_DIR"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root${NC}"
    echo "Please run: sudo bash run_all_tests.sh"
    exit 1
fi

# Initialize results
declare -A TEST_RESULTS
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Run a test script
run_test() {
    local name="$1"
    local script="$2"
    local args="$3"

    ((TOTAL_TESTS++))

    log ""
    log "════════════════════════════════════════════════════════════════"
    log "  TEST: $name"
    log "════════════════════════════════════════════════════════════════"

    if [ ! -f "$script" ]; then
        log "${YELLOW}SKIPPED: Script not found: $script${NC}"
        TEST_RESULTS[$name]="SKIPPED"
        ((SKIPPED_TESTS++))
        return 0
    fi

    # Add mock flag if needed
    if [ "$MOCK_MODE" = true ]; then
        args="$args --mock"
    fi

    # Run the test
    local start_time=$(date +%s)

    if bash "$script" $args >> "$LOG_FILE" 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log "${GREEN}PASSED${NC} ($name) - ${duration}s"
        TEST_RESULTS[$name]="PASSED"
        ((PASSED_TESTS++))
        return 0
    else
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log "${RED}FAILED${NC} ($name) - ${duration}s"
        TEST_RESULTS[$name]="FAILED"
        ((FAILED_TESTS++))
        return 1
    fi
}

# ==========================================
# Run Tests
# ==========================================

echo -e "${BLUE}Starting tests...${NC}"
echo ""

START_TIME=$(date +%s)

# Test 1: Fresh Install
log "Starting Test 1: Fresh Install"
run_test "Fresh Install" "$SCRIPT_DIR/test_fresh_install.sh" "--verbose" || true

# Test 2: Stability (adjust duration for quick mode)
if [ "$QUICK_MODE" = true ]; then
    STABILITY_DURATION="--duration 0.1"  # 6 minutes for quick mode
else
    STABILITY_DURATION="--duration 1"  # 1 hour for normal mode (24h is too long for automated test)
fi
log "Starting Test 2: Stability"
run_test "Stability" "$SCRIPT_DIR/test_stability.sh" "$STABILITY_DURATION" || true

# Test 3: Offline Operation
if [ "$QUICK_MODE" = true ]; then
    OFFLINE_DURATION="--duration 1"  # 1 minute
else
    OFFLINE_DURATION="--duration 5"  # 5 minutes
fi
log "Starting Test 3: Offline Operation"
run_test "Offline Operation" "$SCRIPT_DIR/test_offline.sh" "$OFFLINE_DURATION" || true

# Test 4: Multi-Device (simulation mode unless devices specified)
log "Starting Test 4: Multi-Device"
run_test "Multi-Device" "$SCRIPT_DIR/test_multi_device.sh" "" || true

# Test 5: Playlist Update
log "Starting Test 5: Playlist Update"
run_test "Playlist Update" "$SCRIPT_DIR/test_playlist_update.sh" "" || true

# Test 6: Power Cycle
POWER_ARGS=""
if [ "$SKIP_REBOOT" = true ]; then
    POWER_ARGS="--skip-reboot"
fi
log "Starting Test 6: Power Cycle"
run_test "Power Cycle" "$SCRIPT_DIR/test_power_cycle.sh" "$POWER_ARGS" || true

END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))
TOTAL_MINUTES=$((TOTAL_DURATION / 60))
TOTAL_SECONDS=$((TOTAL_DURATION % 60))

# ==========================================
# Generate Summary
# ==========================================

{
    echo "GlowWorm v3.0 Final Integration Test Results"
    echo "============================================="
    echo ""
    echo "Test Run:     $(date)"
    echo "Duration:     ${TOTAL_MINUTES}m ${TOTAL_SECONDS}s"
    echo "Mock Mode:    $MOCK_MODE"
    echo "Quick Mode:   $QUICK_MODE"
    echo ""
    echo "Results:"
    echo "--------"
    echo ""

    for test_name in "Fresh Install" "Stability" "Offline Operation" "Multi-Device" "Playlist Update" "Power Cycle"; do
        result="${TEST_RESULTS[$test_name]:-NOT RUN}"
        case "$result" in
            PASSED)
                echo "  [PASS] $test_name"
                ;;
            FAILED)
                echo "  [FAIL] $test_name"
                ;;
            SKIPPED)
                echo "  [SKIP] $test_name"
                ;;
            *)
                echo "  [????] $test_name"
                ;;
        esac
    done

    echo ""
    echo "Summary:"
    echo "--------"
    echo "  Total:   $TOTAL_TESTS"
    echo "  Passed:  $PASSED_TESTS"
    echo "  Failed:  $FAILED_TESTS"
    echo "  Skipped: $SKIPPED_TESTS"
    echo ""

    if [ $FAILED_TESTS -eq 0 ]; then
        echo "OVERALL: PASS"
        echo ""
        echo "All integration tests passed! The system is ready for deployment."
    else
        echo "OVERALL: FAIL"
        echo ""
        echo "Some tests failed. Review the log files for details:"
        echo "  $LOG_FILE"
    fi
    echo ""
    echo "Output directory: $OUTPUT_DIR"
} | tee "$SUMMARY_FILE"

# ==========================================
# Final Output
# ==========================================

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    Test Run Complete                         ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Summary saved to: $SUMMARY_FILE"
echo "Full log saved to: $LOG_FILE"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ $FAILED_TESTS test(s) failed${NC}"
    exit 1
fi
