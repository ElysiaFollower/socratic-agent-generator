"""User management utilities.

This module provides user management functionality including user storage,
password hashing, invitation code generation, and user authentication.
"""

import logging
import secrets
from datetime import datetime, timedelta
from typing import List, Optional

import bcrypt
import pytz
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from schemas.user import User
from models.user import UserModel
from models.invitation_code import InvitationCodeModel
from utils.converters import user_to_model, model_to_user

logger = logging.getLogger(__name__)

# Use bcrypt directly instead of passlib to avoid initialization issues
# Bcrypt rounds for password hashing (higher = more secure but slower)
BCRYPT_ROUNDS = 12


class UserNotFoundError(Exception):
    """Exception raised when a user is not found."""

    pass


class UserAlreadyExistsError(Exception):
    """Exception raised when trying to create a user that already exists."""

    pass


class InvalidInvitationCodeError(Exception):
    """Exception raised when an invitation code is invalid."""

    pass


class UserManager:
    """Manages user data persistence and operations using SQLAlchemy."""

    def __init__(self, db: Session):
        """Initialize UserManager.

        Args:
            db: SQLAlchemy Session.
        """
        self.db = db

    def hash_password(self, password: str) -> str:
        """Hash a password using bcrypt.

        Args:
            password: Plain text password.

        Returns:
            Hashed password (bcrypt hash string).
        """
        # Ensure password is a string and not bytes
        if isinstance(password, bytes):
            password = password.decode('utf-8')
        elif not isinstance(password, str):
            password = str(password)
        
        # Debug logging
        logger.info(f"Password type: {type(password)}")
        logger.info(f"Password length: {len(password)}")
        logger.info(f"Password bytes length: {len(password.encode('utf-8'))}")
        logger.info(f"Password value (first 20 chars): {password[:20]}")
        
        # Truncate password if it exceeds bcrypt's 72-byte limit
        password_bytes = password.encode('utf-8')
        if len(password_bytes) > 72:
            logger.warning(
                f"Password exceeds 72 bytes ({len(password_bytes)} bytes), truncating"
            )
            password_bytes = password_bytes[:72]
        
        # Hash password using bcrypt directly
        # bcrypt.hashpw returns bytes, we need to decode to string
        salt = bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
        hashed = bcrypt.hashpw(password_bytes, salt)
        return hashed.decode('utf-8')

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against a bcrypt hash.

        Args:
            plain_password: Plain text password to verify.
            hashed_password: Bcrypt hash string to verify against.

        Returns:
            True if password matches, False otherwise.
        """
        # Ensure password is bytes
        if isinstance(plain_password, str):
            password_bytes = plain_password.encode('utf-8')
        else:
            password_bytes = plain_password
        
        # Truncate if necessary
        if len(password_bytes) > 72:
            password_bytes = password_bytes[:72]
        
        # Ensure hash is bytes
        if isinstance(hashed_password, str):
            hash_bytes = hashed_password.encode('utf-8')
        else:
            hash_bytes = hashed_password
        
        # Verify using bcrypt
        try:
            return bcrypt.checkpw(password_bytes, hash_bytes)
        except Exception as e:
            logger.error(f"Password verification error: {e}")
            return False

    def create_user(
        self,
        username: str,
        password: str,
        role: str,
        display_name: Optional[str] = None,
        email: Optional[str] = None,
    ) -> User:
        """Create a new user.

        Args:
            username: Username for the new user.
            password: Plain text password.
            role: User role ('admin', 'teacher', or 'student').
            display_name: Optional display name.
            email: Optional email address.

        Returns:
            Created User object.

        Raises:
            UserAlreadyExistsError: If username already exists.
        """
        # Check if user already exists
        existing = self.db.query(UserModel).filter(UserModel.username == username).first()
        if existing:
            raise UserAlreadyExistsError(f"User '{username}' already exists")

        password_hash = self.hash_password(password)
        user = User(
            username=username,
            password_hash=password_hash,
            role=role,
            display_name=display_name,
            email=email,
        )

        # Save to database
        # Handle potential race condition: if two requests check simultaneously,
        # both might pass the check but database unique constraint will catch it
        try:
            model = user_to_model(user)
            self.db.add(model)
            self.db.commit()
            self.db.refresh(model)
        except IntegrityError as e:
            # Rollback the failed transaction
            self.db.rollback()
            # Check if it's a username uniqueness violation
            if "username" in str(e).lower() or "unique" in str(e).lower():
                raise UserAlreadyExistsError(f"User '{username}' already exists") from e
            # Re-raise if it's a different integrity error
            raise
        
        logger.info("Created user: %s", username)
        return user

    def get_user_by_username(self, username: str) -> Optional[User]:
        """Get a user by username.

        Args:
            username: Username to look up.

        Returns:
            User object if found, None otherwise.
        """
        model = self.db.query(UserModel).filter(UserModel.username == username).first()
        if model:
            return model_to_user(model)
        return None

    def get_user_by_id(self, user_id: str) -> Optional[User]:
        """Get a user by user ID.

        Args:
            user_id: User ID to look up.

        Returns:
            User object if found, None otherwise.
        """
        model = self.db.query(UserModel).filter(UserModel.user_id == user_id).first()
        if model:
            return model_to_user(model)
        return None

    def list_users(self) -> List[User]:
        """List all users.

        Returns:
            List of User objects.
        """
        models = self.db.query(UserModel).all()
        return [model_to_user(m) for m in models]

    def generate_invitation_code(
        self,
        role: str,
        created_by: str,
        expires_in_days: int = 30,
    ) -> InvitationCodeModel:
        """Generate a registration invitation code.

        Args:
            role: Target role for the invitation code ('teacher' or 'student').
            created_by: Username of the creator.
            expires_in_days: Number of days until expiration (default: 30).

        Returns:
            Created InvitationCodeModel instance.

        Raises:
            ValueError: If role is invalid.
        """
        if role not in ["teacher", "student"]:
            raise ValueError(f"Invalid role: {role}. Must be 'teacher' or 'student'.")

        code = secrets.token_urlsafe(16)
        expires_at = datetime.now(pytz.utc) + timedelta(days=expires_in_days)
        model = InvitationCodeModel(
            code=code,
            role=role,
            created_by=created_by,
            created_at=datetime.now(pytz.utc).isoformat(),
            expires_at=expires_at.isoformat(),
        )
        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)
        logger.info("Generated invitation code for role: %s, created by: %s", role, created_by)
        return model

    def verify_invitation_code(self, code: str, required_role: str) -> bool:
        """Verify an invitation code is valid for the required role.

        Args:
            code: Invitation code to verify.
            required_role: Required role ('teacher' or 'student').

        Returns:
            True if the code is valid, False otherwise.
        """
        model = (
            self.db.query(InvitationCodeModel)
            .filter(InvitationCodeModel.code == code)
            .first()
        )
        if not model:
            return False

        # Check role match
        if model.role != required_role:
            return False

        # Check expiration
        if model.expires_at:
            expires_at = datetime.fromisoformat(model.expires_at.replace("Z", "+00:00"))
            if datetime.now(pytz.utc) > expires_at:
                return False

        return True


    def list_invitation_codes(
        self, role: Optional[str] = None, created_by: Optional[str] = None
    ) -> List[InvitationCodeModel]:
        """List invitation codes with optional filters.

        Args:
            role: Optional role filter ('teacher' or 'student').
            created_by: Optional creator username filter.

        Returns:
            List of InvitationCodeModel instances.
        """
        query = self.db.query(InvitationCodeModel)
        if role:
            query = query.filter(InvitationCodeModel.role == role)
        if created_by:
            query = query.filter(InvitationCodeModel.created_by == created_by)
        return query.order_by(InvitationCodeModel.created_at.desc()).all()

    def delete_invitation_code(self, code: str) -> None:
        """Delete an invitation code.

        Args:
            code: Invitation code to delete.

        Raises:
            ValueError: If the code is not found.
        """
        model = (
            self.db.query(InvitationCodeModel)
            .filter(InvitationCodeModel.code == code)
            .first()
        )
        if not model:
            raise ValueError("Invitation code not found")
        self.db.delete(model)
        self.db.commit()
        logger.info("Deleted invitation code: %s", code)

    def update_invitation_code_expires_at(
        self, code: str, expires_in_days: int
    ) -> InvitationCodeModel:
        """Update the expiration date of a registration invitation code.

        Args:
            code: Invitation code to update.
            expires_in_days: Number of days until expiration.

        Returns:
            Updated InvitationCodeModel instance.

        Raises:
            ValueError: If the code is not found or expires_in_days is invalid.
        """
        if expires_in_days < 1 or expires_in_days > 365:
            raise ValueError("expires_in_days must be between 1 and 365")

        model = (
            self.db.query(InvitationCodeModel)
            .filter(InvitationCodeModel.code == code)
            .first()
        )
        if not model:
            raise ValueError("Invitation code not found")

        expires_at = datetime.now(pytz.utc) + timedelta(days=expires_in_days)
        model.expires_at = expires_at.isoformat()
        self.db.commit()
        self.db.refresh(model)
        logger.info(
            "Updated expiration date for registration invitation code: %s, new expires_at: %s",
            code,
            model.expires_at,
        )
        return model
