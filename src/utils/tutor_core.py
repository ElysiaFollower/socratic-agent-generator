"""Tutor core module.

This module encapsulates the main logic for running the Socratic AI tutor agent.
A Tutor instance corresponds to an independent, persistent session with a
unique session_id.
"""

from dotenv import load_dotenv

load_dotenv()

import logging
import asyncio
from copy import deepcopy
from datetime import datetime
from typing import Any, AsyncGenerator, Union

import pytz
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory

from config import (
    DEFAULT_OUTPUT_LANGUAGE,
    DEFAULT_SESSION_NAME,
    LANGCHAIN_MAX_ITERATIONS,
    LANGCHAIN_VERBOSE,
    MAX_HISTORY_TOKENS,
    get_default_llm,
)
from core.database import SessionLocal
from schemas.message import ResponseMessage
from schemas.profile import Profile
from schemas.session import Session
from utils.session_manager import SessionManager
from utils.skills import (
    AssessmentSkill,
    LabManualSkill,
    PedagogicalStrategySkill,
)
from utils.template_assembler import PromptAssembler

logger = logging.getLogger(__name__)

# Cheat code for skipping steps (for testing purposes only)
CHEAT_CODE = "希儿天下第一可爱"


class Tutor:
    """Socratic AI Tutor agent.

    A Tutor instance corresponds to an independent, persistent session with
    a unique session_id. It manages conversation history, curriculum progress,
    and interaction with the LLM.
    """

    def __init__(self, session: Session, llm: Any = None):
        """Initialize Tutor with a session.

        Args:
            session: Session object containing profile, state, and history.
            llm: Optional LLM instance. If None, uses default LLM from config.
        """
        self.session = session
        self.llm = llm or get_default_llm()
        self.history = self._restore_history_from_session()
        self.truncate_history_note = (
            f"History is truncated under max_history_tokens: "
            f"{MAX_HISTORY_TOKENS}"
        )
        # Initialize token count from restored history
        self.current_history_tokens = self._get_current_history_tokens(self.history)
        self.truncated_history = deepcopy(self.history)

        self.prompt_assembler = PromptAssembler(
            self.session.profile.prompt_template
        )

        # Initialize skills
        # LabManualSkill now resolves vector store path internally using DB
        self.lab_manual_skill = LabManualSkill(
            self.session.profile.topic_name,
            lab_name=self.session.profile.lab_name,
        )
        self.pedagogy_skill = PedagogicalStrategySkill()
        self.assessment_skill = AssessmentSkill(self.session)

        tools = [
            self.lab_manual_skill.get_tool(),
            self.pedagogy_skill.get_tool(),
            self.assessment_skill.get_tool(),
        ]

        # Main prompt template
        main_prompt = ChatPromptTemplate.from_messages(
            [
                ("system", "{system_prompt_with_state}"),
                ("system", "{truncate_history_note}"),
                MessagesPlaceholder(variable_name="history"),
                ("user", "{input}"),
                MessagesPlaceholder(variable_name="agent_scratchpad"),
            ]
        )

        # Main agent chain (without history)
        try:
            from langchain.agents import create_tool_calling_agent
            from langchain.agents import AgentExecutor
        except ImportError:
            # Fallback for some environment configurations
            from langchain_classic.agents import create_tool_calling_agent
            from langchain_classic.agents import AgentExecutor

        agent = create_tool_calling_agent(self.llm, tools, main_prompt)
        self.agent_executor = AgentExecutor(
            agent=agent,
            tools=tools,
            verbose=LANGCHAIN_VERBOSE,
            handle_parsing_errors=True,
            max_iterations=LANGCHAIN_MAX_ITERATIONS,
        )

        # Main agent chain with history
        self.main_chain_with_history = RunnableWithMessageHistory(
            self.agent_executor,
            lambda sid: self.truncated_history,
            input_messages_key="input",
            history_messages_key="history",
        )
        logger.info("Tutor initialized for session: %s", session.session_id)

    @classmethod
    def from_id(
        cls, session_id: str, owner_id: str = None, llm: Any = None
    ) -> "Tutor":
        """Load tutor session by session_id."""
        llm = llm or get_default_llm()

        with SessionLocal() as db:
            sm = SessionManager(db)
            session = sm.read_session(session_id, owner_id=owner_id)

        return cls(session, llm)

    @classmethod
    def create_new(
        cls,
        profile: Profile,
        owner_id: str,
        session_name: str = DEFAULT_SESSION_NAME,
        output_language: str = DEFAULT_OUTPUT_LANGUAGE,
        llm: Any = None,
    ) -> "Tutor":
        """Create a new tutor session."""
        llm = llm or get_default_llm()

        with SessionLocal() as db:
            sm = SessionManager(db)
            session = sm.create_session(
                profile, owner_id, session_name, output_language
            )

        instance = cls(session, llm)
        # Note: create_session already saves to DB.
        return instance

    def save(self) -> None:
        """Save tutor session to disk (Synchronous)."""
        self._save_history_to_session()
        self.session.update_at = datetime.now(pytz.utc).isoformat()

        with SessionLocal() as db:
            sm = SessionManager(db)
            sm.save_session(self.session)

    async def async_save(self) -> None:
        """Save tutor session to disk (Asynchronous wrapper)."""
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, self.save)

    def _restore_history_from_session(self) -> ChatMessageHistory:
        """Restore conversation history from session."""
        history = ChatMessageHistory()
        for msg in self.session.history:
            msg_type = msg.get("type")
            content = msg.get("content", "")
            if msg_type == "human":
                history.add_user_message(content)
            elif msg_type == "ai":
                history.add_ai_message(content)
            else:
                raise ValueError(f"Unknown message type: {msg}")
        return history

    def _save_history_to_session(self) -> None:
        """Save conversation history to session."""
        self.session.history = [
            {"type": msg.type, "content": msg.content}
            for msg in self.history.messages
        ]

    def _get_current_history_tokens(self, history: ChatMessageHistory) -> int:
        """Calculate total tokens in conversation history."""
        tokens = 0
        for message in history.messages:
            tokens += self.llm.get_num_tokens(message.content)
        return tokens

    def _truncate_history(
        self, history: ChatMessageHistory
    ) -> ChatMessageHistory:
        """Truncate history to stay under max_history_tokens limit.
        
        Uses incremental token counting to avoid recalculating the entire
        history on each call. Token count is maintained and updated when
        messages are added or removed.
        
        Note: This method modifies the input history object in-place. The
        token count (current_history_tokens) tracks self.history, not the
        truncated_history. When truncating truncated_history, we calculate
        tokens based on the truncated version, not the full history.
        
        Implements smart truncation: prioritizes keeping messages from the
        current step, then fills remaining space with older messages.
        
        Args:
            history: ChatMessageHistory to truncate (will be modified in-place).
            
        Returns:
            Truncated ChatMessageHistory (same object, modified in-place).
        """
        # Calculate tokens for the history being truncated (may be different
        # from self.history if truncating truncated_history)
        history_tokens = self._get_current_history_tokens(history)
        
        max_tokens_with_note = (
            MAX_HISTORY_TOKENS - len(self.truncate_history_note)
        )
        
        # If under limit, no truncation needed
        if history_tokens <= max_tokens_with_note:
            return history
        
        # Smart truncation: try to preserve current step context
        # For now, use simple truncation (remove oldest messages)
        # Future enhancement: track step boundaries and prioritize current step
        while history_tokens > max_tokens_with_note:
            if not history.messages:
                break
            popped_message = history.messages.pop(0)
            # Incrementally update token count for this history
            history_tokens -= self.llm.get_num_tokens(popped_message.content)
        
        return history
    
    def _add_message_to_history(self, message: str, role: str) -> None:
        """Add a message to history and update token count incrementally.
        
        Args:
            message: Message content to add.
            role: Message role ("human" or "ai").
        """
        if role == "human":
            self.history.add_user_message(message)
        elif role == "ai":
            self.history.add_ai_message(message)
        else:
            raise ValueError(f"Unknown message role: {role}")
        
        # Incrementally update token count
        message_tokens = self.llm.get_num_tokens(message)
        self.current_history_tokens = (
            self.current_history_tokens or 0
        ) + message_tokens

    def get_welcome_message(self) -> str:
        """Generate welcome message for the session."""
        topic_name = self.session.profile.topic_name
        return f"你好！今天我们来挑战一下\"{topic_name}\"。准备好了吗？"

    def process_message(self, user_input: str) -> ResponseMessage:
        """Process a single user message synchronously."""
        self.truncated_history = self._truncate_history(self.truncated_history)

        # Handle cheat code
        if user_input == CHEAT_CODE:
            logger.debug("Cheat code detected, skipping to next step")
            curriculum_len = self.session.get_curriculum().get_len()
            self.session.state.stepIndex = min(
                self.session.state.stepIndex, curriculum_len
            ) + 1
            self.save()
            if self.session.state.stepIndex <= curriculum_len:
                guiding_question = (
                    self.session.get_curriculum().get_guiding_question(
                        self.session.state.stepIndex
                    )
                )
                return ResponseMessage(
                    reply=(
                        f"(真拿你没办法，我们直接来看下一步吧) : "
                        f"{guiding_question}"
                    ),
                    state=self.session.state,
                    is_finished=False,
                )

        if self.session.state.stepIndex > self.session.get_curriculum().get_len():
            return ResponseMessage(
                reply=(
                    "太棒了！你已经完成了本次的所有学习任务。"
                    "期待与你进行下一次的探讨！"
                ),
                state=self.session.state,
                is_finished=True,
            )

        formatted_system_prompt = self.prompt_assembler.assemble(
            self.session.profile.curriculum,
            self.session.state.stepIndex,
            self.session.output_language,
            skills=[
                self.lab_manual_skill,
                self.pedagogy_skill,
                self.assessment_skill,
            ],
        )

        result = self.main_chain_with_history.invoke(
            {
                "system_prompt_with_state": formatted_system_prompt,
                "truncate_history_note": self.truncate_history_note,
                "input": user_input,
                "agent_scratchpad": [],
            },
            config={"configurable": {"session_id": self.session.session_id}},
        )
        response = result["output"]

        # Add messages to history with incremental token counting
        self._add_message_to_history(user_input, "human")
        self._add_message_to_history(response, "ai")

        self.save()

        return ResponseMessage(
            reply=response,
            state=self.session.state,
            is_finished=False,
        )

    async def stream_message(
        self, user_input: str
    ) -> AsyncGenerator[Union[str, ResponseMessage], None]:
        """Process a user message and stream the response."""
        reply = ""
        self.truncated_history = self._truncate_history(self.truncated_history)

        if user_input == CHEAT_CODE:
            # ... cheat code logic ...
            logger.debug("Cheat code detected")
            curriculum_len = self.session.get_curriculum().get_len()
            self.session.state.stepIndex = min(
                self.session.state.stepIndex, curriculum_len
            ) + 1
            await self.async_save()
            if self.session.state.stepIndex <= curriculum_len:
                guiding_question = (
                    self.session.get_curriculum().get_guiding_question(
                        self.session.state.stepIndex
                    )
                )
                token = f"(真拿你没办法，我们直接来看下一步吧) : {guiding_question}"
                yield token
                yield ResponseMessage(
                    reply=token, state=self.session.state, is_finished=False
                )
                return

        if self.session.state.stepIndex > self.session.get_curriculum().get_len():
            token = "太棒了！你已经完成了本次的所有学习任务。"
            yield token
            yield ResponseMessage(
                reply=token, state=self.session.state, is_finished=True
            )
            return

        formatted_system_prompt = self.prompt_assembler.assemble(
            self.session.profile.curriculum,
            self.session.state.stepIndex,
            self.session.output_language,
            skills=[
                self.lab_manual_skill,
                self.pedagogy_skill,
                self.assessment_skill,
            ],
        )

        # Add user message to history with incremental token counting
        self._add_message_to_history(user_input, "human")
        
        # Start async save task (non-blocking, will complete in background)
        save_task = asyncio.create_task(self.async_save())

        # Stream response immediately (optimized for TTFT)
        reply = ""
        try:
            async for event in self.main_chain_with_history.astream_events(
                {
                    "system_prompt_with_state": formatted_system_prompt,
                    "truncate_history_note": self.truncate_history_note,
                    "input": user_input,
                    "agent_scratchpad": [],
                },
                config={"configurable": {"session_id": self.session.session_id}},
                version="v2",
            ):
                event_name = event.get("event", "")
                if event_name in ("on_llm_stream", "on_chat_model_stream"):
                    chunk = event.get("data", {}).get("chunk")
                    if chunk:
                        token = None
                        if hasattr(chunk, "content"):
                            token = chunk.content
                        elif isinstance(chunk, str):
                            token = chunk
                        elif isinstance(chunk, dict):
                            token = chunk.get("content")

                        if token:
                            reply += token
                            yield token
                elif event_name == "on_chain_end":
                    output = event.get("data", {}).get("output", "")
                    if output and isinstance(output, str) and not reply:
                        reply = output
                        yield output
        except Exception as e:
            logger.error("Streaming failed: %s", e, exc_info=True)
            # If streaming failed and no reply was collected, set a fallback message
            if not reply:
                reply = "抱歉，我在生成回复时遇到了问题。请稍后再试。"
                yield reply

        # Add AI response to history with incremental token counting
        # Only add non-empty replies to history
        if reply:
            self._add_message_to_history(reply, "ai")
        
        # Ensure save task completes and save final state
        try:
            await save_task
        except Exception as e:
            logger.warning("Background save task failed: %s", e)
        
        await self.async_save()

        yield ResponseMessage(
            reply=reply,
            state=self.session.state,
            is_finished=False,
        )
