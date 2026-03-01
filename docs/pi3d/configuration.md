# GlowWorm Pi3D Display - Configuration Reference

Complete reference for all configuration options in `/etc/glowworm/config.yaml`.

## Configuration File Location

The daemon searches for configuration in this order:
1. `/etc/glowworm/config.yaml` (recommended for production)
2. `~/.config/glowworm/config.yaml` (user-specific)
3. `./config.yaml` (current directory)

## Configuration Sections

### Backend

Connection settings for the GlowWorm server.

```yaml
backend:
  url: "http://192.168.1.100:3003"
  device_token: ""
  websocket_url: ""
  connect_timeout: 10.0
  read_timeout: 30.0
  max_retries: 3
  retry_base_delay: 1.0
  retry_max_delay: 60.0
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | string | `http://localhost:3003` | URL of your GlowWorm server (the admin interface URL) |
| `device_token` | string | `""` | Authentication token (set automatically after registration) |
| `websocket_url` | string | `""` | WebSocket URL (auto-derived from `url` if not set) |
| `connect_timeout` | float | `10.0` | Connection timeout in seconds |
| `read_timeout` | float | `30.0` | Read timeout for HTTP requests |
| `max_retries` | int | `3` | Maximum connection retry attempts |
| `retry_base_delay` | float | `1.0` | Initial retry delay (exponential backoff) |
| `retry_max_delay` | float | `60.0` | Maximum retry delay |

### Display

Pi3D display rendering settings.

```yaml
display:
  orientation: portrait
  rotation: 0
  background_color: "#000000"
  fps_target: 30
  fullscreen: true
  width: 0
  height: 0
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `orientation` | string | `portrait` | Display orientation: `portrait` or `landscape` |
| `rotation` | int | `0` | Screen rotation in degrees: `0`, `90`, `180`, `270` |
| `background_color` | string | `#000000` | Background color in hex format |
| `fps_target` | int | `30` | Target frames per second (30 recommended) |
| `fullscreen` | bool | `true` | Run in fullscreen mode |
| `width` | int | `0` | Display width (0 = auto-detect) |
| `height` | int | `0` | Display height (0 = auto-detect) |

**Orientation vs Rotation:**
- `orientation` describes how the display is physically mounted
- `rotation` rotates the output to match your display's actual orientation
- Example: A 1080p TV mounted vertically would use `orientation: portrait` with `rotation: 90` or `rotation: 270`

### Slideshow

Slideshow timing and behavior.

```yaml
slideshow:
  display_time: 30.0
  transition_duration: 2.0
  scale_mode: fit
  preload_count: 3
  image_retry_delay: 2.0
  max_image_retries: 2
  playlist_update_interval: 300.0
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `display_time` | float | `30.0` | Seconds to display each image |
| `transition_duration` | float | `2.0` | Transition animation duration in seconds |
| `scale_mode` | string | `fit` | How to scale images: `fit`, `fill`, or `stretch` |
| `preload_count` | int | `3` | Number of upcoming images to preload |
| `image_retry_delay` | float | `2.0` | Delay between image load retries |
| `max_image_retries` | int | `2` | Maximum retries for failed image loads |
| `playlist_update_interval` | float | `300.0` | Seconds between playlist update checks |

**Scale Modes:**
- `fit` - Fit entire image within display (letterbox/pillarbox as needed)
- `fill` - Fill entire display (crop edges as needed)
- `stretch` - Stretch to fill (may distort image)

### Cache

Local image cache settings.

```yaml
cache:
  directory: /var/cache/glowworm/images
  max_size_mb: 500
  min_free_space_mb: 100
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `directory` | string | `/var/cache/glowworm/images` | Directory for cached images |
| `max_size_mb` | int | `500` | Maximum cache size in megabytes |
| `min_free_space_mb` | int | `100` | Minimum free disk space to maintain |

The cache uses LRU (Least Recently Used) eviction when limits are reached.

### State

Persistent state storage.

```yaml
state:
  directory: /var/lib/glowworm
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `directory` | string | `/var/lib/glowworm` | Directory for state files |

State includes:
- Current playlist position (resumes after restart)
- Playlist metadata

### IPC

Inter-process communication between daemon and display.

```yaml
ipc:
  socket_path: /run/glowworm/display.sock
  timeout: 5.0
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `socket_path` | string | `/run/glowworm/display.sock` | Unix socket path |
| `timeout` | float | `5.0` | IPC command timeout in seconds |

### Logging

Logging configuration.

```yaml
logging:
  level: INFO
  file: /var/log/glowworm/daemon.log
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `level` | string | `INFO` | Log level: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL` |
| `file` | string | `/var/log/glowworm/daemon.log` | Log file path (also logs to journald) |

### CEC

HDMI-CEC power control.

```yaml
cec:
  enabled: false
  display_address: 0
  adapter: /dev/cec0
  timeout: 5
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | bool | `false` | Enable HDMI-CEC power control |
| `display_address` | int | `0` | CEC logical address of the display (usually 0) |
| `adapter` | string | `/dev/cec0` | CEC adapter device path |
| `timeout` | int | `5` | CEC command timeout in seconds |

CEC allows the scheduler to turn your TV on/off at scheduled times.

## Environment Variable Overrides

Configuration can be overridden via environment variables with the `GLOWWORM_` prefix:

| Environment Variable | Config Path |
|---------------------|-------------|
| `GLOWWORM_BACKEND_URL` | `backend.url` |
| `GLOWWORM_DEVICE_TOKEN` | `backend.device_token` |
| `GLOWWORM_DISPLAY_ORIENTATION` | `display.orientation` |
| `GLOWWORM_DISPLAY_ROTATION` | `display.rotation` |
| `GLOWWORM_DISPLAY_BACKGROUND_COLOR` | `display.background_color` |
| `GLOWWORM_DISPLAY_FPS_TARGET` | `display.fps_target` |
| `GLOWWORM_SLIDESHOW_DISPLAY_TIME` | `slideshow.display_time` |
| `GLOWWORM_SLIDESHOW_TRANSITION_DURATION` | `slideshow.transition_duration` |
| `GLOWWORM_SLIDESHOW_SCALE_MODE` | `slideshow.scale_mode` |
| `GLOWWORM_CACHE_DIRECTORY` | `cache.directory` |
| `GLOWWORM_CACHE_MAX_SIZE_MB` | `cache.max_size_mb` |
| `GLOWWORM_IPC_SOCKET_PATH` | `ipc.socket_path` |
| `GLOWWORM_LOG_LEVEL` | `logging.level` |
| `GLOWWORM_LOG_FILE` | `logging.file` |
| `GLOWWORM_CEC_ENABLED` | `cec.enabled` |

Example:
```bash
export GLOWWORM_BACKEND_URL="http://192.168.1.50:3003"
sudo systemctl restart glowworm-daemon
```

## Complete Example Configuration

```yaml
# GlowWorm v3.0 Configuration
# Location: /etc/glowworm/config.yaml

# Backend connection
backend:
  url: "http://192.168.1.100:3003"
  device_token: ""  # Set automatically after registration
  # websocket_url: ""  # Usually auto-derived
  connect_timeout: 10.0
  read_timeout: 30.0
  max_retries: 3
  retry_base_delay: 1.0
  retry_max_delay: 60.0

# Display settings
display:
  orientation: portrait
  rotation: 90  # TV is rotated 90 degrees clockwise
  background_color: "#000000"
  fps_target: 30
  fullscreen: true
  # width: 0  # Auto-detect
  # height: 0  # Auto-detect

# Slideshow settings
slideshow:
  display_time: 45.0  # 45 seconds per image
  transition_duration: 2.5  # 2.5 second crossfade
  scale_mode: fit
  preload_count: 3
  image_retry_delay: 2.0
  max_image_retries: 2
  playlist_update_interval: 300.0

# Cache settings (adjust based on SD card size)
cache:
  directory: /var/cache/glowworm/images
  max_size_mb: 1000  # 1GB cache
  min_free_space_mb: 200

# State persistence
state:
  directory: /var/lib/glowworm

# IPC settings
ipc:
  socket_path: /run/glowworm/display.sock
  timeout: 5.0

# Logging (use DEBUG for troubleshooting)
logging:
  level: INFO
  file: /var/log/glowworm/daemon.log

# CEC control (enable for TV power scheduling)
cec:
  enabled: true
  display_address: 0
  adapter: /dev/cec0
  timeout: 5
```

## Configuration Wizard

The interactive configuration wizard can be run at any time:

```bash
sudo bash /opt/glowworm/scripts/configure.sh
```

This provides a menu-driven interface for changing settings without editing YAML directly.

## Applying Changes

After modifying the configuration:

```bash
sudo systemctl restart glowworm-daemon
```

Or send SIGHUP for a soft reload (limited settings):

```bash
sudo systemctl kill -s HUP glowworm-daemon
```

## Validation

The daemon validates configuration on startup and logs errors for invalid values:

```bash
# Check for configuration errors
sudo journalctl -u glowworm-daemon --no-pager | grep -i "config"
```

## Related

- [Installation Guide](installation.md)
- [Troubleshooting](troubleshooting.md)
- [Developer Documentation](development.md)
