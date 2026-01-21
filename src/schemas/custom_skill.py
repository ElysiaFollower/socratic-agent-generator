from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class SkillMaterialInfo(BaseModel):
    """Response model for skill material metadata."""

    id: int = Field(description="Material ID")
    profile_id: str = Field(description="Profile ID")
    owner_id: Optional[str] = Field(default=None, description="Owner user_id")
    filename: Optional[str] = Field(default=None, description="Original filename")
    mime_type: Optional[str] = Field(default=None, description="MIME type")
    size: Optional[int] = Field(default=None, description="Content size (bytes)")
    content_hash: Optional[str] = Field(default=None, description="SHA256 hash")
    meta_info: Dict[str, Any] = Field(default_factory=dict)
    upload_time: Optional[datetime] = Field(default=None, description="Upload time")


class SkillMaterialDetail(SkillMaterialInfo):
    """Detail model for skill material."""

    content: str = Field(description="Raw text content")


class SkillMaterialTextRequest(BaseModel):
    """Request model for creating a text material."""

    content: str = Field(description="Raw text content")
    filename: Optional[str] = Field(default=None, description="Optional filename")
    mime_type: Optional[str] = Field(default=None, description="Optional MIME type")
    hint: Optional[str] = Field(default=None, description="Optional usage hint")
    meta_info: Dict[str, Any] = Field(default_factory=dict)


class CustomSkillInfo(BaseModel):
    """Response model for custom skill metadata."""

    id: int = Field(description="Skill ID")
    profile_id: str = Field(description="Profile ID")
    owner_id: Optional[str] = Field(default=None, description="Owner user_id")
    skill_key: Optional[str] = Field(default=None, description="Skill key")
    name: str = Field(description="Skill name")
    description: str = Field(description="Skill description")
    skill_type: Optional[str] = Field(default=None, description="Skill type")
    tool_name: str = Field(description="Tool name")
    index_path: Optional[str] = Field(
        default=None, description="Index reference (sqlite-vec table or namespace)"
    )
    status: str = Field(description="Skill status")
    meta_info: Dict[str, Any] = Field(default_factory=dict)
    create_at: Optional[datetime] = Field(default=None, description="Created time")
    update_at: Optional[datetime] = Field(default=None, description="Updated time")
    material_ids: List[int] = Field(default_factory=list)


class CustomSkillDetail(CustomSkillInfo):
    """Detail model for custom skill."""

    instructions: Optional[str] = Field(
        default=None, description="Full skill instructions"
    )


class CustomSkillDraft(BaseModel):
    """LLM-generated draft for a custom skill."""

    skill_key: Optional[str] = Field(default=None, description="Skill key")
    name: str = Field(description="Skill name", min_length=1)
    description: str = Field(description="Skill description", min_length=1)
    skill_type: Optional[str] = Field(default=None, description="Skill type")
    tool_name: str = Field(description="Tool name", min_length=1)
    instructions: Optional[str] = Field(default=None, description="Skill instructions")
    index_path: Optional[str] = Field(
        default=None, description="Index reference (sqlite-vec table or namespace)"
    )
    status: Optional[str] = Field(default=None, description="Skill status")
    meta_info: Dict[str, Any] = Field(default_factory=dict)


class CustomSkillCreateRequest(BaseModel):
    """Request model for creating a custom skill."""

    skill_key: Optional[str] = Field(default=None, description="Skill key")
    name: str = Field(description="Skill name", min_length=1)
    description: str = Field(description="Skill description", min_length=1)
    skill_type: Optional[str] = Field(default=None, description="Skill type")
    tool_name: str = Field(description="Tool name", min_length=1)
    instructions: Optional[str] = Field(default=None, description="Skill instructions")
    index_path: Optional[str] = Field(
        default=None, description="Index reference (sqlite-vec table or namespace)"
    )
    status: Optional[str] = Field(default=None, description="Skill status")
    meta_info: Dict[str, Any] = Field(default_factory=dict)
    material_ids: List[int] = Field(default_factory=list)


class CustomSkillUpdateRequest(BaseModel):
    """Request model for updating a custom skill."""

    skill_key: Optional[str] = Field(default=None, description="Skill key")
    name: Optional[str] = Field(default=None, description="Skill name")
    description: Optional[str] = Field(default=None, description="Skill description")
    skill_type: Optional[str] = Field(default=None, description="Skill type")
    tool_name: Optional[str] = Field(default=None, description="Tool name")
    instructions: Optional[str] = Field(default=None, description="Skill instructions")
    index_path: Optional[str] = Field(
        default=None, description="Index reference (sqlite-vec table or namespace)"
    )
    status: Optional[str] = Field(default=None, description="Skill status")
    meta_info: Optional[Dict[str, Any]] = Field(default=None)
    material_ids: Optional[List[int]] = Field(default=None)


class CustomSkillGenerateRequest(BaseModel):
    """Request model for generating a custom skill draft."""

    material_ids: List[int] = Field(default_factory=list)
    hint: Optional[str] = Field(default=None, description="Optional generation hint")
    output_language: Optional[str] = Field(
        default=None,
        description="Output language for generated skill. Defaults to DEFAULT_OUTPUT_LANGUAGE.",
    )


class CustomSkillGenerateResponse(BaseModel):
    """Response model for generated custom skill draft."""

    draft: CustomSkillDraft
    material_ids: List[int] = Field(default_factory=list)


class CustomSkillAssignRequest(BaseModel):
    """Request model for assigning a skill to another profile."""

    profile_id: str = Field(description="Target profile ID")
    material_ids: List[int] = Field(default_factory=list)
