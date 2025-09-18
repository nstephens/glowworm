from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Request
from sqlalchemy.orm import Session
import json
import logging
from typing import Optional

from models.database import get_db
from models.display_device import DisplayDevice
from services.display_device_service import DisplayDeviceService
from utils.cookies import cookie_manager
from utils.middleware import get_current_user
from .manager import connection_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["websocket"])

@router.websocket("/device")
async def websocket_device_endpoint(websocket: WebSocket):
    """WebSocket endpoint for display devices"""
    connection_id = None
    device_token = None
    
    try:
        # Accept the WebSocket connection first
        await websocket.accept()
        
        # Get request information from WebSocket
        headers = dict(websocket.headers)
        origin = headers.get("origin")
        
        # Allow all origins for dynamic IP access (production should be more restrictive)
        # In production, you might want to validate against a whitelist or use proper authentication
        if origin:
            logger.info(f"Device WebSocket connection from origin: {origin}")
        else:
            logger.info("Device WebSocket connection without origin header")
        
        # Get device token from cookie
        cookie_header = headers.get("cookie", "")
        device_token = None
        if cookie_header:
            for cookie in cookie_header.split(";"):
                if "glowworm_display=" in cookie:
                    device_token = cookie.split("glowworm_display=")[1].strip()
                    break
        if not device_token:
            logger.warning("WebSocket connection attempt without device token")
            await websocket.close(code=1008, reason="Device not registered")
            return
        
        # Connect the device
        connection_id = await connection_manager.connect(
            websocket, 
            connection_type="device", 
            device_token=device_token
        )
        
        logger.info(f"Device WebSocket connected: {device_token[:8]}...")
        
        # Send initial status
        await websocket.send_text(json.dumps({
            "type": "connection_established",
            "device_token": device_token[:8] + "...",
            "timestamp": connection_manager.connection_metadata[connection_id]["connected_at"].isoformat()
        }))
        
        # Main message loop
        while True:
            try:
                # Receive message from device
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Handle different message types
                await handle_device_message(connection_id, device_token, message)
                
            except WebSocketDisconnect:
                logger.info(f"Device WebSocket disconnected: {device_token[:8]}...")
                break
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON from device {device_token[:8]}...")
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON format"
                }))
            except Exception as e:
                logger.error(f"Error handling device message: {e}")
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Internal server error"
                }))
                
    except Exception as e:
        logger.error(f"Device WebSocket error: {e}")
    finally:
        if connection_id:
            connection_manager.disconnect(connection_id)

@router.websocket("/admin")
async def websocket_admin_endpoint(websocket: WebSocket):
    """WebSocket endpoint for admin clients"""
    connection_id = None
    
    try:
        # Accept the WebSocket connection first
        await websocket.accept()
        
        # Get request information from WebSocket
        headers = dict(websocket.headers)
        origin = headers.get("origin")
        
        # Allow all origins for dynamic IP access (production should be more restrictive)
        # In production, you might want to validate against a whitelist or use proper authentication
        if origin:
            logger.info(f"Admin WebSocket connection from origin: {origin}")
        else:
            logger.info("Admin WebSocket connection without origin header")
        
        # Note: Admin authentication would be handled here in a real implementation
        # For now, we'll accept all admin connections
        
        # Connect the admin
        connection_id = await connection_manager.connect(
            websocket, 
            connection_type="admin"
        )
        
        logger.info(f"Admin WebSocket connected: {connection_id}")
        
        # Send initial status
        await websocket.send_text(json.dumps({
            "type": "connection_established",
            "connection_id": connection_id,
            "connected_devices": connection_manager.get_connected_devices(),
            "timestamp": connection_manager.connection_metadata[connection_id]["connected_at"].isoformat()
        }))
        
        # Main message loop
        while True:
            try:
                # Receive message from admin
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Handle different message types
                await handle_admin_message(connection_id, message)
                
            except WebSocketDisconnect:
                logger.info(f"Admin WebSocket disconnected: {connection_id}")
                break
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON from admin {connection_id}")
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON format"
                }))
            except Exception as e:
                logger.error(f"Error handling admin message: {e}")
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Internal server error"
                }))
                
    except Exception as e:
        logger.error(f"Admin WebSocket error: {e}")
    finally:
        if connection_id:
            connection_manager.disconnect(connection_id)

async def handle_device_message(connection_id: str, device_token: str, message: dict):
    """Handle messages from display devices"""
    message_type = message.get("type")
    
    if message_type == "heartbeat":
        await connection_manager.handle_heartbeat(connection_id)
        
    elif message_type == "status_update":
        # Device is reporting its status
        status_data = message.get("data", {})
        logger.info(f"Device {device_token[:8]}... status update: {status_data}")
        
        # Broadcast to all admins
        await connection_manager.broadcast_device_status_update({
            "device_token": device_token,
            "status": status_data,
            "timestamp": message.get("timestamp")
        })
        
    elif message_type == "error_report":
        # Device is reporting an error
        error_data = message.get("data", {})
        logger.error(f"Device {device_token[:8]}... error: {error_data}")
        
        # Broadcast to all admins
        await connection_manager.send_to_all_admins({
            "type": "device_error",
            "device_token": device_token,
            "error": error_data,
            "timestamp": message.get("timestamp")
        })
        
    else:
        logger.warning(f"Unknown device message type: {message_type}")

async def handle_admin_message(connection_id: str, message: dict):
    """Handle messages from admin clients"""
    message_type = message.get("type")
    
    if message_type == "heartbeat":
        await connection_manager.handle_heartbeat(connection_id)
        
    elif message_type == "authorize_device":
        # Admin wants to authorize a device
        device_token = message.get("device_token")
        device_name = message.get("device_name")
        device_identifier = message.get("device_identifier")
        
        if device_token:
            # This would typically involve database operations
            # For now, we'll just send a response
            await connection_manager.send_to_connection(connection_id, {
                "type": "authorization_result",
                "device_token": device_token,
                "success": True,
                "message": "Device authorization request processed"
            })
            
            # Notify the device
            await connection_manager.send_device_authorization_update(
                device_token, 
                "authorized", 
                {
                    "device_name": device_name,
                    "device_identifier": device_identifier
                }
            )
            
    elif message_type == "reject_device":
        # Admin wants to reject a device
        device_token = message.get("device_token")
        
        if device_token:
            await connection_manager.send_to_connection(connection_id, {
                "type": "rejection_result",
                "device_token": device_token,
                "success": True,
                "message": "Device rejection request processed"
            })
            
            # Notify the device
            await connection_manager.send_device_authorization_update(
                device_token, 
                "rejected", 
                {}
            )
            
    elif message_type == "send_command":
        # Admin wants to send a command to a device
        device_token = message.get("device_token")
        command = message.get("command")
        command_data = message.get("data", {})
        
        if device_token and command:
            await connection_manager.send_device_command(device_token, command, command_data)
            
            await connection_manager.send_to_connection(connection_id, {
                "type": "command_sent",
                "device_token": device_token,
                "command": command,
                "success": True
            })
            
    elif message_type == "update_playlist":
        # Admin wants to update a device's playlist
        device_token = message.get("device_token")
        playlist_data = message.get("playlist_data")
        
        if device_token and playlist_data:
            await connection_manager.send_device_playlist_update(device_token, playlist_data)
            
            await connection_manager.send_to_connection(connection_id, {
                "type": "playlist_update_sent",
                "device_token": device_token,
                "success": True
            })
            
    else:
        logger.warning(f"Unknown admin message type: {message_type}")

# HTTP endpoints for WebSocket management
@router.get("/status")
async def get_websocket_status():
    """Get WebSocket connection status"""
    return {
        "connected_devices": connection_manager.get_device_count(),
        "connected_admins": connection_manager.get_admin_count(),
        "device_tokens": connection_manager.get_connected_devices()
    }

@router.post("/broadcast")
async def broadcast_to_devices(message: dict):
    """Broadcast a message to all connected devices"""
    await connection_manager.send_to_all_devices(message)
    return {"message": "Broadcast sent", "device_count": connection_manager.get_device_count()}

@router.post("/device/{device_token}/command")
async def send_device_command_endpoint(device_token: str, command: str, data: dict = None):
    """Send a command to a specific device via HTTP"""
    await connection_manager.send_device_command(device_token, command, data or {})
    return {
        "message": "Command sent",
        "device_token": device_token,
        "command": command,
        "is_connected": connection_manager.get_device_connection_status(device_token)
    }
