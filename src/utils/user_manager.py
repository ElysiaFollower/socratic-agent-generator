"""User management utilities.

This module provides user management functionality including user storage,
password hashing, invitation code generation, and user authentication.
"""

import hashlib
import json
import logging
import secrets
from pathlib import Path
from typing import Dict, List, Optional

import bcrypt

from config import DATA_DIR
from schemas.user import User

logger = logging.getLogger(__name__)

# Use bcrypt directly instead of passlib to avoid initialization issues
# Bcrypt rounds for password hashing (higher = more secure but slower)
BCRYPT_ROUNDS = 12

# Users data directory
USERS_DIR_NAME = "users"
USERS_DIR = DATA_DIR / USERS_DIR_NAME
USERS_FILE = USERS_DIR / "users.json"

# Invitation codes directory
INVITATION_CODES_DIR = USERS_DIR / "invitation_codes"
INVITATION_CODES_FILE = INVITATION_CODES_DIR / "codes.json"


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
    """Manages user data persistence and operations."""

    def __init__(self):
        """Initialize UserManager and ensure directories exist."""
        USERS_DIR.mkdir(parents=True, exist_ok=True)
        INVITATION_CODES_DIR.mkdir(parents=True, exist_ok=True)
        if not USERS_FILE.exists():
            self._save_users({})

    def _load_users(self) -> Dict[str, dict]:
        """Load users from JSON file.

        Returns:
            Dictionary mapping username to user data.
        """
        if not USERS_FILE.exists():
            return {}
        try:
            with open(USERS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}

    def _save_users(self, users: Dict[str, dict]) -> None:
        """Save users to JSON file.

        Args:
            users: Dictionary mapping username to user data.
        """
        with open(USERS_FILE, "w", encoding="utf-8") as f:
            json.dump(users, f, ensure_ascii=False, indent=2)

    def _load_invitation_codes(self) -> Dict[str, dict]:
        """Load invitation codes from JSON file.

        Returns:
            Dictionary mapping invitation code to code data.
        """
        if not INVITATION_CODES_FILE.exists():
            return {}
        try:
            with open(INVITATION_CODES_FILE, "r", encoding="utf-8") as f:
                codes = json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
        changed = False
        for data in codes.values():
            if "used" in data:
                data.pop("used", None)
                changed = True
            if "used_at" in data:
                data.pop("used_at", None)
                changed = True
        if changed:
            self._save_invitation_codes(codes)
        return codes

    def _save_invitation_codes(self, codes: Dict[str, dict]) -> None:
        """Save invitation codes to JSON file.

        Args:
            codes: Dictionary mapping invitation code to code data.
        """
        with open(INVITATION_CODES_FILE, "w", encoding="utf-8") as f:
            json.dump(codes, f, ensure_ascii=False, indent=2)

    def list_invitation_codes(self, created_by: Optional[str] = None) -> List[dict]:
        """List invitation codes with optional creator filtering.

        Args:
            created_by: Optional username to filter invitation codes.

        Returns:
            List of invitation code dictionaries including the code.
        """
        codes = self._load_invitation_codes()
        results: List[dict] = []

        for code, data in codes.items():
            if created_by and data.get("created_by") != created_by:
                continue
            results.append({"code": code, **data})

        results.sort(key=lambda item: item.get("created_at", ""), reverse=True)
        return results

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
        users = self._load_users()
        if username in users:
            raise UserAlreadyExistsError(f"User '{username}' already exists")

        password_hash = self.hash_password(password)
        user = User(
            username=username,
            password_hash=password_hash,
            role=role,
            display_name=display_name,
            email=email,
        )

        users[username] = user.model_dump()
        self._save_users(users)
        return user

    def get_user_by_username(self, username: str) -> Optional[User]:
        """Get a user by username.

        Args:
            username: Username to look up.

        Returns:
            User object if found, None otherwise.
        """
        users = self._load_users()
        user_data = users.get(username)
        if user_data:
            return User(**user_data)
        return None

    def get_user_by_id(self, user_id: str) -> Optional[User]:
        """Get a user by user ID.

        Args:
            user_id: User ID to look up.

        Returns:
            User object if found, None otherwise.
        """
        users = self._load_users()
        for user_data in users.values():
            if user_data.get("user_id") == user_id:
                return User(**user_data)
        return None

    def list_users(self) -> List[User]:
        """List all users.

        Returns:
            List of User objects.
        """
        users = self._load_users()
        return [User(**user_data) for user_data in users.values()]

    def generate_invitation_code(
        self, role: str, created_by: str, expires_in_days: int = 30
    ) -> str:
        """Generate a new invitation code.

        Args:
            role: Role for which the invitation code is valid ('teacher' or 'student').
            created_by: Username of the user creating the invitation.
            expires_in_days: Number of days until the code expires.

        Returns:
            Generated invitation code.
        """
        from datetime import datetime, timedelta

        import pytz

        code = secrets.token_urlsafe(32)
        codes = self._load_invitation_codes()

        expires_at = datetime.now(pytz.utc) + timedelta(days=expires_in_days)
        codes[code] = {
            "role": role,
            "created_by": created_by,
            "created_at": datetime.now(pytz.utc).isoformat(),
            "expires_at": expires_at.isoformat(),
        }

        self._save_invitation_codes(codes)
        return code

    def validate_invitation_code(
        self, code: str, required_role: str
    ) -> tuple[bool, Optional[str]]:
        """Validate an invitation code.

        Args:
            code: Invitation code to validate.
            required_role: Required role for the code.

        Returns:
            Tuple of (is_valid, error_message).
        """
        codes = self._load_invitation_codes()
        code_data = codes.get(code)

        if not code_data:
            return False, "Invalid invitation code"

        if code_data.get("role") != required_role:
            return (
                False,
                f"Invitation code is for role '{code_data.get('role')}', not '{required_role}'",
            )

        from datetime import datetime

        import pytz

        expires_at_str = code_data.get("expires_at")
        if expires_at_str:
            expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
            if datetime.now(pytz.utc) > expires_at:
                return False, "Invitation code has expired"

        return True, None
