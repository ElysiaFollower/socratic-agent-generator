from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

import sys
from pathlib import Path
# Add the src directory to sys.path
sys.path.append(str(Path(__file__).resolve().parents[1]))
from schemas.session import SessionState
import config

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
    
    
class CreateSessionRequest(BaseModel):
    """POST /sessions"""
    profile_id: str = Field(description="the id of profile to load")
    session_name: str = Field(
        description="name of new session",
        default=config.DEFAULT_SESSION_NAME
    )
    output_language: str = Field(
        description="output language",
        default=config.DEFAULT_OUTPUT_LANGUAGE
    )

class MessageRequest(BaseModel):
    message: str = Field(description="用户发送的文本消息")

class RenameSessionRequest(BaseModel):
    "PUT /sessions/{id}/rename"
    session_name: str = Field(description="会话的新名称")
    
