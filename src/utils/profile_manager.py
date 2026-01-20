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
        """List profiles visible to any of the provided class IDs.
        
        Optimized to filter at the database level using JSON functions.
        """
        if not class_ids:
            return []
        
        # Use SQLite's JSON functions to filter profiles directly in the database
        # This avoids loading all profiles into memory and filtering in Python
        from sqlalchemy import text
        
        # Build conditions to check if any class_id exists in the visible_class_ids JSON array
        conditions = []
        for class_id in class_ids:
            # Use JSON_EXTRACT to check if the class_id exists in the array
            conditions.append(f"json_type(visible_class_ids, '$') = 'array' AND json_extract(visible_class_ids, '$') LIKE '%\"{class_id}\"%'")
        
        # Execute the query with the conditions
        query_sql = f"""
            SELECT * FROM profiles 
            WHERE visible_class_ids IS NOT NULL 
            AND (
                {' OR '.join(conditions)}
            )
            ORDER BY create_at DESC
        """
        
        result = self.db.execute(text(query_sql))
        
        # Convert to Profile objects directly
        import json
        profiles = []
        for row in result:
            # Parse JSON fields that are stored as strings
            visible_class_ids = []
            if row.visible_class_ids:
                try:
                    visible_class_ids = json.loads(row.visible_class_ids)
                except (json.JSONDecodeError, TypeError):
                    visible_class_ids = []
            
            persona_hints = []
            if row.persona_hints:
                try:
                    persona_hints = json.loads(row.persona_hints)
                except (json.JSONDecodeError, TypeError):
                    persona_hints = []
            
            curriculum = []
            if row.curriculum:
                try:
                    curriculum = json.loads(row.curriculum)
                except (json.JSONDecodeError, TypeError):
                    curriculum = []
            
            profile = Profile(
                profile_id=row.profile_id,
                profile_name=row.profile_name,
                topic_name=row.topic_name,
                lab_name=row.lab_name,
                owner_id=row.owner_id,
                visible_class_ids=visible_class_ids,
                document_id=row.document_id,
                persona_hints=persona_hints,
                target_audience=row.target_audience,
                curriculum=curriculum,
                prompt_template=row.prompt_template,
                create_at=row.create_at
            )
            profiles.append(profile)
        
        return profiles

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
