# Image Transition Debugging & Fix

## Problem Statement
Display devices were experiencing image stuttering and showing duplicate images during transitions:
- Image would fade to black
- Old image would appear again briefly
- Then suddenly swap to the correct new image

## Root Cause
The slideshow was fading in **before** the browser had fully loaded the new image, causing:
1. Fade out old image ✅
2. Change `<img src>` to new image
3. **Fade in immediately** ❌ (Browser still loading!)
4. Browser shows cached old image from memory
5. New image finishes loading → sudden swap

## Solution Implemented

### 1. Comprehensive Transition Logging (`transitionLogger.ts`)
Created a new service that tracks every step of image transitions:
- `transition_start` - Begin transition
- `fade_out_start` / `fade_out_complete` - Track fade out
- `index_change` - Index updated
- `src_change` - Image src attribute changed
- `image_load_start` / `image_load_complete` - Track image loading
- `fade_in_start` / `fade_in_complete` - Track fade in
- `transition_complete` - End transition

Each event includes:
- Timestamp
- Current/next index
- Image ID and URL
- Whether image was preloaded
- Load time
- Any errors

### 2. Fixed Transition Flow
**Old Flow (Broken):**
```
Fade out (300ms) → Change index → Fade in immediately ❌
```

**New Flow (Fixed):**
```
Fade out (300ms) → Change index → **WAIT for image load** → Fade in ✅
```

The slideshow now:
1. Sets `waitingForLoad = true` after changing index
2. Waits for the `onLoad` event to fire
3. Sets `nextImageReady = true` when image loads
4. useEffect watches for both flags
5. Only then fades in the image

### 3. Timeout Safety
If an image fails to load or takes too long (>2s), the system:
- Logs an error
- Forces fade-in anyway (better than being stuck)
- Reports the issue to backend logs

### 4. Export Logs for Debugging
Added two ways to export transition logs:

**Method 1: Keyboard Shortcut**
- Press `E` key while slideshow is running
- Logs are copied to clipboard

**Method 2: UI Button**
- Move mouse to show controls
- Click "Export Logs (E)" button in bottom-left
- Logs are copied to clipboard

**Log Format:**
```json
[
  {
    "id": "transition_1730600000_5",
    "events": [
      {
        "type": "transition_start",
        "time": 1730600000,
        "index": 5
      },
      {
        "type": "fade_out_start",
        "time": 1730600010,
        "index": 5
      },
      ...
    ]
  }
]
```

### 5. Backend Logging Integration
All transition events are also sent to the backend via `displayDeviceLogger`:
- View in Admin → Logs → Display logs
- Filter by device
- See timing information for each transition
- Identify slow loading images
- Detect fade-in-before-load issues

## Testing Instructions

1. **Deploy the new images:**
   ```bash
   cd ~/Harbor/glowworm
   docker compose down && docker compose up -d
   ```

2. **Navigate to a display device URL**

3. **Watch for issues during transitions**
   - Does the old image flash before the new one?
   - Are transitions smooth?
   - Any stuttering?

4. **Export logs if issues occur:**
   - Press `E` key or click "Export Logs" button
   - Paste logs when reporting issues

5. **Check backend logs:**
   - Go to `/admin/logs` → Display logs tab
   - Filter by your device
   - Look for transition events
   - Check for warnings about "fade-in before load"

## What to Look For

### Healthy Transition
```json
{
  "totalDuration": 650,
  "loadTime": 45,
  "fadeInBeforeLoad": false,
  "wasPreloaded": true,
  "issues": [],
  "isHealthy": true
}
```

### Problematic Transition
```json
{
  "totalDuration": 1850,
  "loadTime": 1200,
  "fadeInBeforeLoad": true,  ❌ This causes duplicate image flash
  "wasPreloaded": false,
  "issues": [
    "Slow image load: 1200ms",
    "Fade-in started before image fully loaded"
  ],
  "isHealthy": false
}
```

## Expected Improvements

✅ **No more duplicate image flash** - Waits for load before fade-in
✅ **Smoother transitions** - Proper sequencing
✅ **Diagnostic data** - Comprehensive logging
✅ **Automatic error detection** - Flags problematic transitions
✅ **Easy debugging** - Export logs with one key press

## Rollback Instructions

If issues occur, revert to Docker Hub `:latest` images:
```bash
cd ~/Harbor/glowworm
# Edit docker-compose.yml and change :test back to :latest
docker compose down && docker compose pull && docker compose up -d
```

## Technical Details

**Modified Files:**
- `frontend/src/services/transitionLogger.ts` (NEW)
- `frontend/src/components/FullscreenSlideshowOptimized.tsx` (MODIFIED)

**Key Changes:**
- Added `waitingForLoad` and `nextImageReady` state flags
- Modified `performTransition()` to wait for image load
- Added `useEffect` to watch for image ready and trigger fade-in
- Enhanced all `onLoad` handlers to set `nextImageReady` flag
- Added comprehensive event logging throughout
- Added keyboard shortcut and UI button for log export
- Added 2-second timeout as safety fallback

**Backend Integration:**
- All transition events logged via `displayDeviceLogger`
- Viewable in `/admin/logs` → Display logs
- Automatically flags unhealthy transitions
- Provides diagnostic information for troubleshooting

