# app.py, 用于启动后端服务
# 接口请直接见 'API Endpoints' 部分

import json
import uuid
from pathlib import Path
from typing import Dict, Any, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# --- 导入核心模块和配置 ---
from config import PROFILES_DIR, SESSION_DATA_DIR, CORS_ALLOWED_ORIGINS, API_HOST, API_PORT
from tutor_core import Tutor

# --- FastAPI 应用实例 ---
app = FastAPI(
    title="Socratic Agent API",
    description="后端API服务，用于驱动苏格拉底式AI导师前端。",
    version="1.0.0"
)

# --- CORS 中间件 ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,  #允许访问后端API的前端地址
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 应用启动时，确保目录存在 ---
PROFILES_DIR.mkdir(parents=True, exist_ok=True)
SESSION_DATA_DIR.mkdir(parents=True, exist_ok=True)


# --- Pydantic 数据模型 ---
class CreateSessionRequest(BaseModel):
    profile: str

class MessageRequest(BaseModel):
    message: str

class RenameSessionRequest(BaseModel):
    name: str

class SessionManager:
    def __init__(self):
        # --- 内存缓存：只缓存活跃的Tutor实例，避免重复从磁盘加载和初始化 ---
        self.active_tutors: Dict[str, Tutor] = {}
    
    def get_tutor(self, session_id: str) -> Tutor:
        """
        智能获取Tutor实例的核心函数。
        充当磁盘和内存之间的调度层。
        """
        # 1. 优先从内存缓存中获取
        if session_id in self.active_tutors:
            return self.active_tutors[session_id]

        # 2. 如果缓存中没有，则从磁盘加载会话文件
        session_filepath = SESSION_DATA_DIR / f"{session_id}.json"
        if not session_filepath.exists():
            raise HTTPException(status_code=404, detail="会话不存在或已过期")
            
        with open(session_filepath, 'r', encoding='utf-8') as f:
            session_data = json.load(f)
        
        profile_name = session_data.get("profile_name")
        if not profile_name:
            raise HTTPException(status_code=500, detail="会话数据损坏：缺少profile_name")

        profile_path = PROFILES_DIR / profile_name
        if not profile_path.exists():
            raise HTTPException(status_code=404, detail=f"该会话所需的导师配置 '{profile_name}' 文件不存在")

        # 3. 创建Tutor实例 (其__init__方法会自动恢复所有状态)
        print(f"从磁盘恢复会话 {session_id} 到内存...")
        tutor = Tutor(session_id, profile_path, session_name=session_data.get('session_name', None))
        
        # 4. 将新创建的实例存入缓存，以便下次快速访问
        self.active_tutors[session_id] = tutor
        return tutor
    
    def create_session(self, profile_path: Path) -> Tutor:
        """创建一个新的Tutor实例, 持久化并缓存它。"""
        if not profile_path.exists():
            raise HTTPException(status_code=404, detail="导师配置文件未找到")

        session_id = str(uuid.uuid4())
        # 创建Tutor实例
        tutor = Tutor(session_id, profile_path)
        # 立即保存一次，以在磁盘上创建会话文件
        tutor.save()
        # 将新实例放入缓存
        self.active_tutors[session_id] = tutor
        return tutor

    def delete_session(self, session_id: str):
        """从缓存和磁盘中删除一个会话。文件不存在抛出异常"""
        # 1. 从内存缓存中移除 (如果存在)
        self.active_tutors.pop(session_id, None)
        
        # 2. 从磁盘删除文件
        filepath = SESSION_DATA_DIR / f"{session_id}.json"
        if filepath.exists():
            filepath.unlink()
            return # 成功
        
        # 如果文件就不存在，也算作一种“删除”，但为了严谨可以抛出异常
        raise HTTPException(status_code=404, detail="会话文件未找到，无法删除")


# 创建全局实例
session_manager = SessionManager()

# --- API Endpoints ---

@app.get("/api/health", summary="健康检查")
def health():
    return {"status": "ok"}

@app.get("/api/profiles", response_model=List[str], summary="获取所有可用的导师配置列表")
def list_profiles():
    return [p.name for p in PROFILES_DIR.glob("*.json")]

@app.get("/api/sessions", summary="获取所有历史会话列表")
def list_sessions():
    """通过扫描数据目录来高效地列出所有会话的元数据。"""
    session_list = []
    for f in SESSION_DATA_DIR.glob("*.json"):
        with open(f, 'r', encoding='utf-8') as session_file:
            data = json.load(session_file)
            # 为前端构造所需的数据结构
            session_list.append({
                "session_id": data.get("session_id"),
                "session_name": data.get("session_name"),
                "profile": data.get("profile_name"),
                "topic_name": data.get("topic_name", ""),
                "created_at": data.get("created_at"),
            })
    session_list.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return session_list

@app.post("/api/tutor/session", summary="创建一个新的会话")
def create_session(req: CreateSessionRequest):
    profile_path = PROFILES_DIR / req.profile
    tutor = session_manager.create_session(profile_path)
    return {"session_id": tutor.session_id}
    

@app.get("/api/tutor/{session_id}/welcome", summary="获取会话的欢迎语")
def get_welcome_message(session_id: str):
    tutor = session_manager.get_tutor(session_id)
    # 仅当会话历史为空时，才提供欢迎语
    if not tutor.history.messages:
        return {"welcome": tutor.get_welcome_message()}
    return {"welcome": ""}

@app.post("/api/tutor/{session_id}/message", summary="发送消息并获取回复")
def send_message(session_id: str, req: MessageRequest):
    tutor = session_manager.get_tutor(session_id)
    result = tutor.process_message(req.message) # process_message内部会自动保存
    return result

@app.get("/api/tutor/{session_id}/history", summary="获取会话的完整聊天记录")
def get_chat_history(session_id: str):
    tutor = session_manager.get_tutor(session_id)
    history = [
        {"role": "user" if msg.type == "human" else "assistant", "content": msg.content}
        for msg in tutor.history.messages
    ]
    return {"messages": history}

@app.get("/api/tutor/{session_id}/state", summary="获取会话的当前状态")
def get_state(session_id: str):
    tutor = session_manager.get_tutor(session_id)
    return {
        "step": tutor.step,
        "curriculum": tutor.curriculum
    }

@app.put("/api/sessions/{session_id}/rename", summary="重命名会话")
def rename_session(session_id: str, req: RenameSessionRequest):
    tutor = session_manager.get_tutor(session_id)
    tutor.rename(req.name) # rename内部会自动保存
    return {"success": True, "message": "会话重命名成功"}

@app.delete("/api/sessions/{session_id}", summary="删除会话")
def delete_session(session_id: str):
    session_manager.delete_session(session_id)
    return {"success": True, "message": "会话删除成功"} 



# --- 用于直接运行的启动代码 ---
if __name__ == "__main__":
    import uvicorn
    print("🚀 启动 Socratic Agent API 服务器...")
    server_url = f"http://{API_HOST}:{API_PORT}"
    print(f"🌐 服务地址: {server_url}")
    print(f"📚 API 文档: {server_url}/docs")
    
    # reload=True 可以在代码变更后自动重启服务，非常适合开发
    uvicorn.run("app:app", host=API_HOST, port=API_PORT, reload=True) 