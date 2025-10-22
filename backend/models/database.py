from sqlalchemy import create_engine, MetaData
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config.settings import settings, get_fresh_settings
import logging

logger = logging.getLogger(__name__)

# Create database engine
def create_database_engine():
    """Create database engine with MySQL connection"""
    try:
        # Use fresh settings to get current configuration
        fresh_settings = get_fresh_settings()
        database_url = f"mysql+pymysql://{fresh_settings.mysql_user}:{fresh_settings.mysql_password}@{fresh_settings.mysql_host}:{fresh_settings.mysql_port}/{fresh_settings.mysql_database}"
        engine = create_engine(
            database_url,
            echo=False,  # Set to True for SQL debugging
            pool_pre_ping=True,  # Verify connections before use
            pool_recycle=3600,   # Recycle connections every hour
            pool_size=20,        # Increase pool to handle concurrent image requests
            max_overflow=40,     # Allow up to 60 total connections for bursts
        )
        return engine
    except Exception as e:
        logger.error(f"Failed to create database engine: {e}")
        raise

# Global variables for lazy initialization
engine = None
SessionLocal = None

def initialize_database():
    """Initialize database connection - only call after setup is complete"""
    global engine, SessionLocal
    
    if engine is not None:
        return  # Already initialized
    
    from config.settings import is_configured
    if not is_configured():
        logger.warning("Database initialization skipped - setup not complete")
        return
    
    try:
        logger.info("Initializing database connection...")
        engine = create_database_engine()
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        logger.info("Database connection initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database connection: {e}")
        raise

def ensure_database_initialized():
    """Ensure database is initialized before use"""
    logger.debug(f"Checking database initialization - engine: {'present' if engine else 'None'}, SessionLocal: {'present' if SessionLocal else 'None'}")
    
    if engine is None or SessionLocal is None:
        logger.debug("Database not initialized, calling initialize_database...")
        initialize_database()
    
    if engine is None or SessionLocal is None:
        logger.error("Database initialization failed - engine or SessionLocal still None")
        raise RuntimeError("Database not initialized - setup may not be complete")

def refresh_database_connection():
    """Refresh database connection with updated settings"""
    global engine, SessionLocal
    try:
        logger.info("Refreshing database connection with updated settings...")
        
        # Dispose of the old engine
        if engine:
            engine.dispose()
        
        # Reset to None to force re-initialization
        engine = None
        SessionLocal = None
        
        # Initialize with fresh settings
        initialize_database()
        
        logger.info("Database connection refreshed successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to refresh database connection: {e}")
        return False

# Create base class for models
Base = declarative_base()

# Metadata for table creation
metadata = MetaData()

def get_db():
    """Dependency to get database session"""
    ensure_database_initialized()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_tables():
    """Create all tables"""
    try:
        ensure_database_initialized()
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Failed to create database tables: {e}")
        raise

def drop_tables():
    """Drop all tables (for development/testing)"""
    try:
        Base.metadata.drop_all(bind=engine)
        logger.info("Database tables dropped successfully")
    except Exception as e:
        logger.error(f"Failed to drop database tables: {e}")
        raise
