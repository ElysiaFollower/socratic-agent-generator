"""Profile management module.

This module handles loading, listing, and persistence of tutor profiles.
"""

import json
import logging
from pathlib import Path
from typing import List

from core.exceptions import ProfileNotFoundError
from config import PROFILES_DIR
from schemas.profile import Profile

logger = logging.getLogger(__name__)


class ProfileManager:
    """Manages tutor profile operations.

    This class handles loading, listing, saving, and deleting tutor profiles
    from the file system.
    """

    def __init__(self, profiles_dir: Path = None):
        """Initialize ProfileManager.

        Args:
            profiles_dir: Optional custom directory for profiles. If None,
                uses PROFILES_DIR from config.
        """
        self.profiles_dir = profiles_dir or PROFILES_DIR
        self.profiles_dir.mkdir(parents=True, exist_ok=True)

    def list_profiles(self) -> List[Profile]:
        """List all available profiles.

        Returns:
            List of Profile objects, sorted by creation time (newest first).

        Note:
            Invalid profiles are skipped with a warning log message.
        """
        profile_list = []
        for profile_file in self.profiles_dir.glob("*.json"):
            try:
                with open(profile_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    profile_list.append(Profile.model_validate(data))
            except (json.JSONDecodeError, Exception) as e:
                logger.warning(
                    "Skipping profile %s due to error: %s",
                    profile_file.name,
                    e,
                )
                continue

        # Sort by creation time, newest first
        profile_list.sort(key=lambda p: p.create_at, reverse=True)
        return profile_list

    def read_profile(self, profile_id: str) -> Profile:
        """Read a profile from disk.

        Args:
            profile_id: The ID of the profile to read.

        Returns:
            Profile object.

        Raises:
            ProfileNotFoundError: If the profile does not exist.
        """
        profile_path = self.profiles_dir / f"{profile_id}.json"
        if not profile_path.exists():
            raise ProfileNotFoundError(profile_id)

        try:
            with open(profile_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return Profile.model_validate(data)
        except json.JSONDecodeError as e:
            logger.error("Failed to parse profile %s: %s", profile_id, e)
            raise ProfileNotFoundError(profile_id) from e

    def save_profile(self, profile: Profile) -> Profile:
        """Save a profile to disk.

        Args:
            profile: The Profile object to save.

        Returns:
            The saved Profile object.
        """
        profile_path = self.profiles_dir / f"{profile.profile_id}.json"
        with open(profile_path, "w", encoding="utf-8") as f:
            json.dump(profile.model_dump(), f, ensure_ascii=False, indent=2)
        logger.info("Saved profile: %s", profile.profile_id)
        return profile

    def delete_profile(self, profile_id: str) -> None:
        """Delete a profile from disk.

        Args:
            profile_id: The ID of the profile to delete.

        Note:
            If the profile does not exist, this method does nothing.
        """
        profile_path = self.profiles_dir / f"{profile_id}.json"
        if profile_path.exists():
            profile_path.unlink()
            logger.info("Deleted profile: %s", profile_id)

