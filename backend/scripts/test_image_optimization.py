#!/usr/bin/env python3
"""
Test script for image optimization features
Tests WebP/AVIF conversion, caching, and preloading performance
"""

import asyncio
import aiohttp
import time
import json
import logging
from pathlib import Path
from typing import Dict, Any, List

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ImageOptimizationTester:
    """Test image optimization features"""
    
    def __init__(self, base_url: str = "http://localhost:8001"):
        self.base_url = base_url
        self.session = None
        self.results = {}
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def test_optimized_image_endpoint(self, image_id: int, formats: List[str] = ["webp", "avif", "jpeg"]) -> Dict[str, Any]:
        """Test optimized image endpoint with different formats"""
        results = {}
        
        for format_name in formats:
            try:
                # Test with Accept header for format detection
                headers = {"Accept": f"image/{format_name},image/*,*/*"}
                
                start_time = time.perf_counter()
                
                async with self.session.get(
                    f"{self.base_url}/api/images/{image_id}/optimized",
                    headers=headers,
                    params={"width": 800, "height": 600, "quality": 85}
                ) as response:
                    end_time = time.perf_counter()
                    
                    if response.status == 200:
                        content_length = response.headers.get("Content-Length", "0")
                        content_type = response.headers.get("Content-Type", "")
                        cache_control = response.headers.get("Cache-Control", "")
                        etag = response.headers.get("ETag", "")
                        
                        results[format_name] = {
                            "success": True,
                            "response_time_ms": (end_time - start_time) * 1000,
                            "content_length": int(content_length),
                            "content_type": content_type,
                            "cache_control": cache_control,
                            "etag": etag,
                            "status_code": response.status
                        }
                        
                        logger.info(f"✅ {format_name}: {results[format_name]['response_time_ms']:.2f}ms, {content_length} bytes")
                    else:
                        results[format_name] = {
                            "success": False,
                            "status_code": response.status,
                            "error": await response.text()
                        }
                        
                        logger.error(f"❌ {format_name}: HTTP {response.status}")
                        
            except Exception as e:
                results[format_name] = {
                    "success": False,
                    "error": str(e)
                }
                logger.error(f"❌ {format_name}: {e}")
        
        return results
    
    async def test_preload_functionality(self, playlist_id: int = 1) -> Dict[str, Any]:
        """Test slideshow preload functionality"""
        results = {}
        
        try:
            # Test preload recommendations
            logger.info("Testing preload recommendations...")
            start_time = time.perf_counter()
            
            async with self.session.get(
                f"{self.base_url}/api/slideshow/preload/recommendations/{playlist_id}"
            ) as response:
                end_time = time.perf_counter()
                
                if response.status == 200:
                    data = await response.json()
                    results["recommendations"] = {
                        "success": True,
                        "response_time_ms": (end_time - start_time) * 1000,
                        "data": data.get("data", {})
                    }
                    logger.info(f"✅ Recommendations: {results['recommendations']['response_time_ms']:.2f}ms")
                else:
                    results["recommendations"] = {
                        "success": False,
                        "status_code": response.status
                    }
                    logger.error(f"❌ Recommendations: HTTP {response.status}")
            
            # Test queue preload request
            logger.info("Testing preload queue...")
            start_time = time.perf_counter()
            
            async with self.session.post(
                f"{self.base_url}/api/slideshow/preload/queue/{playlist_id}",
                json={"formats": ["webp", "avif"], "priority": "normal"}
            ) as response:
                end_time = time.perf_counter()
                
                if response.status == 200:
                    data = await response.json()
                    results["queue_preload"] = {
                        "success": True,
                        "response_time_ms": (end_time - start_time) * 1000,
                        "data": data.get("data", {})
                    }
                    logger.info(f"✅ Queue preload: {results['queue_preload']['response_time_ms']:.2f}ms")
                else:
                    results["queue_preload"] = {
                        "success": False,
                        "status_code": response.status
                    }
                    logger.error(f"❌ Queue preload: HTTP {response.status}")
            
            # Test preload status
            logger.info("Testing preload status...")
            start_time = time.perf_counter()
            
            async with self.session.get(
                f"{self.base_url}/api/slideshow/preload/status/{playlist_id}"
            ) as response:
                end_time = time.perf_counter()
                
                if response.status == 200:
                    data = await response.json()
                    results["preload_status"] = {
                        "success": True,
                        "response_time_ms": (end_time - start_time) * 1000,
                        "data": data.get("data", {})
                    }
                    logger.info(f"✅ Preload status: {results['preload_status']['response_time_ms']:.2f}ms")
                else:
                    results["preload_status"] = {
                        "success": False,
                        "status_code": response.status
                    }
                    logger.error(f"❌ Preload status: HTTP {response.status}")
            
        except Exception as e:
            results["error"] = str(e)
            logger.error(f"❌ Preload test error: {e}")
        
        return results
    
    async def test_cache_management(self) -> Dict[str, Any]:
        """Test cache management endpoints"""
        results = {}
        
        try:
            # Test cache stats
            logger.info("Testing cache stats...")
            start_time = time.perf_counter()
            
            async with self.session.get(
                f"{self.base_url}/api/images/cache/stats"
            ) as response:
                end_time = time.perf_counter()
                
                if response.status == 200:
                    data = await response.json()
                    results["cache_stats"] = {
                        "success": True,
                        "response_time_ms": (end_time - start_time) * 1000,
                        "data": data.get("data", {})
                    }
                    logger.info(f"✅ Cache stats: {results['cache_stats']['response_time_ms']:.2f}ms")
                else:
                    results["cache_stats"] = {
                        "success": False,
                        "status_code": response.status
                    }
                    logger.error(f"❌ Cache stats: HTTP {response.status}")
            
            # Test preload cache stats
            logger.info("Testing preload cache stats...")
            start_time = time.perf_counter()
            
            async with self.session.get(
                f"{self.base_url}/api/slideshow/preload/cache/stats"
            ) as response:
                end_time = time.perf_counter()
                
                if response.status == 200:
                    data = await response.json()
                    results["preload_cache_stats"] = {
                        "success": True,
                        "response_time_ms": (end_time - start_time) * 1000,
                        "data": data.get("data", {})
                    }
                    logger.info(f"✅ Preload cache stats: {results['preload_cache_stats']['response_time_ms']:.2f}ms")
                else:
                    results["preload_cache_stats"] = {
                        "success": False,
                        "status_code": response.status
                    }
                    logger.error(f"❌ Preload cache stats: HTTP {response.status}")
            
        except Exception as e:
            results["error"] = str(e)
            logger.error(f"❌ Cache management test error: {e}")
        
        return results
    
    async def test_image_serving_performance(self, image_id: int) -> Dict[str, Any]:
        """Test image serving performance with different sizes"""
        results = {}
        
        sizes = [
            {"name": "original", "params": {}},
            {"name": "small", "params": {"width": 300, "height": 300}},
            {"name": "medium", "params": {"width": 800, "height": 600}},
            {"name": "large", "params": {"width": 1920, "height": 1080}}
        ]
        
        for size in sizes:
            try:
                logger.info(f"Testing {size['name']} image serving...")
                start_time = time.perf_counter()
                
                async with self.session.get(
                    f"{self.base_url}/api/images/{image_id}/optimized",
                    params=size["params"]
                ) as response:
                    end_time = time.perf_counter()
                    
                    if response.status == 200:
                        content_length = response.headers.get("Content-Length", "0")
                        content_type = response.headers.get("Content-Type", "")
                        cache_control = response.headers.get("Cache-Control", "")
                        
                        results[size["name"]] = {
                            "success": True,
                            "response_time_ms": (end_time - start_time) * 1000,
                            "content_length": int(content_length),
                            "content_type": content_type,
                            "cache_control": cache_control,
                            "status_code": response.status
                        }
                        
                        logger.info(f"✅ {size['name']}: {results[size['name']]['response_time_ms']:.2f}ms, {content_length} bytes")
                    else:
                        results[size["name"]] = {
                            "success": False,
                            "status_code": response.status,
                            "error": await response.text()
                        }
                        
                        logger.error(f"❌ {size['name']}: HTTP {response.status}")
                        
            except Exception as e:
                results[size["name"]] = {
                    "success": False,
                    "error": str(e)
                }
                logger.error(f"❌ {size['name']}: {e}")
        
        return results
    
    async def run_comprehensive_test(self, image_id: int = 1, playlist_id: int = 1) -> Dict[str, Any]:
        """Run comprehensive image optimization tests"""
        logger.info("Starting comprehensive image optimization testing...")
        
        results = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "image_id": image_id,
            "playlist_id": playlist_id
        }
        
        # Test optimized image endpoint
        logger.info("=" * 60)
        logger.info("Testing optimized image endpoint...")
        results["optimized_images"] = await self.test_optimized_image_endpoint(image_id)
        
        # Test image serving performance
        logger.info("=" * 60)
        logger.info("Testing image serving performance...")
        results["image_serving"] = await self.test_image_serving_performance(image_id)
        
        # Test preload functionality
        logger.info("=" * 60)
        logger.info("Testing preload functionality...")
        results["preload_tests"] = await self.test_preload_functionality(playlist_id)
        
        # Test cache management
        logger.info("=" * 60)
        logger.info("Testing cache management...")
        results["cache_management"] = await self.test_cache_management()
        
        return results

async def main():
    """Main test function"""
    async with ImageOptimizationTester() as tester:
        results = await tester.run_comprehensive_test()
        
        # Save results
        results_file = Path("image_optimization_test_results.json")
        with open(results_file, "w") as f:
            json.dump(results, f, indent=2)
        
        # Print summary
        logger.info("=" * 60)
        logger.info("IMAGE OPTIMIZATION TEST RESULTS")
        logger.info("=" * 60)
        
        # Optimized images summary
        if "optimized_images" in results:
            logger.info("Optimized Images:")
            for format_name, result in results["optimized_images"].items():
                if result.get("success"):
                    logger.info(f"  {format_name}: {result['response_time_ms']:.2f}ms, {result['content_length']} bytes")
                else:
                    logger.info(f"  {format_name}: FAILED")
        
        # Image serving summary
        if "image_serving" in results:
            logger.info("Image Serving Performance:")
            for size_name, result in results["image_serving"].items():
                if result.get("success"):
                    logger.info(f"  {size_name}: {result['response_time_ms']:.2f}ms, {result['content_length']} bytes")
                else:
                    logger.info(f"  {size_name}: FAILED")
        
        # Preload tests summary
        if "preload_tests" in results:
            logger.info("Preload Tests:")
            for test_name, result in results["preload_tests"].items():
                if isinstance(result, dict) and result.get("success"):
                    logger.info(f"  {test_name}: {result['response_time_ms']:.2f}ms")
                else:
                    logger.info(f"  {test_name}: FAILED")
        
        # Cache management summary
        if "cache_management" in results:
            logger.info("Cache Management:")
            for test_name, result in results["cache_management"].items():
                if isinstance(result, dict) and result.get("success"):
                    logger.info(f"  {test_name}: {result['response_time_ms']:.2f}ms")
                else:
                    logger.info(f"  {test_name}: FAILED")
        
        logger.info(f"Detailed results saved to: {results_file}")

if __name__ == "__main__":
    asyncio.run(main())
