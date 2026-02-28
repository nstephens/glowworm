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
