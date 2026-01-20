"""Class schema definitions."""

from typing import Optional

from pydantic import BaseModel, Field


class ClassInfo(BaseModel):
    """Class info response model."""

    class_id: str = Field(description="Class ID")
    name: str = Field(description="Class name")
    owner_id: str = Field(description="Owner user_id")
    created_at: str = Field(description="Creation time")
    updated_at: str = Field(description="Last update time")
    role_in_class: Optional[str] = Field(
        default=None, description="Role of current user in this class"
    )


class CreateClassRequest(BaseModel):
    """Request model for creating a class."""

    name: str = Field(description="Class name", min_length=1)


class JoinClassRequest(BaseModel):
    """Request model for joining a class by invitation code."""

    invitation_code: str = Field(description="Class invitation code", min_length=1)


class ClassMemberInfo(BaseModel):
    """Class member info response model."""

    user_id: str = Field(description="User ID")
    username: str = Field(description="Username")
    display_name: Optional[str] = Field(default=None, description="Display name")
    role_in_class: str = Field(description="Role in class")
    joined_at: str = Field(description="Joined time")


class GenerateClassInvitationCodeRequest(BaseModel):
    """Request model for generating class invitation code."""

    expires_in_days: int = Field(
        default=30,
        description="Number of days until the code expires.",
        ge=1,
        le=365,
    )


class ClassInvitationCodeInfo(BaseModel):
    """Class invitation code info model."""

    invitation_code: str = Field(description="Invitation code value")
    class_id: str = Field(description="Class ID")
    created_by: str = Field(description="Creator user_id")
    created_at: str = Field(description="Creation time")
    expires_at: Optional[str] = Field(
        default=None, description="Expiration time (ISO 8601)"
    )


class ClassInvitationCodeListResponse(BaseModel):
    """Response model for invitation code list."""

    invitation_codes: list[ClassInvitationCodeInfo] = Field(
        description="Class invitation codes"
    )


class UpdateProfileVisibilityRequest(BaseModel):
    """Request model for updating profile visibility in a class."""

    visible: bool = Field(description="Whether the profile is visible in the class")


class UpdateClassInvitationCodeRequest(BaseModel):
    """Request model for updating class invitation code expiration."""

    expires_in_days: int = Field(
        description="Number of days until the code expires.",
        ge=1,
        le=365,
    )

