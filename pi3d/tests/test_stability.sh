#!/bin/bash
#
# GlowWorm v3.0 Stability Test Script
#
# Runs a 24-hour stability test monitoring:
# - Memory usage over time
# - CPU usage
# - Crash detection and recovery
# - Image transition count
# - Error rates
#
# Usage: sudo bash test_stability.sh [--duration HOURS] [--mock] [--output DIR]
#
# Default duration is 24 hours. Use --mock for testing without actual display.
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
DURATION_HOURS=24
MOCK_MODE=false
OUTPUT_DIR="/var/log/glowworm/stability_test"
SAMPLE_INTERVAL=60  # seconds
MEMORY_THRESHOLD_MB=256
CPU_THRESHOLD_PERCENT=80

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --duration)
            DURATION_HOURS="$2"
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
            echo "Usage: sudo bash test_stability.sh [--duration HOURS] [--mock] [--output DIR]"
            echo ""
            echo "Options:"
            echo "  --duration HOURS   Test duration in hours (default: 24)"
            echo "  --mock             Run in mock mode (no display hardware)"
            echo "  --output DIR       Output directory for logs (default: /var/log/glowworm/stability_test)"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Calculate duration in seconds
DURATION_SECONDS=$((DURATION_HOURS * 3600))

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Output files
METRICS_FILE="$OUTPUT_DIR/metrics_$(date +%Y%m%d_%H%M%S).csv"
LOG_FILE="$OUTPUT_DIR/stability_$(date +%Y%m%d_%H%M%S).log"
SUMMARY_FILE="$OUTPUT_DIR/summary_$(date +%Y%m%d_%H%M%S).txt"

# Logging function
log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo -e "$msg" | tee -a "$LOG_FILE"
}

log_metric() {
    echo "$1" >> "$METRICS_FILE"
}

# Print banner
echo ""
echo -e "${CYAN}========================================"
echo "   GlowWorm Stability Test"
echo "   Duration: ${DURATION_HOURS} hours"
echo "   Mode: $([ "$MOCK_MODE" = true ] && echo "Mock" || echo "Hardware")"
echo "========================================${NC}"
echo ""
echo "Output directory: $OUTPUT_DIR"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root${NC}"
    exit 1
fi

# Initialize metrics file
log_metric "timestamp,elapsed_minutes,memory_mb,memory_delta_mb,cpu_percent,restart_count,images_displayed,errors,status"

# Get initial memory baseline
get_daemon_pid() {
    pgrep -f "glowworm_daemon" 2>/dev/null | head -1 || echo ""
}

get_memory_mb() {
    local pid="$1"
    if [ -n "$pid" ] && [ -f "/proc/$pid/status" ]; then
        grep VmRSS /proc/$pid/status 2>/dev/null | awk '{print int($2/1024)}' || echo "0"
    else
        echo "0"
    fi
}

get_cpu_percent() {
    local pid="$1"
    if [ -n "$pid" ]; then
        ps -p "$pid" -o %cpu --no-headers 2>/dev/null | awk '{print int($1)}' || echo "0"
    else
        echo "0"
    fi
}

get_status() {
    # Try to get status via IPC
    if [ -S "/run/glowworm/display.sock" ]; then
        echo "running"
    else
        echo "unknown"
    fi
}

# Start test
log "${GREEN}Starting stability test${NC}"
START_TIME=$(date +%s)
INITIAL_MEMORY=0
RESTART_COUNT=0
TOTAL_IMAGES=0
ERROR_COUNT=0
MAX_MEMORY=0
PEAK_CPU=0

# Start daemon if not running
if ! pgrep -f "glowworm_daemon" > /dev/null; then
    log "Starting glowworm-daemon..."

    if [ "$MOCK_MODE" = true ]; then
        # Create mock config
        cat > /tmp/glowworm_stability_test_config.yaml << EOF
backend:
  url: "http://localhost:3003"
  device_token: "stability-test-token"
display:
  mock: true
  fps_target: 30
slideshow:
  display_time: 10.0
  transition_duration: 1.0
cache:
  directory: /var/cache/glowworm/images
  max_size_mb: 100
state:
  directory: /var/lib/glowworm
ipc:
  socket_path: /run/glowworm/display.sock
EOF
        # Note: Actual start would be handled by systemctl or direct invocation
        log "${YELLOW}Mock mode - daemon would be started with mock config${NC}"
    else
        systemctl start glowworm-daemon || {
            log "${RED}Failed to start daemon${NC}"
            exit 1
        }
    fi

    sleep 5  # Wait for startup
fi

# Get initial state
DAEMON_PID=$(get_daemon_pid)
if [ -n "$DAEMON_PID" ]; then
    INITIAL_MEMORY=$(get_memory_mb "$DAEMON_PID")
    log "Daemon PID: $DAEMON_PID"
    log "Initial memory: ${INITIAL_MEMORY}MB"
else
    log "${YELLOW}Warning: Daemon not found, will monitor for start${NC}"
fi

# Monitoring loop
log "Starting monitoring loop (sampling every ${SAMPLE_INTERVAL}s)..."

SAMPLE_COUNT=0
LAST_RESTART_CHECK=0

while true; do
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))
    ELAPSED_MINUTES=$((ELAPSED / 60))

    # Check if test duration exceeded
    if [ $ELAPSED -ge $DURATION_SECONDS ]; then
        log "${GREEN}Test duration complete${NC}"
        break
    fi

    # Get current daemon PID
    DAEMON_PID=$(get_daemon_pid)

    if [ -z "$DAEMON_PID" ]; then
        # Daemon not running - check if it crashed
        log "${RED}Daemon not running - possible crash${NC}"
        ((ERROR_COUNT++))
        STATUS="crashed"
        MEMORY=0
        CPU=0

        # Check if it auto-restarted
        sleep 10
        DAEMON_PID=$(get_daemon_pid)
        if [ -n "$DAEMON_PID" ]; then
            log "${YELLOW}Daemon restarted (PID: $DAEMON_PID)${NC}"
            ((RESTART_COUNT++))
            STATUS="restarted"
        fi
    else
        # Get metrics
        MEMORY=$(get_memory_mb "$DAEMON_PID")
        CPU=$(get_cpu_percent "$DAEMON_PID")
        STATUS=$(get_status)

        # Track maximums
        [ "$MEMORY" -gt "$MAX_MEMORY" ] && MAX_MEMORY=$MEMORY
        [ "$CPU" -gt "$PEAK_CPU" ] && PEAK_CPU=$CPU

        # Check thresholds
        if [ "$MEMORY" -gt "$MEMORY_THRESHOLD_MB" ]; then
            log "${YELLOW}Warning: Memory usage high: ${MEMORY}MB (threshold: ${MEMORY_THRESHOLD_MB}MB)${NC}"
        fi

        if [ "$CPU" -gt "$CPU_THRESHOLD_PERCENT" ]; then
            log "${YELLOW}Warning: CPU usage high: ${CPU}% (threshold: ${CPU_THRESHOLD_PERCENT}%)${NC}"
        fi
    fi

    # Calculate memory delta
    if [ $INITIAL_MEMORY -gt 0 ] && [ "$MEMORY" -gt 0 ]; then
        MEMORY_DELTA=$((MEMORY - INITIAL_MEMORY))
    else
        MEMORY_DELTA=0
    fi

    # Log metrics
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    log_metric "$TIMESTAMP,$ELAPSED_MINUTES,$MEMORY,$MEMORY_DELTA,$CPU,$RESTART_COUNT,$TOTAL_IMAGES,$ERROR_COUNT,$STATUS"

    # Progress output every 10 samples
    ((SAMPLE_COUNT++))
    if [ $((SAMPLE_COUNT % 10)) -eq 0 ]; then
        HOURS_REMAINING=$(( (DURATION_SECONDS - ELAPSED) / 3600 ))
        MINS_REMAINING=$(( ((DURATION_SECONDS - ELAPSED) % 3600) / 60 ))
        log "Progress: ${ELAPSED_MINUTES}m elapsed, ${HOURS_REMAINING}h ${MINS_REMAINING}m remaining | Memory: ${MEMORY}MB (delta: ${MEMORY_DELTA}MB) | CPU: ${CPU}% | Restarts: $RESTART_COUNT"
    fi

    # Sleep until next sample
    sleep $SAMPLE_INTERVAL
done

# Generate summary
END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))
TOTAL_HOURS=$((TOTAL_DURATION / 3600))
TOTAL_MINUTES=$(((TOTAL_DURATION % 3600) / 60))

log ""
log "${CYAN}========================================"
log "   Stability Test Summary"
log "========================================${NC}"

{
    echo "GlowWorm v3.0 Stability Test Results"
    echo "====================================="
    echo ""
    echo "Test Configuration:"
    echo "  Start time:    $(date -d @$START_TIME '+%Y-%m-%d %H:%M:%S')"
    echo "  End time:      $(date -d @$END_TIME '+%Y-%m-%d %H:%M:%S')"
    echo "  Duration:      ${TOTAL_HOURS}h ${TOTAL_MINUTES}m"
    echo "  Mode:          $([ "$MOCK_MODE" = true ] && echo "Mock" || echo "Hardware")"
    echo "  Samples:       $SAMPLE_COUNT"
    echo ""
    echo "Memory:"
    echo "  Initial:       ${INITIAL_MEMORY}MB"
    echo "  Peak:          ${MAX_MEMORY}MB"
    echo "  Growth:        $((MAX_MEMORY - INITIAL_MEMORY))MB"
    echo "  Threshold:     ${MEMORY_THRESHOLD_MB}MB"
    echo ""
    echo "CPU:"
    echo "  Peak:          ${PEAK_CPU}%"
    echo "  Threshold:     ${CPU_THRESHOLD_PERCENT}%"
    echo ""
    echo "Stability:"
    echo "  Restarts:      $RESTART_COUNT"
    echo "  Errors:        $ERROR_COUNT"
    echo ""

    # Determine pass/fail
    PASSED=true
    echo "Pass/Fail Criteria:"

    if [ $RESTART_COUNT -eq 0 ]; then
        echo "  [PASS] No crashes or restarts"
    else
        echo "  [FAIL] $RESTART_COUNT restart(s) detected"
        PASSED=false
    fi

    MEMORY_GROWTH=$((MAX_MEMORY - INITIAL_MEMORY))
    if [ $MEMORY_GROWTH -lt 50 ]; then
        echo "  [PASS] Memory growth < 50MB (actual: ${MEMORY_GROWTH}MB)"
    else
        echo "  [FAIL] Memory growth >= 50MB (actual: ${MEMORY_GROWTH}MB)"
        PASSED=false
    fi

    if [ $MAX_MEMORY -lt $MEMORY_THRESHOLD_MB ]; then
        echo "  [PASS] Peak memory < ${MEMORY_THRESHOLD_MB}MB (actual: ${MAX_MEMORY}MB)"
    else
        echo "  [FAIL] Peak memory >= ${MEMORY_THRESHOLD_MB}MB (actual: ${MAX_MEMORY}MB)"
        PASSED=false
    fi

    if [ $ERROR_COUNT -eq 0 ]; then
        echo "  [PASS] No errors detected"
    else
        echo "  [FAIL] $ERROR_COUNT error(s) detected"
        PASSED=false
    fi

    echo ""
    if [ "$PASSED" = true ]; then
        echo "OVERALL: PASS"
        echo ""
        echo "The system ran stably for ${TOTAL_HOURS}h ${TOTAL_MINUTES}m with no issues."
    else
        echo "OVERALL: FAIL"
        echo ""
        echo "Review the log file for details: $LOG_FILE"
    fi
    echo ""
    echo "Metrics file: $METRICS_FILE"
    echo "Log file:     $LOG_FILE"
} | tee "$SUMMARY_FILE"

log ""
log "Test complete. Summary saved to: $SUMMARY_FILE"

# Exit with appropriate code
if [ "$PASSED" = true ]; then
    exit 0
else
    exit 1
fi
