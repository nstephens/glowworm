#!/bin/bash

# GlowWorm Reset to Defaults Script
# This script resets the database and system to factory defaults for fresh development

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"
UPLOADS_DIR="$PROJECT_ROOT/uploads"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
SKIP_CONFIRM=false
if [ "$1" == "--yes" ] || [ "$1" == "-y" ]; then
    SKIP_CONFIRM=true
fi

echo -e "${BLUE}🔄 GlowWorm Reset to Defaults${NC}"
echo "============================================================"
echo ""
echo -e "${YELLOW}⚠️  WARNING: This will:${NC}"
echo "  ✗ Drop and recreate all database tables (ALL DATA LOST)"
echo "  ✗ Reset application settings to defaults"
echo "  ✗ Clear all uploaded images and thumbnails"
echo "  ✗ Trigger the setup wizard on next start"
echo ""
echo "  ✓ Preserve: Database credentials, server URLs, secret keys"
echo ""

if [ "$SKIP_CONFIRM" = false ]; then
    read -p "Type 'yes' to confirm reset: " -r
    echo ""
    if [[ ! $REPLY == "yes" ]]; then
        echo -e "${RED}❌ Reset cancelled${NC}"
        exit 0
    fi
fi

echo ""
echo -e "${BLUE}🚀 Starting reset process...${NC}"
echo ""

# Step 1: Clear uploads
echo -e "${BLUE}📁 Step 1: Clearing uploads directory...${NC}"
if [ -d "$UPLOADS_DIR" ]; then
    FILE_COUNT=$(find "$UPLOADS_DIR" -type f | wc -l)
    if [ "$FILE_COUNT" -gt 0 ]; then
        echo "  Removing $FILE_COUNT files..."
        rm -rf "$UPLOADS_DIR"/* 2>/dev/null || true
    else
        echo "  Directory already empty"
    fi
else
    echo "  Creating uploads directory..."
    mkdir -p "$UPLOADS_DIR"
fi
echo -e "  ${GREEN}✅ Uploads cleared${NC}"

# Step 2: Reset database
echo ""
echo -e "${BLUE}🗄️  Step 2: Resetting database...${NC}"

# Read database credentials from settings
SETTINGS_FILE="$BACKEND_DIR/config/settings.json"

if [ ! -f "$SETTINGS_FILE" ]; then
    echo -e "  ${RED}❌ Settings file not found: $SETTINGS_FILE${NC}"
    exit 1
fi

DB_NAME=$(python3 -c "import json; print(json.load(open('$SETTINGS_FILE'))['mysql_database'])" 2>/dev/null || echo "glowworm")
DB_HOST=$(python3 -c "import json; print(json.load(open('$SETTINGS_FILE'))['mysql_host'])" 2>/dev/null || echo "localhost")
DB_PORT=$(python3 -c "import json; print(json.load(open('$SETTINGS_FILE'))['mysql_port'])" 2>/dev/null || echo "3306")
DB_ROOT_USER=$(python3 -c "import json; print(json.load(open('$SETTINGS_FILE'))['mysql_root_user'])" 2>/dev/null || echo "root")
DB_ROOT_PASS=$(python3 -c "import json; print(json.load(open('$SETTINGS_FILE'))['mysql_root_password'])" 2>/dev/null || echo "")

echo "  Connecting to MySQL at $DB_HOST:$DB_PORT as $DB_ROOT_USER..."

# Drop and recreate database
if [ -z "$DB_ROOT_PASS" ]; then
    echo "  Dropping database '$DB_NAME' if exists..."
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_ROOT_USER" -e "DROP DATABASE IF EXISTS \`$DB_NAME\`;" 2>/dev/null || echo "  Database doesn't exist, skipping drop"
    
    echo "  Creating fresh database '$DB_NAME'..."
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_ROOT_USER" -e "CREATE DATABASE \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
else
    echo "  Dropping database '$DB_NAME' if exists..."
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_ROOT_USER" -p"$DB_ROOT_PASS" -e "DROP DATABASE IF EXISTS \`$DB_NAME\`;" 2>/dev/null || echo "  Database doesn't exist, skipping drop"
    
    echo "  Creating fresh database '$DB_NAME'..."
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_ROOT_USER" -p"$DB_ROOT_PASS" -e "CREATE DATABASE \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
fi

echo -e "  ${GREEN}✅ Database reset complete${NC}"

# Step 3: Run migrations
echo ""
echo -e "${BLUE}🔄 Step 3: Running database migrations...${NC}"

cd "$BACKEND_DIR"

if [ ! -d "venv" ]; then
    echo -e "  ${RED}❌ Virtual environment not found. Run ./setup.sh first.${NC}"
    exit 1
fi

echo "  Activating virtual environment..."
source venv/bin/activate

echo "  Running alembic upgrade head..."
alembic upgrade head

if [ $? -eq 0 ]; then
    echo -e "  ${GREEN}✅ Database tables created${NC}"
else
    echo -e "  ${RED}❌ Migration failed${NC}"
    exit 1
fi

cd "$PROJECT_ROOT"

# Step 4: Reset settings
echo ""
echo -e "${BLUE}⚙️  Step 4: Resetting application settings...${NC}"

# Use Python for JSON manipulation
python3 << EOF
import json
from pathlib import Path

config_dir = Path('$BACKEND_DIR/config')
settings_file = config_dir / 'settings.json'
example_file = config_dir / 'settings.json.example'

# Load current settings
with open(settings_file, 'r') as f:
    current = json.load(f)

# Load example settings
with open(example_file, 'r') as f:
    new_settings = json.load(f)

# Preserve critical credentials
preserve_keys = [
    'mysql_host', 'mysql_port', 'mysql_root_user', 'mysql_root_password',
    'app_db_user', 'app_db_password', 'mysql_database', 'secret_key',
    'server_base_url', 'backend_port', 'frontend_port'
]

print("  Preserving database credentials and server settings...")
for key in preserve_keys:
    if key in current and current[key]:
        new_settings[key] = current[key]

# Reset admin and setup flags
new_settings['admin_password'] = ''
new_settings['setup_completed'] = False

# Save updated settings
with open(settings_file, 'w') as f:
    json.dump(new_settings, f, indent=2)

print("  Settings reset complete")
EOF

echo -e "  ${GREEN}✅ Settings reset (credentials preserved)${NC}"

# Print summary
echo ""
echo "============================================================"
echo -e "${GREEN}✅ GlowWorm Reset to Defaults Complete!${NC}"
echo "============================================================"
echo ""
echo -e "${BLUE}🚀 Next Steps:${NC}"
echo ""
echo "  1. Start the backend server:"
echo "     cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8001"
echo ""
echo "  2. Start the frontend (in a new terminal):"
echo "     cd frontend && npm run dev"
echo ""
echo "  3. Open your browser:"
echo "     http://localhost:3003"
echo ""
echo "  4. Complete the setup wizard:"
echo "     - Create admin user account"
echo "     - Configure initial settings"
echo ""
echo -e "${YELLOW}💡 Quick start: ./start_glowworm.sh${NC}"
echo ""

