from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, List
from pathlib import Path
import json
import uuid
import os

# 导入用于运行实际推理链的组件
from dotenv import load_dotenv
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.output_parsers import StrOutputParser

# 尝试导入 DeepSeek，如果失败则使用占位符
try:
    from langchain_deepseek import ChatDeepSeek
    DEEPSEEK_AVAILABLE = True
    print("✅ langchain_deepseek 导入成功")
except ImportError as e:
    print(f"⚠️  langchain_deepseek 不可用: {e}")
    print("请安装: pip install langchain-deepseek")
    ChatDeepSeek = None
    DEEPSEEK_AVAILABLE = False

app = FastAPI(title="Socratic Agent API")

# Allow local frontend dev server (Vite) and same-origin
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ROOT = Path(__file__).resolve().parent.parent
GENERATED = ROOT / "generated_tutors"
CONFIGS = ROOT / "configs"
SESSIONS_DIR = ROOT / "sessions"

if not GENERATED.exists():
    GENERATED.mkdir(parents=True, exist_ok=True)

if not SESSIONS_DIR.exists():
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

# 会话元数据文件路径
SESSIONS_METADATA_FILE = SESSIONS_DIR / "sessions_metadata.json"

# 在内存中保存会话实例，但元数据持久化到文件
# sessions: session_id -> { meta: {...}, tutor: TutorSession }
sessions: Dict[str, Dict[str, Any]] = {}

# 为会话添加默认名称和创建时间
import datetime

def load_sessions_metadata():
    """从文件加载会话元数据"""
    global sessions
    print(f"尝试从 {SESSIONS_METADATA_FILE} 加载会话元数据...")
    if SESSIONS_METADATA_FILE.exists():
        try:
            with open(SESSIONS_METADATA_FILE, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
                print(f"成功加载 {len(metadata)} 个会话的元数据")
                # 只加载元数据，tutor实例需要重新创建
                for session_id, meta in metadata.items():
                    sessions[session_id] = {
                        "meta": meta,
                        "tutor": None  # tutor实例将在需要时重新创建
                    }
        except Exception as e:
            print(f"加载会话元数据失败: {e}")
    else:
        print(f"元数据文件不存在，将创建新文件: {SESSIONS_METADATA_FILE}")

def save_sessions_metadata():
    """保存会话元数据到文件"""
    try:
        # 确保目录存在
        print(f"[DEBUG] 确保目录存在: {SESSIONS_METADATA_FILE.parent}")
        SESSIONS_METADATA_FILE.parent.mkdir(parents=True, exist_ok=True)
        
        metadata = {}
        for session_id, entry in sessions.items():
            meta = entry.get("meta", {})
            # 保存聊天历史
            tutor = entry.get("tutor")
            if tutor and hasattr(tutor, 'history'):
                # 将LangChain的ChatMessageHistory转换为可序列化的格式
                chat_history = []
                for message in tutor.history.messages:
                    chat_history.append({
                        "type": message.__class__.__name__,
                        "content": message.content
                    })
                meta["chat_history"] = chat_history
                meta["step"] = tutor.step
            
            # 如果有占位逻辑的历史记录，也要保存
            if "history" in entry:
                meta["fallback_history"] = entry["history"]
            
            metadata[session_id] = meta
        
        print(f"[DEBUG] 准备保存 {len(metadata)} 个会话的元数据")
        print(f"[DEBUG] 元数据内容: {metadata}")
        print(f"[DEBUG] 文件路径: {SESSIONS_METADATA_FILE}")
        print(f"[DEBUG] 文件路径绝对路径: {SESSIONS_METADATA_FILE.absolute()}")
        
        with open(SESSIONS_METADATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        
        # 验证文件是否真的创建了
        if SESSIONS_METADATA_FILE.exists():
            file_size = SESSIONS_METADATA_FILE.stat().st_size
            print(f"[DEBUG] ✅ 文件保存成功! 文件大小: {file_size} 字节")
        else:
            print(f"[DEBUG] ❌ 文件保存失败! 文件不存在")
        
        print(f"成功保存 {len(metadata)} 个会话的元数据到 {SESSIONS_METADATA_FILE}")
    except Exception as e:
        print(f"保存会话元数据失败: {e}")
        import traceback
        traceback.print_exc()

def get_or_create_tutor(session_id: str) -> 'TutorSession':
    """获取或创建tutor实例"""
    entry = sessions.get(session_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Session not found")
    
    tutor = entry.get("tutor")
    if tutor is None:
        # 重新创建tutor实例
        meta = entry.get("meta", {})
        profile_name = meta.get("profile")
        if not profile_name:
            raise HTTPException(status_code=500, detail="Profile not found in session metadata")
        
        profile_path = GENERATED / profile_name
        if not profile_path.exists():
            raise HTTPException(status_code=404, detail="Profile file not found")
        
        try:
            with open(profile_path, "r", encoding="utf-8") as f:
                profile = json.load(f)
            
            tutor = TutorSession(session_id, profile)
            entry["tutor"] = tutor
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"无法重新创建 tutor: {e}")
    
    return tutor

# 启动时加载会话元数据
load_sessions_metadata()

class CreateSessionRequest(BaseModel):
    profile: str  # profile file name or path relative to generated_tutors

class MessageRequest(BaseModel):
    message: str

class RenameSessionRequest(BaseModel):
    name: str

class TutorSession:
    """封装 tutor 运行时：初始化 LLM、prompt chain、history，并提供 handle_message 方法返回回复。"""
    def __init__(self, session_id: str, profile: Dict[str, Any]):
        load_dotenv()
        self.session_id = session_id
        # 从 profile 中读取必要字段
        self.system_prompt_template = profile.get("system_prompt_template", "")
        self.curriculum = profile.get("curriculum", [])
        self.topic_name = profile.get("topic_name")
        self.step = 0

        # 初始化 LLM 与链
        if DEEPSEEK_AVAILABLE and ChatDeepSeek is not None:
            self.llm = ChatDeepSeek(model="deepseek-chat", temperature=0.7)
        else:
            # 如果 DeepSeek 不可用，抛出异常，让调用者使用占位逻辑
            raise Exception("LLM 不可用，将使用占位逻辑")
        
        self.history = ChatMessageHistory()

        # 恢复聊天历史和学习进度
        self.restore_session_state()

        prompt = ChatPromptTemplate.from_messages([
            ("system", "{system_prompt_with_state}"),
            MessagesPlaceholder(variable_name="history"),
            ("user", "{input}"),
        ])

        self.chain = prompt | self.llm | StrOutputParser()

        self.chain_with_history = RunnableWithMessageHistory(
            self.chain,
            lambda sid: self.history,
            input_messages_key="input",
            history_messages_key="history",
        )

        evaluator_prompt = "教学目标：{step_desc}。学生回答：{user_input}。他是否已经正确理解或完成了这个步骤？请只回答'是'或'否'，不要有任何其他多余的字。"
        self.evaluator_chain = ChatPromptTemplate.from_template(evaluator_prompt) | self.llm | StrOutputParser()

    def restore_session_state(self):
        """恢复会话状态，包括聊天历史和学习进度"""
        try:
            entry = sessions.get(self.session_id)
            if entry:
                meta = entry.get("meta", {})
                
                # 恢复学习进度
                self.step = meta.get("step", 0)
                
                # 恢复聊天历史
                chat_history = meta.get("chat_history", [])
                if chat_history:
                    from langchain_core.messages import HumanMessage, AIMessage
                    
                    for msg in chat_history:
                        msg_type = msg.get("type", "")
                        content = msg.get("content", "")
                        
                        if msg_type == "HumanMessage":
                            self.history.add_user_message(content)
                        elif msg_type == "AIMessage":
                            self.history.add_ai_message(content)
                    
                    print(f"[DEBUG] 恢复了 {len(chat_history)} 条聊天记录")
                else:
                    print(f"[DEBUG] 新会话，无聊天记录需要恢复")
        except Exception as e:
            print(f"[DEBUG] 恢复会话状态失败: {e}")
            # 失败时保持默认状态

    def get_welcome_message(self) -> str:
        """生成初始欢迎和引导消息"""
        if not self.curriculum:
            return f"你好！欢迎来到 {self.topic_name or '苏格拉底式学习'} 课程！准备好开始学习了吗？"
        
        current_step = self.curriculum[0] if self.curriculum else "开始学习"
        
        # 使用LLM生成个性化的欢迎消息
        welcome_prompt = f"""作为一名苏格拉底式导师，请为学习"{self.topic_name}"的学生生成一段简洁友好的欢迎语。

课程主题：{self.topic_name}
第一个学习目标：{current_step}

要求：
1. 热情欢迎学生
2. 简要介绍课程主题
3. 引导学生开始第一个学习目标
4. 体现苏格拉底式教学的启发性风格
5. 不超过100字

欢迎语："""
        
        try:
            formatted_system_prompt = "你是一位经验丰富的苏格拉底式导师，善于启发学生思考。"
            response = self.chain_with_history.invoke({
                "system_prompt_with_state": formatted_system_prompt,
                "input": welcome_prompt
            }, config={"configurable": {"session_id": self.session_id}})
            return response
        except Exception as e:
            # 如果LLM调用失败，返回默认欢迎消息
            return f"你好！我是你的苏格拉底式导师，今天我们将一起探索「{self.topic_name}」。\n\n我会通过提问的方式引导你思考，而不是直接给出答案。准备好接受挑战了吗？\n\n让我们从第一个目标开始：{current_step}"

    def handle_message(self, user_input: str) -> Dict[str, Any]:
        """处理用户消息：评估是否完成当前步骤，更新进度，然后调用主链生成回复。"""
        # 当前步骤描述
        if self.step >= len(self.curriculum):
            current_step_description = "已完成所有步骤。"
        else:
            current_step_description = self.curriculum[self.step]

        # 评估用户回答（尽量捕获异常以保证 API 稳定）
        try:
            evaluation_result = self.evaluator_chain.invoke({
                "step_desc": current_step_description,
                "user_input": user_input,
            })
        except Exception:
            evaluation_result = ""

        # 根据评估结果推进步骤（如果评估返回包含中文"是"）
        if isinstance(evaluation_result, str) and "是" in evaluation_result:
            self.step = min(self.step + 1, max(len(self.curriculum), 1))

        # 填充系统提示
        try:
            formatted_system_prompt = self.system_prompt_template.format(
                current_step_description=current_step_description
            )
        except Exception:
            formatted_system_prompt = self.system_prompt_template

        # 将请求传入带历史的链（捕获异常并返回占位回复）
        try:
            response = self.chain_with_history.invoke({
                "system_prompt_with_state": formatted_system_prompt,
                "input": user_input,
            }, config={"configurable": {"session_id": self.session_id}})
            reply = response
        except Exception as e:
            reply = f"[错误] 无法获取模型回复：{e}"

        # 每次对话后自动保存会话元数据
        save_sessions_metadata()

        # 记录历史到 session meta 也保持兼容旧前端设计
        return {"reply": reply, "step": self.step, "evaluation": evaluation_result}


@app.get("/api/profiles", response_model=List[str])
def list_profiles():
    """列出 generated_tutors 目录下的 profile 文件名"""
    if not GENERATED.exists():
        return []
    return [p.name for p in GENERATED.glob("*.json")]

@app.get("/api/profiles/{profile_name}")
def get_profile(profile_name: str):
    profile_path = GENERATED / profile_name
    if not profile_path.exists():
        raise HTTPException(status_code=404, detail="Profile not found")
    try:
        with open(profile_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tutor/session")
def create_session(req: CreateSessionRequest):
    """创建一个新的 tutor 会话并初始化 TutorSession 实例"""
    profile_path = (GENERATED / req.profile)
    if not profile_path.exists():
        raise HTTPException(status_code=404, detail="Profile not found")
    try:
        with open(profile_path, "r", encoding="utf-8") as f:
            profile = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    session_id = str(uuid.uuid4())
    topic_name = profile.get("topic_name", "新会话")
    created_at = datetime.datetime.now().isoformat()

    # 先创建会话元数据，确保即使tutor创建失败也会保存
    sessions[session_id] = {
        "meta": {
            "profile": req.profile, 
            "topic_name": topic_name,
            "session_name": topic_name,
            "created_at": created_at
        }, 
        "tutor": None
    }
    
    # 立即保存元数据
    print(f"[DEBUG] 创建会话 {session_id}，立即保存元数据...")
    print(f"[DEBUG] 会话数据: {sessions[session_id]['meta']}")
    print(f"[DEBUG] 保存路径: {SESSIONS_METADATA_FILE}")
    save_sessions_metadata()

    try:
        tutor = TutorSession(session_id, profile)
        sessions[session_id]["tutor"] = tutor
        print(f"[DEBUG] 成功创建tutor实例for session {session_id}")
        # 再次保存，确保tutor创建成功后也保存
        save_sessions_metadata()
    except Exception as e:
        # tutor创建失败，但会话元数据已保存
        print(f"[DEBUG] 创建tutor失败，但会话元数据已保存: {e}")
        # 不抛出异常，让前端可以使用占位逻辑
        pass

    return {"session_id": session_id}

@app.post("/api/tutor/{session_id}/message")
def send_message(session_id: str, req: MessageRequest):
    """接收用户消息并返回 tutor 的回复（若 tutor 初始化失败则退回到占位逻辑）"""
    print(f"[DEBUG] 收到消息，会话ID: {session_id}, 消息: {req.message}")
    
    entry = sessions.get(session_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Session not found")

    tutor = entry.get("tutor")
    if tutor is None:
        print(f"[DEBUG] 使用占位逻辑处理消息")
        # 回退到原来的占位逻辑
        session = entry.setdefault("meta", {})
        history = entry.setdefault("history", [])
        history.append({"role": "user", "content": req.message})
        user_lower = req.message.strip().lower()
        curriculum = session.get("curriculum", [])
        step = session.get("step", 0)

        if user_lower in ["q", "exit"]:
            reply = "会话已结束。感谢你的学习！"
        elif user_lower == "next":
            session["step"] = min(step + 1, max(len(curriculum) - 1, 0))
            new_step = session["step"]
            reply = f"(系统已跳到下一步) 当前任务: {curriculum[new_step] if curriculum else '无'}"
        else:
            reply = f"[占位回复] 我收到了你的消息：'{req.message}'. (当前步骤 {step}: {curriculum[step] if curriculum else '无'})"

        history.append({"role": "assistant", "content": reply})
        
        # 强制保存元数据
        print(f"[DEBUG] 占位逻辑回复完成，强制保存元数据")
        save_sessions_metadata()
        
        return {"reply": reply, "step": session.get("step", 0), "ok": True}

    # 使用 tutor 实例进行真实推理
    try:
        print(f"[DEBUG] 使用tutor实例处理消息")
        result = tutor.handle_message(req.message)
        
        # 在tutor.handle_message之后，再次强制保存
        print(f"[DEBUG] Tutor回复完成，强制保存元数据")
        save_sessions_metadata()
        
        return {"reply": result.get("reply"), "step": result.get("step"), "evaluation": result.get("evaluation"), "ok": True}
    except Exception as e:
        print(f"[DEBUG] Tutor处理消息失败: {e}")
        # 即使出错也要保存
        save_sessions_metadata()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/tutor/{session_id}/welcome")
def get_welcome_message(session_id: str):
    """获取会话的初始欢迎消息"""
    print(f"[DEBUG] 获取欢迎消息，会话ID: {session_id}")
    
    entry = sessions.get(session_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # 检查是否已有聊天历史
    meta = entry.get("meta", {})
    chat_history = meta.get("chat_history", [])
    fallback_history = meta.get("fallback_history", [])
    
    # 如果已有聊天历史，返回空字符串表示不需要欢迎消息
    if (chat_history or fallback_history):
        print(f"[DEBUG] 会话已有聊天历史，跳过欢迎消息")
        return {"welcome": ""}
    
    tutor = entry.get("tutor")
    if tutor is None:
        # 如果没有tutor实例，返回简单的欢迎消息
        topic_name = meta.get("topic_name", "学习")
        welcome_msg = f"你好！欢迎来到{topic_name}课程！准备好开始学习了吗？"
        
        print(f"[DEBUG] 返回简单欢迎消息")
        return {"welcome": welcome_msg}
    
    try:
        welcome = tutor.get_welcome_message()
        
        print(f"[DEBUG] Tutor生成欢迎消息完成")
        return {"welcome": welcome}
    except Exception as e:
        print(f"[DEBUG] 获取欢迎消息失败: {e}")
        # 如果获取欢迎消息失败，返回默认消息
        default_msg = f"你好！欢迎来到{tutor.topic_name}课程！我是你的苏格拉底式导师，让我们开始学习吧！"
        
        return {"welcome": default_msg}

@app.get("/api/tutor/{session_id}/history")
def get_chat_history(session_id: str):
    """获取会话的聊天历史记录"""
    print(f"[DEBUG] 获取聊天历史，会话ID: {session_id}")
    
    entry = sessions.get(session_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Session not found")
    
    history_messages = []
    
    # 首先尝试从tutor实例获取历史
    tutor = entry.get("tutor")
    if tutor and hasattr(tutor, 'history'):
        for message in tutor.history.messages:
            msg_type = "user" if message.__class__.__name__ == "HumanMessage" else "assistant"
            history_messages.append({
                "role": msg_type,
                "content": message.content
            })
    else:
        # 如果没有tutor实例，从元数据获取历史
        meta = entry.get("meta", {})
        
        # 优先使用chat_history
        chat_history = meta.get("chat_history", [])
        if chat_history:
            for msg in chat_history:
                msg_type = "user" if msg.get("type") == "HumanMessage" else "assistant"
                history_messages.append({
                    "role": msg_type,
                    "content": msg.get("content", "")
                })
        
        # 如果没有chat_history，使用fallback_history
        fallback_history = meta.get("fallback_history", [])
        if fallback_history and not chat_history:
            history_messages = fallback_history
    
    print(f"[DEBUG] 返回 {len(history_messages)} 条历史消息")
    return {"messages": history_messages}

@app.get("/api/tutor/{session_id}/state")
def get_state(session_id: str):
    entry = sessions.get(session_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Session not found")
    tutor = entry.get("tutor")
    if tutor is None:
        meta = entry.get("meta", {})
        return {
            "session_id": session_id,
            "topic": meta.get("topic_name"),
            "step": meta.get("step", 0),
            "curriculum": meta.get("curriculum", []),
        }

    return {
        "session_id": session_id,
        "topic": tutor.topic_name,
        "step": tutor.step,
        "curriculum": tutor.curriculum,
    }

# Health
@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.get("/api/sessions")
def list_sessions():
    """获取所有会话列表"""
    session_list = []
    for session_id, entry in sessions.items():
        meta = entry.get("meta", {})
        session_list.append({
            "session_id": session_id,
            "session_name": meta.get("session_name", "未命名会话"),
            "profile": meta.get("profile", ""),
            "topic_name": meta.get("topic_name", ""),
            "created_at": meta.get("created_at", ""),
        })
    # 按创建时间倒序排列
    session_list.sort(key=lambda x: x["created_at"], reverse=True)
    return session_list

@app.put("/api/sessions/{session_id}/rename")
def rename_session(session_id: str, req: RenameSessionRequest):
    """重命名会话"""
    entry = sessions.get(session_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Session not found")
    
    entry["meta"]["session_name"] = req.name
    save_sessions_metadata()
    return {"success": True, "message": "会话重命名成功"}

@app.delete("/api/sessions/{session_id}")
def delete_session(session_id: str):
    """删除会话"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    del sessions[session_id]
    save_sessions_metadata()
    return {"success": True, "message": "会话删除成功"}

# 添加直接运行时的启动代码
if __name__ == "__main__":
    import uvicorn
    import sys
    import os
    
    print("🚀 启动 Socratic Agent API 服务器...")
    print("🌐 服务地址: http://localhost:8000")
    print("📚 API 文档: http://localhost:8000/docs")
    print("❤️  健康检查: http://localhost:8000/api/health")
    print("=" * 50)
    
    # 将当前目录添加到Python路径，这样uvicorn就能找到api_server模块
    current_dir = os.path.dirname(os.path.abspath(__file__))
    if current_dir not in sys.path:
        sys.path.insert(0, current_dir)
    
    # 使用模块名启动，支持热重载
    uvicorn.run("api_server:app", host="0.0.0.0", port=8000, reload=True, reload_dirs=[current_dir])
