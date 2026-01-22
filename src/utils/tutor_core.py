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
from typing import Any, AsyncGenerator, Dict, List, Optional, Union

import pytz
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory

from config import (
    DEFAULT_OUTPUT_LANGUAGE,
    DEFAULT_SESSION_NAME,
    EVALUATION_FALLBACK_THRESHOLD,
    EVALUATION_PASS_THRESHOLD,
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
from utils.custom_skill_runtime import CustomDbSkill
from utils.custom_skill_manager import CustomSkillManager
from utils.step_evaluator import EvaluationResult, StepEvaluator
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

        self.custom_skills = []
        with SessionLocal() as db:
            csm = CustomSkillManager(db)
            custom_models = csm.list_skills(self.session.profile.profile_id)
            self.custom_skills = [
                CustomDbSkill(model)
                for model in custom_models
                if model.status == "ready"
            ]
        # Initialize step evaluator
        self.evaluator = StepEvaluator()

        # Evaluation state lock (prevents next conversation while evaluation pending)
        # Use lazy initialization to avoid creating lock in sync context
        self.evaluation_pending: bool = False
        self._evaluation_lock: Optional[asyncio.Lock] = None

        tools = [
            self.lab_manual_skill.get_tool(),
            self.pedagogy_skill.get_tool(),
            self.assessment_skill.get_tool(),
        ]
        tools.extend([skill.get_tool() for skill in self.custom_skills])

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

    def extract_step_context(self, max_tokens: int = 2000) -> List[Dict[str, str]]:
        """Extract conversation context for evaluation.

        Uses simplified approach: extracts from all history (does not track
        step start index). The evaluator can determine current step through
        success_criteria.

        Args:
            max_tokens: Maximum token limit for context.

        Returns:
            List of conversation messages with role and content.
        """
        # Extract from all history (simplified approach)
        messages = self.history.messages

        # Convert to dictionary format
        context = []
        current_tokens = 0
        for msg in messages:
            msg_tokens = self.llm.get_num_tokens(msg.content)
            if current_tokens + msg_tokens > max_tokens:
                break
            role = (
                "user"
                if msg.__class__.__name__ == "HumanMessage"
                else "assistant"
            )
            context.append({"role": role, "content": msg.content})
            current_tokens += msg_tokens

        return context

    def _ensure_evaluation_lock(self) -> None:
        """Ensure evaluation lock is created.

        Creates the lock lazily in an async context to avoid RuntimeError
        when Tutor is initialized in a sync context.
        """
        if self._evaluation_lock is None:
            self._evaluation_lock = asyncio.Lock()

    def _get_current_step_info(self) -> Dict[str, Any]:
        """Get current step information for evaluation.

        Returns:
            Dictionary containing step information (step_title, learning_objective,
            success_criteria).
        """
        curriculum = self.session.get_curriculum()
        step_index = self.session.state.stepIndex

        return {
            "step_title": curriculum.get_step_title(step_index),
            "learning_objective": curriculum.get_learning_objective(step_index),
            "success_criteria": curriculum.get_success_criteria(step_index),
        }

    async def _evaluate_step_async(
        self,
        step_info: Dict[str, Any],
        conversation_context: List[Dict[str, str]],
        user_input: str,
    ) -> EvaluationResult:
        """Asynchronously evaluate step.

        Args:
            step_info: Current step information.
            conversation_context: Conversation context.
            user_input: Latest user input.

        Returns:
            EvaluationResult object.
        """
        try:
            # Call independent evaluator
            result = await self.evaluator.evaluate(
                step_info=step_info,
                conversation_context=conversation_context,
                user_input=user_input,
            )

            # If confidence is low, use fallback (don't advance step, let main
            # LLM decide through AssessmentSkill)
            if result.confidence < EVALUATION_FALLBACK_THRESHOLD:
                logger.warning(
                    "Evaluator confidence low (%.2f < %.2f), using "
                    "AssessmentSkill fallback",
                    result.confidence,
                    EVALUATION_FALLBACK_THRESHOLD,
                )
                # Return conservative result (confidence=0, not passed)
                return EvaluationResult(confidence=0.0)

            return result
        except Exception as e:
            logger.error("Evaluator call failed: %s", e, exc_info=True)
            # Return conservative result, let main LLM decide through
            # AssessmentSkill
            return EvaluationResult(confidence=0.0)

    async def _generate_transition_message(
        self,
    ) -> AsyncGenerator[str, None]:
        """Generate step transition guidance message.

        Uses main LLM with full context to naturally summarize and transition.
        The LLM can naturally summarize previous conversation (e.g., "I think
        you've mastered this round, let's move to the next stage").

        Yields:
            Tokens of the transition message.
        """
        curriculum = self.session.get_curriculum()
        current_step_idx = self.session.state.stepIndex

        if current_step_idx > curriculum.get_len():
            # Curriculum completed
            message = (
                "太棒了！你已经完成了本次的所有学习任务。"
                "期待与你进行下一次的探讨！"
            )
            yield message
            return

        # Assemble system prompt (contains new stepIndex information)
        formatted_system_prompt = self.prompt_assembler.assemble(
            self.session.profile.curriculum,
            current_step_idx,  # New step index
            self.session.output_language,
            skills=[
                self.lab_manual_skill,
                self.pedagogy_skill,
                self.assessment_skill,
            ],
        )

        # Generate transition message (using main LLM, based on full context)
        # Main LLM will see:
        # 1. New stepIndex (system prompt contains new step information)
        # 2. Full conversation history (including just now's reply and user answer)
        # 3. Can naturally summarize and transition previous conversation

        transition_input = "好的，让我们继续学习下一部分内容。"

        reply = ""
        async for event in self.main_chain_with_history.astream_events(
            {
                "system_prompt_with_state": formatted_system_prompt,
                "truncate_history_note": self.truncate_history_note,
                "input": transition_input,
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

        # Add transition message to history
        if reply:
            self._add_message_to_history(transition_input, "human")
            self._add_message_to_history(reply, "ai")

    def get_welcome_message(self) -> str:
        """Generate welcome message for the session."""
        topic_name = self.session.profile.topic_name
        output_language = self.session.output_language

        if output_language == "English":
            return f'Hello! Today let\'s explore "{topic_name}". Are you ready?'
        else:
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
                *self.custom_skills,
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
        """Process a user message and stream the response.

        Implements asynchronous evaluation mechanism:
        1. Check evaluation lock (if evaluation pending, wait or reject)
        2. Set evaluation lock at start (prevents next conversation)
        3. Extract context and start async evaluation
        4. Generate and stream reply normally
        5. Wait for evaluation to complete
        6. Clear evaluation lock
        7. If evaluation passed, generate transition message
        """
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
                *self.custom_skills,
            ],
        )
        # Ensure evaluation lock is created (lazy initialization)
        self._ensure_evaluation_lock()

        # Check evaluation lock (if evaluation pending, wait or reject)
        async with self._evaluation_lock:
            if self.evaluation_pending:
                waiting_msg = (
                    "请稍候，正在评估您的回答，请稍后再试..."
                )
                yield waiting_msg
                yield ResponseMessage(
                    reply=waiting_msg,
                    state=self.session.state,
                    is_finished=False,
                )
                return

            # Set evaluation lock (at evaluation start)
            self.evaluation_pending = True

        try:
            # Extract context and current step info
            conversation_context = self.extract_step_context()
            step_info = self._get_current_step_info()

            # Start async evaluation task (non-blocking)
            evaluation_task = asyncio.create_task(
                self._evaluate_step_async(step_info, conversation_context, user_input)
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

            # Add user message to history with incremental token counting
            self._add_message_to_history(user_input, "human")

            # Start async save task (non-blocking, will complete in background)
            save_task = asyncio.create_task(self.async_save())

            # Stream response immediately (optimized for TTFT)
            reply = ""
            tool_called = False
            tool_call_count = 0
            tool_call_in_progress = False
            tool_call_completed = False
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
                    event_data = event.get("data", {})
                    
                    # Track tool calls for debugging and fallback detection
                    # Key design: Keep stream alive during tool execution
                    if event_name == "on_tool_start":
                        tool_called = True
                        tool_call_count += 1
                        tool_call_in_progress = True
                        tool_call_completed = False
                        tool_name = event_data.get("name", "unknown")
                        logger.debug(
                            "Tool called: %s (call #%d), keeping stream alive",
                            tool_name,
                            tool_call_count,
                        )
                        # Keep connection alive, don't end stream output
                    elif event_name == "on_tool_end":
                        tool_call_in_progress = False
                        tool_call_completed = True
                        tool_output = event_data.get("output", "")
                        logger.debug(
                            "Tool execution completed, output length: %d, "
                            "waiting for model response",
                            len(str(tool_output)),
                        )
                        # Tool call completed, wait for model to continue output
                    
                    # Handle streaming LLM output
                    # Key design: Stream output stays alive throughout the entire process:
                    # - Before tool call: normal streaming
                    # - During tool call: stream paused but connection stays alive
                    # - After tool call: continue waiting for model to stream response
                    # - After model completes: stream ends
                    if event_name in ("on_llm_stream", "on_chat_model_stream"):
                        chunk = event_data.get("chunk")
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
                                # Log if this is output after tool call completion
                                if tool_call_completed and not tool_call_in_progress:
                                    logger.debug(
                                        "Model streaming response after tool call completion"
                                    )
                    elif event_name == "on_chain_end":
                        # Check if this is the Agent's final output
                        chain_name = event.get("name", "")
                        agent_chain_names = (
                            "Agent",
                            "AgentExecutor",
                            "RunnableWithMessageHistory",
                        )
                        is_agent_final = chain_name in agent_chain_names
                        
                        # Log all chain_end events for debugging
                        logger.debug(
                            "on_chain_end event: name=%s, is_agent_final=%s, "
                            "current_reply_length=%d, tool_called=%s",
                            chain_name,
                            is_agent_final,
                            len(reply),
                            tool_called,
                        )
                        
                        # Only process agent's final output, ignore intermediate
                        # chain ends (e.g., individual tool executions)
                        if not is_agent_final:
                            continue
                        
                        # Extract output - handle nested structures
                        # LangChain AgentExecutor may return output in nested format:
                        # - Direct string: output = "text"
                        # - Nested dict: output = {"output": "text"}
                        # - Object with content: output.content
                        raw_output = event_data.get("output", "")
                        logger.debug(
                            "Raw output from on_chain_end: type=%s, value=%s",
                            type(raw_output).__name__,
                            str(raw_output)[:200] if raw_output else "empty",
                        )
                        
                        output = raw_output
                        if isinstance(output, dict):
                            # Try nested output structure (AgentExecutor format)
                            final_output = output.get("output", output.get("content", ""))
                            if isinstance(final_output, str):
                                output = final_output
                            elif hasattr(final_output, "content"):
                                output = final_output.content
                            else:
                                output = str(final_output) if final_output else ""
                        elif hasattr(output, "content"):
                            # Handle object with content attribute
                            output = output.content
                        
                        # Convert to string if not already
                        if not isinstance(output, str):
                            output = str(output) if output else ""
                        
                        # Process final output
                        if output:
                            output = output.strip()
                            if output:
                                logger.debug(
                                    "Final output extracted: length=%d, "
                                    "starts_with_reply=%s",
                                    len(output),
                                    output.startswith(reply) if reply else False,
                                )
                                
                                if not reply:
                                    # No streamed reply, use final output
                                    # This handles the case where tool was called but
                                    # LLM didn't stream any tokens
                                    reply = output
                                    yield output
                                    logger.info(
                                        "Using final output from on_chain_end "
                                        "(no stream): %d chars",
                                        len(output),
                                    )
                                elif output != reply:
                                    # Final output differs from streamed reply
                                    # Check if output contains the reply (common case)
                                    if output.startswith(reply):
                                        # Output is an extension of reply
                                        additional = output[len(reply):]
                                        if additional:
                                            reply = output
                                            yield additional
                                            logger.info(
                                                "Extended reply with final output: "
                                                "+%d chars",
                                                len(additional),
                                            )
                                    elif reply in output:
                                        # Reply is contained in output (but not at start)
                                        # This can happen if output was reordered
                                        # Use the full output
                                        additional = output.replace(reply, "", 1)
                                        if additional:
                                            reply = output
                                            yield additional
                                            logger.info(
                                                "Reply found in output, extended: "
                                                "+%d chars",
                                                len(additional),
                                            )
                                    elif len(output) > len(reply):
                                        # Output is different and longer
                                        # This is unusual, log warning
                                        logger.warning(
                                            "Final output differs significantly from "
                                            "streamed reply. Streamed: %d chars, "
                                            "Final: %d chars",
                                            len(reply),
                                            len(output),
                                        )
                                        # Still use final output for history
                                        reply = output
                                    else:
                                        # Output is shorter or same length but different
                                        # Keep the streamed reply, but log for debugging
                                        logger.debug(
                                            "Final output shorter than streamed reply, "
                                            "keeping streamed version"
                                        )
                        
                        # Log for debugging
                        logger.debug(
                            "Agent chain ended, final reply length: %d, "
                            "tool_called: %s, tool_call_count: %d, "
                            "tool_call_completed: %s",
                            len(reply),
                            tool_called,
                            tool_call_count,
                            tool_call_completed,
                        )
                            
            except Exception as e:
                logger.error("Streaming failed: %s", e, exc_info=True)
                # If streaming failed and no reply was collected, set a fallback message
                if not reply:
                    reply = "抱歉，我在生成回复时遇到了问题。请稍后再试。"
                    yield reply
            
            # Final check: if tool was called but no reply was generated, log warning
            # This handles the edge case where tools were called but LLM didn't
            # generate any output (neither streamed nor final)
            # Key design: We keep stream alive during tool execution, and wait for
            # model to continue output after tool completion. Only if no output
            # is generated at all, we provide fallback.
            if tool_called and not reply:
                logger.warning(
                    "Tool was called (%d times) but no reply was generated. "
                    "This may indicate a bug.",
                    tool_call_count,
                )
                reply = (
                    "我已经处理了你的请求，但似乎没有生成回复。"
                    "请告诉我你还需要什么帮助。"
                )
                yield reply

            # Add AI response to history with incremental token counting
            # Only add non-empty replies to history
            if reply:
                self._add_message_to_history(reply, "ai")

            # Wait for evaluation to complete
            evaluation_result = await evaluation_task

            # Clear evaluation lock (at evaluation completion)
            async with self._evaluation_lock:
                self.evaluation_pending = False

            # If evaluation passed, generate transition message
            if evaluation_result.passed:
                logger.info(
                    "Step evaluation passed: step=%d, confidence=%.2f, threshold=%.2f",
                    self.session.state.stepIndex,
                    evaluation_result.confidence,
                    EVALUATION_PASS_THRESHOLD,
                )
                # Advance step
                self.session.state.stepIndex += 1
                await self.async_save()

                # Generate transition message
                async for token in self._generate_transition_message():
                    yield token

            # Ensure save task completes and save final state
            try:
                await save_task
            except Exception as e:
                logger.warning("Background save task failed: %s", e)

            await self.async_save()

        except Exception as e:
            # Ensure lock is cleared on exception
            if self._evaluation_lock is not None:
                async with self._evaluation_lock:
                    self.evaluation_pending = False
            logger.error("Error in stream_message: %s", e, exc_info=True)
            raise

        yield ResponseMessage(
            reply=reply,
            state=self.session.state,
            is_finished=False,
        )
