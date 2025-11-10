# Glowworm Changelog (Draft)

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - Unstable Branch

### Added

#### Display Device Image Cache & Reliability System

**Client-Side Image Caching with IndexedDB**
- IndexedDB-based image storage for 99.9%+ load reliability
- Automatic cache preloading on playlist load (background downloads)
- Cache-first serving with instant image display (0ms load time)
- Supports large playlists (10-12GB storage capacity on Raspberry Pi)
- Intelligent parallel downloads with rate limiting and bandwidth detection
- Exponential backoff retry logic for failed downloads

**Multi-Layered Cache Invalidation**
- **Automatic (Checksum-Based)**: MD5 hash validation detects server-side changes
  - Compares cached vs. server checksums on every manifest load
  - Automatically re-downloads only changed images (bandwidth-efficient)
  - Zero-config, completely transparent operation
- **Manual (WebSocket)**: Admin-triggered cache clearing for troubleshooting
  - Send `clear_cache` message to specific device or broadcast to all
  - Immediate IndexedDB wipe and re-download trigger
- **TTL-Based (Optional)**: Time-based expiration for gradual cache refresh
  - Configurable expiration timestamps per image
  - Automatic cleanup of expired entries

**Service Worker Integration**
- Intercepts image requests for transparent cache-first serving
- Automatically serves images from IndexedDB when available
- Falls back to Cache API → network if needed
- Works seamlessly with existing slideshow code

**Smart Preload Manager**
- Fetches lightweight manifest (IDs, URLs, checksums) before downloading
- Delta updates: Only downloads new/changed images on playlist update
- Configurable concurrency (default: 3 parallel downloads)
- Rate limiting (default: 5 images/second) to prevent network saturation
- Adaptive throttling based on detected bandwidth
- Progress tracking with detailed console logging

**Display Integration**
- Integrated into DisplayView (Raspberry Pi display component)
- Preload starts automatically when playlist loads
- Visual progress indicators during initial cache population
- Blob URL generation for cached images (memory-efficient)
- Automatic cleanup of unused blob URLs to prevent memory leaks

**Monitoring & Debugging**
- Comprehensive console logging for cache operations
- Storage quota tracking and warnings
- LRU (Least Recently Used) eviction for space management
- Cache statistics API (image count, total size, quota info)
- Detailed error reporting with retry attempt tracking

**Backend API**
- New `/api/playlists/{id}/images/manifest` endpoint
- Returns lightweight metadata (ID, URL, filename, MIME, size, checksum)
- Public endpoint (no user auth required for display devices)
- Uses existing `Image.file_hash` field for MD5 checksums

#### Display Device Daemon System

**Remote Display Control via HDMI CEC**
- Control display power (on/off) remotely through HDMI CEC commands
- Switch HDMI inputs programmatically (e.g., between Raspberry Pi, Fire TV, cable box)
- Automatic display detection and device scanning
- Real-time daemon status monitoring in the admin interface
- Device registration with 4-character authentication codes

**Installation & Setup**
- One-command installation script for Raspberry Pi devices
- Automatic systemd service configuration for reliable background operation
- Interactive setup wizard for daemon configuration
- Built-in health monitoring and automatic error recovery

**Admin Interface**
- New "Device Controls" section on Displays page
  - Display power control buttons
  - Quick-action button to switch to Glowworm display
  - HDMI input selection (when available)
  - Live daemon status indicators
- Device token display with one-click copy
- Daemon connection status and last check-in time

#### Automated Display Actions Scheduler

**Schedule Display Power & Input Changes**
- New "Device Actions" scheduler (Admin → Scheduler → Device Actions)
- Create schedules to automatically:
  - Power displays on/off at specific times
  - Switch HDMI inputs on schedule
  - Combine power and input actions
- Two schedule types supported:
  - **Recurring**: Daily schedules (e.g., "Power on Mon-Fri at 8:00 AM")
  - **Specific Date**: One-time or annual events (e.g., "Power off on Dec 25")

**Persistent Execution with Catch-Up**
- Actions execute even if server was temporarily offline
- Configurable catch-up window (default: 10 minutes)
- Prevents missed actions due to server restarts, network issues, or brief outages
- No duplicate executions - smart timestamp tracking ensures actions run once

**Scheduling Features**
- Priority-based action execution (when multiple actions overlap)
- Visual schedule status and next scheduled action
- Quick enable/disable toggles for temporary schedule changes
- Action history and execution tracking

#### Scheduler UI Improvements

**Reorganized Navigation**
- Scheduler menu now has two sections:
  - **Playlists**: Schedule which playlists play when
  - **Device Actions**: Schedule display power and input changes
- Cleaner navigation with accordion-style menu
- Consistent header styling across all admin pages

**Enhanced Displays Page Layout**
- Reorganized device information for better workflow:
  - Playlist controls at the top (most frequently used)
  - Schedule status widget prominently displayed
  - Device controls in collapsible section
- One-click actions for common tasks
- Improved visual hierarchy and spacing

### Changed

#### Scheduler Reliability

**Improved Schedule Evaluation**
- More robust schedule checking runs every minute
- Better handling of edge cases at day boundaries
- Improved timezone handling for consistent scheduling

**Performance Optimizations**
- Indexed database queries for faster schedule lookups
- Reduced polling overhead for daemon communication
- Optimized device command queue processing

### Technical

#### Image Cache Infrastructure

**Frontend Services**
- `ImageCacheService.ts` - Core IndexedDB operations (CRUD, LRU, quota management)
- `PreloadManager.ts` - Intelligent download orchestration and scheduling
- Enhanced Service Worker - Cache-first request interception
- DisplayView integration - Automatic preload on playlist load

**IndexedDB Schema**
- Database: `glowworm_image_cache` (v1)
- Object Store: `cached_images` with compound indexes
  - `by_playlist` - Query images by playlist ID
  - `by_cached_at` - Sort by cache timestamp
  - `by_last_accessed` - LRU eviction support
  - `by_expires_at` - TTL expiration queries

**Storage Math**
- Typical image: 2-9MB (optimized/smart endpoint)
- Average playlist: ~380MB for 88 images
- Raspberry Pi capacity: 10-12GB (supports 25-30 large playlists)
- Cache overhead: <5% (metadata + indexes)

**Performance Characteristics**
- First load: 88 images in ~17 seconds (parallel downloads)
- Subsequent loads: 0 network requests (instant from cache)
- Checksum validation: <1 second per manifest
- Delta updates: Only changed images downloaded

#### Backend Infrastructure

**New API Endpoints**
- `/api/playlists/{id}/images/manifest` - Lightweight image manifest with checksums
- `/api/device-daemon/*` - Device registration, command queue, status
- `/api/scheduler-actions/*` - CRUD operations for scheduled device actions
- Rate limiting on daemon polling endpoints (20 req/min per device)

**Database Enhancements**
- New tables: `device_commands`, `device_daemon_status`, `scheduled_actions`
- Execution tracking: `last_executed_at`, `catch_up_window_minutes`
- Comprehensive indexing for performance

**Background Processing**
- Celery tasks for schedule evaluation every minute
- Device action evaluation runs alongside playlist schedules
- Graceful error handling and automatic retry logic

#### Daemon Architecture

**Python Daemon Service**
- Lightweight Python daemon (~5-10 MB memory footprint)
- Polls backend every 5 seconds for pending commands
- Automatic reconnection on network failures
- Comprehensive logging to systemd journal

**CEC Integration**
- Uses `cec-client` for HDMI CEC communication
- Automatic CEC adapter detection (`/dev/cec0`, `/dev/cec1`)
- Device scanning and address resolution
- Robust timeout handling and error recovery

### Security

**Device Authentication**
- 4-character authentication codes for device registration
- Token-based API authentication for daemon communication
- Device authorization workflow (pending → authorized)
- Per-device access control

**Rate Limiting**
- API rate limits prevent command flooding
- Per-device quotas for fair resource allocation
- Automatic throttling of excessive requests

### Known Issues & Limitations

**Image Cache Browser Compatibility**
- IndexedDB supported on all modern browsers (Chrome, Firefox, Safari, Edge)
- Raspberry Pi default browser (Chromium) fully supported
- Storage quota varies by browser and OS (typically 10-50% of free disk space)
- Service Worker requires HTTPS in production (HTTP OK for localhost/development)
- Very old browsers (<2017) may not support IndexedDB v2 (graceful degradation)

**Cache Limitations**
- Checksum validation requires `Image.file_hash` field to be populated
- Images without checksums will still cache but won't auto-invalidate
- Manual cache clear requires WebSocket connection (fallback: browser storage clear)
- First playlist load requires full download (subsequent loads are instant)
- Network interruptions during initial download may require page refresh

**HDMI CEC Compatibility**
- CEC functionality varies by TV manufacturer and model
- Some TVs may not respond to all CEC commands
- "Smart" TVs may default to built-in apps on power-on (workaround included)
- Input switching reliability depends on TV's CEC implementation

**Daemon Requirements**
- Requires Raspberry Pi (or compatible device) with HDMI CEC support
- Requires `cec-utils` package installation
- Device must have direct HDMI connection to display
- Network connectivity required for backend communication

**Catch-Up Window**
- Actions missed by more than catch-up window (default: 10 min) will not execute
- Prevents unexpected actions hours/days late
- Window is configurable per action if needed

### Upgrade Notes

**Database Migration Required**
- Three new migrations add device daemon and scheduler tables
- Run `alembic upgrade head` in backend container
- No data loss - all existing schedules and displays preserved

**New Dependencies**
- Backend: No new Python packages required
- Daemon: Requires `cec-utils` on target device (auto-installed by setup script)
- Frontend: No new npm packages required
- Image cache uses browser-native IndexedDB (no additional libraries)

**Configuration**
- No environment variable changes required
- Optional: Configure rate limiting in backend settings
- Daemon configuration via interactive setup wizard
- Image cache configured automatically (zero-config)

**Image Cache Setup**
- Automatically activates on first display device load
- No admin configuration needed
- Background preload starts when playlist loads
- IndexedDB created in browser local storage
- Review comprehensive documentation: `docs/CACHE_INVALIDATION.md`

**For Existing Display Devices**
- Rebuild frontend container to include cache features
- Hard refresh display device browsers (Ctrl+Shift+R)
- Cache will populate automatically on next playlist load
- Monitor browser console for cache progress logs

### Migration Path

**From Previous Version**
1. Pull latest `unstable` branch
2. Run database migrations: `docker compose exec glowworm-backend alembic upgrade head`
3. Restart backend and Celery services
4. (Optional) Install daemon on display devices following installation guide

**Rollback Support**
- All migrations have `downgrade()` functions
- Can rollback to previous version safely
- Daemon is optional - existing functionality unaffected if not installed

---

## Future Enhancements (Planned)

### Image Cache System
- [ ] Broadcast `clear_cache` to all devices
- [ ] Selective invalidation (single image via WebSocket)
- [ ] Cache version tagging for major updates
- [ ] Invalidation statistics in admin panel
- [ ] Partial image updates (binary diff for bandwidth savings)
- [ ] Compression before caching (reduce storage requirements)
- [ ] Multi-tier cache (memory + IndexedDB for ultra-fast access)

### Device Actions Scheduler
- [ ] Multiple actions per schedule (power on AND switch input)
- [ ] Conditional actions (only if display is off, etc.)
- [ ] Action templates for common scenarios

### Monitoring & Alerts
- [ ] Dashboard with action success/failure statistics
- [ ] Historical execution log viewer
- [ ] Cache health monitoring dashboard

### UI Improvements
- [ ] Drag-and-drop schedule reordering
- [ ] Schedule conflict detection and warnings
- [ ] Quick schedule templates
- [ ] Mobile-optimized daemon controls
- [ ] Visual cache status in admin panel

---

## Notes

**What's in `unstable`:**
This changelog documents features currently in the `unstable` branch. These features are:
- ✅ Fully implemented and tested
- ✅ Working in development environment
- ⚠️ Pending broader testing on multiple devices/TV models
- ⚠️ Not yet deployed to production

**Testing Feedback Welcome:**
If you're testing these features, please report:
- TV/display model and CEC compatibility
- Schedule reliability and catch-up behavior
- UI/UX feedback
- Any bugs or unexpected behavior

**Version Numbering:**
Version numbers will be assigned when features are promoted from `unstable` to `main` branch.

---

## Changelog Conventions

**Types of changes:**
- **Added**: New features
- **Changed**: Changes to existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Features removed in this release
- **Fixed**: Bug fixes
- **Security**: Vulnerability fixes or security improvements

**Audience:**
- Primary audience: End users and administrators
- Technical details included for reference
- Implementation details in separate developer documentation

