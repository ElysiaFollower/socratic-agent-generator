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
from schemas.profile import Profile
import config

class SessionState(BaseModel):
    stepIndex: int = Field(
        description="The index of the current step.",
        default=1
    )

class Session(BaseModel):
    session_id: str = Field(
        description="The unique identifier for the session.",
        default_factory=lambda: str(uuid.uuid4()), # auto generate a uuid
        frozen=True # immutable
    )
    session_name: str = Field(
        description="The name of the session.",
        default=config.DEFAULT_SESSION_NAME
    )
    
    profile: Profile = Field(
        description="The profile of the session."
    )
    state: SessionState = Field(
        description="The state of the session. eg: the current step of curriculum; start from 1",
        default=SessionState()
    )
    
    create_at: str = Field(
        description="The time when the session was created.",
        default_factory=lambda: datetime.now(pytz.utc).isoformat()
    )
    update_at: str = Field(
        description="The time when the session was updated.",
        default_factory=lambda: datetime.now(pytz.utc).isoformat()
    )
    
    output_language: str = Field(
        description="The language of the output.",
        default=config.DEFAULT_OUTPUT_LANGUAGE
    )
    
    history: List[Dict[str, Any]] = Field(
        description="The history of the session.",
        default=[]
    )
    
    def get_curriculum(self) -> SocraticCurriculum:
        return self.profile.curriculum
    
class SessionSummary(BaseModel):
    """Provides a brief summary of a session, used for listings."""
    session_id: str
    session_name: str
    profile_id: str
    profile_name: str
    topic_name: str
    create_at: str
    update_at: str
    @model_validator(mode='before')
    @classmethod
    def flatten_profile_data(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        before model_validate(), some data inside Profile need to be flattened
        """
        profile_data = data.get('profile', {})
        if profile_data:
            data['profile_id'] = profile_data.get('profile_id')
            data['profile_name'] = profile_data.get('profile_name')
            data['topic_name'] = profile_data.get('topic_name')
        return data