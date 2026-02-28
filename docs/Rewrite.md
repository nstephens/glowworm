# GlowWorm v3.0 - Pi3D Display Engine Migration Plan

## Overview

This plan outlines the migration from a browser-based display approach to a GPU-accelerated Pi3D display engine. The goal is to achieve smoother transitions, better reliability, and lower resource usage on Raspberry Pi devices while maintaining the existing remote control and image management capabilities.

### Current Architecture (v2.x)
```
Backend (FastAPI) ←→ WebSocket ←→ Browser (Chromium/FullPageOS)
                  ←→ HTTP Polling ←→ Daemon (CEC/URL control)
```

### Target Architecture (v3.0)
```
Backend (FastAPI) ←→ WebSocket ←→ Daemon (Extended)
                                      ↓ IPC (subprocess)
                               Pi3D Display Engine
```

---

## Technology Evaluation

### Why Pi3D?

| Option | Assessment |
|--------|------------|
| **Pi3D** | GPU-accelerated via OpenGL ES 2.0, mature (v2.55, Oct 2025), purpose-built slideshow examples, active ecosystem (picframe project has 587 commits, 42 releases) |
| **Pygame** | Not GPU-accelerated, known performance issues with large image rotation/blending |
| **Kivy** | Overkill for slideshow use case, designed for interactive UIs |
| **Shortcrust** | Less mature OpenGL wrapper, more custom work required |

**Decision: Pi3D** - Proven for smooth image display on Raspberry Pi, built-in cross-fade support, shader framework for future advanced transitions.

### Reference Projects
- [pi3d](https://github.com/tipam/pi3d) - Core graphics library
- [pi3d_demos/PictureFrame2020.py](https://github.com/pi3d/pi3d_demos/blob/master/PictureFrame2020.py) - Slideshow example
- [picframe](https://github.com/helgeerbe/picframe) - Full-featured picture frame using Pi3D (demonstrates MQTT remote control)

---

## Architecture Decisions

### IPC Subprocess Model

The Pi3D display engine runs as a subprocess controlled by the daemon via IPC.

**Rationale:**
- **Unified management**: Daemon handles device lifecycle; Pi3D is just the display renderer
- **Crash recovery**: Daemon detects Pi3D exit and restarts automatically
- **Simpler deployment**: One systemd service, one configuration
- **Sufficient for control**: IPC latency negligible for display commands (<1ms)

**IPC Protocol: JSON-RPC 2.0 over Unix socket**
- Allows bidirectional async communication
- Daemon sends commands, Pi3D sends status notifications
- Socket path: `/run/glowworm/display.sock`

### Offline Operation

Device operates indefinitely without backend connectivity:
- Continues displaying cached images in playlist order
- Polls backend at configurable interval (default: 30 seconds)
- Reconnects automatically when backend available
- Queues status updates to send on reconnection

### Image Preprocessing

All image optimization handled by backend:
- Backend generates display-optimized variants (resized, compressed)
- Daemon fetches pre-processed images via HTTP
- Reduces Pi CPU/memory usage
- Consistent quality across devices

### Operating System

**Recommendation: Raspberry Pi OS Lite (Bookworm) with Wayland**
- Standard, well-supported
- Wayland compositor (labwc) for display management
- No desktop environment overhead

---

## Component Architecture

### 1. Pi3D Display Engine (`glowworm-display`)

Standalone Python application for GPU-accelerated image rendering.

```
glowworm-display/
├── __init__.py
├── main.py              # Entry point, IPC server setup
├── display.py           # Pi3D display initialization
├── renderer.py          # Image rendering and transitions
├── transitions/
│   ├── __init__.py
│   ├── base.py          # Base transition class
│   └── crossfade.py     # Cross-fade transition
├── image_loader.py      # Async image loading
├── text_renderer.py     # Registration code display
├── ipc_server.py        # JSON-RPC Unix socket server
└── config.py            # Display configuration
```

**Responsibilities:**
- Initialize Pi3D display (fullscreen, correct orientation)
- Load images from local cache paths
- Render smooth cross-fade transitions
- Display registration code during setup
- Report status via IPC (current image, state)
- Handle aspect ratio with letterboxing/matting

### 2. Extended Daemon (`glowworm-daemon`)

Extends existing daemon to manage images and control Pi3D.

```
daemon/glowworm_daemon/
├── daemon.py            # Main daemon (extended)
├── config.py            # Configuration (extended)
├── command_executor.py  # Command executors (unchanged)
├── cec_controller.py    # HDMI CEC (unchanged)
├── image_manager.py     # NEW: Image fetching and caching
├── playlist_manager.py  # NEW: Playlist state management
├── display_controller.py # NEW: Pi3D subprocess control
├── websocket_client.py  # NEW: Persistent WebSocket to backend
└── ipc_client.py        # NEW: JSON-RPC client for Pi3D
```

**Responsibilities:**
- Manage Pi3D subprocess lifecycle (start, monitor, restart)
- Fetch images from backend via HTTP
- Manage local image cache (LRU eviction, disk limits)
- Track playlist state (position, shuffle)
- Maintain WebSocket connection to backend
- Relay commands from backend to Pi3D
- Report device status to backend
- Continue CEC power control

### 3. Backend API Extensions

**New/Modified Endpoints:**

```
GET  /api/devices/{token}/playlist
     Returns playlist for device with image URLs and metadata
     Supports ?since= for incremental sync

GET  /api/devices/{token}/images/{id}/display
     Returns display-optimized image variant
     Supports If-None-Match/If-Modified-Since caching

POST /api/devices/{token}/status
     Device reports current state (for offline queue flush)
```

**WebSocket Protocol Extensions:**

```python
# Device → Backend
{
    "type": "status",
    "current_image_id": 123,
    "state": "displaying",  # displaying | transitioning | paused | registration
    "cache_stats": {"count": 45, "size_mb": 380},
    "uptime": 86400
}

# Backend → Device
{
    "type": "command",
    "action": "next" | "previous" | "pause" | "resume" | "reload_playlist"
}

{
    "type": "playlist_changed",
    "playlist_id": 5,
    "version": 12
}
```

### 4. Frontend Changes

**Remove:**
- `/display/{slug}` - Browser-based slideshow view

**Keep:**
- `/display/register` - Shows registration instructions (directs to device screen)

**Update:**
- Device list: Show current image thumbnail, cache stats
- Device detail: Real-time status, cache management
- Device controls: Next/previous/pause work via WebSocket commands

---

## Implementation Phases

### Phase 1: Core Pi3D Display Engine

**Goal:** Working slideshow with cross-fade on local images

**Tasks:**
1. Set up Pi3D project structure
2. Initialize fullscreen display with correct orientation
3. Load and display single image with proper aspect handling
4. Implement cross-fade transition between images
5. Create IPC server (JSON-RPC over Unix socket)
6. Implement commands: `load_image`, `next`, `pause`, `get_status`
7. Test on Raspberry Pi 4/5 hardware
8. Benchmark: target 30+ FPS transitions, <200MB RAM

**Deliverable:** Standalone Pi3D app controllable via Unix socket

### Phase 2: Daemon Image Management

**Goal:** Daemon fetches and caches images from backend

**Tasks:**
1. Create image_manager module
   - HTTP client for fetching images
   - Local cache directory management
   - LRU eviction when cache full
   - ETag/Last-Modified cache validation
2. Create playlist_manager module
   - Fetch playlist from backend
   - Track current position
   - Handle shuffle mode
   - Preload next N images
3. Configuration for cache size, preload count
4. Test image fetching and cache lifecycle

**Deliverable:** Daemon that syncs images from backend to local cache

### Phase 3: Daemon-Pi3D Integration

**Goal:** Daemon controls Pi3D subprocess

**Tasks:**
1. Create display_controller module
   - Start Pi3D as subprocess
   - IPC client for commands
   - Monitor process health
   - Auto-restart on crash
2. Create slideshow loop logic
   - Advance through playlist
   - Send load_image commands to Pi3D
   - Handle timing (image duration, transition duration)
3. Integration testing: backend → daemon → Pi3D

**Deliverable:** Working slideshow controlled by daemon

### Phase 4: WebSocket Communication

**Goal:** Real-time two-way communication with backend

**Tasks:**
1. Create websocket_client module
   - Persistent connection with auto-reconnect
   - Exponential backoff on failures
   - Offline queue for status updates
2. Status reporting
   - Current image
   - Transition state
   - Cache statistics
3. Command reception
   - next/previous/pause/resume
   - Playlist reload trigger
4. Backend WebSocket handler updates
5. Frontend real-time status display

**Deliverable:** Full two-way real-time communication

### Phase 5: Device Registration Flow

**Goal:** Seamless device setup via Pi3D display

**Tasks:**
1. Registration display mode in Pi3D
   - Large, readable registration code
   - Visual indicator that device is waiting
   - Optional: QR code for mobile scanning
2. Daemon registration flow
   - Start in registration mode if no token
   - Display code via Pi3D
   - Poll backend for authorization
   - On auth: save config, start normal operation
3. Backend registration endpoint updates
   - Support daemon-based registration
   - Return full config on authorization
4. Frontend registration UX (unchanged from user perspective)

**Deliverable:** New device setup works end-to-end

### Phase 6: Frontend Admin Updates

**Goal:** Admin interface shows Pi3D device status

**Tasks:**
1. Device list updates
   - Current image thumbnail
   - Connection status indicator
   - Cache usage display
2. Device controls
   - Next/previous/pause buttons
   - Force playlist sync
   - Clear cache
3. Remove browser display code
4. Update documentation

**Deliverable:** Admin interface fully supports Pi3D devices

### Phase 7: Polish and Testing

**Goal:** Production-ready quality

**Tasks:**
1. Error handling
   - Graceful degradation
   - Error display on Pi3D screen
   - Comprehensive logging
2. Performance optimization
   - Fine-tune transition timing
   - Optimize image preloading
   - Memory usage monitoring
3. Installation automation
   - Setup script for dependencies
   - Systemd service files
   - Configuration wizard
4. Documentation
   - Installation guide
   - Configuration reference
   - Troubleshooting

**Deliverable:** v3.0 release candidate

---

## Future Phases (Post-v3.0)

### Phase 8: Advanced Transitions
- Ken Burns effect (pan and zoom)
- Zoom in/out transitions
- Slide transitions
- Custom shader framework

### Phase 9: Enhanced Features
- Multi-image layouts
- Text overlays (date, caption)
- Clock/weather widgets
- Ambient color extraction

---

## Technical Specifications

### Pi3D Requirements

```bash
# System dependencies (Raspberry Pi OS)
sudo apt install python3-pip python3-venv libgl1-mesa-dri libgles2-mesa

# Python packages
pi3d>=2.57
Pillow>=10.0
numpy>=1.24
```

### Image Cache Specification

```yaml
cache:
  directory: /var/cache/glowworm/images
  max_size_mb: 1000           # 1GB default
  min_free_space_mb: 500      # Preserve disk space
  preload_count: 3            # Preload next 3 images
```

### IPC Protocol

```yaml
socket_path: /run/glowworm/display.sock

# Commands (daemon → display)
load_image:
  params: {path: "/cache/img123.jpg", transition: "crossfade", duration: 2.0}
  result: {success: true}

get_status:
  params: {}
  result:
    state: "displaying"       # displaying | transitioning | paused | registration
    current_image: "/cache/img123.jpg"
    fps: 30.5

show_registration:
  params: {code: "AB12"}
  result: {success: true}

# Notifications (display → daemon)
state_changed:
  data: {state: "displaying", image: "/cache/img123.jpg"}

error:
  data: {code: "LOAD_FAILED", message: "Cannot load image"}
```

### Device Configuration

```yaml
# /etc/glowworm/config.yaml

backend:
  url: https://glowworm.example.com
  websocket_url: wss://glowworm.example.com/api/ws/device
  poll_interval: 30           # Seconds between reconnect attempts

device:
  token: null                 # Set after registration

display:
  orientation: portrait       # portrait | landscape
  rotation: 0                 # 0, 90, 180, 270
  background_color: "#000000"
  transition_duration: 2.0    # Seconds
  image_duration: 30.0        # Seconds between transitions

cache:
  directory: /var/cache/glowworm/images
  max_size_mb: 1000
  preload_count: 3

cec:
  enabled: true
  display_address: 0

logging:
  level: INFO
  file: /var/log/glowworm/daemon.log
```

---

## Migration Strategy

### For Existing Users

1. **Parallel availability**: v3.0 available alongside v2.x during transition
2. **New installation path**: Fresh Pi setup with new daemon
3. **Backend compatible**: Same backend serves both display types
4. **No data migration**: Playlists, images, settings unchanged

### Breaking Changes

- FullPageOS no longer used
- Browser-based display removed
- New device setup required (re-register devices)
- Different OS image recommended

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Transition smoothness | 30+ FPS on Pi 4 |
| RAM usage | <200MB (vs ~400MB Chromium) |
| CPU during transition | <30% |
| CPU displaying static | <5% |
| Uptime without intervention | 99%+ |
| Crash recovery | <10 seconds |
| Offline operation | Indefinite |

---

## Sources

- [Pi3D GitHub](https://github.com/tipam/pi3d) - Core graphics library
- [Pi3D Demos - PictureFrame2020.py](https://github.com/pi3d/pi3d_demos/blob/master/PictureFrame2020.py)
- [picframe](https://github.com/helgeerbe/picframe) - Reference implementation with MQTT control
- [Pi3D FAQ](https://www.thedigitalpictureframe.com/pi3d-faq-image-viewer-picture-frame/)
- [Cross-fade transitions guide](https://www.thedigitalpictureframe.com/how-to-add-crossfading-slide-transitions-to-your-digital-picture-frame-using-pi3d/)
