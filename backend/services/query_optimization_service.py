"""
Database query optimization service.
Provides optimized database queries and integrates with performance monitoring.
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, text
from typing import List, Optional, Dict, Any, Tuple
from models import Image, Album, Playlist
import logging
from utils.performance_middleware import profile_query

logger = logging.getLogger(__name__)

class QueryOptimizationService:
    """Service for optimized database queries with performance monitoring"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_images_optimized(
        self, 
        album_id: Optional[int] = None,
        playlist_id: Optional[int] = None,
        limit: int = 100,
        offset: int = 0,
        order_by: str = "uploaded_at",
        order_desc: bool = True
    ) -> List[Image]:
        """Optimized image retrieval with proper indexing and pagination"""
        
        query = "SELECT * FROM images"
        params = []
        
        # Build WHERE clause
        where_conditions = []
        if album_id:
            where_conditions.append("album_id = :album_id")
            params.append(album_id)
        if playlist_id:
            where_conditions.append("playlist_id = :playlist_id")
            params.append(playlist_id)
        
        if where_conditions:
            query += " WHERE " + " AND ".join(where_conditions)
        
        # Add ORDER BY with proper indexing
        order_direction = "DESC" if order_desc else "ASC"
        if order_by == "uploaded_at":
            query += f" ORDER BY uploaded_at {order_direction}"
        elif order_by == "file_size":
            query += f" ORDER BY file_size {order_direction}"
        elif order_by == "filename":
            query += f" ORDER BY filename {order_direction}"
        else:
            query += f" ORDER BY id {order_direction}"
        
        # Add pagination
        query += " LIMIT :limit OFFSET :offset"
        params.extend([limit, offset])
        
        with profile_query(f"get_images_optimized: {query[:100]}"):
            # Create parameter dictionary
            param_dict = {}
            if album_id:
                param_dict["album_id"] = album_id
            if playlist_id:
                param_dict["playlist_id"] = playlist_id
            param_dict["limit"] = limit
            param_dict["offset"] = offset
            
            result = self.db.execute(text(query), param_dict)
            images = []
            for row in result:
                image = Image()
                for key, value in row._mapping.items():
                    setattr(image, key, value)
                images.append(image)
            
            return images
    
    def get_playlist_images_optimized(self, playlist_id: int) -> List[Image]:
        """Optimized playlist image retrieval using JSON operations"""
        
        query = """
        SELECT i.*, 
               CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(JSON_SEARCH(p.sequence, 'one', CAST(i.id AS CHAR)), '[', -1), ']', 1) AS UNSIGNED) as sequence_position
        FROM images i
        JOIN playlists p ON i.playlist_id = p.id
        WHERE p.id = :playlist_id AND i.playlist_id = :playlist_id2
        ORDER BY 
            CASE 
                WHEN JSON_SEARCH(p.sequence, 'one', CAST(i.id AS CHAR)) IS NOT NULL 
                THEN CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(JSON_SEARCH(p.sequence, 'one', CAST(i.id AS CHAR)), '[', -1), ']', 1) AS UNSIGNED)
                ELSE 999999
            END
        """
        
        with profile_query(f"get_playlist_images_optimized: playlist_id={playlist_id}"):
            result = self.db.execute(text(query), {"playlist_id": playlist_id, "playlist_id2": playlist_id})
            images = []
            for row in result:
                image = Image()
                for key, value in row._mapping.items():
                    if key != 'sequence_position':
                        setattr(image, key, value)
                images.append(image)
            
            return images
    
    def get_duplicate_images_optimized(self) -> List[List[Image]]:
        """Optimized duplicate detection using SQL aggregation"""
        
        query = """
        SELECT file_size, width, height, COUNT(*) as count, GROUP_CONCAT(id) as image_ids
        FROM images 
        WHERE file_size IS NOT NULL 
          AND width IS NOT NULL 
          AND height IS NOT NULL
        GROUP BY file_size, width, height
        HAVING COUNT(*) > 1
        ORDER BY count DESC
        """
        
        with profile_query("get_duplicate_images_optimized"):
            result = self.db.execute(text(query))
            duplicates = []
            
            for row in result:
                image_ids = [int(id_str) for id_str in row.image_ids.split(',')]
                
                # Get the actual image objects
                placeholders = ",".join([f":id_{i}" for i in range(len(image_ids))])
                images_query = f"SELECT * FROM images WHERE id IN ({placeholders})"
                param_dict = {f"id_{i}": img_id for i, img_id in enumerate(image_ids)}
                images_result = self.db.execute(text(images_query), param_dict)
                
                image_group = []
                for img_row in images_result:
                    image = Image()
                    for key, value in img_row._mapping.items():
                        setattr(image, key, value)
                    image_group.append(image)
                
                duplicates.append(image_group)
            
            return duplicates
    
    def get_image_statistics_optimized(self) -> Dict[str, Any]:
        """Optimized statistics using SQL aggregation"""
        
        query = """
        SELECT 
            COUNT(*) as total_images,
            COALESCE(SUM(file_size), 0) as total_size_bytes,
            COUNT(DISTINCT mime_type) as format_count,
            AVG(file_size) as avg_file_size,
            MIN(file_size) as min_file_size,
            MAX(file_size) as max_file_size
        FROM images
        """
        
        with profile_query("get_image_statistics_optimized"):
            result = self.db.execute(text(query)).fetchone()
            
            # Get format distribution
            format_query = """
            SELECT mime_type, COUNT(*) as count
            FROM images 
            WHERE mime_type IS NOT NULL
            GROUP BY mime_type
            ORDER BY count DESC
            """
            
            format_result = self.db.execute(text(format_query))
            format_stats = {}
            for row in format_result:
                format_name = row.mime_type.split('/')[-1].upper() if row.mime_type else 'UNKNOWN'
                format_stats[format_name] = row.count
            
            return {
                'total_images': result.total_images,
                'total_size_bytes': result.total_size_bytes,
                'total_size_mb': round(result.total_size_bytes / (1024 * 1024), 2),
                'avg_file_size': round(result.avg_file_size or 0, 2),
                'min_file_size': result.min_file_size,
                'max_file_size': result.max_file_size,
                'format_distribution': format_stats,
                'unique_formats': result.format_count
            }
    
    def get_playlist_statistics_optimized(self) -> Dict[str, Any]:
        """Optimized playlist statistics using SQL aggregation"""
        
        query = """
        SELECT 
            COUNT(*) as total_playlists,
            COUNT(CASE WHEN is_default = 1 THEN 1 END) as default_count,
            COUNT(CASE WHEN JSON_LENGTH(sequence) > 0 THEN 1 END) as playlists_with_images,
            AVG(JSON_LENGTH(sequence)) as avg_images_per_playlist
        FROM playlists
        """
        
        with profile_query("get_playlist_statistics_optimized"):
            result = self.db.execute(text(query)).fetchone()
            
            return {
                'total_playlists': result.total_playlists,
                'default_playlists': result.default_count,
                'playlists_with_images': result.playlists_with_images,
                'empty_playlists': result.total_playlists - result.playlists_with_images,
                'avg_images_per_playlist': round(result.avg_images_per_playlist or 0, 2),
                'has_default_playlist': result.default_count > 0
            }
    
    def search_images_optimized(self, query: str, limit: int = 50) -> List[Image]:
        """Optimized image search with full-text indexing"""
        
        # Use LIKE with proper indexing
        search_query = """
        SELECT * FROM images 
        WHERE filename LIKE :search_term1 
           OR original_filename LIKE :search_term2
        ORDER BY 
            CASE 
                WHEN filename LIKE :exact_term1 THEN 1
                WHEN original_filename LIKE :exact_term2 THEN 2
                ELSE 3
            END,
            uploaded_at DESC
        LIMIT :limit
        """
        
        search_term = f"%{query}%"
        exact_term = f"{query}%"
        
        with profile_query(f"search_images_optimized: {query[:50]}"):
            result = self.db.execute(
                text(search_query), 
                {
                    "search_term1": search_term,
                    "search_term2": search_term,
                    "exact_term1": exact_term,
                    "exact_term2": exact_term,
                    "limit": limit
                }
            )
            
            images = []
            for row in result:
                image = Image()
                for key, value in row._mapping.items():
                    setattr(image, key, value)
                images.append(image)
            
            return images
    
    def get_album_statistics_optimized(self) -> Dict[str, Any]:
        """Optimized album statistics using SQL aggregation"""
        
        query = """
        SELECT 
            COUNT(*) as total_albums,
            COUNT(CASE WHEN ai.image_id IS NOT NULL THEN 1 END) as albums_with_images,
            AVG(album_image_counts.image_count) as avg_images_per_album
        FROM albums a
        LEFT JOIN (
            SELECT album_id, COUNT(*) as image_count
            FROM images 
            WHERE album_id IS NOT NULL
            GROUP BY album_id
        ) album_image_counts ON a.id = album_image_counts.album_id
        LEFT JOIN images ai ON a.id = ai.album_id
        """
        
        with profile_query("get_album_statistics_optimized"):
            result = self.db.execute(text(query)).fetchone()
            
            return {
                'total_albums': result.total_albums,
                'albums_with_images': result.albums_with_images,
                'empty_albums': result.total_albums - result.albums_with_images,
                'avg_images_per_album': round(result.avg_images_per_album or 0, 2)
            }
    
    def get_recent_images_optimized(self, limit: int = 20) -> List[Image]:
        """Get recently uploaded images with optimized query"""
        
        query = """
        SELECT * FROM images 
        ORDER BY uploaded_at DESC 
        LIMIT :limit
        """
        
        with profile_query(f"get_recent_images_optimized: limit={limit}"):
            result = self.db.execute(text(query), {"limit": limit})
            
            images = []
            for row in result:
                image = Image()
                for key, value in row._mapping.items():
                    setattr(image, key, value)
                images.append(image)
            
            return images
    
    def get_images_by_format_optimized(self, mime_type: str, limit: int = 100) -> List[Image]:
        """Get images by format with optimized query"""
        
        query = """
        SELECT * FROM images 
        WHERE mime_type = :mime_type
        ORDER BY uploaded_at DESC
        LIMIT :limit
        """
        
        with profile_query(f"get_images_by_format_optimized: {mime_type}"):
            result = self.db.execute(text(query), {"mime_type": mime_type, "limit": limit})
            
            images = []
            for row in result:
                image = Image()
                for key, value in row._mapping.items():
                    setattr(image, key, value)
                images.append(image)
            
            return images
