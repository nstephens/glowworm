# After Running Reset Script

## 🔄 Complete Reset Checklist

After running `python scripts/glowworm_reset_to_defaults.py`, follow these steps:

### 1. Clear Browser Cache and Storage

**Option A: Hard Refresh**
- Chrome/Edge: `Ctrl + Shift + R` (Linux/Windows) or `Cmd + Shift + R` (Mac)
- Firefox: `Ctrl + Shift + R` or `Cmd + Shift + R`

**Option B: Clear Storage Manually**
1. Open DevTools (F12)
2. Go to Application tab (Chrome) or Storage tab (Firefox)
3. Clear:
   - ✗ Local Storage
   - ✗ Session Storage  
   - ✗ Cookies
4. Refresh the page

**Option C: Incognito/Private Window**
- Open an incognito/private browsing window
- Navigate to `http://localhost:3003`

### 2. Verify Setup Wizard Appears

You should see:
- **Stage 2 (Docker/Native with DB)**: Admin creation page at `/setup/admin`
- **OR Stage 1 (Full setup)**: Setup wizard at `/setup`

### 3. Create Admin Account

The setup wizard will ask you to:
- Set admin username (default: admin)
- Set admin password
- Configure initial settings

### 4. Start Using GlowWorm

After setup completes, you'll be redirected to the main dashboard with:
- ✨ New indigo/amber/pink color scheme
- ✨ Professional Inter font
- ✨ Consistent spacing
- ✨ Dark mode support

## 🐛 Troubleshooting

### "Still seeing main page instead of setup wizard"

**Check API Status:**
```bash
curl http://localhost:8001/api/setup/status | python3 -m json.tool
```

Should show:
```json
{
  "is_configured": false,
  "needs_admin": true,
  "needs_bootstrap": false
}
```

**If API shows correct status but wizard doesn't appear:**
1. Clear browser cache/storage (see above)
2. Try incognito window
3. Check browser console for errors (F12)

**If API shows `is_configured: true`:**
- Admin user exists in database
- Run reset script again

### "Database connection errors"

Check that:
- MySQL is running: `sudo systemctl status mysql`
- Database exists: `mysql -u root -p -e "SHOW DATABASES LIKE 'glowworm';"`
- Settings are correct: `cat backend/config/settings.json`

### "Setup wizard shows errors"

- Check backend logs for detailed error messages
- Verify database credentials are correct
- Ensure database user has proper permissions

## 🎨 Enjoy the New Design!

Once setup is complete, you'll experience:
- Modern, professional color palette
- Smooth theme transitions
- Consistent typography and spacing
- Beautiful dark mode

Ready to continue with more UX improvements! 🚀

