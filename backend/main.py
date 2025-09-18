from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
import os
import logging
from contextlib import asynccontextmanager

from config.settings import settings, is_configured
from api.setup import router as setup_router
from api.auth import router as auth_router
from api.images import router as images_router
from api.albums import router as albums_router
from api.playlists import router as playlists_router
from api.storage import router as storage_router
from api.display_devices import router as display_devices_router
from api.performance import router as performance_router
from api.database_optimization import router as database_optimization_router
from api.cache_management import router as cache_management_router
from api.image_optimization import router as image_optimization_router
from api.slideshow_preload import router as slideshow_preload_router
from api.smart_preload import router as smart_preload_router
from api.settings import router as settings_router
from api.users import router as users_router
from api.migration import router as migration_router
from websocket.endpoints import router as websocket_router
from websocket.manager import connection_manager
from models.database import create_tables
from utils.security_headers import add_security_headers
from utils.performance_middleware import PerformanceMonitoringMiddleware

# Configure logging
from utils.logger import get_logger
logger = get_logger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info("Starting GlowWorm API...")
    
    # Create database tables if configured
    if is_configured():
        try:
            create_tables()
            logger.info("Database tables created/verified successfully")
        except Exception as e:
            logger.error(f"Failed to create database tables: {e}")
    
    # Start WebSocket heartbeat cleanup task
    import asyncio
    heartbeat_task = asyncio.create_task(connection_manager.start_heartbeat_cleanup())
    
    yield
    
    # Shutdown
    logger.info("Shutting down GlowWorm API...")
    
    # Cancel heartbeat task
    heartbeat_task.cancel()
    try:
        await heartbeat_task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title="GlowWorm API",
    description="Digital photo display application API",
    version="0.1.0",
    lifespan=lifespan
)

# Add security headers middleware
add_security_headers(app)

# Add performance monitoring middleware
app.add_middleware(PerformanceMonitoringMiddleware)

# CORS middleware - allow specific origins for dynamic IP access
# In production, you should restrict this to specific domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3003",
        "http://127.0.0.1:3003", 
        "http://10.10.10.2:3003",
        "http://10.10.10.2:3000",  # Fallback port
        "http://localhost:3000",   # Fallback port
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include routers
app.include_router(setup_router)
app.include_router(auth_router)
app.include_router(images_router)
app.include_router(albums_router)
app.include_router(playlists_router)
app.include_router(storage_router)
app.include_router(display_devices_router)
app.include_router(performance_router)
app.include_router(database_optimization_router)
app.include_router(cache_management_router)
app.include_router(image_optimization_router)
app.include_router(slideshow_preload_router)
app.include_router(smart_preload_router)
app.include_router(settings_router)
app.include_router(users_router)
app.include_router(migration_router)
app.include_router(websocket_router)

# Global OPTIONS handler for unmatched routes only (after routers)
# @app.options("/{path:path}")
# async def options_handler(request: Request, path: str):
#     """Handle OPTIONS requests for CORS preflight - only for unmatched routes"""
#     logger.info(f"OPTIONS request received for unmatched path: {path}")
#     return Response(
#         status_code=200,
#         headers={
#             "Access-Control-Allow-Origin": request.headers.get("origin", "http://localhost:3003"),
#             "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH",
#             "Access-Control-Allow-Headers": "*",
#             "Access-Control-Allow-Credentials": "true",
#             "Access-Control-Max-Age": "600",
#         }
#     )

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "GlowWorm API",
        "version": "0.1.0",
        "configured": is_configured()
    }

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "GlowWorm API",
        "version": "0.1.0",
        "docs": "/docs",
        "health": "/health"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=settings.backend_port)
