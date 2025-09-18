# GlowWorm Publishing Checklist

## 🔍 Local Configuration Files Found

### ❌ Files with Hardcoded Local Values

1. **`backend/config/settings.json`**
   - `server_base_url`: "http://10.10.10.2:8001" (hardcoded IP)
   - Contains local database passwords and settings

2. **`config/settings.json`**
   - Contains local database credentials
   - Has local display size configurations

3. **`cookies.txt`**
   - Contains localhost session cookies
   - Should be removed entirely

4. **`session=test`**
   - Test session file
   - Should be removed entirely

5. **`test_display_time_column.py`**
   - Local test script
   - Should be removed entirely

### ⚠️ Files with Localhost Defaults (OK for publishing)

1. **`frontend/src/services/urlResolver.ts`**
   - Has localhost defaults but handles dynamic configuration
   - ✅ **KEEP** - Uses settings system for production

2. **`backend/config/settings.py`**
   - Has localhost defaults but uses environment variables
   - ✅ **KEEP** - Proper configuration system

3. **`backend/api/settings.py`**
   - Has localhost defaults in `get_default_settings()`
   - ✅ **KEEP** - These are proper defaults

4. **`start_dev.sh`**
   - Contains localhost URLs for development
   - ✅ **KEEP** - Development script

### 🗂️ Development Artifacts to Remove

1. **Directories:**
   - `backend/venv/` - Python virtual environment
   - `frontend/node_modules/` - Node.js dependencies
   - `uploads/` - Local uploaded files
   - `backend/logs/` - Local log files
   - `.taskmaster/` - Local task management files

2. **Backup Files:**
   - `start_dev.sh.backup`
   - `backend/main.py.backup`

3. **Cache Files:**
   - `__pycache__/` directories
   - `*.pyc` files
   - `.pytest_cache/` directories

## 🛠️ Cleanup Script

The `cleanup_for_publish.sh` script will:

1. **Remove sensitive files:**
   - `cookies.txt`
   - `session=test`
   - `test_display_time_column.py`
   - Backup files

2. **Reset configuration files:**
   - `backend/config/settings.json` → Default values
   - `config/settings.json` → Default values

3. **Remove development artifacts:**
   - Virtual environments
   - Node modules
   - Upload directories
   - Log files
   - Cache files

4. **Create publishing files:**
   - `.gitignore` - Excludes sensitive files
   - `.env.example` - Environment template
   - `backend/config/settings.example.json` - Settings template
   - `SETUP_INSTRUCTIONS.md` - Setup guide

## ✅ Files That Are Publication-Ready

These files have proper configuration systems and don't need changes:

- `frontend/src/services/urlResolver.ts` - Dynamic URL resolution
- `backend/config/settings.py` - Environment-based configuration
- `backend/api/settings.py` - Proper defaults
- `frontend/src/pages/Settings.tsx` - Admin settings interface
- `frontend/src/pages/SetupWizard.tsx` - Initial setup
- All deployment scripts in `backend/deployment/`

## 🚀 Testing Before Publishing

1. **Run cleanup script:**
   ```bash
   ./cleanup_for_publish.sh
   ```

2. **Test fresh installation:**
   ```bash
   # Create a test directory
   mkdir test-install
   cd test-install
   
   # Copy the cleaned codebase
   cp -r ../glowworm/* .
   
   # Test setup process
   chmod +x setup.sh
   ./setup.sh
   
   # Verify configuration works
   # Edit settings files with test values
   # Start development server
   ```

3. **Verify configuration system:**
   - Settings can be changed via admin interface
   - URLs resolve correctly for different environments
   - Database connections work with different credentials
   - Display devices can be configured

## 📋 Pre-Publishing Checklist

- [ ] Run `cleanup_for_publish.sh`
- [ ] Test fresh installation in clean directory
- [ ] Verify all configuration systems work
- [ ] Update README.md with installation instructions
- [ ] Review and update deployment documentation
- [ ] Consider creating Docker setup
- [ ] Test with different database configurations
- [ ] Verify Google OAuth setup process
- [ ] Test display device registration
- [ ] Verify playlist creation and management

## 🔒 Security Considerations

- No passwords or secrets in the codebase
- All sensitive data in configuration files
- Configuration files excluded from git via .gitignore
- Example files provided for setup
- Proper environment variable support
- Database credentials configurable
- Admin passwords set during setup

## 📦 What Gets Published

- ✅ Clean codebase with no local configurations
- ✅ Proper configuration system
- ✅ Setup scripts and instructions
- ✅ Example configuration files
- ✅ Documentation
- ✅ Deployment scripts
- ❌ No passwords or secrets
- ❌ No local development artifacts
- ❌ No personal data or configurations
