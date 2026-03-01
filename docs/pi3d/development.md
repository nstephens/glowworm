# GlowWorm Pi3D Display - Developer Documentation

Architecture overview and technical documentation for developers.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                       GlowWorm Backend                           │
│  ┌─────────────┐  ┌─────────────────────────────────────────┐   │
│  │  REST API   │  │           WebSocket Manager              │   │
│  │  (FastAPI)  │  │  - Device connections                    │   │
│  └──────┬──────┘  │  - Status updates                        │   │
│         │         │  - Command dispatch                       │   │
│         │         └─────────────────┬───────────────────────┘   │
└─────────┼───────────────────────────┼───────────────────────────┘
          │                           │
          │ HTTP                      │ WebSocket
          │ (images, playlist)        │ (commands, status)
          │                           │
┌─────────┴───────────────────────────┴───────────────────────────┐
│                     Raspberry Pi Device                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    glowworm-daemon                         │  │
│  │                                                            │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐   │  │
│  │  │  WebSocket   │  │   Playlist   │  │     Image      │   │  │
│  │  │   Client     │  │   Manager    │  │    Manager     │   │  │
│  │  └──────┬───────┘  └──────┬───────┘  └───────┬────────┘   │  │
│  │         │                 │                   │            │  │
│  │  ┌──────┴─────────────────┴───────────────────┴────────┐  │  │
│  │  │                Slideshow Orchestrator                │  │  │
│  │  │  - Timing control                                    │  │  │
│  │  │  - Image sequencing                                  │  │  │
│  │  │  - Command handling                                  │  │  │
│  │  └───────────────────────┬─────────────────────────────┘  │  │
│  │                          │ IPC (JSON-RPC 2.0)              │  │
│  │                          │ Unix Socket                     │  │
│  └──────────────────────────┼────────────────────────────────┘  │
│                             │                                    │
│  ┌──────────────────────────┴────────────────────────────────┐  │
│  │                   glowworm-display                         │  │
│  │                                                            │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐   │  │
│  │  │  IPC Server  │  │   Renderer   │  │  Image Loader  │   │  │
│  │  │  (JSON-RPC)  │  │  (state      │  │  (textures)    │   │  │
│  │  │              │  │   machine)   │  │                │   │  │
│  │  └──────────────┘  └──────────────┘  └────────────────┘   │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │                    Pi3D Display                       │ │  │
│  │  │         GPU-accelerated OpenGL ES 2.0 rendering       │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Package Structure

### glowworm-daemon

The orchestration daemon that manages the slideshow:

```
daemon/
├── glowworm_daemon/
│   ├── __init__.py
│   ├── __main__.py           # Entry point
│   ├── config.py             # Legacy config (INI)
│   ├── unified_config.py     # v3.0 config (YAML)
│   ├── display_controller.py # Pi3D subprocess management
│   ├── image_manager.py      # HTTP client and caching
│   ├── playlist_manager.py   # Playlist state
│   ├── preloader.py          # Background preloading
│   ├── slideshow.py          # Orchestration logic
│   └── websocket_client.py   # Backend communication
└── pyproject.toml
```

### glowworm-display

The Pi3D rendering engine:

```
display/
├── glowworm_display/
│   ├── __init__.py
│   ├── __main__.py           # Entry point
│   ├── config.py             # Display configuration
│   ├── display.py            # Pi3D initialization
│   ├── image_loader.py       # Texture loading
│   ├── ipc_server.py         # JSON-RPC server
│   ├── renderer.py           # Main render loop
│   ├── text_renderer.py      # Registration/error text
│   ├── performance.py        # Performance monitoring
│   └── transitions/
│       ├── __init__.py
│       ├── base.py           # Transition interface
│       └── crossfade.py      # Cross-fade implementation
└── pyproject.toml
```

## IPC Protocol

Communication between daemon and display uses JSON-RPC 2.0 over Unix domain sockets.

### Socket Location

Default: `/run/glowworm/display.sock`

### Message Format

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "method_name",
  "params": {"key": "value"},
  "id": 1
}
```

**Response (success):**
```json
{
  "jsonrpc": "2.0",
  "result": {"success": true},
  "id": 1
}
```

**Response (error):**
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32600,
    "message": "Invalid Request"
  },
  "id": 1
}
```

**Notification (no id, no response expected):**
```json
{
  "jsonrpc": "2.0",
  "method": "state_changed",
  "params": {"state": "displaying"}
}
```

### Available Methods

#### load_image

Load and display an image immediately (triggers transition).

```json
{
  "method": "load_image",
  "params": {
    "path": "/var/cache/glowworm/images/abc123.jpg",
    "scale_mode": "fit",
    "transition_duration": 2.0
  }
}
```

**Parameters:**
- `path` (string, required) - Absolute path to image file
- `scale_mode` (string, optional) - `fit`, `fill`, or `stretch` (default: `fit`)
- `transition_duration` (float, optional) - Override transition duration

**Response:**
```json
{"success": true}
```

#### queue_image

Queue an image for later display.

```json
{
  "method": "queue_image",
  "params": {
    "path": "/path/to/image.jpg",
    "scale_mode": "fit"
  }
}
```

**Response:**
```json
{"success": true, "queue_position": 3}
```

#### get_status

Get current renderer status.

```json
{"method": "get_status", "params": {}}
```

**Response:**
```json
{
  "state": "displaying",
  "is_running": true,
  "is_paused": false,
  "current_image": "/path/to/current.jpg",
  "queue_length": 2,
  "stats": {
    "fps": 30.1,
    "frame_count": 12450,
    "transition_count": 42
  }
}
```

**States:**
- `idle` - No image displayed
- `displaying` - Showing an image
- `transitioning` - Cross-fade in progress
- `paused` - Slideshow paused
- `registration` - Showing registration code
- `error` - Showing error message

#### pause

Pause the renderer (freezes current frame).

```json
{"method": "pause", "params": {}}
```

**Response:**
```json
{"success": true, "state": "paused"}
```

#### resume

Resume the renderer.

```json
{"method": "resume", "params": {}}
```

**Response:**
```json
{"success": true, "state": "displaying"}
```

#### clear

Clear the display to background color.

```json
{"method": "clear", "params": {}}
```

**Response:**
```json
{"success": true}
```

#### show_registration

Display a registration code.

```json
{
  "method": "show_registration",
  "params": {"code": "A1B2"}
}
```

**Response:**
```json
{"success": true, "state": "registration", "code": "A1B2"}
```

#### hide_registration

Hide registration display.

```json
{"method": "hide_registration", "params": {}}
```

#### show_error

Display an error message.

```json
{
  "method": "show_error",
  "params": {
    "message": "Network connection lost",
    "code": "NET_ERROR",
    "details": "Connection refused",
    "recoverable": true
  }
}
```

#### clear_error

Clear error display and return to previous state.

```json
{"method": "clear_error", "params": {}}
```

### Notifications

The display sends notifications to connected clients:

#### state_changed

Sent when renderer state changes.

```json
{
  "jsonrpc": "2.0",
  "method": "state_changed",
  "params": {"state": "displaying"}
}
```

#### error_occurred

Sent when an error is displayed.

```json
{
  "jsonrpc": "2.0",
  "method": "error_occurred",
  "params": {
    "message": "Failed to load image",
    "code": "IMAGE_ERROR"
  }
}
```

### Error Codes

| Code | Name | Description |
|------|------|-------------|
| -32700 | Parse error | Invalid JSON |
| -32600 | Invalid Request | Not a valid JSON-RPC request |
| -32601 | Method not found | Unknown method |
| -32602 | Invalid params | Invalid method parameters |
| -32603 | Internal error | Server error |

## Development Setup

### Prerequisites

- Python 3.11+
- Pi3D dependencies (or use mock mode for development)

### Local Development

```bash
# Clone repository
git clone https://github.com/nstephens/glowworm.git
cd glowworm

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install packages in development mode
pip install -e daemon/
pip install -e display/

# Run daemon (development mode)
python -m glowworm_daemon.main

# Run display in mock mode (no GPU required)
python -m glowworm_display --mock
```

### Testing

```bash
# Run daemon tests
cd daemon && pytest tests/ -v

# Run display tests
cd display && pytest tests/ -v

# Integration tests
pytest tests/integration/ -v
```

### Mock Mode

The display supports mock mode for development without Pi3D hardware:

```bash
# Basic mock mode
glowworm-display --mock

# Test image loading
glowworm-display --mock --test-image /path/to/image.jpg --test-frames 100

# Test transitions
glowworm-display --mock \
    --test-image /path/to/image1.jpg \
    --test-transition /path/to/image2.jpg \
    --transition-duration 2.0
```

## WebSocket Protocol

### Device → Backend Messages

#### Status Report

Sent periodically and on state changes:

```json
{
  "type": "status",
  "data": {
    "state": "displaying",
    "current_image_id": "abc123",
    "cache_stats": {
      "count": 45,
      "size_mb": 234,
      "hit_rate": 0.95
    },
    "uptime": 86400,
    "memory_mb": 156,
    "cpu_percent": 12.5
  }
}
```

### Backend → Device Commands

#### Control Commands

```json
{
  "type": "command",
  "command": "next"
}
```

Commands: `next`, `previous`, `pause`, `resume`, `reload_playlist`, `clear_cache`

#### Command Acknowledgment

```json
{
  "type": "command_ack",
  "command_id": "cmd_123",
  "success": true,
  "result": {}
}
```

## Performance Considerations

### Target Metrics

| Metric | Target | Notes |
|--------|--------|-------|
| Transition FPS | ≥30 | On Pi 4 |
| RAM usage | <200MB | Total system |
| CPU (transitioning) | <30% | Single core |
| CPU (static) | <5% | When idle |

### Optimization Techniques

1. **Texture Recycling** - Reuse GPU textures to reduce allocations
2. **Image Preprocessing** - Resize large images before texture upload
3. **Preloading** - Load next images while displaying current
4. **Memory Management** - Explicit GC after transitions
5. **Cache Eviction** - Background LRU eviction

### Profiling

Enable performance monitoring:

```yaml
logging:
  level: DEBUG
```

Performance stats are logged periodically and available via `get_status` IPC call.

## Renderer State Machine

```
                    ┌─────────────┐
                    │    IDLE     │◀──────────────────┐
                    └──────┬──────┘                   │
                           │ load_image               │
                           ▼                          │
                    ┌─────────────┐                   │
           ┌───────▶│ TRANSITIONING│───────┐          │
           │        └──────┬──────┘       │          │
           │               │              │          │
           │               ▼              │          │
           │        ┌─────────────┐       │          │
           │        │ DISPLAYING  │◀──────┘          │
           │        └──────┬──────┘                  │ clear
           │               │                         │
           │ load_image    │ pause                   │
           │               ▼                         │
           │        ┌─────────────┐                  │
           └────────│   PAUSED    │──────────────────┘
                    └─────────────┘
                           │
              resume       │
                    ┌──────┴──────┐
                    ▼             ▼
             DISPLAYING     TRANSITIONING
```

Special states:
- `REGISTRATION` - Displaying registration code (overrides normal flow)
- `ERROR` - Displaying error message (recoverable states preserved)

## Contributing

### Code Style

- Python: PEP 8, type hints required
- Line length: 100 characters
- Docstrings: Google style

### Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Update documentation
6. Submit PR with detailed description

## Related

- [Installation Guide](installation.md)
- [Configuration Reference](configuration.md)
- [Troubleshooting](troubleshooting.md)
