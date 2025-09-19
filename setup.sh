#!/bin/bash

# GlowWorm Setup Script
echo "🔧 Setting up GlowWorm Development Environment..."

# Setup backend
echo "📦 Setting up backend..."
cd backend

# Copy settings template if settings.json doesn't exist
if [ ! -f "config/settings.json" ]; then
    echo "Creating settings.json from template..."
    cp config/settings.json.example config/settings.json
    echo "⚠️  Please configure config/settings.json with your database credentials before first run"
fi

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment and install dependencies
echo "Installing backend dependencies..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

cd ..

# Setup frontend
echo "📦 Setting up frontend..."
cd frontend

# Install dependencies
echo "Installing frontend dependencies..."
npm install

cd ..

echo "✅ Setup complete!"
echo ""
echo "To start development:"
echo "  ./start_dev.sh"
echo ""
echo "Or start individually:"
echo "  Backend:  cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8001"
echo "  Frontend: cd frontend && PORT=3003 npm start"
echo ""
echo "Access points:"
echo "  Frontend: http://localhost:3003"
echo "  Backend:  http://localhost:8001"
echo "  API Docs: http://localhost:8001/docs"
