from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from .config import CORS_ALLOWED_ORIGINS, API_HOST, API_PORT
from .routers import generation, profiles, sessions, users, auth
import base64
import json
import uuid
import time
from .utils.TutorManager import TutorManager
from .schemas.message import ResponseMessage, OpenAIRequest, MessageRequest

app = FastAPI(
    title="Socratic Agent API",
    description="API service for the Socratic AI Tutor.",
    version="2.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

tutor_manager = TutorManager()

@app.get("/api/health", summary="Health check endpoint.")
def health():
    return {"status": "ok"}

app.include_router(generation.router, prefix="/api", tags=["Generation"])
app.include_router(profiles.router, prefix="/api", tags=["Profiles"])
app.include_router(sessions.router, prefix="/api", tags=["Sessions"])
app.include_router(users.router, prefix="/api", tags=["Users"])
app.include_router(auth.router, prefix="/api", tags=["Authentication"])

async def stream_generator(session_id: str, user_input: str):
    """
    Stream generator for handling asynchronous streaming responses from the Tutor.
    """
    try:
        tutor = tutor_manager.get_tutor(session_id)
        async for chunk in tutor.stream_message(user_input):
            if isinstance(chunk, str):
                event_data = {"type": "token", "data": chunk}
            elif isinstance(chunk, ResponseMessage):
                event_data = {"type": "END", "data": chunk.model_dump()}
            else:
                continue
            yield f"data: {json.dumps(event_data, ensure_ascii=False)}\n\n"
    except Exception as e:
        print(f"Error during stream for session {session_id}: {e}")
        error_data = {"type": "error", "data": str(e)}
        yield f"data: {json.dumps(error_data, ensure_ascii=False)}\n\n"

@app.post("/api/sessions/{session_id}/messages/stream", summary="Send a message and get a streaming response.")
async def stream_message(session_id: str, req: MessageRequest):
    """
    Send a message to the tutor and get a streaming response (SSE).
    """
    try:
        decoded_message = base64.b64decode(req.message).decode('utf-8')
    except Exception as e:
        print(f"Base64 decode failed: {e}, using original message.")
        decoded_message = req.message
        
    return StreamingResponse(
        stream_generator(session_id, decoded_message),
        media_type="text/event-stream"
    )

async def openai_stream_adapter(session_id: str, user_input: str):
    """
    Adapter to convert the internal Tutor stream to the OpenAI SSE format.
    """
    response_id = f"chatcmpl-{uuid.uuid4()}"
    response_created_time = int(time.time())

    try:
        tutor = tutor_manager.get_tutor(session_id)
        
        async for chunk in tutor.stream_message(user_input):
            if isinstance(chunk, str):
                openai_chunk = {
                    "id": response_id,
                    "object": "chat.completion.chunk",
                    "created": response_created_time,
                    "model": tutor.session.profile.profile_id,
                    "choices": [{"index": 0, "delta": {"content": chunk}, "finish_reason": None}]
                }
                yield f"data: {json.dumps(openai_chunk, ensure_ascii=False)}\n\n"
            
            elif isinstance(chunk, ResponseMessage):
                final_chunk = {
                    "id": response_id,
                    "object": "chat.completion.chunk",
                    "created": response_created_time,
                    "model": tutor.session.profile.profile_id,
                    "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}]
                }
                yield f"data: {json.dumps(final_chunk, ensure_ascii=False)}\n\n"
        
        yield "data: [DONE]\n\n"

    except FileNotFoundError:
        error_chunk = {
            "error": {"message": f"Session not found. Invalid 'API Key' (session_id): {session_id}", "type": "invalid_request_error", "code": "session_not_found"}
        }
        yield f"data: {json.dumps(error_chunk, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"
    except Exception as e:
        print(f"Error during stream adapter: {e}")
        error_chunk = {
            "error": {"message": f"An internal error occurred: {str(e)}", "type": "internal_error", "code": "tutor_error"}
        }
        yield f"data: {json.dumps(error_chunk, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

@app.post("/v1/chat/completions", summary="[Adapter] OpenAI-compatible streaming chat endpoint.")
async def adapter_chat_completions(request: OpenAIRequest, authorization: str = Header(..., description="Bearer <session_id>")):
    """
    Adapter that mimics the OpenAI chat completions endpoint.
    Extracts the session_id from the Authorization header.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid Authorization header. Expected 'Bearer <session_id>'")
    
    session_id = authorization.split(" ")[1]
    
    user_input = ""
    for msg in reversed(request.messages):
        if msg.role == "user":
            user_input = msg.content
            break
            
    if not user_input:
        raise HTTPException(status_code=400, detail="No user message found")
    
    return StreamingResponse(
        openai_stream_adapter(session_id, user_input),
        media_type="text/event-stream"
    )

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Socratic Agent API server...")
    server_url = f"http://{API_HOST}:{API_PORT}"
    print(f"🌐 Server URL: {server_url}")
    print(f"📚 API Docs: {server_url}/docs")
    
    uvicorn.run("app:app", host=API_HOST, port=API_PORT, reload=True)
