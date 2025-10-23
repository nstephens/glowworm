#!/usr/bin/env python3
"""
GlowWorm Development Reset Script

Nukes everything back to factory defaults:
- Drops glowworm database
- Resets settings.json to example defaults  
- Clears uploads directory
- App will run setup wizard on next start

Usage:
    python scripts/reset_dev.py --mysql-root-password YOUR_PASSWORD
    python scripts/reset_dev.py -p YOUR_PASSWORD --yes
"""

import os
import sys
import json
import shutil
import argparse
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
BACKEND_DIR = PROJECT_ROOT / 'backend'
VENV_PYTHON = BACKEND_DIR / 'venv' / 'bin' / 'python'

# Re-execute with venv if needed
if not hasattr(sys, 'real_prefix') and not (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
    if VENV_PYTHON.exists():
        print(f"🔄 Re-executing with venv: {VENV_PYTHON}\n")
        os.execv(str(VENV_PYTHON), [str(VENV_PYTHON)] + sys.argv)
    else:
        print(f"❌ Virtual environment not found: {VENV_PYTHON}")
        sys.exit(1)

import pymysql


def main():
    parser = argparse.ArgumentParser(description='Reset GlowWorm to factory defaults')
    parser.add_argument('--mysql-root-password', '-p', required=True, help='MySQL root password')
    parser.add_argument('--yes', '-y', action='store_true', help='Skip confirmation')
    args = parser.parse_args()
    
    print("\n🔄 GlowWorm Development Reset")
    print("=" * 60)
    print("\n⚠️  This will DELETE:")
    print("  • glowworm database (all data)")
    print("  • settings.json (reset to defaults)")
    print("  • uploads directory (all images)")
    print("\n✅ Setup wizard will run on next start")
    print()
    
    if not args.yes:
        confirm = input("Type 'yes' to continue: ")
        if confirm.lower() != 'yes':
            print("\n❌ Cancelled")
            sys.exit(0)
    
    print("\n🚀 Resetting...\n")
    
    # 1. Drop database
    print("🗄️  Dropping database...")
    try:
        conn = pymysql.connect(host='localhost', port=3306, user='root', password=args.mysql_root_password)
        with conn.cursor() as cursor:
            cursor.execute("DROP DATABASE IF EXISTS `glowworm`")
            conn.commit()
        conn.close()
        print("  ✅ Database dropped")
    except Exception as e:
        print(f"  ❌ Failed: {e}")
        sys.exit(1)
    
    # 2. Reset settings.json
    print("\n⚙️  Resetting settings...")
    try:
        settings_file = BACKEND_DIR / 'config' / 'settings.json'
        example_file = BACKEND_DIR / 'config' / 'settings.json.example'
        
        with open(example_file, 'r') as f:
            settings = json.load(f)
        
        with open(settings_file, 'w') as f:
            json.dump(settings, f, indent=2)
        
        print("  ✅ Settings reset to defaults")
    except Exception as e:
        print(f"  ❌ Failed: {e}")
        sys.exit(1)
    
    # 3. Clear uploads
    print("\n📁 Clearing uploads...")
    try:
        uploads_dir = PROJECT_ROOT / 'uploads'
        if uploads_dir.exists():
            for item in uploads_dir.iterdir():
                if item.is_file():
                    item.unlink()
                elif item.is_dir():
                    shutil.rmtree(item)
            print("  ✅ Uploads cleared")
        else:
            print("  ℹ️  No uploads directory")
    except Exception as e:
        print(f"  ⚠️  Warning: {e}")
    
    # Done!
    print("\n" + "=" * 60)
    print("✅ Reset complete!")
    print("=" * 60)
    print("\n🚀 Next steps:")
    print("  1. Restart backend: cd backend && uvicorn main:app --reload --port 8001")
    print("  2. Open browser: http://10.10.10.2:3003")
    print("  3. Complete setup wizard")
    print()


if __name__ == "__main__":
    main()

