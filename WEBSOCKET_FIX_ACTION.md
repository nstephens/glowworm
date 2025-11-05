# WebSocket Fix - Immediate Action Required

## The Root Cause

The Vite development server proxy was **not configured to handle WebSocket upgrades** for `/api/*` endpoints. It only had `ws: true` on a separate `/ws` path that wasn't being used.

## What Was Fixed

Updated `frontend/vite.config.ts` to enable WebSocket proxying:

```typescript
proxy: {
  '/api': {
    target: process.env.VITE_BACKEND_URL || 'http://glowworm-backend-dev:8001',
    changeOrigin: true,
    secure: false,
    ws: true, // ← THIS LINE WAS MISSING!
  },
}
```

## What You Need To Do RIGHT NOW

### If Running Development Server:

1. **Stop the current Vite dev server** (Ctrl+C in the terminal where it's running)

2. **Copy the updated vite.config.ts** from `/home/nick/websites/glowworm/` to your dev location if needed

3. **Restart the dev server:**
   ```bash
   cd /home/nick/websites/glowworm/frontend
   npm run dev
   ```

4. **Refresh your browser** (hard refresh with Ctrl+F5)

5. **Test WebSocket connection:**
   - Go to Settings → Display Settings
   - Click "Regenerate Resolutions"
   - Check browser console - you should see:
     ```
     🔌 Connecting to WebSocket: ws://10.10.10.2:3005/api/ws/regeneration-progress/...
     ✅ WebSocket connected
     ```

### If Running in Production:

The production setup (nginx) was already configured correctly. You just need to:

1. **Deploy the updated files:**
   ```bash
   cd /home/nick/Harbor/glowworm
   # Copy updated files from /home/nick/websites/glowworm/
   
   # Rebuild frontend
   cd frontend
   npm run build
   
   # Restart backend if needed
   cd ../backend
   sudo systemctl restart glowworm-backend
   ```

2. **Clear browser cache** on display devices

## How It Works Now

### Development Flow:
```
Browser → ws://10.10.10.2:3005/api/ws/...
         ↓ (Vite proxy with ws:true)
Backend ← ws://glowworm-backend-dev:8001/api/ws/...
```

### Production Flow:
```
Browser → wss://gw.pdungeon.com/api/ws/...
         ↓ (nginx proxy with WebSocket support)
Backend ← ws://127.0.0.1:8001/api/ws/...
```

Both environments now properly handle WebSocket upgrades! 🎉

## Verification

After restarting the dev server, check the browser console. You should see:

✅ **Success:**
```
🔌 Connecting to WebSocket: ws://10.10.10.2:3005/api/ws/regeneration-progress/xxx
✅ WebSocket connected
📨 WebSocket message received: {...}
```

❌ **Failure (old behavior):**
```
🔌 Connecting to WebSocket: ws://10.10.10.2:3005/api/ws/regeneration-progress/xxx
❌ WebSocket error: Event {type: 'error', ...}
🔌 WebSocket closed: 1006
```

## Troubleshooting

If it still doesn't work after restarting:

1. **Verify vite.config.ts was updated:**
   ```bash
   grep -A 5 "proxy:" frontend/vite.config.ts
   ```
   Should show `ws: true`

2. **Check if backend is accessible:**
   ```bash
   curl http://glowworm-backend-dev:8001/api/health
   # or
   curl http://localhost:8001/api/health
   ```

3. **Check Vite dev server output** for any proxy errors

4. **Verify VITE_BACKEND_URL** (if set):
   - Should point to where backend is accessible
   - Default `http://glowworm-backend-dev:8001` works in Docker Compose
   - Use `http://localhost:8001` if running backend locally outside Docker



