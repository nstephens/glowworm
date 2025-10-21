# 🐳 Glowworm Docker Setup Guide

This guide covers running Glowworm with Docker Compose. Choose the method that best fits your needs.

## 📋 Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 2GB RAM available
- Ports 80 and 8001 available (or customize in .env)
- **Note:** MySQL runs entirely within Docker network - no host port needed!

---

## 🎯 Option 1: Quick Start Script (Recommended for New Users)

The easiest way to get started on a server:

**On your server** (via SSH or direct access):

```bash
# Clone the repository
git clone https://github.com/nstephens/glowworm.git
cd glowworm

# Run the quick start script
./quick-start.sh
```

The script will:
- ✅ Check prerequisites
- ✅ Create and help you configure `.env` file
- ✅ Validate passwords are secure
- ✅ Pull/build Docker images
- ✅ Start all services

**Access from any device on your network:**
- Find your server's IP address: `hostname -I` or `ip addr show`
- Open `http://YOUR_SERVER_IP` in a browser
- Complete the setup wizard

---

## 🛠️ Option 2: Manual Setup (For Advanced Users)

### 1. Clone Repository on Your Server

**SSH into your server** or access it directly, then:

```bash
git clone https://github.com/nstephens/glowworm.git
cd glowworm
```

### 2. Configure Environment

```bash
# Copy the example environment file
cp docker/env.example .env
```

**Edit `.env` and set your configuration:**

```bash
# REQUIRED: Generate secure passwords
# Run: openssl rand -base64 32

MYSQL_ROOT_PASSWORD=CHANGE_ME_TO_STRONG_PASSWORD
MYSQL_PASSWORD=CHANGE_ME_TO_STRONG_PASSWORD
SECRET_KEY=CHANGE_ME_TO_RANDOM_SECRET_KEY

# IMPORTANT: Set to your server's IP address or hostname
# Example: http://192.168.1.100:8001 or http://myserver.local:8001
SERVER_BASE_URL=http://YOUR_SERVER_IP:8001
```

⚠️ **CRITICAL**: 
- Replace `CHANGE_ME` values with secure passwords
- Replace `YOUR_SERVER_IP` with your server's actual IP address

**Find your server's IP:**
```bash
hostname -I  # Shows all IP addresses
# or
ip addr show  # Detailed network information
```

### 3. Build and Start

```bash
# Build images from source
docker-compose build

# Start services
docker-compose up -d

# Check status
docker-compose ps
```

### 4. Access from Any Device on Your Network

- **Web Interface**: `http://YOUR_SERVER_IP`
- **Direct API**: `http://YOUR_SERVER_IP:8001/api`

Replace `YOUR_SERVER_IP` with your server's IP address (e.g., `192.168.1.100`)

### 5. Complete Setup

- Open the web interface in your browser
- Follow the setup wizard to create admin account
- Configure display settings

## 🛠️ Development Setup

For development with live reload:

```bash
# Start in development mode
docker-compose up

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**Development Features:**
- Live reload for both frontend and backend
- Frontend served on port 3000
- MySQL on port 3307 (to avoid conflicts)
- Debug logging enabled

## 📁 File Structure

```
glowworm/
├── docker-compose.yml              # Production configuration
├── docker-compose.override.yml     # Development overrides
├── Dockerfile.backend              # Backend container
├── Dockerfile.frontend             # Frontend container
├── .dockerignore                   # Docker build exclusions
├── .env                           # Your environment variables
├── docker/
│   ├── nginx/
│   │   └── frontend.conf          # Nginx configuration
│   ├── mysql/
│   │   └── init.sql              # MySQL initialization
│   ├── scripts/
│   │   └── wait-for-mysql.sh     # Database wait script
│   └── env.example               # Environment template
└── DOCKER_SETUP.md               # This file
```

## 🔧 Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MYSQL_ROOT_PASSWORD` | *required* | MySQL root password |
| `MYSQL_PASSWORD` | *required* | MySQL app user password |
| `SECRET_KEY` | *required* | JWT secret key |
| `MYSQL_DATABASE` | `glowworm` | Database name |
| `MYSQL_USER` | `glowworm` | Database user |
| `SERVER_BASE_URL` | `http://localhost` | Base URL for API |
| `BACKEND_PORT` | `8001` | Backend API port |
| `FRONTEND_PORT` | `80` | Frontend web port |
| `DEFAULT_DISPLAY_TIME_SECONDS` | `30` | Default slide duration |
| `LOG_LEVEL` | `INFO` | Logging level |

### Port Configuration

- **Port 80**: Web interface (with API proxy)
- **Port 8001**: Direct API access (for displays)
- **Port 3306**: MySQL database

For development:
- **Port 3000**: Frontend dev server
- **Port 3307**: MySQL (to avoid conflicts)

## 🔍 Troubleshooting

### Common Issues

**1. Port Already in Use**
```bash
# Check what's using the port
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :8001

# Change ports in .env file
FRONTEND_PORT=8080
BACKEND_PORT=8002
```

**2. Database Connection Issues**
```bash
# Check MySQL container
docker-compose logs glowworm-mysql

# Check backend logs
docker-compose logs glowworm-backend

# Restart services
docker-compose restart
```

**3. Permission Issues**
```bash
# Fix upload directory permissions
docker-compose exec glowworm-backend chown -R glowworm:glowworm /app/uploads
```

**4. Build Issues**
```bash
# Rebuild containers
docker-compose build --no-cache

# Remove all containers and rebuild
docker-compose down -v
docker-compose up --build
```

### Useful Commands

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f glowworm-backend

# Execute commands in containers
docker-compose exec glowworm-backend bash
docker-compose exec glowworm-mysql mysql -u root -p

# Check container status
docker-compose ps

# Restart specific service
docker-compose restart glowworm-backend

# Update and restart
docker-compose pull && docker-compose up -d
```

---

## 🏭 For Maintainers: Building and Publishing Docker Images

If you're a maintainer wanting to publish Glowworm images to Docker Hub:

### 1. Setup Publishing Environment

```bash
# Create docker-publish directory (gitignored)
mkdir -p docker-publish

# Copy publishing materials
cp docker/publishing/* docker-publish/
```

### 2. Configure Docker Hub

```bash
# Login to Docker Hub
docker login

# Set your Docker Hub username
export DOCKER_USERNAME="your-dockerhub-username"
export VERSION="1.0.0"
```

### 3. Build and Publish

```bash
cd docker-publish
./publish-docker.sh
```

The script will:
- Build backend and frontend images
- Tag with version and `latest`
- Show image sizes
- Push to Docker Hub after confirmation

### 4. Update End-User Files

After publishing, update:
- `docker-compose.prod.yml` - Set your Docker Hub username
- `quick-start.sh` - Update download URLs
- `README.md` - Add Docker Hub links

**Full documentation**: See `docker-publish/DOCKER_PUBLISHING_GUIDE.md`

---

## 🔒 Security Notes

1. **Change Default Passwords**: Always generate secure passwords for production
   - Use: `openssl rand -base64 32`
   - Never use placeholder values from `env.example`
2. **Environment Files**: Never commit `.env` files to version control
3. **Network Security**: Consider using a reverse proxy for production deployments
4. **Database Security**: The MySQL container is exposed on port 3306 - consider firewall rules for production

## 📦 Data Persistence

- **MySQL Data**: Stored in `mysql_data` Docker volume
- **Uploads**: Stored in `uploads_data` Docker volume
- **Backup**: Use `docker-compose down -v` to remove all data

## 🚀 Production Deployment

For production deployment:

1. Use a proper reverse proxy (nginx, traefik)
2. Enable HTTPS/TLS
3. Set up regular database backups
4. Configure log rotation
5. Use Docker secrets for sensitive data
6. Set resource limits in docker-compose.yml

## 📞 Support

If you encounter issues:

1. Check the logs: `docker-compose logs -f`
2. Verify your `.env` configuration
3. Ensure all required ports are available
4. Check Docker and Docker Compose versions

---

**Happy Glowworming! 🐛✨**

