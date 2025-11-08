# Scheduler Feature - Deployment Notes

## What's Implemented

✅ **Database Schema** (Task 1)
- ScheduledPlaylist model with all fields
- Alembic migration ready to run
- Relationships configured

✅ **Evaluation Logic** (Task 2)
- SchedulerService with CRUD operations
- get_active_schedule() with priority resolution
- evaluate_all_devices() for background task
- Conflict detection logic
- Preview functionality

✅ **Celery Task** (Task 3)
- evaluate_schedules task runs every 60 seconds
- Integrates with SchedulerService
- WebSocket notifications via Redis pub/sub
- Configured in Celery Beat schedule

## What's Needed to Deploy

### 1. Database Migration

Run the migration to create the `scheduled_playlists` table:

```bash
# Development (Docker)
cd /home/nick/websites/glowworm/docker-publish
docker compose exec glowworm-backend-dev alembic upgrade head

# Or rebuild containers (migration runs automatically on startup)
docker compose down
docker compose up -d
```

### 2. Celery Beat Service

Add a Celery Beat container to run periodic tasks. Update `docker-compose.yml`:

```yaml
# Add this service after glowworm-celery-worker-dev
  glowworm-celery-beat-dev:
    image: glowworm-backend-local
    container_name: glowworm-celery-beat-dev
    restart: unless-stopped
    command: celery -A celery_app beat --loglevel=info
    environment:
      # Database connection
      MYSQL_HOST: glowworm-mysql-dev
      MYSQL_PORT: 3306
      MYSQL_DATABASE: ${MYSQL_DATABASE:-glowworm_dev}
      MYSQL_USER: ${MYSQL_USER:-glowworm}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD:-dev_password_123}
      
      # Celery configuration
      CELERY_BROKER_URL: redis://glowworm-redis-dev:6379/0
      CELERY_RESULT_BACKEND: redis://glowworm-redis-dev:6379/0
      
      # Application settings
      SECRET_KEY: ${SECRET_KEY:-dev_secret_key_change_in_production_123}
      LOG_LEVEL: ${LOG_LEVEL:-INFO}
    volumes:
      # Mount source code for hot-reload
      - /home/nick/websites/glowworm/backend/tasks:/app/tasks:ro
      - /home/nick/websites/glowworm/backend/services:/app/services:ro
      - /home/nick/websites/glowworm/backend/models:/app/models:ro
      - /home/nick/websites/glowworm/backend/celery_app.py:/app/celery_app.py:ro
    depends_on:
      glowworm-redis-dev:
        condition: service_healthy
      glowworm-mysql-dev:
        condition: service_healthy
    networks:
      - glowworm-network-dev
```

Then start it:
```bash
docker compose up -d glowworm-celery-beat-dev
```

## Verification

### Check Celery Beat is Running
```bash
docker compose ps glowworm-celery-beat-dev
docker compose logs -f glowworm-celery-beat-dev
```

You should see:
```
[2025-11-08 10:00:00] Scheduler: Sending due task evaluate-playlist-schedules
```

### Check Schedule Evaluation
```bash
# Watch worker logs for evaluation
docker compose logs -f glowworm-celery-worker-dev | grep "Schedule evaluation"

# Should see every 60 seconds:
# ✅ Schedule evaluation complete in 0.15s: X devices, Y active schedules, Z changes
```

### Test Manual Evaluation
Once API endpoints are created (Task 5), you can force evaluation:
```bash
curl -X POST http://10.10.10.2:8002/api/scheduler/evaluate-now \
  -H "Authorization: Bearer $TOKEN"
```

## Current Status

**Implemented:**
- Database schema ✅
- Evaluation logic ✅  
- Celery task ✅
- Beat configuration ✅

**Next Steps:**
- Task 4: WebSocket integration
- Task 5: API endpoints
- Task 6: Pydantic models
- Task 7+: Frontend UI

**To Continue Development:**
1. Add Celery Beat service to docker-compose.yml
2. Rebuild containers or just start Beat service
3. Implement remaining tasks

## Notes

- Celery Beat requires the `celery-beat` command instead of `worker`
- Only ONE Beat instance should run (handles scheduling for all workers)
- Beat writes to Redis, workers consume the tasks
- Beat container can be paused without affecting existing functionality

