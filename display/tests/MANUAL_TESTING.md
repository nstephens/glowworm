# GlowWorm Display Engine - Manual Testing Procedure

This document outlines the manual testing procedures for verifying the Pi3D display engine on Raspberry Pi hardware.

## Prerequisites

- Raspberry Pi 4 or 5 with Raspberry Pi OS (64-bit recommended)
- HDMI display connected
- Python 3.11+ installed
- glowworm-display package installed (`pip install -e .`)
- Sample images in a test directory

## Test Environment Setup

```bash
# Create test directory
mkdir -p /tmp/glowworm-test/images

# Copy or create test images (various sizes and orientations)
# - At least one landscape image (e.g., 1920x1080)
# - At least one portrait image (e.g., 1080x1920)
# - Various formats: JPEG, PNG, WebP

# Create the IPC socket directory
sudo mkdir -p /run/glowworm
sudo chown $USER:$USER /run/glowworm
```

## Test Cases

### 1. Display Initialization

**Objective:** Verify the display initializes correctly in fullscreen mode.

**Steps:**
1. Run: `glowworm-display --test-frames 60`
2. Observe the display

**Expected Results:**
- Display shows black background
- No flickering or artifacts
- Console shows resolution detected
- After 60 frames, exits cleanly

**Pass/Fail:** [ ]

---

### 2. Image Loading and Display

**Objective:** Verify images load and display correctly with proper aspect ratio.

**Steps:**
1. Run: `glowworm-display --test-image /path/to/landscape.jpg --test-frames 120`
2. Observe the displayed image
3. Repeat with portrait image
4. Repeat with different scale modes:
   - `--scale-mode fit`
   - `--scale-mode fill`
   - `--scale-mode stretch`

**Expected Results:**
- Image displays centered on screen
- Aspect ratio preserved in "fit" mode (letterbox/pillarbox as needed)
- "fill" mode fills screen, cropping as needed
- "stretch" mode fills screen, may distort image
- No artifacts or corruption

**Pass/Fail:** [ ]

---

### 3. Cross-fade Transitions

**Objective:** Verify smooth cross-fade transitions between images.

**Steps:**
1. Run: `glowworm-display --test-image /path/to/image1.jpg --test-transition /path/to/image2.jpg --transition-duration 2.0`
2. Observe the transition

**Expected Results:**
- Smooth fade from image1 to image2
- No stuttering or frame drops
- Transition completes in approximately 2 seconds
- Final image remains displayed

**Pass/Fail:** [ ]

---

### 4. Renderer State Machine

**Objective:** Verify renderer handles state transitions correctly.

**Steps:**
1. Run: `glowworm-display --test-renderer --test-image /path/to/image1.jpg --test-transition /path/to/image2.jpg --transition-duration 1.0`
2. Observe console output for state changes

**Expected Results:**
- State changes logged: idle → transitioning → displaying
- Pause/resume test logs: displaying → paused → transitioning (or displaying)
- Statistics logged at end (frame count, avg FPS, images displayed)
- FPS should be above 30

**Pass/Fail:** [ ]

---

### 5. IPC Server Communication

**Objective:** Verify IPC server accepts commands and responds correctly.

**Setup:**
```bash
# Terminal 1: Start display with IPC
glowworm-display --test-ipc --socket /tmp/glowworm/display.sock

# Terminal 2: Send commands
```

**Steps:**
1. Start display engine with IPC in Terminal 1
2. In Terminal 2, send commands:

```bash
# Get status
echo '{"jsonrpc":"2.0","method":"get_status","id":1}' | nc -U /tmp/glowworm/display.sock

# Load an image
echo '{"jsonrpc":"2.0","method":"load_image","params":{"path":"/path/to/image.jpg"},"id":2}' | nc -U /tmp/glowworm/display.sock

# Pause
echo '{"jsonrpc":"2.0","method":"pause","id":3}' | nc -U /tmp/glowworm/display.sock

# Resume
echo '{"jsonrpc":"2.0","method":"resume","id":4}' | nc -U /tmp/glowworm/display.sock

# Queue multiple images
echo '{"jsonrpc":"2.0","method":"queue_image","params":{"path":"/path/to/image2.jpg"},"id":5}' | nc -U /tmp/glowworm/display.sock

# Clear
echo '{"jsonrpc":"2.0","method":"clear","id":6}' | nc -U /tmp/glowworm/display.sock
```

**Expected Results:**
- Each command returns valid JSON-RPC response
- `get_status` returns state, queue length, stats
- `load_image` triggers transition on display
- `pause`/`resume` control playback
- `queue_image` adds to queue
- `clear` returns to black screen

**Pass/Fail:** [ ]

---

### 6. Registration Display Mode

**Objective:** Verify registration code displays correctly.

**Steps:**
1. Run: `glowworm-display --test-registration ABCD --test-frames 300`
2. Observe the display

**Expected Results:**
- Registration code "ABCD" displayed large and centered
- Subtle pulse animation visible on code
- "Waiting dots" animation visible
- State shows as "registration" in logs

**Pass/Fail:** [ ]

---

### 7. Performance Benchmarks

**Objective:** Verify performance meets targets on Pi hardware.

**Steps:**
1. Run: `python -m tests.benchmark --duration 10`
2. Review results

**Expected Results:**
- Average FPS >= 30 during static display
- Average FPS >= 30 during transitions
- Memory delta <= 50MB over extended operation
- No frame drops or stuttering visible

**Performance Targets:**
| Metric | Target | Actual |
|--------|--------|--------|
| Static FPS | >= 30 | |
| Transition FPS | >= 30 | |
| Memory (idle) | < 200MB | |
| Memory growth (50 images) | < 50MB | |
| CPU (static display) | < 5% | |

**Pass/Fail:** [ ]

---

### 8. Extended Operation (Stability)

**Objective:** Verify stable operation over extended period.

**Steps:**
1. Create a script that queues images continuously:
```bash
#!/bin/bash
SOCKET="/tmp/glowworm/display.sock"
IMAGES="/path/to/images/*.jpg"

while true; do
    for img in $IMAGES; do
        echo "{\"jsonrpc\":\"2.0\",\"method\":\"queue_image\",\"params\":{\"path\":\"$img\"},\"id\":1}" | nc -U $SOCKET
        sleep 5
    done
done
```

2. Run display engine: `glowworm-display --test-ipc --socket /tmp/glowworm/display.sock`
3. Run the image script in another terminal
4. Let run for at least 1 hour
5. Monitor memory usage: `watch -n 60 'ps aux | grep glowworm-display'`

**Expected Results:**
- No crashes over 1 hour
- Memory usage stable (no continuous growth)
- All images display correctly
- Transitions remain smooth

**Pass/Fail:** [ ]

---

### 9. Error Handling

**Objective:** Verify graceful handling of error conditions.

**Steps:**
1. Test missing image:
   ```bash
   echo '{"jsonrpc":"2.0","method":"load_image","params":{"path":"/nonexistent/image.jpg"},"id":1}' | nc -U /tmp/glowworm/display.sock
   ```

2. Test invalid format:
   ```bash
   echo '{"jsonrpc":"2.0","method":"load_image","params":{"path":"/etc/passwd"},"id":1}' | nc -U /tmp/glowworm/display.sock
   ```

3. Test corrupted image (create one with truncated data)

4. Test invalid IPC command:
   ```bash
   echo '{"jsonrpc":"2.0","method":"unknown_command","id":1}' | nc -U /tmp/glowworm/display.sock
   ```

**Expected Results:**
- Missing image: returns error response, display continues
- Invalid format: returns error response, display continues
- Corrupted image: logs error, skips image, display continues
- Invalid command: returns -32601 error code

**Pass/Fail:** [ ]

---

### 10. Signal Handling

**Objective:** Verify graceful shutdown on signals.

**Steps:**
1. Start display: `glowworm-display --test-ipc`
2. Send SIGTERM: `kill -TERM <pid>`
3. Repeat with SIGINT (Ctrl+C)

**Expected Results:**
- Display shuts down cleanly
- Socket file removed
- No orphan processes
- Exit code 0

**Pass/Fail:** [ ]

---

## Test Summary

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| 1. Display Initialization | | | |
| 2. Image Loading | | | |
| 3. Cross-fade Transitions | | | |
| 4. Renderer State Machine | | | |
| 5. IPC Communication | | | |
| 6. Registration Display | | | |
| 7. Performance Benchmarks | | | |
| 8. Extended Operation | | | |
| 9. Error Handling | | | |
| 10. Signal Handling | | | |

**Overall Result:** [ ] PASS / [ ] FAIL

**Tested By:** ____________________

**Date:** ____________________

**Pi Model:** ____________________

**OS Version:** ____________________

**Notes:**


