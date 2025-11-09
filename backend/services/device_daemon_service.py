"""
Device Daemon Service Layer
Handles business logic for daemon status and command management
"""
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import logging

from models.device_daemon_status import DeviceDaemonStatus, DaemonStatus
from models.device_command import DeviceCommand, CommandType, CommandStatus
from models.display_device import DisplayDevice

logger = logging.getLogger(__name__)


class DeviceDaemonService:
    """Service for managing device daemon operations"""
    
    @staticmethod
    def register_daemon(
        db: Session,
        device_id: int,
        daemon_version: str,
        capabilities: Dict[str, bool],
    ) -> DeviceDaemonStatus:
        """
        Register or update daemon for a device
        
        Args:
            db: Database session
            device_id: Display device ID
            daemon_version: Daemon version string
            capabilities: Dict of daemon capabilities
        
        Returns:
            DeviceDaemonStatus instance
        """
        # Check if daemon status already exists
        daemon_status = db.query(DeviceDaemonStatus).filter(
            DeviceDaemonStatus.device_id == device_id
        ).first()
        
        if daemon_status:
            # Update existing
            daemon_status.daemon_version = daemon_version
            daemon_status.capabilities = capabilities
            daemon_status.daemon_status = DaemonStatus.ONLINE
            daemon_status.last_heartbeat = datetime.now()
            logger.info(f"Updated daemon registration for device {device_id}")
        else:
            # Create new
            daemon_status = DeviceDaemonStatus(
                device_id=device_id,
                daemon_version=daemon_version,
                capabilities=capabilities,
                daemon_status=DaemonStatus.ONLINE,
                last_heartbeat=datetime.now(),
            )
            db.add(daemon_status)
            logger.info(f"Registered new daemon for device {device_id}")
        
        db.commit()
        db.refresh(daemon_status)
        return daemon_status
    
    @staticmethod
    def update_heartbeat(
        db: Session,
        device_id: int,
        system_info: Optional[Dict[str, Any]] = None,
    ) -> Optional[DeviceDaemonStatus]:
        """
        Update daemon heartbeat
        
        Args:
            db: Database session
            device_id: Display device ID
            system_info: Optional system information to store
        
        Returns:
            DeviceDaemonStatus instance or None
        """
        daemon_status = db.query(DeviceDaemonStatus).filter(
            DeviceDaemonStatus.device_id == device_id
        ).first()
        
        if daemon_status:
            daemon_status.last_heartbeat = datetime.now()
            daemon_status.daemon_status = DaemonStatus.ONLINE
            
            # Optionally update CEC info from system_info
            if system_info:
                if 'cec_available' in system_info:
                    daemon_status.cec_available = system_info['cec_available']
                if 'cec_devices' in system_info:
                    daemon_status.cec_devices = system_info['cec_devices']
            
            db.commit()
            db.refresh(daemon_status)
            logger.debug(f"Updated heartbeat for device {device_id}")
            return daemon_status
        
        logger.warning(f"No daemon status found for device {device_id}")
        return None
    
    @staticmethod
    def get_daemon_status(
        db: Session,
        device_id: int,
    ) -> Optional[DeviceDaemonStatus]:
        """Get daemon status for device"""
        return db.query(DeviceDaemonStatus).filter(
            DeviceDaemonStatus.device_id == device_id
        ).first()
    
    @staticmethod
    def get_online_daemons(
        db: Session,
        timeout_minutes: int = 5,
    ) -> List[DeviceDaemonStatus]:
        """
        Get all online daemons
        
        Args:
            db: Database session
            timeout_minutes: Minutes after which daemon is considered offline
        
        Returns:
            List of online daemon statuses
        """
        cutoff_time = datetime.now() - timedelta(minutes=timeout_minutes)
        
        return db.query(DeviceDaemonStatus).filter(
            DeviceDaemonStatus.daemon_status == DaemonStatus.ONLINE,
            DeviceDaemonStatus.last_heartbeat >= cutoff_time,
        ).all()
    
    @staticmethod
    def mark_stale_daemons_offline(
        db: Session,
        timeout_minutes: int = 5,
    ) -> int:
        """
        Mark daemons as offline if they haven't sent heartbeat
        
        Args:
            db: Database session
            timeout_minutes: Minutes after which daemon is considered offline
        
        Returns:
            Number of daemons marked offline
        """
        cutoff_time = datetime.now() - timedelta(minutes=timeout_minutes)
        
        result = db.query(DeviceDaemonStatus).filter(
            DeviceDaemonStatus.daemon_status == DaemonStatus.ONLINE,
            DeviceDaemonStatus.last_heartbeat < cutoff_time,
        ).update(
            {"daemon_status": DaemonStatus.OFFLINE},
            synchronize_session=False
        )
        
        db.commit()
        
        if result > 0:
            logger.info(f"Marked {result} stale daemon(s) as offline")
        
        return result


class DeviceCommandService:
    """Service for managing device commands"""
    
    @staticmethod
    def create_command(
        db: Session,
        device_id: int,
        command_type: CommandType,
        command_data: Optional[Dict[str, Any]] = None,
        created_by_user_id: Optional[int] = None,
    ) -> DeviceCommand:
        """
        Create a new command for a device
        
        Args:
            db: Database session
            device_id: Display device ID
            command_type: Type of command
            command_data: Optional command parameters
            created_by_user_id: User who created the command
        
        Returns:
            DeviceCommand instance
        """
        command = DeviceCommand(
            device_id=device_id,
            command_type=command_type,
            command_data=command_data or {},
            status=CommandStatus.PENDING,
            created_by_user_id=created_by_user_id,
        )
        
        db.add(command)
        db.commit()
        db.refresh(command)
        
        logger.info(
            f"Created command #{command.id} ({command_type.value}) "
            f"for device {device_id}"
        )
        
        return command
    
    @staticmethod
    def get_pending_commands(
        db: Session,
        device_id: int,
        limit: int = 10,
    ) -> List[DeviceCommand]:
        """
        Get pending commands for a device
        
        Args:
            db: Database session
            device_id: Display device ID
            limit: Maximum number of commands to return
        
        Returns:
            List of pending commands
        """
        commands = db.query(DeviceCommand).filter(
            DeviceCommand.device_id == device_id,
            DeviceCommand.status == CommandStatus.PENDING,
        ).order_by(
            DeviceCommand.created_at
        ).limit(limit).all()
        
        # Mark as sent
        if commands:
            for command in commands:
                command.status = CommandStatus.SENT
                command.sent_at = datetime.now()
            db.commit()
            
            logger.debug(
                f"Retrieved {len(commands)} pending command(s) for device {device_id}"
            )
        
        return commands
    
    @staticmethod
    def update_command_status(
        db: Session,
        command_id: int,
        status: CommandStatus,
        result: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None,
    ) -> Optional[DeviceCommand]:
        """
        Update command execution status
        
        Args:
            db: Database session
            command_id: Command ID
            status: New status
            result: Execution result
            error_message: Error message if failed
        
        Returns:
            Updated DeviceCommand or None
        """
        command = db.query(DeviceCommand).filter(
            DeviceCommand.id == command_id
        ).first()
        
        if not command:
            logger.warning(f"Command {command_id} not found")
            return None
        
        command.status = status
        command.completed_at = datetime.now()
        
        if result:
            command.result = result
        
        if error_message:
            command.error_message = error_message
        
        db.commit()
        db.refresh(command)
        
        logger.info(f"Updated command #{command_id} status to {status.value}")
        
        return command
    
    @staticmethod
    def get_command_history(
        db: Session,
        device_id: int,
        limit: int = 50,
        command_type: Optional[CommandType] = None,
    ) -> List[DeviceCommand]:
        """
        Get command history for a device
        
        Args:
            db: Database session
            device_id: Display device ID
            limit: Maximum number of commands to return
            command_type: Optional filter by command type
        
        Returns:
            List of commands
        """
        query = db.query(DeviceCommand).filter(
            DeviceCommand.device_id == device_id
        )
        
        if command_type:
            query = query.filter(DeviceCommand.command_type == command_type)
        
        return query.order_by(
            DeviceCommand.created_at.desc()
        ).limit(limit).all()
    
    @staticmethod
    def cancel_pending_commands(
        db: Session,
        device_id: int,
        command_type: Optional[CommandType] = None,
    ) -> int:
        """
        Cancel pending commands for a device
        
        Args:
            db: Database session
            device_id: Display device ID
            command_type: Optional filter by command type
        
        Returns:
            Number of commands cancelled
        """
        query = db.query(DeviceCommand).filter(
            DeviceCommand.device_id == device_id,
            DeviceCommand.status.in_([CommandStatus.PENDING, CommandStatus.SENT]),
        )
        
        if command_type:
            query = query.filter(DeviceCommand.command_type == command_type)
        
        result = query.update(
            {
                "status": CommandStatus.FAILED,
                "error_message": "Cancelled by system",
                "completed_at": datetime.now(),
            },
            synchronize_session=False
        )
        
        db.commit()
        
        if result > 0:
            logger.info(f"Cancelled {result} pending command(s) for device {device_id}")
        
        return result

