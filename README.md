# GlowWorm

A modern web-based digital photo display system for creating beautiful fullscreen slideshows on portrait-oriented displays. Perfect for turning Raspberry Pi devices into stunning digital photo frames that showcase your memories with style.

GlowWorm transforms any display into an elegant photo frame with powerful features for managing, organizing, and presenting your photo collection. Built for home users, artists, businesses, and anyone wanting to display photos beautifully.

<p align="center">
  <a href="https://youtube.com/shorts/REHHyqISQyo">
    <img src="https://img.youtube.com/vi/REHHyqISQyo/0.jpg" alt="Display Demo">
  </a><br>
  [Youtube demo of display device playing a slideshow]
</p>

## Features

**Image Management**
- Upload and organize photos with automatic processing
- Create and manage albums with rename and delete options
- Bulk operations with multi-select (download, move, delete)
- Automatic thumbnail and variant generation
- EXIF data extraction and display
- Duplicate detection via perceptual hashing
- Support for JPEG, PNG, GIF, WebP, AVIF formats

**Playlist System**
- Create custom playlists from your image library
- Drag-and-drop reordering with visual pairing indicators
- Smart image pairing for landscape photos (automatic stacking)
- Multiple display modes optimized for different devices
- Per-playlist EXIF date display option
- Automatic variant generation for display resolutions

**Scheduling System**
- Time-based playlist switching (new in v2.0)
- Day-of-week scheduling for different content
- Perfect for businesses or themed displays
- Set-and-forget automation

**Display Modes**
- Default - Smart pairing of landscape images with full-screen portraits
- Ken Burns Plus - Gentle zoom and pan effects (Raspberry Pi safe)
- Soft Glow - Subtle luminosity transitions
- Ambient Pulse - Breathing light effect
- Dreamy Reveal - Elegant fade-in animations
- Stacked Reveal - Synchronized dual-image transitions

**Display Device Management**
- Simple code-based device registration
- Multi-device support with individual configurations
- Real-time status monitoring and health checks
- Remote browser refresh and playlist assignment
- Automatic resolution detection with variant generation prompts
- Daemon service for reliable display management (new in v2.0)

**Advanced Features**
- WebSocket-based real-time communication
- Resolution-optimized image variants
- Hardware acceleration support for Raspberry Pi
- Efficient preloading and caching
- RESTful API for programmatic access

**Modern Admin Interface**
- Clean, responsive design built with React and Tailwind CSS
- Mobile-optimized views and touch interactions
- Drag-and-drop image organization
- Live display status dashboard
- System logs and monitoring

## Screenshots

| Dashboard | Images |
|-----------|---------|
| ![Glowworm Dashboard](docs/screenshots/1.%20dashboard.png) | ![Glowworm Images](docs/screenshots/2.%20images.png) |

| Playlists | Displays |
|-----------|----------|
| ![Glowworm Playlists](docs/screenshots/3.%20playlists.png) | ![Glowworm Displays](docs/screenshots/4.displays.png) |

| Settings |
|----------|
| ![Glowworm Settings](docs/screenshots/5.%20settings.png) |

### End to End Installation and Usage Example

[![GlowWorm Installation and Usage Demo](https://img.youtube.com/vi/euAhnJv0RoE/0.jpg)](https://www.youtube.com/watch?v=euAhnJv0RoE)

Watch the complete walkthrough: [GlowWorm Installation and Usage on YouTube](https://www.youtube.com/watch?v=euAhnJv0RoE)

---

## Compatibility

### Tested Environments

**Server Deployment (Docker):**
- Ubuntu Server 20.04+ - Fully tested and working
- Linux distributions with Docker support - Expected to work

**Display Devices:**
- Raspberry Pi with FullPageOS - Fully tested and working
- Firefox browser (desktop) - Fully tested and working
- Chrome browser (desktop) - Fully tested and working
- Chromium-based browsers - Expected to work
- WebKit-based browsers - Expected to work

### Untested Environments

**Server Deployment:**
- Windows (Docker Desktop) - May require adjustments
- macOS (Docker Desktop) - May require adjustments
- Non-Ubuntu Linux distributions - Should work but not verified

**Note on Windows/macOS:**
The Docker deployment is designed for Linux servers and may need modifications for Windows or macOS environments. Community contributions for platform-specific configurations are welcome via GitHub issues or pull requests.

---

## Quick Start

### Docker Deployment (Recommended)

**Requirements:**
- Docker Engine 20.10+
- Docker Compose 2.0+
- Linux server with 2GB+ RAM
- Port 3003 available

**Deploy in 2 commands:**

```bash
curl -O https://raw.githubusercontent.com/nstephens/glowworm/main/quick-start.sh
chmod +x quick-start.sh && ./quick-start.sh
```

The script will:
1. Download required Docker files
2. Generate secure passwords automatically
3. Detect your network interfaces
4. Prompt you to configure the network interface in `.env`
5. Start all services (frontend, backend, database)

**Access your installation:**
- Open browser: `http://YOUR_SERVER_IP:3003`
- Complete the setup wizard (set admin password)
- Start uploading photos

**Docker Hub Images:**
- [Backend](https://hub.docker.com/r/nickstephens/glowworm-backend)
- [Frontend](https://hub.docker.com/r/nickstephens/glowworm-frontend)

---

## Documentation

For detailed documentation, please visit the **[GlowWorm Wiki](https://github.com/nstephens/glowworm/wiki)**:

**Getting Started**
- [Installation Guide](https://github.com/nstephens/glowworm/wiki/Installation)
- [Configuration](https://github.com/nstephens/glowworm/wiki/Configuration)
- [First-Time Setup](https://github.com/nstephens/glowworm/wiki/Setup-Wizard)

**Usage**
- [Admin Interface Guide](https://github.com/nstephens/glowworm/wiki/Admin-Interface)
- [Creating Playlists](https://github.com/nstephens/glowworm/wiki/Playlists)
- [Managing Display Devices](https://github.com/nstephens/glowworm/wiki/Display-Devices)
- [Scheduling System](https://github.com/nstephens/glowworm/wiki/Scheduling)

**Display Setup**
- [Raspberry Pi Setup](https://github.com/nstephens/glowworm/wiki/Raspberry-Pi-Setup)
- [Display Daemon Service](https://github.com/nstephens/glowworm/wiki/Display-Daemon)
- [Performance Tuning](https://github.com/nstephens/glowworm/wiki/Performance)

**Advanced**
- [Reverse Proxy Setup](https://github.com/nstephens/glowworm/wiki/Reverse-Proxy)
- [Custom Domain Configuration](https://github.com/nstephens/glowworm/wiki/Custom-Domain)
- [API Documentation](https://github.com/nstephens/glowworm/wiki/API)
- [Native Installation](https://github.com/nstephens/glowworm/wiki/Native-Install)

**Troubleshooting**
- [Common Issues](https://github.com/nstephens/glowworm/wiki/Troubleshooting)
- [Docker Issues](https://github.com/nstephens/glowworm/wiki/Docker-Troubleshooting)
- [Display Problems](https://github.com/nstephens/glowworm/wiki/Display-Troubleshooting)

---

## Technology Stack

**Backend:**
- Python FastAPI with SQLAlchemy ORM
- MySQL 8.0+ database
- WebSocket for real-time communication
- Celery for background task processing
- Pillow for image processing

**Frontend:**
- React with TypeScript
- Tailwind CSS with shadcn/ui components
- Vite dev server with API proxy
- IndexedDB for client-side caching

**Deployment:**
- Docker Compose multi-container setup
- Optimized for Raspberry Pi displays
- Works on any Linux server

---

## Contributing

We welcome contributions! Please see the [Contributing Guide](https://github.com/nstephens/glowworm/wiki/Contributing) in the wiki for:
- Development setup instructions
- Coding standards
- Testing guidelines
- Pull request process

---

## Use Cases

**Home Photo Displays**
- Turn old monitors into beautiful digital photo frames
- Display family memories with EXIF dates
- Organize by events, people, or time periods

**Art Galleries**
- Display rotating art collections
- Multiple playlists for different exhibitions
- Real-time updates during events

**Business Displays**
- Show product photos, menus, or promotional content
- Scheduled content switching (morning/evening themes)
- Multiple displays with different content

**Event Displays**
- Weddings, parties, conferences
- Guest photo submissions via album sharing
- Live playlist updates during events

---

## License

This project is licensed under the GNU General Public License v3.0 - see the LICENSE file for details.

---

## Support

- **Documentation:** [GlowWorm Wiki](https://github.com/nstephens/glowworm/wiki)
- **Issues:** [GitHub Issue Tracker](https://github.com/nstephens/glowworm/issues)
- **Questions:** Check existing issues or open a new one

---

**Built for digital photo enthusiasts**
