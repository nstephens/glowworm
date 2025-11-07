import asyncio
import json
from typing import Dict, Set, Optional, Any
from fastapi import WebSocket, WebSocketDisconnect
from datetime import datetime, timedelta
import uuid
from utils.logger import get_logger

logger = get_logger(__name__)

class ConnectionManager:
    """Manages WebSocket connections for display devices and admin clients"""
    
    def __init__(self):
        # Active connections by connection ID
        self.active_connections: Dict[str, WebSocket] = {}
        
        # Device connections by device token
        self.device_connections: Dict[str, str] = {}  # device_token -> connection_id
        
        # Admin connections
        self.admin_connections: Set[str] = set()
        
        # Connection metadata
        self.connection_metadata: Dict[str, Dict[str, Any]] = {}
        
        # Heartbeat tracking
        self.last_heartbeat: Dict[str, datetime] = {}
        
        # Message queues for offline devices
        self.message_queues: Dict[str, list] = {}  # device_token -> [messages]
        
    async def connect(self, websocket: WebSocket, connection_type: str, device_token: Optional[str] = None) -> str:
        """Connect a new WebSocket connection (connection should already be accepted)"""
        
        # Generate unique connection ID
        connection_id = str(uuid.uuid4())
        
        # Store connection
        self.active_connections[connection_id] = websocket
        
        # Store metadata
        self.connection_metadata[connection_id] = {
            "type": connection_type,
            "device_token": device_token,
            "connected_at": datetime.now(),
            "last_activity": datetime.now()
        }
        
        # Update heartbeat
        self.last_heartbeat[connection_id] = datetime.now()
        
        if connection_type == "device" and device_token:
            # Store device connection mapping
            self.device_connections[device_token] = connection_id
            
            # Send any queued messages
            if device_token in self.message_queues:
                queued_messages = self.message_queues[device_token]
                for message in queued_messages:
                    await self.send_to_connection(connection_id, message)
                # Clear the queue
                del self.message_queues[device_token]
                
            logger.info(f"Device connected: {device_token[:8]}... (connection: {connection_id})")
            
        elif connection_type == "admin":
            self.admin_connections.add(connection_id)
            logger.info(f"Admin connected: {connection_id}")
        
        return connection_id
    
    def disconnect(self, connection_id: str):
        """Remove a connection"""
        if connection_id in self.active_connections:
            metadata = self.connection_metadata.get(connection_id, {})
            connection_type = metadata.get("type")
            device_token = metadata.get("device_token")
            
            # Remove from active connections
            del self.active_connections[connection_id]
            
            # Remove from type-specific collections
            if connection_type == "device" and device_token:
                if device_token in self.device_connections:
                    del self.device_connections[device_token]
                logger.info(f"Device disconnected: {device_token[:8]}... (connection: {connection_id})")
                
            elif connection_type == "admin":
                self.admin_connections.discard(connection_id)
                logger.info(f"Admin disconnected: {connection_id}")
            
            # Clean up metadata
            if connection_id in self.connection_metadata:
                del self.connection_metadata[connection_id]
            if connection_id in self.last_heartbeat:
                del self.last_heartbeat[connection_id]
    
    async def send_to_connection(self, connection_id: str, message: dict):
        """Send a message to a specific connection"""
        if connection_id in self.active_connections:
            try:
                websocket = self.active_connections[connection_id]
                await websocket.send_text(json.dumps(message))
                
                # Update last activity
                if connection_id in self.connection_metadata:
                    self.connection_metadata[connection_id]["last_activity"] = datetime.now()
                    
            except Exception as e:
                logger.error(f"Failed to send message to connection {connection_id}: {e}")
                # Remove the connection if it's broken
                self.disconnect(connection_id)
    
    async def send_to_device(self, device_token: str, message: dict):
        """Send a message to a specific device"""
        if device_token in self.device_connections:
            connection_id = self.device_connections[device_token]
            await self.send_to_connection(connection_id, message)
        else:
            # Device is offline, queue the message
            if device_token not in self.message_queues:
                self.message_queues[device_token] = []
            self.message_queues[device_token].append(message)
            logger.info(f"Device {device_token[:8]}... is offline, message queued")
    
    async def send_to_all_admins(self, message: dict):
        """Send a message to all admin connections"""
        for connection_id in list(self.admin_connections):
            await self.send_to_connection(connection_id, message)
    
    async def send_to_all_devices(self, message: dict):
        """Send a message to all connected devices"""
        for device_token, connection_id in list(self.device_connections.items()):
            await self.send_to_connection(connection_id, message)
    
    async def broadcast_device_status_update(self, device_data: dict):
        """Broadcast device status update to all admins"""
        message = {
            "type": "device_status_update",
            "data": device_data,
            "timestamp": datetime.now().isoformat()
        }
        await self.send_to_all_admins(message)
    
    async def send_device_authorization_update(self, device_token: str, status: str, device_data: dict):
        """Send authorization update to a specific device"""
        message = {
            "type": "authorization_update",
            "status": status,
            "data": device_data,
            "timestamp": datetime.now().isoformat()
        }
        await self.send_to_device(device_token, message)
    
    async def send_playlist_update_to_device(self, device_token: str, playlist_data: dict):
        """Send playlist update to a specific device"""
        message = {
            "type": "playlist_update",
            "playlist": playlist_data,
            "timestamp": datetime.now().isoformat()
        }
        await self.send_to_device(device_token, message)
    
    async def broadcast_playlist_update(self, playlist_data: dict):
        """Broadcast playlist update to all connected devices"""
        message = {
            "type": "playlist_update",
            "playlist": playlist_data,
            "timestamp": datetime.now().isoformat()
        }
        await self.send_to_all_devices(message)
    
    async def broadcast_image_processing_update(self, event_payload: dict):
        """
        Broadcast image processing status update to all admin connections.
        
        Used for notifying clients about background image processing events
        like thumbnail generation, variant creation, completion, or failures.
        
        Args:
            event_payload: Event dict from websocket.events module
        """
        await self.send_to_all_admins(event_payload)
    
    async def send_device_command(self, device_token: str, command: str, data: dict = None):
        """Send a command to a specific device"""
        message = {
            "type": "command",
            "command": command,
            "data": data or {},
            "timestamp": datetime.now().isoformat()
        }
        await self.send_to_device(device_token, message)
    
    async def send_device_playlist_update(self, device_token: str, playlist_data: dict):
        """Send playlist update to a specific device"""
        message = {
            "type": "playlist_update",
            "data": playlist_data,
            "timestamp": datetime.now().isoformat()
        }
        await self.send_to_device(device_token, message)
    
    def get_connection_info(self, connection_id: str) -> Optional[dict]:
        """Get information about a connection"""
        if connection_id in self.connection_metadata:
            metadata = self.connection_metadata[connection_id].copy()
            metadata["is_connected"] = connection_id in self.active_connections
            return metadata
        return None
    
    def get_device_connection_status(self, device_token: str) -> bool:
        """Check if a device is currently connected"""
        return device_token in self.device_connections
    
    def get_connected_devices(self) -> list:
        """Get list of currently connected device tokens"""
        return list(self.device_connections.keys())
    
    def get_admin_count(self) -> int:
        """Get number of connected admin clients"""
        return len(self.admin_connections)
    
    def get_device_count(self) -> int:
        """Get number of connected devices"""
        return len(self.device_connections)
    
    async def handle_heartbeat(self, connection_id: str):
        """Handle heartbeat from a connection"""
        if connection_id in self.last_heartbeat:
            self.last_heartbeat[connection_id] = datetime.now()
            
            # Send heartbeat response
            await self.send_to_connection(connection_id, {
                "type": "heartbeat_response",
                "timestamp": datetime.now().isoformat()
            })
    
    async def cleanup_stale_connections(self):
        """Remove connections that haven't sent heartbeat in a while"""
        now = datetime.now()
        stale_threshold = timedelta(minutes=5)  # 5 minutes without heartbeat
        
        stale_connections = []
        for connection_id, last_heartbeat in self.last_heartbeat.items():
            if now - last_heartbeat > stale_threshold:
                stale_connections.append(connection_id)
        
        for connection_id in stale_connections:
            logger.warning(f"Removing stale connection: {connection_id}")
            self.disconnect(connection_id)
    
    def _get_websocket_check_interval(self):
        """Get WebSocket check interval from settings"""
        try:
            from services.config_service import config_service
            interval = config_service.display_websocket_check_interval
            # Ensure it's an integer (settings might return string from database)
            return int(interval) if interval is not None else 5
        except Exception:
            return 5  # Fallback to hardcoded value if settings not available

    async def start_heartbeat_cleanup(self):
        """Start periodic cleanup of stale connections"""
        while True:
            try:
                await asyncio.sleep(self._get_websocket_check_interval())  # Check at configurable interval
                await self.cleanup_stale_connections()
            except Exception as e:
                logger.error(f"Error in heartbeat cleanup: {e}")

# Global connection manager instance
connection_manager = ConnectionManager()
