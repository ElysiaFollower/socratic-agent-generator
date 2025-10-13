#该文件封装苏格拉底智能体得以运行的主要逻辑
from dotenv import load_dotenv
load_dotenv()

import json
from pathlib import Path
from typing import Dict, Any, List, Optional, overload, Union
from datetime import datetime
import pytz
# --- LangChain core components ---
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.output_parsers import StrOutputParser

import sys
from pathlib import Path
# Add the src directory to sys.path
sys.path.append(str(Path(__file__).resolve().parents[1]))
from config import SESSION_DATA_DIR, PROFILES_DIR, SUPPORTED_LANGUAGES, DEFAULT_OUTPUT_LANGUAGE, DEFAULT_SESSION_NAME, TEMPERATURE, get_default_llm
from schemas.session import Session
from schemas.profile import Profile
from schemas.message import ResponseMessage
from utils.TemplateAssembler import PromptAssembler

# evaluator prompt is relatively simple and static. just define here
evaluator_prompt_template = """
<TASK>
You are a strict, impartial assessment assistant. Your role is to determine if the <STUDENT'S RESPONSE> meets the <SUCCESS CRITERIA> for the given <TOPIC>.
You MUST and ONLY answer with a single word: 'Yes' or 'No'. Do not provide any explanation, punctuation, or additional text.
</TASK>

<TOPIC>
{step_title}
</TOPIC>

<SUCCESS CRITERIA>
{success_criteria}
</SUCCESS CRITERIA>

<STUDENT'S RESPONSE>
{user_input}
</STUDENT'S RESPONSE>
"""

class Tutor:
    """
    一个Tutor实例对应一个独立的、可持久化的会话。拥有唯一的session_id
    """
    def __init__(self, session: Session, llm: Any=None):
        "init by given session"
        self.session = session
        self.llm = llm or get_default_llm()
        self.history = self._restore_history_from_session()
        
        self.prompt_assembler = PromptAssembler(self.session.profile.prompt_template)
        
        main_prompt = ChatPromptTemplate.from_messages([
            ("system", "{system_prompt_with_state}"),
            MessagesPlaceholder(variable_name="history"),
            ("user", "{input}"),
        ])

        evaluator_prompt = ChatPromptTemplate.from_template(evaluator_prompt_template)

        #主智能体链(无对话记录)
        main_chain = main_prompt | self.llm | StrOutputParser()
        #评估器链
        self.evaluator_chain = evaluator_prompt | self.llm | StrOutputParser()

        #主智能体链
        self.main_chain_with_history = RunnableWithMessageHistory(
            main_chain,
            lambda sid: self.history, # session is implemented by ourself, ignore this parameter
            input_messages_key="input",
            history_messages_key="history",
        )
        print("Tutor init success!")
        
    @classmethod
    def from_id(cls, session_id: str, llm: Any=None):
        """load tutor session by given session_id;
        return: Tutor instance"""
        llm = llm or get_default_llm()
        session_file_path = SESSION_DATA_DIR / f"{session_id}.json"
        if not session_file_path.exists():
            raise FileNotFoundError(f"error: tutor session not found -> {session_file_path}")
        
        with open(session_file_path, 'r', encoding='utf-8') as f:
            session_data = json.load(f)
        session = Session.model_validate(session_data)
        return cls(session, llm)
    
    @classmethod
    def create_new(cls, profile:Profile, session_name:str=DEFAULT_SESSION_NAME, output_language:str=DEFAULT_OUTPUT_LANGUAGE, llm:Any=None):
        "create a new tutor session"
        llm = llm or get_default_llm()
        session = Session(
            profile=profile,
            session_name=session_name,
            output_language=output_language,
        )
        
        instance = cls(session, llm)
        instance.save()
        return instance
        
    def save(self)->None:
        """save tutor session to disk"""
        self._save_history_to_session()
        self.session.update_at = datetime.now(pytz.utc).isoformat()
        
        session_file_path = SESSION_DATA_DIR / f"{self.session.session_id}.json"
        with open(session_file_path, 'w', encoding='utf-8') as f:
            json.dump(self.session.model_dump(), f, ensure_ascii=False, indent=2)
            
    def _restore_history_from_session(self)->ChatMessageHistory:
        """restore history from session"""
        history = ChatMessageHistory()
        for msg in self.session.history:
            if(msg.get("type") == "human"):
                history.add_user_message(msg.get("content", ""))
            elif(msg.get("type") == "ai"):
                history.add_ai_message(msg.get("content", ""))
            else:
                raise ValueError(f"error: unknown message type -> {msg}")   
        return history     
        
    def _save_history_to_session(self)->None:
        """save history to session"""
        self.session.history = [
            {"type": msg.type, "content": msg.content} for msg in self.history.messages
        ]
        
# ----------------------------------------------------------------

    # @overload
    # def _load_tutor_profile(self, profile: Dict[str, Any]) -> None:
    #     """load tutor profile from given content""" 
    #     ...
    # @overload
    # def _load_tutor_profile(self, profile: Path) -> None:
    #     """load tutor profile from file"""
    #     ...
    # def _load_tutor_profile(self, profile: Union[Path, Dict[str, Any]]) -> None:
    #     "load tutor profile from given content or file"
    #     if isinstance(profile, Path):
    #         profile_path = profile
    #         if profile_path is None or not profile_path.exists():
    #             raise FileNotFoundError(f"error: tutor profile not found -> {profile_path}")
            
    #         with open(profile_path, 'r', encoding='utf-8') as f:
    #             try:
    #                 profile_data = json.load(f)
    #             except json.JSONDecodeError:
    #                 raise ValueError(f"error：unable to parse JSON file -> {profile_path}")
    #     else:
    #         profile_data = profile
            
    #     # check required keys(must given)
    #     required_keys = ["prompt_template_string", "curriculum"]
    #     if not all(key in profile_data for key in required_keys):
    #         raise ValueError(f"error：profile requires the following fields: {required_keys}")
            
    #     self.topic_name = profile_data.get("topic_name", None)
    #     self.target_audience = profile_data.get("target_audience", None)
    #     self.persona_hints = profile_data.get("persona_hints", None)
    #     self.domain_specific_constraints = profile_data.get("domain_specific_constraints", None)
    #     self.learning_objectives = profile_data.get("learning_objectives", None)
    #     self.curriculum = profile_data.get("curriculum", None)
    #     self.prompt_template_string = profile_data.get("prompt_template_string", None)


    
    
    def _rename(self, new_name: str):
        """rename this session and save"""
        self.session.session_name = new_name
        self.save()

    def get_welcome_message(self) -> str:
        """生成欢迎语"""
        return f"你好！今天我们来挑战一下“{self.session.profile.topic_name}”。准备好了吗？"
        
    def process_message(self, user_input: str) -> ResponseMessage:
        """
        处理单条用户消息，并返回导师的回复和最新状态。
        跳步作弊码：'希儿天下第一可爱'
        """
        # 需要维护当前进度状态,即SessionState.stepIndex
        
        if user_input == '希儿天下第一可爱': # 跳步机关(仅做特殊用途)
            print("--- (检测到作弊码，强制进入下一关) ---")
            self.session.state.stepIndex = min(self.session.state.stepIndex, self.session.get_curriculum().get_len()) + 1
            self.save()
            if self.session.state.stepIndex <= self.session.get_curriculum().get_len():
                return ResponseMessage(
                    reply=f"(真拿你没办法，我们直接来看下一步吧) : {self.session.get_curriculum().get_guiding_question(self.session.state.stepIndex)}",
                    state=self.session.state.stepIndex,
                    is_finished=False
                )

        if self.session.state.stepIndex > self.session.get_curriculum().get_len():
            return ResponseMessage(
                reply="太棒了！你已经完成了本次的所有学习任务。期待与你进行下一次的探讨！",
                state=self.session.state.stepIndex,
                is_finished=True
            )

        cur_step_title = self.session.get_curriculum().get_step_title(self.session.state.stepIndex)
        cur_success_criteria = self.session.get_curriculum().get_success_criteria(self.session.state.stepIndex)
        
        # 评估学生回答
        evaluation_result = self.evaluator_chain.invoke({
            "step_title": cur_step_title,
            "success_criteria": cur_success_criteria,
            "user_input": user_input
        })

        additional_note = ""
        if evaluation_result.lower() == 'yes':
            print("\n--- (导师在后台欣慰地点了点头，认为你已掌握，准备进入下一步) ---\n")
            self.session.state.stepIndex += 1
            additional_note = f"\n\n(user just passed last step. Please review and introduce current step)"
            # 更新下一步的任务描述 (如果还有的话)
            if self.session.state.stepIndex <= self.session.get_curriculum().get_len():
                current_step_title = self.session.get_curriculum().get_step_title(self.session.state.stepIndex)
                print(f"--- (当前步骤: {current_step_title}) ---")

        # 填充系统提示词模板
        # 用加载的模板，填充动态的当前步骤描述
        formatted_system_prompt = self.prompt_assembler.assemble(self.session.profile.curriculum, self.session.state.stepIndex, self.session.output_language)
        # 调用主链
        response = self.main_chain_with_history.invoke({
            "system_prompt_with_state": formatted_system_prompt + additional_note, 
            "input": user_input,
        },  config={"configurable": {"session_id": self.session.session_id}})

        # 每次处理完后自动保存
        self.save()

        return ResponseMessage(
            reply=response,
            state=self.session.state.stepIndex,
            is_finished=False
        )

if __name__ == '__main__':
    # example usage and test
    profile_path = PROFILES_DIR / "test_profile.json"
    with open(profile_path, 'r', encoding='utf-8') as f:
        profile_data = json.load(f)
    test_profile = Profile.model_validate(profile_data)

    tutor = Tutor.create_new(
        profile=test_profile,
        session_name="test_session"
    )
    session_id = tutor.session.session_id 
    print(f"new Tutor created, Session ID: {session_id}")

    print("\n--- [Basic Interaction] ---")
    welcome_msg = tutor.get_welcome_message()
    print(f"🤖 Tutor Welcome: {welcome_msg}")

    print("\n--- simulation user input ---")
    user_input = "你好，请问我们今天要学什么？"
    print(f"👤 User Input: {user_input}")
    response1 = tutor.process_message(user_input)
    print(f"🤖 Tutor Response: {response1.reply}")
    print(f"📊 Current State: Step {response1.state}, Finished: {response1.is_finished}")
    user_input = "希儿天下第一可爱" # change step, check the action when step is not 1
    print(f"👤 User Input: {user_input}")
    response2 = tutor.process_message(user_input)
    print(f"🤖 Tutor Response: {response2.reply}")
    print(f"📊 Current State: Step {response2.state}, Finished: {response2.is_finished}")

    print("\n--- [Testing Persistence] ---")
    print(f"try to use Session ID ({session_id}) reload Tutor...")

    loaded_tutor = Tutor.from_id(session_id)
    
    # 验证状态是否恢复正确
    print(loaded_tutor.history.messages)

    print(f"Step {loaded_tutor.session.state.stepIndex}")

    # 在加载的会话上继续交互
    print("\n--- continue interaction over loaded Tutor ---")
    user_input = "好的，我明白了。"
    print(f"👤 User Input: {user_input}")
    response3 = loaded_tutor.process_message(user_input)
    print(f"🤖 Tutor Response: {response3.reply}")
    print(f"📊 Current State: Step {response3.state}, Finished: {response3.is_finished}")

    print("\n--- [Test Finished] ---")