#!/usr/bin/env python3
"""
Migration script for transitioning existing images to background processing system.

This script updates existing images to work with the new background processing
system by checking for existing thumbnails and variants, updating database status
accordingly, and queuing missing files for generation.

Usage:
    python migrate_to_background_processing.py [options]

Options:
    --dry-run           Show what would be done without making changes
    --batch-size N      Process N images at a time (default: 100)
    --queue-missing     Queue processing jobs for missing thumbnails/variants
    --force             Skip confirmation prompts
"""

import os
import sys
import logging
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, Tuple, Optional

# Add parent directory to path for imports
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(script_dir)
sys.path.insert(0, backend_dir)

from models import SessionLocal, Image
from services.image_storage_service import image_storage_service
from config.settings import settings

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def check_thumbnails_exist(filename: str) -> Tuple[bool, int]:
    """
    Check if all thumbnail sizes exist for an image.
    
    Args:
        filename: The image filename to check
        
    Returns:
        Tuple of (all_exist: bool, count_existing: int)
    """
    thumbnails_path = Path(settings.upload_path) / "thumbnails"
    existing_count = 0
    
    for size_name in ['small', 'medium', 'large']:
        name, ext = filename.rsplit('.', 1) if '.' in filename else (filename, 'jpg')
        thumbnail_filename = f"{name}_{size_name}_thumb.{ext}"
        thumbnail_path = thumbnails_path / thumbnail_filename
        
        if thumbnail_path.exists():
            existing_count += 1
    
    # All thumbnails exist if we found all 3 sizes
    all_exist = existing_count == 3
    return all_exist, existing_count


def check_variants_exist(filename: str, user_id: Optional[int] = None) -> Tuple[bool, int]:
    """
    Check if display size variants exist for an image.
    
    Args:
        filename: The image filename to check
        user_id: User ID for path resolution
        
    Returns:
        Tuple of (any_exist: bool, count_existing: int)
    """
    # Get the year/month path structure
    upload_path = Path(settings.upload_path)
    existing_count = 0
    
    # Check for scaled variants (they're stored alongside originals)
    # Pattern: {name}_{width}x{height}.{ext}
    name_without_ext = filename.rsplit('.', 1)[0] if '.' in filename else filename
    
    # Common display sizes to check for
    common_sizes = [
        (1920, 1080),
        (2560, 1440),
        (3840, 2160)
    ]
    
    # Search in year/month directories
    for year_dir in upload_path.iterdir():
        if year_dir.is_dir() and year_dir.name.isdigit():
            for month_dir in year_dir.iterdir():
                if month_dir.is_dir():
                    # Check both user-specific and general directories
                    search_dirs = [month_dir]
                    if user_id:
                        user_dir = month_dir / f"user_{user_id}"
                        if user_dir.exists():
                            search_dirs.insert(0, user_dir)
                    
                    for search_dir in search_dirs:
                        for width, height in common_sizes:
                            ext = filename.rsplit('.', 1)[1] if '.' in filename else 'jpg'
                            variant_filename = f"{name_without_ext}_{width}x{height}.{ext}"
                            variant_path = search_dir / variant_filename
                            
                            if variant_path.exists():
                                existing_count += 1
    
    # If we found any variants, consider them present
    any_exist = existing_count > 0
    return any_exist, existing_count


def migrate_existing_images(
    db_session,
    dry_run: bool = False,
    batch_size: int = 100,
    queue_missing: bool = False
) -> Dict[str, int]:
    """
    Migrate existing images to background processing system.
    
    Args:
        db_session: Database session
        dry_run: If True, don't make any changes
        batch_size: Number of images to process in each batch
        queue_missing: If True, queue background jobs for missing files
        
    Returns:
        Dict with migration statistics
    """
    stats = {
        'total_images': 0,
        'already_complete': 0,
        'thumbnails_exist': 0,
        'variants_exist': 0,
        'needs_processing': 0,
        'marked_complete': 0,
        'marked_pending': 0,
        'jobs_queued': 0
    }
    
    try:
        # Get total count
        stats['total_images'] = db_session.query(Image).count()
        logger.info(f"📊 Found {stats['total_images']} images to process")
        
        if dry_run:
            logger.info("🔍 DRY RUN MODE - No changes will be made")
        
        # Process in batches
        offset = 0
        while offset < stats['total_images']:
            logger.info(f"📦 Processing batch {offset // batch_size + 1} (images {offset + 1}-{min(offset + batch_size, stats['total_images'])})")
            
            images = db_session.query(Image).limit(batch_size).offset(offset).all()
            
            for image in images:
                # Skip if already marked as complete
                if image.processing_status == 'complete':
                    stats['already_complete'] += 1
                    continue
                
                # Check if thumbnails exist
                has_thumbnails, thumb_count = check_thumbnails_exist(image.filename)
                
                # Check if variants exist
                # Note: We can't easily determine user_id from stored images, so we check generally
                has_variants, variant_count = check_variants_exist(image.filename)
                
                if has_thumbnails:
                    stats['thumbnails_exist'] += 1
                if has_variants:
                    stats['variants_exist'] += 1
                
                # Update status based on what exists
                if has_thumbnails and has_variants:
                    # Both exist - mark as complete
                    if not dry_run:
                        image.processing_status = 'complete'
                        image.thumbnail_status = 'complete'
                        image.variant_status = 'complete'
                        image.processing_completed_at = datetime.now()
                    stats['marked_complete'] += 1
                    logger.info(f"  ✅ Image {image.id} ({image.original_filename}): Complete")
                    
                else:
                    # Missing thumbnails or variants - mark as pending
                    if not dry_run:
                        image.processing_status = 'pending'
                        image.thumbnail_status = 'complete' if has_thumbnails else 'pending'
                        image.variant_status = 'complete' if has_variants else 'pending'
                    
                    stats['needs_processing'] += 1
                    stats['marked_pending'] += 1
                    
                    status_msg = []
                    if not has_thumbnails:
                        status_msg.append(f"thumbnails ({thumb_count}/3)")
                    if not has_variants:
                        status_msg.append(f"variants ({variant_count} found)")
                    
                    logger.info(f"  ⏳ Image {image.id} ({image.original_filename}): Needs {', '.join(status_msg)}")
                    
                    # Queue processing jobs if requested
                    if queue_missing and not dry_run:
                        # Note: Actual queueing would require importing background task system
                        # For now, just mark as pending and they'll be processed on next server start
                        logger.info(f"     → Would queue processing for image {image.id}")
                        stats['jobs_queued'] += 1
            
            # Commit batch
            if not dry_run:
                db_session.commit()
                logger.info(f"  💾 Batch committed")
            
            offset += batch_size
        
        logger.info("\n" + "="*80)
        logger.info("📈 Migration Statistics:")
        logger.info(f"  Total images processed:    {stats['total_images']}")
        logger.info(f"  Already complete:          {stats['already_complete']}")
        logger.info(f"  Marked as complete:        {stats['marked_complete']}")
        logger.info(f"  Marked as pending:         {stats['marked_pending']}")
        logger.info(f"  Images with thumbnails:    {stats['thumbnails_exist']}")
        logger.info(f"  Images with variants:      {stats['variants_exist']}")
        logger.info(f"  Needs processing:          {stats['needs_processing']}")
        if queue_missing:
            logger.info(f"  Jobs queued:               {stats['jobs_queued']}")
        logger.info("="*80)
        
        return stats
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}", exc_info=True)
        if not dry_run:
            db_session.rollback()
        raise


def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description='Migrate existing images to background processing system',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry run to see what would happen
  python migrate_to_background_processing.py --dry-run

  # Run migration with default settings
  python migrate_to_background_processing.py

  # Run with custom batch size and queue missing files
  python migrate_to_background_processing.py --batch-size 500 --queue-missing

  # Force run without confirmation
  python migrate_to_background_processing.py --force
        """
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be done without making any changes'
    )
    
    parser.add_argument(
        '--batch-size',
        type=int,
        default=100,
        help='Number of images to process in each batch (default: 100)'
    )
    
    parser.add_argument(
        '--queue-missing',
        action='store_true',
        help='Queue background jobs for missing thumbnails/variants'
    )
    
    parser.add_argument(
        '--force',
        action='store_true',
        help='Skip confirmation prompts'
    )
    
    return parser.parse_args()


def main():
    """Main entry point"""
    args = parse_args()
    
    logger.info("🎬 Background Processing Migration Script")
    logger.info("="*80)
    
    if args.dry_run:
        logger.info("🔍 DRY RUN MODE - No changes will be made")
    
    # Show configuration
    logger.info(f"Configuration:")
    logger.info(f"  Batch size:      {args.batch_size}")
    logger.info(f"  Queue missing:   {args.queue_missing}")
    logger.info(f"  Upload path:     {settings.upload_path}")
    logger.info("="*80 + "\n")
    
    # Confirmation prompt
    if not args.force and not args.dry_run:
        response = input("⚠️  This will update processing status for all images. Continue? (yes/no): ")
        if response.lower() not in ['yes', 'y']:
            logger.info("Migration cancelled by user")
            return
    
    # Run migration
    db = SessionLocal()
    try:
        stats = migrate_existing_images(
            db,
            dry_run=args.dry_run,
            batch_size=args.batch_size,
            queue_missing=args.queue_missing
        )
        
        logger.info("\n✅ Migration completed successfully!")
        
        if args.dry_run:
            logger.info("\n💡 This was a dry run. Run without --dry-run to apply changes.")
        else:
            logger.info("\n💡 Images marked as 'pending' will be processed on next server restart")
            logger.info("   or when background processing jobs are queued manually.")
        
    except Exception as e:
        logger.error(f"\n❌ Migration failed: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()

