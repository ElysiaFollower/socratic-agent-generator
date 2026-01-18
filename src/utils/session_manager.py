"""Session management module.

This module handles loading, listing, and persistence of learning sessions.
"""

import json
import logging
from pathlib import Path
from typing import List, Optional

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

    def _get_user_dir(self, owner_id: str) -> Path:
        """Get (and create) the session directory for a specific user."""
        user_dir = self.session_data_dir / owner_id
        user_dir.mkdir(parents=True, exist_ok=True)
        return user_dir

    def _get_session_path(self, owner_id: str, session_id: str) -> Path:
        """Get the file path for a specific session."""
        return self._get_user_dir(owner_id) / f"{session_id}.json"

    def _infer_owner_id(self, session_path: Path) -> Optional[str]:
        """Infer owner_id from session path."""
        if session_path.parent == self.session_data_dir:
            return None
        return session_path.parent.name

    def _resolve_session_path(
        self, session_id: str, owner_id: Optional[str] = None
    ) -> Optional[Path]:
        """Resolve session file path by owner_id or by scanning."""
        if owner_id:
            candidate = self._get_session_path(owner_id, session_id)
            return candidate if candidate.exists() else None

        legacy_path = self.session_data_dir / f"{session_id}.json"
        if legacy_path.exists():
            return legacy_path

        for user_dir in self.session_data_dir.iterdir():
            if not user_dir.is_dir():
                continue
            candidate = user_dir / f"{session_id}.json"
            if candidate.exists():
                return candidate
        return None

    def list_sessions(self, owner_id: str) -> List[SessionSummary]:
        """List all available sessions for a specific user.

        Returns:
            List of SessionSummary objects, sorted by creation time
            (newest first).

        Note:
            Invalid sessions are skipped with a warning log message.
        """
        if not owner_id:
            raise ValueError("owner_id is required to list sessions")

        session_list = []
        session_dir = self._get_user_dir(owner_id)
        for session_file in session_dir.glob("*.json"):
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

    def read_session(self, session_id: str, owner_id: Optional[str] = None) -> Session:
        """Read a session from disk.

        Args:
            session_id: The ID of the session to read.

        Returns:
            Session object.

        Raises:
            SessionNotFoundError: If the session does not exist.
        """
        session_path = self._resolve_session_path(session_id, owner_id)
        if not session_path:
            raise SessionNotFoundError(session_id)

        try:
            with open(session_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            session = Session.model_validate(data)
            inferred_owner_id = self._infer_owner_id(session_path)
            if session.owner_id is None and inferred_owner_id:
                session.owner_id = inferred_owner_id
            if owner_id and session.owner_id and session.owner_id != owner_id:
                raise SessionNotFoundError(session_id)
            if owner_id and session.owner_id is None:
                session.owner_id = owner_id
            return session
        except json.JSONDecodeError as e:
            logger.error("Failed to parse session %s: %s", session_id, e)
            raise SessionNotFoundError(session_id) from e

    def create_session(
        self,
        profile: Profile,
        owner_id: str,
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
        if not owner_id:
            raise ValueError("owner_id is required to create a session")

        session = Session(
            profile=profile,
            session_name=session_name,
            output_language=output_language,
            owner_id=owner_id,
        )
        self.save_session(session)
        logger.info("Created session: %s", session.session_id)
        return session

    def rename_session(
        self, session_id: str, session_name: str, owner_id: str
    ) -> None:
        """Rename a session.

        Args:
            session_id: The ID of the session to rename.
            session_name: The new name for the session.

        Raises:
            SessionNotFoundError: If the session does not exist.
        """
        session = self.read_session(session_id, owner_id=owner_id)
        session.session_name = session_name
        self.save_session(session)
        logger.info("Renamed session %s to %s", session_id, session_name)

    def save_session(self, session: Session, owner_id: Optional[str] = None) -> None:
        """Save a session to disk.

        Args:
            session: The Session object to save.
        """
        resolved_owner_id = owner_id or session.owner_id
        if not resolved_owner_id:
            raise ValueError("owner_id is required to save a session")

        session.owner_id = resolved_owner_id
        session_path = self._get_session_path(
            resolved_owner_id, session.session_id
        )
        with open(session_path, "w", encoding="utf-8") as f:
            json.dump(session.model_dump(), f, ensure_ascii=False, indent=2)
        logger.debug("Saved session: %s", session.session_id)

    def delete_session(self, session_id: str, owner_id: str) -> None:
        """Delete a session file from disk.

        Args:
            session_id: The ID of the session to delete.

        Note:
            If the session does not exist, this method does nothing.
        """
        if not owner_id:
            raise ValueError("owner_id is required to delete a session")

        session_path = self._get_session_path(owner_id, session_id)
        if session_path.exists():
            session_path.unlink()
            logger.info("Deleted session: %s", session_id)
