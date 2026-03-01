#!/usr/bin/env python3
"""
Performance testing script to measure and validate performance improvements.
Tests API endpoints, database queries, and caching effectiveness.
"""

import sys
import os
import time
import asyncio
import aiohttp
import json
import statistics
from pathlib import Path
from typing import Dict, List, Any
import logging

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy.orm import Session
from models.database import SessionLocal
from services.image_service import ImageService
from services.playlist_service import PlaylistService
from services.caching_service import get_cache_stats, clear_cache

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PerformanceTester:
    """Performance testing class for measuring improvements"""
    
    def __init__(self, base_url: str = "http://localhost:8001"):
        self.base_url = base_url
        self.results = {}
    
    async def test_api_endpoint(self, endpoint: str, method: str = "GET", 
                               data: Dict = None, headers: Dict = None) -> Dict[str, Any]:
        """Test a single API endpoint and measure performance"""
        url = f"{self.base_url}{endpoint}"
        
        async with aiohttp.ClientSession() as session:
            start_time = time.time()
            
            try:
                if method == "GET":
                    async with session.get(url, headers=headers) as response:
                        content = await response.text()
                        status_code = response.status
                elif method == "POST":
                    async with session.post(url, json=data, headers=headers) as response:
                        content = await response.text()
                        status_code = response.status
                else:
                    raise ValueError(f"Unsupported method: {method}")
                
                end_time = time.time()
                duration = end_time - start_time
                
                return {
                    'endpoint': endpoint,
                    'method': method,
                    'status_code': status_code,
                    'duration_ms': round(duration * 1000, 2),
                    'success': 200 <= status_code < 300,
                    'content_length': len(content)
                }
                
            except Exception as e:
                end_time = time.time()
                duration = end_time - start_time
                
                return {
                    'endpoint': endpoint,
                    'method': method,
                    'status_code': 0,
                    'duration_ms': round(duration * 1000, 2),
                    'success': False,
                    'error': str(e)
                }
    
    async def test_api_endpoints(self, endpoints: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Test multiple API endpoints and return aggregated results"""
        results = []
        
        for endpoint_config in endpoints:
            result = await self.test_api_endpoint(**endpoint_config)
            results.append(result)
            logger.info(f"Tested {endpoint_config['endpoint']}: {result['duration_ms']}ms")
        
        # Calculate statistics
        durations = [r['duration_ms'] for r in results if r['success']]
        success_count = sum(1 for r in results if r['success'])
        
        return {
            'total_tests': len(results),
            'successful_tests': success_count,
            'failed_tests': len(results) - success_count,
            'avg_duration_ms': round(statistics.mean(durations), 2) if durations else 0,
            'min_duration_ms': round(min(durations), 2) if durations else 0,
            'max_duration_ms': round(max(durations), 2) if durations else 0,
            'median_duration_ms': round(statistics.median(durations), 2) if durations else 0,
            'results': results
        }
    
    def test_database_queries(self) -> Dict[str, Any]:
        """Test database query performance"""
        db = SessionLocal()
        results = {}
        
        try:
            # Test image service queries
            image_service = ImageService(db)
            
            # Test get_all_images
            start_time = time.time()
            images = image_service.get_all_images(limit=50)
            end_time = time.time()
            results['get_all_images'] = {
                'duration_ms': round((end_time - start_time) * 1000, 2),
                'result_count': len(images)
            }
            
            # Test image statistics
            start_time = time.time()
            stats = image_service.get_image_statistics()
            end_time = time.time()
            results['image_statistics'] = {
                'duration_ms': round((end_time - start_time) * 1000, 2),
                'result_count': stats.get('total_images', 0)
            }
            
            # Test duplicate images
            start_time = time.time()
            duplicates = image_service.get_duplicate_images()
            end_time = time.time()
            results['duplicate_images'] = {
                'duration_ms': round((end_time - start_time) * 1000, 2),
                'result_count': len(duplicates)
            }
            
            # Test playlist service queries
            playlist_service = PlaylistService(db)
            
            # Test get_all_playlists
            start_time = time.time()
            playlists = playlist_service.get_all_playlists()
            end_time = time.time()
            results['get_all_playlists'] = {
                'duration_ms': round((end_time - start_time) * 1000, 2),
                'result_count': len(playlists)
            }
            
            # Test playlist statistics
            start_time = time.time()
            stats = playlist_service.get_playlist_statistics()
            end_time = time.time()
            results['playlist_statistics'] = {
                'duration_ms': round((end_time - start_time) * 1000, 2),
                'result_count': stats.get('total_playlists', 0)
            }
            
            # Test playlist images (if playlists exist)
            if playlists:
                playlist_id = playlists[0].id
                start_time = time.time()
                images = playlist_service.get_playlist_images_ordered(playlist_id)
                end_time = time.time()
                results['playlist_images'] = {
                    'duration_ms': round((end_time - start_time) * 1000, 2),
                    'result_count': len(images)
                }
            
        finally:
            db.close()
        
        return results
    
    def test_caching_performance(self) -> Dict[str, Any]:
        """Test caching performance and effectiveness"""
        db = SessionLocal()
        results = {}
        
        try:
            # Clear cache first
            clear_cache()
            
            # Test image service with caching
            image_service = ImageService(db)
            
            # First call (cache miss)
            start_time = time.time()
            stats1 = image_service.get_image_statistics()
            end_time = time.time()
            first_call_duration = round((end_time - start_time) * 1000, 2)
            
            # Second call (cache hit)
            start_time = time.time()
            stats2 = image_service.get_image_statistics()
            end_time = time.time()
            second_call_duration = round((end_time - start_time) * 1000, 2)
            
            # Get cache stats
            cache_stats = get_cache_stats()
            
            results['image_statistics_caching'] = {
                'first_call_ms': first_call_duration,
                'second_call_ms': second_call_duration,
                'cache_hit_improvement': round(((first_call_duration - second_call_duration) / first_call_duration) * 100, 2) if first_call_duration > 0 else 0,
                'cache_stats': cache_stats
            }
            
            # Test playlist service with caching
            playlist_service = PlaylistService(db)
            
            # First call (cache miss)
            start_time = time.time()
            stats1 = playlist_service.get_playlist_statistics()
            end_time = time.time()
            first_call_duration = round((end_time - start_time) * 1000, 2)
            
            # Second call (cache hit)
            start_time = time.time()
            stats2 = playlist_service.get_playlist_statistics()
            end_time = time.time()
            second_call_duration = round((end_time - start_time) * 1000, 2)
            
            results['playlist_statistics_caching'] = {
                'first_call_ms': first_call_duration,
                'second_call_ms': second_call_duration,
                'cache_hit_improvement': round(((first_call_duration - second_call_duration) / first_call_duration) * 100, 2) if first_call_duration > 0 else 0
            }
            
        finally:
            db.close()
        
        return results
    
    async def run_comprehensive_test(self) -> Dict[str, Any]:
        """Run comprehensive performance tests"""
        logger.info("Starting comprehensive performance testing...")
        
        # Test API endpoints
        logger.info("Testing API endpoints...")
        api_endpoints = [
            {'endpoint': '/health', 'method': 'GET'},
            {'endpoint': '/api/performance/stats', 'method': 'GET'},
            {'endpoint': '/api/cache/stats', 'method': 'GET'},
        ]
        
        api_results = await self.test_api_endpoints(api_endpoints)
        
        # Test database queries
        logger.info("Testing database queries...")
        db_results = self.test_database_queries()
        
        # Test caching performance
        logger.info("Testing caching performance...")
        cache_results = self.test_caching_performance()
        
        # Compile comprehensive results
        comprehensive_results = {
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            'api_performance': api_results,
            'database_performance': db_results,
            'caching_performance': cache_results,
            'summary': {
                'total_api_tests': api_results['total_tests'],
                'successful_api_tests': api_results['successful_tests'],
                'avg_api_response_time_ms': api_results['avg_duration_ms'],
                'database_queries_tested': len(db_results),
                'avg_db_query_time_ms': round(statistics.mean([r['duration_ms'] for r in db_results.values()]), 2) if db_results else 0,
                'cache_effectiveness': cache_results.get('image_statistics_caching', {}).get('cache_hit_improvement', 0)
            }
        }
        
        return comprehensive_results

async def main():
    """Main function to run performance tests"""
    try:
        tester = PerformanceTester()
        results = await tester.run_comprehensive_test()
        
        # Print results
        print("\n" + "="*60)
        print("PERFORMANCE TEST RESULTS")
        print("="*60)
        
        print(f"\nTimestamp: {results['timestamp']}")
        
        print(f"\nAPI Performance:")
        print(f"  Total tests: {results['summary']['total_api_tests']}")
        print(f"  Successful: {results['summary']['successful_api_tests']}")
        print(f"  Average response time: {results['summary']['avg_api_response_time_ms']}ms")
        
        print(f"\nDatabase Performance:")
        print(f"  Queries tested: {results['summary']['database_queries_tested']}")
        print(f"  Average query time: {results['summary']['avg_db_query_time_ms']}ms")
        
        for query_name, query_result in results['database_performance'].items():
            print(f"    {query_name}: {query_result['duration_ms']}ms ({query_result['result_count']} results)")
        
        print(f"\nCaching Performance:")
        cache_perf = results['caching_performance']
        if 'image_statistics_caching' in cache_perf:
            img_cache = cache_perf['image_statistics_caching']
            print(f"  Image statistics cache improvement: {img_cache['cache_hit_improvement']}%")
            print(f"    First call: {img_cache['first_call_ms']}ms")
            print(f"    Second call: {img_cache['second_call_ms']}ms")
        
        if 'playlist_statistics_caching' in cache_perf:
            pl_cache = cache_perf['playlist_statistics_caching']
            print(f"  Playlist statistics cache improvement: {pl_cache['cache_hit_improvement']}%")
            print(f"    First call: {pl_cache['first_call_ms']}ms")
            print(f"    Second call: {pl_cache['second_call_ms']}ms")
        
        # Save results to file
        results_file = Path(__file__).parent / "performance_test_results.json"
        with open(results_file, 'w') as f:
            json.dump(results, f, indent=2)
        
        print(f"\nDetailed results saved to: {results_file}")
        print("="*60)
        
        return 0
        
    except Exception as e:
        logger.error(f"Error during performance testing: {e}")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)



















