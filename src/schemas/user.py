"""User schema definitions.

This module defines the User data model and authentication-related schemas.
"""

import uuid
from datetime import datetime
from typing import Optional

import pytz
from pydantic import BaseModel, Field


class User(BaseModel):
    """User model structure."""

    user_id: str = Field(
        description="The unique identifier for the user.",
        default_factory=lambda: str(uuid.uuid4()),
    )
    username: str = Field(description="The username for login.")
    password_hash: str = Field(description="The hashed password.")
    role: str = Field(
        description="User role: 'admin', 'teacher', or 'student'.",
    )
    display_name: Optional[str] = Field(
        default=None,
        description="Display name for the user.",
    )
    email: Optional[str] = Field(
        default=None,
        description="Email address of the user.",
    )
    create_at: str = Field(
        description="The time when the user was created.",
        default_factory=lambda: datetime.now(pytz.utc).isoformat(),
    )


class RegisterRequest(BaseModel):
    """Request model for user registration."""

    username: str = Field(description="Username for the new account.")
    password: str = Field(description="Password for the new account.")
    role: str = Field(
        description="Role to register as: 'admin', 'teacher', or 'student'.",
    )
    display_name: Optional[str] = Field(
        default=None,
        description="Display name for the user.",
    )
    email: Optional[str] = Field(
        default=None,
        description="Email address of the user.",
    )
    admin_token: Optional[str] = Field(
        default=None,
        description="Admin token required for admin registration.",
    )
    invitation_code: Optional[str] = Field(
        default=None,
        description="Invitation code required for teacher/student registration.",
    )


class LoginRequest(BaseModel):
    """Request model for user login."""

    username: str = Field(description="Username for login.")
    password: str = Field(description="Password for login.")


class LoginResponse(BaseModel):
    """Response model for successful login."""

    user: dict = Field(description="User information (without password).")
    token: str = Field(description="Authentication token.")


class CurrentUserResponse(BaseModel):
    """Response model for current user information."""

    user: dict = Field(description="User information (without password).")


class GenerateInvitationCodeRequest(BaseModel):
    """Request model for generating registration invitation code."""

    role: str = Field(
        description="Target role for the invitation code ('teacher' or 'student')."
    )
    expires_in_days: int = Field(
        default=30,
        description="Number of days until the code expires.",
        ge=1,
        le=365,
    )


class InvitationCodeInfo(BaseModel):
    """Registration invitation code info model."""

    invitation_code: str = Field(description="Invitation code value")
    role: str = Field(description="Target role")
    created_by: str = Field(description="Creator username")
    created_at: str = Field(description="Creation time")
    expires_at: Optional[str] = Field(
        default=None, description="Expiration time (ISO 8601)"
    )


class InvitationCodeListResponse(BaseModel):
    """Response model for invitation code list."""

    invitation_codes: list[InvitationCodeInfo] = Field(
        description="Registration invitation codes"
    )

