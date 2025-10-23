# GlowWorm Scripts

## Development Reset

**`reset_dev.py`** - Nuke everything back to factory defaults

```bash
# Reset everything (will prompt for confirmation)
python scripts/reset_dev.py --mysql-root-password YOUR_PASSWORD

# Skip confirmation
python scripts/reset_dev.py -p YOUR_PASSWORD --yes
```

**What it does:**
- Drops the `glowworm` database
- Resets `backend/config/settings.json` to defaults
- Clears the `uploads/` directory

**After reset:**
1. Restart backend: `cd backend && uvicorn main:app --reload --port 8001`
2. Open browser: `http://10.10.10.2:3003`
3. Complete the setup wizard

The setup wizard will:
- Create the database
- Create the `glowworm` MySQL user
- Set up admin account
- Configure application settings

---

## Why One Script?

Previously we had multiple reset scripts (`glowworm_reset_to_defaults.py`, `simple_reset.py`, `clear_users_table.py`) which was confusing and over-complicated.

Now there's just **ONE** script that does **ONE** thing: nuke everything back to factory defaults. Simple.

The setup wizard handles all the actual configuration (database user creation, password generation, etc.).
