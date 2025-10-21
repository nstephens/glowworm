#!/bin/bash

# Glowworm Docker Image Publishing Script
# This script builds and publishes Docker images to Docker Hub

set -e  # Exit on error

# Configuration
DOCKER_USERNAME="${DOCKER_USERNAME:-yourusername}"
VERSION="${VERSION:-1.0.0}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🐳 Glowworm Docker Image Publisher${NC}"
echo -e "${BLUE}====================================${NC}"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if logged in to Docker Hub
if ! docker info | grep -q "Username"; then
    echo -e "${YELLOW}⚠️  Not logged in to Docker Hub${NC}"
    echo "Please run: docker login"
    exit 1
fi

echo -e "${GREEN}Docker Username:${NC} $DOCKER_USERNAME"
echo -e "${GREEN}Version:${NC} $VERSION"
echo ""

# Confirm before proceeding
read -p "Is this information correct? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled. Set DOCKER_USERNAME and VERSION environment variables:"
    echo "  export DOCKER_USERNAME=yourusername"
    echo "  export VERSION=1.0.0"
    exit 1
fi

echo ""
echo -e "${BLUE}📦 Building Docker images...${NC}"
echo ""

# Build backend image
echo -e "${YELLOW}Building backend image...${NC}"
docker build \
    -f Dockerfile.backend \
    -t $DOCKER_USERNAME/glowworm-backend:$VERSION \
    -t $DOCKER_USERNAME/glowworm-backend:latest \
    .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backend image built successfully${NC}"
else
    echo -e "${RED}❌ Backend build failed${NC}"
    exit 1
fi

echo ""

# Build frontend image
echo -e "${YELLOW}Building frontend image...${NC}"
docker build \
    -f Dockerfile.frontend \
    -t $DOCKER_USERNAME/glowworm-frontend:$VERSION \
    -t $DOCKER_USERNAME/glowworm-frontend:latest \
    .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Frontend image built successfully${NC}"
else
    echo -e "${RED}❌ Frontend build failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ All images built successfully!${NC}"
echo ""

# Show image sizes
echo -e "${BLUE}📊 Image Sizes:${NC}"
docker images | grep "$DOCKER_USERNAME/glowworm-" | grep -E "(latest|$VERSION)"
echo ""

# Ask for confirmation before pushing
echo -e "${YELLOW}Ready to push images to Docker Hub?${NC}"
echo "This will publish:"
echo "  - $DOCKER_USERNAME/glowworm-backend:$VERSION"
echo "  - $DOCKER_USERNAME/glowworm-backend:latest"
echo "  - $DOCKER_USERNAME/glowworm-frontend:$VERSION"
echo "  - $DOCKER_USERNAME/glowworm-frontend:latest"
echo ""
read -p "Push to Docker Hub? (y/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${BLUE}📤 Pushing images to Docker Hub...${NC}"
    echo ""
    
    # Push backend images
    echo -e "${YELLOW}Pushing backend:$VERSION...${NC}"
    docker push $DOCKER_USERNAME/glowworm-backend:$VERSION
    
    echo -e "${YELLOW}Pushing backend:latest...${NC}"
    docker push $DOCKER_USERNAME/glowworm-backend:latest
    
    # Push frontend images
    echo -e "${YELLOW}Pushing frontend:$VERSION...${NC}"
    docker push $DOCKER_USERNAME/glowworm-frontend:$VERSION
    
    echo -e "${YELLOW}Pushing frontend:latest...${NC}"
    docker push $DOCKER_USERNAME/glowworm-frontend:latest
    
    echo ""
    echo -e "${GREEN}✅ Images published successfully!${NC}"
    echo ""
    echo -e "${BLUE}🎉 Glowworm is now available on Docker Hub!${NC}"
    echo ""
    echo "Users can pull your images with:"
    echo -e "${GREEN}  docker pull $DOCKER_USERNAME/glowworm-backend:latest${NC}"
    echo -e "${GREEN}  docker pull $DOCKER_USERNAME/glowworm-frontend:latest${NC}"
    echo ""
    echo "Or run with docker-compose:"
    echo -e "${GREEN}  docker-compose up -d${NC}"
    echo ""
    echo "Docker Hub URLs:"
    echo "  https://hub.docker.com/r/$DOCKER_USERNAME/glowworm-backend"
    echo "  https://hub.docker.com/r/$DOCKER_USERNAME/glowworm-frontend"
    echo ""
else
    echo ""
    echo -e "${YELLOW}ℹ️  Images not pushed. They are available locally for testing.${NC}"
    echo ""
    echo "To test locally:"
    echo "  docker-compose up"
    echo ""
    echo "To push later, run:"
    echo "  docker push $DOCKER_USERNAME/glowworm-backend:$VERSION"
    echo "  docker push $DOCKER_USERNAME/glowworm-backend:latest"
    echo "  docker push $DOCKER_USERNAME/glowworm-frontend:$VERSION"
    echo "  docker push $DOCKER_USERNAME/glowworm-frontend:latest"
fi

echo ""
echo -e "${BLUE}📝 Next Steps:${NC}"
echo "  1. Update README.md with Docker Hub links"
echo "  2. Test the published images on a clean system"
echo "  3. Create a GitHub release with docker-compose.yml"
echo "  4. Share your project! 🚀"
echo ""

