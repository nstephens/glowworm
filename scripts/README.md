# GlowWorm Scripts

This directory contains utility scripts for managing your GlowWorm installation.

## 🔄 Reset to Defaults

Reset the entire GlowWorm application to factory defaults. Useful for development and testing.

### Python Version (Recommended)

```bash
python scripts/glowworm_reset_to_defaults.py
```

**Features:**
- **Automatically uses venv** (no manual activation needed!)
- Interactive confirmation prompt
- Preserves database credentials and server settings
- Color-coded output
- Detailed error messages
- Step-by-step progress

**Skip confirmation:**
```bash
python scripts/glowworm_reset_to_defaults.py --yes
```

### Bash Version (Alternative)

```bash
./scripts/glowworm_reset_to_defaults.sh
```

**Features:**
- Works on any Unix-like system
- Preserves database credentials
- Color-coded output
- Interactive prompts

**Skip confirmation:**
```bash
./scripts/glowworm_reset_to_defaults.sh --yes
```

## What Gets Reset

### ✗ Data Removed:
- All database tables and data
- All uploaded images and thumbnails
- Admin user account
- Application settings (except credentials)

### ✓ Data Preserved:
- Database connection credentials
- MySQL root password
- Application database password
- Secret keys
- Server URLs
- Port configurations

## After Reset

1. **Start the application:**
   ```bash
   ./start_glowworm.sh
   ```

2. **Open browser to:**
   ```
   http://localhost:3003
   ```

3. **Complete the setup wizard:**
   - Create new admin user
   - Configure initial settings

## Troubleshooting

### "Unknown database 'glowworm'"
- MySQL database was not created
- Check MySQL is running: `sudo systemctl status mysql`
- Verify root credentials in `backend/config/settings.json`

### "Access denied for user 'root'"
- MySQL root password is incorrect
- Update `mysql_root_password` in `backend/config/settings.json`

### "Migration failed"
- Database exists but tables couldn't be created
- Try manually: `cd backend && source venv/bin/activate && alembic upgrade head`

### "Permission denied"
- Make scripts executable:
  ```bash
  chmod +x scripts/glowworm_reset_to_defaults.py
  chmod +x scripts/glowworm_reset_to_defaults.sh
  ```

## Development Workflow

Use this script when you need to:
- Start fresh with a clean database
- Test the setup wizard
- Clear out test data
- Reset after major changes
- Prepare for a demo

## Safety Features

- Interactive confirmation (unless `--yes` flag is used)
- Preserves database credentials automatically
- Clear warnings about data loss
- Detailed error messages
- Step-by-step execution with rollback on errors

