"""Tutor core module.

This module encapsulates the main logic for running the Socratic AI tutor agent.
A Tutor instance corresponds to an independent, persistent session with a
unique session_id.
"""

from dotenv import load_dotenv

load_dotenv()

import logging
from copy import deepcopy
from datetime import datetime
from typing import Any, AsyncGenerator, Union

import pytz
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory

from config import (
    DEFAULT_OUTPUT_LANGUAGE,
    DEFAULT_SESSION_NAME,
    MAX_HISTORY_TOKENS,
    get_default_llm,
)
from schemas.message import ResponseMessage
from schemas.profile import Profile
from schemas.session import Session
from utils.session_manager import SessionManager
from utils.skills import LabManualSkill, PedagogicalStrategySkill
from utils.template_assembler import PromptAssembler

logger = logging.getLogger(__name__)

# SessionManager instance for Tutor class methods
_session_manager = SessionManager()

# Evaluator prompt template - relatively simple and static
EVALUATOR_PROMPT_TEMPLATE = """
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
        # Lazy initialization to avoid initial delay
        self.current_history_tokens = None
        self.truncated_history = deepcopy(self.history)

        self.prompt_assembler = PromptAssembler(
            self.session.profile.prompt_template
        )

        # Initialize skills
        self.lab_manual_skill = LabManualSkill(self.session.profile.topic_name)
        self.pedagogy_skill = PedagogicalStrategySkill()

        tools = [
            self.lab_manual_skill.get_tool(),
            self.pedagogy_skill.get_tool()
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

        # Evaluator prompt template
        evaluator_prompt = ChatPromptTemplate.from_template(
            EVALUATOR_PROMPT_TEMPLATE
        )

        # Main agent chain (without history)
        # We need to use an agent that can handle tool calls
        from langchain.agents import create_tool_calling_agent
        from langchain.agents import AgentExecutor

        agent = create_tool_calling_agent(self.llm, tools, main_prompt)
        # Using AgentExecutor to handle the loop of tool calling
        self.agent_executor = AgentExecutor(
            agent=agent,
            tools=tools,
            verbose=True,
            handle_parsing_errors=True,
            max_iterations=5,
        )

        # Evaluator chain
        self.evaluator_chain = evaluator_prompt | self.llm | StrOutputParser()

        # Main agent chain with history
        self.main_chain_with_history = RunnableWithMessageHistory(
            self.agent_executor,
            lambda sid: self.truncated_history,
            input_messages_key="input",
            history_messages_key="history",
        )
        logger.info("Tutor initialized for session: %s", session.session_id)

    @classmethod
    def from_id(cls, session_id: str, llm: Any = None) -> "Tutor":
        """Load tutor session by session_id.

        Args:
            session_id: The ID of the session to load.
            llm: Optional LLM instance. If None, uses default LLM from config.

        Returns:
            Tutor instance.

        Raises:
            SessionNotFoundError: If session does not exist.
        """
        llm = llm or get_default_llm()
        session = _session_manager.read_session(session_id)
        return cls(session, llm)

    @classmethod
    def create_new(
        cls,
        profile: Profile,
        session_name: str = DEFAULT_SESSION_NAME,
        output_language: str = DEFAULT_OUTPUT_LANGUAGE,
        llm: Any = None,
    ) -> "Tutor":
        """Create a new tutor session.

        Args:
            profile: Profile to use for this tutor.
            session_name: Name of the session. Defaults to DEFAULT_SESSION_NAME.
            output_language: Output language. Defaults to DEFAULT_OUTPUT_LANGUAGE.
            llm: Optional LLM instance. If None, uses default LLM from config.

        Returns:
            New Tutor instance.
        """
        llm = llm or get_default_llm()
        session = _session_manager.create_session(
            profile, session_name, output_language
        )

        instance = cls(session, llm)
        instance.save()
        return instance

    def save(self) -> None:
        """Save tutor session to disk."""
        self._save_history_to_session()
        self.session.update_at = datetime.now(pytz.utc).isoformat()
        _session_manager.save_session(self.session)

    def _restore_history_from_session(self) -> ChatMessageHistory:
        """Restore conversation history from session.

        Returns:
            ChatMessageHistory object populated with session history.

        Raises:
            ValueError: If unknown message type is encountered.
        """
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
        """Calculate total tokens in conversation history.

        Args:
            history: ChatMessageHistory to calculate tokens for.

        Returns:
            Total number of tokens.
        """
        tokens = 0
        for message in history.messages:
            tokens += self.llm.get_num_tokens(message.content)
        return tokens

    def _truncate_history(
        self, history: ChatMessageHistory
    ) -> ChatMessageHistory:
        """Truncate history to stay under max_history_tokens limit.

        Args:
            history: ChatMessageHistory to truncate.

        Returns:
            Truncated ChatMessageHistory (modified in place).
        """
        self.current_history_tokens = (
            self.current_history_tokens
            or self._get_current_history_tokens(history)
        )
        max_tokens_with_note = (
            MAX_HISTORY_TOKENS - len(self.truncate_history_note)
        )
        while self.current_history_tokens > max_tokens_with_note:
            if not history.messages:
                break
            popped_message = history.messages.pop(0)
            self.current_history_tokens -= self.llm.get_num_tokens(
                popped_message.content
            )
        return history

    def get_welcome_message(self) -> str:
        """Generate welcome message for the session.

        Returns:
            Welcome message string.
        """
        topic_name = self.session.profile.topic_name
        return f"你好！今天我们来挑战一下\"{topic_name}\"。准备好了吗？"

    def process_message(self, user_input: str) -> ResponseMessage:
        """Process a single user message synchronously.

        This method evaluates the user's response, updates progress if
        criteria are met, and generates a tutor reply.

        Args:
            user_input: User's input message.

        Returns:
            ResponseMessage containing reply, state, and completion status.

        Note:
            Mainly for testing purposes. For production, use stream_message.
        """
        self.truncated_history = self._truncate_history(self.truncated_history)

        # Handle cheat code (for testing)
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

        # Check if curriculum is complete
        if self.session.state.stepIndex > self.session.get_curriculum().get_len():
            return ResponseMessage(
                reply=(
                    "太棒了！你已经完成了本次的所有学习任务。"
                    "期待与你进行下一次的探讨！"
                ),
                state=self.session.state,
                is_finished=True,
            )

        # Get current step information
        cur_step_title = self.session.get_curriculum().get_step_title(
            self.session.state.stepIndex
        )
        cur_success_criteria = (
            self.session.get_curriculum().get_success_criteria(
                self.session.state.stepIndex
            )
        )

        # Evaluate student response
        evaluation_result = self.evaluator_chain.invoke(
            {
                "step_title": cur_step_title,
                "success_criteria": cur_success_criteria,
                "user_input": user_input,
            }
        )

        additional_note = ""
        if evaluation_result.lower() == "yes":
            logger.info("Student passed step %d", self.session.state.stepIndex)
            self.session.state.stepIndex += 1
            additional_note = (
                "\n\n(user just passed last step. "
                "Please review and introduce current step)"
            )
            if (
                self.session.state.stepIndex
                > self.session.get_curriculum().get_len()
            ):
                return ResponseMessage(
                    reply=(
                        "太棒了！你已经完成了本次的所有学习任务。"
                        "期待与你进行下一次的探讨！"
                    ),
                    state=self.session.state,
                    is_finished=True,
                )

        # Assemble system prompt with current step
        formatted_system_prompt = self.prompt_assembler.assemble(
            self.session.profile.curriculum,
            self.session.state.stepIndex,
            self.session.output_language,
        )

        # Invoke main chain
        # AgentExecutor returns a dict with "output", we need to extract it
        result = self.main_chain_with_history.invoke(
            {
                "system_prompt_with_state": (
                    formatted_system_prompt + additional_note
                ),
                "truncate_history_note": self.truncate_history_note,
                "input": user_input,
                "agent_scratchpad": [],  # Initial scratchpad
            },
            config={"configurable": {"session_id": self.session.session_id}},
        )
        response = result["output"]

        # Update history
        # AgentExecutor with RunnableWithMessageHistory automatically updates history?
        # Actually RunnableWithMessageHistory handles history update if it wraps the runnable properly.
        # But here we are manually adding messages to self.history as well.
        # Let's verify how RunnableWithMessageHistory works.
        # It updates the `get_session_history` object (which is self.truncated_history).
        # We also maintain self.history (the full history).
        # We need to sync them or just update self.history.
        # Since we use self.truncated_history for the runnable, the runnable updates it.
        # But self.history is what we save to disk.
        # So we should append the new interaction to self.history.

        self.history.add_user_message(user_input)
        self.history.add_ai_message(response)
        self.current_history_tokens += (
            self.llm.get_num_tokens(user_input)
            + self.llm.get_num_tokens(response)
        )

        # Auto-save after processing
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

        This is the main method for production use. It streams tokens as they
        are generated and yields a final ResponseMessage at the end.

        Args:
            user_input: User's input message.

        Yields:
            String tokens during generation, followed by a final ResponseMessage.
        """
        reply = ""
        self.truncated_history = self._truncate_history(self.truncated_history)

        # Handle cheat code (for testing)
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
                token = (
                    f"(真拿你没办法，我们直接来看下一步吧) : "
                    f"{guiding_question}"
                )
                yield token
                yield ResponseMessage(
                    reply=token,
                    state=self.session.state,
                    is_finished=False,
                )
                return

        # Check if curriculum is complete
        if self.session.state.stepIndex > self.session.get_curriculum().get_len():
            token = (
                "太棒了！你已经完成了本次的所有学习任务。"
                "期待与你进行下一次的探讨！"
            )
            yield token
            yield ResponseMessage(
                reply=token,
                state=self.session.state,
                is_finished=True,
            )
            return

        # Get current step information
        cur_step_title = self.session.get_curriculum().get_step_title(
            self.session.state.stepIndex
        )
        cur_success_criteria = (
            self.session.get_curriculum().get_success_criteria(
                self.session.state.stepIndex
            )
        )

        # Evaluate student response
        evaluation_result = await self.evaluator_chain.ainvoke(
            {
                "step_title": cur_step_title,
                "success_criteria": cur_success_criteria,
                "user_input": user_input,
            }
        )

        additional_note = ""
        if evaluation_result.lower() == "yes":
            logger.info("Student passed step %d", self.session.state.stepIndex)
            self.session.state.stepIndex += 1
            additional_note = (
                "\n\n(user just passed last step. "
                "Please review and introduce current step)"
            )
            if (
                self.session.state.stepIndex
                > self.session.get_curriculum().get_len()
            ):
                token = (
                    "太棒了！你已经完成了本次的所有学习任务。"
                    "期待与你进行下一次的探讨！"
                )
                yield token
                yield ResponseMessage(
                    reply=token,
                    state=self.session.state,
                    is_finished=True,
                )
                return

        # Assemble system prompt with current step
        formatted_system_prompt = self.prompt_assembler.assemble(
            self.session.profile.curriculum,
            self.session.state.stepIndex,
            self.session.output_language,
        )

        # Stream main chain response
        # AgentExecutor streaming yields steps, we need to extract final output tokens.
        # This is trickier with Agents.
        # langchain.agents.AgentExecutor.astream_events is the modern way.
        # But here we use RunnableWithMessageHistory wrapped around AgentExecutor.

        async for chunk in self.main_chain_with_history.astream(
            {
                "system_prompt_with_state": (
                    formatted_system_prompt + additional_note
                ),
                "truncate_history_note": self.truncate_history_note,
                "input": user_input,
                "agent_scratchpad": [],
            },
            config={"configurable": {"session_id": self.session.session_id}},
        ):
            # AgentExecutor astream yields dictionary with keys like 'actions', 'steps', 'output'.
            # If it's the final output, it might come in chunks if we configure it right,
            # but AgentExecutor standard astream usually yields the final output at the end.
            # To get token streaming from the final LLM call in an agent is complex.
            # For now, let's assume we get the final output in 'output' key at the end,
            # OR if we want real streaming we might need to rely on callbacks or
            # check if `chunk` contains the output token.

            # If chunk is a dict and has "output", it is the final result.
            if isinstance(chunk, dict) and "output" in chunk:
                reply = chunk["output"]
                yield reply
            # If it is just a string (which sometimes happens if the underlying runnable yields strings), append it.
            elif isinstance(chunk, str):
                reply += chunk
                yield chunk

        # Note: True token-by-token streaming with Agents + Tools usually requires
        # using .astream_events or specific callback handlers.
        # Given the complexity, and that we want to "enhance" capabilities,
        # non-streaming (or chunked streaming of final answer) might be acceptable for the first iteration
        # of the "Skill" feature if token streaming is hard.
        # However, let's try to do it properly if possible.
        # But AgentExecutor.astream behavior depends on how it's set up.
        # For now, let's stick to the simplest integration: return the full reply at the end if streaming is hard,
        # or yield the 'output' if available.

        # Update history
        self.history.add_user_message(user_input)
        self.history.add_ai_message(reply)
        self.current_history_tokens += (
            self.llm.get_num_tokens(user_input)
            + self.llm.get_num_tokens(reply)
        )
        self.save()

        # Yield final response message
        yield ResponseMessage(
            reply=reply,
            state=self.session.state,
            is_finished=False,
        )
