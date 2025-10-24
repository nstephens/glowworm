from fastapi import APIRouter, HTTPException, Depends, Request, Response
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
import secrets
import string
import logging
import socket
import psutil
from config.settings import settings, is_configured, is_database_accessible, save_config
from utils.database import db_manager
from models.database import get_db, Base
from services.auth_service import AuthService
from services.database_config_service import DatabaseConfigService
from utils.auth import PasswordManager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/setup", tags=["setup"])

# Pydantic models for request/response
class DatabaseConfigRequest(BaseModel):
    mysql_host: str = Field(..., description="MySQL host")
    mysql_port: int = Field(3306, description="MySQL port")
    mysql_root_user: str = Field(..., description="MySQL root username")
    mysql_root_password: str = Field(..., description="MySQL root password")

class UserConfigRequest(BaseModel):
    app_db_user: str = Field(..., description="Application database username")
    app_db_password: str = Field(..., description="Application database password")

class AdminConfigRequest(BaseModel):
    admin_password: str = Field(..., description="Admin password")

class UserCheckRequest(BaseModel):
    mysql_host: str
    mysql_port: int
    mysql_root_user: str
    mysql_root_password: str
    app_db_user: str
    app_db_password: str

class SetupCompleteRequest(BaseModel):
    mysql_host: str
    mysql_port: int
    mysql_root_user: str
    mysql_root_password: str
    app_db_user: str
    app_db_password: str
    admin_password: str
    server_base_url: str
    backend_port: int = 8001
    frontend_port: int = 3003
    default_display_time_seconds: int = 30
    upload_directory: str = "uploads"
    display_status_check_interval: int = 30
    display_websocket_check_interval: int = 5
    log_level: str = "INFO"

class SetupStatusResponse(BaseModel):
    is_configured: bool
    needs_bootstrap: bool = False
    needs_admin: bool = False
    message: str

class TestConnectionResponse(BaseModel):
    success: bool
    message: str

class UserCheckResponse(BaseModel):
    success: bool
    exists: bool
    message: str
    action_required: Optional[str] = None  # "recreate" or None

class SetupCompleteResponse(BaseModel):
    success: bool
    message: str

class NetworkInterface(BaseModel):
    name: str
    ip_address: str
    is_up: bool
    is_loopback: bool

class NetworkInterfacesResponse(BaseModel):
    interfaces: list[NetworkInterface]

def generate_secret_key() -> str:
    """Generate a secure secret key for the application"""
    return secrets.token_urlsafe(32)

@router.get("/status", response_model=SetupStatusResponse)
async def get_setup_status(db: Session = Depends(get_db)):
    """Check if the application is configured and if admin user exists"""
    # Check if database/bootstrap is configured
    bootstrap_configured = is_configured()
    
    # Check if database is accessible (for Docker deployments, this might fail initially)
    database_accessible = is_database_accessible()
    
    # Check if admin user exists (for stage 2)
    admin_exists = False
    if bootstrap_configured and database_accessible:
        try:
            from models.user import User
            admin_user = db.query(User).filter(User.username == "admin").first()
            admin_exists = admin_user is not None
        except Exception as e:
            logger.debug(f"Could not check for admin user: {e}")
            admin_exists = False
    
    return SetupStatusResponse(
        is_configured=bootstrap_configured and admin_exists,
        needs_bootstrap=not bootstrap_configured,
        needs_admin=bootstrap_configured and not admin_exists,
        message="Setup status retrieved successfully"
    )

@router.post("/create-admin")
async def create_admin_user(
    admin_data: AdminConfigRequest,
    db: Session = Depends(get_db)
):
    """Create admin user (Stage 2 setup for Docker deployments)"""
    try:
        # Verify bootstrap is configured
        if not is_configured():
            raise HTTPException(
                status_code=400, 
                detail="Database not configured. Please complete bootstrap setup first."
            )
        
        # Check if admin already exists
        from models.user import User
        existing_admin = db.query(User).filter(User.username == "admin").first()
        if existing_admin:
            raise HTTPException(
                status_code=400,
                detail="Admin user already exists"
            )
        
        # Create admin user
        auth_service = AuthService(db)
        from models.user import UserRole
        admin_user = auth_service.create_user(
            username="admin",
            password=admin_data.admin_password,
            role=UserRole.ADMIN
        )
        
        logger.info(f"Admin user created successfully: {admin_user.username}")
        
        return {
            "success": True,
            "message": "Admin user created successfully",
            "user": {
                "id": admin_user.id,
                "username": admin_user.username
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin user creation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create admin user: {str(e)}")

@router.get("/network-interfaces", response_model=NetworkInterfacesResponse)
async def get_network_interfaces():
    """Get available network interfaces"""
    try:
        interfaces = []
        
        # Get network interfaces using psutil
        for interface_name, addrs in psutil.net_if_addrs().items():
            interface_stats = psutil.net_if_stats().get(interface_name)
            is_up = interface_stats.isup if interface_stats else False
            
            for addr in addrs:
                if addr.family == socket.AF_INET:  # IPv4 addresses only
                    ip_address = addr.address
                    is_loopback = ip_address.startswith('127.') or ip_address == 'localhost'
                    
                    # Skip loopback unless it's the only option
                    if not is_loopback or len([a for a in addrs if a.family == socket.AF_INET and not a.address.startswith('127.')]) == 0:
                        interfaces.append(NetworkInterface(
                            name=interface_name,
                            ip_address=ip_address,
                            is_up=is_up,
                            is_loopback=is_loopback
                        ))
        
        # Sort interfaces: non-loopback first, then by name
        interfaces.sort(key=lambda x: (x.is_loopback, x.name))
        
        return NetworkInterfacesResponse(interfaces=interfaces)
        
    except Exception as e:
        logger.error(f"Error getting network interfaces: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get network interfaces: {str(e)}")

@router.post("/test-database-connection", response_model=TestConnectionResponse)
async def test_database_connection(config: DatabaseConfigRequest):
    """Test database connection with root credentials"""
    logger.info("POST request received for test-database-connection")
    logger.info(f"Request headers: {dict(config)}")
    
    result = db_manager.test_connection(
        host=config.mysql_host,
        port=config.mysql_port,
        user=config.mysql_root_user,
        password=config.mysql_root_password
    )
    logger.info(f"Database connection test result: {result}")
    return TestConnectionResponse(**result)

@router.post("/check-user", response_model=UserCheckResponse)
async def check_user(user_check_data: UserCheckRequest):
    """Check if app user exists and test password"""
    logger.info("POST request received for check-user")
    logger.info(f"Request headers: {dict(user_check_data)}")
    
    try:
        # Extract user config and db config from the data
        user_config = {
            "app_db_user": user_check_data.app_db_user,
            "app_db_password": user_check_data.app_db_password
        }
        
        db_config = {
            "mysql_host": user_check_data.mysql_host,
            "mysql_port": user_check_data.mysql_port,
            "mysql_root_user": user_check_data.mysql_root_user,
            "mysql_root_password": user_check_data.mysql_root_password
        }
        
        # Check if user exists
        user_check = db_manager.check_user_exists(
            host=db_config["mysql_host"],
            port=db_config["mysql_port"],
            root_user=db_config["mysql_root_user"],
            root_password=db_config["mysql_root_password"],
            username=user_config["app_db_user"]
        )
        
        if not user_check["success"]:
            return UserCheckResponse(
                success=False,
                exists=False,
                message=f"Failed to check user: {user_check['message']}"
            )
        
        user_exists = user_check["exists"]
        
        if not user_exists:
            # User doesn't exist - this is fine, we'll create it during setup
            return UserCheckResponse(
                success=True,
                exists=False,
                message=f"User '{user_config['app_db_user']}' does not exist. Will be created during setup."
            )
        
        # User exists - test the password
        password_test = db_manager.test_user_connection(
            host=db_config["mysql_host"],
            port=db_config["mysql_port"],
            user=user_config["app_db_user"],
            password=user_config["app_db_password"],
            db_name=settings.mysql_database
        )
        
        if password_test["success"]:
            # User exists and password is correct
            return UserCheckResponse(
                success=True,
                exists=True,
                message=f"User '{user_config['app_db_user']}' exists and password is correct."
            )
        else:
            # User exists but password is wrong
            return UserCheckResponse(
                success=True,
                exists=True,
                message=f"User '{user_config['app_db_user']}' exists but password is incorrect.",
                action_required="recreate"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in check_user: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

@router.post("/recreate-user", response_model=TestConnectionResponse)
async def recreate_user(user_check_data: UserCheckRequest):
    """Delete and recreate the app user with new password"""
    logger.info("POST request received for recreate-user")
    
    try:
        # Extract user config and db config
        user_config = {
            "app_db_user": user_check_data.app_db_user,
            "app_db_password": user_check_data.app_db_password
        }
        
        db_config = {
            "mysql_host": user_check_data.mysql_host,
            "mysql_port": user_check_data.mysql_port,
            "mysql_root_user": user_check_data.mysql_root_user,
            "mysql_root_password": user_check_data.mysql_root_password
        }
        
        # Ensure database exists first
        db_result = db_manager.create_database(
            host=db_config["mysql_host"],
            port=db_config["mysql_port"],
            root_user=db_config["mysql_root_user"],
            root_password=db_config["mysql_root_password"],
            db_name=settings.mysql_database
        )
        
        if not db_result["success"]:
            return TestConnectionResponse(
                success=False,
                message=f"Failed to ensure database exists: {db_result['message']}"
            )
        
        # Delete existing user
        delete_result = db_manager.delete_user(
            host=db_config["mysql_host"],
            port=db_config["mysql_port"],
            root_user=db_config["mysql_root_user"],
            root_password=db_config["mysql_root_password"],
            username=user_config["app_db_user"]
        )
        
        if not delete_result["success"]:
            return TestConnectionResponse(
                success=False,
                message=f"Failed to delete user: {delete_result['message']}"
            )
        
        # Create new user
        logger.info(f"Creating user '{user_config['app_db_user']}' for database '{settings.mysql_database}'")
        create_result = db_manager.create_user(
            host=db_config["mysql_host"],
            port=db_config["mysql_port"],
            root_user=db_config["mysql_root_user"],
            root_password=db_config["mysql_root_password"],
            new_user=user_config["app_db_user"],
            new_password=user_config["app_db_password"],
            db_name=settings.mysql_database
        )
        
        logger.info(f"User creation result: {create_result}")
        
        if not create_result["success"]:
            return TestConnectionResponse(
                success=False,
                message=f"Failed to create user: {create_result['message']}"
            )
        
        # Test the new user
        test_result = db_manager.test_user_connection(
            host=db_config["mysql_host"],
            port=db_config["mysql_port"],
            user=user_config["app_db_user"],
            password=user_config["app_db_password"],
            db_name=settings.mysql_database
        )
        
        return TestConnectionResponse(**test_result)
        
    except Exception as e:
        logger.error(f"Error in recreate_user: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

@router.post("/complete", response_model=SetupCompleteResponse)
async def complete_setup(setup_data: SetupCompleteRequest):
    """Complete the setup process"""
    try:
        logger.info("Starting setup completion process...")
        logger.info(f"Setup data received: {setup_data.dict()}")
        
        # Check if already configured
        if is_configured():
            logger.warning("Setup attempted but application is already configured")
            # For now, allow re-setup if there are issues
            # TODO: Add proper reset mechanism
            logger.info("Allowing re-setup due to potential configuration issues")
        
        # Test root connection
        root_test = db_manager.test_connection(
            host=setup_data.mysql_host,
            port=setup_data.mysql_port,
            user=setup_data.mysql_root_user,
            password=setup_data.mysql_root_password
        )
        if not root_test["success"]:
            raise HTTPException(status_code=400, detail=f"Root connection failed: {root_test['message']}")
        
        # Create database
        db_result = db_manager.create_database(
            host=setup_data.mysql_host,
            port=setup_data.mysql_port,
            root_user=setup_data.mysql_root_user,
            root_password=setup_data.mysql_root_password,
            db_name=settings.mysql_database
        )
        if not db_result["success"]:
            raise HTTPException(status_code=400, detail=f"Database creation failed: {db_result['message']}")
        
        # Check if app user exists and handle accordingly
        user_check = db_manager.check_user_exists(
            host=setup_data.mysql_host,
            port=setup_data.mysql_port,
            root_user=setup_data.mysql_root_user,
            root_password=setup_data.mysql_root_password,
            username=setup_data.app_db_user
        )
        
        if not user_check["success"]:
            raise HTTPException(status_code=400, detail=f"User check failed: {user_check['message']}")
        
        user_exists = user_check["exists"]
        
        if user_exists:
            # User exists - test the password
            password_test = db_manager.test_user_connection(
                host=setup_data.mysql_host,
                port=setup_data.mysql_port,
                user=setup_data.app_db_user,
                password=setup_data.app_db_password,
                db_name=settings.mysql_database
            )
            
            if not password_test["success"]:
                # User exists but password is wrong - need to recreate user
                logger.info(f"User '{setup_data.app_db_user}' exists but password is incorrect. Recreating user...")
                
                # Delete existing user
                delete_result = db_manager.delete_user(
                    host=setup_data.mysql_host,
                    port=setup_data.mysql_port,
                    root_user=setup_data.mysql_root_user,
                    root_password=setup_data.mysql_root_password,
                    username=setup_data.app_db_user
                )
                
                if not delete_result["success"]:
                    raise HTTPException(status_code=400, detail=f"Failed to delete existing user: {delete_result['message']}")
                
                # Create new user
                user_result = db_manager.create_user(
                    host=setup_data.mysql_host,
                    port=setup_data.mysql_port,
                    root_user=setup_data.mysql_root_user,
                    root_password=setup_data.mysql_root_password,
                    new_user=setup_data.app_db_user,
                    new_password=setup_data.app_db_password,
                    db_name=settings.mysql_database
                )
                
                if not user_result["success"]:
                    raise HTTPException(status_code=400, detail=f"User recreation failed: {user_result['message']}")
                
                logger.info(f"Successfully recreated user '{setup_data.app_db_user}'")
            else:
                logger.info(f"User '{setup_data.app_db_user}' exists and password is correct")
        else:
            # User doesn't exist - create it
            logger.info(f"User '{setup_data.app_db_user}' doesn't exist. Creating new user...")
            user_result = db_manager.create_user(
                host=setup_data.mysql_host,
                port=setup_data.mysql_port,
                root_user=setup_data.mysql_root_user,
                root_password=setup_data.mysql_root_password,
                new_user=setup_data.app_db_user,
                new_password=setup_data.app_db_password,
                db_name=settings.mysql_database
            )
            
            if not user_result["success"]:
                raise HTTPException(status_code=400, detail=f"User creation failed: {user_result['message']}")
            
            logger.info(f"Successfully created user '{setup_data.app_db_user}'")
        
        # Test the app user connection before proceeding
        logger.info("Testing app user database connection...")
        app_user_test = db_manager.test_user_connection(
            host=setup_data.mysql_host,
            port=setup_data.mysql_port,
            user=setup_data.app_db_user,
            password=setup_data.app_db_password,
            db_name=settings.mysql_database
        )
        
        if not app_user_test["success"]:
            raise HTTPException(status_code=400, detail=f"App user connection test failed: {app_user_test['message']}")
        
        logger.info("App user database connection test successful")
        
        # Create a temporary database connection for creating the admin user
        database_url = f"mysql+pymysql://{setup_data.app_db_user}:{setup_data.app_db_password}@{setup_data.mysql_host}:{setup_data.mysql_port}/{settings.mysql_database}"
        temp_engine = create_engine(database_url)
        
        # Create all tables (don't drop existing ones to avoid foreign key issues)
        logger.info("Creating database tables...")
        Base.metadata.create_all(bind=temp_engine)
        logger.info("Database tables created successfully")
        
        # Create a temporary session for creating the admin user and settings
        from sqlalchemy.orm import sessionmaker
        TempSession = sessionmaker(bind=temp_engine)
        temp_db = TempSession()
        
        try:
            logger.info("Creating admin user and initializing settings...")
            
            # Create the first super admin user
            auth_service = AuthService(temp_db)
            admin_user = auth_service.create_first_admin_user(
                username="admin",
                password=setup_data.admin_password
            )
            logger.info(f"Created admin user: {admin_user.username}")
            
            # Initialize application settings in database
            config_service = DatabaseConfigService(temp_db)
            
            # Construct full server URL from IP and port
            full_server_url = f"http://{setup_data.server_base_url}:{setup_data.backend_port}"
            
            # Application settings to store in database
            app_settings = {
                "server_base_url": full_server_url,
                "backend_port": setup_data.backend_port,
                "frontend_port": setup_data.frontend_port,
                "default_display_time_seconds": setup_data.default_display_time_seconds,
                "upload_directory": setup_data.upload_directory,
                "display_status_check_interval": setup_data.display_status_check_interval,
                "display_websocket_check_interval": setup_data.display_websocket_check_interval,
            "log_level": setup_data.log_level,
            "target_display_sizes": ["1080x1920", "2k-portrait", "4k-portrait"]
            }
            
            # Save application settings to database
            settings_result = config_service.set_settings(app_settings)
            if not settings_result:
                logger.error("Failed to save application settings")
                raise HTTPException(status_code=500, detail="Failed to save application settings")
            logger.info("Initialized application settings in database")
            
        except Exception as e:
            logger.error(f"Error during admin user creation or settings initialization: {e}")
            raise HTTPException(status_code=500, detail=f"Setup failed during user/settings creation: {str(e)}")
        finally:
            temp_db.close()
            temp_engine.dispose()
        
        # Final validation: Test that we can connect with the saved credentials
        logger.info("Performing final validation test...")
        final_test = db_manager.test_user_connection(
            host=setup_data.mysql_host,
            port=setup_data.mysql_port,
            user=setup_data.app_db_user,
            password=setup_data.app_db_password,
            db_name=settings.mysql_database
        )
        
        if not final_test["success"]:
            logger.error(f"Final validation failed: {final_test['message']}")
            raise HTTPException(status_code=500, detail=f"Final validation failed: {final_test['message']}")
        
        logger.info("Final validation test successful - proceeding with configuration save")
        
        # Generate a secret key for the application
        secret_key = generate_secret_key()
        
        # Save bootstrap configuration (database credentials, etc.)
        bootstrap_config = {
            "mysql_host": setup_data.mysql_host,
            "mysql_port": setup_data.mysql_port,
            "app_db_user": setup_data.app_db_user,
            "app_db_password": setup_data.app_db_password,
            "mysql_database": settings.mysql_database,
            "secret_key": secret_key,
            "setup_completed": True
        }
        
        logger.info("Saving bootstrap configuration...")
        logger.info(f"Bootstrap config to save: {bootstrap_config}")
        save_result = save_config(bootstrap_config)
        logger.info(f"Save config result: {save_result}")
        logger.info("Bootstrap configuration saved successfully")
        
        # Refresh database connection with new settings
        logger.info("Refreshing database connection with updated settings...")
        from models.database import refresh_database_connection
        refresh_success = refresh_database_connection()
        if refresh_success:
            logger.info("Database connection refreshed successfully")
        else:
            logger.warning("Database connection refresh failed, but setup completed")
        
        return SetupCompleteResponse(
            success=True,
            message="Setup completed successfully! You can now log in with the admin credentials."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in complete_setup: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

@router.post("/refresh-database", response_model=SetupCompleteResponse)
async def refresh_database_connection_endpoint():
    """Refresh database connection with current settings"""
    try:
        logger.info("Manual database connection refresh requested...")
        from models.database import refresh_database_connection
        
        refresh_success = refresh_database_connection()
        if refresh_success:
            return SetupCompleteResponse(
                success=True,
                message="Database connection refreshed successfully"
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to refresh database connection")
    except Exception as e:
        logger.error(f"Error in refresh_database_connection_endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

@router.post("/reset", response_model=SetupCompleteResponse)
async def reset_setup():
    """Reset the setup configuration"""
    try:
        logger.info("Resetting setup configuration...")
        
        # Reset the configuration file by clearing it
        import os
        import json
        config_file = "config/settings.json"
        if os.path.exists(config_file):
            # Reset to default empty configuration
            default_config = {
                "mysql_host": "localhost",
                "mysql_port": 3306,
                "mysql_root_user": "root",
                "mysql_root_password": "",
                "app_db_user": "glowworm",
                "app_db_password": "",
                "secret_key": ""
            }
            with open(config_file, 'w') as f:
                json.dump(default_config, f, indent=2)
        
        logger.info("Setup configuration reset successfully")
        return SetupCompleteResponse(
            success=True,
            message="Setup configuration reset successfully. You can now run setup again."
        )
    except Exception as e:
        logger.error(f"Error in reset_setup: {e}")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")
