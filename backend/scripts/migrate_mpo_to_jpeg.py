import io
import logging
import os
import sys
from pathlib import Path
import re

# Ensure backend root is on sys.path for imports like `models` and `services`
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_ROOT = os.path.dirname(CURRENT_DIR)
if BACKEND_ROOT not in sys.path:
    sys.path.append(BACKEND_ROOT)

from PIL import Image as PILImage

from models.database import initialize_database
from models.image import Image
from services.image_storage_service import image_storage_service


logger = logging.getLogger(__name__)


def convert_file_to_jpeg(src_path: Path) -> bytes:
    with PILImage.open(src_path) as img:
        try:
            if getattr(img, "format", "").upper() == "MPO":
                try:
                    img.seek(0)
                except Exception:
                    pass
        except Exception:
            pass

        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGB")

        output = io.BytesIO()
        img.save(output, format="JPEG", quality=90, optimize=True)
        return output.getvalue()


def migrate_one(db, image: Image) -> bool:
    # Determine if this image needs migration
    needs_migration = False
    if image.mime_type and image.mime_type.lower() == "image/mpo":
        needs_migration = True
    if image.filename.lower().endswith(".mpo"):
        needs_migration = True

    if not needs_migration:
        return False

    # Locate original file
    original_path = image_storage_service.get_image_path(image.filename)
    if not original_path or not original_path.exists():
        logger.warning(f"Original file not found for image {image.id}: {image.filename}")
        return False

    # Convert to JPEG bytes
    jpeg_bytes = convert_file_to_jpeg(original_path)

    # Compute new filename (.jpg)
    new_filename = Path(image.filename).with_suffix(".jpg").name
    new_path = image_storage_service.get_image_path(new_filename)
    if not new_path:
        # Place alongside current file structure
        new_path = original_path.with_name(new_filename)

    # Write new file
    new_path.parent.mkdir(parents=True, exist_ok=True)
    with open(new_path, "wb") as f:
        f.write(jpeg_bytes)

    # Regenerate thumbnails for the new filename
    for size in image_storage_service.THUMBNAIL_SIZES.keys():
        try:
            thumb_bytes = image_storage_service._generate_thumbnail(jpeg_bytes, size)
            thumb_path = image_storage_service._get_thumbnail_path(new_filename, size)
            thumb_path.parent.mkdir(parents=True, exist_ok=True)
            with open(thumb_path, "wb") as tf:
                tf.write(thumb_bytes)
        except Exception as e:
            logger.warning(f"Failed to regenerate {size} thumbnail for {new_filename}: {e}")

    # Convert scaled variants like name_1080x1920.mpo that live alongside the original
    try:
        base_stem = Path(image.filename).stem  # use old stem to match existing scaled names
        parent_dir = original_path.parent
        pattern = re.compile(rf"^{re.escape(base_stem)}_\d+x\d+\.mpo$", re.IGNORECASE)
        for candidate in parent_dir.iterdir():
            if not candidate.is_file():
                continue
            if not pattern.match(candidate.name):
                continue
            try:
                scaled_jpeg = convert_file_to_jpeg(candidate)
                new_scaled_name = Path(candidate.name).with_suffix('.jpg').name
                new_scaled_path = candidate.with_name(new_scaled_name)
                with open(new_scaled_path, 'wb') as sf:
                    sf.write(scaled_jpeg)
                # remove old mpo scaled
                try:
                    candidate.unlink()
                except Exception:
                    pass
            except Exception as e:
                logger.warning(f"Failed to convert scaled variant {candidate}: {e}")
    except Exception as e:
        logger.warning(f"Scaled variant sweep failed for {image.id}: {e}")

    # Update database record
    image.filename = new_filename
    image.mime_type = "image/jpeg"
    db.add(image)

    # Optionally remove the old .mpo file and thumbnails
    try:
        if original_path.exists():
            original_path.unlink()
        for size in image_storage_service.THUMBNAIL_SIZES.keys():
            old_thumb = image_storage_service._get_thumbnail_path(Path(image.filename).with_suffix(".mpo").name, size)
            if old_thumb.exists():
                old_thumb.unlink()
    except Exception as e:
        logger.warning(f"Cleanup of old MPO assets failed for {image.id}: {e}")

    return True


def main() -> None:
    # Initialize DB and import session factory after init to avoid None
    initialize_database()
    from models import database as dbmod
    db = dbmod.SessionLocal()
    migrated = 0
    try:
        images = db.query(Image).all()
        for img in images:
            if migrate_one(db, img):
                migrated += 1
        db.commit()
        logger.info(f"MPO → JPEG migration completed. Updated {migrated} image(s).")
    except Exception as e:
        db.rollback()
        logger.error(f"Migration failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()


