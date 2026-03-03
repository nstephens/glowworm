"""
Playlist Manager - Manages playlist state, fetching, and navigation.

Provides playlist management with:
- Fetching playlists from backend API
- Position tracking persisted across restarts
- Shuffle mode with deterministic seed
- Next/previous navigation
- Version checking for updates
"""
import asyncio
import hashlib
import json
import logging
import os
import random
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple
from urllib.parse import urljoin

logger = logging.getLogger(__name__)


class PlaylistStatus(Enum):
    """Status of playlist operations."""
    OK = "ok"
    FETCHING = "fetching"
    ERROR = "error"
    NOT_LOADED = "not_loaded"


@dataclass
class PlaylistImage:
    """An image in the playlist."""
    id: int
    url: str
    filename: str
    width: Optional[int] = None
    height: Optional[int] = None
    focus_x: float = 0.5  # Smart crop focus point (0.0-1.0 from left)
    focus_y: float = 0.5  # Smart crop focus point (0.0-1.0 from top)
    mime_type: str = "image/jpeg"
    file_size: int = 0
    checksum: Optional[str] = None  # For cache invalidation
    original_filename: Optional[str] = None  # Original filename for display
    exif_date: Optional[str] = None  # EXIF date string (e.g., "2024:03:15 14:30:00")


@dataclass
class PlaylistEntry:
    """A single or paired entry in the playlist sequence."""
    entry_type: str  # "single" or "pair"
    image_ids: List[int]


@dataclass
class PlaylistData:
    """Parsed playlist data."""
    id: int
    name: str
    slug: str
    display_time_seconds: int = 30
    display_mode: str = "default"
    show_image_info: bool = False  # Show image filename overlay
    show_exif_date: bool = False  # Show EXIF date overlay
    sequence: List[int] = field(default_factory=list)
    computed_sequence: List[PlaylistEntry] = field(default_factory=list)
    images: Dict[int, PlaylistImage] = field(default_factory=dict)
    version_hash: str = ""  # Hash of content for change detection
    updated_at: Optional[str] = None

    @property
    def image_count(self) -> int:
        return len(self.images)

    @property
    def entry_count(self) -> int:
        """Number of display entries (accounts for pairs)."""
        if self.computed_sequence:
            return len(self.computed_sequence)
        return len(self.sequence)


@dataclass
class PlaylistPosition:
    """Persisted playlist position state."""
    playlist_id: int
    position: int = 0
    shuffled_order: Optional[List[int]] = None
    shuffle_seed: Optional[int] = None
    last_updated: float = field(default_factory=time.time)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "playlist_id": self.playlist_id,
            "position": self.position,
            "shuffled_order": self.shuffled_order,
            "shuffle_seed": self.shuffle_seed,
            "last_updated": self.last_updated,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PlaylistPosition":
        return cls(
            playlist_id=data["playlist_id"],
            position=data.get("position", 0),
            shuffled_order=data.get("shuffled_order"),
            shuffle_seed=data.get("shuffle_seed"),
            last_updated=data.get("last_updated", time.time()),
        )


@dataclass
class PlaylistManagerConfig:
    """Configuration for PlaylistManager."""
    backend_url: str
    device_token: str
    state_dir: str = "/var/lib/glowworm"
    connect_timeout: float = 10.0
    read_timeout: float = 30.0
    max_retries: int = 3
    retry_base_delay: float = 1.0
    retry_max_delay: float = 60.0

    def __post_init__(self):
        # Ensure state directory exists
        os.makedirs(self.state_dir, exist_ok=True)


class PlaylistError(Exception):
    """Base exception for PlaylistManager errors."""
    pass


class PlaylistNotFoundError(PlaylistError):
    """Raised when playlist is not found on backend."""
    pass


class PlaylistManager:
    """
    Manages playlist state, fetching, and navigation.

    Features:
    - Async fetching from backend using aiohttp
    - Position tracking persisted to disk
    - Shuffle mode with deterministic seed (same seed = same order)
    - Next/previous navigation with wrapping
    - Version checking to detect playlist changes
    """

    def __init__(self, config: PlaylistManagerConfig):
        self.config = config
        self._session: Optional["aiohttp.ClientSession"] = None
        self._playlist: Optional[PlaylistData] = None
        self._position: Optional[PlaylistPosition] = None
        self._shuffle_enabled: bool = False
        self._status: PlaylistStatus = PlaylistStatus.NOT_LOADED
        self._last_error: Optional[str] = None
        self._state_file = Path(config.state_dir) / "playlist_state.json"

    async def start(self) -> None:
        """Initialize the HTTP session and load persisted state."""
        import aiohttp

        timeout = aiohttp.ClientTimeout(
            connect=self.config.connect_timeout,
            total=None,
            sock_read=self.config.read_timeout
        )

        headers = {
            "User-Agent": "GlowWorm-Daemon/3.0",
            "Authorization": f"Bearer {self.config.device_token}",
        }

        self._session = aiohttp.ClientSession(
            timeout=timeout,
            headers=headers
        )

        # Load persisted position
        self._load_state()

        logger.info("PlaylistManager started")

    async def stop(self) -> None:
        """Close the HTTP session and save state."""
        self._save_state()

        if self._session:
            await self._session.close()
            self._session = None

        logger.info("PlaylistManager stopped")

    async def __aenter__(self) -> "PlaylistManager":
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        await self.stop()

    def _load_state(self) -> None:
        """Load persisted playlist position from disk."""
        if self._state_file.exists():
            try:
                with open(self._state_file, "r") as f:
                    data = json.load(f)
                self._position = PlaylistPosition.from_dict(data)
                self._shuffle_enabled = data.get("shuffle_enabled", False)
                logger.info(
                    f"Loaded playlist state: position={self._position.position}, "
                    f"shuffle={self._shuffle_enabled}"
                )
            except Exception as e:
                logger.warning(f"Failed to load playlist state: {e}")
                self._position = None

    def _save_state(self) -> None:
        """Save playlist position to disk."""
        if self._position:
            try:
                data = self._position.to_dict()
                data["shuffle_enabled"] = self._shuffle_enabled

                # Write atomically
                temp_file = self._state_file.with_suffix(".tmp")
                with open(temp_file, "w") as f:
                    json.dump(data, f)
                temp_file.rename(self._state_file)

                logger.debug(f"Saved playlist state: position={self._position.position}")
            except Exception as e:
                logger.warning(f"Failed to save playlist state: {e}")

    def _build_url(self, path: str) -> str:
        """Build full URL from path."""
        return urljoin(self.config.backend_url, path)

    async def fetch_playlist(
        self,
        playlist_id: Optional[int] = None
    ) -> PlaylistData:
        """
        Fetch playlist from backend.

        If playlist_id is None, fetches the default/assigned playlist
        for this device.

        Args:
            playlist_id: Optional specific playlist ID to fetch

        Returns:
            PlaylistData with parsed playlist information

        Raises:
            PlaylistNotFoundError: If playlist doesn't exist
            PlaylistError: On network or parsing errors
        """
        import aiohttp

        if not self._session:
            raise PlaylistError("PlaylistManager not started. Call start() first.")

        self._status = PlaylistStatus.FETCHING
        self._last_error = None

        # Build URL - use device endpoint if no playlist_id specified
        if playlist_id:
            # Fetch specific playlist with images
            url = self._build_url(f"/api/playlists/{playlist_id}/images/manifest")
        else:
            # Fetch device's assigned playlist
            url = self._build_url("/api/device-daemon/playlist")

        last_error: Optional[Exception] = None

        for attempt in range(self.config.max_retries):
            try:
                async with self._session.get(url) as response:
                    if response.status == 404:
                        raise PlaylistNotFoundError(
                            f"Playlist {playlist_id or 'assigned'} not found"
                        )

                    if response.status in (401, 403):
                        raise PlaylistError("Authentication failed")

                    if response.status >= 500:
                        raise aiohttp.ServerConnectionError(
                            f"Server error {response.status}"
                        )

                    if response.status != 200:
                        raise PlaylistError(f"Unexpected status {response.status}")

                    data = await response.json()

                    # Parse and validate playlist
                    playlist = self._parse_playlist_response(data, playlist_id)

                    # Always fetch full images list from dedicated endpoint
                    # The device-daemon endpoint often has incomplete image data
                    playlist = await self._fetch_playlist_images(playlist)

                    self._playlist = playlist

                    # Initialize or update position
                    if self._position is None or self._position.playlist_id != playlist.id:
                        self._position = PlaylistPosition(playlist_id=playlist.id)
                        # Generate shuffle if enabled
                        if self._shuffle_enabled:
                            self._generate_shuffle()
                    elif self._position.position >= playlist.entry_count:
                        # Position is out of bounds (playlist shrunk)
                        self._position.position = 0
                        if self._shuffle_enabled:
                            self._generate_shuffle()

                    self._save_state()
                    self._status = PlaylistStatus.OK

                    logger.info(
                        f"Fetched playlist '{playlist.name}': "
                        f"{playlist.image_count} images, {playlist.entry_count} entries"
                    )
                    return playlist

            except (PlaylistNotFoundError, PlaylistError) as e:
                self._status = PlaylistStatus.ERROR
                self._last_error = str(e)
                raise

            except (aiohttp.ClientError, asyncio.TimeoutError, OSError) as e:
                last_error = e

                if attempt < self.config.max_retries - 1:
                    delay = min(
                        self.config.retry_base_delay * (2 ** attempt),
                        self.config.retry_max_delay
                    )
                    logger.warning(
                        f"Fetch attempt {attempt + 1} failed: {e}. "
                        f"Retrying in {delay:.1f}s"
                    )
                    await asyncio.sleep(delay)
                else:
                    logger.error(
                        f"Playlist fetch failed after {self.config.max_retries} "
                        f"attempts: {e}"
                    )

        self._status = PlaylistStatus.ERROR
        self._last_error = str(last_error) if last_error else "Unknown error"
        raise PlaylistError(
            f"Failed to fetch playlist after {self.config.max_retries} "
            f"attempts: {last_error}"
        )

    async def _fetch_playlist_images(self, playlist: PlaylistData) -> PlaylistData:
        """
        Fetch full images list for a playlist.

        Called when the initial playlist response has incomplete image data.
        Fetches from /api/playlists/{id}/images endpoint.

        Args:
            playlist: PlaylistData with incomplete images

        Returns:
            Updated PlaylistData with all images
        """
        import aiohttp

        if not self._session:
            logger.warning("No session available for fetching images")
            return playlist

        url = self._build_url(f"/api/playlists/{playlist.id}/images")
        logger.info(f"Fetching full images list from {url}")

        try:
            async with self._session.get(url) as response:
                if response.status != 200:
                    logger.warning(f"Failed to fetch images: status {response.status}")
                    return playlist

                data = await response.json()
                images_list = data.get("images", [])

                if not images_list:
                    logger.warning("No images in response")
                    return playlist

                # Parse images
                images = {}
                sequence = []
                for item in images_list:
                    image_id = int(item["id"])
                    images[image_id] = PlaylistImage(
                        id=image_id,
                        url=item.get("url", f"/api/images/{image_id}/file"),
                        filename=item.get("filename", f"{image_id}.jpg"),
                        width=item.get("width"),
                        height=item.get("height"),
                        focus_x=item.get("focus_x", 0.5),
                        focus_y=item.get("focus_y", 0.5),
                        mime_type=item.get("mime_type", "image/jpeg"),
                        file_size=item.get("file_size", 0),
                        checksum=item.get("file_hash"),
                    )
                    sequence.append(image_id)

                logger.info(f"Fetched {len(images)} images for playlist {playlist.id}")

                # Update playlist with full images
                # Use the fetched sequence if the original was incomplete
                if len(playlist.sequence) < len(sequence):
                    playlist.sequence = sequence

                playlist.images = images

                # Recompute version hash
                playlist.version_hash = self._compute_version_hash(
                    playlist.sequence, images
                )

                return playlist

        except (aiohttp.ClientError, asyncio.TimeoutError, OSError) as e:
            logger.warning(f"Failed to fetch playlist images: {e}")
            return playlist

    def _parse_playlist_response(
        self,
        data: Dict[str, Any],
        playlist_id: Optional[int]
    ) -> PlaylistData:
        """Parse playlist response from backend."""
        # Handle both manifest and playlist endpoints
        if "playlist" in data:
            # Response from device endpoint or playlist endpoint (may also have manifest)
            return self._parse_playlist_dict(data["playlist"], data.get("manifest"))
        elif "manifest" in data:
            # Response from /playlists/{id}/images/manifest (manifest only, no playlist)
            return self._parse_manifest_response(data)
        else:
            # Direct playlist dict
            return self._parse_playlist_dict(data)

    def _parse_manifest_response(self, data: Dict[str, Any]) -> PlaylistData:
        """Parse manifest endpoint response."""
        manifest = data.get("manifest", [])
        playlist_id = data.get("playlist_id", 0)
        playlist_name = data.get("playlist_name", "Unknown")

        images = {}
        sequence = []

        for item in manifest:
            image_id = int(item["id"])
            images[image_id] = PlaylistImage(
                id=image_id,
                url=item.get("url", f"/api/images/{image_id}/file"),
                filename=item.get("filename", f"{image_id}.jpg"),
                width=item.get("width"),
                height=item.get("height"),
                focus_x=item.get("focus_x", 0.5),
                focus_y=item.get("focus_y", 0.5),
                mime_type=item.get("mime_type", "image/jpeg"),
                file_size=item.get("file_size", 0),
                checksum=item.get("checksum"),
            )
            sequence.append(image_id)

        # Compute version hash for change detection
        version_hash = self._compute_version_hash(sequence, images)

        return PlaylistData(
            id=playlist_id,
            name=playlist_name,
            slug=f"playlist-{playlist_id}",
            sequence=sequence,
            images=images,
            version_hash=version_hash,
        )

    def _parse_playlist_dict(
        self,
        playlist: Dict[str, Any],
        manifest: Optional[List[Dict]] = None
    ) -> PlaylistData:
        """Parse playlist dictionary."""
        print(f"_parse_playlist_dict: playlist={playlist}", flush=True)
        print(f"_parse_playlist_dict: manifest has {len(manifest) if manifest else 0} items", flush=True)
        playlist_id = playlist.get("id", 0)
        sequence = playlist.get("sequence", [])
        computed = playlist.get("computed_sequence", [])
        print(f"_parse_playlist_dict: sequence={sequence}, computed={computed}", flush=True)

        # Parse computed sequence
        computed_sequence = []
        if computed:
            for entry in computed:
                computed_sequence.append(PlaylistEntry(
                    entry_type=entry.get("type", "single"),
                    image_ids=entry.get("images", []),
                ))

        # Parse images from manifest if provided
        images = {}
        if manifest:
            for item in manifest:
                image_id = int(item["id"])
                images[image_id] = PlaylistImage(
                    id=image_id,
                    url=item.get("url", f"/api/images/{image_id}/file"),
                    filename=item.get("filename", f"{image_id}.jpg"),
                    width=item.get("width"),
                    height=item.get("height"),
                    focus_x=item.get("focus_x", 0.5),
                    focus_y=item.get("focus_y", 0.5),
                    mime_type=item.get("mime_type", "image/jpeg"),
                    file_size=item.get("file_size", 0),
                    checksum=item.get("checksum"),
                    original_filename=item.get("original_filename"),
                    exif_date=item.get("exif_date"),
                )

        # If sequence is empty or incomplete, use all images from manifest
        # This handles the case where images are added but sequence isn't updated
        if manifest and (not sequence or len(sequence) < len(manifest)):
            all_image_ids = sorted([int(item["id"]) for item in manifest])
            print(f"_parse_playlist_dict: sequence incomplete ({len(sequence)} < {len(manifest)}), using all images: {all_image_ids}", flush=True)
            sequence = all_image_ids

        # Compute version hash
        version_hash = self._compute_version_hash(sequence, images)

        return PlaylistData(
            id=playlist_id,
            name=playlist.get("name", "Unknown"),
            slug=playlist.get("slug", f"playlist-{playlist_id}"),
            display_time_seconds=playlist.get("display_time_seconds", 30),
            display_mode=playlist.get("display_mode", "default"),
            show_image_info=playlist.get("show_image_info", False),
            show_exif_date=playlist.get("show_exif_date", False),
            sequence=sequence,
            computed_sequence=computed_sequence,
            images=images,
            version_hash=version_hash,
            updated_at=playlist.get("updated_at"),
        )

    def _compute_version_hash(
        self,
        sequence: List[int],
        images: Dict[int, PlaylistImage]
    ) -> str:
        """Compute hash for playlist version detection."""
        # Include sequence and image checksums
        content = json.dumps({
            "sequence": sequence,
            "checksums": {
                str(k): v.checksum for k, v in images.items() if v.checksum
            }
        }, sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    async def check_for_updates(self) -> bool:
        """
        Check if the assigned playlist has changed or been updated on backend.

        This checks both:
        1. Whether a different playlist has been assigned to this device
        2. Whether the current playlist's content has changed

        Returns:
            True if playlist has changed, False otherwise.
        """
        if not self._playlist:
            return True  # No playlist loaded

        try:
            # Fetch the device's assigned playlist (may be different from current)
            # Pass None to force re-fetching from device endpoint
            new_playlist = await self.fetch_playlist(playlist_id=None)

            # Check if playlist ID changed (device was reassigned)
            if new_playlist.id != self._playlist.id:
                logger.info(
                    f"Device reassigned to different playlist: "
                    f"{self._playlist.id} -> {new_playlist.id}"
                )
                return True

            # Compare version hashes for content changes
            if new_playlist.version_hash != self._playlist.version_hash:
                logger.info(
                    f"Playlist updated: {self._playlist.version_hash} -> "
                    f"{new_playlist.version_hash}"
                )
                return True

            return False

        except Exception as e:
            logger.warning(f"Failed to check for updates: {e}")
            return False

    @property
    def playlist(self) -> Optional[PlaylistData]:
        """Get current playlist."""
        return self._playlist

    @property
    def status(self) -> PlaylistStatus:
        """Get current status."""
        return self._status

    @property
    def last_error(self) -> Optional[str]:
        """Get last error message."""
        return self._last_error

    @property
    def current_position(self) -> int:
        """Get current position in playlist."""
        if self._position:
            return self._position.position
        return 0

    @property
    def shuffle_enabled(self) -> bool:
        """Check if shuffle is enabled."""
        return self._shuffle_enabled

    def set_shuffle(self, enabled: bool, seed: Optional[int] = None) -> None:
        """
        Enable or disable shuffle mode.

        Args:
            enabled: Whether to enable shuffle
            seed: Optional seed for deterministic shuffle
        """
        self._shuffle_enabled = enabled

        if enabled and self._playlist:
            self._generate_shuffle(seed)
        elif not enabled and self._position:
            self._position.shuffled_order = None
            self._position.shuffle_seed = None

        self._save_state()
        logger.info(f"Shuffle {'enabled' if enabled else 'disabled'}")

    def _generate_shuffle(self, seed: Optional[int] = None) -> None:
        """Generate shuffled order for playlist."""
        if not self._playlist or not self._position:
            return

        # Use provided seed or generate new one
        if seed is None:
            seed = int(time.time() * 1000) % (2**31)

        self._position.shuffle_seed = seed

        # Create shuffled order of entry indices
        entry_count = self._playlist.entry_count
        indices = list(range(entry_count))

        # Use deterministic shuffle with seed
        rng = random.Random(seed)
        rng.shuffle(indices)

        self._position.shuffled_order = indices
        logger.debug(f"Generated shuffle with seed {seed}: {indices[:5]}...")

    def _get_effective_position(self, position: int) -> int:
        """Get effective position accounting for shuffle."""
        if self._shuffle_enabled and self._position and self._position.shuffled_order:
            if 0 <= position < len(self._position.shuffled_order):
                return self._position.shuffled_order[position]
        return position

    def get_current_entry(self) -> Optional[PlaylistEntry]:
        """
        Get the current playlist entry.

        Returns:
            PlaylistEntry at current position, or None if no playlist.
        """
        if not self._playlist:
            return None

        position = self.current_position
        effective = self._get_effective_position(position)

        if self._playlist.computed_sequence:
            if 0 <= effective < len(self._playlist.computed_sequence):
                return self._playlist.computed_sequence[effective]
        elif self._playlist.sequence:
            if 0 <= effective < len(self._playlist.sequence):
                image_id = self._playlist.sequence[effective]
                return PlaylistEntry(entry_type="single", image_ids=[image_id])

        return None

    def get_current_images(self) -> List[PlaylistImage]:
        """
        Get images for current entry.

        Returns:
            List of PlaylistImage objects (1 for single, 2 for pair).
        """
        entry = self.get_current_entry()
        if not entry or not self._playlist:
            return []

        images = []
        for image_id in entry.image_ids:
            if image_id in self._playlist.images:
                images.append(self._playlist.images[image_id])
            else:
                # Create placeholder if image metadata not available
                images.append(PlaylistImage(
                    id=image_id,
                    url=f"/api/images/{image_id}/file",
                    filename=f"{image_id}.jpg",
                ))

        return images

    def next(self) -> Tuple[Optional[PlaylistEntry], int]:
        """
        Advance to next entry.

        Returns:
            Tuple of (new entry, new position) or (None, 0) if no playlist.
        """
        if not self._playlist or not self._position:
            return None, 0

        entry_count = self._playlist.entry_count
        if entry_count == 0:
            return None, 0

        # Advance position with wrap
        self._position.position = (self._position.position + 1) % entry_count
        self._position.last_updated = time.time()
        self._save_state()

        entry = self.get_current_entry()
        logger.debug(f"Advanced to position {self._position.position}")

        return entry, self._position.position

    def previous(self) -> Tuple[Optional[PlaylistEntry], int]:
        """
        Go to previous entry.

        Returns:
            Tuple of (new entry, new position) or (None, 0) if no playlist.
        """
        if not self._playlist or not self._position:
            return None, 0

        entry_count = self._playlist.entry_count
        if entry_count == 0:
            return None, 0

        # Go back with wrap
        self._position.position = (self._position.position - 1) % entry_count
        self._position.last_updated = time.time()
        self._save_state()

        entry = self.get_current_entry()
        logger.debug(f"Moved back to position {self._position.position}")

        return entry, self._position.position

    def go_to(self, position: int) -> Tuple[Optional[PlaylistEntry], int]:
        """
        Go to specific position.

        Args:
            position: Target position (0-indexed)

        Returns:
            Tuple of (entry at position, actual position).
        """
        if not self._playlist or not self._position:
            return None, 0

        entry_count = self._playlist.entry_count
        if entry_count == 0:
            return None, 0

        # Clamp position to valid range
        self._position.position = max(0, min(position, entry_count - 1))
        self._position.last_updated = time.time()
        self._save_state()

        entry = self.get_current_entry()
        return entry, self._position.position

    def get_upcoming_images(self, count: int = 3) -> List[PlaylistImage]:
        """
        Get images for upcoming entries (for preloading).

        Args:
            count: Number of upcoming entries to get

        Returns:
            List of PlaylistImage objects for upcoming entries.
        """
        if not self._playlist or not self._position:
            return []

        entry_count = self._playlist.entry_count
        if entry_count == 0:
            return []

        images = []
        for i in range(1, count + 1):
            pos = (self._position.position + i) % entry_count
            effective = self._get_effective_position(pos)

            if self._playlist.computed_sequence:
                if 0 <= effective < len(self._playlist.computed_sequence):
                    entry = self._playlist.computed_sequence[effective]
                    for image_id in entry.image_ids:
                        if image_id in self._playlist.images:
                            images.append(self._playlist.images[image_id])
            elif self._playlist.sequence:
                if 0 <= effective < len(self._playlist.sequence):
                    image_id = self._playlist.sequence[effective]
                    if image_id in self._playlist.images:
                        images.append(self._playlist.images[image_id])

        return images

    def get_status(self) -> Dict[str, Any]:
        """Get comprehensive status information."""
        result = {
            "status": self._status.value,
            "error": self._last_error,
            "shuffle_enabled": self._shuffle_enabled,
            "position": self.current_position,
        }

        if self._playlist:
            result["playlist"] = {
                "id": self._playlist.id,
                "name": self._playlist.name,
                "image_count": self._playlist.image_count,
                "entry_count": self._playlist.entry_count,
                "display_time_seconds": self._playlist.display_time_seconds,
                "version_hash": self._playlist.version_hash,
            }

            current = self.get_current_entry()
            if current:
                result["current_entry"] = {
                    "type": current.entry_type,
                    "image_ids": current.image_ids,
                }

        return result

    def update_image_metadata(self, image_id: int, updates: Dict[str, Any]) -> bool:
        """
        Update metadata for an image in the current playlist.

        This is called when the backend notifies us of image changes (e.g., focus point).
        Updates are applied in-memory without refetching the playlist.

        Args:
            image_id: The ID of the image to update
            updates: Dict of fields to update (e.g., {"focus_x": 0.5, "focus_y": 0.3})

        Returns:
            True if image was found and updated, False otherwise
        """
        if not self._playlist or image_id not in self._playlist.images:
            logger.debug(f"Image {image_id} not in current playlist, ignoring update")
            return False

        image = self._playlist.images[image_id]

        # Apply updates to the dataclass
        updated_fields = []
        for key, value in updates.items():
            if hasattr(image, key):
                setattr(image, key, value)
                updated_fields.append(f"{key}={value}")

        if updated_fields:
            logger.info(f"Updated image {image_id} metadata: {', '.join(updated_fields)}")
            return True

        return False

    def clear_state(self) -> None:
        """Clear persisted state and position."""
        self._position = None
        self._playlist = None
        self._status = PlaylistStatus.NOT_LOADED

        if self._state_file.exists():
            try:
                self._state_file.unlink()
                logger.info("Cleared playlist state")
            except OSError as e:
                logger.warning(f"Failed to delete state file: {e}")

    def compute_pairing_sequence(
        self,
        display_orientation: str = "portrait"
    ) -> None:
        """
        Compute and set the pairing sequence based on display orientation.

        For portrait displays, pairs landscape images (stacked top/bottom).
        For landscape displays, pairs portrait images (side by side).

        This should be called after fetching the playlist and when the
        display orientation is known.

        Args:
            display_orientation: 'portrait' or 'landscape'
        """
        if not self._playlist:
            logger.warning("No playlist loaded, cannot compute pairing sequence")
            return

        from glowworm_daemon.image_pairing import (
            compute_pairing_sequence,
            PairingEntry,
        )

        # Build list of image info dicts for the pairing algorithm
        images_info = []
        for image_id in self._playlist.sequence:
            image = self._playlist.images.get(image_id)
            if image:
                images_info.append({
                    'id': image.id,
                    'width': image.width or 0,
                    'height': image.height or 0,
                })
            else:
                # Image metadata not available, treat as unknown
                images_info.append({
                    'id': image_id,
                    'width': 0,
                    'height': 0,
                })

        # Compute pairing sequence
        pairing_entries = compute_pairing_sequence(images_info, display_orientation)

        # Convert to PlaylistEntry objects
        computed_sequence = []
        for entry in pairing_entries:
            computed_sequence.append(PlaylistEntry(
                entry_type=entry.entry_type,
                image_ids=entry.image_ids,
            ))

        self._playlist.computed_sequence = computed_sequence

        # Log pairing statistics
        singles = sum(1 for e in computed_sequence if e.entry_type == 'single')
        pairs = sum(1 for e in computed_sequence if e.entry_type == 'pair')
        logger.info(
            f"Computed pairing sequence for {display_orientation} display: "
            f"{singles} singles, {pairs} pairs ({len(computed_sequence)} total entries)"
        )

        # Reset position when pairing is computed - the position was stored
        # when iterating through individual images, but now it means something
        # different (entry index instead of image index)
        if self._position:
            old_position = self._position.position
            self._position.position = 0
            if self._shuffle_enabled:
                self._generate_shuffle()
            self._save_state()
            logger.info(
                f"Reset position from {old_position} to 0 after computing pairing sequence"
            )


def create_playlist_manager(config: PlaylistManagerConfig) -> PlaylistManager:
    """Factory function to create a PlaylistManager instance."""
    return PlaylistManager(config)
