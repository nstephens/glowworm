#!/bin/bash

# GlowWorm Cleanup Script for Publishing
# This script removes local configurations and sensitive data before publishing

echo "🧹 Cleaning up GlowWorm for publishing..."

# Function to backup and reset a file
backup_and_reset() {
    local file=$1
    local backup_file="${file}.local"
    
    if [ -f "$file" ]; then
        echo "📋 Backing up $file to $backup_file"
        cp "$file" "$backup_file"
    fi
}

# Function to remove sensitive/local files
remove_file() {
    local file=$1
    if [ -f "$file" ]; then
        echo "🗑️  Removing $file"
        rm "$file"
    fi
}

# Function to remove sensitive/local directories
remove_dir() {
    local dir=$1
    if [ -d "$dir" ]; then
        echo "🗑️  Removing directory $dir"
        rm -rf "$dir"
    fi
}

echo "📁 Step 1: Removing local configuration files..."
remove_file "cookies.txt"
remove_file "session=test"
remove_file "test_display_time_column.py"
remove_file "start_dev.sh.backup"
remove_file "backend/main.py.backup"

echo "📁 Step 2: Resetting configuration files to bootstrap defaults..."

# Reset backend config settings.json to bootstrap defaults (database credentials only)
if [ -f "backend/config/settings.json" ]; then
    backup_and_reset "backend/config/settings.json"
    cat > backend/config/settings.json << 'EOF'
{
  "mysql_host": "localhost",
  "mysql_port": 3306,
  "mysql_root_user": "root",
  "mysql_root_password": "",
  "app_db_user": "glowworm",
  "app_db_password": "",
  "admin_password": "",
  "secret_key": ""
}
EOF
    echo "✅ Reset backend/config/settings.json to bootstrap defaults"
fi

# Reset root config settings.json to bootstrap defaults (database credentials only)
if [ -f "config/settings.json" ]; then
    backup_and_reset "config/settings.json"
    cat > config/settings.json << 'EOF'
{
  "mysql_host": "localhost",
  "mysql_port": 3306,
  "mysql_root_user": "root",
  "mysql_root_password": "",
  "app_db_user": "glowworm",
  "app_db_password": "",
  "admin_password": "",
  "secret_key": ""
}
EOF
    echo "✅ Reset config/settings.json to bootstrap defaults"
fi

echo "📁 Step 3: Removing local development artifacts..."
remove_dir "uploads"
remove_dir "backend/logs"
remove_dir "backend/venv"
remove_dir "frontend/node_modules"
remove_dir "frontend/dist"
remove_dir ".taskmaster"

echo "📁 Step 4: Removing backup files and temporary files..."
find . -name "*.pyc" -delete 2>/dev/null || true
find . -name "*.pyo" -delete 2>/dev/null || true
find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name ".pytest_cache" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name "*.log" -delete 2>/dev/null || true
find . -name ".DS_Store" -delete 2>/dev/null || true

echo "📁 Step 5: Creating .gitignore for sensitive files..."
cat > .gitignore << 'EOF'
# Environment and configuration files
.env
.env.local
.env.production
.env.staging
backend/.env
frontend/.env

# Local configuration backups
*.local
config/settings.json.local
backend/config/settings.json.local

# Development artifacts
backend/venv/
frontend/node_modules/
frontend/dist/
uploads/
backend/logs/

# Database files
*.db
*.sqlite
*.sqlite3

# Cookies and session files
cookies.txt
session=*

# Python cache
__pycache__/
*.pyc
*.pyo
*.pyd
.Python
.pytest_cache/

# Node.js
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# OS files
.DS_Store
Thumbs.db

# Temporary files
*.tmp
*.temp
*.log
*.backup

# Task Master files
.taskmaster/

# Test files
test_*.py
*_test.py
EOF
echo "✅ Created .gitignore file"

echo "📁 Step 6: Creating example configuration files..."

# Create example bootstrap settings file
cat > backend/config/settings.example.json << 'EOF'
{
  "mysql_host": "localhost",
  "mysql_port": 3306,
  "mysql_root_user": "root",
  "mysql_root_password": "your_mysql_password",
  "app_db_user": "glowworm",
  "app_db_password": "your_app_password",
  "admin_password": "your_admin_password",
  "secret_key": "your_secret_key_here"
}
EOF
echo "✅ Created backend/config/settings.example.json (bootstrap settings only)"

# Create environment example file
cat > .env.example << 'EOF'
# Database Configuration
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=glowworm
MYSQL_PASSWORD=your_password_here
MYSQL_DATABASE=glowworm

# Application Configuration
SECRET_KEY=your_secret_key_here
SERVER_BASE_URL=http://localhost:8001

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Logging
LOG_LEVEL=INFO
ENABLE_DEBUG_LOGGING=false
EOF
echo "✅ Created .env.example"

echo "📁 Step 7: Documentation ready..."
echo "✅ SETUP_INSTRUCTIONS.md already exists in repository"

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📋 Summary of changes:"
echo "  • Removed local configuration files"
echo "  • Reset bootstrap settings to default values"
echo "  • Removed development artifacts"
echo "  • Created .gitignore file"
echo "  • Created example bootstrap configuration files"
echo "  • Created setup instructions for new architecture"
echo ""
echo "📁 Files to review before publishing:"
echo "  • backend/config/settings.json (bootstrap settings only)"
echo "  • config/settings.json (bootstrap settings only)"
echo "  • .gitignore (excludes sensitive files)"
echo "  • SETUP_INSTRUCTIONS.md (updated setup guide)"
echo "  • backend/scripts/migrate_settings_to_database.py (migration script)"
echo ""
echo "🔧 Next steps:"
echo "  1. Test the setup process with a fresh clone"
echo "  2. Run database migration to create system_settings table"
echo "  3. Test the new database-based configuration system"
echo "  4. Update README.md with installation instructions"
echo "  5. Consider creating a Docker setup for easier deployment"
echo ""
echo "🏗️  New Architecture:"
echo "  • Bootstrap settings (database credentials) → Files"
echo "  • Application settings (server config, display settings) → Database"
echo "  • Settings managed via admin interface and setup wizard"
echo "  • Migration script available for existing installations"
echo ""
echo "🚀 Your codebase is now ready for publishing with database-based configuration!"
