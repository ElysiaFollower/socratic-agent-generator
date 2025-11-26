from dotenv import load_dotenv
load_dotenv()

import json
import asyncio
from pathlib import Path
from typing import Any, AsyncGenerator, Union
from datetime import datetime
import pytz
from langchain_community.chat_message_histories import ChatMessageHistory
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))
from copy import deepcopy
from config import SESSION_DATA_DIR, PROFILES_DIR, SUPPORTED_LANGUAGES, DEFAULT_OUTPUT_LANGUAGE, DEFAULT_SESSION_NAME, TEMPERATURE, get_default_llm, MAX_HISTORY_TOKENS
from schemas.session import Session
from schemas.profile import Profile
from schemas.message import ResponseMessage
from agents.tutor_agent import TutorAgent
from utils.SessionManager import SessionManager

class Tutor:
    """
    A Tutor instance corresponds to an independent, persistent session,
    identified by a unique session_id.
    """
    def __init__(self, session: Session, llm: Any=None):
        """
        Initializes the Tutor with a given session.

        Args:
            session: The session object for the tutor.
            llm: The language model to use.
        """
        self.session = session
        self.llm = llm or get_default_llm()
        self.history = self._restore_history_from_session()
        self.current_history_tokens = None
        self.truncated_history = deepcopy(self.history)
        self.tutor_agent = TutorAgent(self.llm, self.session, self.truncated_history)
        print("Tutor initialized successfully!")
        
    @classmethod
    def from_id(cls, session_id: str, llm: Any=None):
        """
        Loads a tutor session by its session_id.

        Args:
            session_id: The ID of the session to load.
            llm: The language model to use.

        Returns:
            A Tutor instance.
        """
        llm = llm or get_default_llm()
        session = SessionManager.read_session(session_id)
        return cls(session, llm)
    
    @classmethod
    def create_new(cls, profile:Profile, session_name:str=DEFAULT_SESSION_NAME, output_language:str=DEFAULT_OUTPUT_LANGUAGE, llm:Any=None):
        """
        Creates a new tutor session.

        Args:
            profile: The profile to use for the new session.
            session_name: The name of the new session.
            output_language: The output language for the new session.
            llm: The language model to use.

        Returns:
            A new Tutor instance.
        """
        llm = llm or get_default_llm()
        session = SessionManager.create_session(profile, session_name, output_language)
        
        instance = cls(session, llm)
        instance.save()
        return instance
        
    def save(self)->None:
        """Saves the tutor session to disk."""
        self._save_history_to_session()
        self.session.update_at = datetime.now(pytz.utc).isoformat()
        SessionManager.save_session(self.session)
            
    def _restore_history_from_session(self)->ChatMessageHistory:
        """Restores the chat history from the session."""
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
        """Saves the chat history to the session."""
        self.session.history = [
            {"type": msg.type, "content": msg.content} for msg in self.history.messages
        ]

    def _get_current_history_tokens(self, history: ChatMessageHistory)->int:
        """Calculates the number of tokens in the chat history."""
        tokens = 0;
        for message in history.messages:
            tokens += self.llm.get_num_tokens(message.content)
        return tokens

    def _truncate_history(self, history: ChatMessageHistory)->ChatMessageHistory:
        """Truncates the history to stay within the token limit."""
        self.current_history_tokens = self.current_history_tokens or self._get_current_history_tokens(history)
        while self.current_history_tokens + self.llm.get_num_tokens(f"History is truncated under max_history_tokens: {MAX_HISTORY_TOKENS}") > MAX_HISTORY_TOKENS:
            if not history.messages:
                break
            poped_message = history.messages.pop(0)
            self.current_history_tokens -= self.llm.get_num_tokens(poped_message.content)
        return history

    def get_welcome_message(self) -> str:
        """Generates a welcome message."""
        return f"Hello! Today, we're going to tackle the '{self.session.profile.topic_name}' challenge. Are you ready?"
        
    def process_message(self, user_input: str) -> ResponseMessage:
        """
        Processes a single user message and returns the tutor's response.
        Mainly for testing; synchronous.
        """
        async def run_sync():
            final_response = None
            async for chunk in self.stream_message(user_input):
                if isinstance(chunk, ResponseMessage):
                    final_response = chunk
            return final_response

        return asyncio.run(run_sync())
        
    async def stream_message(self, user_input: str) -> AsyncGenerator[Union[str, ResponseMessage], None]:
        """
        Streams the tutor's response for a given user message.

        Args:
            user_input: The user's message.

        Yields:
            A stream of tokens and a final ResponseMessage object.
        """
        reply = ""
        self.truncated_history = self._truncate_history(self.truncated_history)

        if user_input == 'seele_is_the_best_girl': # Cheat code to advance to the next step
            print("--- (Cheat code detected, forcing next step) ---")
            self.session.state.stepIndex = min(self.session.state.stepIndex, self.session.get_curriculum().get_len()) + 1
            self.save()
            if self.session.state.stepIndex <= self.session.get_curriculum().get_len():
                token = f"(You got it, let's move on to the next step): {self.session.get_curriculum().get_guiding_question(self.session.state.stepIndex)}"
                yield token
                yield ResponseMessage(
                    reply=token,
                    state=self.session.state,
                    is_finished=False
                )
                return 

        async for chunk in self.tutor_agent.stream_message(user_input, self.truncated_history):
            if isinstance(chunk, str):
                reply += chunk
                yield chunk
            elif isinstance(chunk, ResponseMessage):
                self.history.add_user_message(user_input)
                self.history.add_ai_message(reply)
                self.current_history_tokens = (self.current_history_tokens or 0) + self.llm.get_num_tokens(user_input) + self.llm.get_num_tokens(reply)
                self.save()
                yield chunk

if __name__ == '__main__':
    # example usage and test
    profile_path = PROFILES_DIR / "286705ad-cc8a-4c10-bc1d-b6ea69257c43.json"
    with open(profile_path, 'r', encoding='utf-8') as f:
        profile_data = json.load(f)
    test_profile = Profile.model_validate(profile_data)

    tutor = Tutor.create_new(
        profile=test_profile,
        session_name="test_session"
    )
    session_id = tutor.session.session_id 
    print(f"new Tutor created, Session ID: {session_id}")

    # 如果要运行下的部分，则注释掉
    # exit(0)

    print("\n--- [Basic Interaction] ---")
    welcome_msg = tutor.get_welcome_message()
    print(f"🤖 Tutor Welcome: {welcome_msg}")

    print("\n--- simulation user input ---")
    user_input = "你好，请问我们今天要学什么？"
    print(f"👤 User Input: {user_input}")
    response1 = tutor.process_message(user_input)
    print(f"🤖 Tutor Response: {response1.reply}")
    print(f"📊 Current State: Step {response1.state}, Finished: {response1.is_finished}")
    user_input = "seele_is_the_best_girl" # change step, check the action when step is not 1
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
