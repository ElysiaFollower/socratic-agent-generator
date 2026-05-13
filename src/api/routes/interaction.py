"""Tutor interaction routes.

This module handles HTTP endpoints for interacting with tutors.
"""

import base64
import json
import logging
from typing import Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from api.routes.auth import get_current_user
from core.dependencies import TutorManagerDep
from schemas.message import MessageRequest, ResponseMessage
from schemas.user import User
from utils import tutor_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Interaction"])


@router.get("/api/tutor/{session_id}/welcome", summary="获取会话的欢迎语")
def get_welcome_message(
    session_id: str,
    tutor_manager: TutorManagerDep,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Get the welcome message for a session.

    Args:
        session_id: The ID of the session.
        tutor_manager: Injected TutorManager instance.

    Returns:
        Dictionary containing the welcome message.

    Raises:
        HTTPException: 404 if session not found, 500 if internal error.
    """
    # tutor_manager.get_tutor() already raises HTTPException on error
    tutor = tutor_manager.get_tutor(
        session_id, owner_id=current_user.user_id
    )
    return {"welcome": tutor.get_welcome_message()}


@router.get("/api/tutor/{session_id}/state", summary="获取会话的当前状态")
def get_state(
    session_id: str,
    tutor_manager: TutorManagerDep,
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get the current progress state of a session.

    Args:
        session_id: The ID of the session.
        tutor_manager: Injected TutorManager instance.

    Returns:
        Dictionary containing stepIndex, totalSteps, and isFinished.

    Raises:
        HTTPException: 404 if session not found, 500 if internal error.
    """
    # tutor_manager.get_tutor() already raises HTTPException on error
    tutor = tutor_manager.get_tutor(
        session_id, owner_id=current_user.user_id
    )
    total_steps = tutor.session.get_curriculum().get_len()
    current_step = tutor.session.state.stepIndex

    return {
        "stepIndex": current_step,
        "totalSteps": total_steps,
        "isFinished": tutor.session.is_finished(),
    }


async def _stream_generator(
    session_id: str,
    user_input: str,
    owner_id: str,
    tutor_manager: tutor_manager.TutorManager,
    provider: Optional[str] = None,
    model: Optional[str] = None,
):
    """Stream generator for processing Tutor's async streaming responses.

    Args:
        session_id: The ID of the session.
        user_input: The user's input message.
        tutor_manager: TutorManager instance (passed from route function).

    Yields:
        Server-Sent Events formatted strings.
    """
    try:
        # tutor_manager.get_tutor() raises HTTPException, but we're in a generator
        # so we need to catch it and convert to error message
        try:
            tutor = tutor_manager.get_tutor(
                session_id, owner_id=owner_id
            )
        except HTTPException as e:
            # HTTPException from get_tutor, convert to error message
            error_msg = e.detail
            logger.error("Failed to get tutor for session %s: %s", session_id, error_msg)
            error_data = {"type": "error", "data": error_msg}
            yield f"data: {json.dumps(error_data, ensure_ascii=False)}\n\n"
            return
        except Exception as e:
            # Handle unexpected errors
            error_msg = str(e)
            logger.error("Unexpected error getting tutor for session %s: %s", session_id, e)
            error_data = {"type": "error", "data": error_msg}
            yield f"data: {json.dumps(error_data, ensure_ascii=False)}\n\n"
            return

        async for chunk in tutor.stream_message(user_input, provider=provider, model=model):
            if isinstance(chunk, str):
                # Token chunk
                event_data = {"type": "token", "data": chunk}
            elif isinstance(chunk, ResponseMessage):
                # End of stream with final reply and state
                event_data = {"type": "END", "data": chunk.model_dump()}
            else:
                continue

            # Follow Server-Sent Events (SSE) format
            yield f"data: {json.dumps(event_data, ensure_ascii=False)}\n\n"

    except Exception as e:
        logger.error("Error during stream for session %s: %s", session_id, e)
        error_data = {"type": "error", "data": str(e)}
        yield f"data: {json.dumps(error_data, ensure_ascii=False)}\n\n"


@router.post("/api/sessions/{session_id}/messages/stream", summary="发送消息并异步获取流式回复")
async def stream_message(
    session_id: str,
    req: MessageRequest,
    tutor_manager: TutorManagerDep,
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """Send a message and get streaming response (SSE).

    Args:
        session_id: The ID of the session.
        req: MessageRequest containing the base64-encoded message.
        tutor_manager: Injected TutorManager instance.

    Returns:
        StreamingResponse with Server-Sent Events format.

    Note:
        The message is base64-encoded to prevent potential security issues
        with user input being misinterpreted as server commands.
    """
    try:
        # Decode Base64 message
        decoded_message = base64.b64decode(req.message).decode("utf-8")
    except Exception as e:
        # If decoding fails, use original message as fallback
        logger.warning("Base64 decode failed: %s, using original message", e)
        decoded_message = req.message

    return StreamingResponse(
        _stream_generator(
            session_id,
            decoded_message,
            current_user.user_id,
            tutor_manager,
            provider=req.provider,
            model=req.model,
        ),
        media_type="text/event-stream",
    )
