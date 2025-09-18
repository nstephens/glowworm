"""
Database indexing service for performance optimization.
Creates and manages database indexes for improved query performance.
"""

from sqlalchemy.orm import Session
from sqlalchemy import text, Index
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)

class DatabaseIndexingService:
    """Service for managing database indexes for performance optimization"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_performance_indexes(self) -> Dict[str, Any]:
        """Create all recommended performance indexes"""
        results = {
            'created': [],
            'already_exists': [],
            'errors': []
        }
        
        # Define indexes to create
        indexes = [
            {
                'name': 'idx_images_uploaded_at',
                'table': 'images',
                'columns': ['uploaded_at'],
                'description': 'Index for sorting by upload date'
            },
            {
                'name': 'idx_images_file_size',
                'table': 'images',
                'columns': ['file_size'],
                'description': 'Index for file size filtering and sorting'
            },
            {
                'name': 'idx_images_mime_type',
                'table': 'images',
                'columns': ['mime_type'],
                'description': 'Index for format-based filtering'
            },
            {
                'name': 'idx_images_dimensions',
                'table': 'images',
                'columns': ['width', 'height'],
                'description': 'Composite index for dimension-based queries'
            },
            {
                'name': 'idx_images_album_uploaded',
                'table': 'images',
                'columns': ['album_id', 'uploaded_at'],
                'description': 'Composite index for album queries with date sorting'
            },
            {
                'name': 'idx_images_playlist_uploaded',
                'table': 'images',
                'columns': ['playlist_id', 'uploaded_at'],
                'description': 'Composite index for playlist queries with date sorting'
            },
            {
                'name': 'idx_images_filename_search',
                'table': 'images',
                'columns': ['filename'],
                'description': 'Index for filename search operations'
            },
            {
                'name': 'idx_images_original_filename_search',
                'table': 'images',
                'columns': ['original_filename'],
                'description': 'Index for original filename search operations'
            },
            {
                'name': 'idx_playlists_is_default',
                'table': 'playlists',
                'columns': ['is_default'],
                'description': 'Index for default playlist queries'
            },
            {
                'name': 'idx_playlists_slug',
                'table': 'playlists',
                'columns': ['slug'],
                'description': 'Index for playlist slug lookups (already unique)'
            },
            {
                'name': 'idx_playlists_created_at',
                'table': 'playlists',
                'columns': ['created_at'],
                'description': 'Index for playlist creation date sorting'
            },
            {
                'name': 'idx_albums_name',
                'table': 'albums',
                'columns': ['name'],
                'description': 'Index for album name searches'
            },
            {
                'name': 'idx_albums_created_at',
                'table': 'albums',
                'columns': ['created_at'],
                'description': 'Index for album creation date sorting'
            }
        ]
        
        for index_def in indexes:
            try:
                success = self._create_index(
                    index_def['name'],
                    index_def['table'],
                    index_def['columns'],
                    index_def['description']
                )
                
                if success:
                    results['created'].append(index_def['name'])
                else:
                    results['already_exists'].append(index_def['name'])
                    
            except Exception as e:
                error_msg = f"Failed to create index {index_def['name']}: {str(e)}"
                logger.error(error_msg)
                results['errors'].append(error_msg)
        
        return results
    
    def _create_index(self, index_name: str, table_name: str, columns: List[str], description: str) -> bool:
        """Create a single database index"""
        try:
            # Check if index already exists
            check_query = """
            SELECT COUNT(*) as count
            FROM information_schema.statistics 
            WHERE table_schema = DATABASE() 
              AND table_name = :table_name 
              AND index_name = :index_name
            """
            
            result = self.db.execute(text(check_query), {"table_name": table_name, "index_name": index_name}).fetchone()
            
            if result[0] > 0:
                logger.info(f"Index {index_name} already exists on {table_name}")
                return False
            
            # Create the index
            columns_str = ', '.join(columns)
            create_query = f"""
            CREATE INDEX {index_name} ON {table_name} ({columns_str})
            COMMENT '{description}'
            """
            
            self.db.execute(text(create_query))
            self.db.commit()
            
            logger.info(f"Created index {index_name} on {table_name}({columns_str})")
            return True
            
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error creating index {index_name}: {e}")
            raise
    
    def analyze_table_performance(self, table_name: str) -> Dict[str, Any]:
        """Analyze table performance and suggest optimizations"""
        try:
            # Get table statistics
            stats_query = """
            SELECT 
                table_rows,
                avg_row_length,
                data_length,
                index_length,
                (data_length + index_length) as total_size,
                ROUND((index_length / (data_length + index_length)) * 100, 2) as index_ratio
            FROM information_schema.tables 
            WHERE table_schema = DATABASE() 
              AND table_name = :table_name
            """
            
            result = self.db.execute(text(stats_query), {"table_name": table_name}).fetchone()
            
            if not result:
                return {'error': f'Table {table_name} not found'}
            
            # Get existing indexes
            indexes_query = """
            SELECT 
                index_name,
                column_name,
                seq_in_index,
                non_unique,
                index_type
            FROM information_schema.statistics 
            WHERE table_schema = DATABASE() 
              AND table_name = :table_name
            ORDER BY index_name, seq_in_index
            """
            
            indexes_result = self.db.execute(text(indexes_query), {"table_name": table_name})
            indexes = []
            for row in indexes_result:
                indexes.append({
                    'name': row[0],  # index_name
                    'column': row[1],  # column_name
                    'sequence': row[2],  # seq_in_index
                    'unique': not row[3],  # non_unique
                    'type': row[4]  # index_type
                })
            
            return {
                'table_name': table_name,
                'statistics': {
                    'rows': result[0],  # table_rows
                    'avg_row_length': result[1],  # avg_row_length
                    'data_size_mb': round(result[2] / (1024 * 1024), 2),  # data_length
                    'index_size_mb': round(result[3] / (1024 * 1024), 2),  # index_length
                    'total_size_mb': round(result[4] / (1024 * 1024), 2),  # total_size
                    'index_ratio_percent': result[5]  # index_ratio
                },
                'indexes': indexes,
                'recommendations': self._get_table_recommendations(table_name, result, indexes)
            }
            
        except Exception as e:
            logger.error(f"Error analyzing table {table_name}: {e}")
            return {'error': str(e)}
    
    def _get_table_recommendations(self, table_name: str, stats: Any, indexes: List[Dict]) -> List[str]:
        """Get optimization recommendations for a table"""
        recommendations = []
        
        # Check index ratio
        if stats.index_ratio < 10:
            recommendations.append("Low index ratio - consider adding more indexes for better query performance")
        elif stats.index_ratio > 50:
            recommendations.append("High index ratio - consider removing unused indexes to improve write performance")
        
        # Check for missing common indexes
        index_columns = {idx['column'] for idx in indexes}
        
        if table_name == 'images':
            if 'uploaded_at' not in index_columns:
                recommendations.append("Missing index on uploaded_at - needed for date-based sorting")
            if 'file_size' not in index_columns:
                recommendations.append("Missing index on file_size - needed for size-based filtering")
            if 'mime_type' not in index_columns:
                recommendations.append("Missing index on mime_type - needed for format-based filtering")
        
        elif table_name == 'playlists':
            if 'is_default' not in index_columns:
                recommendations.append("Missing index on is_default - needed for default playlist queries")
        
        elif table_name == 'albums':
            if 'name' not in index_columns:
                recommendations.append("Missing index on name - needed for album name searches")
        
        return recommendations
    
    def get_database_performance_summary(self) -> Dict[str, Any]:
        """Get overall database performance summary"""
        try:
            # Get all tables
            tables_query = """
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = DATABASE() 
              AND table_type = 'BASE TABLE'
            ORDER BY table_name
            """
            
            tables_result = self.db.execute(text(tables_query))
            tables = [row[0] for row in tables_result]  # Access by index instead of column name
            
            # Analyze each table
            table_analyses = {}
            total_data_size = 0
            total_index_size = 0
            total_rows = 0
            
            for table in tables:
                analysis = self.analyze_table_performance(table)
                if 'error' not in analysis:
                    table_analyses[table] = analysis
                    stats = analysis['statistics']
                    total_data_size += stats['data_size_mb']
                    total_index_size += stats['index_size_mb']
                    total_rows += stats['rows']
            
            # Get slow query log status
            slow_query_info = self._get_slow_query_info()
            
            return {
                'database_name': self._get_database_name(),
                'tables': table_analyses,
                'summary': {
                    'total_tables': len(tables),
                    'total_rows': total_rows,
                    'total_data_size_mb': round(total_data_size, 2),
                    'total_index_size_mb': round(total_index_size, 2),
                    'overall_index_ratio': round((total_index_size / (total_data_size + total_index_size)) * 100, 2) if (total_data_size + total_index_size) > 0 else 0
                },
                'slow_query_info': slow_query_info,
                'recommendations': self._get_global_recommendations(table_analyses)
            }
            
        except Exception as e:
            logger.error(f"Error getting database performance summary: {e}")
            return {'error': str(e)}
    
    def _get_database_name(self) -> str:
        """Get current database name"""
        result = self.db.execute(text("SELECT DATABASE() as db_name")).fetchone()
        return result[0] if result else 'unknown'
    
    def _get_slow_query_info(self) -> Dict[str, Any]:
        """Get slow query log configuration"""
        try:
            # Check if slow query log is enabled
            slow_log_query = "SHOW VARIABLES LIKE 'slow_query_log'"
            slow_log_result = self.db.execute(text(slow_log_query)).fetchone()
            
            # Get slow query time threshold
            slow_time_query = "SHOW VARIABLES LIKE 'long_query_time'"
            slow_time_result = self.db.execute(text(slow_time_query)).fetchone()
            
            return {
                'slow_query_log_enabled': slow_log_result[1] == 'ON' if slow_log_result else False,
                'slow_query_time_threshold': float(slow_time_result[1]) if slow_time_result else 10.0
            }
        except Exception as e:
            logger.error(f"Error getting slow query info: {e}")
            return {'error': str(e)}
    
    def _get_global_recommendations(self, table_analyses: Dict[str, Any]) -> List[str]:
        """Get global optimization recommendations"""
        recommendations = []
        
        # Check overall index ratio
        total_data = sum(analysis['statistics']['data_size_mb'] for analysis in table_analyses.values())
        total_index = sum(analysis['statistics']['index_size_mb'] for analysis in table_analyses.values())
        
        if total_data + total_index > 0:
            index_ratio = (total_index / (total_data + total_index)) * 100
            if index_ratio < 15:
                recommendations.append("Overall index ratio is low - consider adding more indexes for better query performance")
            elif index_ratio > 40:
                recommendations.append("Overall index ratio is high - consider reviewing and removing unused indexes")
        
        # Check for tables without indexes
        tables_without_indexes = [
            table for table, analysis in table_analyses.items()
            if len(analysis['indexes']) <= 1  # Only primary key
        ]
        
        if tables_without_indexes:
            recommendations.append(f"Tables without custom indexes: {', '.join(tables_without_indexes)}")
        
        return recommendations
