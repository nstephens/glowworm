# GlowWorm v3.0 Final Integration Tests

This directory contains comprehensive integration tests for the Pi3D display system.

## Quick Start

Run all tests in mock mode (no hardware required):

```bash
sudo bash run_all_tests.sh --mock --quick
```

Run full test suite on Raspberry Pi hardware:

```bash
sudo bash run_all_tests.sh
```

## Test Scripts

### 1. Fresh Install Test (`test_fresh_install.sh`)

Verifies a clean installation by checking:
- Python version and dependencies
- Directory structure
- Virtual environment
- Package installation
- Configuration files
- Systemd service
- Module imports
- Mock display initialization

**Usage:**
```bash
sudo bash test_fresh_install.sh [--dry-run] [--verbose]
```

### 2. Stability Test (`test_stability.sh`)

Long-running test to verify system stability:
- Memory usage monitoring (detect leaks)
- CPU usage tracking
- Crash detection and recovery
- Performance metrics collection

**Usage:**
```bash
sudo bash test_stability.sh [--duration HOURS] [--mock]
```

**Default duration:** 24 hours

### 3. Offline Operation Test (`test_offline.sh`)

Tests daemon behavior when backend is unreachable:
- Operation from cached images
- Cache integrity verification
- Reconnection handling
- State preservation

**Usage:**
```bash
sudo bash test_offline.sh [--duration MINUTES] [--mock]
```

### 4. Multi-Device Test (`test_multi_device.sh`)

Tests multiple devices operating simultaneously:
- Device connectivity
- SSH access
- Installation verification
- Concurrent operation monitoring
- Simultaneous command execution

**Usage:**
```bash
bash test_multi_device.sh --devices 192.168.1.101,192.168.1.102,192.168.1.103
```

### 5. Playlist Update Test (`test_playlist_update.sh`)

Tests dynamic playlist changes:
- Adding/removing images
- Display time changes
- Position persistence
- Version detection

**Usage:**
```bash
sudo bash test_playlist_update.sh [--mock]
```

### 6. Power Cycle Test (`test_power_cycle.sh`)

Tests recovery from power loss:
- Graceful restart
- SIGKILL recovery (crash simulation)
- Boot recovery (optional reboot test)
- State restoration

**Usage:**
```bash
sudo bash test_power_cycle.sh [--mock] [--skip-reboot]
```

## Test Runner

The `run_all_tests.sh` script runs all tests in sequence:

```bash
sudo bash run_all_tests.sh [OPTIONS]

Options:
  --mock         Run in mock mode (no hardware required)
  --quick        Run abbreviated tests (shorter durations)
  --skip-reboot  Skip tests that require system reboot (default)
  --with-reboot  Include reboot tests
```

## Output

Test results are saved to `/var/log/glowworm/integration_tests/`:

- `test_summary_TIMESTAMP.txt` - Overall summary
- `test_runner_TIMESTAMP.log` - Detailed log
- Individual test output directories

## Pass/Fail Criteria

### Fresh Install
- All packages installed correctly
- All modules import successfully
- Mock display initializes

### Stability
- No crashes during test period
- Memory growth < 50MB
- Peak memory < 256MB

### Offline Operation
- Daemon survives offline period
- Cache integrity maintained
- No excessive memory growth

### Multi-Device
- All devices reachable
- No crashes during monitoring
- Simultaneous commands work

### Playlist Update
- Position preserved during updates
- Navigation works correctly
- Display time changes detected

### Power Cycle
- Auto-restart after SIGKILL
- State preserved after restart
- Service starts on boot (if reboot test enabled)

## Hardware Testing

For complete hardware testing on Raspberry Pi:

1. Install GlowWorm using `pi3d/scripts/install.sh`
2. Configure backend URL in `/etc/glowworm/config.yaml`
3. Run tests without `--mock` flag

```bash
# Full hardware test (allow 24+ hours)
sudo bash run_all_tests.sh

# Abbreviated hardware test (~2 hours)
sudo bash run_all_tests.sh --quick
```

## Troubleshooting

### Test fails with "GlowWorm not installed"

Install GlowWorm first:
```bash
sudo bash /path/to/pi3d/scripts/install.sh
```

### Tests pass in mock mode but fail on hardware

Check:
1. GPU memory is 128MB+ (`vcgencmd get_mem gpu`)
2. OpenGL ES libraries are installed
3. Display is connected

### Stability test shows memory growth

This may indicate a memory leak. Check:
1. Cache size limits in config
2. Image loading patterns
3. Review daemon logs

## Contributing

When adding new tests:
1. Create a new `test_*.sh` script
2. Follow the existing pattern (banner, phases, pass/fail)
3. Add to `run_all_tests.sh`
4. Update this README
