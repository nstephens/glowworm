# GlowWorm v3.0 Activity Log

## 2026-02-28 14:29 - Task 1.1: Project Structure Setup

### What Changed
Created the `glowworm-display` Python package structure for the Pi3D display engine.

### Files Created
- `display/pyproject.toml` - Package configuration with dependencies (pi3d>=2.55, Pillow, numpy, PyYAML)
- `display/glowworm_display/__init__.py` - Package init with version and exports
- `display/glowworm_display/__main__.py` - CLI entry point with argument parsing
- `display/glowworm_display/config.py` - DisplayConfig dataclass with YAML loading support
- `display/glowworm_display/transitions/__init__.py` - Empty transitions subpackage

### Verification
- Package installs successfully via `pip install -e display/`
- Entry point `glowworm-display --mock` runs without import errors
- Configuration dataclass correctly validates and normalizes values
- Version flag works: `glowworm-display --version` outputs `3.0.0`

### Notes
- Fixed pi3d version requirement from 2.57 to 2.55 (2.57 doesn't exist yet)
- Configuration supports both YAML file loading and environment variable overrides
- Mock mode allows testing on development machine without Pi3D display

### Next Task
Task 1.2: Pi3D Display Initialization

## 2026-02-28 14:32 - Task 1.2: Pi3D Display Initialization

### What Changed
Implemented the Pi3D Display class for managing fullscreen display initialization, orientation, background color, and resource cleanup.

### Files Created
- `display/glowworm_display/display.py` - Display class with:
  - `MockDisplay` and `MockCamera` classes for development/testing without Pi3D
  - `Display` class with fullscreen initialization
  - Resolution auto-detection (or use configured width/height)
  - Orientation/rotation support via config
  - Background color configuration (hex to RGB conversion)
  - Signal handlers for graceful shutdown (SIGTERM, SIGINT)
  - Context managers for frame rendering and resource lifecycle
  - `create_display()` factory function

### Files Modified
- `display/glowworm_display/__init__.py` - Added exports for `Display` and `create_display`
- `display/glowworm_display/__main__.py` - Integrated Display class:
  - Display initializes on startup with mock mode support
  - Added `--test-frames N` option for testing frame loop
  - Basic render loop placeholder (clears/swaps buffers)
  - Proper cleanup on exit

### Verification
- `glowworm-display --mock` initializes MockDisplay at 1920x1080 and exits cleanly
- `glowworm-display --mock --test-frames 100` runs 100 frames successfully
- `glowworm-display --mock --config <yaml>` loads custom orientation, rotation, background color, fps_target
- `glowworm-display --version` still outputs `3.0.0`
- Cleanup handlers registered for SIGTERM/SIGINT

### Notes
- Real Pi3D initialization deferred until hardware testing (creates display with auto-detect resolution)
- Mock mode uses 1920x1080 default resolution
- Rotation stored in config but actual sprite rotation happens in image rendering (Task 1.3)
- Frame context manager (`with display.frame():`) simplifies render loop

### Next Task
Task 1.3: Image Loading and Display

## 2026-02-28 14:36 - Task 1.3: Image Loading and Display

### What Changed
Implemented the ImageLoader class for loading images, creating Pi3D textures, calculating aspect ratios, and positioning sprites for display.

### Files Created
- `display/glowworm_display/image_loader.py` - ImageLoader class with:
  - `MockTexture` and `MockSprite` classes for development/testing without Pi3D
  - `ImageLoader` class for loading images and creating sprites
  - `ScaleMode` enum (FIT, FILL, STRETCH) for image scaling options
  - `ImageDimensions` dataclass for calculated display dimensions
  - `ImageLoadError` custom exception for error handling
  - Texture loading from files (JPEG, PNG, WebP, GIF, BMP)
  - Aspect ratio calculation with letterbox/pillarbox support
  - Sprite creation with proper positioning and rotation
  - Preload capability for upcoming slideshow images

### Files Modified
- `display/glowworm_display/__init__.py` - Added exports for `ImageLoader`, `ImageLoadError`, `ScaleMode`
- `display/glowworm_display/__main__.py` - Integrated ImageLoader:
  - Added `--test-image` argument to display a test image
  - Added `--scale-mode` argument (fit, fill, stretch)
  - ImageLoader created after display initialization
  - Test images rendered in frame loop

### Verification
- `glowworm-display --mock` still initializes and exits cleanly
- `glowworm-display --mock --test-image <path> --test-frames 100` loads and "displays" images
- Scale modes (fit, fill, stretch) calculate correct dimensions
- Missing files raise `ImageLoadError` with clear message
- Unsupported formats (e.g., .toml) raise `ImageLoadError` with format list
- Portrait/landscape images calculate correct letterbox/pillarbox dimensions
- `glowworm-display --version` outputs `3.0.0`

### Notes
- Pi3D sprites use `uv_flat` shader for 2D image display
- Rotation applied to sprites via `rotateToZ()` method
- Mock mode uses PIL to read image dimensions only
- Supported formats: JPEG, PNG, WebP, GIF, BMP

### Next Task
Task 1.4: Cross-fade Transition

## 2026-02-28 14:40 - Task 1.4: Cross-fade Transition

### What Changed
Implemented the cross-fade transition system with a base Transition class and CrossfadeTransition implementation for smooth alpha-blending between images.

### Files Created
- `display/glowworm_display/transitions/base.py` - Base transition class with:
  - `Transition` abstract base class with start/cancel/update/render methods
  - `TransitionState` enum (IDLE, RUNNING, COMPLETED, CANCELLED)
  - `TransitionProgress` dataclass for progress information
  - Progress callback support for external monitoring
  - Easing function support (linear, ease-in-out-cubic, ease-out-quad)

- `display/glowworm_display/transitions/crossfade.py` - CrossfadeTransition with:
  - Alpha blending between current (outgoing) and next (incoming) sprites
  - Configurable transition duration
  - Optional easing (cubic ease-in-out by default)
  - Proper Z-depth layering for sprite overlap
  - `render_single()` method for fade in/out from blank screen

### Files Modified
- `display/glowworm_display/transitions/__init__.py` - Added exports for all transition classes
- `display/glowworm_display/__init__.py` - Added CrossfadeTransition, Transition, TransitionProgress, TransitionState to package exports
- `display/glowworm_display/__main__.py` - Added CLI options for transition testing:
  - `--test-transition <path>` - Second image for testing cross-fade
  - `--transition-duration <seconds>` - Configurable transition time

### Verification
- Imports work correctly from package root
- Transition completes within ±100ms of specified duration (tested with 0.5s → 0.532s)
- Alpha values interpolate correctly (0→1 for incoming, 1→0 for outgoing)
- Progress callback fires at each frame update
- Transition cancellation works mid-way
- CLI test mode works: `glowworm-display --mock --test-image img1.jpg --test-transition img2.jpg --transition-duration 0.5`
- Existing CLI modes still work (--mock, --test-frames, --version)

### Notes
- FPS testing in mock mode shows very high values (300k+) since no actual GPU rendering occurs
- Real Pi3D hardware testing will verify 30+ FPS performance (Task 1.8)
- Transition duration timing uses `time.time()` for simplicity; may need refinement for frame-perfect timing
- Easing functions can be swapped by setting `use_easing=False` for linear interpolation

### Next Task
Task 1.5: Renderer Main Loop

## 2026-02-28 14:45 - Task 1.5: Renderer Main Loop

### What Changed
Implemented the Renderer class that manages the main render loop, image queue, state machine, and pause/resume functionality.

### Files Created
- `display/glowworm_display/renderer.py` - Renderer class with:
  - `RendererState` enum (IDLE, DISPLAYING, TRANSITIONING, PAUSED)
  - `RenderStats` dataclass for performance statistics (frame count, FPS, timing)
  - `QueuedImage` dataclass for images in the queue
  - `Renderer` class with:
    - State machine managing idle/displaying/transitioning/paused states
    - Image queue management (queue_image, load_image_immediate)
    - Main render loop (run, run_once) with frame timing
    - Pause/resume functionality preserving transition state
    - State change callbacks for external monitoring
    - Status reporting (get_status)
    - Clear functionality to reset state

### Files Modified
- `display/glowworm_display/__init__.py` - Added exports for `Renderer`, `RendererState`, `RenderStats`
- `display/glowworm_display/__main__.py`:
  - Added `--test-renderer` CLI option for testing renderer with queued images
  - Updated main render loop to use Renderer class instead of placeholder
  - Test mode exercises pause/resume during transitions

### Verification
- Imports work correctly: `from glowworm_display import Renderer, RendererState, RenderStats`
- `glowworm-display --mock` initializes and exits cleanly
- `glowworm-display --mock --test-renderer --test-image <img1> --test-transition <img2>`:
  - Queues 2 images successfully
  - State transitions: idle → transitioning → paused → transitioning → displaying → transitioning → displaying
  - Pause/resume during transition works correctly (transition continues after resume)
  - All images displayed, queue empties
  - Statistics tracked (frame count, avg FPS, images displayed, transition count)
  - Current image path tracked in status
- `glowworm-display --version` outputs `3.0.0`

### Notes
- Mock mode runs at very high FPS (200k+) since no actual GPU rendering occurs
- Render loop uses `time.time()` for frame timing; transition timing is wall-clock based
- State machine correctly handles:
  - Queue processing when idle or displaying
  - Transition completion and sprite swap
  - Pause preserving previous state
  - Resume restoring to correct state (including mid-transition)
- Memory management: sprites are properly swapped, no accumulation

### Next Task
Task 1.6: IPC Server

## 2026-02-28 14:50 - Task 1.6: IPC Server

### What Changed
Implemented JSON-RPC 2.0 server over Unix domain sockets for daemon communication with the Pi3D display engine.

### Files Created
- `display/glowworm_display/ipc_server.py` - IPC server implementation with:
  - `IPCServer` class for async Unix socket server
  - `IPCServerConfig` dataclass for configuration
  - `IPCClient` class for client connection management
  - `ConnectionState` enum for connection tracking
  - JSON-RPC 2.0 request parsing and response formatting
  - Command handlers: `load_image`, `queue_image`, `get_status`, `pause`, `resume`, `clear`
  - Async notification sending (`state_changed`)
  - `create_ipc_server()` factory function

### Files Modified
- `display/glowworm_display/__init__.py` - Added exports for `IPCServer`, `IPCServerConfig`, `create_ipc_server`
- `display/glowworm_display/__main__.py`:
  - Added asyncio support for running render loop with IPC server
  - Added `--test-ipc` CLI option for IPC server testing
  - Integrated IPC server with main render loop via `run_with_ipc()` function
  - State changes now send notifications to all connected IPC clients

### Verification
- Imports work correctly: `from glowworm_display import IPCServer, IPCServerConfig, create_ipc_server`
- `glowworm-display --mock` still initializes and exits cleanly
- `glowworm-display --mock --test-ipc --socket /tmp/glowworm/display.sock`:
  - Server creates socket at configured path
  - Client can connect and send JSON-RPC commands
  - `get_status` returns current renderer state and statistics
  - `pause` command pauses renderer and sends notification
  - `resume` command resumes renderer and sends notification
  - Invalid methods return proper JSON-RPC error (code -32601)
  - Server handles client disconnect gracefully
  - Multiple commands handled correctly in sequence
- `glowworm-display --version` outputs `3.0.0`
- `--test-renderer` mode still works with IPC integration

### IPC Protocol
Commands (JSON-RPC 2.0):
- `get_status` → Returns state, is_running, is_paused, current_image, queue_length, stats
- `pause` → Pauses renderer, returns success + state
- `resume` → Resumes renderer, returns success + state
- `clear` → Clears display and queue, returns success
- `load_image(path, scale_mode?, transition_duration?)` → Loads image immediately
- `queue_image(path, scale_mode?, transition_duration?)` → Queues image for display

Notifications (sent to all clients):
- `state_changed` → {state: string} - Sent after state-changing commands

### Notes
- Server uses asyncio for non-blocking I/O
- Render loop runs with `await asyncio.sleep(0)` to yield to IPC tasks
- Notifications are sent after responses using `asyncio.create_task()` with small delay
- Socket permissions set to 0o660 for group access
- Server cleans up socket file on stop

### Next Task
Task 1.7: Registration Display Mode

## 2026-02-28 14:54 - Task 1.7: Registration Display Mode

### What Changed
Implemented text rendering for registration code display with animated waiting indicators.

### Files Created
- `display/glowworm_display/text_renderer.py` - TextRenderer class with:
  - `MockFont` and `MockText` classes for development/testing without Pi3D
  - `TextStyle` dataclass for text styling configuration
  - `TextRenderer` class for GPU-accelerated text display
  - Large, centered registration code display
  - Animated waiting indicator with pulsing code and staggered dots
  - `set_registration_code()` and `clear_registration()` methods
  - `render_registration()` for frame-by-frame rendering

### Files Modified
- `display/glowworm_display/__init__.py` - Added exports for `TextRenderer`, `TextStyle`
- `display/glowworm_display/renderer.py`:
  - Added `RendererState.REGISTRATION` enum value
  - Added `TextRenderer` integration with mock mode support
  - Added `show_registration()` and `hide_registration()` methods
  - Added `is_showing_registration` and `registration_code` properties
  - Updated `_render_frame()` to handle registration state
  - Updated `get_status()` to include registration info
- `display/glowworm_display/ipc_server.py`:
  - Added `show_registration` IPC command handler
  - Added `hide_registration` IPC command handler
- `display/glowworm_display/__main__.py`:
  - Added `--test-registration` CLI argument
  - Added registration display test mode
  - Updated Renderer instantiation to pass mock parameter

### Verification
- `glowworm-display --mock` still initializes and exits cleanly
- `glowworm-display --mock --test-registration ABCD` displays registration code with animation:
  - State shows as "registration"
  - `is_registration: True`
  - `registration_code: "ABCD"`
- IPC commands work:
  - `show_registration` with `code` param sets registration mode
  - `hide_registration` returns to idle state
  - State change notifications sent to connected clients
- `glowworm-display --version` outputs `3.0.0`

### IPC Protocol Updates
New commands:
- `show_registration(code)` → {success, state, code} - Display registration code
- `hide_registration` → {success, state} - Hide registration display

### Notes
- Registration display uses pulse animation (0.85-1.0 alpha, 2s cycle) on code
- Waiting dots animate with staggered timing (0.5s cycle per dot)
- Registration state is preserved separately from pause/resume states
- Text uses DejaVu fonts on real Pi3D, mock text objects in mock mode
- Registration mode clears any current image/transition before displaying

### Next Task
Task 1.8: Integration Testing - Display Engine

## 2026-02-28 15:05 - Task 1.8: Integration Testing - Display Engine

### What Changed
Created comprehensive integration tests, performance benchmarks, and manual testing documentation for the Pi3D display engine.

### Files Created
- `display/tests/__init__.py` - Test package init
- `display/tests/conftest.py` - Pytest fixtures and test harness:
  - Test fixtures for mock display, image loader, renderer
  - Test image generation helpers (solid color images)
  - `IPCTestClient` class for async IPC communication testing
  - Fixtures for temporary directories and IPC socket paths
- `display/tests/test_integration_ipc.py` - 24 integration tests covering:
  - Image loading via IPC (queue_image, load_image)
  - Image sequence display
  - Scale mode parameters
  - Pause/resume during slideshow
  - Pause during transitions
  - Queue processing behavior while paused
  - Clear functionality
  - Registration display mode
  - Status reporting
  - Multiple client connections
  - Connection error handling
  - Invalid JSON/method handling
- `display/tests/benchmark.py` - Performance benchmark script:
  - Static display FPS measurement
  - Transition FPS measurement
  - Memory stability testing (30+ image sequences)
  - Pass/fail thresholds (30+ FPS hardware, 100+ mock)
  - Memory growth limits (<50MB)
- `display/tests/MANUAL_TESTING.md` - Manual testing checklist:
  - 10 test cases with step-by-step procedures
  - Pass/fail checkboxes
  - Expected results
  - Performance targets table
  - Pi hardware testing commands

### Verification
- All 24 pytest integration tests pass: `pytest display/tests/ -v`
- Performance benchmark passes in mock mode: `python -m tests.benchmark --mock`
- Mock mode FPS: 200k+ (expected for non-GPU rendering)
- Memory stability: no growth over 30 image transitions
- Test harness correctly handles IPC notifications interleaved with responses

### Notes
- Integration tests use async fixtures with pytest-asyncio
- IPCTestClient properly skips notification messages when waiting for responses
- Benchmark targets are different for mock (100+ FPS) vs hardware (30+ FPS)
- Manual testing document covers extended operation (1-hour stability test)
- Test images are generated dynamically as solid-color JPEGs

### Next Task
Task 2.1: Image Manager - HTTP Client

## 2026-02-28 16:15 - Task 2.1: Image Manager - HTTP Client

### What Changed
Implemented async HTTP client for fetching images from backend with caching support.

### Files Created
- `daemon/glowworm_daemon/image_manager.py` - ImageManager class with:
  - `ImageManager` class for async image downloads using aiohttp
  - `ImageManagerConfig` dataclass for configuration
  - `DownloadProgress` dataclass for progress tracking
  - `CacheEntry` dataclass for cache metadata
  - `DownloadStatus` enum (PENDING, DOWNLOADING, COMPLETE, CACHED, FAILED, CANCELLED)
  - ETag/Last-Modified header handling for conditional requests (304 support)
  - Exponential backoff retry logic (configurable base delay, max delay, max retries)
  - Download progress callbacks with bytes downloaded/total tracking
  - `ImageNotFoundError` and `AuthenticationError` custom exceptions
  - Cache statistics reporting (`get_cache_stats()`)
  - Async context manager support (`async with ImageManager(...)`)

- `daemon/tests/__init__.py` - Test package init
- `daemon/tests/conftest.py` - Pytest configuration for async tests
- `daemon/tests/test_image_manager.py` - 27 unit tests covering:
  - Configuration defaults and cache directory creation
  - URL building and cache path generation
  - Content-type to extension mapping
  - Session lifecycle (start/stop)
  - Successful downloads with progress tracking
  - 304 Not Modified (cache hit) handling
  - 404 and 401/403 error handling
  - Retry on server errors (5xx)
  - Max retries exceeded
  - Cache clearing
  - Conditional request headers
  - Force download ignoring cache

### Files Modified
- `daemon/glowworm_daemon/__init__.py` - Added exports for ImageManager classes, bumped version to 3.0.0
- `daemon/setup.py` - Added `aiohttp>=3.9.0` dependency, `pytest-asyncio>=0.23.0` dev dependency

### Verification
- All 27 tests pass: `pytest daemon/tests/test_image_manager.py -v`
- Package installs successfully with dependencies
- Imports work correctly: `from glowworm_daemon import ImageManager, ImageManagerConfig`

### API Summary
```python
# Configuration
config = ImageManagerConfig(
    backend_url="http://localhost:8000",
    device_token="token-123",
    cache_dir="/var/cache/glowworm/images",
    max_retries=3,
    retry_base_delay=1.0,
    retry_max_delay=60.0,
)

# Usage
async with ImageManager(config) as manager:
    # Download with progress
    def on_progress(progress: DownloadProgress):
        print(f"{progress.progress_percent:.1f}%")

    path, status = await manager.download_image(
        image_id=123,
        progress_callback=on_progress
    )

    # Check cache
    if manager.is_cached(123):
        path = manager.get_cached_path(123)

    # Stats
    stats = manager.get_cache_stats()
```

### Notes
- Backend fetches use `/api/images/{image_id}/file` endpoint
- ETag/Last-Modified headers are stored in cache metadata for conditional requests
- On 304 response, returns cached file path without re-downloading
- Retry with exponential backoff: 1s, 2s, 4s... up to max_delay
- Progress callbacks fire on each chunk (64KB default)
- Cache metadata is in-memory; persistence to be added in Task 2.2

### Next Task
Task 2.2: Image Manager - Local Cache

## 2026-02-28 16:45 - Task 2.2: Image Manager - Local Cache

### What Changed
Implemented persistent local file cache with SQLite metadata storage, LRU eviction, and disk space management.

### Files Created
- `daemon/glowworm_daemon/cache.py` - ImageCache class with:
  - `CacheConfig` dataclass for cache configuration
  - `CacheEntryMetadata` dataclass for entry metadata
  - `CacheStats` dataclass for statistics reporting
  - `ImageCache` class with:
    - SQLite database for persistent metadata storage
    - LRU eviction when cache size exceeds `max_size_mb`
    - Minimum free space protection (`min_free_space_mb`)
    - Cache statistics tracking (hits, misses, hit rate, evictions)
    - Reconciliation with filesystem on startup (removes stale entries)
    - Thread-safe operations with locking
    - `get()`, `put()`, `remove()`, `clear()` methods
    - `contains()`, `get_path()`, `touch()` utility methods
    - `list_entries()` for cache listing

- `daemon/tests/test_cache.py` - 33 unit tests covering:
  - Cache initialization and database setup
  - Put/get operations
  - LRU eviction behavior
  - Free space protection
  - Cache statistics tracking
  - Cache clearing
  - Cache reconciliation with filesystem
  - Utility methods

### Files Modified
- `daemon/glowworm_daemon/__init__.py` - Added exports for ImageCache, CacheConfig, CacheEntryMetadata, CacheStats, create_cache
- `daemon/glowworm_daemon/image_manager.py`:
  - Added `max_cache_size_mb` and `min_free_space_mb` config options
  - ImageManager now accepts optional `cache` parameter
  - Automatically creates ImageCache on `start()` if not provided
  - `get_cached_path()` uses persistent cache
  - `is_cached()` uses persistent cache
  - `download_image()` stores entries in persistent cache
  - `clear_cache_entry()` uses persistent cache
  - `clear_all_cache()` new method to clear entire cache
  - `get_cache_stats()` returns full statistics from persistent cache
- `daemon/tests/test_image_manager.py` - Updated 5 tests to disable persistent cache for in-memory testing

### Verification
- All 60 tests pass: `pytest daemon/tests/ -v`
- Cache statistics correctly track hits, misses, evictions
- LRU eviction removes oldest-accessed entries when size limit exceeded
- Free space protection prevents filling disk
- Cache reconciles with filesystem on startup (removes stale entries)
- Cache survives daemon restart (metadata persisted in SQLite)

### API Summary
```python
from glowworm_daemon import ImageCache, CacheConfig

# Configuration
config = CacheConfig(
    cache_dir="/var/cache/glowworm/images",
    max_size_mb=500,
    min_free_space_mb=100,
)

# Create cache
cache = ImageCache(config)

# Store entry
cache.put(
    image_id=123,
    size="original",
    local_path="/var/cache/glowworm/images/123.jpg",
    file_size=1024000,
    etag='"abc123"',
    last_modified="Fri, 28 Feb 2026 12:00:00 GMT",
    content_type="image/jpeg",
)

# Get entry (updates last_accessed, tracks hit)
entry = cache.get(123, "original")
if entry:
    print(f"Path: {entry.local_path}")
    print(f"Size: {entry.file_size}")

# Check existence without affecting LRU order
if cache.contains(123, "original"):
    path = cache.get_path(123, "original")

# Statistics
stats = cache.get_stats()
print(f"Entries: {stats.entry_count}")
print(f"Size: {stats.total_size_mb}MB / {stats.max_size_mb}MB")
print(f"Hit rate: {stats.hit_rate:.1%}")
print(f"Evictions: {stats.evictions}")

# Clear cache
cache.clear()
```

### Notes
- SQLite database stored at `{cache_dir}/cache.db`
- LRU eviction is triggered before adding new entries when size exceeds limit
- Free space is checked using `shutil.disk_usage()` on cache partition
- Cache reconciliation on startup removes entries for deleted files
- Thread-safe for concurrent access from multiple tasks
- ImageManager automatically integrates with ImageCache when started

### Next Task
Task 2.3: Playlist Manager

## 2026-02-28 17:15 - Task 2.3: Playlist Manager

### What Changed
Implemented the PlaylistManager class for managing playlist state, fetching from backend, and navigation.

### Files Created
- `daemon/glowworm_daemon/playlist_manager.py` - PlaylistManager class with:
  - `PlaylistManagerConfig` dataclass for configuration
  - `PlaylistData` dataclass for parsed playlist information
  - `PlaylistImage` dataclass for image metadata
  - `PlaylistEntry` dataclass for single/pair entries
  - `PlaylistPosition` dataclass for position tracking with serialization
  - `PlaylistStatus` enum (OK, FETCHING, ERROR, NOT_LOADED)
  - `PlaylistManager` class with:
    - Async HTTP fetching from backend API using aiohttp
    - Playlist parsing and validation for manifest and playlist endpoints
    - Position tracking persisted to disk (JSON file in state_dir)
    - Shuffle mode with deterministic seed (same seed = same order)
    - Next/previous navigation with wrap-around
    - Go to specific position
    - Upcoming images for preloading
    - Version checking via content hash
    - Comprehensive status reporting
    - Async context manager support

- `daemon/tests/test_playlist_manager.py` - 35 unit tests covering:
  - Configuration defaults and directory creation
  - Position serialization (to_dict, from_dict)
  - Session lifecycle (start, stop, context manager)
  - Playlist fetching (manifest format, playlist format)
  - Error handling (404, 401, 500 with retry)
  - Navigation (next, previous, go_to, wrapping)
  - Shuffle mode (deterministic, enable/disable)
  - State persistence across restarts
  - Version hash computation and change detection
  - Status reporting with/without playlist
  - Empty playlist handling

### Files Modified
- `daemon/glowworm_daemon/__init__.py` - Added exports for PlaylistManager classes

### Verification
- All 35 playlist manager tests pass
- All 95 daemon tests pass: `pytest daemon/tests/ -v`
- Imports work correctly: `from glowworm_daemon import PlaylistManager, PlaylistManagerConfig`

### API Summary
```python
from glowworm_daemon import PlaylistManager, PlaylistManagerConfig

# Configuration
config = PlaylistManagerConfig(
    backend_url="http://localhost:8000",
    device_token="token-123",
    state_dir="/var/lib/glowworm",
    max_retries=3,
)

# Usage
async with PlaylistManager(config) as manager:
    # Fetch playlist
    playlist = await manager.fetch_playlist(playlist_id=1)
    print(f"Playlist: {playlist.name}, {playlist.image_count} images")

    # Navigation
    images = manager.get_current_images()
    entry, pos = manager.next()
    entry, pos = manager.previous()

    # Shuffle mode (deterministic)
    manager.set_shuffle(True, seed=12345)

    # Get upcoming images for preloading
    upcoming = manager.get_upcoming_images(count=3)

    # Check for updates
    if await manager.check_for_updates():
        print("Playlist has changed!")

    # Status
    status = manager.get_status()
```

### Notes
- Position is persisted to `{state_dir}/playlist_state.json`
- Shuffle uses Python's `random.Random(seed)` for deterministic order
- Version hash is computed from sequence + image checksums
- Retry logic uses exponential backoff with configurable delays
- Handles both manifest endpoint (image list) and playlist endpoint (computed sequence)
- Entry count accounts for paired images (pair = 1 entry, not 2)

### Next Task
Task 2.4: Preloading Logic

## 2026-02-28 17:45 - Task 2.4: Preloading Logic

### What Changed
Implemented the PreloadManager class for background preloading of upcoming images with priority-based scheduling and cancellation support.

### Files Created
- `daemon/glowworm_daemon/preload_manager.py` - PreloadManager class with:
  - `PreloadStatus` enum (PENDING, DOWNLOADING, COMPLETE, CACHED, FAILED, CANCELLED)
  - `PreloadEntry` dataclass for queue entries with priority
  - `PreloadManagerConfig` dataclass for configuration
  - `PreloadStats` dataclass for statistics
  - `PreloadManager` class with:
    - Background worker task for processing preload queue
    - Priority-based scheduling (lower number = higher priority)
    - Concurrent download limiting (configurable)
    - `update_preload_queue()` - Update queue from playlist position
    - `preload_images()` - Queue specific images for preload
    - `cancel_preload()` - Cancel specific image preload
    - Automatic cancellation of outdated preloads when playlist changes
    - Skip already-cached images
    - Progress callback support
    - Statistics tracking (pending, downloading, completed, failed, cancelled)

- `daemon/tests/test_preload_manager.py` - 27 unit tests covering:
  - Configuration defaults
  - Priority comparison for sorting
  - Manager lifecycle (start/stop/context manager)
  - Queue management (add, skip cached, priority ordering)
  - Concurrent download limit enforcement
  - Cancellation (specific, nonexistent, all on stop)
  - Playlist queue updates
  - Outdated preload cancellation
  - Priority updates for existing items
  - Empty playlist clearing queue
  - Status checking methods
  - Progress callbacks
  - Error handling (failed/cancelled downloads)
  - Full preload cycle integration test
  - No duplicate downloads verification

### Files Modified
- `daemon/glowworm_daemon/__init__.py` - Added exports for PreloadManager, PreloadManagerConfig, PreloadStatus, PreloadEntry, PreloadStats, create_preload_manager

### Verification
- All 27 preload manager tests pass
- All 122 daemon tests pass: `pytest daemon/tests/ -v`
- Imports work correctly: `from glowworm_daemon import PreloadManager, PreloadManagerConfig`

### API Summary
```python
from glowworm_daemon import PreloadManager, PreloadManagerConfig

# Configuration
config = PreloadManagerConfig(
    preload_count=3,           # Number of images to preload ahead
    max_concurrent_downloads=2, # Max concurrent downloads
    retry_delay=5.0,           # Delay before retrying failed downloads
    max_retries=2,             # Max retries for failed downloads
)

# Usage with ImageManager
async with PreloadManager(image_manager, config) as preloader:
    # Update queue from playlist position
    await preloader.update_preload_queue(playlist_manager)

    # Or preload specific images
    await preloader.preload_images([image1, image2, image3])

    # Cancel specific preload
    await preloader.cancel_preload(image_id=123)

    # Check status
    if preloader.is_preloading(123):
        print("Image 123 is currently downloading")

    # Get statistics
    stats = preloader.get_stats()
    print(f"Pending: {stats.pending_count}")
    print(f"Downloading: {stats.downloading_count}")
    print(f"Total preloaded: {stats.total_preloaded}")
```

### Notes
- Background worker uses asyncio for non-blocking operation
- Priority 0 = next image (highest priority), 1 = second next, etc.
- Cancelled preloads are tracked in statistics
- Worker wakes up when downloads complete to start next items
- Queue is cleared when PreloadManager is stopped
- Integrates seamlessly with ImageManager for actual downloads

### Next Task
Task 2.5: Integration Testing - Image Management

## 2026-02-28 18:15 - Task 2.5: Integration Testing - Image Management

### What Changed
Created comprehensive integration tests for ImageManager, PlaylistManager, and PreloadManager working together.

### Files Created
- `daemon/tests/test_integration_image_management.py` - 13 integration tests covering:
  - **Playlist fetch and image download**: Tests fetching playlists and downloading all images to cache
  - **Preload from playlist**: Tests preloading upcoming images based on playlist position
  - **Offline operation**: Tests slideshow can operate entirely from cached images
  - **Cache hit tracking**: Tests that cache statistics correctly track hits
  - **LRU eviction**: Tests cache eviction when size limit exceeded
  - **Cache size limit**: Tests cache respects max_size_mb configuration
  - **LRU preservation**: Tests recently accessed images survive eviction
  - **Playlist update downloads**: Tests that playlist changes trigger new image downloads
  - **Preloader queue updates**: Tests preloader updates when playlist position changes
  - **Removed image cancellation**: Tests preloader cancels downloads for removed images
  - **Full slideshow simulation**: Tests complete slideshow workflow with preloading
  - **Shuffle mode preloading**: Tests preloading works correctly in shuffle mode
  - **Position persistence**: Tests playlist position persists across daemon restart

### Test Infrastructure
- `MockBackendServer` class using aiohttp for realistic HTTP testing
- Mock image data (valid minimal JPEG)
- Proper async fixture handling with pytest-asyncio
- Isolated test directories to avoid interference between tests

### Verification
- All 13 new integration tests pass
- All 135 daemon tests pass: `pytest daemon/tests/ -v`
- Tests exercise real HTTP client (aiohttp) against mock server
- Tests cover all requirements from plan.md Task 2.5

### Test Coverage Summary
| Scenario | Status |
|----------|--------|
| Playlist fetched and images downloaded to cache | ✅ |
| Slideshow operates from cache (offline) | ✅ |
| Cache eviction during extended operation | ✅ |
| Playlist update triggers new downloads | ✅ |

### Notes
- Mock server simulates backend API endpoints (/api/device-daemon/playlist, /api/images/{id}/file)
- Tests use small cache sizes (0.5-10MB) to trigger eviction quickly
- Cache hit tracking test relaxed to account for internal cache.get() calls during downloads
- Integration tests complement existing unit tests for each module

### Next Task
Task 3.1: Display Controller

## 2026-02-28 18:45 - Task 3.1: Display Controller

### What Changed
Implemented the DisplayController class for managing the Pi3D display as a subprocess with health monitoring, IPC communication, crash detection, and auto-restart.

### Files Created
- `daemon/glowworm_daemon/display_controller.py` - DisplayController implementation with:
  - `DisplayState` enum (STOPPED, STARTING, RUNNING, STOPPING, CRASHED, RESTARTING)
  - `DisplayControllerConfig` dataclass for configuration
  - `IPCResponse` dataclass for IPC call results
  - `IPCClient` class for JSON-RPC 2.0 communication over Unix sockets:
    - Async connection/disconnection
    - Request/response handling with notification support
    - Timeout handling
    - Error handling for connection issues
  - `DisplayController` class with:
    - Subprocess spawning with proper environment
    - IPC client management
    - Health monitoring with configurable intervals
    - Crash detection (process exit, health check failures)
    - Auto-restart with exponential backoff
    - Graceful shutdown with timeout
    - State change callbacks
    - Notification callbacks
    - Command methods: get_status, load_image, queue_image, pause, resume, clear, show_registration, hide_registration
    - Async context manager support
  - `create_display_controller()` factory function

- `daemon/tests/test_display_controller.py` - 29 comprehensive tests covering:
  - Configuration defaults and custom values
  - IPCClient connection, disconnection, and calls
  - DisplayController initialization and state management
  - State and notification callbacks
  - All IPC commands (load_image, queue_image, pause, resume, clear, show/hide_registration)
  - Commands when not running
  - Health check failure detection
  - Process crash detection
  - Manual restart
  - Context manager usage
  - Factory function

### Files Modified
- `daemon/glowworm_daemon/__init__.py` - Added exports for DisplayController, DisplayControllerConfig, DisplayState, IPCClient, IPCResponse, create_display_controller

### Verification
- All 29 new tests pass
- All 164 daemon tests pass: `pytest daemon/tests/ -v`
- Imports work correctly: `from glowworm_daemon import DisplayController, DisplayState, ...`

### API Summary
```python
from glowworm_daemon import DisplayController, DisplayControllerConfig

# Configuration
config = DisplayControllerConfig(
    socket_path="/run/glowworm/display.sock",
    mock_mode=True,
    health_check_interval=5.0,
    auto_restart=True,
    max_restart_attempts=5,
)

# Usage
async with DisplayController(config) as controller:
    # Check status
    status = await controller.get_status()

    # Load images
    await controller.load_image("/path/to/image.jpg", scale_mode="fit")
    await controller.queue_image("/path/to/image2.jpg")

    # Control playback
    await controller.pause()
    await controller.resume()
    await controller.clear()

    # Registration mode
    await controller.show_registration("ABCD")
    await controller.hide_registration()
```

### Features
- **Subprocess Management**: Spawns glowworm-display as subprocess with configurable command and environment
- **IPC Communication**: JSON-RPC 2.0 over Unix domain sockets, matching display engine protocol
- **Health Monitoring**: Periodic get_status calls to detect unresponsive processes
- **Crash Detection**: Monitors process exit codes and health check failures
- **Auto-Restart**: Exponential backoff restart with configurable max attempts
- **Graceful Shutdown**: SIGTERM with timeout, fallback to SIGKILL
- **State Tracking**: Full state machine with callbacks for state changes
- **Notification Support**: Callbacks for notifications from display process

### Notes
- IPC client properly handles interleaved notifications and responses
- Health check failures threshold configurable (default 3)
- Restart backoff: 1s, 2s, 4s... up to max_delay (default 60s)
- Context manager ensures proper cleanup on exit
- Tests use MockIPCServer to simulate display process

### Next Task
Task 3.2: Slideshow Orchestration

## 2026-02-28 19:30 - Task 3.2: Slideshow Orchestration

### What Changed
Implemented the SlideshowOrchestrator class that coordinates playlist, image cache, and display controller for slideshow operation.

### Files Created
- `daemon/glowworm_daemon/slideshow_orchestrator.py` - SlideshowOrchestrator implementation with:
  - `SlideshowState` enum (STOPPED, STARTING, PLAYING, PAUSED, TRANSITIONING, ERROR)
  - `SlideshowConfig` dataclass for configuration
  - `SlideshowStats` dataclass for statistics tracking
  - `SlideshowOrchestrator` class with:
    - Main slideshow loop with configurable image timing
    - Transition triggering via DisplayController IPC
    - Next/previous/go_to command handling with immediate response
    - Pause/resume state management
    - Missing image handling (skip with error logging)
    - Offline operation using cached images
    - Background preloading via PreloadManager integration
    - Periodic playlist update checking
    - State change callbacks
    - Comprehensive status reporting
    - Async context manager support
  - `create_slideshow_orchestrator()` factory function

- `daemon/tests/test_slideshow_orchestrator.py` - 25 comprehensive tests covering:
  - Configuration defaults and custom values
  - Initial state verification
  - Start/stop lifecycle
  - Start failures (no playlist, display not running)
  - Pause/resume functionality
  - Next/previous/go_to navigation
  - Image display to DisplayController
  - Automatic advance timing
  - Missing image skipping
  - Preloader queue updates
  - State change callbacks
  - Status reporting
  - Statistics tracking
  - Context manager usage
  - Playlist reload
  - Next when paused auto-resumes

### Files Modified
- `daemon/glowworm_daemon/__init__.py` - Added exports for SlideshowOrchestrator, SlideshowConfig, SlideshowState, SlideshowStats, create_slideshow_orchestrator

### Verification
- All 25 new tests pass
- All 189 daemon tests pass: `pytest daemon/tests/ -v`
- Imports work correctly: `from glowworm_daemon import SlideshowOrchestrator, SlideshowConfig`

### API Summary
```python
from glowworm_daemon import SlideshowOrchestrator, SlideshowConfig

# Configuration
config = SlideshowConfig(
    default_display_time=30.0,
    transition_duration=1.0,
    scale_mode="fit",
    preload_count=3,
)

# Usage (requires initialized components)
orchestrator = SlideshowOrchestrator(
    display=display_controller,
    playlist=playlist_manager,
    images=image_manager,
    preloader=preload_manager,
    config=config,
)

async with orchestrator:
    # Control
    await orchestrator.next()
    await orchestrator.previous()
    await orchestrator.go_to(5)
    await orchestrator.pause()
    await orchestrator.resume()

    # Reload playlist
    await orchestrator.reload_playlist()

    # Status
    status = orchestrator.get_status()
```

### Features
- **Image Timing**: Images advance at playlist's `display_time_seconds` or configurable default
- **Transition Triggering**: Uses DisplayController.load_image() with configurable transition duration
- **Navigation**: next/previous/go_to commands work immediately and auto-resume if paused
- **Missing Images**: Failed images are skipped with error logging, slideshow continues
- **Offline Mode**: Works entirely from cached images when backend unavailable
- **Preloading**: Automatically updates PreloadManager queue after each image
- **Playlist Updates**: Periodic check for playlist changes (configurable interval)
- **State Management**: Full state machine with callbacks for state transitions

### Notes
- Slideshow loop uses asyncio for non-blocking wait with advance event
- Manual navigation (next/previous) wakes up the loop immediately
- Pause preserves remaining display time for smooth resume
- State callbacks fire synchronously on state changes
- Statistics track images displayed, skipped, transitions completed, errors

### Next Task
Task 3.3: Configuration Unification

## 2026-02-28 20:15 - Task 3.3: Configuration Unification

### What Changed
Implemented unified YAML configuration system for both daemon and display settings. The new system provides a single config file at `/etc/glowworm/config.yaml` with all settings organized into logical sections.

### Files Created
- `daemon/glowworm_daemon/unified_config.py` - Unified configuration system with:
  - `UnifiedConfig` dataclass containing all configuration sections
  - `BackendConfig`, `DisplayConfig`, `SlideshowConfig`, `CacheConfig`, `StateConfig`, `IPCConfig`, `LoggingConfig`, `CECConfig` section dataclasses
  - `Orientation`, `Rotation`, `ScaleMode` enums for type-safe settings
  - `load_config()` function with YAML loading and environment variable overrides
  - `create_default_config()` for generating default config files
  - `save_config()` for persisting configuration changes
  - `get_display_config_json()` for passing display config to subprocess

- `daemon/tests/test_unified_config.py` - 38 comprehensive tests covering:
  - Default configuration values
  - Configuration validation and normalization
  - YAML file loading
  - Environment variable overrides
  - Configuration serialization (to_dict, get_display_config_json)
  - Default config file creation
  - Helper methods (effective_websocket_url, background_rgb)
  - Integration with legacy DaemonConfig

### Files Modified
- `daemon/glowworm_daemon/config.py` - Updated to support both YAML and INI formats:
  - `load_config()` now auto-detects format and loads YAML first
  - `DaemonConfig.from_unified()` creates legacy config from UnifiedConfig
  - `DaemonConfig.unified` property provides access to underlying UnifiedConfig
  - Backward compatible with existing INI configuration files

- `daemon/glowworm_daemon/display_controller.py`:
  - Added `display_config_json` field to `DisplayControllerConfig`
  - Added `from_unified_config()` factory method
  - Updated `_start_process()` to pass config via `GLOWWORM_DISPLAY_CONFIG` env var

- `display/glowworm_display/config.py`:
  - Added `load_config_from_env()` to load config from GLOWWORM_DISPLAY_CONFIG
  - Added `load_config_auto()` that checks env first, then files, then defaults

- `daemon/glowworm_daemon/__init__.py` - Added exports for unified config classes

### Verification
- All 38 unified config tests pass
- All 227 daemon tests pass
- All 24 display tests pass
- Configuration loads from YAML files correctly
- Missing optional values use sensible defaults
- Invalid configuration raises clear error messages
- Display receives correct settings via JSON environment variable

### Configuration Format
```yaml
# GlowWorm v3.0 Unified Configuration
backend:
  url: "https://glowworm.example.com"
  device_token: ""  # Set during registration

display:
  orientation: portrait  # portrait or landscape
  rotation: 0  # 0, 90, 180, 270
  background_color: "#000000"
  fps_target: 30

slideshow:
  display_time: 30.0  # seconds per image
  transition_duration: 2.0
  scale_mode: fit  # fit, fill, stretch
  preload_count: 3

cache:
  directory: /var/cache/glowworm/images
  max_size_mb: 500
  min_free_space_mb: 100

ipc:
  socket_path: /run/glowworm/display.sock

logging:
  level: INFO
  file: /var/log/glowworm/daemon.log

cec:
  enabled: false
  display_address: 0
```

### Environment Variable Overrides
- `GLOWWORM_BACKEND_URL` - Override backend URL
- `GLOWWORM_DEVICE_TOKEN` - Override device token
- `GLOWWORM_DISPLAY_ORIENTATION` - Override display orientation
- `GLOWWORM_LOG_LEVEL` - Override log level
- And more...

### Notes
- YAML format preferred for new installations, INI still supported for backward compatibility
- Config auto-detection based on file extension (.yaml vs .conf)
- Display subprocess receives config via GLOWWORM_DISPLAY_CONFIG JSON env var
- SIGHUP reload not implemented (marked as optional in plan)

### Next Task
Task 3.4: Integration Testing - Full Slideshow

## 2026-02-28 21:00 - Task 3.4: Integration Testing - Full Slideshow

### What Changed
Created comprehensive integration tests for the full slideshow operation with daemon controlling Pi3D display.

### Files Created
- `daemon/tests/test_integration_full_slideshow.py` - 13 integration tests covering:
  - **Daemon starts and begins slideshow**: Tests daemon initializes display controller, connects to Pi3D IPC, and begins slideshow operation
  - **Slideshow starts with preloader**: Tests preloader integration for background image downloads
  - **Images advance at configured interval**: Tests images transition at the display_time_seconds interval
  - **Transition uses configured duration**: Tests transition_duration setting is applied
  - **Next command advances immediately**: Tests next() command advances to next image
  - **Previous command goes back**: Tests previous() command navigates backward
  - **Pause/resume stops and continues**: Tests pause halts advancement, resume continues
  - **Display controller detects crash**: Tests health check failure detection
  - **Display controller auto-restarts**: Tests auto-restart with exponential backoff
  - **Slideshow continues after display restart**: Tests orchestrator survives display restart
  - **Slideshow operates from cache**: Tests slideshow works with pre-cached images
  - **Missing images skipped gracefully**: Tests slideshow skips unavailable images and continues
  - **Status includes all fields**: Tests comprehensive status reporting

### Test Infrastructure
- `MockBackendServer` - Mock backend HTTP server for playlist and image endpoints
- `MockDisplayIPCServer` - Mock Pi3D display IPC server for JSON-RPC communication
- Async fixtures with pytest-asyncio for realistic integration testing
- Mock subprocess handling for display controller testing

### Verification
- All 13 new integration tests pass
- All 240 daemon tests pass: `pytest daemon/tests/ -v`
- All 24 display tests pass: `pytest display/tests/ -v`
- Tests exercise real component interactions with mocked I/O

### Test Coverage Summary
| Scenario | Status |
|----------|--------|
| Daemon starts, spawns Pi3D, begins slideshow | ✅ |
| Images transition at correct intervals | ✅ |
| Commands via IPC affect slideshow | ✅ |
| Daemon survives Pi3D crash and restarts | ✅ |
| Works offline with cached playlist/images | ✅ |

### Notes
- Tests use mock display IPC server to simulate Pi3D process without actual GPU
- Mock backend server simulates playlist and image endpoints
- Display controller uses patched subprocess for controllable process lifecycle
- Tests balance thoroughness with execution speed (~16 seconds total)
- Offline operation tests verify slideshow works from cached images without network

### Next Task
Task 4.1: WebSocket Client

## 2026-02-28 16:25 - Task 4.1: WebSocket Client

### What Changed
Implemented persistent WebSocket client for daemon-to-backend communication with authentication, auto-reconnect, heartbeat, and offline message queuing.

### Files Created
- `daemon/glowworm_daemon/websocket_client.py` - WebSocketClient implementation with:
  - `ConnectionState` enum (DISCONNECTED, CONNECTING, CONNECTED, AUTHENTICATING, AUTHENTICATED, RECONNECTING, CLOSING, CLOSED, ERROR)
  - `MessageType` enum for protocol message types (AUTH, STATUS, COMMAND, HEARTBEAT, etc.)
  - `WebSocketConfig` dataclass for client configuration
  - `QueuedMessage` dataclass for offline message queue entries
  - `WebSocketStats` dataclass for connection statistics
  - `WebSocketClient` class with:
    - Connection with device token authentication
    - Auto-reconnect with exponential backoff (configurable base/max delay)
    - Heartbeat/ping-pong with missed heartbeat detection
    - Message receive handler with callbacks
    - Message send with offline queue (priority-based)
    - Connection state tracking with callbacks
    - Statistics tracking (messages sent/received, bytes, reconnect count, uptime)
    - Async context manager support
  - `create_websocket_client()` factory function

- `daemon/tests/test_websocket_client.py` - 35 comprehensive tests covering:
  - Configuration defaults and custom values
  - QueuedMessage and WebSocketStats dataclasses
  - Client initialization and state management
  - State change callback handling
  - Connection and authentication (success and failure)
  - Disconnection handling
  - Message sending when connected
  - Offline message queuing
  - Queue max size and priority ordering
  - Queue flushing on reconnect
  - Message handling callbacks
  - Heartbeat ack handling
  - Reconnection attempt tracking
  - Max reconnect attempts
  - Exponential backoff calculation
  - Heartbeat sending
  - Statistics tracking
  - Async context manager
  - Factory function

### Files Modified
- `daemon/glowworm_daemon/__init__.py` - Added exports for:
  - WebSocketClient, WebSocketConfig, WebSocketStats
  - ConnectionState, MessageType, QueuedMessage
  - create_websocket_client

### Verification
- All 35 WebSocket client tests pass
- All 275 daemon tests pass: `pytest daemon/tests/ -v`
- Imports work correctly: `from glowworm_daemon import WebSocketClient, WebSocketConfig`

### API Summary
```python
from glowworm_daemon import WebSocketClient, WebSocketConfig, ConnectionState

# Configuration
config = WebSocketConfig(
    url="ws://localhost:3003/ws/device",
    device_token="device-token-123",
    auto_reconnect=True,
    max_reconnect_attempts=0,  # unlimited
    reconnect_base_delay=1.0,
    reconnect_max_delay=60.0,
    heartbeat_interval=30.0,
    max_queue_size=100,
)

# Callbacks
def on_message(msg_type: str, payload: dict):
    if msg_type == "command":
        handle_command(payload)

def on_state_change(old: ConnectionState, new: ConnectionState):
    print(f"State: {old.value} -> {new.value}")

# Usage
async with WebSocketClient(config, on_message, on_state_change) as client:
    # Send message
    await client.send("status", {"current_image": 123})

    # Check state
    if client.is_connected:
        stats = client.get_stats()
        print(f"Messages sent: {stats.messages_sent}")
```

### Protocol
- **Authentication**: Send `auth` message with device_token, receive `auth_success` or `auth_failed`
- **Heartbeat**: Send `heartbeat` every 30s, expect `heartbeat_ack` response
- **Message Types**:
  - Outgoing: auth, status, command_response, heartbeat
  - Incoming: auth_success, auth_failed, command, playlist_update, config_update, heartbeat_ack

### Notes
- WebSocket uses aiohttp for async communication
- Auto-reconnect with exponential backoff: 1s, 2s, 4s, 8s... up to max_delay
- Heartbeat monitors connection health; missed heartbeats trigger reconnect
- Offline queue stores messages with priority; flushed on reconnect
- State changes tracked with optional callbacks
- Connection uptime statistics for monitoring

### Next Task
Task 4.2: Status Reporting

## 2026-02-28 17:00 - Task 4.2: Status Reporting

### What Changed
Implemented StatusReporter class for reporting device status to backend via WebSocket with periodic reporting and immediate state change notifications.

### Files Created
- `daemon/glowworm_daemon/status_reporter.py` - StatusReporter implementation with:
  - `ReporterState` enum (STOPPED, RUNNING, ERROR)
  - `StatusReporterConfig` dataclass for configuration:
    - `report_interval`: Periodic reporting interval (default 30s)
    - `report_on_state_change`: Report immediately on state changes (default True)
    - `min_report_interval`: Rate limiting to prevent flooding (default 1s)
    - `status_priority`: Priority for queued messages
    - `include_cache_details`: Include detailed cache statistics
  - `DeviceStatus` dataclass for status message payload:
    - Current state (playing, paused, stopped, error)
    - Current image info (id, path)
    - Slideshow stats (images displayed, skipped, transitions, errors, runtime)
    - Playlist info (id, name, position, entry count)
    - Cache statistics (entry count, size, hit rate)
    - Display state (running, state)
    - Uptime and timestamp
    - `to_dict()` method for JSON serialization
  - `StatusReporter` class with:
    - Periodic status reporting at configurable intervals
    - Immediate reporting on slideshow state changes
    - Rate limiting to prevent message flooding
    - Status aggregation from all components (slideshow, display, cache)
    - Status callbacks for external monitoring
    - Async context manager support
  - `create_status_reporter()` factory function

- `daemon/tests/test_status_reporter.py` - 28 comprehensive tests covering:
  - Configuration defaults and custom values
  - DeviceStatus serialization (to_dict)
  - Reporter initialization and state management
  - Start/stop lifecycle
  - Status reporting with all components
  - Rate limiting behavior
  - Offline queuing
  - State change callback registration
  - Status callbacks
  - Status collection from each component type
  - Uptime tracking
  - Periodic reporting
  - Context manager
  - Slideshow state mapping (playing/transitioning -> playing)
  - Error handling (send errors, callback errors)
  - Factory function

### Files Modified
- `daemon/glowworm_daemon/__init__.py` - Added exports for:
  - StatusReporter, StatusReporterConfig, DeviceStatus, ReporterState
  - create_status_reporter

### Verification
- All 28 StatusReporter tests pass
- All 303 daemon tests pass: `pytest daemon/tests/ -v`
- All 24 display tests pass: `pytest display/tests/ -v`
- Imports work correctly: `from glowworm_daemon import StatusReporter, StatusReporterConfig`

### API Summary
```python
from glowworm_daemon import StatusReporter, StatusReporterConfig

# Configuration
config = StatusReporterConfig(
    report_interval=30.0,          # Report every 30 seconds
    report_on_state_change=True,   # Report immediately on state changes
    min_report_interval=1.0,       # Rate limiting
)

# Usage with all components
reporter = StatusReporter(
    websocket=ws_client,
    slideshow=slideshow_orchestrator,
    display=display_controller,
    cache=image_cache,
    config=config,
)

async with reporter:
    # Reporter sends periodic status updates automatically
    # Also sends immediately when slideshow state changes

    # Manual status report
    await reporter.report_status(force=True)

    # Get current status without sending
    status = reporter.get_last_status()
```

### Status Message Schema
```python
{
    "state": "playing",
    "is_online": True,
    "current_image_id": 123,
    "current_image_path": "/cache/123.jpg",
    "slideshow": {
        "images_displayed": 10,
        "images_skipped": 1,
        "transitions_completed": 9,
        "errors": 0,
        "runtime_seconds": 300.5,
    },
    "playlist": {
        "id": 1,
        "name": "Test Playlist",
        "position": 5,
        "entry_count": 20,
    },
    "cache": {
        "entry_count": 15,
        "size_mb": 50.0,
        "max_size_mb": 500,
        "hit_rate": 0.85,
    },
    "display": {
        "running": True,
        "state": "running",
    },
    "uptime_seconds": 3600.5,
    "timestamp": 1709150400.123,
}
```

### Notes
- StatusReporter integrates with WebSocketClient for message sending
- Periodic reporting runs in background asyncio task
- Rate limiting prevents flooding during rapid state changes
- Status is queued when offline via WebSocket client's queue
- Collects status from slideshow, display controller, and cache
- State changes mapped: "transitioning" -> "playing" for simpler backend handling
- All fields optional based on which components are provided

### Next Task
Task 4.3: Command Reception

## 2026-02-28 17:30 - Task 4.3: Command Reception

### What Changed
Implemented CommandHandler class for receiving and executing commands from backend via WebSocket.

### Files Created
- `daemon/glowworm_daemon/command_handler.py` - CommandHandler implementation with:
  - `CommandType` enum for supported command types (next, previous, pause, resume, play, reload_playlist, go_to, clear, status)
  - `CommandStatus` enum (SUCCESS, FAILED, ERROR, UNKNOWN_COMMAND)
  - `CommandResult` dataclass for command execution results
  - `CommandHandlerConfig` dataclass for configuration
  - `CommandHandler` class with:
    - Command message parsing from WebSocket
    - Routing to appropriate slideshow/playlist handlers
    - Command acknowledgment/result sending
    - Error handling for unknown commands
    - Statistics tracking (commands received, succeeded, failed, unknown)
    - Command callbacks for external monitoring
    - Async context manager support
  - `create_command_handler()` factory function

- `daemon/tests/test_command_handler.py` - 30 comprehensive tests covering:
  - Configuration defaults and custom values
  - CommandResult serialization
  - Handler initialization and lifecycle
  - All command handlers (next, previous, pause, resume, play, reload_playlist, go_to, clear, status)
  - Unknown command handling
  - Commands when slideshow not available
  - Failed command handling
  - Non-command message filtering
  - Request ID preservation
  - Command callbacks
  - Statistics tracking
  - Acknowledgment disabling
  - Response priority
  - Case insensitivity

### Files Modified
- `daemon/glowworm_daemon/__init__.py` - Added exports for:
  - CommandHandler, CommandHandlerConfig, CommandType, CommandStatus, CommandResult
  - create_command_handler

### Verification
- All 30 CommandHandler tests pass
- All 333 daemon tests pass: `pytest daemon/tests/ -v`
- Imports work correctly: `from glowworm_daemon import CommandHandler, CommandType`

### API Summary
```python
from glowworm_daemon import CommandHandler, CommandHandlerConfig, CommandType

# Create handler
handler = CommandHandler(
    websocket=ws_client,
    slideshow=slideshow_orchestrator,
    playlist=playlist_manager,
    config=CommandHandlerConfig(
        send_acknowledgment=True,
        response_priority=3,
        command_timeout=30.0,
    ),
)

# Register as WebSocket message handler and start
async with handler:
    # Handler automatically processes messages when:
    # ws_client calls handler.handle_message("command", {...})
    pass

# Or manual handling
await handler.handle_message("command", {
    "command": "next",
    "params": {},
    "request_id": "req-123",
})
```

### Supported Commands
| Command | Parameters | Description |
|---------|------------|-------------|
| `next` | - | Advance to next image |
| `previous` | - | Go to previous image |
| `pause` | - | Pause slideshow |
| `resume` / `play` | - | Resume slideshow |
| `reload_playlist` | - | Reload playlist from backend |
| `go_to` | `position: int` | Jump to specific position |
| `clear` | - | Clear display |
| `status` | - | Get comprehensive status |

### Response Format
```python
{
    "command": "next",
    "status": "success",  # or "failed", "error", "unknown_command"
    "message": "Advanced to next image",
    "data": {"position": 5},
    "request_id": "req-123",  # if provided in request
    "timestamp": 1709150400.123,
}
```

### Notes
- Commands are case-insensitive (NEXT, Next, next all work)
- `play` is an alias for `resume` for consistency with common media controls
- Unknown commands return `unknown_command` status but don't crash
- Statistics tracked: received, succeeded, failed, unknown
- Response priority (3) is higher than status messages (5) for faster delivery

### Next Task
Task 4.4: Backend WebSocket Updates

## 2026-02-28 18:00 - Task 4.4: Backend WebSocket Updates

### What Changed
Updated backend WebSocket handling to support Pi3D daemon protocol alongside legacy browser devices.

### Files Created
- `backend/websocket/device_status_cache.py` - Redis caching for device status:
  - `store_device_status()` - Store status with TTL (5 min default)
  - `get_device_status()` - Retrieve cached status
  - `get_all_device_statuses()` - Get all online device statuses
  - `remove_device_status()` - Remove status on disconnect
  - `get_online_device_tokens()` - List online device tokens
  - Uses Redis SET for tracking online devices

- `backend/tests/test_websocket_pi3d.py` - 13 tests covering:
  - ConnectionManager Pi3D command format
  - Device status cache operations
  - Pi3D message protocol handling
  - DisplayDevice model Pi3D fields
  - DisplayDeviceService status updates

### Files Modified
- `backend/websocket/endpoints.py`:
  - Added handling for Pi3D daemon messages (auth, status, command_response)
  - Added heartbeat_ack response for daemon heartbeat compatibility
  - Added Redis status caching on status updates
  - Added status cleanup on device disconnect
  - Added new HTTP endpoints:
    - `GET /api/ws/device/{token}/status` - Get cached device status
    - `GET /api/ws/devices/status` - Get all device statuses

- `backend/websocket/manager.py`:
  - Updated `send_device_command()` to use Pi3D daemon format
  - Added request_id support for command tracking
  - Maintains legacy format for browser device compatibility

- `backend/models/display_device.py`:
  - Added Pi3D status fields: device_type, last_state, last_image_id
  - Added cache statistics: last_cache_size_mb, last_cache_hit_rate
  - Added uptime tracking: last_uptime_seconds
  - Added full status JSON: last_status_json
  - Updated `to_dict()` to include new fields

- `backend/services/display_device_service.py`:
  - Added `update_device_status()` method for Pi3D daemon status updates

### Protocol Support
The backend now supports both:
- **Legacy browser devices**: message types `status_update`, `heartbeat`, `error_report`
- **Pi3D daemon devices**: message types `auth`, `status`, `command_response`, `heartbeat`

Pi3D daemon protocol:
- Device sends `auth` → Backend responds `auth_success`
- Device sends `status` → Backend caches in Redis, broadcasts to admins
- Device sends `heartbeat` → Backend responds `heartbeat_ack`
- Admin sends command → Backend forwards to device in Pi3D format

### Verification
- All 13 new Pi3D WebSocket tests pass
- All 46 backend tests pass
- Redis caching tested with mocked client
- Device model fields validated
- Command format includes both Pi3D and legacy formats for compatibility

### Notes
- Device status TTL is 5 minutes (configurable)
- Status is removed from Redis when device disconnects
- Commands include both `payload.command` (Pi3D) and `command` (legacy) for compatibility
- Database migration needed to add new device model fields

### Next Task
Task 4.5: Integration Testing - WebSocket

## 2026-02-28 18:45 - Task 4.5: Integration Testing - WebSocket

### What Changed
Created comprehensive integration tests for full WebSocket communication flow between daemon and backend.

### Files Created
- `daemon/tests/test_integration_websocket.py` - 17 integration tests covering:
  - **Device connects and authenticates**: Tests device WebSocket connection, authentication via device token, state transitions, and server tracking
  - **Authentication failure handling**: Tests proper error handling for empty/invalid tokens
  - **Reconnection after disconnect**: Tests auto-reconnect behavior when connection is lost
  - **Status updates reach backend**: Tests StatusReporter sends status to backend via WebSocket
  - **Status updates broadcast to admins**: Tests admin connections receive device status updates
  - **Status includes all required fields**: Tests comprehensive status payload with slideshow, cache, display, and uptime fields
  - **Command reaches device**: Tests commands from admin/server reach device via WebSocket
  - **Command handler processes commands**: Tests CommandHandler correctly handles incoming commands
  - **All command types**: Tests all supported commands (next, previous, pause, resume, play, go_to, reload_playlist, clear, status)
  - **Messages queued when offline**: Tests offline message queuing
  - **Queued messages sent on reconnect**: Tests queue flush on reconnection
  - **Queue max size enforcement**: Tests queue respects max_queue_size limit
  - **Queue priority ordering**: Tests messages sent in priority order
  - **Multiple devices connect**: Tests multiple devices can connect simultaneously
  - **Commands sent to correct device**: Tests commands are routed to specific devices correctly
  - **Status updates from multiple devices**: Tests each device's status is tracked separately
  - **Heartbeat keeps connection alive**: Tests heartbeat mechanism maintains connection

### Test Infrastructure
- `MockWebSocketServer` - Mock WebSocket server simulating backend behavior:
  - Device endpoint with authentication (auth -> auth_success/auth_failed)
  - Admin endpoint with connection tracking
  - Message routing between devices and admins
  - Command sending with request_id tracking
  - Status caching per device
  - Message logging for verification

### Verification
- All 17 new integration tests pass
- All 350 daemon tests pass: `pytest daemon/tests/ -v`
- Tests exercise real WebSocket client (aiohttp) against mock server
- Tests cover all requirements from plan.md Task 4.5

### Test Coverage Summary
| Scenario | Status |
|----------|--------|
| Device connects and authenticates | ✅ |
| Status updates reach backend and admin UI | ✅ |
| Commands from admin UI reach device | ✅ |
| Offline queuing and reconnection work | ✅ |
| Multiple devices work simultaneously | ✅ |

### Notes
- Mock server implements Pi3D daemon protocol (auth, status, heartbeat, command, command_response)
- Tests use real aiohttp WebSocket client connecting to mock aiohttp server
- Heartbeat test uses 0.5s interval for quick testing
- Multiple device tests verify correct routing and independent status tracking
- Tests balance thoroughness with execution speed (~26 seconds for all 17 tests)

### Next Task
Task 5.1: Daemon Registration Mode

## 2026-02-28 18:10 - Task 5.1: Daemon Registration Mode

### What Changed
Implemented the RegistrationManager class for handling device registration flow when no token is configured.

### Files Created
- `daemon/glowworm_daemon/registration_manager.py` - RegistrationManager implementation with:
  - `RegistrationState` enum (IDLE, CHECKING, REQUESTING_CODE, DISPLAYING_CODE, AUTHORIZED, REJECTED, ERROR, COMPLETED)
  - `RegistrationConfig` dataclass for configuration options
  - `RegistrationResult` dataclass for registration outcomes
  - `RegistrationManager` class with:
    - `needs_registration()` - Check if device token is missing
    - `run_registration()` - Full registration flow execution
    - `_request_registration_code()` - Request code from backend API
    - `_poll_for_authorization()` - Poll backend for authorization status
    - `_save_token()` - Save device token to config file
    - `cancel()` - Cancel ongoing registration
    - State change callbacks for external monitoring
    - Async context manager support
  - `create_registration_manager()` factory function

- `daemon/tests/test_registration_manager.py` - 32 comprehensive tests covering:
  - Configuration defaults and custom values
  - RegistrationResult dataclass states
  - Manager initialization with/without token
  - Token detection (empty, whitespace)
  - State callbacks
  - Registration code request (success, failure, alternative fields)
  - Authorization polling (success, rejected, timeout, cancelled, expired code)
  - Token saving to config file
  - Full registration flow (success, rejection, failure)
  - Factory function

### Files Modified
- `daemon/glowworm_daemon/__init__.py` - Added exports for:
  - RegistrationManager, RegistrationConfig, RegistrationState, RegistrationResult
  - create_registration_manager

### Registration Flow
1. Daemon checks `needs_registration()` on startup
2. If no token, calls `run_registration(display_controller)`
3. Requests registration code from `POST /api/devices/register`
4. Displays code on Pi3D via `show_registration` IPC command
5. Polls `GET /api/devices/register/{code}/status` for authorization
6. On AUTHORIZED: saves token to config file, switches to normal mode
7. On REJECTED: returns rejected result for retry handling

### API Endpoints (consumed by daemon, implemented in Task 5.2)
- `POST /api/devices/register` - Request registration code
  - Request: `{ device_type, daemon_version, capabilities }`
  - Response: `{ code, device_id }`
- `GET /api/devices/register/{code}/status` - Poll for authorization
  - Response: `{ status: "PENDING" | "AUTHORIZED" | "REJECTED", device_token? }`

### Verification
- All 32 registration manager tests pass
- All 382 daemon tests pass: `pytest daemon/tests/ -v`
- Imports work correctly: `from glowworm_daemon import RegistrationManager, RegistrationConfig`

### Notes
- Uses aiohttp for async HTTP requests
- Exponential backoff on request failures (2s base, 30s max)
- Authorization timeout configurable (default 10 minutes)
- Poll interval configurable (default 5 seconds)
- Token saved to YAML config file, preserving existing settings
- Backend endpoints will be implemented in Task 5.2

### Next Task
Task 5.2: Backend Registration Endpoints

## 2026-02-28 19:15 - Task 5.2: Backend Registration Endpoints

### What Changed
Implemented API endpoints for Pi3D daemon-based device registration, enabling daemons to register and get authorized without browser cookies.

### Files Created
- `backend/api/device_registration.py` - New registration API with:
  - `POST /api/devices/register` - Request 4-character registration code
  - `GET /api/devices/register/{code}/status` - Poll for authorization status
  - `POST /api/devices/register/{code}/authorize` - Direct code authorization
  - `DaemonRegistrationRequest/Response` Pydantic models
  - `RegistrationStatusResponse` with status, token, device_id, playlist_id
  - `generate_registration_code()` helper (excludes ambiguous characters 0OI1L)

- `backend/tests/test_device_registration.py` - 17 comprehensive tests covering:
  - Code generation (length, characters, uniqueness)
  - Device registration (creates pending device)
  - Status polling (PENDING, AUTHORIZED, REJECTED, EXPIRED)
  - Code normalization (lowercase -> uppercase)
  - Invalid code handling (wrong length, not found)
  - Authorization flow (generates permanent 32-char token)
  - Full registration flow integration test
  - Rejection flow test

### Files Modified
- `backend/main.py` - Added device_registration_router import and include

### API Protocol
**POST /api/devices/register**
Request:
```json
{
  "device_type": "pi3d",
  "daemon_version": "3.0.0",
  "capabilities": {"pi3d_display": true, "websocket": true}
}
```
Response:
```json
{
  "code": "ABCD",
  "device_id": 1,
  "expires_at": "2026-02-28T19:45:00",
  "message": "Display this code..."
}
```

**GET /api/devices/register/{code}/status**
Response:
```json
{
  "status": "PENDING|AUTHORIZED|REJECTED|EXPIRED",
  "device_token": "32-char-permanent-token",
  "device_id": 1,
  "playlist_id": 42,
  "message": "..."
}
```

### Registration Flow
1. Daemon calls POST /api/devices/register → gets 4-char code
2. Daemon displays code on Pi3D screen via show_registration IPC
3. Daemon polls GET /api/devices/register/{code}/status every 5s
4. Admin authorizes device via existing /api/display-devices/admin/devices/{id}/authorize
5. Daemon receives AUTHORIZED status with permanent device token
6. Daemon saves token to config file and switches to normal mode

### Verification
- All 17 new registration tests pass
- All 63 backend tests pass: `pytest tests/ -v`
- Registration code excludes visually ambiguous characters (0, O, I, 1, L)
- Code expires after 30 minutes
- Permanent token is 32 characters (alphanumeric)

### Notes
- Registration code is stored as device_token initially, replaced with permanent token on authorization
- This is separate from browser-based registration in display_devices.py which uses cookies
- Daemon RegistrationManager (Task 5.1) consumes these endpoints
- Admin authorization still goes through existing /api/display-devices/admin/devices/{id}/authorize

### Next Task
Task 5.3: Frontend Registration Updates

## 2026-02-28 19:45 - Task 5.3: Frontend Registration Updates

### What Changed
Updated frontend to support Pi3D daemon device registration with device type indicators and appropriate controls.

### Files Modified
- `frontend/src/types/index.ts`:
  - Added `DeviceType` type (`'browser' | 'pi3d'`)
  - Added `DisplayDevice` interface with all device fields including Pi3D daemon status fields (device_type, last_state, last_image_id, cache stats, uptime)

- `frontend/src/pages/DisplaysWebSocket.tsx`:
  - Added device type imports (Server, Monitor, SkipForward, SkipBack icons)
  - Updated `DeviceStatus` interface with Pi3D daemon fields
  - Added `getDeviceTypeBadge()` helper - shows "Pi3D" (purple) or "Browser" (blue) badge
  - Added `isPi3dDevice()` helper function
  - Device list now shows device type badge next to device name
  - Pi3D devices show additional status info (state, cache size)
  - Authorization dialog confirms device type before authorizing
  - Updated command buttons:
    - Pi3D devices: previous, next, resume, pause, reload_playlist (no "Refresh Browser")
    - Browser devices: start_slideshow, stop_slideshow, reload_playlist, refresh_browser
  - Commands use appropriate command names for device type (resume/pause for Pi3D, start/stop_slideshow for browser)

- `frontend/src/pages/DisplayRegistration.tsx`:
  - Redesigned registration page with two clear options:
    - **Browser Display**: Auto-registers browser (existing behavior)
    - **Pi3D Display (Recommended)**: Shows setup instructions for Raspberry Pi
  - Pi3D section includes step-by-step instructions:
    1. Install script command
    2. Registration code display explanation
    3. Admin authorization steps
    4. Automatic slideshow start
  - Added visual distinction between registration methods (blue for browser, purple for Pi3D)

### Verification
- Frontend builds successfully: `npm run build`
- TypeScript compiles without errors: `npx tsc --noEmit`
- Device type badge displays correctly for both types
- Pi3D devices don't show "Refresh Browser" command
- Browser devices don't show next/previous commands
- Registration page shows clear instructions for both methods

### Test Coverage Summary
| Feature | Status |
|---------|--------|
| Device type badge in device list | Done |
| Pi3D status info display (state, cache) | Done |
| Authorization confirms device type | Done |
| Pi3D-specific commands (next/prev/pause/resume) | Done |
| Browser-specific commands hidden for Pi3D | Done |
| Registration page shows Pi3D instructions | Done |

### Notes
- Device type defaults to "browser" if not specified (backward compatible)
- Pi3D devices use `resume`/`pause` commands vs browser's `start_slideshow`/`stop_slideshow`
- Registration page explains that Pi3D registration happens via daemon, not browser
- Install script URL placeholder (`glowworm.example.com`) should be updated for production

### Next Task
Task 5.4: Integration Testing - Registration

## 2026-02-28 20:30 - Task 5.4: Integration Testing - Registration

### What Changed
Created comprehensive integration tests for the complete device registration flow.

### Files Created
- `daemon/tests/test_integration_registration.py` - 18 integration tests covering:
  - **Fresh daemon displays registration code**: Tests daemon without token requests code and displays it
  - **Registration code displayed on screen**: Tests code appears on Pi3D display via MockDisplayController
  - **Daemon with token skips registration**: Tests daemon with existing token doesn't need registration
  - **State transitions during code request**: Tests state machine (idle → checking → requesting → displaying)
  - **Daemon detects authorization**: Tests daemon receives token when admin authorizes
  - **Token saved to config file**: Tests device token persists to YAML config
  - **Authorization within timeout**: Tests authorization detected quickly (spec: <10 seconds)
  - **Registration display hidden after authorization**: Tests display cleared after completion
  - **Daemon detects rejection**: Tests rejection handling and state
  - **Rejection result includes error**: Tests meaningful error message on rejection
  - **Display hidden after rejection**: Tests display cleared after rejection
  - **Pending device in device list**: Tests pending device appears in admin list
  - **Authorized device in device list**: Tests authorized device in list with correct status
  - **Registration timeout**: Tests timeout when not authorized
  - **Retry on network error**: Tests retry logic on connection failures
  - **Complete registration to slideshow ready**: Tests full flow end-to-end
  - **Multiple registration attempts**: Tests re-registration after rejection
  - **Registration cancellation**: Tests cancellation mid-flow

### Test Infrastructure
- `MockBackendServer` - Mock backend HTTP server for registration endpoints:
  - POST /api/devices/register - Returns registration code
  - GET /api/devices/register/{code}/status - Returns PENDING/AUTHORIZED/REJECTED
  - POST /api/devices/register/{code}/authorize - Simulates admin authorization
  - GET /api/display-devices/admin/devices - Returns device list
- `MockDisplayController` - Mock display controller tracking show/hide calls

### Verification
- All 18 new integration tests pass
- All 400 daemon tests pass: `pytest daemon/tests/ -v`
- All 24 display tests pass: `pytest display/tests/ -v`
- Tests exercise real HTTP client (aiohttp) against mock server
- Tests cover all requirements from plan.md Task 5.4

### Test Coverage Summary
| Scenario | Status |
|----------|--------|
| Fresh daemon displays registration code | ✅ |
| Admin authorizes device | ✅ |
| Daemon detects authorization and starts slideshow | ✅ |
| Device appears correctly in admin device list | ✅ |

### Notes
- Mock server generates predictable codes (T001, T002, etc.) for test reliability
- Fast poll interval (0.1s) and short timeout (0.5s-5s) for quick test execution
- Tests verify token persistence to YAML config file
- Multiple registration attempts test covers retry-after-rejection scenario
- Cancellation test verifies graceful cleanup

### Next Task
Task 6.1: Device Status Display
