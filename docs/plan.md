# GlowWorm v3.0 - Task Breakdown

Based on Rewrite.md, this document breaks down the implementation into concrete tasks with subtasks where complexity warrants, and includes testing requirements for each.

---

## Phase 1: Core Pi3D Display Engine

### Task 1.1: Project Structure Setup
**Complexity:** Low
**Description:** Create the glowworm-display Python package structure with proper packaging.

**Subtasks:**
- 1.1.1: Create directory structure (`display/glowworm_display/`)
- 1.1.2: Create `pyproject.toml` with dependencies (pi3d, Pillow, numpy)
- 1.1.3: Create `__init__.py` and `__main__.py` entry points
- 1.1.4: Create `config.py` with configuration dataclass

**Tests:**
- Package can be installed in development mode (`pip install -e .`)
- Entry point runs without import errors
- Configuration loads default values correctly

---

### Task 1.2: Pi3D Display Initialization
**Complexity:** Medium
**Description:** Initialize Pi3D for fullscreen display with correct orientation and background.

**Subtasks:**
- 1.2.1: Create `display.py` with Display class
- 1.2.2: Implement fullscreen initialization (detect resolution)
- 1.2.3: Implement orientation support (portrait/landscape, rotation 0/90/180/270)
- 1.2.4: Implement background color configuration
- 1.2.5: Handle display cleanup on exit

**Tests:**
- Display initializes without errors on Pi hardware
- Display initializes in mock mode on development machine
- Orientation settings are applied correctly
- Clean shutdown releases resources

---

### Task 1.3: Image Loading and Display
**Complexity:** Medium
**Description:** Load images from file paths and display them with proper aspect ratio handling.

**Subtasks:**
- 1.3.1: Create `image_loader.py` with async image loading
- 1.3.2: Implement texture creation from image files
- 1.3.3: Implement aspect ratio calculation (letterbox/pillarbox)
- 1.3.4: Create image sprite positioning logic
- 1.3.5: Handle common image formats (JPEG, PNG, WebP)
- 1.3.6: Implement error handling for corrupt/missing images

**Tests:**
- Load and display JPEG, PNG, WebP images
- Portrait images display correctly in portrait orientation
- Landscape images letterbox correctly in portrait orientation
- Missing file raises appropriate error
- Corrupt image handled gracefully (skip with error log)

---

### Task 1.4: Cross-fade Transition
**Complexity:** Medium
**Description:** Implement smooth cross-fade transition between two images.

**Subtasks:**
- 1.4.1: Create `transitions/base.py` with base Transition class
- 1.4.2: Create `transitions/crossfade.py` implementing CrossfadeTransition
- 1.4.3: Implement alpha blending between current and next image
- 1.4.4: Implement configurable transition duration
- 1.4.5: Implement transition progress callbacks

**Tests:**
- Transition completes in specified duration (±100ms tolerance)
- Alpha values interpolate smoothly (0→1 for new, 1→0 for old)
- FPS remains above 30 during transition on Pi 4
- Transition can be cancelled mid-way

---

### Task 1.5: Renderer Main Loop
**Complexity:** Medium
**Description:** Create the main rendering loop that manages image display and transitions.

**Subtasks:**
- 1.5.1: Create `renderer.py` with Renderer class
- 1.5.2: Implement main render loop with frame timing
- 1.5.3: Implement state machine (idle, displaying, transitioning, paused)
- 1.5.4: Implement image queue management
- 1.5.5: Implement pause/resume functionality

**Tests:**
- Render loop maintains stable FPS
- State transitions work correctly
- Pause stops transitions and image changes
- Resume continues from paused state
- Memory usage stable over extended operation (no leaks)

---

### Task 1.6: IPC Server
**Complexity:** High
**Description:** Implement JSON-RPC 2.0 server over Unix socket for daemon communication.

**Subtasks:**
- 1.6.1: Create `ipc_server.py` with async Unix socket server
- 1.6.2: Implement JSON-RPC 2.0 request parsing
- 1.6.3: Implement JSON-RPC 2.0 response formatting
- 1.6.4: Implement command handlers: `load_image`, `get_status`, `pause`, `resume`
- 1.6.5: Implement async notification sending (state_changed, error)
- 1.6.6: Handle connection lifecycle (connect, disconnect, reconnect)
- 1.6.7: Integrate IPC server with render loop (non-blocking)

**Tests:**
- Server creates socket at configured path
- Client can connect and send commands
- `load_image` command triggers image load
- `get_status` returns current state
- `pause`/`resume` commands work
- Notifications sent on state changes
- Multiple rapid commands handled correctly
- Server handles client disconnect gracefully

---

### Task 1.7: Registration Display Mode
**Complexity:** Low
**Status:** `passes: true`
**Description:** Display registration code on screen for device setup.

**Subtasks:**
- 1.7.1: Create `text_renderer.py` for text display
- 1.7.2: Implement large, centered registration code display
- 1.7.3: Implement visual "waiting" indicator (subtle animation or pulse)
- 1.7.4: Implement `show_registration` IPC command

**Tests:**
- Registration code displays large and readable
- Code updates when `show_registration` called with new code
- Transitions smoothly from registration to slideshow mode

---

### Task 1.8: Integration Testing - Display Engine
**Complexity:** Medium
**Status:** `passes: true`
**Description:** End-to-end testing of the Pi3D display engine.

**Subtasks:**
- 1.8.1: Create test harness that can run on development machine (mocked Pi3D)
- 1.8.2: Create integration test: load sequence of images via IPC
- 1.8.3: Create integration test: pause/resume during slideshow
- 1.8.4: Create performance benchmark script
- 1.8.5: Document manual testing procedure for Pi hardware

**Tests:**
- All unit tests pass
- Integration tests pass on development machine
- Manual testing checklist for Pi hardware completed
- Performance benchmarks meet targets (30+ FPS, <200MB RAM)

---

## Phase 2: Daemon Image Management

### Task 2.1: Image Manager - HTTP Client
**Complexity:** Medium
**Status:** `passes: true`
**Description:** HTTP client for fetching images from backend with caching support.

**Subtasks:**
- 2.1.1: Create `image_manager.py` with ImageManager class
- 2.1.2: Implement async HTTP client (aiohttp or httpx)
- 2.1.3: Implement ETag/Last-Modified header handling
- 2.1.4: Implement retry logic with exponential backoff
- 2.1.5: Implement download progress tracking

**Tests:**
- Successfully downloads image from backend
- Returns cached file if ETag matches (304 response)
- Retries on transient failures (network error, 503)
- Fails gracefully on permanent errors (404, 401)
- Progress callbacks fire during download

---

### Task 2.2: Image Manager - Local Cache
**Complexity:** Medium
**Status:** `passes: true`
**Description:** Local file cache with LRU eviction and disk space management.

**Subtasks:**
- 2.2.1: Implement cache directory structure
- 2.2.2: Implement cache metadata storage (SQLite or JSON)
- 2.2.3: Implement LRU eviction when max size exceeded
- 2.2.4: Implement minimum free space protection
- 2.2.5: Implement cache statistics (count, size, hit rate)
- 2.2.6: Implement cache clearing command

**Tests:**
- Images cached to correct directory
- LRU eviction removes oldest accessed images first
- Cache respects max_size_mb configuration
- Cache respects min_free_space_mb (doesn't fill disk)
- Statistics accurately reflect cache state
- Clear command removes all cached images

---

### Task 2.3: Playlist Manager
**Complexity:** Medium
**Status:** `passes: true`
**Description:** Manage playlist state, fetching from backend and tracking position.

**Subtasks:**
- 2.3.1: Create `playlist_manager.py` with PlaylistManager class
- 2.3.2: Implement playlist fetching from backend API
- 2.3.3: Implement playlist parsing and validation
- 2.3.4: Implement current position tracking (persisted across restarts)
- 2.3.5: Implement shuffle mode with deterministic seed
- 2.3.6: Implement next/previous navigation
- 2.3.7: Implement playlist version checking for updates

**Tests:**
- Fetches playlist from backend successfully
- Handles empty playlist gracefully
- Position persists across daemon restart
- Shuffle produces random but repeatable order (same seed = same order)
- next() advances position, wraps at end
- previous() goes back, wraps at beginning
- Detects playlist version changes

---

### Task 2.4: Preloading Logic
**Complexity:** Low
**Status:** `passes: true`
**Description:** Preload next N images in background while current image displays.

**Subtasks:**
- 2.4.1: Implement preload queue based on playlist position
- 2.4.2: Implement background download task
- 2.4.3: Implement preload priority (next image highest priority)
- 2.4.4: Cancel preload of images no longer needed (playlist changed)

**Tests:**
- Next N images preloaded after current image displays
- Preloading doesn't block main slideshow operation
- Preload cancelled when playlist changes
- No duplicate downloads (already cached images skipped)

---

### Task 2.5: Integration Testing - Image Management
**Complexity:** Low
**Status:** `passes: true`
**Description:** Test image manager and playlist manager together.

**Tests:**
- Playlist fetched and images downloaded to cache
- Slideshow can operate entirely from cache (offline simulation)
- Cache eviction works during extended operation
- Playlist update triggers new image downloads

---

## Phase 3: Daemon-Pi3D Integration

### Task 3.1: Display Controller
**Complexity:** High
**Status:** `passes: true`
**Description:** Manage Pi3D display as subprocess with health monitoring.

**Subtasks:**
- 3.1.1: Create `display_controller.py` with DisplayController class
- 3.1.2: Implement subprocess spawning with proper environment
- 3.1.3: Implement IPC client (JSON-RPC over Unix socket)
- 3.1.4: Implement health check (periodic get_status)
- 3.1.5: Implement crash detection and auto-restart
- 3.1.6: Implement graceful shutdown
- 3.1.7: Implement startup timeout handling

**Tests:**
- Pi3D subprocess starts successfully
- IPC commands sent and responses received
- Crashed subprocess detected within 10 seconds
- Auto-restart recovers from crash
- Graceful shutdown stops subprocess cleanly
- Startup timeout triggers restart attempt

---

### Task 3.2: Slideshow Orchestration
**Complexity:** Medium
**Status:** `passes: true`
**Description:** Coordinate playlist, image cache, and display controller for slideshow.

**Subtasks:**
- 3.2.1: Create slideshow loop in daemon main
- 3.2.2: Implement image duration timing
- 3.2.3: Implement transition triggering via IPC
- 3.2.4: Implement next/previous command handling
- 3.2.5: Implement pause/resume state management
- 3.2.6: Handle missing images (skip, log error)

**Tests:**
- Images advance at configured interval
- Transitions use configured duration
- next/previous commands work immediately
- Pause stops advancement, resume continues
- Missing image skipped, slideshow continues
- All operations work while offline (cached images)

---

### Task 3.3: Configuration Unification
**Complexity:** Low
**Status:** `passes: true`
**Description:** Unified YAML configuration for daemon and display settings.

**Subtasks:**
- 3.3.1: Define unified config schema (as in Rewrite.md)
- 3.3.2: Update daemon config.py to load new format
- 3.3.3: Pass display config to Pi3D subprocess
- 3.3.4: Implement config validation with helpful errors
- 3.3.5: Implement config reload on SIGHUP (optional)

**Tests:**
- Configuration loads from /etc/glowworm/config.yaml
- Missing optional values use sensible defaults
- Invalid configuration raises clear error message
- Display receives correct orientation/timing settings

---

### Task 3.4: Integration Testing - Full Slideshow
**Complexity:** Medium
**Status:** `passes: true`
**Description:** End-to-end testing of daemon controlling Pi3D slideshow.

**Tests:**
- Daemon starts, spawns Pi3D, begins slideshow
- Images transition at correct intervals
- Commands via IPC affect slideshow (next, pause, etc.)
- Daemon survives Pi3D crash and restarts it
- Works offline with cached playlist/images

---

## Phase 4: WebSocket Communication

### Task 4.1: WebSocket Client
**Complexity:** High
**Status:** `passes: true`
**Description:** Persistent WebSocket connection from daemon to backend.

**Subtasks:**
- 4.1.1: Create `websocket_client.py` with WebSocketClient class
- 4.1.2: Implement connection with authentication (device token)
- 4.1.3: Implement auto-reconnect with exponential backoff
- 4.1.4: Implement heartbeat/ping-pong handling
- 4.1.5: Implement message receive handler
- 4.1.6: Implement message send with offline queue
- 4.1.7: Implement connection state tracking

**Tests:**
- Connects to backend WebSocket endpoint
- Authenticates with device token
- Reconnects after connection drop
- Backoff increases on repeated failures
- Messages queued when offline, sent on reconnect
- Heartbeat keeps connection alive

---

### Task 4.2: Status Reporting
**Complexity:** Low
**Status:** `passes: true`
**Description:** Report device status to backend via WebSocket.

**Subtasks:**
- 4.2.1: Define status message schema
- 4.2.2: Implement periodic status reporting (every 30s)
- 4.2.3: Implement immediate status report on state change
- 4.2.4: Include: current_image_id, state, cache_stats, uptime

**Tests:**
- Status messages sent at configured interval
- Status sent immediately on state change
- Status includes all required fields
- Status queued when offline

---

### Task 4.3: Command Reception
**Complexity:** Medium
**Status:** `passes: true`
**Description:** Receive and execute commands from backend via WebSocket.

**Subtasks:**
- 4.3.1: Implement command message parsing
- 4.3.2: Route commands to appropriate handlers
- 4.3.3: Implement: next, previous, pause, resume
- 4.3.4: Implement: reload_playlist
- 4.3.5: Send command acknowledgment/result

**Tests:**
- Commands parsed correctly from WebSocket messages
- next/previous trigger immediate image change
- pause/resume affect slideshow state
- reload_playlist fetches new playlist version
- Unknown commands logged but don't crash

---

### Task 4.4: Backend WebSocket Updates
**Complexity:** Medium
**Status:** `passes: true`
**Description:** Update backend WebSocket handling for Pi3D device protocol.

**Subtasks:**
- 4.4.1: Update WebSocket manager for new device message types
- 4.4.2: Store device status in Redis for quick access
- 4.4.3: Broadcast device status to admin connections
- 4.4.4: Implement command sending to specific device
- 4.4.5: Update device model with last_status fields

**Tests:**
- Backend receives and parses device status messages
- Status stored in Redis with TTL
- Admin WebSocket receives device status updates
- Commands sent to device via WebSocket
- Device shows correct status in admin UI

---

### Task 4.5: Integration Testing - WebSocket
**Complexity:** Medium
**Status:** `passes: true`
**Description:** Test full WebSocket communication flow.

**Tests:**
- Device connects and authenticates
- Status updates reach backend and admin UI
- Commands from admin UI reach device
- Offline queuing and reconnection work
- Multiple devices work simultaneously

---

## Phase 5: Device Registration Flow

### Task 5.1: Daemon Registration Mode
**Complexity:** Medium
**Status:** `passes: true`
**Description:** Daemon starts in registration mode when no token configured.

**Subtasks:**
- 5.1.1: Detect missing device token in config
- 5.1.2: Request registration code from backend
- 5.1.3: Display code via Pi3D (show_registration command)
- 5.1.4: Poll backend for authorization status
- 5.1.5: On authorization: save token, switch to normal mode
- 5.1.6: Handle registration rejection

**Tests:**
- Daemon detects missing token and enters registration mode
- Registration code displayed on screen
- Polling detects authorization within 10 seconds
- Token saved to config file
- Normal slideshow starts after authorization
- Rejection displayed, re-registration offered

---

### Task 5.2: Backend Registration Endpoints
**Complexity:** Medium
**Status:** `passes: true`
**Description:** API endpoints for daemon-based device registration.

**Subtasks:**
- 5.2.1: Create `POST /api/devices/register` for daemon registration
- 5.2.2: Generate and return 4-character registration code
- 5.2.3: Create `GET /api/devices/register/{code}/status` for polling
- 5.2.4: Return full device config on authorization
- 5.2.5: Update existing authorization flow to support daemon devices

**Tests:**
- Registration returns unique code
- Status endpoint returns PENDING initially
- Authorization changes status to AUTHORIZED
- Config returned includes playlist assignment
- Rejection changes status to REJECTED

---

### Task 5.3: Frontend Registration Updates
**Complexity:** Low
**Status:** `passes: true`
**Description:** Update frontend to support daemon device registration.

**Subtasks:**
- 5.3.1: Update device authorization dialog for daemon devices
- 5.3.2: Show "Device Type: Pi3D" indicator
- 5.3.3: Remove browser display launch option for Pi3D devices
- 5.3.4: Update registration instructions page

**Tests:**
- Daemon devices appear in pending device list
- Authorization works for daemon devices
- UI clearly indicates device type
- Help text appropriate for Pi3D setup

---

### Task 5.4: Integration Testing - Registration
**Complexity:** Low
**Status:** `passes: true`
**Description:** Test complete registration flow.

**Tests:**
- Fresh daemon displays registration code
- Admin authorizes device
- Daemon detects authorization and starts slideshow
- Device appears correctly in admin device list

---

## Phase 6: Frontend Admin Updates

### Task 6.1: Device Status Display
**Complexity:** Medium
**Status:** `passes: true`
**Description:** Show real-time Pi3D device status in admin interface.

**Subtasks:**
- 6.1.1: Update device list with current image thumbnail
- 6.1.2: Add connection status indicator (online/offline/connecting)
- 6.1.3: Add cache statistics display (count, size)
- 6.1.4: Add slideshow state indicator (playing/paused)
- 6.1.5: Show last seen timestamp for offline devices

**Tests:**
- Current image thumbnail updates in real-time
- Connection status reflects actual state
- Cache stats update periodically
- State indicator shows correct state
- Offline devices show last seen time

---

### Task 6.2: Device Controls
**Complexity:** Medium
**Status:** `passes: true`
**Description:** Control buttons for Pi3D devices.

**Subtasks:**
- 6.2.1: Add next/previous image buttons
- 6.2.2: Add play/pause toggle button
- 6.2.3: Add force playlist sync button
- 6.2.4: Add clear cache button
- 6.2.5: Implement optimistic UI updates
- 6.2.6: Handle command failures gracefully

**Tests:**
- Next/previous buttons trigger image change
- Play/pause toggles slideshow state
- Playlist sync triggers reload
- Clear cache empties device cache
- Buttons disabled for offline devices
- Error toast shown on command failure

---

### Task 6.3: Remove Browser Display Code
**Complexity:** Low
**Status:** `passes: true`
**Description:** Remove deprecated browser-based display components.

**Subtasks:**
- 6.3.1: Remove `/display/{slug}` route and components
- 6.3.2: Remove browser-specific slideshow code
- 6.3.3: Update `/display/register` to show Pi3D setup instructions
- 6.3.4: Remove FullPageOS-specific documentation references

**Tests:**
- `/display/{slug}` returns 404
- No broken imports or references
- Registration page shows correct instructions

---

### Task 6.4: Integration Testing - Frontend
**Complexity:** Low
**Status:** `passes: true`
**Description:** Test admin interface with Pi3D devices.

**Tests:**
- Device list shows Pi3D devices correctly
- Real-time updates work (WebSocket)
- All control buttons functional
- No console errors or broken UI

---

## Phase 7: Polish and Testing

### Task 7.1: Error Handling
**Complexity:** Medium
**Description:** Comprehensive error handling throughout the system.

**Subtasks:**
- 7.1.1: Pi3D displays user-friendly error screen
- 7.1.2: Daemon logs errors with context
- 7.1.3: Backend returns appropriate error codes
- 7.1.4: Frontend shows actionable error messages
- 7.1.5: Implement error recovery strategies

**Tests:**
- Network errors don't crash daemon
- Image load errors skip image and continue
- Pi3D crash triggers restart
- User sees helpful error info, not stack traces

**Status:** `passes: true`

---

### Task 7.2: Performance Optimization
**Complexity:** Medium
**Status:** `passes: true`
**Description:** Optimize for smooth operation on Pi hardware.

**Subtasks:**
- 7.2.1: Profile Pi3D transitions on Pi 3/4/5
- 7.2.2: Optimize image loading (size, format, preload timing)
- 7.2.3: Reduce memory usage (texture recycling)
- 7.2.4: Optimize cache operations (background I/O)
- 7.2.5: Add performance monitoring/logging

**Tests:**
- 30+ FPS transitions on Pi 4
- <200MB RAM usage in steady state
- <5% CPU when displaying static image
- No memory growth over 24h operation

---

### Task 7.3: Installation Automation
**Complexity:** Medium
**Status:** `passes: true`
**Description:** Scripts and services for easy deployment.

**Subtasks:**
- 7.3.1: Create install.sh setup script
- 7.3.2: Create systemd service file for daemon
- 7.3.3: Create initial configuration wizard
- 7.3.4: Create uninstall.sh cleanup script
- 7.3.5: Test on fresh Raspberry Pi OS install

**Tests:**
- Install script completes without errors
- Service starts automatically on boot
- Configuration wizard creates valid config
- Uninstall removes all components cleanly

---

### Task 7.4: Documentation
**Complexity:** Low
**Description:** User and developer documentation.

**Subtasks:**
- 7.4.1: Installation guide (Pi setup, dependencies, configuration)
- 7.4.2: Configuration reference (all options explained)
- 7.4.3: Troubleshooting guide (common issues)
- 7.4.4: Developer documentation (architecture, IPC protocol)
- 7.4.5: Update project README

**Tests:**
- New user can follow installation guide successfully
- All config options documented with examples
- Common issues have documented solutions

---

### Task 7.5: Final Integration Testing
**Complexity:** High
**Description:** Complete system testing before release.

**Subtasks:**
- 7.5.1: Fresh install test on Pi 4 and Pi 5
- 7.5.2: 24-hour stability test
- 7.5.3: Offline operation test (disconnect backend for hours)
- 7.5.4: Multi-device test (3+ devices simultaneously)
- 7.5.5: Playlist update test (add/remove images while running)
- 7.5.6: Power cycle test (survive reboot, power loss)

**Tests:**
- All installation steps complete on fresh Pi
- No crashes or memory leaks over 24 hours
- Operates normally after hours offline
- Multiple devices work independently
- Playlist changes reflected correctly
- Survives unexpected power loss

---

## Task Summary

| Phase | Tasks | Estimated Complexity |
|-------|-------|---------------------|
| Phase 1: Pi3D Display Engine | 8 tasks | High |
| Phase 2: Daemon Image Management | 5 tasks | Medium |
| Phase 3: Daemon-Pi3D Integration | 4 tasks | High |
| Phase 4: WebSocket Communication | 5 tasks | High |
| Phase 5: Device Registration | 4 tasks | Medium |
| Phase 6: Frontend Admin Updates | 4 tasks | Medium |
| Phase 7: Polish and Testing | 5 tasks | Medium |
| **Total** | **35 tasks** | |

---

## Dependencies

```
Phase 1 (Display Engine) → Phase 3 (Integration)
Phase 2 (Image Management) → Phase 3 (Integration)
Phase 3 (Integration) → Phase 4 (WebSocket)
Phase 4 (WebSocket) → Phase 5 (Registration)
Phase 5 (Registration) → Phase 6 (Frontend)
Phases 1-6 → Phase 7 (Polish)
```

Phases 1 and 2 can be worked on in parallel.
Phase 6 (Frontend) can begin after Phase 4, with some parts parallelizable.
