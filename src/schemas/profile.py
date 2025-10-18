from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, model_validator
import uuid
from datetime import datetime
import pytz

import sys
from pathlib import Path
# Add the src directory to sys.path
sys.path.append(str(Path(__file__).resolve().parents[1]))
from schemas.curriculum import SocraticCurriculum

class Profile(BaseModel):
    """structure of profile"""
    profile_id: str = Field(
        description="The unique identifier for the profile.",
        default_factory=lambda: str(uuid.uuid4()) # auto generate a uuid
    )
    
    profile_name: Optional[str] = Field(
        description="The name of the profile. if None, use topic name as default",
    )
    @model_validator(mode="after")
    def set_profile_name_dafault(self):
        if not self.profile_name: # if profile_name is None
            self.profile_name = self.topic_name
        return self
    
    topic_name: str = Field(
        description="The name of the topic."
    )
    
    persona_hints: List[str] = Field(
        description="A list of creative and fitting clues to define the tutor's persona (role, tone, style, catchphrase)."
    )
    
    target_audience: str = Field(
        description="The inferred target audience based on the manual's complexity and content."
    )
    
    curriculum: SocraticCurriculum = Field(
        description="The finalized, step-by-step, and structured teaching plan for the lab."
    )
    
    prompt_template: str = Field(
        description="The template for the prompt to the LLM."
    )
    
    create_at: str = Field(
        description="The time when the session was created.",
        default_factory=lambda: datetime.now(pytz.utc).isoformat()
    )
    
    def get(self, key: str, default: Any=None):
        return getattr(self, key, default)