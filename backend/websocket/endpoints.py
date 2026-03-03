from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
import json
import logging
from datetime import datetime
from typing import Optional

from models.database import get_db, ensure_database_initialized
import models.database
from models.display_device import DisplayDevice
from models.device_daemon_status import DeviceDaemonStatus, DaemonStatus
from services.display_device_service import DisplayDeviceService
from utils.cookies import cookie_manager
from utils.middleware import get_current_user
from .manager import connection_manager
from .device_status_cache import (
    store_device_status,
    remove_device_status,
    get_device_status,
    get_all_device_statuses,
    get_online_device_tokens,
)

logger = logging.getLogger(__name__)


async def update_device_cec_status(device_token: str, cec_info: dict) -> None:
    """
    Update CEC availability and devices in the database for a device.

    Args:
        device_token: The device's authentication token
        cec_info: Dict containing 'available' and 'devices' keys
    """
    try:
        ensure_database_initialized()
        db = models.database.SessionLocal()
        try:
            # Find the device by token
            device = db.query(DisplayDevice).filter(
                DisplayDevice.device_token == device_token
            ).first()

            if not device:
                logger.warning(f"Device not found for token: {device_token[:8]}...")
                return

            # Get or create daemon status
            daemon_status = db.query(DeviceDaemonStatus).filter(
                DeviceDaemonStatus.device_id == device.id
            ).first()

            if daemon_status:
                # Update existing status
                daemon_status.cec_available = cec_info.get('available', False)
                daemon_status.cec_devices = cec_info.get('devices', [])
                daemon_status.last_heartbeat = datetime.now()
                daemon_status.daemon_status = DaemonStatus.ONLINE
            else:
                # Create new daemon status
                daemon_status = DeviceDaemonStatus(
                    device_id=device.id,
                    daemon_version="3.0.0",
                    capabilities={"cec_control": cec_info.get('available', False)},
                    cec_available=cec_info.get('available', False),
                    cec_devices=cec_info.get('devices', []),
                    daemon_status=DaemonStatus.ONLINE,
                    last_heartbeat=datetime.now(),
                )
                db.add(daemon_status)

            db.commit()
            logger.debug(f"Updated CEC status for device {device_token[:8]}...: available={cec_info.get('available')}")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Failed to update CEC status for device {device_token[:8]}...: {e}")

router = APIRouter(prefix="/api/ws", tags=["websocket"])

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
        if device_token:
            # Remove status from Redis on disconnect
            remove_device_status(device_token)

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
    """Handle messages from display devices (both legacy and Pi3D daemon)"""
    message_type = message.get("type")
    payload = message.get("payload", message.get("data", {}))

    if message_type == "heartbeat":
        await connection_manager.handle_heartbeat(connection_id)
        # Send heartbeat_ack for Pi3D daemon compatibility
        await connection_manager.send_to_connection(connection_id, {
            "type": "heartbeat_ack",
            "payload": {
                "timestamp": datetime.now().isoformat()
            }
        })

    elif message_type == "auth":
        # Pi3D daemon authentication - device already connected via cookie
        # Acknowledge auth success
        await connection_manager.send_to_connection(connection_id, {
            "type": "auth_success",
            "payload": {
                "device_token": device_token[:8] + "...",
                "timestamp": datetime.now().isoformat()
            }
        })
        logger.info(f"Pi3D daemon authenticated: {device_token[:8]}...")

    elif message_type == "status":
        # Pi3D daemon status report (new format)
        logger.debug(f"Device {device_token[:8]}... status: state={payload.get('state')}")

        # Store status in Redis for quick access
        store_device_status(device_token, payload)

        # Update CEC info in database if present
        cec_info = payload.get('cec')
        if cec_info:
            await update_device_cec_status(device_token, cec_info)

        # Broadcast to all admins with full status
        await connection_manager.broadcast_device_status_update({
            "device_token": device_token,
            "status": payload,
            "timestamp": datetime.now().isoformat()
        })

    elif message_type == "status_update":
        # Legacy browser device status update
        logger.info(f"Device {device_token[:8]}... legacy status update: {payload}")

        # Store status in Redis
        store_device_status(device_token, payload)

        # Broadcast to all admins
        await connection_manager.broadcast_device_status_update({
            "device_token": device_token,
            "status": payload,
            "timestamp": message.get("timestamp", datetime.now().isoformat())
        })

    elif message_type == "command_response":
        # Pi3D daemon command response
        logger.debug(
            f"Device {device_token[:8]}... command response: "
            f"{payload.get('command')} -> {payload.get('status')}"
        )

        # Broadcast command response to admins
        await connection_manager.send_to_all_admins({
            "type": "device_command_response",
            "device_token": device_token,
            "response": payload,
            "timestamp": datetime.now().isoformat()
        })

    elif message_type == "error_report":
        # Device is reporting an error
        logger.error(f"Device {device_token[:8]}... error: {payload}")

        # Broadcast to all admins
        await connection_manager.send_to_all_admins({
            "type": "device_error",
            "device_token": device_token,
            "error": payload,
            "timestamp": message.get("timestamp", datetime.now().isoformat())
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
        request_id = message.get("request_id")

        if device_token and command:
            await connection_manager.send_device_command(
                device_token, command, command_data, request_id
            )

            await connection_manager.send_to_connection(connection_id, {
                "type": "command_sent",
                "device_token": device_token,
                "command": command,
                "request_id": request_id,
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
async def send_device_command_endpoint(
    device_token: str,
    command: str = Query(..., description="Command to send to device (e.g., 'next', 'pause', 'resume')"),
    data: dict = None,
    request_id: str = Query(None, description="Optional request ID for tracking command response"),
):
    """Send a command to a specific device via HTTP"""
    logger.info(f"Sending command '{command}' to device {device_token[:8]}...")
    await connection_manager.send_device_command(device_token, command, data or {}, request_id)
    return {
        "message": "Command sent",
        "device_token": device_token,
        "command": command,
        "request_id": request_id,
        "is_connected": connection_manager.get_device_connection_status(device_token)
    }


@router.get("/device/{device_token}/status")
async def get_device_status_endpoint(device_token: str):
    """Get cached status for a specific device"""
    status = get_device_status(device_token)
    is_connected = connection_manager.get_device_connection_status(device_token)

    return {
        "device_token": device_token,
        "is_connected": is_connected,
        "status": status,
    }


@router.get("/devices/status")
async def get_all_devices_status_endpoint():
    """Get cached status for all online devices"""
    statuses = get_all_device_statuses()
    connected_tokens = connection_manager.get_connected_devices()
    online_tokens = get_online_device_tokens()

    return {
        "connected_count": len(connected_tokens),
        "online_count": len(online_tokens),
        "devices": [
            {
                "device_token": token,
                "is_connected": token in connected_tokens,
                "status": status,
            }
            for token, status in statuses.items()
        ]
    }
