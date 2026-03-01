# GlowWorm Pi3D Display - Troubleshooting Guide

Common issues and solutions for the Pi3D display system.

## Quick Diagnostics

Run these commands to gather diagnostic information:

```bash
# Check service status
sudo systemctl status glowworm-daemon

# View recent logs
sudo journalctl -u glowworm-daemon --no-pager -n 100

# Check GPU memory
vcgencmd get_mem gpu

# Check system resources
free -h
df -h

# Verify packages are installed
/opt/glowworm/venv/bin/python -c "import glowworm_display, glowworm_daemon; print('OK')"
```

## Common Issues

### Display Not Showing Anything

**Symptoms:** Black screen, no images displayed

**Solutions:**

1. **Check if daemon is running:**
   ```bash
   sudo systemctl status glowworm-daemon
   ```

2. **Check logs for errors:**
   ```bash
   sudo journalctl -u glowworm-daemon -f
   ```

3. **Verify HDMI connection:**
   - Ensure HDMI cable is connected before boot
   - Try a different HDMI port on your TV
   - Check `/boot/firmware/config.txt` for HDMI settings

4. **Check GPU memory:**
   ```bash
   vcgencmd get_mem gpu
   ```
   Should be 128MB or higher. If not:
   ```bash
   sudo nano /boot/firmware/config.txt
   # Add: gpu_mem=128
   sudo reboot
   ```

5. **Run display in mock mode to test:**
   ```bash
   /opt/glowworm/venv/bin/glowworm-display --mock --test-frames 100
   ```

### Registration Code Not Appearing

**Symptoms:** Device shows black screen instead of registration code

**Solutions:**

1. **Check backend connectivity:**
   ```bash
   curl -s http://YOUR_SERVER_IP:3003/health
   ```
   Should return a JSON response.

2. **Verify backend URL in config:**
   ```bash
   grep -A2 "backend:" /etc/glowworm/config.yaml
   ```

3. **Check daemon logs for connection errors:**
   ```bash
   sudo journalctl -u glowworm-daemon | grep -i "error\|fail\|connect"
   ```

4. **Ensure the Pi can reach the server:**
   ```bash
   ping YOUR_SERVER_IP
   ```

### Images Not Loading

**Symptoms:** Slideshow shows errors or skips images

**Solutions:**

1. **Check cache directory:**
   ```bash
   ls -la /var/cache/glowworm/images/
   du -sh /var/cache/glowworm/images/
   ```

2. **Check disk space:**
   ```bash
   df -h /var/cache/glowworm/
   ```
   Ensure enough free space (at least `min_free_space_mb` in config).

3. **Clear cache and restart:**
   ```bash
   sudo rm -rf /var/cache/glowworm/images/*
   sudo systemctl restart glowworm-daemon
   ```

4. **Check image URLs are accessible from the Pi:**
   ```bash
   # Check logs for image URLs
   sudo journalctl -u glowworm-daemon | grep "image\|download"
   ```

### Transitions Are Choppy

**Symptoms:** Low FPS, stuttering during cross-fade transitions

**Solutions:**

1. **Increase GPU memory:**
   ```bash
   # Check current
   vcgencmd get_mem gpu

   # Set to 128MB if lower
   sudo nano /boot/firmware/config.txt
   # Add: gpu_mem=128
   sudo reboot
   ```

2. **Check system load:**
   ```bash
   htop  # or top
   ```
   Look for high CPU usage from other processes.

3. **Lower the FPS target:**
   ```yaml
   # In /etc/glowworm/config.yaml
   display:
     fps_target: 24  # Lower from 30
   ```

4. **Check for thermal throttling:**
   ```bash
   vcgencmd measure_temp
   vcgencmd get_throttled
   ```
   `0x0` means no throttling. Any other value indicates thermal issues.

5. **Use a Pi 4 or Pi 5** - Pi 3B+ may struggle with 30 FPS transitions

### Service Won't Start

**Symptoms:** `systemctl start glowworm-daemon` fails

**Solutions:**

1. **Check service logs:**
   ```bash
   sudo journalctl -u glowworm-daemon --no-pager
   ```

2. **Verify configuration syntax:**
   ```bash
   /opt/glowworm/venv/bin/python -c "
   import yaml
   with open('/etc/glowworm/config.yaml') as f:
       yaml.safe_load(f)
   print('Config OK')
   "
   ```

3. **Check file permissions:**
   ```bash
   ls -la /etc/glowworm/config.yaml
   ls -la /run/glowworm/
   ```

4. **Verify socket directory exists:**
   ```bash
   sudo mkdir -p /run/glowworm
   sudo chmod 755 /run/glowworm
   ```

5. **Check for conflicting processes:**
   ```bash
   ps aux | grep glowworm
   # Kill any orphaned processes
   sudo pkill -f glowworm
   ```

### WebSocket Connection Issues

**Symptoms:** Device shows as offline in admin, commands not working

**Solutions:**

1. **Check WebSocket connectivity:**
   ```bash
   # Look for WebSocket errors
   sudo journalctl -u glowworm-daemon | grep -i "websocket\|ws://"
   ```

2. **Verify network connectivity:**
   ```bash
   ping YOUR_SERVER_IP
   nc -zv YOUR_SERVER_IP 3003
   ```

3. **Check firewall settings** on both Pi and server

4. **If using HTTPS, check certificate:**
   ```bash
   curl -v https://YOUR_SERVER/health
   ```

5. **Check device token is valid:**
   ```bash
   grep device_token /etc/glowworm/config.yaml
   ```

### CEC Not Working

**Symptoms:** TV doesn't turn on/off via schedule

**Solutions:**

1. **Check CEC is enabled:**
   ```bash
   grep -A3 "cec:" /etc/glowworm/config.yaml
   ```

2. **Test CEC manually:**
   ```bash
   echo 'on 0' | cec-client -s -d 1
   echo 'standby 0' | cec-client -s -d 1
   ```

3. **Verify CEC adapter exists:**
   ```bash
   ls -la /dev/cec*
   ```

4. **Check TV supports CEC:**
   - Samsung: Anynet+
   - LG: SimpLink
   - Sony: Bravia Sync
   - Etc.

   Enable in TV settings.

5. **Install cec-utils if missing:**
   ```bash
   sudo apt install cec-utils libcec-dev
   ```

### Memory Issues

**Symptoms:** Daemon crashes, high memory usage, OOM errors

**Solutions:**

1. **Check memory usage:**
   ```bash
   free -h
   ps aux | grep glowworm | head -5
   ```

2. **Reduce cache size:**
   ```yaml
   cache:
     max_size_mb: 300  # Lower from 500
   ```

3. **Reduce preload count:**
   ```yaml
   slideshow:
     preload_count: 1  # Lower from 3
   ```

4. **Restart daemon (clears memory):**
   ```bash
   sudo systemctl restart glowworm-daemon
   ```

5. **Add swap space if needed:**
   ```bash
   sudo dphys-swapfile swapoff
   sudo nano /etc/dphys-swapfile
   # Set CONF_SWAPSIZE=1024
   sudo dphys-swapfile setup
   sudo dphys-swapfile swapon
   ```

## Log Analysis

### Understanding Log Levels

- `DEBUG` - Detailed information for debugging
- `INFO` - Normal operational messages
- `WARNING` - Non-critical issues
- `ERROR` - Problems that affect functionality
- `CRITICAL` - Severe errors

### Enable Debug Logging

```yaml
# In /etc/glowworm/config.yaml
logging:
  level: DEBUG
```

Then restart:
```bash
sudo systemctl restart glowworm-daemon
```

### Filter Logs

```bash
# Errors only
sudo journalctl -u glowworm-daemon -p err

# Since last hour
sudo journalctl -u glowworm-daemon --since "1 hour ago"

# Follow live
sudo journalctl -u glowworm-daemon -f

# Search for specific term
sudo journalctl -u glowworm-daemon | grep -i "connection"
```

## Recovering from Crashes

The daemon automatically restarts on crash (configured in systemd). If it keeps crashing:

1. **Check crash count:**
   ```bash
   sudo systemctl show glowworm-daemon -p NRestarts
   ```

2. **View crash logs:**
   ```bash
   sudo journalctl -u glowworm-daemon -p err --no-pager
   ```

3. **Reset service:**
   ```bash
   sudo systemctl reset-failed glowworm-daemon
   sudo systemctl start glowworm-daemon
   ```

## Factory Reset

To completely reset the device configuration:

```bash
# Stop service
sudo systemctl stop glowworm-daemon

# Clear all state and cache
sudo rm -rf /var/lib/glowworm/*
sudo rm -rf /var/cache/glowworm/images/*

# Optionally, reset config to defaults
sudo rm /etc/glowworm/config.yaml
# Recreate via configure script
sudo bash /opt/glowworm/scripts/configure.sh

# Restart
sudo systemctl start glowworm-daemon
```

## Getting Help

If you're still stuck:

1. **Gather diagnostics:**
   ```bash
   sudo journalctl -u glowworm-daemon --no-pager > glowworm-logs.txt
   cat /etc/glowworm/config.yaml >> glowworm-logs.txt
   uname -a >> glowworm-logs.txt
   vcgencmd get_mem gpu >> glowworm-logs.txt
   free -h >> glowworm-logs.txt
   ```

2. **Open an issue:** [GitHub Issues](https://github.com/nstephens/glowworm/issues)
   - Include the diagnostics file
   - Describe steps to reproduce
   - Note your Pi model and OS version

## Related

- [Installation Guide](installation.md)
- [Configuration Reference](configuration.md)
- [Developer Documentation](development.md)
