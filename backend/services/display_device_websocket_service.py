from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
import logging
import asyncio

from models.display_device import DisplayDevice, DeviceStatus
from models.user import User
from websocket.manager import connection_manager

logger = logging.getLogger(__name__)

class DisplayDeviceWebSocketService:
    """Enhanced service for managing display devices with WebSocket integration"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def register_device(self, user_agent: str = None, ip_address: str = None) -> DisplayDevice:
        """Register a new display device and return it with a device token"""
        
        # Check if a device with the same IP and user agent already exists and is active
        if ip_address and user_agent:
            existing_device = self.db.query(DisplayDevice).filter(
                DisplayDevice.ip_address == ip_address,
                DisplayDevice.user_agent == user_agent,
                DisplayDevice.status.in_([DeviceStatus.PENDING, DeviceStatus.AUTHORIZED])
            ).first()
            
            if existing_device:
                # Update the last seen timestamp and return existing device
                existing_device.last_seen = datetime.utcnow()
                self.db.commit()
                self.db.refresh(existing_device)
                logger.info(f"Returning existing device with token: {existing_device.device_token[:8]}... (preventing duplicate)")
                return existing_device
        
        # No existing device found, create a new one
        device_token = DisplayDevice.generate_device_token()
        
        device = DisplayDevice(
            device_token=device_token,
            status=DeviceStatus.PENDING,
            user_agent=user_agent,
            ip_address=ip_address,
            last_seen=datetime.utcnow()
        )
        
        self.db.add(device)
        self.db.commit()
        self.db.refresh(device)
        
        logger.info(f"Registered new display device with token: {device_token[:8]}...")
        
        # Notify admins about new device registration
        asyncio.create_task(self._notify_admins_device_registered(device))
        
        return device
    
    def get_device_by_token(self, device_token: str) -> Optional[DisplayDevice]:
        """Get a display device by its token"""
        return self.db.query(DisplayDevice).filter(
            DisplayDevice.device_token == device_token
        ).first()
    
    def update_device_last_seen(self, device_token: str) -> Optional[DisplayDevice]:
        """Update the last seen timestamp for a device"""
        device = self.get_device_by_token(device_token)
        if device:
            device.last_seen = datetime.utcnow()
            self.db.commit()
            self.db.refresh(device)
            
            # Notify admins about device activity
            asyncio.create_task(self._notify_admins_device_activity(device))
            
        return device
    
    def get_pending_devices(self) -> List[DisplayDevice]:
        """Get all devices waiting for authorization"""
        return self.db.query(DisplayDevice).filter(
            DisplayDevice.status == DeviceStatus.PENDING
        ).order_by(DisplayDevice.created_at.desc()).all()
    
    def get_authorized_devices(self) -> List[DisplayDevice]:
        """Get all authorized devices"""
        return self.db.query(DisplayDevice).filter(
            DisplayDevice.status == DeviceStatus.AUTHORIZED
        ).order_by(DisplayDevice.authorized_at.desc()).all()
    
    def get_all_devices(self) -> List[DisplayDevice]:
        """Get all display devices"""
        return self.db.query(DisplayDevice).order_by(
            DisplayDevice.created_at.desc()
        ).all()
    
    def authorize_device(self, device_id: int, authorized_by_user: User, 
                        device_name: str = None, device_identifier: str = None) -> Optional[DisplayDevice]:
        """Authorize a display device"""
        device = self.db.query(DisplayDevice).filter(DisplayDevice.id == device_id).first()
        if not device:
            return None
        
        device.status = DeviceStatus.AUTHORIZED
        device.authorized_by_user_id = authorized_by_user.id
        device.authorized_at = datetime.utcnow()
        
        if device_name:
            device.device_name = device_name
        if device_identifier:
            device.device_identifier = device_identifier
        
        self.db.commit()
        self.db.refresh(device)
        
        logger.info(f"Authorized device {device_id} by user {authorized_by_user.username}")
        
        # Notify the device via WebSocket
        asyncio.create_task(self._notify_device_authorization(device, "authorized"))
        
        # Notify admins
        asyncio.create_task(self._notify_admins_device_authorized(device, authorized_by_user))
        
        return device
    
    def reject_device(self, device_id: int, rejected_by_user: User) -> Optional[DisplayDevice]:
        """Reject a display device"""
        device = self.db.query(DisplayDevice).filter(DisplayDevice.id == device_id).first()
        if not device:
            return None
        
        device.status = DeviceStatus.REJECTED
        device.authorized_by_user_id = rejected_by_user.id
        device.authorized_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(device)
        
        logger.info(f"Rejected device {device_id} by user {rejected_by_user.username}")
        
        # Notify the device via WebSocket
        asyncio.create_task(self._notify_device_authorization(device, "rejected"))
        
        # Notify admins
        asyncio.create_task(self._notify_admins_device_rejected(device, rejected_by_user))
        
        return device
    
    def update_device_info(self, device_id: int, device_name: str = None, 
                          device_identifier: str = None) -> Optional[DisplayDevice]:
        """Update device name and identifier"""
        device = self.db.query(DisplayDevice).filter(DisplayDevice.id == device_id).first()
        if not device:
            return None
        
        if device_name is not None:
            device.device_name = device_name
        if device_identifier is not None:
            device.device_identifier = device_identifier
        
        self.db.commit()
        self.db.refresh(device)
        
        logger.info(f"Updated device {device_id} info")
        
        # Notify admins about device update
        asyncio.create_task(self._notify_admins_device_updated(device))
        
        return device
    
    def delete_device(self, device_id: int) -> bool:
        """Delete a display device"""
        device = self.db.query(DisplayDevice).filter(DisplayDevice.id == device_id).first()
        if not device:
            return False
        
        device_token = device.device_token
        
        self.db.delete(device)
        self.db.commit()
        
        logger.info(f"Deleted device {device_id}")
        
        # Notify admins about device deletion
        asyncio.create_task(self._notify_admins_device_deleted(device_token, device_id))
        
        return True
    
    def set_device_playlist(self, device_id: int, playlist_id: int) -> Optional[DisplayDevice]:
        """Set a playlist for a device"""
        device = self.db.query(DisplayDevice).filter(DisplayDevice.id == device_id).first()
        if not device:
            return None
        
        # Note: This would require adding a playlist_id field to the DisplayDevice model
        # For now, we'll just notify via WebSocket
        
        # Notify the device about playlist change
        asyncio.create_task(self._notify_device_playlist_update(device, playlist_id))
        
        return device
    
    async def send_device_command(self, device_token: str, command: str, data: dict = None):
        """Send a command to a specific device"""
        await connection_manager.send_device_command(device_token, command, data or {})
    
    async def broadcast_to_all_devices(self, message: dict):
        """Broadcast a message to all connected devices"""
        await connection_manager.send_to_all_devices(message)
    
    async def _notify_admins_device_registered(self, device: DisplayDevice):
        """Notify admins about a new device registration"""
        try:
            await connection_manager.send_to_all_admins({
                "type": "device_registered",
                "data": device.to_dict(),
                "timestamp": datetime.utcnow().isoformat()
            })
        except Exception as e:
            logger.error(f"Failed to notify admins about device registration: {e}")
    
    async def _notify_admins_device_activity(self, device: DisplayDevice):
        """Notify admins about device activity"""
        try:
            await connection_manager.send_to_all_admins({
                "type": "device_activity",
                "data": {
                    "device_token": device.device_token,
                    "last_seen": device.last_seen.isoformat(),
                    "status": device.status.value
                },
                "timestamp": datetime.utcnow().isoformat()
            })
        except Exception as e:
            logger.error(f"Failed to notify admins about device activity: {e}")
    
    async def _notify_device_authorization(self, device: DisplayDevice, status: str):
        """Notify device about authorization status change"""
        try:
            await connection_manager.send_device_authorization_update(
                device.device_token,
                status,
                device.to_dict()
            )
        except Exception as e:
            logger.error(f"Failed to notify device about authorization: {e}")
    
    async def _notify_admins_device_authorized(self, device: DisplayDevice, authorized_by: User):
        """Notify admins about device authorization"""
        try:
            await connection_manager.send_to_all_admins({
                "type": "device_authorized",
                "data": {
                    "device": device.to_dict(),
                    "authorized_by": {
                        "id": authorized_by.id,
                        "username": authorized_by.username
                    }
                },
                "timestamp": datetime.utcnow().isoformat()
            })
        except Exception as e:
            logger.error(f"Failed to notify admins about device authorization: {e}")
    
    async def _notify_admins_device_rejected(self, device: DisplayDevice, rejected_by: User):
        """Notify admins about device rejection"""
        try:
            await connection_manager.send_to_all_admins({
                "type": "device_rejected",
                "data": {
                    "device": device.to_dict(),
                    "rejected_by": {
                        "id": rejected_by.id,
                        "username": rejected_by.username
                    }
                },
                "timestamp": datetime.utcnow().isoformat()
            })
        except Exception as e:
            logger.error(f"Failed to notify admins about device rejection: {e}")
    
    async def _notify_admins_device_updated(self, device: DisplayDevice):
        """Notify admins about device update"""
        try:
            await connection_manager.send_to_all_admins({
                "type": "device_updated",
                "data": device.to_dict(),
                "timestamp": datetime.utcnow().isoformat()
            })
        except Exception as e:
            logger.error(f"Failed to notify admins about device update: {e}")
    
    async def _notify_admins_device_deleted(self, device_token: str, device_id: int):
        """Notify admins about device deletion"""
        try:
            await connection_manager.send_to_all_admins({
                "type": "device_deleted",
                "data": {
                    "device_token": device_token,
                    "device_id": device_id
                },
                "timestamp": datetime.utcnow().isoformat()
            })
        except Exception as e:
            logger.error(f"Failed to notify admins about device deletion: {e}")
    
    async def _notify_device_playlist_update(self, device: DisplayDevice, playlist_id: int):
        """Notify device about playlist update"""
        try:
            await connection_manager.send_device_playlist_update(
                device.device_token,
                {"playlist_id": playlist_id}
            )
        except Exception as e:
            logger.error(f"Failed to notify device about playlist update: {e}")





