"""Tutor core module.

This module encapsulates the main logic for running the Socratic AI tutor agent.
A Tutor instance corresponds to an independent, persistent session with a
unique session_id.
"""

from dotenv import load_dotenv

load_dotenv()

import logging
import asyncio
import json
from copy import deepcopy
from datetime import datetime
from typing import Any, AsyncGenerator, Dict, List, Optional, Union, Tuple

import pytz
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.messages import AIMessage, HumanMessage
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
    REMOTE_TOOL_AGENT_IDLE_TIMEOUT,
    get_default_llm,
)
from core.database import SessionLocal
from schemas.message import ResponseMessage
from schemas.profile import Profile
from schemas.session import Session
from schemas.step_completion import StepCompletion
from utils.session_manager import SessionManager
from utils.skills import (
    AssessmentSkill,
    LabManualSkill,
    PedagogicalStrategySkill,
)
from utils.custom_skill_runtime import CustomDbSkill
from utils.custom_skill_manager import CustomSkillManager
from utils.step_evaluator import EvaluationResult, StepEvaluator
from utils.step_completion_manager import StepCompletionManager
from utils.template_assembler import PromptAssembler
from utils.llm_manager import get_llm_manager
from utils.memory_provider import (
    MemoryProviderContext,
    append_memory_note,
    get_memory_provider,
)
from utils.remote_tool_skill import get_remote_environment_skill

logger = logging.getLogger(__name__)

# Cheat code for skipping steps (for testing purposes only)
CHEAT_CODE = "希儿天下第一可爱"

_TOOL_ONLY_REPLY_PHRASES = (
    "let me check",
    "let me look",
    "let me inspect",
    "let me verify",
    "let me try",
    "i'll check",
    "i will check",
    "i need to check",
    "i need to inspect",
    "先检查",
    "我先检查",
    "让我检查",
    "我来检查",
)


def _looks_like_tool_only_reply(reply: str, *, tool_call_count: int) -> bool:
    """Return whether a tool-heavy turn failed to become a teaching reply."""
    normalized = " ".join(reply.strip().lower().split())
    if not normalized:
        return True
    if tool_call_count >= 2 and len(normalized) < 260:
        return True
    has_tool_preamble = any(phrase in normalized for phrase in _TOOL_ONLY_REPLY_PHRASES)
    has_teaching_marker = any(
        marker in normalized
        for marker in (
            "?",
            "why",
            "what",
            "how",
            "explain",
            "reason",
            "observe",
            "理解",
            "为什么",
            "如何",
            "你觉得",
            "请你",
            "思考",
        )
    )
    return has_tool_preamble and not has_teaching_marker


def _missing_stream_reply_chunk(reply: str, yielded_reply: str) -> str:
    """Return the part of the final reply that has not reached the stream."""
    if not reply or reply == yielded_reply:
        return ""
    if reply.startswith(yielded_reply):
        return reply[len(yielded_reply):]
    if yielded_reply and yielded_reply in reply:
        return reply.replace(yielded_reply, "", 1)
    return ("\n\n" if yielded_reply else "") + reply


def _summarize_remote_observation(observation: str) -> str:
    """Convert a Remote Runner JSON observation into a student-readable line."""
    text = observation.strip()
    if not text:
        return ""
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return text[:500]

    action = str(payload.get("action") or "remote tool")
    ok = bool(payload.get("ok", False))
    error = str(payload.get("error") or "").strip()
    result = payload.get("result") if isinstance(payload.get("result"), dict) else {}

    if error:
        return f"{action}: failed - {error}"

    if action == "machine_doctor":
        checks = []
        for key, label in (
            ("reachable", "reachable"),
            ("auth_ok", "authenticated"),
            ("default_cwd_ok", "default cwd ready"),
        ):
            if key in result:
                checks.append(f"{label}={bool(result.get(key))}")
        return f"machine_doctor: {'; '.join(checks) if checks else 'machine checked'}"

    if action in {"session_exec", "session_exec_background"}:
        command = str(result.get("command") or payload.get("command") or "").strip()
        status = str(result.get("status") or ("ok" if ok else "failed"))
        exit_code = result.get("exit_code")
        stdout = str(result.get("stdout") or "").strip()
        stderr = str(result.get("stderr") or "").strip()
        parts = [f"{action}: {status}"]
        if command:
            parts.append(f"command `{command}`")
        if exit_code is not None:
            parts.append(f"exit={exit_code}")
        if stdout:
            parts.append(f"stdout: {stdout[:240]}")
        if stderr:
            parts.append(f"stderr: {stderr[:160]}")
        return "; ".join(parts)

    if "status" in result or "command_id" in result:
        status = str(result.get("status") or "recorded")
        command_id = str(result.get("command_id") or "").strip()
        suffix = f" command_id={command_id}" if command_id else ""
        return f"{action}: {status}{suffix}"

    return f"{action}: {'ok' if ok else 'not ok'}"


def _summarize_remote_observations(tool_observations: List[str]) -> str:
    """Summarize tool observations without exposing raw JSON in chat."""
    lines = [
        line
        for line in (
            _summarize_remote_observation(obs) for obs in tool_observations if obs
        )
        if line
    ]
    if not lines:
        return "The remote tool completed, but it did not return additional output."
    summary = "\n".join(f"- {line}" for line in lines)
    if len(summary) <= 1800:
        return summary
    return summary[:1800].rstrip() + "\n..."


def _agent_executor_kwargs() -> Dict[str, Any]:
    """Return the shared AgentExecutor settings used by Tutor.

    The tutor needs a bit more headroom than the default 3 iterations because a
    single teaching turn often requires one lab-manual lookup plus one follow-up
    refinement before the final answer is ready.
    """
    return {
        "verbose": LANGCHAIN_VERBOSE,
        "handle_parsing_errors": True,
        "max_iterations": LANGCHAIN_MAX_ITERATIONS,
        "early_stopping_method": "force",
    }


def _collect_tools_from_skills(skills: List[Any]) -> List[Any]:
    """Flatten tool collections from skills while preserving legacy support."""
    tools: List[Any] = []
    for skill in skills:
        if hasattr(skill, "get_tools"):
            skill_tools = skill.get_tools()
            if skill_tools:
                tools.extend(skill_tools)
                continue
        if hasattr(skill, "get_tool"):
            tool = skill.get_tool()
            if tool is not None:
                tools.append(tool)
    return tools


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
        self.user_id = session.owner_id
        self._llm_manager = get_llm_manager()
        self.llm = llm or get_default_llm()
        self._chain_cache: Dict[Tuple[str, str], RunnableWithMessageHistory] = {}
        self._llm_cache: Dict[Tuple[str, str], Any] = {}
        self._current_provider: Optional[str] = None
        self._current_model: Optional[str] = None
        self._next_message_id = 1
        self.history = self._restore_history_from_session()
        self.truncate_history_note = (
            f"History is truncated under max_history_tokens: "
            f"{MAX_HISTORY_TOKENS}"
        )
        # Initialize token count from restored history
        self.current_history_tokens = self._get_current_history_tokens(self.history)
        self.truncated_history = deepcopy(self.history)
        self.memory_provider = get_memory_provider(
            MemoryProviderContext(
                user_id=self.user_id,
                session_id=self.session.session_id,
                profile_id=self.session.profile.profile_id,
                topic_name=self.session.profile.topic_name,
                lab_name=self.session.profile.lab_name,
            )
        )

        self.prompt_assembler = PromptAssembler(
            self.session.profile.prompt_template
        )

        # Initialize skills
        # LabManualSkill now resolves vector store path internally using DB
        self.lab_manual_skill = LabManualSkill(
            self.session.profile.topic_name,
            lab_name=self.session.profile.lab_name,
            document_id=getattr(self.session.profile, "document_id", None),
        )
        self.pedagogy_skill = PedagogicalStrategySkill()
        self.assessment_skill = AssessmentSkill(self.session)
        self.remote_environment_skill = get_remote_environment_skill(session=self.session)
        self.base_skills = [
            self.lab_manual_skill,
            self.pedagogy_skill,
            self.assessment_skill,
        ]
        if self.remote_environment_skill is not None:
            self.base_skills.append(self.remote_environment_skill)

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

        skills = self._skills_for_prompt(include_custom=True)
        self.tools = _collect_tools_from_skills(skills)

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
        self.main_prompt = main_prompt

        logger.info("Tutor initialized for session: %s", session.session_id)

    def _create_agent_executor(self, llm: Any):
        """Create a tool-calling agent executor for the given LLM."""
        try:
            from langchain.agents import create_tool_calling_agent
            from langchain.agents import AgentExecutor
        except ImportError:
            from langchain_classic.agents import create_tool_calling_agent
            from langchain_classic.agents import AgentExecutor

        agent = create_tool_calling_agent(llm, self.tools, self.main_prompt)
        return AgentExecutor(agent=agent, tools=self.tools, **_agent_executor_kwargs())

    def _get_chain(
        self,
        provider: Optional[str] = None,
        model: Optional[str] = None,
    ) -> RunnableWithMessageHistory:
        """Get a chain for the selected provider/model."""
        cache_key = (provider or "default", model or "default")
        cached = self._chain_cache.get(cache_key)
        if cached:
            self.llm = self._llm_cache.get(cache_key, self.llm)
            return cached
        if not self.user_id:
            llm = self.llm
        else:
            llm = self._llm_manager.get_llm(self.user_id, provider, model)
        self._llm_cache[cache_key] = llm
        self.llm = llm
        executor = self._create_agent_executor(llm)
        chain = RunnableWithMessageHistory(
            executor,
            lambda sid: self.truncated_history,
            input_messages_key="input",
            history_messages_key="history",
        )
        self._chain_cache[cache_key] = chain
        return chain

    def _select_llm(
        self,
        provider: Optional[str] = None,
        model: Optional[str] = None,
    ) -> RunnableWithMessageHistory:
        """Select LLM for this request and return the chain."""
        self._current_provider = provider
        self._current_model = model
        chain = self._get_chain(provider, model)
        # Recompute token counts for the selected LLM tokenizer.
        self.current_history_tokens = self._get_current_history_tokens(self.history)
        return chain

    def _skills_for_prompt(self, include_custom: bool = True) -> List[Any]:
        """Return runtime skills available to the Tutor prompt and agent."""
        skills: List[Any] = list(self.base_skills)
        if include_custom:
            skills.extend(self.custom_skills)
        return skills

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
        next_message_id = self._next_message_id
        for msg in self.session.history:
            msg_type = msg.get("type")
            content = msg.get("content", "")
            message_id = msg.get("message_id")
            if not isinstance(message_id, int):
                message_id = next_message_id
                next_message_id += 1
            else:
                next_message_id = max(next_message_id, message_id + 1)
            if msg_type == "human":
                message = HumanMessage(
                    content=content,
                    additional_kwargs={"message_id": message_id},
                )
                self._append_history_message(history, message)
            elif msg_type == "ai":
                message = AIMessage(
                    content=content,
                    additional_kwargs={"message_id": message_id},
                )
                self._append_history_message(history, message)
            else:
                raise ValueError(f"Unknown message type: {msg}")
        self._next_message_id = next_message_id
        return history

    def _save_history_to_session(self) -> None:
        """Save conversation history to session."""
        history_payload = []
        for msg in self.history.messages:
            message_id = None
            if hasattr(msg, "additional_kwargs") and isinstance(
                msg.additional_kwargs, dict
            ):
                message_id = msg.additional_kwargs.get("message_id")
            if not isinstance(message_id, int):
                message_id = self._next_message_id
                self._next_message_id += 1
                if hasattr(msg, "additional_kwargs") and isinstance(
                    msg.additional_kwargs, dict
                ):
                    msg.additional_kwargs["message_id"] = message_id
            history_payload.append(
                {"type": msg.type, "content": msg.content, "message_id": message_id}
            )
        self.session.history = history_payload

    def _append_history_message(
        self, history: ChatMessageHistory, message: Any
    ) -> None:
        """Append a message object to history."""
        if hasattr(history, "add_message"):
            history.add_message(message)
            return
        history.messages.append(message)

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

    def _truncate_note_with_memory(self, user_input: str) -> str:
        """Build the history note plus optional long-term memory context."""
        if not self.memory_provider.enabled:
            return self.truncate_history_note
        memory_context = self.memory_provider.recall_context(user_input)
        return append_memory_note(self.truncate_history_note, memory_context)

    def _record_memory_turn(self, user_input: str, assistant_output: str) -> None:
        """Record a completed turn in long-term memory if enabled."""
        if not self.memory_provider.enabled:
            return
        self.memory_provider.record_turn(user_input, assistant_output)

    def _remote_tool_teaching_reply(
        self,
        user_input: str,
        tool_observations: List[str],
    ) -> str:
        """Build a teaching reply when a tool-heavy turn has no real answer."""
        observation_text = _summarize_remote_observations(tool_observations)

        step_info = self._get_current_step_info()
        step_title = step_info.get("step_title", "the current step")
        learning_objective = step_info.get("learning_objective", "")
        guiding_question = self.session.get_curriculum().get_guiding_question(
            self.session.state.stepIndex
        )

        if self.session.output_language == "English":
            return (
                "I checked the lab machine, but the important part is still your reasoning.\n\n"
                f"Shell result summary:\n{observation_text}\n\n"
                f"For the current step, \"{step_title}\", focus on this goal: "
                f"{learning_objective} Based on the evidence, answer this in your own words: "
                f"{guiding_question} Try to connect the command output to the concept rather "
                "than just listing what the command printed."
            )

        return (
            "我已经检查了实验机，但这一步真正要完成的是你的理解，而不是只看命令输出。\n\n"
            f"Shell 结果摘要：\n{observation_text}\n\n"
            f"当前步骤是「{step_title}」，目标是：{learning_objective}"
            f"请你基于这些证据，用自己的话回答：{guiding_question}"
            "重点不是复述命令输出，而是把输出和实验原理联系起来。"
        )

    def _remote_tool_idle_reply(
        self,
        user_input: str,
        tool_observations: List[str],
    ) -> str:
        """Backward-compatible wrapper for older tests/imports."""
        return self._remote_tool_teaching_reply(user_input, tool_observations)
    
    def _add_message_to_history(self, message: str, role: str) -> int:
        """Add a message to history and update token count incrementally.
        
        Args:
            message: Message content to add.
            role: Message role ("human" or "ai").
        """
        message_id = self._next_message_id
        self._next_message_id += 1
        if role == "human":
            history_message = HumanMessage(
                content=message,
                additional_kwargs={"message_id": message_id},
            )
            self._append_history_message(self.history, history_message)
        elif role == "ai":
            history_message = AIMessage(
                content=message,
                additional_kwargs={"message_id": message_id},
            )
            self._append_history_message(self.history, history_message)
        else:
            raise ValueError(f"Unknown message role: {role}")
        
        # Incrementally update token count
        message_tokens = self.llm.get_num_tokens(message)
        self.current_history_tokens = (
            self.current_history_tokens or 0
        ) + message_tokens
        return message_id

    def _record_step_completion(self, step_index: int, message_id: int) -> None:
        """Persist a step completion record."""
        try:
            with SessionLocal() as db:
                manager = StepCompletionManager(db)
                manager.record_completion(
                    self.session.session_id,
                    step_index,
                    message_id,
                )
        except Exception as exc:
            logger.warning(
                "Failed to record step completion: session=%s step=%d error=%s",
                self.session.session_id,
                step_index,
                exc,
            )

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

    def _advance_step(self) -> None:
        """Advance to the next step.

        This is the unified method for step advancement. All step advancement
        should go through this method to ensure consistency and maintainability.

        Note: This method only increments stepIndex by 1. It does not perform
        boundary checks, save the session, or generate transition messages.
        Callers are responsible for those operations.

        For cheat code scenarios that need boundary checking, callers should
        perform the boundary check before or after calling this method.
        """
        self.session.state.stepIndex += 1
        logger.info("Step advanced to: %d", self.session.state.stepIndex)

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

            # If confidence is low, return conservative result (don't advance step)
            # Note: This does not trigger any fallback mechanism. The step simply
            # won't advance, and the student continues on the current step.
            if result.confidence < EVALUATION_FALLBACK_THRESHOLD:
                logger.warning(
                    "Evaluator confidence low (%.2f < %.2f), returning "
                    "conservative result (confidence=0.0, step will not advance)",
                    result.confidence,
                    EVALUATION_FALLBACK_THRESHOLD,
                )
                # Return conservative result (confidence=0, not passed)
                return EvaluationResult(confidence=0.0)

            return result
        except Exception as e:
            logger.error("Evaluator call failed: %s", e, exc_info=True)
            # Return conservative result (confidence=0, step will not advance)
            return EvaluationResult(confidence=0.0)

    async def _generate_transition_message(
        self,
    ) -> AsyncGenerator[str, None]:
        """Generate step transition guidance message.

        Keep transition generation local and deterministic. This runs after the
        evaluator has already accepted the student's answer, so another LLM call
        is unnecessary and can leave SSE clients waiting if the provider stalls.

        Yields:
            Tokens of the transition message.
        """
        curriculum = self.session.get_curriculum()
        current_step_idx = self.session.state.stepIndex

        if current_step_idx >= curriculum.get_len():
            # Curriculum completed
            message = (
                "太棒了！你已经完成了本次的所有学习任务。"
                "期待与你进行下一次的探讨！"
            )
            self._add_message_to_history(message, "ai")
            yield message
            return

        step = curriculum.get_step(current_step_idx)
        message = (
            "很好，这一步的关键证据链已经成立。"
            f"下一步我们进入「{step.step_title}」。"
            f"{step.guiding_question}"
        )
        self._add_message_to_history(message, "ai")
        yield message

    def get_welcome_message(self) -> str:
        """Generate welcome message for the session."""
        topic_name = self.session.profile.topic_name
        output_language = self.session.output_language

        if output_language == "English":
            return f'Hello! Today let\'s explore "{topic_name}". Are you ready?'
        else:
            return f"你好！今天我们来挑战一下\"{topic_name}\"。准备好了吗？"

    def process_message(
        self,
        user_input: str,
        provider: Optional[str] = None,
        model: Optional[str] = None,
    ) -> ResponseMessage:
        """Process a single user message synchronously."""
        chain = self._select_llm(provider, model)
        self.truncated_history = self._truncate_history(self.truncated_history)

        # Handle cheat code
        if user_input == CHEAT_CODE:
            logger.debug("Cheat code detected, skipping to next step")
            curriculum_len = self.session.get_curriculum().get_len()
            current_step = self.session.state.stepIndex
            # Cheat code logic: advance step but ensure we don't exceed curriculum length
            # Original logic: min(stepIndex, curriculum_len) + 1
            if current_step <= curriculum_len:
                self._advance_step()
                # Ensure we don't exceed curriculum length (handles edge case where
                # current_step == curriculum_len, advance would exceed)
                if self.session.state.stepIndex > curriculum_len:
                    self.session.state.stepIndex = curriculum_len + 1
            else:
                # Already beyond curriculum, set to completion state
                self.session.state.stepIndex = curriculum_len + 1
            self.save()
            if self.session.state.stepIndex < curriculum_len:
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

        if self.session.is_finished():
            return ResponseMessage(
                reply=(
                    "太棒了！你已经完成了本次的所有学习任务。"
                    "期待与你进行下一次的探讨！"
                ),
                state=self.session.state,
                is_finished=True,
            )

        truncate_history_note = self._truncate_note_with_memory(user_input)
        formatted_system_prompt = self.prompt_assembler.assemble(
            self.session.profile.curriculum,
            self.session.state.stepIndex,
            self.session.output_language,
            skills=self._skills_for_prompt(include_custom=True),
        )

        result = chain.invoke(
            {
                "system_prompt_with_state": formatted_system_prompt,
                "truncate_history_note": truncate_history_note,
                "input": user_input,
                "agent_scratchpad": [],
            },
            config={"configurable": {"session_id": self.session.session_id}},
        )
        response = result["output"]

        # Add messages to history with incremental token counting
        self._add_message_to_history(user_input, "human")
        assistant_message_id = self._add_message_to_history(response, "ai")
        self._record_memory_turn(user_input, response)

        self.save()

        return ResponseMessage(
            reply=response,
            state=self.session.state,
            is_finished=False,
            message_id=assistant_message_id,
        )

    async def stream_message(
        self,
        user_input: str,
        provider: Optional[str] = None,
        model: Optional[str] = None,
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
        chain = self._select_llm(provider, model)
        reply = ""
        assistant_message_id: Optional[int] = None
        step_completion_info: Optional[StepCompletion] = None
        self.truncated_history = self._truncate_history(self.truncated_history)

        if user_input == CHEAT_CODE:
            # ... cheat code logic ...
            logger.debug("Cheat code detected")
            curriculum_len = self.session.get_curriculum().get_len()
            current_step = self.session.state.stepIndex
            # Cheat code logic: advance step but ensure we don't exceed curriculum length
            # Original logic: min(stepIndex, curriculum_len) + 1
            if current_step <= curriculum_len:
                self._advance_step()
                # Ensure we don't exceed curriculum length (handles edge case where
                # current_step == curriculum_len, advance would exceed)
                if self.session.state.stepIndex > curriculum_len:
                    self.session.state.stepIndex = curriculum_len + 1
            else:
                # Already beyond curriculum, set to completion state
                self.session.state.stepIndex = curriculum_len + 1
            await self.async_save()
            if self.session.state.stepIndex < curriculum_len:
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

        if self.session.is_finished():
            token = "太棒了！你已经完成了本次的所有学习任务。"
            yield token
            yield ResponseMessage(
                reply=token, state=self.session.state, is_finished=True
            )
            return

        truncate_history_note = self._truncate_note_with_memory(user_input)
        formatted_system_prompt = self.prompt_assembler.assemble(
            self.session.profile.curriculum,
            self.session.state.stepIndex,
            self.session.output_language,
            skills=self._skills_for_prompt(include_custom=True),
        )
        # Ensure evaluation lock is created (lazy initialization)
        self._ensure_evaluation_lock()

        # Check evaluation lock (if evaluation pending, wait or reject)
        lock_acquired_for_turn = False
        evaluation_task = None
        save_task = None
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
            lock_acquired_for_turn = True

        try:
            # Extract context and current step info
            conversation_context = self.extract_step_context()
            step_info = self._get_current_step_info()

            # Start async evaluation task (non-blocking)
            evaluation_task = asyncio.create_task(
                self._evaluate_step_async(step_info, conversation_context, user_input)
            )

            # Note: Step advancement is controlled exclusively by StepEvaluator.
            # AssessmentSkill provides assessment information but does not advance steps.
            formatted_system_prompt = self.prompt_assembler.assemble(
                self.session.profile.curriculum,
                self.session.state.stepIndex,
                self.session.output_language,
                skills=self._skills_for_prompt(include_custom=True),
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
            tool_observations: List[str] = []
            stream_timed_out_after_tool = False
            defer_stream_until_final = self.remote_environment_skill is not None
            yielded_reply = ""
            try:
                event_stream = chain.astream_events(
                    {
                        "system_prompt_with_state": formatted_system_prompt,
                        "truncate_history_note": truncate_history_note,
                        "input": user_input,
                        "agent_scratchpad": [],
                    },
                    config={"configurable": {"session_id": self.session.session_id}},
                    version="v2",
                )
                while True:
                    try:
                        next_event = event_stream.__anext__()
                        if tool_called:
                            event = await asyncio.wait_for(
                                next_event,
                                timeout=REMOTE_TOOL_AGENT_IDLE_TIMEOUT,
                            )
                        else:
                            event = await next_event
                    except StopAsyncIteration:
                        break
                    except asyncio.TimeoutError:
                        if tool_called:
                            stream_timed_out_after_tool = True
                            logger.warning(
                                "Agent stream idle timeout after remote/tool call: "
                                "session=%s timeout=%ds reply_len=%d tool_calls=%d",
                                self.session.session_id,
                                REMOTE_TOOL_AGENT_IDLE_TIMEOUT,
                                len(reply),
                                tool_call_count,
                            )
                            break
                        raise

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
                        if tool_output:
                            tool_observations.append(str(tool_output))
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
                                if not defer_stream_until_final:
                                    yield token
                                    yielded_reply += token
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
                                    if not defer_stream_until_final:
                                        yield output
                                        yielded_reply += output
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
                                            if not defer_stream_until_final:
                                                yield additional
                                                yielded_reply += additional
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
                                            if not defer_stream_until_final:
                                                yield additional
                                                yielded_reply += additional
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
                if hasattr(event_stream, "aclose"):
                    await event_stream.aclose()
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
                if not stream_timed_out_after_tool:
                    logger.warning(
                        "Tool was called (%d times) but no reply was generated. "
                        "This may indicate a bug.",
                        tool_call_count,
                    )
                reply = self._remote_tool_teaching_reply(user_input, tool_observations)

            if tool_called and _looks_like_tool_only_reply(
                reply,
                tool_call_count=tool_call_count,
            ):
                logger.warning(
                    "Replacing tool-only tutor reply with teaching summary: "
                    "session=%s reply_len=%d tool_calls=%d",
                    self.session.session_id,
                    len(reply),
                    tool_call_count,
                )
                reply = self._remote_tool_teaching_reply(user_input, tool_observations)

            # Add AI response to history with incremental token counting
            # Only add non-empty replies to history
            if reply:
                assistant_message_id = self._add_message_to_history(reply, "ai")

            # Wait for evaluation to complete
            evaluation_result = await evaluation_task

            if reply and not defer_stream_until_final and reply != yielded_reply:
                missing_reply = _missing_stream_reply_chunk(reply, yielded_reply)
                if missing_reply:
                    yield missing_reply
                    yielded_reply = reply

            # If evaluation passed, generate transition message
            # Note: Step advancement goes through _advance_step() method for consistency.
            # AssessmentSkill does not advance steps - it only provides information.
            transition_message = ""
            if evaluation_result.passed:
                logger.info(
                    "Step evaluation passed: step=%d, confidence=%.2f, threshold=%.2f",
                    self.session.state.stepIndex,
                    evaluation_result.confidence,
                    EVALUATION_PASS_THRESHOLD,
                )
                completed_step_index = self.session.state.stepIndex
                if assistant_message_id is not None:
                    self._record_step_completion(
                        completed_step_index, assistant_message_id
                    )
                    step_completion_info = StepCompletion(
                        step_index=completed_step_index,
                        message_id=assistant_message_id,
                    )
                # Advance step using unified method
                self._advance_step()
                await self.async_save()

                # Add visual separator before transition message
                # This makes the semantic boundary clear between current step reply
                # and next step transition message
                separator = "\n\n---\n\n"
                transition_message += separator
                if not defer_stream_until_final:
                    yield separator

                # Generate transition message
                async for token in self._generate_transition_message():
                    transition_message += token
                    if not defer_stream_until_final:
                        yield token

            # Clear evaluation lock (after transition message is complete, if any)
            # This ensures the entire response (including transition) is complete
            # before allowing the next user input
            async with self._evaluation_lock:
                self.evaluation_pending = False

            # Update reply to include transition message if evaluation passed
            if transition_message:
                reply += transition_message

            if reply and defer_stream_until_final:
                yield reply

            if reply:
                self._record_memory_turn(user_input, reply)

            # Ensure save task completes and save final state
            try:
                await save_task
            except Exception as e:
                logger.warning("Background save task failed: %s", e)

            await self.async_save()

        except asyncio.CancelledError:
            logger.warning(
                "Stream cancelled for session %s; clearing evaluation lock",
                self.session.session_id,
            )
            raise
        except Exception as e:
            logger.error("Error in stream_message: %s", e, exc_info=True)
            raise
        finally:
            if lock_acquired_for_turn and self._evaluation_lock is not None:
                async with self._evaluation_lock:
                    if self.evaluation_pending:
                        self.evaluation_pending = False
            for task in (evaluation_task, save_task):
                if task is not None and not task.done():
                    task.cancel()

        yield ResponseMessage(
            reply=reply,
            state=self.session.state,
            is_finished=self.session.is_finished(),
            message_id=assistant_message_id,
            step_completion=step_completion_info,
        )
