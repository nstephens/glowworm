"""
Service for managing playlist variants based on display resolutions
"""
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from models.playlist import Playlist
from models.playlist_variant import PlaylistVariant, PlaylistVariantType
from models.image import Image
from services.image_storage_service import image_storage_service
from utils.logger import get_logger

logger = get_logger(__name__)

class PlaylistVariantService:
    """Service for creating and managing resolution-specific playlist variants"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def generate_variants_for_playlist(self, playlist_id: int) -> List[PlaylistVariant]:
        """Generate all resolution variants for a playlist based on display settings"""
        try:
            # Get the playlist
            playlist = self.db.query(Playlist).filter(Playlist.id == playlist_id).first()
            if not playlist:
                logger.error(f"❌ Playlist {playlist_id} not found")
                return []
            
            logger.info(f"🎯 Starting variant generation for playlist '{playlist.name}' (ID: {playlist_id})")
            
            # Get configured display sizes
            display_sizes = image_storage_service._load_display_sizes()
            logger.info(f"📐 Configured display sizes: {display_sizes}")
            
            if not display_sizes:
                logger.warning("⚠️ No display sizes configured, skipping variant generation")
                logger.warning("💡 Configure display sizes in Settings → Display Sizes")
                return []
            
            # Clear existing variants
            self.db.query(PlaylistVariant).filter(PlaylistVariant.playlist_id == playlist_id).delete()
            
            # Generate variants for each display size
            variants = []
            generation_errors = []
            self._current_generation_errors = []  # Track errors during generation
            
            for width, height in display_sizes:
                try:
                    logger.info(f"  📐 Attempting to create variant for {width}x{height}...")
                    variant = self._create_variant_for_resolution(playlist, width, height)
                    if variant:
                        variants.append(variant)
                        logger.info(f"  ✅ Created variant for {width}x{height}")
                    else:
                        error_msg = f"Variant creation returned None for {width}x{height} - see detailed logs above"
                        logger.warning(f"  ⚠️ {error_msg}")
                        generation_errors.append(error_msg)
                        # Add any detailed errors from the variant creation
                        generation_errors.extend(self._current_generation_errors)
                        self._current_generation_errors = []
                except Exception as e:
                    error_msg = f"Failed to create variant for {width}x{height}: {str(e)}"
                    logger.error(f"  ❌ {error_msg}")
                    generation_errors.append(error_msg)
            
            # Always create an "original" variant with no filtering
            try:
                logger.info(f"  📐 Creating original variant...")
                original_variant = self._create_original_variant(playlist)
                if original_variant:
                    variants.append(original_variant)
                    logger.info(f"  ✅ Created original variant")
                else:
                    logger.warning(f"  ⚠️ Original variant creation returned None")
            except Exception as e:
                error_msg = f"Failed to create original variant: {str(e)}"
                logger.error(f"  ❌ {error_msg}")
                generation_errors.append(error_msg)
            
            self.db.commit()
            logger.info(f"✅ Generated {len(variants)} variants for playlist {playlist_id}")
            
            if generation_errors:
                logger.warning(f"⚠️ Generation errors encountered: {generation_errors}")
                # Store errors so they can be returned to the client
                self._last_generation_errors = generation_errors
            else:
                self._last_generation_errors = []
            
            return variants
            
        except Exception as e:
            logger.error(f"Failed to generate variants for playlist {playlist_id}: {e}")
            self.db.rollback()
            return []
    
    def _create_variant_for_resolution(self, playlist: Playlist, target_width: int, target_height: int) -> Optional[PlaylistVariant]:
        """Create a variant with ALL images pre-scaled for a specific resolution"""
        try:
            # Determine variant type
            variant_type = PlaylistVariantType.get_variant_type_for_resolution(target_width, target_height)
            logger.info(f"    🎨 Variant type determined: {variant_type.value}")
            
            # Get images for the playlist - try both methods
            # Method 1: Images with playlist_id set (legacy)
            images_by_playlist_id = self.db.query(Image).filter(Image.playlist_id == playlist.id).all()
            
            # Method 2: Images from sequence (modern approach)
            images_by_sequence = []
            if playlist.sequence and len(playlist.sequence) > 0:
                images_by_sequence = self.db.query(Image).filter(Image.id.in_(playlist.sequence)).all()
            
            logger.info(f"    🖼️ Found {len(images_by_playlist_id)} images with playlist_id={playlist.id}")
            logger.info(f"    🖼️ Found {len(images_by_sequence)} images from sequence")
            
            # Use whichever method found images
            if images_by_sequence:
                images = images_by_sequence
                logger.info(f"    ✅ Using {len(images)} images from sequence")
            elif images_by_playlist_id:
                images = images_by_playlist_id
                logger.info(f"    ✅ Using {len(images)} images from playlist_id column")
            else:
                error_msg = f"No images found for playlist {playlist.id}"
                logger.warning(f"    ⚠️ {error_msg}")
                logger.warning(f"    💡 Playlist appears to be empty")
                if hasattr(self, '_current_generation_errors'):
                    self._current_generation_errors.append(f"{error_msg}. Playlist appears to be empty.")
                return None

            # Use the original playlist sequence or create one from all images
            sequence = playlist.sequence or [img.id for img in images]
            
            # Ensure ALL images have scaled versions for this resolution
            scaled_count = 0
            for image in images:
                # Check if scaled version exists, if not create it
                scaled_filename = self._ensure_scaled_image_exists(image, target_width, target_height)
                if scaled_filename:
                    scaled_count += 1
                else:
                    logger.warning(f"Could not create scaled version for image {image.id} at {target_width}x{target_height}")
            
            logger.info(f"Pre-scaled {scaled_count}/{len(images)} images for {target_width}x{target_height}")
            
            # Create variant with ALL images (no filtering)
            variant = PlaylistVariant(
                playlist_id=playlist.id,
                variant_type=variant_type,
                target_width=target_width,
                target_height=target_height,
                optimized_sequence=sequence,  # Use original sequence - no filtering
                image_count=len(images),  # All images included
                preferred_orientation="portrait" if target_height > target_width else "landscape",
                min_width=target_width,
                max_width=target_width,
                min_height=target_height,
                max_height=target_height
            )
            
            self.db.add(variant)
            logger.info(f"Created {variant_type.value} variant for playlist {playlist.id}: {len(images)} images (all pre-scaled)")
            return variant
            
        except Exception as e:
            logger.error(f"Failed to create variant for {target_width}x{target_height}: {e}")
            return None
    
    def _ensure_scaled_image_exists(self, image: Image, target_width: int, target_height: int) -> Optional[str]:
        """Ensure a scaled version of the image exists for the target resolution"""
        try:
            from services.image_storage_service import image_storage_service
            
            # Check if scaled version already exists
            available_resolutions = image_storage_service.get_available_resolutions(image.filename)
            if available_resolutions:
                # Look for exact match first
                for res in available_resolutions:
                    if res.get('width') == target_width and res.get('height') == target_height:
                        return res.get('filename')
            
            # Create scaled version if it doesn't exist
            scaled_filename = f"{image.filename.rsplit('.', 1)[0]}_{target_width}x{target_height}.{image.filename.rsplit('.', 1)[1]}"
            scaled_path = image_storage_service.upload_path / "scaled" / scaled_filename
            
            # Create scaled directory if it doesn't exist
            scaled_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Generate the scaled image
            from PIL import Image as PILImage
            import os
            
            original_path = image_storage_service.get_image_path(image.filename)
            if not original_path or not original_path.exists():
                logger.error(f"Original image not found: {image.filename}")
                return None
            
            # Load and scale the image
            try:
                with PILImage.open(original_path) as img:
                    # Apply EXIF orientation if needed
                    try:
                        exif = img._getexif()
                        if exif is not None:
                            # ORIENTATION = 274 in EXIF tags
                            orientation = exif.get(274)
                            if orientation == 3:
                                img = img.rotate(180, expand=True)
                            elif orientation == 6:
                                img = img.rotate(270, expand=True)
                            elif orientation == 8:
                                img = img.rotate(90, expand=True)
                    except (AttributeError, KeyError, TypeError):
                        pass
                    
                    # Calculate scaling to fit within target dimensions while maintaining aspect ratio
                    img_width, img_height = img.size
                    scale_w = target_width / img_width
                    scale_h = target_height / img_height
                    scale = min(scale_w, scale_h)  # Use smaller scale to fit within bounds
                    
                    # Only scale down, never up
                    if scale < 1.0:
                        new_width = int(img_width * scale)
                        new_height = int(img_height * scale)
                        img = img.resize((new_width, new_height), PILImage.Resampling.LANCZOS)
                    
                    # Save the scaled image
                    img.save(scaled_path, quality=85, optimize=True)
                    logger.info(f"Created scaled image: {scaled_filename} ({img.size[0]}x{img.size[1]})")
                    return scaled_filename
            except Exception as e:
                logger.error(f"Could not open or process original image {original_path}: {e}")
                return None
                
        except Exception as e:
            logger.error(f"Failed to create scaled image for {image.filename} at {target_width}x{target_height}: {e}")
            return None
    
    def _create_original_variant(self, playlist: Playlist) -> Optional[PlaylistVariant]:
        """Create an original variant with no filtering"""
        try:
            # Get all images in the playlist
            images = self.db.query(Image).filter(Image.playlist_id == playlist.id).all()
            if not images:
                return None
            
            # Use original sequence or create one from all images
            sequence = playlist.sequence or [img.id for img in images]
            
            # Create original variant
            variant = PlaylistVariant(
                playlist_id=playlist.id,
                variant_type=PlaylistVariantType.ORIGINAL,
                target_width=None,
                target_height=None,
                optimized_sequence=sequence,
                image_count=len(images),
                preferred_orientation=None,
                min_width=None,
                max_width=None,
                min_height=None,
                max_height=None
            )
            
            self.db.add(variant)
            logger.info(f"Created original variant for playlist {playlist.id}: {len(images)} images")
            return variant
            
        except Exception as e:
            logger.error(f"Failed to create original variant: {e}")
            return None
    
    
    def get_best_variant_for_device(self, playlist_id: int, device_width: int, device_height: int, device_pixel_ratio: float = 1.0) -> Optional[PlaylistVariant]:
        """Get the best playlist variant for a specific device resolution"""
        try:
            # Calculate effective resolution
            effective_width = int(device_width * device_pixel_ratio)
            effective_height = int(device_height * device_pixel_ratio)
            
            logger.info(f"🔍 Variant selection for playlist {playlist_id}")
            logger.info(f"  Device: {device_width}x{device_height}, DPR: {device_pixel_ratio}")
            logger.info(f"  Effective: {effective_width}x{effective_height}")
            
            # Get all variants for this playlist
            variants = self.db.query(PlaylistVariant).filter(PlaylistVariant.playlist_id == playlist_id).all()
            if not variants:
                logger.warning(f"❌ No variants found for playlist {playlist_id}")
                return None
            
            logger.info(f"  Found {len(variants)} variants:")
            
            # Find best matching variant
            best_variant = None
            best_score = -1
            
            for variant in variants:
                if variant.target_width and variant.target_height:
                    # Calculate fit score for this variant
                    score = self._calculate_variant_fit_score(
                        variant.target_width, variant.target_height,
                        effective_width, effective_height
                    )
                    
                    logger.info(f"    - {variant.variant_type.value} ({variant.target_width}x{variant.target_height}): score={score:.3f}")
                    
                    if score > best_score:
                        best_score = score
                        best_variant = variant
                elif variant.variant_type == PlaylistVariantType.ORIGINAL:
                    logger.info(f"    - {variant.variant_type.value}: fallback variant")
                    # Original variant as fallback
                    if best_variant is None:
                        best_variant = variant
            
            if best_variant:
                if best_variant.target_width and best_variant.target_height:
                    logger.info(f"✅ Selected {best_variant.variant_type.value} variant ({best_variant.target_width}x{best_variant.target_height}) with score {best_score:.3f}")
                else:
                    logger.info(f"✅ Selected {best_variant.variant_type.value} variant (fallback)")
            else:
                logger.warning(f"❌ No suitable variant found for {effective_width}x{effective_height}")
            
            return best_variant
            
        except Exception as e:
            logger.error(f"Failed to get best variant for device: {e}")
            return None
    
    def _calculate_variant_fit_score(self, variant_width: int, variant_height: int, device_width: int, device_height: int) -> float:
        """Calculate how well a variant fits the device resolution"""
        try:
            # Calculate aspect ratio difference
            variant_ratio = variant_width / variant_height
            device_ratio = device_width / device_height
            ratio_diff = abs(variant_ratio - device_ratio)
            
            # Calculate size difference
            width_diff = abs(variant_width - device_width) / device_width
            height_diff = abs(variant_height - device_height) / device_height
            size_diff = (width_diff + height_diff) / 2
            
            # Calculate score (lower differences = higher score)
            ratio_score = max(0, 1 - ratio_diff * 2)  # Penalize ratio differences heavily
            size_score = max(0, 1 - size_diff)  # Penalize size differences moderately
            
            # Weight ratio more heavily than size
            total_score = (ratio_score * 0.7) + (size_score * 0.3)
            
            return total_score
            
        except Exception as e:
            logger.error(f"Failed to calculate variant fit score: {e}")
            return 0.0
    
    def regenerate_all_variants(self) -> Dict[str, Any]:
        """Regenerate variants for all playlists"""
        try:
            playlists = self.db.query(Playlist).all()
            results = {
                "total_playlists": len(playlists),
                "successful": 0,
                "failed": 0,
                "variants_created": 0
            }
            
            for playlist in playlists:
                try:
                    variants = self.generate_variants_for_playlist(playlist.id)
                    results["successful"] += 1
                    results["variants_created"] += len(variants)
                    logger.info(f"Generated {len(variants)} variants for playlist {playlist.name}")
                except Exception as e:
                    results["failed"] += 1
                    logger.error(f"Failed to generate variants for playlist {playlist.name}: {e}")
            
            logger.info(f"Variant generation complete: {results}")
            return results
            
        except Exception as e:
            logger.error(f"Failed to regenerate all variants: {e}")
            return {"error": str(e)}
