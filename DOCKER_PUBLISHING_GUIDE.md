# 🐳 Docker Image Publishing Guide

This guide will help you build and publish Glowworm Docker images to Docker Hub for easy distribution.

## 📋 Prerequisites

1. **Docker Account**: Create a free account at [Docker Hub](https://hub.docker.com/)
2. **Docker Installed**: Ensure Docker is installed and running
3. **Login to Docker Hub**: Run `docker login`

## 🏗️ Building Docker Images

### Option 1: Build Individual Images

```bash
# Build backend image
docker build -f Dockerfile.backend -t yourusername/glowworm-backend:latest .

# Build frontend image
docker build -f Dockerfile.frontend -t yourusername/glowworm-frontend:latest .
```

### Option 2: Build with Docker Compose

```bash
# Build all images
docker-compose build

# Tag them for publishing
docker tag glowworm-backend yourusername/glowworm-backend:latest
docker tag glowworm-frontend yourusername/glowworm-frontend:latest
```

## 🏷️ Tagging Strategy

Use semantic versioning for your images:

```bash
# Tag with version and latest
docker tag yourusername/glowworm-backend:latest yourusername/glowworm-backend:1.0.0
docker tag yourusername/glowworm-frontend:latest yourusername/glowworm-frontend:1.0.0
```

## 📤 Publishing to Docker Hub

### Push Individual Images

```bash
# Push backend
docker push yourusername/glowworm-backend:latest
docker push yourusername/glowworm-backend:1.0.0

# Push frontend
docker push yourusername/glowworm-frontend:latest
docker push yourusername/glowworm-frontend:1.0.0
```

## 📦 Complete Build & Publish Script

Create a `publish-docker.sh` script:

```bash
#!/bin/bash

# Configuration
DOCKER_USERNAME="yourusername"
VERSION="1.0.0"

echo "🐳 Building Glowworm Docker Images..."

# Build images
echo "📦 Building backend..."
docker build -f Dockerfile.backend -t $DOCKER_USERNAME/glowworm-backend:$VERSION -t $DOCKER_USERNAME/glowworm-backend:latest .

echo "📦 Building frontend..."
docker build -f Dockerfile.frontend -t $DOCKER_USERNAME/glowworm-frontend:$VERSION -t $DOCKER_USERNAME/glowworm-frontend:latest .

echo "✅ Build complete!"

# Ask for confirmation before pushing
read -p "Push to Docker Hub? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo "📤 Pushing images to Docker Hub..."
    
    docker push $DOCKER_USERNAME/glowworm-backend:$VERSION
    docker push $DOCKER_USERNAME/glowworm-backend:latest
    
    docker push $DOCKER_USERNAME/glowworm-frontend:$VERSION
    docker push $DOCKER_USERNAME/glowworm-frontend:latest
    
    echo "✅ Images published successfully!"
    echo ""
    echo "🎉 Users can now run:"
    echo "   docker pull $DOCKER_USERNAME/glowworm-backend:latest"
    echo "   docker pull $DOCKER_USERNAME/glowworm-frontend:latest"
fi
```

Make it executable:
```bash
chmod +x publish-docker.sh
```

## 📝 Update docker-compose.yml for Published Images

For users to use your published images, update `docker-compose.yml`:

```yaml
services:
  glowworm-backend:
    image: yourusername/glowworm-backend:latest
    # Remove the 'build' section
    
  glowworm-frontend:
    image: yourusername/glowworm-frontend:latest
    # Remove the 'build' section
```

Or create a separate `docker-compose.prod.yml` for end users.

## 🚀 Quick Start for End Users

Create a `quick-start.sh` for your users:

```bash
#!/bin/bash

echo "🐛 Glowworm Quick Start"
echo "======================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first:"
    echo "   https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker compose &> /dev/null; then
    echo "❌ Docker Compose is not installed."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp docker/env.example .env
    
    echo ""
    echo "⚠️  IMPORTANT: Edit .env file and set secure passwords!"
    echo ""
    echo "Required changes:"
    echo "  - MYSQL_ROOT_PASSWORD"
    echo "  - MYSQL_PASSWORD"
    echo "  - SECRET_KEY"
    echo ""
    read -p "Press Enter after editing .env file..."
fi

# Pull latest images
echo "📥 Pulling latest Glowworm images..."
docker-compose pull

# Start services
echo "🚀 Starting Glowworm..."
docker-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to start..."
sleep 10

echo ""
echo "✅ Glowworm is running!"
echo ""
echo "🌐 Access the application:"
echo "   - Web Interface: http://localhost"
echo "   - Direct API: http://localhost:8001/api"
echo ""
echo "📚 Next steps:"
echo "   1. Open http://localhost in your browser"
echo "   2. Complete the setup wizard"
echo "   3. Upload images and create playlists"
echo "   4. Register display devices"
echo ""
echo "📖 Documentation: https://github.com/yourusername/glowworm"
echo ""
```

## 📊 Image Size Optimization

### Current Sizes (Estimated)
- **Backend**: ~500MB (Ubuntu 22.04 + Python + dependencies)
- **Frontend**: ~25MB (Nginx Alpine + built assets)
- **MySQL**: ~500MB (Official MySQL 8.0)
- **Total**: ~1GB

### Optimization Tips

1. **Multi-stage builds** (already implemented)
2. **Use Alpine Linux** for smaller base images (consider for backend)
3. **Clean up build dependencies**:
```dockerfile
RUN apt-get update && apt-get install -y \
    python3 \
    && rm -rf /var/lib/apt/lists/*
```

4. **Use .dockerignore** (already implemented)

## 🔐 Security Best Practices

1. **Don't include secrets in images**
   - ✅ We use environment variables
   - ✅ .dockerignore excludes sensitive files

2. **Run as non-root user**
   - ✅ Backend runs as `glowworm` user
   - ✅ Frontend runs as `nginx` user

3. **Keep base images updated**
```bash
# Pull latest base images before building
docker pull ubuntu:22.04
docker pull node:18-alpine
docker pull nginx:alpine
docker pull mysql:8.0
```

## 📖 Documentation for Users

Include in your README.md:

```markdown
## 🐳 Quick Start with Docker

### Prerequisites
- Docker Engine 20.10+
- Docker Compose 2.0+

### Installation

1. Download the docker-compose.yml file:
   \`\`\`bash
   curl -O https://raw.githubusercontent.com/yourusername/glowworm/main/docker-compose.yml
   curl -O https://raw.githubusercontent.com/yourusername/glowworm/main/docker/env.example
   \`\`\`

2. Configure environment:
   \`\`\`bash
   cp env.example .env
   # Edit .env with your secure passwords
   nano .env
   \`\`\`

3. Start Glowworm:
   \`\`\`bash
   docker-compose up -d
   \`\`\`

4. Access at http://localhost and complete setup wizard

### Updating

\`\`\`bash
docker-compose pull
docker-compose up -d
\`\`\`

### Backup

\`\`\`bash
# Backup database
docker-compose exec glowworm-mysql mysqldump -u root -p glowworm > backup.sql

# Backup uploads
docker cp glowworm-backend:/app/uploads ./uploads-backup
\`\`\`
```

## 🧪 Testing Your Images

Before publishing, test the images:

```bash
# Test with fresh database
docker-compose down -v
docker-compose up

# Verify all services start
docker-compose ps

# Test the application
curl http://localhost/api/health
curl http://localhost:8001/api/health

# Check logs
docker-compose logs -f
```

## 📋 Pre-Release Checklist

- [ ] Update version numbers in Dockerfiles
- [ ] Test images locally
- [ ] Update DOCKER_SETUP.md documentation
- [ ] Create/update README.md with Docker instructions
- [ ] Test on clean system (no existing Glowworm installation)
- [ ] Verify setup wizard works
- [ ] Test display device registration
- [ ] Verify image uploads and playlists work
- [ ] Check all environment variables work correctly
- [ ] Test backup and restore procedures

## 🎯 Automated Builds (Optional)

Set up GitHub Actions to automatically build and push images:

Create `.github/workflows/docker-publish.yml`:

```yaml
name: Docker Build and Publish

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}
      
      - name: Build and push backend
        uses: docker/build-push-action@v4
        with:
          context: .
          file: ./Dockerfile.backend
          push: true
          tags: |
            yourusername/glowworm-backend:latest
            yourusername/glowworm-backend:${{ github.ref_name }}
      
      - name: Build and push frontend
        uses: docker/build-push-action@v4
        with:
          context: .
          file: ./Dockerfile.frontend
          push: true
          tags: |
            yourusername/glowworm-frontend:latest
            yourusername/glowworm-frontend:${{ github.ref_name }}
```

## 🤝 Support

Help users by creating:
- Issue templates for Docker-specific problems
- Troubleshooting section in documentation
- FAQ for common Docker issues

---

**Ready to publish?** Run `./publish-docker.sh` and share Glowworm with the world! 🎉

