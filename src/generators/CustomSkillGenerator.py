"""Custom skill generation module."""

import logging
from typing import Any, Optional

from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate

from config import MAX_INPUT_TOKENS
from schemas.custom_skill import CustomSkillDraft

logger = logging.getLogger(__name__)


class CustomSkillGenerator:
    """Generate custom skill drafts from supplemental materials."""

    def __init__(self, llm: Any):
        self.llm = llm
        self.output_parser = JsonOutputParser(pydantic_object=CustomSkillDraft)
        self.prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "You are an expert skill designer for a Socratic tutoring system. "
                    "Analyze supplemental materials and propose a custom tool/skill definition. "
                    "Return a single JSON object that strictly follows the format instructions: "
                    "\"{format_instructions}\". "
                    "Requirements:\n"
                    "- Use concise, clear names and descriptions.\n"
                    "- tool_name must be snake_case and prefixed with 'custom_'.\n"
                    "- Put any extra flags in meta_info (e.g., retrieval_needed).\n"
                    "- If a retrieval index is needed, set meta_info.retrieval_needed=true, "
                    "otherwise false.\n"
                    "- Leave index_path null; the backend will fill it.\n"
                    "- Respect the profile context when deciding naming and usage.\n",
                ),
                (
                    "user",
                    "Here are the supplemental materials. Use them to create a skill draft.\n\n"
                    "<hint>\n{hint}\n</hint>\n"
                    "<profile_context>\n{profile_context}\n</profile_context>\n"
                    "<materials>\n{materials}\n</materials>",
                ),
            ]
        )
        self.chain = self.prompt | self.llm | self.output_parser

    def _create_excerpt(self, content: str, max_chars: int = 4000) -> str:
        if len(content) <= max_chars:
            return content
        return (
            content[: max_chars // 2]
            + "\n\n... (content truncated) ...\n\n"
            + content[-max_chars // 2 :]
        )

    async def generate(
        self,
        materials: str,
        hint: Optional[str] = None,
        profile_context: Optional[str] = None,
    ) -> CustomSkillDraft:
        logger.info("Generating custom skill draft from materials...")
        content_excerpt = self._create_excerpt(
            materials, max_chars=MAX_INPUT_TOKENS - 1000
        )
        try:
            generated = await self.chain.ainvoke(
                {
                    "materials": content_excerpt,
                    "hint": hint or "",
                    "profile_context": profile_context or "",
                    "format_instructions": self.output_parser.get_format_instructions(),
                }
            )
            return CustomSkillDraft.model_validate(generated)
        except Exception as exc:
            raise RuntimeError(f"Failed to generate custom skill: {exc}") from exc
