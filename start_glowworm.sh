#!/bin/bash

# GlowWorm Development Startup Script
echo "🚀 Starting GlowWorm Development Environment..."

# Check if virtual environment exists
if [ ! -d "backend/venv" ]; then
    echo "❌ Backend virtual environment not found. Please run setup first."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "frontend/node_modules" ]; then
    echo "❌ Frontend dependencies not installed. Please run setup first."
    exit 1
fi

# Kill any existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f uvicorn 2>/dev/null || true
pkill -f vite 2>/dev/null || true
sleep 1

echo "✅ Starting backend server on port 8001..."
cd backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8001 &
BACKEND_PID=$!

echo "✅ Starting frontend development server on port 3003..."
cd ../frontend
npm run dev -- --host 0.0.0.0 --port 3003 &
FRONTEND_PID=$!

echo "🎉 Development servers started!"
echo "📱 Frontend: http://localhost:3003 (or http://0.0.0.0:3003)"
echo "🔧 Backend API: http://localhost:8001 (or http://0.0.0.0:8001)"
echo "📚 API Docs: http://localhost:8001/docs"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for user to stop
wait

# Cleanup on exit
echo "🛑 Stopping servers..."
kill $BACKEND_PID 2>/dev/null
kill $FRONTEND_PID 2>/dev/null
echo "✅ Servers stopped"
