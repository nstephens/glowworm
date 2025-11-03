# GlowWorm Database Upgrade Strategy

## 🎯 Goal
Enable seamless upgrades where users only need to pull the latest Docker image, and all database migrations run automatically in the background.

## 🔧 Current Issue
The settings API is unavailable after upgrading to the latest image, likely due to:
1. Database migrations not running properly
2. Missing or corrupted database schema
3. Migration failures not being reported

## 📋 Upgrade Strategy

### 1. Enhanced Startup Script
- **File**: `docker/scripts/start-backend-with-migrations.sh`
- **Features**:
  - Robust MySQL connection waiting
  - Automatic database creation if missing
  - Enhanced migration error handling
  - Database schema verification
  - Detailed logging for troubleshooting

### 2. Migration Verification
- **File**: `backend/scripts/verify-migrations.py`
- **Purpose**: Verify database schema and migration status
- **Usage**: Can be run manually or as part of startup

### 3. Docker Image Updates

#### Update Dockerfile.backend
```dockerfile
# Replace the startup command
CMD ["/app/start-backend-with-migrations.sh"]
```

#### Update docker-compose.yml
```yaml
# Add health check for migration status
healthcheck:
  test: ["CMD", "python", "/app/scripts/verify-migrations.py"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 60s
```

## 🚀 Implementation Steps

### Step 1: Update Production Dockerfile
```bash
# Update Dockerfile.backend to use enhanced startup script
sed -i 's|CMD \["/app/start-backend.sh"\]|CMD \["/app/start-backend-with-migrations.sh"\]|' Dockerfile.backend
```

### Step 2: Rebuild and Push Images
```bash
# Build new backend image with enhanced startup
docker build -f Dockerfile.backend -t glowworm-backend:latest .
docker tag glowworm-backend:latest nickstephens/glowworm-backend:latest
docker push nickstephens/glowworm-backend:latest
```

### Step 3: Update Production Deployment
```bash
# On production server
docker-compose pull
docker-compose up -d
```

## 🔍 Troubleshooting

### Check Migration Status
```bash
# Check current migration version
docker exec glowworm-backend python -m alembic current

# Check migration history
docker exec glowworm-backend python -m alembic history --verbose

# Verify database schema
docker exec glowworm-backend python /app/scripts/verify-migrations.py
```

### Manual Migration (if needed)
```bash
# Run migrations manually
docker exec glowworm-backend python -m alembic upgrade head

# Check database tables
docker exec glowworm-mysql mysql -u glowworm -p glowworm -e "SHOW TABLES;"
```

### Reset Database (last resort)
```bash
# Backup current data
docker exec glowworm-mysql mysqldump -u glowworm -p glowworm > backup.sql

# Drop and recreate database
docker exec glowworm-mysql mysql -u glowworm -p -e "DROP DATABASE glowworm; CREATE DATABASE glowworm;"

# Restart with fresh database
docker-compose restart glowworm-backend
```

## 📊 Monitoring

### Health Checks
- Backend container health check includes migration verification
- Database schema validation on startup
- Migration status logging

### Logs to Monitor
```bash
# Watch migration logs
docker logs -f glowworm-backend | grep -E "(migration|database|schema)"

# Check for errors
docker logs glowworm-backend | grep -E "(ERROR|FAILED|❌)"
```

## 🎯 Expected Outcome

After implementing this strategy:
1. **Seamless Upgrades**: Users only need to pull latest image
2. **Automatic Migrations**: Database schema updates automatically
3. **Error Visibility**: Clear logging when migrations fail
4. **Recovery Options**: Multiple fallback strategies
5. **Health Monitoring**: Automated verification of database state

## 🔄 Future Improvements

1. **Migration Rollback**: Add ability to rollback failed migrations
2. **Data Backup**: Automatic backup before major migrations
3. **Migration Testing**: Test migrations in staging environment
4. **Notification System**: Alert on migration failures
5. **Performance Monitoring**: Track migration execution time

