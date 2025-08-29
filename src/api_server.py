from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, List
from pathlib import Path
import json
import uuid

# 导入用于运行实际推理链的组件
from dotenv import load_dotenv
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.output_parsers import StrOutputParser
from langchain_deepseek import ChatDeepSeek

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

if not GENERATED.exists():
    GENERATED.mkdir(parents=True, exist_ok=True)

# In-memory sessions store (simple)
# sessions: session_id -> { meta: {...}, tutor: TutorSession }
sessions: Dict[str, Dict[str, Any]] = {}

class CreateSessionRequest(BaseModel):
    profile: str  # profile file name or path relative to generated_tutors

class MessageRequest(BaseModel):
    message: str


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
        # 注意：依赖环境中已安装 langchain_deepseek 等
        self.llm = ChatDeepSeek(model="deepseek-chat", temperature=0.7)
        self.history = ChatMessageHistory()

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

        # 根据评估结果推进步骤（如果评估返回包含中文“是”）
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

    try:
        tutor = TutorSession(session_id, profile)
    except Exception as e:
        # 若在初始化 LLM 时失败，仍返回会话元信息但不创建 tutor
        sessions[session_id] = {"meta": {"profile": req.profile, "topic_name": profile.get("topic_name")}, "tutor": None}
        raise HTTPException(status_code=500, detail=f"无法初始化 tutor: {e}")

    sessions[session_id] = {"meta": {"profile": req.profile, "topic_name": profile.get("topic_name")}, "tutor": tutor}
    return {"session_id": session_id}

@app.post("/api/tutor/{session_id}/message")
def send_message(session_id: str, req: MessageRequest):
    """接收用户消息并返回 tutor 的回复（若 tutor 初始化失败则退回到占位逻辑）"""
    entry = sessions.get(session_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Session not found")

    tutor = entry.get("tutor")
    if tutor is None:
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
        return {"reply": reply, "step": session.get("step", 0), "ok": True}

    # 使用 tutor 实例进行真实推理
    try:
        result = tutor.handle_message(req.message)
        return {"reply": result.get("reply"), "step": result.get("step"), "evaluation": result.get("evaluation"), "ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/tutor/{session_id}/welcome")
def get_welcome_message(session_id: str):
    """获取会话的初始欢迎消息"""
    entry = sessions.get(session_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Session not found")
    
    tutor = entry.get("tutor")
    if tutor is None:
        # 如果没有tutor实例，返回简单的欢迎消息
        meta = entry.get("meta", {})
        topic_name = meta.get("topic_name", "学习")
        return {"welcome": f"你好！欢迎来到{topic_name}课程！准备好开始学习了吗？"}
    
    try:
        welcome = tutor.get_welcome_message()
        return {"welcome": welcome}
    except Exception as e:
        # 如果获取欢迎消息失败，返回默认消息
        return {"welcome": f"你好！欢迎来到{tutor.topic_name}课程！我是你的苏格拉底式导师，让我们开始学习吧！"}

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
