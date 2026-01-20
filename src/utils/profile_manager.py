"""Profile management module.

This module handles loading, listing, and persistence of tutor profiles using SQLite.
"""

import logging
from typing import List, Optional

from sqlalchemy.orm import Session
from sqlalchemy.exc import NoResultFound

from core.exceptions import ProfileNotFoundError
from models.profile import ProfileModel
from models.document import Document
from schemas.profile import Profile
from utils.converters import profile_to_model, model_to_profile

logger = logging.getLogger(__name__)


class ProfileManager:
    """Manages tutor profile operations using SQLAlchemy."""

    def __init__(self, db: Session):
        """Initialize ProfileManager.

        Args:
            db: SQLAlchemy Session.
        """
        self.db = db

    def list_profiles(self) -> List[Profile]:
        """List all available profiles.

        Returns:
            List of Profile objects, sorted by creation time (newest first).
        """
        # Create at is string iso format, so desc sort works if format is strict.
        # Otherwise use id or converted date.
        models = self.db.query(ProfileModel).order_by(ProfileModel.create_at.desc()).all()
        return [model_to_profile(m) for m in models]

    def list_profiles_by_owner(
        self, owner_id: str, include_unowned: bool = False
    ) -> List[Profile]:
        """List profiles created by a specific owner.

        Args:
            owner_id: The user_id of the owner.
            include_unowned: Whether to include profiles without an owner_id.

        Returns:
            List of Profile objects.
        """
        query = self.db.query(ProfileModel)
        if include_unowned:
            query = query.filter(
                (ProfileModel.owner_id == owner_id) | (ProfileModel.owner_id.is_(None))
            )
        else:
            query = query.filter(ProfileModel.owner_id == owner_id)
        models = query.order_by(ProfileModel.create_at.desc()).all()
        return [model_to_profile(m) for m in models]

    def list_profiles_by_visible_classes(self, class_ids: List[str]) -> List[Profile]:
        """List profiles visible to any of the provided class IDs."""
        if not class_ids:
            return []
        models = self.db.query(ProfileModel).order_by(ProfileModel.create_at.desc()).all()
        visible = []
        class_id_set = set(class_ids)
        for model in models:
            visible_ids = set(model.visible_class_ids or [])
            if visible_ids.intersection(class_id_set):
                visible.append(model_to_profile(model))
        return visible

    def _get_model(self, profile_id: str) -> ProfileModel:
        """Helper to get ORM model."""
        model = self.db.query(ProfileModel).filter(ProfileModel.profile_id == profile_id).first()
        if not model:
            raise ProfileNotFoundError(profile_id)
        return model

    def read_profile(self, profile_id: str) -> Profile:
        """Read a profile from DB.

        Args:
            profile_id: The ID of the profile to read.

        Returns:
            Profile object.

        Raises:
            ProfileNotFoundError: If the profile does not exist.
        """
        model = self._get_model(profile_id)
        return model_to_profile(model)

    def save_profile(self, profile: Profile) -> Profile:
        """Save a profile to DB.

        Args:
            profile: The Profile object to save.

        Returns:
            The saved Profile object.
        """
        # Check if exists to update or insert
        existing = self.db.query(ProfileModel).filter(ProfileModel.profile_id == profile.profile_id).first()

        # Resolve document_id from lab_name if possible
        document_id = None
        if profile.lab_name:
            doc = self.db.query(Document).filter(Document.doc_name == profile.lab_name).first()
            if doc:
                document_id = doc.id

        new_model = profile_to_model(profile, document_id)

        if existing:
            # Update fields
            existing.profile_name = new_model.profile_name
            existing.topic_name = new_model.topic_name
            existing.lab_name = new_model.lab_name
            existing.owner_id = new_model.owner_id
            existing.visible_class_ids = new_model.visible_class_ids
            existing.document_id = new_model.document_id
            existing.persona_hints = new_model.persona_hints
            existing.target_audience = new_model.target_audience
            existing.curriculum = new_model.curriculum
            existing.prompt_template = new_model.prompt_template
            # Don't necessarily update create_at, preserve original
        else:
            self.db.add(new_model)

        self.db.commit()

        # Refresh to get any DB-side changes if needed, though we constructed it manually
        # return the input profile as it is what we saved
        logger.info("Saved profile: %s", profile.profile_id)
        return profile

    def delete_profile(self, profile_id: str) -> None:
        """Delete a profile from DB.

        Args:
            profile_id: The ID of the profile to delete.

        Raises:
            ProfileNotFoundError: If the profile does not exist.
        """
        model = self._get_model(profile_id)
        self.db.delete(model)
        self.db.commit()
        logger.info("Deleted profile: %s", profile_id)

    def rename_profile(self, profile_id: str, profile_name: str) -> Profile:
        """Rename a profile by updating its profile_name field.

        Args:
            profile_id: The ID of the profile to rename.
            profile_name: New profile name.

        Returns:
            Updated Profile object.
        """
        model = self._get_model(profile_id)
        model.profile_name = profile_name
        self.db.commit()
        logger.info("Renamed profile %s to %s", profile_id, profile_name)
        return model_to_profile(model)
