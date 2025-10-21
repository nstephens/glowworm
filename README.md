# GlowWorm

A web-based digital photo display application that allows users to upload images, create playlists, and display fullscreen slideshows optimized for portrait-oriented 4K displays, with secure admin access and easy display viewing without login requirements.

## 🎯 Project Overview

GlowWorm is designed to display images on low-power devices like Raspberry Pi while supporting high-quality image display and real-time remote control. The system provides secure admin access for content management while allowing easy display viewing without login requirements.

Suggested approach is to install the service on a stable linux server. It doesn't have to be powerful, and could likely run on a raspberry pi as well (I just haven't tested that personally). 


## Screenshots

| Dashboard | Images |
|-----------|---------|
| ![Glowworm Dashboard](https://manipulate.org/glowworm/glowworm_dashboard.png) | ![Glowworm Images](https://manipulate.org/glowworm/glowworm_images.png) |

| Playlists | Displays |
|-----------|----------|
| ![Glowworm Playlists](https://manipulate.org/glowworm/glowworm_playlists.png) | ![Glowworm Displays](https://manipulate.org/glowworm/glowworm_displays.png) |

### Display Example
https://github.com/user-attachments/assets/f90c830d-4503-4673-8615-15d6d51d0e52



## ✨ Key Features

- **Image Upload & Management**: Support for JPEG, PNG, GIF, WebP, AVIF formats with smart storage hierarchy
- **Album & Playlist Management**: Organize images into albums and create display playlists
- **Real-time Display Control**: WebSocket-based remote control for display devices
- **Display Device Authorization**: Secure device registration and management system
- **Smart Image Delivery**: Preloading strategy with efficient image serving
- **Cookie-based Authentication**: Simplified authentication with long-lived cookies
- **First-time Setup Wizard**: Guided initial configuration process
- **Multiple Display Modes**: Default stacking, auto-sort, and movement modes
- **Configurable Display Timing**: Customizable image display duration per playlist

## 🏗️ Technology Stack

- **Backend**: Python FastAPI with SQLAlchemy ORM
- **Database**: MySQL 8.0+ with backup capabilities
- **Frontend**: React with TypeScript and Tailwind CSS
- **Real-time Communication**: WebSockets for display control
- **Image Processing**: Pillow (PIL) for thumbnails and metadata
- **Authentication**: Cookie-based with Google OAuth2 integration
- **Target Display**: Portrait-oriented, vertically mounted displays up to 4K resolution
- **Deployment**: Debian-based servers (Raspberry Pi compatible)

## 📁 Project Structure

```
glowworm/
├── backend/                 # FastAPI application
│   ├── api/                # API route handlers
│   ├── models/             # SQLAlchemy models
│   ├── services/           # Business logic
│   ├── websocket/          # WebSocket handlers
│   ├── utils/              # Helper functions
│   ├── config/             # Configuration files
│   └── deployment/         # Production deployment scripts
├── frontend/               # React TypeScript application
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Route components
│   │   ├── services/       # API integration
│   │   ├── hooks/          # Custom React hooks
│   │   ├── utils/          # Helper functions
│   │   ├── types/          # TypeScript type definitions
│   │   ├── contexts/       # React contexts
│   │   ├── assets/         # Images and icons
│   │   └── styles/         # CSS and styling
│   └── public/             # Static assets
├── scripts/                # Development and deployment scripts
├── docs/                   # Additional documentation
├── uploads/                # Image storage directory
```

## 🚀 Getting Started

### 🐳 Docker Deployment (Recommended)

The easiest way to run Glowworm is using Docker on a server (headless or not).

#### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- Server with at least 2GB RAM
- Network access to your server

#### Quick Start with Docker

**On your server**, run:

```bash
# Download the repository
git clone https://github.com/nstephens/glowworm.git
cd glowworm

# Run the quick start script
./quick-start.sh
```

The script will guide you through configuration and start all services.

**Access from your computer:**
- Replace `SERVER_IP` with your server's IP address (e.g., `192.168.1.100`)
- Open `http://SERVER_IP` in your browser
- Complete the setup wizard

#### Manual Docker Setup

**1. On your server, download the files:**
```bash
git clone https://github.com/nstephens/glowworm.git
cd glowworm
```

**2. Configure environment:**
```bash
cp docker/env.example .env

# Generate secure passwords
openssl rand -base64 32  # Use for MYSQL_ROOT_PASSWORD
openssl rand -base64 32  # Use for MYSQL_PASSWORD
openssl rand -base64 32  # Use for SECRET_KEY

# Edit .env with your settings
nano .env
```

**Important:** Set `SERVER_BASE_URL` to your server's IP:
```bash
SERVER_BASE_URL=http://192.168.1.100:8001  # Replace with your server's IP
```

**3. Start services:**
```bash
docker-compose up -d
```

**4. Access from any device on your network:**
- Web Interface: `http://YOUR_SERVER_IP`
- Direct API: `http://YOUR_SERVER_IP:8001/api`
- Complete the first-time setup wizard

**5. Register display devices:**
- On your display device (tablet, Raspberry Pi, etc.)
- Navigate to `http://YOUR_SERVER_IP`
- Follow the on-screen authorization code
- Authorize from the admin panel

**Docker Hub Images:**
- Backend: https://hub.docker.com/r/nickstephens/glowworm-backend
- Frontend: https://hub.docker.com/r/nickstephens/glowworm-frontend

**Full Docker documentation**: See [DOCKER_SETUP.md](DOCKER_SETUP.md)

---

### 💻 Manual Installation (Alternative)

If you prefer to install without Docker:

#### Prerequisites

- Python 3.8+ with pip
- Node.js 16+ with npm
- MySQL 8.0+
- Git

#### Service Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/nstephens/glowworm.git
   cd glowworm
   ```

2. **Set up the backend and frontend requirements**

   Suggested: just run the `./setup.sh` script

   Alternatively: 
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

   ```bash
   cd frontend
   npm install
   ```
3. **Start the glowworm services**
   ```bash
   ./start_glowworm.sh
   ```

   alternatively:
   ```bash
   # Backend (from backend directory)
   uvicorn main:app --reload

   # Frontend (from frontend directory)
   npm run dev
   ```

4. **Run the first-time setup wizard**
   - Open a browser, navigate to the installed locations IP and selected port (eg http://192.168.0.15:3003)
   - Follow the setup wizard to configure MySQL and create admin user



## 🔧 Configuration

The application uses a first-time setup wizard to configure:
- MySQL database connection details
- Application database user creation
- Admin user password setup
- Network interface selection for API and frontend server
- Server ports and display settings
- Logging configuration

### Bootstrap vs Application Settings

- **Bootstrap Settings** (File-based): Database credentials, admin password, secret key stored in `backend/config/settings.json`
- **Application Settings** (Database-based): Server URLs, ports, display configuration, logging settings stored in the `system_settings` database table

## 📱 Usage

### Admin Interface

Access the admin panel at `/admin/` to:
- **Upload and manage images**: Drag and drop multiple images with automatic processing
- **Create albums**: Organize images into themed collections
- **Create and customize playlists**: Set display timing, modes, and image order
- **Manage display devices**: Authorize and monitor connected displays
- **Configure system settings**: Adjust server settings, display options, and logging

### Basic Workflows

#### 1. Creating Albums
1. Navigate to `/admin/images`
2. Click "Create Album" button
3. Enter album name
4. Album appears in the sidebar for image organization

#### 2. Uploading Images
1. Go to `/admin/images`
2. Select an album (optional)
3. Drag and drop images or click "Upload Images"
4. Images are automatically processed and stored with smart hierarchy
5. Scaled versions are generated based on configured display sizes

#### 3. Creating Playlists
1. Navigate to `/admin/playlists`
2. Click "Create Playlist"
3. Enter playlist name and slug
4. Add images from albums or upload directly
5. Customize display settings:
   - **Display Time**: Set duration for each image (1-300 seconds)
   - **Display Mode**: Choose between Default, Auto-sort, or Movement
   - **Image Order**: Drag to reorder or use "Randomize Order" button

#### 4. Authorizing Display Devices
1. Go to `/admin/displays`
2. Connect your display device (Raspberry Pi) to the network
3. The device appears in the "Pending" section
4. Click "Authorize" and assign a playlist
5. Device status changes to "Authorized" and begins displaying

#### 5. Customizing Playlists
- **Display Timing**: Set custom display duration per playlist
- **Display Options**: 
  - **Default**: Landscape images stack horizontally, portrait images display full
  - **Auto-sort**: Automatically sorts images by orientation
  - **Movement**: Adds subtle panning motion to images
- **Image Order**: Drag to reorder, randomize, or use auto-sort

### Display Interface

- Access displays at `/display/` or `/display/<playlist-slug>`
- No authentication required for viewing
- Fullscreen slideshow optimized for portrait 4K displays
- Manual controls available (pause, navigate, exit fullscreen)
- Real-time updates via WebSocket connection

## 🍓 Raspberry Pi Display Setup

### FullPageOS Configuration

GlowWorm is optimized for Raspberry Pi displays running FullPageOS. You can install this using the Raspberry Pi Imager, or do it manually. 

#### Customizations I recommend
1. Update flags for the chromium browser
   ```bash
   sudo vi scripts/start_chromium_browser

   flags=(
      --kiosk
      --touch-events=enabled
      --disable-pinch
      --noerrdialogs
      --disable-session-crashed-bubble
      --simulate-outdated-no-au='Tue, 31 Dec 2099 23:59:59 GMT'
      --disable-component-update
      --overscroll-history-navigation=0
      --disable-features=TranslateUI
      --autoplay-policy=no-user-gesture-required
      --use-gl=egl
      --enable-gpu-rasterization
      --disable-background-timer-throttling
      --ignore-gpu-blocklist
      --enable-accelerated-video-decode
      --disable-features=VizDisplayCompositor
      --enable-gpu-compositing
      --enable-oop-rasterization
      --memory-pressure-off
      --max_old_space_size=4096
      --disable-web-security
      --enable-features=VaapiVideoDecoder
   )
   ```
2. Create a new xorg conf file to change resolution to 1920x1080 -- I was able to run at 4k, but it is much smoother at 2k and I can't easily tell the difference
   ```bash
   sudo vi /etc/X11/xorg.conf.d/20-raspi.conf

   Section "Device"
      Identifier "Raspberry Pi GPU"
      Driver "modesetting"
      Option "AccelMethod" "glamor"
      Option "DRI" "true"
   EndSection

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

3. Update the RPi firmware options (very bottom of file)
   ```bash
   sudo vi /boot/firmware/config.txt

   [all]
   # enable raspicam
   start_x=1
   disable_splash=1
   ## glowworm changes
   #dtoverlay=vc4-kms-v3d
   hdmi_mode=82
   gpu_mem=128
   dtoverlay=vc4-kms-v3d-pi5
   dtoverlay=vc4-kms-v3d-pi4
   arm_freq=2400
   gpu_freq=800
   over_voltage=2
   arm_freq_min=1500
   gpu_freq_min=500
   dtparam=pciex1
   arm_64bit=1
   ```
4. Disable services (if you don't need them)
   ```bash
   sudo systemctl disable bluetooth
   sudo systemctl disable wifi-powersave
   sudo systemctl disable ModemManager
   ```
#### Customizations Made
- **Portrait Orientation**: Optimized for vertical displays (1080x1920, 2160x3840)
- **Hardware Acceleration**: CSS optimizations for smooth performance on Pi
- **Auto-fullscreen**: Automatically enters fullscreen mode
- **No Cursor**: Hides mouse cursor during slideshow
- **Performance Optimizations**: Reduced shadows, simplified transitions for Pi hardware

##  Display Modes
- **Default Mode**: Landscape images display in split-screen (top/bottom), portrait images full-screen
- **Movement Mode**: Subtle panning motion for dynamic viewing experience
- **Auto-sort Mode**: Automatically organizes images by orientation

## Remote Control
- Displays connect via WebSocket for real-time control
- Admin can refresh displays, change playlists, and monitor status
- Automatic reconnection on network issues

## 🔒 Security

- Cookie-based authentication with secure flags
- CSRF protection on all form submissions
- File upload validation beyond file extensions
- SQL injection prevention via SQLAlchemy ORM
- XSS protection with template escaping
- Display device authorization system
- User role management (Super Admin, Admin, User)

## 🚀 Deployment

### Production Deployment
- Debian-based server setup (Raspberry Pi compatible)
- Virtual environment isolation
- Database backup configuration
- Systemd service setup for automatic startup
- Reverse proxy configuration (nginx recommended)


## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the GNU General Public License v3.0 - see the LICENSE file for details.

## 🆘 Support

- **Issues**: Use repository issue tracker for bugs and feature requests
- **Development**: Follow GitFlow branching strategy

## 🔧 Advanced Configuration

### System Settings
Access `/admin/settings` to configure:
- **General Settings**: Server URLs, ports, default display time, upload directory
- **Display Settings**: Target display sizes, status check intervals
- **Logging**: Debug levels, log output configuration
- **User Management**: Create and manage user accounts with role-based access

### Image Processing
- Automatic thumbnail generation
- Scaled versions for different display resolutions
- Smart storage hierarchy (year/month/user structure)
- EXIF data extraction and storage
- Format conversion and optimization

### WebSocket Communication
- Real-time display status updates
- Remote playlist changes
- Device authorization notifications
- Heartbeat monitoring for connection health
