"""Class management utilities."""

import logging
import secrets
from datetime import datetime, timedelta
from typing import List, Optional

import pytz
from sqlalchemy.orm import Session

from models.class_model import ClassModel
from models.class_membership import ClassMembershipModel
from models.class_invitation_code import ClassInvitationCodeModel
from models.user import UserModel

logger = logging.getLogger(__name__)


class ClassNotFoundError(Exception):
    """Exception raised when a class is not found."""

    pass


class ClassManager:
    """Manages class, membership, and invitation operations."""

    def __init__(self, db: Session):
        self.db = db

    def create_class(self, name: str, owner_id: str) -> ClassModel:
        """Create a new class and add owner membership."""
        now = datetime.now(pytz.utc).isoformat()
        class_model = ClassModel(
            class_id=secrets.token_hex(8),
            name=name,
            owner_id=owner_id,
            created_at=now,
            updated_at=now,
        )
        self.db.add(class_model)
        self.db.flush()

        membership = ClassMembershipModel(
            class_id=class_model.class_id,
            user_id=owner_id,
            role_in_class="teacher",
            joined_at=now,
        )
        self.db.add(membership)
        self.db.commit()
        self.db.refresh(class_model)
        return class_model

    def get_class(self, class_id: str) -> ClassModel:
        model = (
            self.db.query(ClassModel)
            .filter(ClassModel.class_id == class_id)
            .first()
        )
        if not model:
            raise ClassNotFoundError(class_id)
        return model

    def list_classes_for_owner(self, owner_id: str) -> List[ClassModel]:
        return (
            self.db.query(ClassModel)
            .filter(ClassModel.owner_id == owner_id)
            .order_by(ClassModel.created_at.desc())
            .all()
        )

    def list_classes_for_user(self, user_id: str) -> List[ClassMembershipModel]:
        return (
            self.db.query(ClassMembershipModel)
            .filter(ClassMembershipModel.user_id == user_id)
            .all()
        )

    def list_class_ids_for_user(self, user_id: str) -> List[str]:
        memberships = self.list_classes_for_user(user_id)
        return [m.class_id for m in memberships]

    def add_member(self, class_id: str, user_id: str, role_in_class: str) -> None:
        existing = (
            self.db.query(ClassMembershipModel)
            .filter(
                ClassMembershipModel.class_id == class_id,
                ClassMembershipModel.user_id == user_id,
            )
            .first()
        )
        if existing:
            return
        now = datetime.now(pytz.utc).isoformat()
        membership = ClassMembershipModel(
            class_id=class_id,
            user_id=user_id,
            role_in_class=role_in_class,
            joined_at=now,
        )
        self.db.add(membership)
        self.db.commit()

    def list_members(self, class_id: str) -> List[dict]:
        query = (
            self.db.query(ClassMembershipModel, UserModel)
            .join(UserModel, UserModel.user_id == ClassMembershipModel.user_id)
            .filter(ClassMembershipModel.class_id == class_id)
        )
        results = []
        for membership, user in query.all():
            results.append(
                {
                    "user_id": user.user_id,
                    "username": user.username,
                    "display_name": user.display_name,
                    "role_in_class": membership.role_in_class,
                    "joined_at": membership.joined_at,
                }
            )
        return results

    def generate_invitation_code(
        self, class_id: str, created_by: str, expires_in_days: int = 30
    ) -> ClassInvitationCodeModel:
        code = secrets.token_urlsafe(16)
        expires_at = datetime.now(pytz.utc) + timedelta(days=expires_in_days)
        model = ClassInvitationCodeModel(
            code=code,
            class_id=class_id,
            created_by=created_by,
            created_at=datetime.now(pytz.utc).isoformat(),
            expires_at=expires_at.isoformat(),
        )
        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)
        return model

    def list_invitation_codes(
        self, class_id: Optional[str] = None, owner_id: Optional[str] = None
    ) -> List[ClassInvitationCodeModel]:
        query = self.db.query(ClassInvitationCodeModel)
        if class_id:
            query = query.filter(ClassInvitationCodeModel.class_id == class_id)
        if owner_id:
            query = query.join(
                ClassModel, ClassModel.class_id == ClassInvitationCodeModel.class_id
            ).filter(ClassModel.owner_id == owner_id)
        return query.order_by(ClassInvitationCodeModel.created_at.desc()).all()

    def join_by_invitation_code(self, code: str, user_id: str) -> str:
        model = (
            self.db.query(ClassInvitationCodeModel)
            .filter(ClassInvitationCodeModel.code == code)
            .first()
        )
        if not model:
            raise ValueError("Invalid invitation code")
        if model.expires_at:
            expires_at = datetime.fromisoformat(model.expires_at.replace("Z", "+00:00"))
            if datetime.now(pytz.utc) > expires_at:
                raise ValueError("Invitation code has expired")
        self.add_member(model.class_id, user_id, "student")
        return model.class_id
