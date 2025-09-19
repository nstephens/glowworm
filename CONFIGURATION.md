# Glowworm Configuration Guide

## Initial Setup

After running `./setup.sh`, you'll need to configure your database settings:

1. **Edit `backend/config/settings.json`** (created from template)
2. **Set your database credentials:**
   ```json
   {
     "mysql_host": "localhost",
     "mysql_port": 3306,
     "mysql_root_user": "root",
     "mysql_root_password": "your_mysql_root_password",
     "app_db_user": "glowworm",
     "app_db_password": "secure_password_here",
     "admin_password": "your_admin_password",
     "secret_key": "generate_a_secure_random_key"
   }
   ```

## Security Notes

- **`settings.json` is gitignored** - Your sensitive data stays local
- **Generate a secure secret key** - Use a random 32+ character string
- **Use strong passwords** - Especially for database and admin access
- **Update default ports** if needed for your environment

## Database Setup

The setup process will:
1. Create the `glowworm` database
2. Create the application user with specified credentials
3. Set up all required tables
4. Initialize the admin account

## Fresh Install Process

1. `./cleanup_for_publish.sh` - Clean previous installation
2. `./setup.sh` - Install dependencies and create config template
3. **Configure `backend/config/settings.json`** - Add your credentials
4. `./start_glowworm.sh` - Start the application

## Troubleshooting

If you get "Database not initialized" errors:
- Check your MySQL credentials in `settings.json`
- Ensure MySQL is running
- Call the refresh endpoint: `curl -X POST http://localhost:8001/api/setup/refresh-database`
