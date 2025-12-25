"""Session management module.

This module handles loading, listing, and persistence of learning sessions.
"""

import json
import logging
from pathlib import Path
from typing import List

from core.exceptions import SessionNotFoundError
from config import (
    SESSION_DATA_DIR,
    DEFAULT_OUTPUT_LANGUAGE,
    DEFAULT_SESSION_NAME,
)
from schemas.session import Session, SessionSummary
from schemas.profile import Profile

logger = logging.getLogger(__name__)


class SessionManager:
    """Manages session file system operations.

    This class handles loading, listing, creating, saving, renaming, and
    deleting learning sessions from the file system.
    """

    def __init__(self, session_data_dir: Path = None):
        """Initialize SessionManager.

        Args:
            session_data_dir: Optional custom directory for session data.
                If None, uses SESSION_DATA_DIR from config.
        """
        self.session_data_dir = session_data_dir or SESSION_DATA_DIR
        self.session_data_dir.mkdir(parents=True, exist_ok=True)

    def list_sessions(self) -> List[SessionSummary]:
        """List all available sessions.

        Returns:
            List of SessionSummary objects, sorted by creation time
            (newest first).

        Note:
            Invalid sessions are skipped with a warning log message.
        """
        session_list = []
        for session_file in self.session_data_dir.glob("*.json"):
            try:
                with open(session_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    session_list.append(SessionSummary.model_validate(data))
            except (json.JSONDecodeError, Exception) as e:
                logger.warning(
                    "Skipping session %s due to error: %s",
                    session_file.name,
                    e,
                )
                continue

        # Sort by creation time, newest first
        session_list.sort(key=lambda s: s.create_at, reverse=True)
        return session_list

    def read_session(self, session_id: str) -> Session:
        """Read a session from disk.

        Args:
            session_id: The ID of the session to read.

        Returns:
            Session object.

        Raises:
            SessionNotFoundError: If the session does not exist.
        """
        session_path = self.session_data_dir / f"{session_id}.json"
        if not session_path.exists():
            raise SessionNotFoundError(session_id)

        try:
            with open(session_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return Session.model_validate(data)
        except json.JSONDecodeError as e:
            logger.error("Failed to parse session %s: %s", session_id, e)
            raise SessionNotFoundError(session_id) from e

    def create_session(
        self,
        profile: Profile,
        session_name: str = DEFAULT_SESSION_NAME,
        output_language: str = DEFAULT_OUTPUT_LANGUAGE,
    ) -> Session:
        """Create a new session.

        Args:
            profile: The Profile to use for this session.
            session_name: Name of the session. Defaults to
                DEFAULT_SESSION_NAME.
            output_language: Output language for the session. Defaults to
                DEFAULT_OUTPUT_LANGUAGE.

        Returns:
            The created Session object.
        """
        session = Session(
            profile=profile,
            session_name=session_name,
            output_language=output_language,
        )
        self.save_session(session)
        logger.info("Created session: %s", session.session_id)
        return session

    def rename_session(self, session_id: str, session_name: str) -> None:
        """Rename a session.

        Args:
            session_id: The ID of the session to rename.
            session_name: The new name for the session.

        Raises:
            SessionNotFoundError: If the session does not exist.
        """
        session = self.read_session(session_id)
        session.session_name = session_name
        self.save_session(session)
        logger.info("Renamed session %s to %s", session_id, session_name)

    def save_session(self, session: Session) -> None:
        """Save a session to disk.

        Args:
            session: The Session object to save.
        """
        session_path = self.session_data_dir / f"{session.session_id}.json"
        with open(session_path, "w", encoding="utf-8") as f:
            json.dump(session.model_dump(), f, ensure_ascii=False, indent=2)
        logger.debug("Saved session: %s", session.session_id)

    def delete_session(self, session_id: str) -> None:
        """Delete a session file from disk.

        Args:
            session_id: The ID of the session to delete.

        Note:
            If the session does not exist, this method does nothing.
        """
        session_path = self.session_data_dir / f"{session_id}.json"
        if session_path.exists():
            session_path.unlink()
            logger.info("Deleted session: %s", session_id)

