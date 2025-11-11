#!/bin/bash

# GlowWorm Docker Publishing Script
# Usage: ./publish.sh [--push] [--local-only]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
PUSH_TO_HUB=false
PUSH_TEST=false
LOCAL_ONLY=false
CUSTOM_VERSION=""
DOCKER_USERNAME="nickstephens"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --push)
            PUSH_TO_HUB=true
            shift
            ;;
        --push-test)
            PUSH_TEST=true
            shift
            ;;
        --local-only)
            LOCAL_ONLY=true
            shift
            ;;
        --version)
            CUSTOM_VERSION="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [--push] [--push-test] [--local-only] [--version X.Y.Z]"
            echo "  --push       Push :latest and :VERSION to Docker Hub (production)"
            echo "  --push-test  Push :test tag to Docker Hub (unstable branch)"
            echo "  --local-only Only build locally, don't push"
            echo "  --version    Use a specific version instead of auto-incrementing"
            exit 0
            ;;
        *)
            echo "Unknown option $1"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}🐳 GlowWorm Docker Publishing${NC}"
echo "=================================="

# Get version from Docker Hub or package.json
get_latest_version_simple() {
    local image_name="$1"
    local latest_version=""
    
    # Simple approach: get the latest tag (excluding 'latest')
    if command -v curl >/dev/null 2>&1; then
        echo -e "${BLUE}  🔍 Checking ${image_name} (simple method)...${NC}" >&2
        local response=$(curl -s --connect-timeout 10 --max-time 30 "https://registry.hub.docker.com/v2/repositories/${DOCKER_USERNAME}/${image_name}/tags/?page_size=100" 2>/dev/null)
        
        if [ $? -eq 0 ] && [ -n "$response" ]; then
            # Extract all version-like tags and get the highest one
            latest_version=$(echo "$response" | grep -o '"name":"[0-9][^"]*"' | sed 's/"name":"//g' | sed 's/"//g' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1)
            
            if [ -n "$latest_version" ]; then
                echo -e "${GREEN}  ✅ Found ${image_name}: ${latest_version}${NC}" >&2
            else
                echo -e "${YELLOW}  ⚠️  No version tags found for ${image_name}${NC}" >&2
            fi
        fi
    fi
    
    echo "$latest_version"
}
get_latest_version_from_hub() {
    local image_name="$1"
    local latest_version=""
    
    # Try to get the latest version from Docker Hub
    if command -v curl >/dev/null 2>&1; then
        echo -e "${BLUE}  🔍 Checking ${image_name}...${NC}" >&2
        # Get tags from Docker Hub API
        local response=$(curl -s --connect-timeout 10 --max-time 30 "https://registry.hub.docker.com/v2/repositories/${DOCKER_USERNAME}/${image_name}/tags/?page_size=100" 2>/dev/null)
        
        if [ $? -eq 0 ] && [ -n "$response" ]; then
            # Debug: Show raw response (first 200 chars)
            echo -e "${BLUE}  📋 Raw response preview: ${response:0:200}...${NC}" >&2
            
            # Extract version tags using jq if available, otherwise use grep
            if command -v jq >/dev/null 2>&1; then
                # Use jq for proper JSON parsing
                latest_version=$(echo "$response" | jq -r '.results[] | select(.name | test("^[0-9]+\\.[0-9]+\\.[0-9]+$")) | .name' | sort -V | tail -1)
            else
                # Fallback to grep parsing
                latest_version=$(echo "$response" | grep -o '"name":"[^"]*"' | sed 's/"name":"//g' | sed 's/"//g' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1)
            fi
            
            if [ -n "$latest_version" ]; then
                echo -e "${GREEN}  ✅ Found ${image_name}: ${latest_version}${NC}" >&2
            else
                echo -e "${YELLOW}  ⚠️  No version tags found for ${image_name}${NC}" >&2
                # Debug: Show all available tags
                echo -e "${BLUE}  📋 Available tags: $(echo "$response" | grep -o '"name":"[^"]*"' | sed 's/"name":"//g' | sed 's/"//g' | head -10 | tr '\n' ' ')${NC}" >&2
            fi
        else
            echo -e "${YELLOW}  ⚠️  Could not fetch tags for ${image_name}${NC}" >&2
        fi
    else
        echo -e "${YELLOW}  ⚠️  curl not available, skipping ${image_name}${NC}" >&2
    fi
    
    echo "$latest_version"
}

get_current_running_version() {
    local current_version=""
    
    # Try to get version from currently running containers
    if command -v docker >/dev/null 2>&1; then
        # Check if we have any running GlowWorm containers (including dev containers)
        local running_containers=$(docker ps --format "table {{.Names}}\t{{.Image}}" | grep -i glowworm | head -1)
        
        if [ -n "$running_containers" ]; then
            # Extract version from image tag
            local image_tag=$(echo "$running_containers" | awk '{print $2}' | cut -d: -f2)
            
            # Check if it's a version number (not 'latest')
            if [[ "$image_tag" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                current_version="$image_tag"
                echo -e "${GREEN}  ✅ Found running version: ${current_version}${NC}" >&2
            else
                echo -e "${YELLOW}  ⚠️  Running containers use '${image_tag}' tag, not a version number${NC}" >&2
            fi
        else
            echo -e "${YELLOW}  ⚠️  No running GlowWorm containers found${NC}" >&2
        fi
    else
        echo -e "${YELLOW}  ⚠️  Docker not available${NC}" >&2
    fi
    
    echo "$current_version"
}

# Handle custom version or auto-detect
if [ -n "$CUSTOM_VERSION" ]; then
    VERSION="$CUSTOM_VERSION"
    echo -e "${YELLOW}📦 Using custom version: ${VERSION}${NC}"
else
    # Try to get latest version from Docker Hub
    echo -e "${BLUE}🔍 Checking latest version from Docker Hub...${NC}"
    
    # Try simple method first
    LATEST_BACKEND_VERSION=$(get_latest_version_simple "glowworm-backend")
    LATEST_FRONTEND_VERSION=$(get_latest_version_simple "glowworm-frontend")
    
    # If simple method didn't work, try the detailed method
    if [ -z "$LATEST_BACKEND_VERSION" ] || [ -z "$LATEST_FRONTEND_VERSION" ]; then
        echo -e "${BLUE}🔍 Trying detailed version detection...${NC}"
        if [ -z "$LATEST_BACKEND_VERSION" ]; then
            LATEST_BACKEND_VERSION=$(get_latest_version_from_hub "glowworm-backend")
        fi
        if [ -z "$LATEST_FRONTEND_VERSION" ]; then
            LATEST_FRONTEND_VERSION=$(get_latest_version_from_hub "glowworm-frontend")
        fi
    fi

    # Use the latest version found, or fall back to current running version
    if [ -n "$LATEST_BACKEND_VERSION" ] && [ -n "$LATEST_FRONTEND_VERSION" ]; then
        # Use the higher of the two versions
        if [ "$LATEST_BACKEND_VERSION" \> "$LATEST_FRONTEND_VERSION" ]; then
            BASE_VERSION="$LATEST_BACKEND_VERSION"
        else
            BASE_VERSION="$LATEST_FRONTEND_VERSION"
        fi
        echo -e "${GREEN}✅ Found latest version: ${BASE_VERSION}${NC}"
    elif [ -n "$LATEST_BACKEND_VERSION" ]; then
        BASE_VERSION="$LATEST_BACKEND_VERSION"
        echo -e "${GREEN}✅ Found backend version: ${BASE_VERSION}${NC}"
    elif [ -n "$LATEST_FRONTEND_VERSION" ]; then
        BASE_VERSION="$LATEST_FRONTEND_VERSION"
        echo -e "${GREEN}✅ Found frontend version: ${BASE_VERSION}${NC}"
    else
        # Fall back to checking current running version
        echo -e "${BLUE}🔍 Checking current running version...${NC}"
        CURRENT_VERSION=$(get_current_running_version)
        
        if [ -n "$CURRENT_VERSION" ]; then
            BASE_VERSION="$CURRENT_VERSION"
            echo -e "${YELLOW}⚠️  Using current running version: ${BASE_VERSION}${NC}"
        else
            BASE_VERSION="1.0.0"
            echo -e "${YELLOW}⚠️  No version found, using default: ${BASE_VERSION}${NC}"
        fi
    fi

    # Increment the version
    increment_version() {
        local version="$1"
        local major=$(echo "$version" | cut -d. -f1)
        local minor=$(echo "$version" | cut -d. -f2)
        local patch=$(echo "$version" | cut -d. -f3)
        
        # Increment patch version
        patch=$((patch + 1))
        echo "${major}.${minor}.${patch}"
    }

    # Validate BASE_VERSION
    if [ -z "$BASE_VERSION" ]; then
        echo -e "${RED}❌ Error: BASE_VERSION is empty!${NC}"
        exit 1
    fi
    
    VERSION=$(increment_version "$BASE_VERSION")
    echo -e "${YELLOW}📦 New version: ${VERSION}${NC}"
fi

# Update package.json version to match Docker version (always, regardless of --version flag)
echo -e "${BLUE}📝 Updating package.json version to ${VERSION}...${NC}"
if [ -f "../frontend/package.json" ]; then
    # Use sed to update the version in package.json
    sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"${VERSION}\"/" ../frontend/package.json
    echo -e "${GREEN}✅ Updated frontend/package.json to version ${VERSION}${NC}"
else
    echo -e "${YELLOW}⚠️  frontend/package.json not found, skipping version update${NC}"
fi

# Docker Hub username
# Docker username is already set at the top
echo -e "${YELLOW}🐳 Docker Username: ${DOCKER_USERNAME}${NC}"

if [ "$PUSH_TO_HUB" = true ]; then
    echo -e "${YELLOW}📤 Will push :latest and :VERSION to Docker Hub (production)${NC}"
elif [ "$PUSH_TEST" = true ]; then
    echo -e "${YELLOW}📤 Will push :test to Docker Hub (unstable branch)${NC}"
elif [ "$LOCAL_ONLY" = true ]; then
    echo -e "${YELLOW}🏠 Local build only${NC}"
else
    echo -e "${YELLOW}🏠 Local build (use --push or --push-test to push to hub)${NC}"
fi

echo ""

# Build backend image
echo -e "${BLUE}🔨 Building backend image...${NC}"
cd ..
docker build -f Dockerfile.backend -t ${DOCKER_USERNAME}/glowworm-backend:latest .
docker tag ${DOCKER_USERNAME}/glowworm-backend:latest ${DOCKER_USERNAME}/glowworm-backend:${VERSION}
docker tag ${DOCKER_USERNAME}/glowworm-backend:latest ${DOCKER_USERNAME}/glowworm-backend:test
# Create local tags for development environment
docker tag ${DOCKER_USERNAME}/glowworm-backend:latest glowworm-backend-local
echo -e "${GREEN}✅ Backend image built${NC}"

# Build frontend image
echo -e "${BLUE}🔨 Building frontend image...${NC}"
docker build -f Dockerfile.frontend -t ${DOCKER_USERNAME}/glowworm-frontend:latest .
docker tag ${DOCKER_USERNAME}/glowworm-frontend:latest ${DOCKER_USERNAME}/glowworm-frontend:${VERSION}
docker tag ${DOCKER_USERNAME}/glowworm-frontend:latest ${DOCKER_USERNAME}/glowworm-frontend:test
# Create local tags for development environment
docker tag ${DOCKER_USERNAME}/glowworm-frontend:latest glowworm-frontend-local
echo -e "${GREEN}✅ Frontend image built${NC}"

# Push to Docker Hub if requested
if [ "$PUSH_TO_HUB" = true ]; then
    echo -e "${BLUE}📤 Pushing production images to Docker Hub...${NC}"
    
    # Push backend
    echo -e "${YELLOW}📤 Pushing backend...${NC}"
    docker push ${DOCKER_USERNAME}/glowworm-backend:latest
    docker push ${DOCKER_USERNAME}/glowworm-backend:${VERSION}
    
    # Push frontend
    echo -e "${YELLOW}📤 Pushing frontend...${NC}"
    docker push ${DOCKER_USERNAME}/glowworm-frontend:latest
    docker push ${DOCKER_USERNAME}/glowworm-frontend:${VERSION}
    
    echo -e "${GREEN}✅ Production images pushed to Docker Hub${NC}"
    echo -e "${BLUE}  Tags: :latest, :${VERSION}${NC}"
fi

# Push test tags for unstable branch if requested
if [ "$PUSH_TEST" = true ]; then
    echo -e "${BLUE}📤 Pushing :test tags to Docker Hub (unstable branch)...${NC}"
    
    # Push backend :test
    echo -e "${YELLOW}📤 Pushing backend:test...${NC}"
    docker push ${DOCKER_USERNAME}/glowworm-backend:test
    
    # Push frontend :test
    echo -e "${YELLOW}📤 Pushing frontend:test...${NC}"
    docker push ${DOCKER_USERNAME}/glowworm-frontend:test
    
    echo -e "${GREEN}✅ Test images pushed to Docker Hub${NC}"
    echo -e "${BLUE}  Tags: :test (for unstable branch testing)${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Build complete!${NC}"
echo -e "${BLUE}📋 Images created locally:${NC}"
echo "  - ${DOCKER_USERNAME}/glowworm-backend:latest"
echo "  - ${DOCKER_USERNAME}/glowworm-backend:${VERSION}"
echo "  - ${DOCKER_USERNAME}/glowworm-backend:test"
echo "  - ${DOCKER_USERNAME}/glowworm-frontend:latest"
echo "  - ${DOCKER_USERNAME}/glowworm-frontend:${VERSION}"
echo "  - ${DOCKER_USERNAME}/glowworm-frontend:test"
echo "  - glowworm-backend-local (for docker-publish dev)"
echo "  - glowworm-frontend-local (for docker-publish dev)"

if [ "$PUSH_TO_HUB" = true ]; then
    echo ""
    echo -e "${GREEN}🚀 Production images (:latest, :${VERSION}) pushed to Docker Hub!${NC}"
fi

if [ "$PUSH_TEST" = true ]; then
    echo ""
    echo -e "${GREEN}🧪 Test images (:test) pushed to Docker Hub!${NC}"
    echo -e "${BLUE}  Ready for unstable branch testing${NC}"
fi
