from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

import sys
from pathlib import Path
# Add the src directory to sys.path
sys.path.append(str(Path(__file__).resolve().parents[1]))
from schemas.session import SessionState

class ResponseMessage(BaseModel):
    """
    Encapsulates the data returned after processing a user message.
    """
    reply: str = Field(
        description="The tutor's response message to the user."
    )
    state: SessionState = Field(
        description="The state of the session after this interaction."
    )
    is_finished: bool = Field(
        description="Whether the entire curriculum is completed.",
        default=False
    )