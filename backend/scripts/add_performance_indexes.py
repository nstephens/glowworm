#!/usr/bin/env python3
"""
Script to add performance indexes to the database.
Run this script to optimize database performance.
"""

import sys
import os
import logging
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy.orm import Session
from models.database import SessionLocal
from services.database_indexing_service import DatabaseIndexingService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    """Add performance indexes to the database"""
    try:
        logger.info("Starting database index optimization...")
        
        # Create database session
        db = SessionLocal()
        
        try:
            # Create indexing service
            indexing_service = DatabaseIndexingService(db)
            
            # Get current database performance summary
            logger.info("Analyzing current database performance...")
            summary = indexing_service.get_database_performance_summary()
            
            if 'error' in summary:
                logger.error(f"Error analyzing database: {summary['error']}")
                return 1
            
            logger.info(f"Database: {summary['database_name']}")
            logger.info(f"Total tables: {summary['summary']['total_tables']}")
            logger.info(f"Total rows: {summary['summary']['total_rows']}")
            logger.info(f"Current index ratio: {summary['summary']['overall_index_ratio']}%")
            
            # Show recommendations
            recommendations = summary.get('recommendations', [])
            if recommendations:
                logger.info("Current recommendations:")
                for rec in recommendations:
                    logger.info(f"  - {rec}")
            
            # Create performance indexes
            logger.info("Creating performance indexes...")
            results = indexing_service.create_performance_indexes()
            
            # Report results
            logger.info("Index creation results:")
            logger.info(f"  Created: {len(results['created'])}")
            logger.info(f"  Already existed: {len(results['already_exists'])}")
            logger.info(f"  Errors: {len(results['errors'])}")
            
            if results['created']:
                logger.info("New indexes created:")
                for index_name in results['created']:
                    logger.info(f"  - {index_name}")
            
            if results['already_exists']:
                logger.info("Indexes that already existed:")
                for index_name in results['already_exists']:
                    logger.info(f"  - {index_name}")
            
            if results['errors']:
                logger.warning("Errors encountered:")
                for error in results['errors']:
                    logger.warning(f"  - {error}")
            
            # Get updated performance summary
            logger.info("Analyzing updated database performance...")
            updated_summary = indexing_service.get_database_performance_summary()
            
            if 'error' not in updated_summary:
                logger.info(f"Updated index ratio: {updated_summary['summary']['overall_index_ratio']}%")
                
                # Show table-specific improvements
                for table_name, analysis in updated_summary['tables'].items():
                    stats = analysis['statistics']
                    logger.info(f"Table {table_name}:")
                    logger.info(f"  - Rows: {stats['rows']}")
                    logger.info(f"  - Data size: {stats['data_size_mb']} MB")
                    logger.info(f"  - Index size: {stats['index_size_mb']} MB")
                    logger.info(f"  - Index ratio: {stats['index_ratio_percent']}%")
                    logger.info(f"  - Indexes: {len(analysis['indexes'])}")
            
            logger.info("Database index optimization completed successfully!")
            return 0
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error during database optimization: {e}")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)








