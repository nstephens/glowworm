import pymysql
from typing import Dict, Any, Optional
import logging
from config.settings import settings

logger = logging.getLogger(__name__)

class DatabaseManager:
    def __init__(self):
        self.connection = None
    
    def test_connection(self, host: str, port: int, user: str, password: str, database: Optional[str] = None) -> Dict[str, Any]:
        """Test database connection with given credentials"""
        try:
            connection = pymysql.connect(
                host=host,
                port=port,
                user=user,
                password=password,
                database=database,
                charset='utf8mb4',
                cursorclass=pymysql.cursors.DictCursor
            )
            connection.close()
            return {"success": True, "message": "Connection successful"}
        except pymysql.Error as e:
            return {"success": False, "message": f"Database connection failed: {str(e)}"}
        except Exception as e:
            return {"success": False, "message": f"Unexpected error: {str(e)}"}
    
    def create_database(self, host: str, port: int, root_user: str, root_password: str, db_name: str) -> Dict[str, Any]:
        """Create database using root credentials"""
        try:
            connection = pymysql.connect(
                host=host,
                port=port,
                user=root_user,
                password=root_password,
                charset='utf8mb4',
                cursorclass=pymysql.cursors.DictCursor
            )
            
            with connection.cursor() as cursor:
                # Create database
                cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
                connection.commit()
            
            connection.close()
            return {"success": True, "message": f"Database '{db_name}' created successfully"}
        except pymysql.Error as e:
            return {"success": False, "message": f"Failed to create database: {str(e)}"}
        except Exception as e:
            return {"success": False, "message": f"Unexpected error: {str(e)}"}
    
    def create_user(self, host: str, port: int, root_user: str, root_password: str, 
                   new_user: str, new_password: str, db_name: str) -> Dict[str, Any]:
        """Create database user with privileges"""
        try:
            connection = pymysql.connect(
                host=host,
                port=port,
                user=root_user,
                password=root_password,
                charset='utf8mb4',
                cursorclass=pymysql.cursors.DictCursor
            )
            
            with connection.cursor() as cursor:
                # Create user for both localhost and % hosts
                print(f"Creating user '{new_user}'@'localhost' with password")
                cursor.execute(f"CREATE USER IF NOT EXISTS '{new_user}'@'localhost' IDENTIFIED BY '{new_password}'")
                print(f"Creating user '{new_user}'@'%' with password")
                cursor.execute(f"CREATE USER IF NOT EXISTS '{new_user}'@'%' IDENTIFIED BY '{new_password}'")
                
                # Grant privileges to both hosts
                print(f"Granting privileges to '{new_user}'@'localhost' for database '{db_name}'")
                cursor.execute(f"GRANT ALL PRIVILEGES ON `{db_name}`.* TO '{new_user}'@'localhost'")
                print(f"Granting privileges to '{new_user}'@'%' for database '{db_name}'")
                cursor.execute(f"GRANT ALL PRIVILEGES ON `{db_name}`.* TO '{new_user}'@'%'")
                print("Flushing privileges")
                cursor.execute("FLUSH PRIVILEGES")
                
                connection.commit()
            
            connection.close()
            return {"success": True, "message": f"User '{new_user}' created successfully"}
        except pymysql.Error as e:
            return {"success": False, "message": f"Failed to create user: {str(e)}"}
        except Exception as e:
            return {"success": False, "message": f"Unexpected error: {str(e)}"}
    
    def check_user_exists(self, host: str, port: int, root_user: str, root_password: str, username: str) -> Dict[str, Any]:
        """Check if a MySQL user exists"""
        try:
            connection = pymysql.connect(
                host=host,
                port=port,
                user=root_user,
                password=root_password,
                charset='utf8mb4',
                cursorclass=pymysql.cursors.DictCursor
            )
            
            with connection.cursor() as cursor:
                cursor.execute("SELECT User FROM mysql.user WHERE User = %s", (username,))
                result = cursor.fetchone()
            
            connection.close()
            exists = result is not None
            return {
                "success": True, 
                "exists": exists, 
                "message": f"User '{username}' {'exists' if exists else 'does not exist'}"
            }
        except pymysql.Error as e:
            return {"success": False, "message": f"Failed to check user existence: {str(e)}"}
        except Exception as e:
            return {"success": False, "message": f"Unexpected error: {str(e)}"}
    
    def test_user_connection(self, host: str, port: int, user: str, password: str, db_name: str) -> Dict[str, Any]:
        """Test connection with the user credentials"""
        try:
            connection = pymysql.connect(
                host=host,
                port=port,
                user=user,
                password=password,
                database=db_name,
                charset='utf8mb4',
                cursorclass=pymysql.cursors.DictCursor
            )
            
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1 as test")
                result = cursor.fetchone()
            
            connection.close()
            return {"success": True, "message": "User connection test successful"}
        except pymysql.Error as e:
            return {"success": False, "message": f"User connection failed: {str(e)}"}
        except Exception as e:
            return {"success": False, "message": f"Unexpected error: {str(e)}"}
    
    def delete_user(self, host: str, port: int, root_user: str, root_password: str, username: str) -> Dict[str, Any]:
        """Delete a MySQL user"""
        try:
            connection = pymysql.connect(
                host=host,
                port=port,
                user=root_user,
                password=root_password,
                charset='utf8mb4',
                cursorclass=pymysql.cursors.DictCursor
            )
            
            with connection.cursor() as cursor:
                cursor.execute(f"DROP USER IF EXISTS '{username}'@'localhost'")
                cursor.execute(f"DROP USER IF EXISTS '{username}'@'%'")
                cursor.execute("FLUSH PRIVILEGES")
                connection.commit()
            
            connection.close()
            return {"success": True, "message": f"User '{username}' deleted successfully"}
        except pymysql.Error as e:
            return {"success": False, "message": f"Failed to delete user: {str(e)}"}
        except Exception as e:
            return {"success": False, "message": f"Unexpected error: {str(e)}"}

# Global database manager instance
db_manager = DatabaseManager()
