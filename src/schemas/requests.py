from pydantic import BaseModel
from typing import Optional

class LabManualRequest(BaseModel):
    """Request schema for uploading a lab manual."""
    content: str

class CurriculumGenerationRequest(BaseModel):
    """Request schema for generating a curriculum."""
    lab_manual_id: str

class PersonaGenerationRequest(BaseModel):
    """Request schema for generating a persona."""
    lab_manual_id: str

class ProfileCompilationRequest(BaseModel):
    """Request schema for compiling a profile."""
    curriculum_id: str
    persona_id: str
    profile_name: Optional[str] = None
