from typing import Any, AsyncGenerator, Union
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_core.output_parsers import StrOutputParser
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))
from schemas.message import ResponseMessage
from utils.TemplateAssembler import PromptAssembler
from config import MAX_HISTORY_TOKENS, PROMPT_TEMPLATE_DIR

with open(PROMPT_TEMPLATE_DIR / "evaluator_prompt.jinja2", "r") as f:
    evaluator_prompt_template = f.read()

class TutorAgent:
    """
    An agent that encapsulates the core logic of the Socratic tutor.
    """
    def __init__(self, llm: Any, session: Any, history: ChatMessageHistory):
        """
        Initializes the TutorAgent.

        Args:
            llm: The language model to use for the agent.
            session: The session object containing the profile, state, and curriculum.
            history: The chat history object.
        """
        self.llm = llm
        self.session = session
        self.history = history
        self.prompt_assembler = PromptAssembler(self.session.profile.prompt_template)

        main_prompt = ChatPromptTemplate.from_messages([
            ("system", "{system_prompt_with_state}"),
            ("system", "{truncate_history_note}"),
            MessagesPlaceholder(variable_name="history"),
            ("user", "{input}"),
        ])

        evaluator_prompt = ChatPromptTemplate.from_template(evaluator_prompt_template)

        main_chain = main_prompt | self.llm | StrOutputParser()
        self.evaluator_chain = evaluator_prompt | self.llm | StrOutputParser()

        self.main_chain_with_history = RunnableWithMessageHistory(
            main_chain,
            lambda sid: self.history,
            input_messages_key="input",
            history_messages_key="history",
        )

    async def stream_message(self, user_input: str, truncated_history: ChatMessageHistory) -> AsyncGenerator[Union[str, ResponseMessage], None]:
        """
        Processes a user message and yields the response in a stream.

        Args:
            user_input: The user's message.
            truncated_history: The truncated chat history.

        Yields:
            A stream of tokens and a final ResponseMessage object.
        """
        reply = ""

        if self.session.state.stepIndex > self.session.get_curriculum().get_len():
            token = "Excellent! You have completed all the learning tasks for this session. I look forward to our next discussion!"
            yield token
            yield ResponseMessage(
                reply=token,
                state=self.session.state,
                is_finished=True
            )
            return

        cur_step_title = self.session.get_curriculum().get_step_title(self.session.state.stepIndex)
        cur_success_criteria = self.session.get_curriculum().get_success_criteria(self.session.state.stepIndex)

        evaluation_result = await self.evaluator_chain.ainvoke({
            "step_title": cur_step_title,
            "success_criteria": cur_success_criteria,
            "user_input": user_input
        })

        additional_note = ""
        if evaluation_result.lower() == 'yes':
            print("\\n--- (The tutor nodded approvingly in the background, believing you have mastered the material and are ready for the next step) ---\\n")
            self.session.state.stepIndex += 1
            additional_note = f"\\n\\n(user just passed last step. Please review and introduce current step)"

        if self.session.state.stepIndex > self.session.get_curriculum().get_len():
            token = "Excellent! You have completed all the learning tasks for this session. I look forward to our next discussion!"
            yield token
            yield ResponseMessage(
                reply=token,
                state=self.session.state,
                is_finished=True
            )
            return

        formatted_system_prompt = self.prompt_assembler.assemble(self.session.profile.curriculum, self.session.state.stepIndex, self.session.output_language)

        async for chunk in self.main_chain_with_history.astream({
            "system_prompt_with_state": formatted_system_prompt + additional_note,
            "truncate_history_note": f"History is truncated under max_history_tokens: {MAX_HISTORY_TOKENS}",
            "input": user_input,
        }, config={"configurable": {"session_id": self.session.session_id}}):
            reply += chunk
            yield chunk

        yield ResponseMessage(
            reply=reply,
            state=self.session.state,
            is_finished=False
        )
