# Hardcoded Values Audit

This document tracks hardcoded IP addresses and URLs in the Glowworm codebase.

## ✅ FIXED - Critical Hardcoded Values

These have been replaced with dynamic values from `server_base_url`:

1. **`backend/utils/cookies.py`** ✅
   - Cookie domain now extracted from `server_base_url`
   - Supports cross-port cookie access

2. **`backend/models/image.py`** ✅
   - Image URLs now use `server_base_url`
   - Thumbnail URLs dynamically generated

3. **`backend/main.py`** ✅
   - CORS origins now dynamically built from `server_base_url`
   - Supports multiple frontend ports

4. **`frontend/src/pages/Login.tsx`** ✅
   - Cookie clearing now uses `window.location.hostname`
   - No hardcoded domain

## 📝 Non-Critical Hardcoded Values

These are acceptable as-is (examples, templates, or development defaults):

### Template/Example Files
- `backend/deployment/templates/env.production` - Example file
- `backend/deployment/scripts/deploy.sh` - Deployment script with examples
- `deployment/scripts/deploy.sh` - Deployment script with examples
- `glowworm-redesign/app/settings/page.tsx` - Template from redesign (not used)

### Default Values (Settings)
- `frontend/src/pages/Settings.tsx` - Default value in UI (line 70, 126, 385)
- `frontend/src/services/urlResolver.ts` - Fallback default (line 8, 47)
- `backend/services/config_service.py` - Default fallback (line 119)
- `backend/config/settings.json.example` - Example template
- `backend/config/settings.py` - Pydantic default value (line 30)
- `backend/services/database_config_service.py` - Default value (line 135)
- `backend/alembic/versions/*.py` - Database migration default

### Documentation
- `DOCKER_SETUP.md` - Documentation example
- `setup.sh` - Setup script output
- `start_glowworm.sh` - Startup script output
- `GOOGLE_OAUTH_SETUP.md` - OAuth setup documentation
- `backend/deployment/README.md` - Deployment documentation

### Docker Health Checks
- `docker-compose.yml` - Container health check (internal)
- `docker-compose.override.yml` - Dev health check (internal)
- `Dockerfile.backend` - Container health check (internal)

### OAuth Callback
- `backend/services/google_oauth_service.py` - OAuth redirect URI
  - **Note:** This should be configurable based on `server_base_url` in the future

## 🔄 Future Improvements

### OAuth Callback URL
The Google OAuth redirect URI is currently hardcoded:
```python
self.redirect_uri = f"http://localhost:8001/api/auth/google/callback"
```

**Recommended Fix:**
```python
from config.settings import settings
self.redirect_uri = f"{settings.server_base_url}/api/auth/google/callback"
```

This would require users to update their Google OAuth console with the correct callback URL for their deployment.

## 📋 Testing Checklist

When deploying to a new network:

1. ✅ Update `server_base_url` in `backend/config/settings.json`
2. ✅ Restart backend server
3. ✅ Verify image URLs load correctly
4. ✅ Verify cookies work across frontend/backend ports
5. ✅ Test display device registration and authorization
6. ⚠️ Update Google OAuth callback URL if using OAuth

## 🎯 Summary

**Status:** All critical hardcoded IP addresses have been replaced with dynamic values from the `server_base_url` setting.

**Portability:** The application can now run on any network by simply updating `server_base_url` during the setup wizard, without requiring code changes.

**Remaining Work:** OAuth callback URL should be made dynamic in a future update.

