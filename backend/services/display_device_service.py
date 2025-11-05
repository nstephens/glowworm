from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
import logging

from models.display_device import DisplayDevice, DeviceStatus
from models.user import User

logger = logging.getLogger(__name__)

class DisplayDeviceService:
    """Service for managing display devices and their authorization"""
    
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
        return device
    
    def get_device_by_token(self, device_token: str) -> Optional[DisplayDevice]:
        """Get a display device by its token"""
        return self.db.query(DisplayDevice).filter(
            DisplayDevice.device_token == device_token
        ).first()
    
    def get_device_by_id(self, device_id: int) -> Optional[DisplayDevice]:
        """Get a display device by its ID"""
        return self.db.query(DisplayDevice).filter(DisplayDevice.id == device_id).first()
    
    def update_device_last_seen(self, device_token: str) -> Optional[DisplayDevice]:
        """Update the last seen timestamp for a device"""
        device = self.get_device_by_token(device_token)
        if device:
            device.last_seen = datetime.utcnow()
            self.db.commit()
            self.db.refresh(device)
        return device
    
    def update_device_resolution(self, device_token: str, screen_width: int, screen_height: int, device_pixel_ratio: str = "1.0") -> Optional[DisplayDevice]:
        """Update device resolution information"""
        device = self.get_device_by_token(device_token)
        if device:
            device.screen_width = screen_width
            device.screen_height = screen_height
            device.device_pixel_ratio = device_pixel_ratio
            device.last_seen = datetime.utcnow()
            self.db.commit()
            self.db.refresh(device)
            logger.info(f"Updated device {device_token[:8]}... resolution: {screen_width}x{screen_height} (DPR: {device_pixel_ratio})")
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
        return device
    
    def delete_device(self, device_id: int) -> bool:
        """Delete a display device and all related logs"""
        device = self.db.query(DisplayDevice).filter(DisplayDevice.id == device_id).first()
        if not device:
            return False
        
        # Delete all related device logs first to avoid foreign key constraint error
        from models.device_log import DeviceLog
        logs_count = self.db.query(DeviceLog).filter(DeviceLog.device_id == device_id).delete()
        logger.info(f"Deleted {logs_count} logs for device {device_id}")
        
        self.db.delete(device)
        self.db.commit()
        
        logger.info(f"Deleted device {device_id}")
        return True
    
    def assign_playlist_to_device(self, device_id: int, playlist_id: Optional[int] = None) -> Optional[DisplayDevice]:
        """Assign a playlist to a display device"""
        device = self.get_device_by_id(device_id)
        if not device:
            return None
        
        # Validate playlist exists if provided
        if playlist_id is not None:
            from models.playlist import Playlist
            playlist = self.db.query(Playlist).filter(Playlist.id == playlist_id).first()
            if not playlist:
                logger.warning(f"Playlist {playlist_id} not found")
                return None
        
        device.playlist_id = playlist_id
        self.db.commit()
        self.db.refresh(device)
        
        logger.info(f"Assigned playlist {playlist_id} to device {device_id}")
        return device