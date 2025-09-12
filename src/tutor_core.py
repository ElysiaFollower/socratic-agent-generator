#该文件封装苏格拉底智能体得以运行的主要逻辑

import json
from pathlib import Path
from typing import Dict, Any, List
# --- LangChain核心组件 ---
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.output_parsers import StrOutputParser

# --- LLM选择 ---
# TODO: 未来可以把这里做成可配置的，以加载不同的LLM。
from langchain_deepseek import ChatDeepSeek
from dotenv import load_dotenv

def load_tutor_profile(profile_path: Path) -> Dict[str, Any]:
    """
    加载并验证导师配置档案。
    """
    if not profile_path.exists():
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
        
    return profile

class Tutor:
    def __init__(self, profile_path: Path):
        """
        初始化LLM和Chains，同时管理会话
        """
        print(f"正在初始化导师: {profile_path.stem}...")
        self.profile = load_tutor_profile(profile_path)
        self.curriculum = self.profile["curriculum"]
        self.system_prompt_template = self.profile["system_prompt_template"]

        # 1. 初始化LLM和Chains 
        load_dotenv()
        llm = ChatDeepSeek(model="deepseek-chat", temperature=0.7)
        
        
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

        # 2. 会话状态/历史现在由Tutor实例来管理
        # 根据配置文件名，在data文件夹下寻找可持久化的json数据
        self.history_store = {}
        self.conversation_states = {}

        def get_session_history(session_id: str) -> ChatMessageHistory:
            if session_id not in self.history_store:
                self.history_store[session_id] = ChatMessageHistory()
            return self.history_store[session_id]

        #主智能体链
        self.chain_with_history = RunnableWithMessageHistory(
            chain,
            get_session_history,
            input_messages_key="input",
            history_messages_key="history",
        )
        print("导师初始化完毕！")

    def get_welcome_message(self) -> str:
        """生成欢迎语"""
        return f"你好！今天我们来挑战一下“{self.profile['topic_name']}”。准备好了吗？"

    def get_or_create_session_state(self, session_id: str) -> Dict:
        """获取或创建会话状态"""
        if session_id not in self.conversation_states:
            self.conversation_states[session_id] = {"step": 0}
        return self.conversation_states[session_id]
        
    def process_message(self, session_id: str, user_input: str) -> Dict[str, Any]:
        """
        处理单条用户消息，并返回导师的回复和最新状态。
        跳步作弊码：'希儿天下第一可爱'
        """
        # 需要维护当前进度状态
        current_state = self.get_or_create_session_state(session_id)
        step_index = current_state["step"]


        # 跳步机关(仅做特殊用途)
        if user_input == '希儿天下第一可爱':
            print("--- (强制进入下一关) ---")
            current_state["step"] = min(step_index + 1, len(self.curriculum))
            if current_state["step"] < len(self.curriculum):
                return {
                    "reply": f"(受不了了，我们直接来看下一步吧) ; 对应任务为: {self.curriculum[current_state['step']]}",
                    "state": current_state,
                    "is_finished": False
                }

        if step_index >= len(self.curriculum):
            return {"reply": "太棒了！你已经完成了本次的所有学习任务。期待与你进行下一次的探讨！", "state": current_state, "is_finished": True}


        current_step_description = self.curriculum[step_index]
        
        # 评估学生回答
        evaluation_result = self.evaluator_chain.invoke({
            "step_desc": current_step_description,
            "user_input": user_input
        })

        if "是" in evaluation_result:
            print("\n--- (导师在后台欣慰地点了点头，认为你已掌握，准备进入下一步) ---\n")
            current_state["step"] += 1
            step_index = current_state["step"]
            # 更新下一步的任务描述 (如果还有的话)
            if step_index < len(self.curriculum):
                current_step_description = self.curriculum[step_index]
                print(f"--- (当前步骤: {current_step_description}) ---")

        # 填充系统提示词模板
        # 用加载的模板，填充动态的当前步骤描述
        formatted_system_prompt = self.system_prompt_template.format(
            current_step_description=current_step_description
        )
        # 调用主链
        response = self.chain_with_history.invoke({
            "system_prompt_with_state": formatted_system_prompt, 
            "input": user_input
        },  config={"configurable": {"session_id": session_id}})

        return {"reply": response, "state": current_state, "is_finished": False}