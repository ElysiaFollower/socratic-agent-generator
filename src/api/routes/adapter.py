"""OpenAI API adapter routes.

This module provides OpenAI-compatible API endpoints for compatibility
with existing OpenAI clients.
"""

import json
import logging
import time
import uuid
from typing import AsyncGenerator

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse

from core.dependencies import TutorManagerDep
from schemas.message import OpenAIRequest, ResponseMessage
from utils import tutor_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Adapter"])


async def _openai_stream_adapter(
    session_id: str,
    user_input: str,
    tutor_manager_instance: tutor_manager.TutorManager,
) -> AsyncGenerator[str, None]:
    """Async generator that converts internal Tutor stream to OpenAI SSE format.

    Args:
        session_id: The ID of the session.
        user_input: The user's input message.
        tutor_manager_instance: TutorManager instance (passed from route function).

    Yields:
        OpenAI SSE formatted strings.
    """
    # Create a mock OpenAI response ID
    response_id = f"chatcmpl-{uuid.uuid4()}"
    response_created_time = int(time.time())

    try:
        # tutor_manager.get_tutor() raises HTTPException, but we're in a generator
        # so we need to catch it and convert to error message
        try:
            tutor = tutor_manager_instance.get_tutor(session_id)
        except HTTPException as e:
            # HTTPException from get_tutor, convert to OpenAI error format
            error_msg = e.detail
            logger.error("Failed to get tutor for session %s: %s", session_id, error_msg)
            error_chunk = {
                "error": {
                    "message": (
                        f"Session not found. Invalid 'API Key' (session_id): "
                        f"{session_id}"
                    ),
                    "type": "invalid_request_error",
                    "code": "session_not_found",
                }
            }
            yield f"data: {json.dumps(error_chunk, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
            return
        except Exception as e:
            # Handle unexpected errors
            error_msg = str(e)
            logger.error("Unexpected error getting tutor for session %s: %s", session_id, e)
            error_chunk = {
                "error": {
                    "message": f"An internal error occurred: {error_msg}",
                    "type": "internal_error",
                    "code": "tutor_load_error",
                }
            }
            yield f"data: {json.dumps(error_chunk, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
            return

        async for chunk in tutor.stream_message(user_input):
            if isinstance(chunk, str):
                # Token chunk - convert to OpenAI format
                openai_chunk = {
                    "id": response_id,
                    "object": "chat.completion.chunk",
                    "created": response_created_time,
                    "model": tutor.session.profile.profile_id,
                    "choices": [
                        {
                            "index": 0,
                            "delta": {"content": chunk},
                            "finish_reason": None,
                        }
                    ],
                }
                yield f"data: {json.dumps(openai_chunk, ensure_ascii=False)}\n\n"

            elif isinstance(chunk, ResponseMessage):
                # End of stream - send final chunk
                final_chunk = {
                    "id": response_id,
                    "object": "chat.completion.chunk",
                    "created": response_created_time,
                    "model": tutor.session.profile.profile_id,
                    "choices": [
                        {
                            "index": 0,
                            "delta": {},
                            "finish_reason": "stop",
                        }
                    ],
                }
                yield f"data: {json.dumps(final_chunk, ensure_ascii=False)}\n\n"

        # Send OpenAI stream end marker
        yield "data: [DONE]\n\n"

    except Exception as e:
        # Handle other Tutor exceptions
        logger.error("Error during stream adapter: %s", e)
        error_chunk = {
            "error": {
                "message": f"An internal error occurred: {str(e)}",
                "type": "internal_error",
                "code": "tutor_error",
            }
        }
        yield f"data: {json.dumps(error_chunk, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"


@router.post("/v1/chat/completions", summary="[Adapter] 模拟OpenAI的流式聊天接口")
async def adapter_chat_completions(
    request: OpenAIRequest,
    tutor_manager: TutorManagerDep,
    authorization: str = Header(..., description="Bearer <session_id>"),
) -> StreamingResponse:
    """OpenAI-compatible streaming chat completions endpoint.

    This adapter endpoint mimics OpenAI's chat completions API. It extracts
    the session_id from the Authorization header (Bearer token format) and
    streams responses in OpenAI SSE format.

    Args:
        request: OpenAIRequest containing messages and model information.
        authorization: Authorization header in format "Bearer <session_id>".
        tutor_manager: Injected TutorManager instance.

    Returns:
        StreamingResponse with OpenAI SSE format.

    Raises:
        HTTPException: 401 if Authorization header is invalid.
        HTTPException: 400 if no user message is found.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Invalid Authorization header. Expected 'Bearer <session_id>'",
        )

    session_id = authorization.split(" ")[1]

    # Extract user message from request (get the last user message)
    user_input = ""
    for msg in reversed(request.messages):
        if msg.role == "user":
            user_input = msg.content
            break

    if not user_input:
        raise HTTPException(status_code=400, detail="No user message found")

    return StreamingResponse(
        _openai_stream_adapter(session_id, user_input, tutor_manager_instance=tutor_manager),
        media_type="text/event-stream",
    )

