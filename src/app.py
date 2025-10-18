# app.py, 用于启动后端服务, 定义API接口
# 接口请直接见 'API Endpoints' 部分

import json
import uuid
import time
from pathlib import Path
from typing import Dict, Any, List
import asyncio

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import sys
from pathlib import Path
# Add the src directory to sys.path
sys.path.append(str(Path(__file__).resolve().parents[0]))
from config import PROFILES_DIR, SESSION_DATA_DIR, CORS_ALLOWED_ORIGINS, API_HOST, API_PORT
from utils.tutor_core import Tutor
from utils.ProfileManager import ProfileManager
from utils.SessionManager import SessionManager
from utils.TutorManager import TutorManager
from schemas.profile import Profile
from schemas.session import Session, SessionSummary
from schemas.message import CreateSessionRequest, MessageRequest, RenameSessionRequest, ResponseMessage

# --- FastAPI application instance ---
app = FastAPI(
    title="Socratic Agent API",
    description="后端API服务，用于驱动苏格拉底式AI导师前端。",
    version="2.0.0"
)

# --- CORS middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,  #允许访问后端API的前端地址
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PROFILES_DIR.mkdir(parents=True, exist_ok=True)
SESSION_DATA_DIR.mkdir(parents=True, exist_ok=True)

# --- manager instance ---
profile_manager = ProfileManager()
session_manager = SessionManager()
tutor_manager = TutorManager()
# --- API Endpoints ---
@app.get("/api/health", summary="健康检查")
def health():
    return {"status": "ok"}

@app.get("/api/profiles", response_model=List[Profile], summary="获取所有可用的导师配置列表", tags=['Profile'])
def list_profiles():
    return profile_manager.list_profiles()

@app.get("/api/sessions", response_model=List[SessionSummary], summary="获取所有会话元信息列表", tags=['Session'])
def list_sessions():
    return session_manager.list_sessions()

@app.post("/api/sessions/create", summary="创建一个新的会话(实际是在用户层面的一个会话就是一个tutor)", tags=['Session'])
def create_session(req: CreateSessionRequest):
    try:
        profile = profile_manager.read_profile(req.profile_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Profile '{req.profile_id}' not found")
    tutor = tutor_manager.create_tutor(
        profile=profile,
        session_name=req.session_name,
        output_language=req.output_language
    )
    return {"session_id": tutor.session.session_id}

@app.get("/api/sessions/{session_id}", response_model=Session, summary="获取一个会话的详细信息", tags=['Session'])
def get_session(session_id: str):
    try:
        return session_manager.read_session(session_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Session not found")

@app.put("/api/sessions/{session_id}/rename", summary="重命名会话", tags=['Session'])
def rename_session(session_id: str, req: RenameSessionRequest):
    """
    重命名一个会话。
    """
    try:
        session_manager.rename_session(session_id, req.session_name)
        tutor_manager.remove_from_cache(session_id)
        return {"success": True, "message": "会话重命名成功"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Session not found")

@app.delete("/api/sessions/{session_id}", summary="删除会话", tags=['Session'])
def delete_session(session_id: str):
    tutor_manager.remove_from_cache(session_id)
    session_manager.delete_session(session_id)
    return {"success": True, "message": "会话删除成功"} 
    
    
@app.get("/api/tutor/{session_id}/welcome", summary="获取会话的欢迎语", tags=['Interaction'])
def get_welcome_message(session_id: str):
    tutor = tutor_manager.get_tutor(session_id)
    return {"welcome": tutor.get_welcome_message()}


# @app.post("/api/tutor/{session_id}/message", summary="发送消息并获取回复; 同步; 非流式", tags=['Interaction'])
# def send_message(session_id: str, req: MessageRequest):
#     tutor = session_manager.get_tutor(session_id)
#     result = tutor.process_message(req.message)
#     return result
        
async def stream_generator(session_id: str, user_input: str):
    """
    流式生成器，用于处理Tutor的异步流式响应。
    """
    try:
        tutor = tutor_manager.get_tutor(session_id)
        # 使用 tutor.stream_message 异步生成器
        async for chunk in tutor.stream_message(user_input):
            if isinstance(chunk, str):
                # 这是一个Token块
                event_data = {"type": "token", "data": chunk}
            elif isinstance(chunk, ResponseMessage):
                # 这是流的末尾，包含最终回复和状态
                event_data = {"type": "END", "data": chunk.model_dump()}
            else:
                continue
                
            # 必须遵循 Server-Sent Events (SSE) 格式
            yield f"data: {json.dumps(event_data, ensure_ascii=False)}\n\n"
            
    except Exception as e:
        # 处理流过程中的异常
        print(f"Error during stream for session {session_id}: {e}")
        error_data = {"type": "error", "data": str(e)}
        yield f"data: {json.dumps(error_data, ensure_ascii=False)}\n\n"
        

@app.post("/api/sessions/{session_id}/messages/stream", summary="发送消息并异步获取流式回复", tags=["Interaction"])
async def stream_message(session_id: str, req: MessageRequest):
    """
    向导师发送消息并获取流式响应 (SSE)。
    """
    return StreamingResponse(
        stream_generator(session_id, req.message),
        media_type="text/event-stream"
    )

@app.get("/api/tutor/{session_id}/state", response_model=Dict[str, Any], summary="获取会话的当前状态", tags=['Interaction'])
def get_state(session_id: str):
    """
    获取会话的当前进度状态。
    """
    tutor = tutor_manager.get_tutor(session_id)
    total_steps = tutor.session.get_curriculum().get_len()
    current_step = tutor.session.state.stepIndex
    
    return {
        "stepIndex": current_step,
        "totalSteps": total_steps,
        "isFinished": current_step > total_steps
    }



# ---------- temp ----------

from schemas.message import (
    OpenAIRequest, OpenAIChatMessage 
)
async def openai_stream_adapter(session_id: str, user_input: str):
    """
    一个异步生成器，它调用我们内部的Tutor流，
    并将输出格式实时转换为 OpenAI SSE 格式。
    """
    # 创建一个模拟的 OpenAI 响应 ID
    response_id = f"chatcmpl-{uuid.uuid4()}"
    response_created_time = int(time.time())

    try:
        tutor = tutor_manager.get_tutor(session_id)
        
        async for chunk in tutor.stream_message(user_input):
            
            if isinstance(chunk, str):
                # 这是一个Token块
                # 转换: {"type": "token", "data": "Hello"} -> data: {"choices": [{"delta": {"content": "Hello"}}]}
                
                # 构建 OpenAI SSE 块
                openai_chunk = {
                    "id": response_id,
                    "object": "chat.completion.chunk",
                    "created": response_created_time,
                    "model": tutor.session.profile.profile_id, # 告诉前端这是哪个"模型"
                    "choices": [{
                        "index": 0,
                        "delta": {"content": chunk},
                        "finish_reason": None
                    }]
                }
                # yield SSE 格式的字符串
                yield f"data: {json.dumps(openai_chunk, ensure_ascii=False)}\n\n"
            
            elif isinstance(chunk, ResponseMessage):
                # 这是流的末尾，ResponseMessage 对象
                # 我们需要发送最后一个 "finish_reason": "stop" 的块
                
                final_chunk = {
                    "id": response_id,
                    "object": "chat.completion.chunk",
                    "created": response_created_time,
                    "model": tutor.session.profile.profile_id,
                    "choices": [{
                        "index": 0,
                        "delta": {}, # 最后一个块没有内容
                        "finish_reason": "stop" # 告诉前端流已结束
                    }]
                }
                yield f"data: {json.dumps(final_chunk, ensure_ascii=False)}\n\n"
        
        # 发送 OpenAI 流的最终结束标志
        yield "data: [DONE]\n\n"

    except FileNotFoundError:
        # 捕获 session_id 无效的情况
        error_chunk = {
            "error": {
                "message": f"Session not found. Invalid 'API Key' (session_id): {session_id}",
                "type": "invalid_request_error",
                "code": "session_not_found"
            }
        }
        yield f"data: {json.dumps(error_chunk, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"
    except Exception as e:
        # 捕获其他Tutor异常
        print(f"Error during stream adapter: {e}")
        error_chunk = {
            "error": {
                "message": f"An internal error occurred: {str(e)}",
                "type": "internal_error",
                "code": "tutor_error"
            }
        }
        yield f"data: {json.dumps(error_chunk, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"


@app.post("/v1/chat/completions", summary="[Adapter] 模拟OpenAI的流式聊天接口", tags=['Adapter'])
async def adapter_chat_completions(
    request: OpenAIRequest,
    # 从 Header 中提取 "Authorization"
    authorization: str = Header(..., description="Bearer <session_id>") 
):
    """
    这是伪装成 OpenAI 的适配器。
    它会从 Authorization 头中提取 session_id。
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





# --- 用于直接运行的启动代码 ---
if __name__ == "__main__":
    import uvicorn
    print("🚀 启动 Socratic Agent API 服务器...")
    server_url = f"http://{API_HOST}:{API_PORT}"
    print(f"🌐 服务地址(后端服务): {server_url}")
    print(f"📚 API 文档: {server_url}/docs")
    
    # reload=True 可以在代码变更后自动重启服务
    uvicorn.run("app:app", host=API_HOST, port=API_PORT, reload=True) 