# GlowWorm

A modern web-based digital photo display system for creating beautiful fullscreen slideshows on portrait-oriented 4K displays. Perfect for turning Raspberry Pi devices into stunning digital photo frames.

## ✨ Features

- 📸 **Smart Image Management** - Upload and organize photos with automatic processing, albums, and playlists
- 🖼️ **Multiple Display Modes** - Default stacking, auto-sort by orientation, or movement mode with subtle panning
- 📱 **Easy Display Setup** - Simple device registration with QR codes, no complex configuration
- 🔄 **Real-time Control** - WebSocket-based remote control to update displays instantly
- 🎨 **Beautiful UI** - Modern, responsive admin interface built with React and Tailwind CSS
- 🔒 **Secure** - Role-based access control, cookie authentication, and device authorization
- 🚀 **Fast & Optimized** - Efficient image serving, smart preloading, and hardware acceleration support
- 🐳 **Docker Ready** - One-command deployment with everything bundled

## 📸 Screenshots

| Dashboard | Images |
|-----------|---------|
| ![Glowworm Dashboard](https://manipulate.org/glowworm/glowworm_dashboard.png) | ![Glowworm Images](https://manipulate.org/glowworm/glowworm_images.png) |

| Playlists | Displays |
|-----------|----------|
| ![Glowworm Playlists](https://manipulate.org/glowworm/glowworm_playlists.png) | ![Glowworm Displays](https://manipulate.org/glowworm/glowworm_displays.png) |

### Display Example
https://github.com/user-attachments/assets/f90c830d-4503-4673-8615-15d6d51d0e52

---

## 🚀 Quick Start

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
1. Download required Docker files (~50KB)
2. Guide you through secure password generation
3. Configure your server settings
4. Start all services (frontend, backend, database)

**Access your installation:**
- Find your server IP: `hostname -I`
- Open browser: `http://YOUR_SERVER_IP:3003`
- Complete the setup wizard (set admin password)
- Start uploading photos!

**Docker Hub Images:**
- [Backend](https://hub.docker.com/r/nickstephens/glowworm-backend)
- [Frontend](https://hub.docker.com/r/nickstephens/glowworm-frontend)

---

## 🌐 Production Setup with Custom Domain

For production use, we recommend using a reverse proxy to get:
- ✅ Custom domain (e.g., `photos.yourdomain.com`)
- ✅ SSL/HTTPS encryption
- ✅ Clean URLs (no port numbers)

### Using Nginx Proxy Manager (Recommended)

**1. Connect NPM to Glowworm's network:**

```bash
# Find your Nginx Proxy Manager container
docker ps | grep nginx

# Connect it to Glowworm
docker network connect glowworm_glowworm-network <npm-container-name>
```

**2. Create Proxy Host in NPM UI:**
- **Domain Names:** `your-domain.com`
- **Scheme:** `http`
- **Forward Hostname/IP:** `glowworm-frontend`
- **Forward Port:** `3003`
- **SSL:** Enable and force SSL as desired

**3. Add to "Advanced" tab:**

```nginx
# Let Vite frontend handle all API proxying internally
location / {
    proxy_pass http://glowworm-frontend:3003;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # WebSocket support for real-time features
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

**That's it!** Access your installation at `https://your-domain.com` 🎉

### Using Native Nginx

If running Nginx directly on your server (not in Docker):

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3003;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Other Reverse Proxies (Traefik, Caddy, etc.)

Simply point your reverse proxy to:
- **Target:** Frontend service (port 3003 or `glowworm-frontend` container)
- **WebSocket:** Enable WebSocket support for real-time features

The frontend automatically handles all API and WebSocket routing internally.

**Architecture Note:**
- Only expose the **frontend** (port 3003)
- Backend (port 8001) stays internal to Docker network for security
- Frontend's Vite proxy handles `/api/*` and `/ws/*` routing
- No CORS or mixed content issues

---

## 📱 How to Use

### For Admins

**1. Upload Images**
- Go to `/admin/images`
- Drag and drop photos or click "Upload Images"
- Organize into albums (optional)
- Supports: JPEG, PNG, GIF, WebP, AVIF

**2. Create Playlists**
- Navigate to `/admin/playlists`
- Click "Create Playlist"
- Add images from albums
- Configure display timing and mode
- Drag to reorder images

**3. Set Up Displays**
- Go to `/admin/displays`
- Display device shows registration code
- Authorize the device and assign playlist
- Device starts showing photos automatically

**4. Remote Control**
- View live display status
- Refresh displays remotely
- Change playlists on the fly
- Monitor device health

### For Displays

**Connect a Display Device:**
1. Open browser on display device (Raspberry Pi)
2. Navigate to `http://YOUR_SERVER_IP:3003/display`
3. Registration code appears
4. Admin authorizes from `/admin/displays`
5. Slideshow starts automatically

**Display Modes:**
- **Default:** Landscape images stack (top/bottom), portraits show full-screen
- **Auto-sort:** Automatically groups by orientation
- **Movement:** Adds subtle Ken Burns panning effect

---

## 🏗️ Technology Stack

**Backend:**
- Python FastAPI with SQLAlchemy ORM
- MySQL 8.0+ database
- WebSocket for real-time communication
- Pillow for image processing

**Frontend:**
- React with TypeScript
- Tailwind CSS + shadcn/ui components
- Vite dev server with API proxy
- Axios for API calls

**Deployment:**
- Docker Compose multi-container setup
- Optimized for Raspberry Pi displays
- Works on any Linux server

---

## 💻 Advanced Installation

### Manual Docker Setup

```bash
# Create directory and download files
mkdir glowworm && cd glowworm
curl -O https://raw.githubusercontent.com/nstephens/glowworm/main/docker-compose.yml
mkdir -p docker/{mysql,scripts}
curl -o docker/env.example https://raw.githubusercontent.com/nstephens/glowworm/main/docker/env.example
curl -o docker/mysql/init.sql https://raw.githubusercontent.com/nstephens/glowworm/main/docker/mysql/init.sql
curl -o docker/scripts/wait-for-mysql.sh https://raw.githubusercontent.com/nstephens/glowworm/main/docker/scripts/wait-for-mysql.sh
curl -o docker/scripts/start-backend.sh https://raw.githubusercontent.com/nstephens/glowworm/main/docker/scripts/start-backend.sh
chmod +x docker/scripts/*.sh

# Configure environment
cp docker/env.example .env
nano .env  # Set secure passwords and SERVER_BASE_URL

# Launch
docker compose up -d
```

### Native Installation (Without Docker)

**Prerequisites:**
- Python 3.8+, Node.js 20+, MySQL 8.0+

**Setup:**

   ```bash
# Clone repository
   git clone https://github.com/nstephens/glowworm.git
   cd glowworm

# Run setup script (recommended)
./setup.sh

# Or manually:
# Backend
   cd backend
   python -m venv venv
source venv/bin/activate
   pip install -r requirements.txt

# Frontend
cd ../frontend
   npm install

# Start services
cd ..
   ./start_glowworm.sh
   ```

**Access:** `http://localhost:3003` and complete setup wizard

---

## 🍓 Raspberry Pi Display Setup

GlowWorm works great with Raspberry Pi running FullPageOS or Raspberry Pi OS with Chromium in kiosk mode.

### Recommended: FullPageOS

1. **Install** using Raspberry Pi Imager
2. **Configure** FullPageOS to point to `http://YOUR_SERVER_IP:3003/display`
3. **Optimize** with these Chromium flags:

   ```bash
sudo vi /home/pi/scripts/start_chromium_browser

   flags=(
      --kiosk
      --touch-events=enabled
      --disable-pinch
      --noerrdialogs
      --disable-session-crashed-bubble
      --autoplay-policy=no-user-gesture-required
      --use-gl=egl
      --enable-gpu-rasterization
      --enable-accelerated-video-decode
      --enable-gpu-compositing
      --enable-oop-rasterization
      --memory-pressure-off
)
```

### Display Resolution

For best performance on Pi 4/5, use 1080p instead of 4K:

   ```bash
   sudo vi /etc/X11/xorg.conf.d/20-raspi.conf

   Section "Screen"
      Identifier "Screen"
      Device "Raspberry Pi GPU"
      DefaultDepth 24
      SubSection "Display"
         Depth 24
         Modes "1920x1080"
      EndSubSection
   EndSection
   ```

### Performance Tuning

   ```bash
   sudo vi /boot/firmware/config.txt

   [all]
   gpu_mem=128
   dtoverlay=vc4-kms-v3d-pi5
   arm_freq=2400
   gpu_freq=800
```

Disable unused services:
```bash
sudo systemctl disable bluetooth wifi-powersave ModemManager
```

---

## 🔧 Configuration

### First-Time Setup Wizard

On first access, the setup wizard guides you through:
1. **Admin Password** - Set your admin account password
2. **Done!** - Docker handles database configuration automatically

For native installations, the wizard also configures:
- MySQL database connection
- Network interfaces
- Server ports

### Admin Settings

Access `/admin/settings` to configure:
- **Server URLs** - Base URLs for frontend and backend
- **Display Settings** - Default timing, target resolutions
- **Upload Directory** - Where images are stored
- **Logging** - Debug levels and output

### Environment Variables (Docker)

The `.env` file controls Docker deployment:

   ```bash
# Database (auto-configured in Docker)
MYSQL_ROOT_PASSWORD=<generated>
MYSQL_PASSWORD=<generated>
MYSQL_DATABASE=glowworm

# Application
SECRET_KEY=<generated>
SERVER_BASE_URL=http://YOUR_SERVER_IP:8001
DEFAULT_DISPLAY_TIME_SECONDS=30

# Ports
FRONTEND_PORT=3003
BACKEND_PORT=8001
```

Generate secure passwords: `openssl rand -base64 24`

---

## 📁 Project Structure

```
glowworm/
├── backend/                 # Python FastAPI application
│   ├── api/                # REST API endpoints
│   ├── models/             # Database models (SQLAlchemy)
│   ├── services/           # Business logic
│   ├── websocket/          # WebSocket handlers
│   ├── utils/              # Helper functions
│   └── config/             # Settings management
├── frontend/               # React TypeScript app
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route pages
│   │   ├── services/       # API integration
│   │   ├── hooks/          # Custom React hooks
│   │   └── contexts/       # State management
├── docker/                 # Docker configuration
│   ├── mysql/             # Database initialization
│   └── scripts/           # Container startup scripts
└── data/                   # Persistent data (bind mounts)
    ├── mysql/             # Database files
    └── uploads/           # Image storage
```

---

## 🔒 Security

- **Authentication:** Cookie-based with secure HttpOnly flags
- **Authorization:** Role-based access (Super Admin, Admin, User)
- **CSRF Protection:** All form submissions protected
- **Input Validation:** File uploads validated beyond extensions
- **SQL Injection Prevention:** SQLAlchemy ORM with parameterized queries
- **XSS Protection:** Template escaping and CSP headers
- **Secure Passwords:** Bcrypt with SHA-256 pre-hashing for unlimited length
- **Device Authorization:** Display devices must be explicitly approved

---

## 🛠️ Troubleshooting

### Images Not Loading
- Check Docker logs: `docker compose logs glowworm-backend`
- Verify data directory permissions: `sudo chown -R 1000:1000 data/uploads`
- Ensure reverse proxy is configured correctly

### Can't Access via Custom Domain
- Verify reverse proxy is on same Docker network
- Check Nginx config points to `glowworm-frontend:3003`
- Enable WebSocket support in proxy config

### Display Device Won't Connect
- Ensure display can reach server IP
- Check firewall allows port 3003
- Verify device is authorized in `/admin/displays`

### Setup Wizard Keeps Appearing
- Check `.env` file has passwords set
- Verify backend is healthy: `docker compose ps`
- Check backend logs: `docker compose logs glowworm-backend`

### Database Connection Errors
- Reset database: `docker compose down && sudo rm -rf data/mysql && docker compose up -d`
- Check MySQL credentials in `.env` match
- Wait for MySQL to fully start (health check)

**Full troubleshooting guide:** See [DOCKER_SETUP.md](DOCKER_SETUP.md)

---

## 🤝 Contributing

We welcome contributions! 

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly (especially Docker deployment)
5. Commit (`git commit -m 'Add amazing feature'`)
6. Push (`git push origin feature/amazing-feature`)
7. Open a Pull Request

---

## 📚 Additional Documentation

- **[DOCKER_SETUP.md](DOCKER_SETUP.md)** - Comprehensive Docker deployment guide
- **Project Structure** - Detailed code organization
- **API Documentation** - Backend API reference
- **Development Guide** - Local development setup

---

## 📄 License

This project is licensed under the GNU General Public License v3.0 - see the LICENSE file for details.

---

## 🆘 Support

- **Issues:** Use the [GitHub issue tracker](https://github.com/nstephens/glowworm/issues)
- **Questions:** Check existing issues or open a new one
- **Documentation:** See [DOCKER_SETUP.md](DOCKER_SETUP.md) for detailed guides

---

## 🎯 Use Cases

- **Home Photo Displays** - Turn old monitors into beautiful digital photo frames
- **Art Galleries** - Display rotating art collections
- **Business Displays** - Show product photos, menus, or promotional content
- **Event Displays** - Weddings, parties, conferences
- **Museum Exhibits** - Curated image collections with easy updates

---

## 🔧 Advanced Topics

### Image Processing

- Automatic thumbnail generation (small, medium, large)
- EXIF data extraction and storage
- Smart storage hierarchy (organized by date)
- Duplicate detection via perceptual hashing
- Format support: JPEG, PNG, GIF, WebP, AVIF

### Display Optimization

- Hardware acceleration for Raspberry Pi
- Efficient image preloading
- Adaptive quality based on device capabilities
- Lazy loading for large galleries
- CSS optimizations for smooth transitions

### WebSocket Features

- Real-time display control
- Live device status monitoring
- Instant playlist updates
- Automatic reconnection handling
- Heartbeat monitoring

### System Architecture

- **Frontend** (port 3003) - Single entry point for all requests
- **Backend** (port 8001) - Internal API server (not exposed)
- **Database** (MySQL) - Internal only (no external access)
- **Vite Proxy** - Frontend proxies `/api/*` and `/ws/*` to backend
- **Data Persistence** - Bind mounts for easy backup (`./data/`)

**Why this architecture?**
- ✅ Single port exposure (simpler firewall rules)
- ✅ No CORS issues (single origin)
- ✅ No mixed content errors (HTTPS works seamlessly)
- ✅ Better security (backend not directly accessible)
- ✅ Works with any reverse proxy setup

---

**Made with ❤️ for digital photo enthusiasts**
