from typing import List, Dict, Any, Optional, Literal
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
    
    
# --------- temp --------

class OpenAIChatMessage(BaseModel):
    """OpenAI 格式的消息体"""
    role: Literal["user", "system", "assistant"]
    content: str

class OpenAIRequest(BaseModel):
    """OpenAI 格式的聊天请求体"""
    messages: List[OpenAIChatMessage]
    model: str  # 前端会传来它当前选择的模型, e.g., "gpt-4"
    stream: bool = True
    # 我们暂时忽略其他字段
    
