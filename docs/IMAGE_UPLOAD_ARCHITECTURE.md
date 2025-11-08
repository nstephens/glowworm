# Image Upload & Processing Architecture

## Overview

Image uploads use a fast synchronous upload path with asynchronous background processing via Celery workers. WebSocket notifications keep the UI updated in real-time via Redis pub/sub.

## Upload Flow

```
Frontend Upload
    ↓ (< 500ms)
Backend API (/api/images/upload)
    ├─ Validate image
    ├─ Extract EXIF metadata  
    ├─ Save original file
    ├─ Create database record (status: pending)
    └─ Queue Celery task
        ↓
    Response: 200 OK (with background_processing: true)
    
    ↓ (5-10 seconds, background)
Celery Worker (process_full_image)
    ├─ Generate 3 thumbnails (150px, 300px, 600px)
    │   └─ Publish "thumbnail_complete" to Redis
    ├─ Generate display variants (1080x1920, 2160x3840, etc.)
    │   └─ Publish "variant_complete" to Redis
    └─ Update database (status: complete)
        └─ Publish "processing_complete" to Redis
        
    ↓ (< 100ms)
FastAPI Redis Subscriber
    ├─ Receives message from Redis pub/sub
    └─ Broadcasts to WebSocket clients
    
    ↓ (instant)
Frontend WebSocket Handler
    ├─ Receives processing update
    ├─ Updates image status in state
    └─ UI automatically re-renders with thumbnail
```

## Components

### Backend API (`backend/api/images.py`)
- **Endpoint:** `POST /api/images/upload`
- **Responsibilities:**
  - File validation
  - EXIF extraction
  - Duplicate detection (via file hash)
  - Database record creation
  - Celery task queuing
- **Response Time:** < 500ms

### Celery Tasks (`backend/tasks/image_processing.py`)
- **Task:** `process_full_image`
- **Responsibilities:**
  - Thumbnail generation (3 sizes)
  - Display variant generation (configured resolutions)
  - Database status updates
  - WebSocket notifications via Redis pub/sub
- **Processing Time:** 5-10 seconds (depends on image size)
- **Concurrency:** 4 workers process in parallel

### Redis Pub/Sub Bridge

#### Publisher (`backend/websocket/redis_bridge.py`)
- **Called from:** Celery workers
- **Channel:** `glowworm:processing:updates`
- **Publishes:** Processing status events
- **Why needed:** Celery workers run in separate processes, can't access FastAPI's WebSocket connections

#### Subscriber (`backend/websocket/redis_subscriber.py`)
- **Runs in:** FastAPI app (background task)
- **Channel:** `glowworm:processing:updates`
- **Receives:** Processing status events from Celery
- **Broadcasts to:** Admin WebSocket connections

### Frontend WebSocket (`frontend/src/hooks/useProcessingUpdatesState.ts`)
- **Connects to:** `/api/ws/admin`
- **Listens for:**
  - `image:processing:thumbnail_complete`
  - `image:processing:variant_complete`
  - `image:processing:complete`
  - `image:processing:failed`
- **Updates:** Images state with new status
- **Triggers:** UI re-render with actual thumbnail

### Placeholder UI (`frontend/src/components/ImageGallery.tsx`)
- Shows gradient placeholder with spinner when `thumbnail_status !== 'complete'`
- Automatically replaced when status updates to `'complete'`
- Displays appropriate status text: "Queued", "Generating...", "Failed"

## Process Isolation Solution

### The Problem
Celery workers run in **separate processes** (ForkPoolWorker). Each process has its own memory space and cannot access:
- FastAPI app's WebSocket connections
- FastAPI app's connection_manager instance

### The Solution: Redis Pub/Sub
```
Celery Worker Process          FastAPI Process
    ↓                              ↓
notify_thumbnail_complete()    Redis Subscriber
    ↓                              ↓
publish_processing_update()    Receives from Redis
    ↓                              ↓
Redis Pub/Sub Channel          connection_manager
"glowworm:processing:updates"     ↓
                               WebSocket Clients
```

**Benefits:**
- ✅ Works across process boundaries
- ✅ Scalable (multiple workers, multiple API instances)
- ✅ Reliable (Redis handles message delivery)
- ✅ Fast (< 100ms latency)

## Database Schema

### Image Processing Fields
```sql
processing_status ENUM('pending', 'processing', 'complete', 'failed')
thumbnail_status ENUM('pending', 'processing', 'complete', 'failed')
variant_status ENUM('pending', 'processing', 'complete', 'failed')
processing_error TEXT
processing_attempts INT
last_processing_attempt DATETIME
processing_completed_at DATETIME
```

These fields track:
- Overall processing state
- Individual stage status (thumbnails vs variants)
- Error messages for failures
- Retry attempts for circuit breaker
- Processing timestamps

## Error Handling

### Circuit Breaker
- Prevents infinite retry loops
- Opens after 3 consecutive failures
- Requires manual retry via `/api/images/{id}/retry-processing`

### Fallback Mode
If Celery is unavailable:
- Falls back to FastAPI `BackgroundTasks`
- Slower (sequential vs parallel)
- Still works reliably

Set `USE_CELERY=false` in environment to force fallback mode.

## Configuration

### Environment Variables
```bash
# Celery (required for async processing)
CELERY_BROKER_URL=redis://glowworm-redis-dev:6379/0
CELERY_RESULT_BACKEND=redis://glowworm-redis-dev:6379/0
USE_CELERY=true

# Worker configuration (docker-compose.yml)
--concurrency=4          # 4 parallel workers
--queues=high_priority,normal_priority,low_priority
```

### Display Sizes
Configured in Settings UI:
- Default: `1080x1920`, `2160x3840`, `1038x1278`
- Automatically generated during variant processing
- Optimized for specific display devices

## Development

### Volume Mounts (docker-compose.yml)
```yaml
Backend:
  - backend/api:/app/api
  - backend/models:/app/models
  - backend/services:/app/services
  - backend/utils:/app/utils
  - backend/websocket:/app/websocket
  - backend/tasks:/app/tasks
  - backend/config:/app/config
  - backend/main.py:/app/main.py
  - backend/celery_app.py:/app/celery_app.py

Frontend:
  - frontend/src:/app/src
  - frontend/index.html:/app/index.html
  - frontend/vite.config.ts:/app/vite.config.ts
  - frontend/tailwind.config.js:/app/tailwind.config.js
```

### Hot Reload
- **Frontend:** Vite HMR (< 1 second)
- **Backend:** Uvicorn auto-reload (< 2 seconds)
- **Celery:** Auto-reload on code changes

**No rebuilds needed** for source code changes!

## Monitoring

### Logs
```bash
# Watch processing
docker compose logs -f glowworm-celery-worker-dev

# Watch WebSocket/Redis
docker compose logs -f glowworm-backend-dev | grep -E "(Redis|WebSocket)"

# All services
docker compose logs -f
```

### Database Status
```bash
docker compose exec glowworm-mysql-dev mysql -uglowworm -pdev_password_123 glowworm_dev \
  -e "SELECT id, processing_status, thumbnail_status, variant_status FROM images ORDER BY id DESC LIMIT 5;"
```

### Redis Queue
```bash
# Check queue length
docker compose exec glowworm-redis-dev redis-cli LLEN celery

# Monitor pub/sub
docker compose exec glowworm-redis-dev redis-cli PSUBSCRIBE "glowworm:*"
```

## Troubleshooting

### Images Stuck in Pending
1. Check Celery worker is running
2. Check Redis is accessible
3. Check for import errors in worker logs
4. Verify `USE_CELERY=true`

### WebSocket Not Updating
1. Check Redis subscriber started in backend logs
2. Check Celery is publishing to Redis
3. Check admin WebSocket connections exist
4. Check browser console for connection errors

### Processing Failures
1. Check worker logs for specific errors
2. Check file permissions in upload directories
3. Check display sizes are configured
4. Use retry endpoint to reset circuit breaker

## Performance

- **Upload:** < 500ms
- **Thumbnails:** 2-5 seconds (3 sizes)
- **Variants:** 3-8 seconds (depends on resolutions)
- **Total:** 5-10 seconds average
- **WebSocket latency:** < 100ms
- **Concurrent capacity:** 4 images simultaneously

## Future Improvements

- **Monitoring:** Add Flower UI for Celery task monitoring
- **Metrics:** Track success/failure rates
- **Retry Logic:** Automatic retry for transient failures
- **Progress:** Granular progress updates (30%, 60%, etc.)
- **Compression:** Optimize image sizes further

