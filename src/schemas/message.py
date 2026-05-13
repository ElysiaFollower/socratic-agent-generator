"""Message schema definitions.

This module defines Pydantic models for API request and response messages.
"""

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from config import DEFAULT_OUTPUT_LANGUAGE, DEFAULT_SESSION_NAME
from schemas.session import SessionState
from schemas.step_completion import StepCompletion

class ResponseMessage(BaseModel):
    """Response message from tutor after processing user input.

    Attributes:
        reply: The tutor's response message to the user.
        state: The state of the session after this interaction.
        is_finished: Whether the entire curriculum is completed.
    """

    reply: str = Field(description="The tutor's response message to the user.")
    state: SessionState = Field(
        description="The state of the session after this interaction."
    )
    is_finished: bool = Field(
        description="Whether the entire curriculum is completed.",
        default=False,
    )
    message_id: Optional[int] = Field(
        default=None,
        description="Message id of the assistant reply for this turn.",
    )
    step_completion: Optional[StepCompletion] = Field(
        default=None,
        description="Step completion record when evaluation passes.",
    )


class CreateSessionRequest(BaseModel):
    """Request model for creating a new session.

    Used by POST /api/sessions/create endpoint.
    """

    profile_id: str = Field(description="The ID of the profile to load.")
    session_name: str = Field(
        description="Name of the new session.",
        default=DEFAULT_SESSION_NAME,
    )
    output_language: str = Field(
        description="Output language for the session.",
        default=DEFAULT_OUTPUT_LANGUAGE,
    )
    remote_machine_id: Optional[str] = Field(
        default=None,
        description="Optional user remote machine id to bind to this session.",
    )


class MessageRequest(BaseModel):
    """Request model for sending a message to the tutor.

    The message is base64-encoded to prevent potential security issues.
    """

    message: str = Field(description="User's text message (base64-encoded).")
    provider: Optional[str] = Field(
        default=None, description="Optional LLM provider override"
    )
    model: Optional[str] = Field(
        default=None, description="Optional model override"
    )


class RenameSessionRequest(BaseModel):
    """Request model for renaming a session.

    Used by PUT /api/sessions/{id}/rename endpoint.
    """

    session_name: str = Field(description="New name for the session.")


class UpdateSessionLanguageRequest(BaseModel):
    """Request model for updating session output language.

    Used by PUT /api/sessions/{id}/output-language endpoint.
    """

    output_language: str = Field(
        description="New output language for the session.",
        default=DEFAULT_OUTPUT_LANGUAGE,
    )


# --- OpenAI Adapter Schemas ---


class OpenAIChatMessage(BaseModel):
    """OpenAI-compatible chat message format."""

    role: Literal["user", "system", "assistant"]
    content: str


class OpenAIRequest(BaseModel):
    """OpenAI-compatible chat completion request format.

    Used by the /v1/chat/completions adapter endpoint.
    """

    messages: List[OpenAIChatMessage]
    model: str = Field(
        description="Model identifier (e.g., 'gpt-4'). "
        "In this adapter, this is ignored."
    )
    stream: bool = Field(default=True, description="Whether to stream responses.")
    
