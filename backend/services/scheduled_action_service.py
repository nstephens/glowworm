"""
Scheduled Action Service
Manages display control actions on schedules
Works alongside SchedulerService for complete automation
"""
import logging
from datetime import datetime
from typing import Optional, List
from sqlalchemy.orm import Session

from models.scheduled_action import ScheduledAction, ActionType
from models.device_command import DeviceCommand, CommandType
from models.display_device import DisplayDevice
from services.device_daemon_service import DeviceCommandService

logger = logging.getLogger(__name__)


class ScheduledActionService:
    """Service for managing scheduled display actions"""
    
    @staticmethod
    def get_active_actions(
        db: Session,
        device_id: int,
        check_time: Optional[datetime] = None,
    ) -> List[ScheduledAction]:
        """
        Get all active actions for a device at a specific time
        
        Args:
            db: Database session
            device_id: Display device ID
            check_time: Time to check (defaults to now in local timezone)
        
        Returns:
            List of active scheduled actions
        """
        if check_time is None:
            check_time = datetime.now()
        
        # Get all enabled actions for this device
        actions = db.query(ScheduledAction).filter(
            ScheduledAction.device_id == device_id,
            ScheduledAction.enabled == True,
        ).all()
        
        # Filter to active ones
        active_actions = [
            action for action in actions
            if action.is_active_at(check_time)
        ]
        
        # Sort by priority (highest first)
        active_actions.sort(key=lambda a: a.priority, reverse=True)
        
        logger.debug(
            f"Found {len(active_actions)} active action(s) for device {device_id} "
            f"at {check_time.strftime('%H:%M:%S')}"
        )
        
        return active_actions
    
    @staticmethod
    def evaluate_and_execute_actions(
        db: Session,
        device_id: int,
        check_time: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Evaluate actions for a device and create commands
        
        Args:
            db: Database session
            device_id: Display device ID
            check_time: Time to check
        
        Returns:
            Dict with execution results
        """
        if check_time is None:
            check_time = datetime.now()
        
        # Get device
        device = db.query(DisplayDevice).filter(DisplayDevice.id == device_id).first()
        if not device:
            logger.warning(f"Device {device_id} not found")
            return {"error": "Device not found"}
        
        # Check if daemon is enabled
        if not device.daemon_enabled:
            logger.debug(f"Device {device_id} does not have daemon enabled, skipping actions")
            return {"skipped": "daemon_not_enabled"}
        
        # Get active actions
        active_actions = ScheduledActionService.get_active_actions(db, device_id, check_time)
        
        if not active_actions:
            return {"actions_executed": 0, "message": "No active actions"}
        
        # Execute highest priority action
        action = active_actions[0]
        
        logger.info(
            f"Executing scheduled action '{action.name}' "
            f"({action.action_type.value}) for device {device_id}"
        )
        
        # Map action type to command type
        command_type_map = {
            ActionType.POWER_ON: CommandType.CEC_POWER_ON,
            ActionType.POWER_OFF: CommandType.CEC_POWER_OFF,
            ActionType.SET_INPUT: CommandType.CEC_SET_INPUT,
        }
        
        command_type = command_type_map.get(action.action_type)
        
        if not command_type:
            logger.error(f"Unknown action type: {action.action_type}")
            return {"error": f"Unknown action type: {action.action_type}"}
        
        # Create device command
        try:
            command = DeviceCommandService.create_command(
                db=db,
                device_id=device_id,
                command_type=command_type,
                command_data=action.action_data or {},
            )
            
            logger.info(
                f"Created command #{command.id} ({command_type.value}) "
                f"from scheduled action '{action.name}'"
            )
            
            return {
                "action_id": action.id,
                "action_name": action.name,
                "action_type": action.action_type.value,
                "command_id": command.id,
                "device_id": device_id,
                "executed_at": check_time.isoformat(),
            }
        
        except Exception as e:
            logger.error(f"Failed to create command for action {action.id}: {e}", exc_info=True)
            return {"error": str(e)}
    
    @staticmethod
    def evaluate_all_devices(db: Session, check_time: Optional[datetime] = None) -> Dict[str, Any]:
        """
        Evaluate scheduled actions for all devices with daemon enabled
        
        Args:
            db: Database session
            check_time: Time to check
        
        Returns:
            Dict with evaluation results
        """
        if check_time is None:
            check_time = datetime.now()
        
        # Get all devices with daemon enabled
        devices = db.query(DisplayDevice).filter(
            DisplayDevice.daemon_enabled == True
        ).all()
        
        results = {
            "evaluated_at": check_time.isoformat(),
            "devices_evaluated": len(devices),
            "actions_executed": 0,
            "commands_created": [],
            "errors": [],
        }
        
        for device in devices:
            try:
                result = ScheduledActionService.evaluate_and_execute_actions(
                    db, device.id, check_time
                )
                
                if "command_id" in result:
                    results["actions_executed"] += 1
                    results["commands_created"].append(result)
            
            except Exception as e:
                logger.error(f"Error evaluating actions for device {device.id}: {e}")
                results["errors"].append({
                    "device_id": device.id,
                    "error": str(e),
                })
        
        logger.info(
            f"Action evaluation complete: {results['actions_executed']} action(s) "
            f"executed across {results['devices_evaluated']} device(s)"
        )
        
        return results

