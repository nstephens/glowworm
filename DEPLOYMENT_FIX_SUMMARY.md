# Production Deployment Fix Summary

## Issues Identified

1. **WebSocket Connection Failure**: Frontend was trying to connect to `ws://localhost:8001` which doesn't work in production
2. **Full Resolution Images**: 2K displays were showing full-res images instead of scaled variants
3. **Missing 2K Landscape Support**: Only portrait resolutions were predefined (2k-portrait, 4k-portrait)

## Changes Made

### 1. Vite WebSocket Proxy Configuration (`frontend/vite.config.ts`)

**Problem**: The Vite development proxy had WebSocket support disabled for `/api/*` endpoints.

**Solution**: Added `ws: true` to the `/api` proxy configuration:

```typescript
proxy: {
  '/api': {
    target: process.env.VITE_BACKEND_URL || 'http://glowworm-backend-dev:8001',
    changeOrigin: true,
    secure: false,
    ws: true, // Enable WebSocket proxying for /api/ws/* endpoints
  },
}
```

This enables WebSocket upgrade requests to be properly forwarded from the Vite dev server to the backend.

### 2. Frontend WebSocket URL Resolution (`frontend/src/services/urlResolver.ts`)

**Problem**: The `getWebSocketUrl` method was using `serverBaseUrl` from localStorage, which could be set to `localhost:8001`, causing production WebSocket connections to fail.

**Solution**: Updated to always use the current window location for WebSocket URLs, ensuring they work through reverse proxy:

```typescript
public getWebSocketUrl(endpoint: string = ''): string {
  // Always use current window location for WebSocket connections
  // This ensures WebSockets work through reverse proxy in production
  if (typeof window !== 'undefined') {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsHost = window.location.host; // includes port if present
    const wsPath = endpoint.startsWith('/api/ws') ? endpoint : `/api/ws${endpoint}`;
    return `${wsProtocol}://${wsHost}${wsPath}`;
  }
  // ... fallback for non-browser environments
}
```

### 3. Nginx WebSocket Configuration (`deployment/nginx/glowworm.conf`)

**Problem**: WebSocket connections shared the same location block as regular API requests with insufficient timeouts.

**Solution**: Added dedicated WebSocket location block with proper configuration:

```nginx
# WebSocket endpoints - must come before general /api/ location
location /api/ws/ {
    proxy_pass http://glowworm_api;
    proxy_http_version 1.1;
    
    # WebSocket upgrade headers
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    
    # Extended timeouts for long-lived WebSocket connections
    proxy_connect_timeout 7d;
    proxy_send_timeout 7d;
    proxy_read_timeout 7d;
    
    # Disable buffering for WebSocket
    proxy_buffering off;
}
```

### 4. Display Size Resolution Support (`backend/services/image_storage_service.py`)

**Problem**: Only portrait resolutions were supported as presets. A 2560x1440 (2K landscape) display would fall back to original images because no suitable scaled variant existed.

**Solution**: Added landscape resolution presets:

- `2k` or `2k-landscape` → 2560x1440 (QHD)
- `4k` or `4k-landscape` → 3840x2160 (UHD)
- `1080p` or `fullhd` → 1920x1080 (Full HD)

Users can also specify custom resolutions directly: `2560x1440`, `3440x1440`, etc.

### 5. Settings UI Display Presets (`frontend/src/pages/Settings.tsx`)

**Problem**: UI only showed portrait presets.

**Solution**: Added landscape presets to the display sizes list:

- Full HD (1920x1080)
- 2K QHD (2560x1440) ← **NEW**
- 4K UHD (3840x2160) ← **NEW**
- 2K Portrait (1080x1920)
- 4K Portrait (2160x3840)

## Deployment Steps

### 1. Deploy Code Changes

```bash
cd /home/nick/Harbor/glowworm

# Pull latest changes or copy files from /home/nick/websites/glowworm:
# - frontend/src/services/urlResolver.ts
# - frontend/src/pages/Settings.tsx
# - frontend/vite.config.ts (IMPORTANT - enables WebSocket proxy!)
# - backend/services/image_storage_service.py
# - deployment/nginx/glowworm.conf

# For Development: Restart Vite dev server
cd frontend
# Stop the current dev server (Ctrl+C)
npm run dev
# The new vite.config.ts with ws:true will take effect

# For Production: Rebuild frontend
cd frontend
npm run build

# Restart backend
cd ../backend
# Assuming you're using systemd or similar
sudo systemctl restart glowworm-backend

# Update and reload nginx
sudo cp deployment/nginx/glowworm.conf /etc/nginx/sites-available/glowworm
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

### 2. Configure Display Sizes

1. Go to **Admin → Settings → Display Settings**
2. Select **2K QHD (2560x1440)** from the available display sizes
3. Click **"Regenerate Resolutions"** button
4. Monitor the regeneration progress modal (WebSocket should now work!)

### 3. Clear Browser Cache

Users should clear their browser cache or use hard refresh (Ctrl+F5) to ensure the new `urlResolver` code is loaded.

## Testing

### Verify WebSocket Connection

1. Open browser DevTools → Console
2. Navigate to Settings → Display Settings
3. Click "Regenerate Resolutions"
4. You should see:
   - `🔌 Connecting to WebSocket: wss://gw.pdungeon.com/api/ws/regeneration-progress/[task-id]`
   - `✅ WebSocket connected`
   - Progress updates flowing

### Verify Image Serving

1. Check the display view on your 2K display
2. Open DevTools → Network tab
3. Look for image requests - they should be fetching scaled versions like:
   - `/api/images/[id]/smart` (smart endpoint uses best variant)
   - File size should be reasonable (not full-res)

## Additional Notes

### Custom Display Sizes

You can add any custom resolution in Settings:
- Name: "Ultrawide 2K"
- Width: 3440
- Height: 1440

Or directly in the database as: `3440x1440`

### Resolution Matching Logic

The system finds the best matching scaled variant by:
1. Calculating effective resolution (display_width × device_pixel_ratio)
2. Finding variants with similar aspect ratio
3. Preferring variants close to or slightly larger than the display
4. Falling back to original if display is larger than all variants

With 2K (2560x1440) variants now available, your 2K displays should serve properly scaled images!

## Rollback Plan

If issues occur, revert these files:
1. `frontend/src/services/urlResolver.ts` - restore old `getWebSocketUrl` method
2. `deployment/nginx/glowworm.conf` - remove `/api/ws/` location block
3. Rebuild frontend and reload nginx

## Support

- WebSocket logs: Check browser console and backend logs
- Image serving: Check backend logs for resolution matching decisions
- Nginx: `sudo tail -f /var/log/nginx/glowworm_error.log`

