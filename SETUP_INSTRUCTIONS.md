# GlowWorm Setup Instructions

## Prerequisites
- Python 3.8+
- Node.js 16+
- MySQL 8.0+
- Git

## Quick Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd glowworm
   ```

2. **Configure bootstrap settings**
   - Copy `backend/config/settings.example.json` to `backend/config/settings.json`
   - Edit the settings file with your database credentials
   - Copy `.env.example` to `.env` and configure environment variables

3. **Run the setup script**
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

4. **Complete setup via web interface**
   - Access the application at http://localhost:8001
   - Complete the setup wizard with your preferences
   - **Important**: Use your actual network IP address (not localhost) for the server URL so display devices can connect
   - Application settings are stored in the database (not in files)

5. **Start the development server**
   ```bash
   chmod +x start_dev.sh
   ./start_dev.sh
   ```

6. **Access the application**
   - Frontend: http://localhost:3003
   - Backend API: http://localhost:8001
   - API Documentation: http://localhost:8001/docs

## Configuration Architecture

### Bootstrap Settings (File-based)
- Database credentials (`mysql_host`, `mysql_user`, etc.)
- Admin password and secret key
- These are stored in `backend/config/settings.json`

### Application Settings (Database-based)
- Server URLs and ports
- Display configuration
- Logging settings
- OAuth credentials
- These are stored in the `system_settings` database table

### Managing Settings
- **Bootstrap settings**: Edit `backend/config/settings.json` directly
- **Application settings**: Use the admin interface at `/admin/settings`
- **Setup wizard**: Configures both bootstrap and application settings

## Database Setup
1. Create a MySQL database named `glowworm`
2. Update the database credentials in `backend/config/settings.json`
3. Run the setup wizard to initialize the database with application settings

## Google OAuth (Optional)
1. Follow the instructions in `GOOGLE_OAUTH_SETUP.md`
2. Configure OAuth credentials via the admin interface

## Display Configuration
- Configure display sizes via the admin interface
- Set up display devices through the admin interface
- Create playlists and assign them to displays

## Production Deployment

See `deployment/README.md` for production deployment instructions.

## Migration from File-based Configuration

If you're upgrading from an older version with file-based settings:

1. **Run the migration script:**
   ```bash
   cd backend
   python3 scripts/migrate_settings_to_database.py
   ```

2. **Verify settings migration:**
   - Check that settings appear in the admin interface
   - Test that all functionality still works
   - Optionally clean up migrated settings from files

## Troubleshooting

### Database Connection Issues
- Verify MySQL is running
- Check database credentials in `backend/config/settings.json`
- Ensure the `glowworm` database exists

### Settings Not Persisting
- Check that the `system_settings` table exists in your database
- Verify the database migration has been run
- Check application logs for configuration errors

### Admin Interface Not Loading
- Ensure the setup wizard has been completed
- Check that an admin user has been created
- Verify the database contains the required tables

## Support

For issues and questions, please check the documentation or create an issue in the repository.
