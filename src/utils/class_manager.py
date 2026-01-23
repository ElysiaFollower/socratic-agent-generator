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
        """Join a class using an invitation code.

        Any registered user can join a class using a valid invitation code.
        The role_in_class is determined by the user's global role:
        - admin/teacher: joins as 'teacher' role in class
        - student: joins as 'student' role in class

        Args:
            code: Invitation code.
            user_id: User ID joining the class.

        Returns:
            Class ID that was joined.

        Raises:
            ValueError: If invitation code is invalid or expired.
        """
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
        
        # Determine role_in_class based on user's global role
        user_model = self.db.query(UserModel).filter(UserModel.user_id == user_id).first()
        if not user_model:
            raise ValueError("User not found")
        
        # Admin and teacher join as 'teacher' role in class, student joins as 'student'
        role_in_class = "teacher" if user_model.role in ["admin", "teacher"] else "student"
        self.add_member(model.class_id, user_id, role_in_class)
        return model.class_id

    def delete_invitation_code(self, code: str) -> None:
        """Delete a class invitation code.

        Args:
            code: Invitation code to delete.

        Raises:
            ValueError: If the code is not found.
        """
        model = (
            self.db.query(ClassInvitationCodeModel)
            .filter(ClassInvitationCodeModel.code == code)
            .first()
        )
        if not model:
            raise ValueError("Invitation code not found")
        self.db.delete(model)
        self.db.commit()
        logger.info("Deleted class invitation code: %s", code)

    def update_invitation_code_expires_at(
        self, code: str, expires_in_days: int
    ) -> ClassInvitationCodeModel:
        """Update the expiration date of a class invitation code.

        Args:
            code: Invitation code to update.
            expires_in_days: Number of days until expiration.

        Returns:
            Updated ClassInvitationCodeModel instance.

        Raises:
            ValueError: If the code is not found or expires_in_days is invalid.
        """
        if expires_in_days < 1 or expires_in_days > 365:
            raise ValueError("expires_in_days must be between 1 and 365")

        model = (
            self.db.query(ClassInvitationCodeModel)
            .filter(ClassInvitationCodeModel.code == code)
            .first()
        )
        if not model:
            raise ValueError("Invitation code not found")

        expires_at = datetime.now(pytz.utc) + timedelta(days=expires_in_days)
        model.expires_at = expires_at.isoformat()
        self.db.commit()
        self.db.refresh(model)
        logger.info(
            "Updated expiration date for class invitation code: %s, new expires_at: %s",
            code,
            model.expires_at,
        )
        return model

    def delete_class(self, class_id: str, owner_id: str) -> None:
        """Delete a class and all related data.

        Only the class owner can delete the class.

        Args:
            class_id: Class ID to delete.
            owner_id: Owner ID (must match class owner).

        Raises:
            ClassNotFoundError: If class not found.
            ValueError: If user is not the owner.
        """
        class_model = self.get_class(class_id)
        if class_model.owner_id != owner_id:
            raise ValueError("Only class owner can delete the class")

        # Delete all related data in correct order due to foreign key constraints
        # Delete invitation codes first
        self.db.query(ClassInvitationCodeModel).filter(
            ClassInvitationCodeModel.class_id == class_id
        ).delete()

        # Delete memberships
        self.db.query(ClassMembershipModel).filter(
            ClassMembershipModel.class_id == class_id
        ).delete()

        # Delete the class
        self.db.delete(class_model)
        self.db.commit()
        logger.info("Deleted class: %s", class_id)

    def leave_class(self, class_id: str, user_id: str) -> None:
        """Leave a class (remove user's membership).

        Non-owner members can leave a class. The class owner cannot leave.

        Args:
            class_id: Class ID to leave.
            user_id: User ID leaving the class.

        Raises:
            ClassNotFoundError: If class not found.
            ValueError: If user is the class owner or not a member.
        """
        class_model = self.get_class(class_id)

        # Class owner cannot leave their own class
        if class_model.owner_id == user_id:
            raise ValueError("Class owner cannot leave the class")

        # Check if user is a member
        membership = (
            self.db.query(ClassMembershipModel)
            .filter(
                ClassMembershipModel.class_id == class_id,
                ClassMembershipModel.user_id == user_id,
            )
            .first()
        )
        if not membership:
            raise ValueError("User is not a member of this class")

        # Delete the membership
        self.db.delete(membership)
        self.db.commit()
        logger.info("User %s left class %s", user_id, class_id)
