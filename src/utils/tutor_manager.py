"""Tutor instance management module.

This module manages active Tutor instances in memory, acting as a cache layer.
"""

import logging
from typing import Dict

from fastapi import HTTPException

from core.exceptions import SessionNotFoundError
from utils.tutor_core import Tutor
from schemas.profile import Profile

logger = logging.getLogger(__name__)


class TutorManager:
    """Manages active Tutor instances in memory.

    This class acts as a cache layer for Tutor instances, reducing disk I/O
    by keeping frequently accessed tutors in memory.
    """

    def __init__(self):
        """Initialize TutorManager with an empty cache."""
        self.active_tutors: Dict[str, Tutor] = {}
        logger.info("TutorManager initialized")

    def get_tutor(self, session_id: str) -> Tutor:
        """Get a Tutor instance for the given session.

        This method first checks the in-memory cache. If not found, it loads
        the tutor from disk and adds it to the cache.

        Args:
            session_id: The ID of the session.

        Returns:
            Tutor instance for the session.

        Raises:
            HTTPException: If the session cannot be loaded (404) or if there
                is an internal error (500).
        """
        # Check cache first
        if session_id in self.active_tutors:
            logger.debug("Cache hit for session: %s", session_id)
            return self.active_tutors[session_id]

        # Cache miss - load from disk
        logger.info("Cache miss. Loading tutor for session: %s", session_id)
        try:
            tutor = Tutor.from_id(session_id)
            self.active_tutors[session_id] = tutor
            return tutor
        except SessionNotFoundError as e:
            logger.warning("Session not found: %s", session_id)
            raise HTTPException(status_code=404, detail=str(e))
        except Exception as e:
            logger.error("Failed to load session %s: %s", session_id, e)
            raise HTTPException(
                status_code=500, detail=f"Failed to load session: {e}"
            )

    def create_tutor(
        self, profile: Profile, session_name: str, output_language: str
    ) -> Tutor:
        """Create a new Tutor instance.

        The tutor is automatically persisted to disk by Tutor.create_new and
        added to the in-memory cache.

        Args:
            profile: The Profile to use for this tutor.
            session_name: Name of the session.
            output_language: Output language for the tutor.

        Returns:
            The created Tutor instance.
        """
        logger.info("Creating new tutor for profile: %s", profile.profile_id)
        tutor = Tutor.create_new(
            profile=profile,
            session_name=session_name,
            output_language=output_language,
        )

        # Add to cache
        self.active_tutors[tutor.session.session_id] = tutor
        logger.info(
            "Created and cached tutor for session: %s",
            tutor.session.session_id,
        )
        return tutor

    def remove_from_cache(self, session_id: str) -> None:
        """Remove a Tutor instance from the cache.

        This is typically called when a session is deleted or renamed.
        The session file on disk is not affected.

        Args:
            session_id: The ID of the session to remove from cache.
        """
        if session_id in self.active_tutors:
            del self.active_tutors[session_id]
            logger.info("Removed tutor from cache: %s", session_id)

