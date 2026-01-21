"""Session management module.

This module handles loading, listing, and persistence of learning sessions using SQLite.
"""

import logging
from typing import List, Optional

from sqlalchemy.orm import Session as DBSession, joinedload

from core.exceptions import SessionNotFoundError
from config import DEFAULT_OUTPUT_LANGUAGE, DEFAULT_SESSION_NAME
from models.session import SessionModel
from models.profile import ProfileModel
from schemas.session import Session, SessionSummary
from schemas.profile import Profile
from utils.converters import session_to_model, model_to_session, profile_to_model

logger = logging.getLogger(__name__)


class SessionManager:
    """Manages session operations using SQLAlchemy."""

    def __init__(self, db: DBSession):
        """Initialize SessionManager.

        Args:
            db: SQLAlchemy Session.
        """
        self.db = db

    def list_sessions(self, owner_id: str) -> List[SessionSummary]:
        """List all available sessions for a specific user.

        Returns:
            List of SessionSummary objects, sorted by creation time (newest first).
        """
        if not owner_id:
            raise ValueError("owner_id is required to list sessions")

        # Eager load profile to get name/topic
        models = (
            self.db.query(SessionModel)
            .options(joinedload(SessionModel.profile))
            .filter(SessionModel.owner_id == owner_id)
            .order_by(SessionModel.create_at.desc())
            .all()
        )

        summaries = []
        for m in models:
            # Handle case where profile might be missing (should be cascade deleted but just in case)
            if not m.profile:
                logger.warning("Session %s has no linked profile, skipping", m.session_id)
                continue

            summaries.append(
                SessionSummary(
                    session_id=m.session_id,
                    session_name=m.session_name,
                    owner_id=m.owner_id,
                    profile_id=m.profile.profile_id,
                    profile_name=m.profile.profile_name,
                    topic_name=m.profile.topic_name,
                    create_at=m.create_at,
                    update_at=m.update_at or m.create_at
                )
            )
        return summaries

    def _get_model(self, session_id: str, owner_id: Optional[str] = None) -> SessionModel:
        """Helper to get ORM model."""
        query = self.db.query(SessionModel).options(joinedload(SessionModel.profile)).filter(SessionModel.session_id == session_id)
        if owner_id:
            query = query.filter(SessionModel.owner_id == owner_id)

        model = query.first()
        if not model:
            raise SessionNotFoundError(session_id)
        return model

    def read_session(self, session_id: str, owner_id: Optional[str] = None) -> Session:
        """Read a session from DB.

        Args:
            session_id: The ID of the session to read.
            owner_id: Optional owner_id validation.

        Returns:
            Session object.

        Raises:
            SessionNotFoundError: If the session does not exist or owner mismatch.
        """
        model = self._get_model(session_id, owner_id)
        return model_to_session(model)

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
            owner_id: User ID.
            session_name: Name of the session.
            output_language: Output language.

        Returns:
            The created Session object.
        """
        if not owner_id:
            raise ValueError("owner_id is required to create a session")

        # Create session Pydantic object
        session = Session(
            profile=profile,
            session_name=session_name,
            output_language=output_language,
            owner_id=owner_id,
        )

        # Convert to model
        # Note: We don't need to insert Profile again if it exists.
        # session_to_model uses profile.profile_id.
        model = session_to_model(session)

        self.db.add(model)
        self.db.commit()

        # We assume profile exists in DB because Session requires a valid profile_id.
        # If profile wasn't saved, this would fail foreign key constraint.
        # But `profile` argument is a full object.
        # Caller should ensure profile is saved.

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
        model = self._get_model(session_id, owner_id)
        model.session_name = session_name
        self.db.commit()
        logger.info("Renamed session %s to %s", session_id, session_name)

    def update_output_language(
        self, session_id: str, output_language: str, owner_id: str
    ) -> None:
        """Update output_language for a session.

        Args:
            session_id: The ID of the session to update.
            output_language: The new output language.
            owner_id: Owner ID for validation.

        Raises:
            SessionNotFoundError: If the session does not exist.
        """
        model = self._get_model(session_id, owner_id)
        model.output_language = output_language
        self.db.commit()
        logger.info(
            "Updated output_language for session %s to %s",
            session_id,
            output_language
        )

    def save_session(self, session: Session, owner_id: Optional[str] = None) -> None:
        """Save a session to DB.

        Args:
            session: The Session object to save.
        """
        resolved_owner_id = owner_id or session.owner_id
        if not resolved_owner_id:
            raise ValueError("owner_id is required to save a session")

        existing = self.db.query(SessionModel).filter(SessionModel.session_id == session.session_id).first()

        # We reuse session_to_model, but need to be careful not to overwrite create_at if we don't want to.
        # But simpler to just update fields.
        new_model_data = session_to_model(session)

        if existing:
            existing.session_name = new_model_data.session_name
            existing.owner_id = resolved_owner_id # Should match
            existing.state = new_model_data.state
            existing.history = new_model_data.history
            existing.output_language = new_model_data.output_language
            existing.update_at = new_model_data.update_at
            # profile_id should not change usually
        else:
            new_model_data.owner_id = resolved_owner_id
            self.db.add(new_model_data)

        self.db.commit()
        logger.debug("Saved session: %s", session.session_id)

    def delete_session(self, session_id: str, owner_id: str) -> None:
        """Delete a session from DB.

        Args:
            session_id: The ID of the session to delete.

        Note:
            If the session does not exist, this method does nothing (or raises error if we used _get_model).
        """
        if not owner_id:
            raise ValueError("owner_id is required to delete a session")

        try:
            model = self._get_model(session_id, owner_id)
            self.db.delete(model)
            self.db.commit()
            logger.info("Deleted session: %s", session_id)
        except SessionNotFoundError:
            # Legacy behavior: silent if not found?
            # The interface doc says "If the session does not exist, this method does nothing."
            pass
