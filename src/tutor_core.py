#该文件封装苏格拉底智能体得以运行的主要逻辑
from dotenv import load_dotenv
# 加载环境变量
load_dotenv()

import json
import uuid
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime
import pytz
# --- LangChain核心组件 ---
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.output_parsers import StrOutputParser

# --- LLM选择 ---
# TODO: 未来可以把这里做成可配置的，以加载不同的LLM。
from langchain_deepseek import ChatDeepSeek

from config import SESSION_DATA_DIR, SUPPORTED_LANGUAGES, DEFAULT_OUTPUT_LANGUAGE, DEFAULT_SESSION_NAME, TEMPERATURE

class Tutor:
    """
    一个Tutor实例对应一个独立的、可持久化的会话。拥有唯一的session_id
    """
    def __init__(self, session_id: str, profile_path: Optional[Path], language: Optional[str], session_name: Optional[str] = None):
        '''初始化; session_id is needed; when the session data exists, it will be loaded from the file and the following parameters are ignored
        attributes:
            session_id: str
            sessionFilePath: Path
                session_name: str
                output_language: str
                created_at: datetime
                last_updated_at: datetime
                state: Dict[str, Any]
                    step: int
            profile_path: Path
                topic_name: str
                system_prompt_template: 
                curriculum: 
            history: ChatMessageHistory
        '''
        
        print("init tutor: session_id = {session_id}")
        # --- try to load existing session data first ---
        self.session_id = session_id
        self.sessionFilePath = SESSION_DATA_DIR / f"{self.session_id}.json" #会话文件路径
        self.history = ChatMessageHistory() # history container
        if not self._load(self.sessionFilePath):
            # load existing session data failed, create a new one
            if profile_path is None:
                raise ValueError("错误：缺少必要参数：profile_path; when create a new session, profile_path is needed")
            self._create(session_id, profile_path, language, session_name)
        
        # --- 初始化 LangChain 组件 ---
        llm = ChatDeepSeek(model="deepseek-chat", temperature=TEMPERATURE)
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", "{system_prompt_with_state}"),
            MessagesPlaceholder(variable_name="history"),
            ("user", "{input}"),
        ])
        evaluator_prompt = ChatPromptTemplate.from_template("教学目标：{step_desc}。学生回答：{user_input}。他是否已经正确理解或完成了这个步骤？请只回答'是'或'否'，不要有任何其他多余的字。")

        #主智能体链(无对话记录)
        chain = prompt | llm | StrOutputParser()
        #评估器链
        self.evaluator_chain = evaluator_prompt | llm | StrOutputParser()

        #主智能体链
        self.chain_with_history = RunnableWithMessageHistory(
            chain,
            lambda sid: self.history, # session is implemented by ourself, ignore this parameter
            input_messages_key="input",
            history_messages_key="history",
        )
        print("导师初始化完毕！")


    def _load_tutor_profile(self, profile_path: Path) -> None:
        """
        加载并验证导师配置档案。
        """
        if profile_path is None or not profile_path.exists():
            raise FileNotFoundError(f"错误：导师配置档案未找到 -> {profile_path}")
        
        with open(profile_path, 'r', encoding='utf-8') as f:
            try:
                profile = json.load(f)
            except json.JSONDecodeError:
                raise ValueError(f"错误：无法解析JSON文件 -> {profile_path}")

        # 验证关键字段是否存在
        required_keys = ["topic_name", "system_prompt_template", "curriculum"]
        if not all(key in profile for key in required_keys):
            raise ValueError("错误：配置文件中缺少必要的字段 (topic_name, system_prompt_template, curriculum)")
            
        self.topic_name = profile.get("topic_name", None)
        self.system_prompt_template = profile.get("system_prompt_template", None)
        self.curriculum = profile.get("curriculum", None)
        
    
    def _load(self, sessionFilePath: Path) -> bool:
        """given a session file path. try to load the session data from the file
            if the session data does not exist, return False else return True
        """
        if not sessionFilePath.exists():
            return False # new conversation
        
        with open(sessionFilePath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        # **get Attributes**
        self.profile_path = data.get("profile_path", None)
        self._load_tutor_profile(self.profile_path)
        self.session_name = data.get("session_name", DEFAULT_SESSION_NAME)
        self.output_language = data.get("output_language", DEFAULT_OUTPUT_LANGUAGE)
        self.created_at = data.get("created_at", datetime.now(pytz.utc).isoformat())
        self.last_updated_at = data.get("last_updated_at", datetime.now(pytz.utc).isoformat())
        self.step = data.get("state", {}).get("step", 0)
        
        # restore conversation history
        for msg in data.get("history", []):
            if msg.get("type") == "human": # 根据LangChain里 BaseMessage.type确定这里的值
                self.history.add_user_message(msg.get("content"))
            elif msg.get("type") == "ai":
                self.history.add_ai_message(msg.get("content"))
        print(f"✅ 会话 {self.session_id} 已从文件恢复。")
        
        return True
    
    def _create(self, session_id: str, profile_path: Path, language: Optional[str], session_name: Optional[str] = None):
        """create a new session"""
        self.profile_path = profile_path
        self._load_tutor_profile(profile_path)
        self.session_name = session_name or self.topic_name or DEFAULT_SESSION_NAME
        self.output_language = language or DEFAULT_OUTPUT_LANGUAGE
        self.created_at = datetime.now(pytz.utc).isoformat()
        self.last_updated_at = datetime.now(pytz.utc).isoformat()
        self.step = 0 
        
        self._save()

    def _save(self):
        """save current session data to file"""
        serializable_history = [
            {"type": msg.type, "content": msg.content} for msg in self.history.messages
        ]

        session_data = {
            "session_id": self.session_id,
            "profile_path": self.profile_path,
            "session_name": self.session_name,
            "output_language": self.output_language,
            "created_at": self.created_at,
            "last_updated_at": datetime.now(pytz.utc).isoformat(),
            "state": {"step": self.step},
            "history": serializable_history
        }
        
        self.sessionFilePath.parent.mkdir(parents=True, exist_ok=True)
        with open(self.sessionFilePath, 'w', encoding='utf-8') as f:
            json.dump(session_data, f, ensure_ascii=False, indent=2)
    
    def _rename(self, new_name: str):
        """rename this session and save"""
        self.session_name = new_name
        self._save()

    def get_welcome_message(self) -> str:
        """生成欢迎语"""
        return f"你好！今天我们来挑战一下“{self.topic_name}”。准备好了吗？"
        
    def process_message(self, user_input: str) -> Dict[str, Any]:
        """
        处理单条用户消息，并返回导师的回复和最新状态。
        跳步作弊码：'希儿天下第一可爱'
        """
        # 需要维护当前进度状态,即self.step
        # 跳步机关(仅做特殊用途)
        if user_input == '希儿天下第一可爱':
            print("--- (强制进入下一关) ---")
            self.step = min(self.step + 1, len(self.curriculum))
            self._save()
            if self.step < len(self.curriculum):
                return {
                    "reply": f"(受不了了，我们直接来看下一步吧) ; 对应任务为: {self.curriculum[self.step]}",
                    "state": self.step,
                    "is_finished": False
                }

        if self.step >= len(self.curriculum):
            return {"reply": "太棒了！你已经完成了本次的所有学习任务。期待与你进行下一次的探讨！", "state": self.step, "is_finished": True}

        current_step_description = self.curriculum[self.step]
        
        # 评估学生回答
        evaluation_result = self.evaluator_chain.invoke({
            "step_desc": current_step_description,
            "user_input": user_input
        })

        if "是" in evaluation_result:
            print("\n--- (导师在后台欣慰地点了点头，认为你已掌握，准备进入下一步) ---\n")
            self.step += 1
            step_index = self.step
            # 更新下一步的任务描述 (如果还有的话)
            if step_index < len(self.curriculum):
                current_step_description = self.curriculum[step_index]
                print(f"--- (当前步骤: {current_step_description}) ---")

        # 填充系统提示词模板
        # 用加载的模板，填充动态的当前步骤描述
        formatted_system_prompt = self.system_prompt_template.format(
            current_step_description=current_step_description,
            output_language=self.output_language
        )
        # 调用主链
        response = self.chain_with_history.invoke({
            "system_prompt_with_state": formatted_system_prompt, 
            "input": user_input,
        },  config={"configurable": {"session_id": self.session_id}})

        # 每次处理完后自动保存
        self._save()

        return {"reply": response, "state": self.step, "is_finished": False}

