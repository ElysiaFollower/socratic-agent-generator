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
                    "Analyze supplemental materials and create a custom tool/skill definition. "
                    "Return a single JSON object that strictly follows the format instructions: "
                    "\"{format_instructions}\".\n\n"
                    "## Field Guidelines:\n\n"
                    "1. **name** (string): A short, memorable name for the skill (2-4 words).\n"
                    "   Examples: \"Lab Manual Consultant\", \"Concept Explainer\", \"Code Analyzer\"\n\n"
                    "2. **description** (string): CRITICAL - This tells the LLM WHEN to use this skill. "
                    "Must answer: \"When should I use this skill?\"\n"
                    "   Format: \"Use this skill to [action] when [condition]. Use this when [specific scenarios].\"\n"
                    "   Example: \"Consult the lab manual to find specific technical details, definitions, "
                    "or step-by-step instructions. Use this when you need to verify lab details or check expected outputs.\"\n\n"
                    "3. **tool_name** (string): snake_case, prefixed with 'custom_', e.g., 'custom_lab_manual_consultant'\n\n"
                    "4. **skill_type** (string): Category of the skill. Common types: 'retrieval', 'analysis', 'explanation', 'calculation'\n\n"
                    "5. **instructions** (string): Step-by-step guide for the LLM executing this skill. "
                    "Include:\n"
                    "   - Role definition (\"You are a...\")\n"
                    "   - Step-by-step process\n"
                    "   - Output format requirements\n"
                    "   - Error handling\n"
                    "   - Limitations\n\n"
                    "6. **meta_info.retrieval_needed** (boolean): Set true if the skill requires searching "
                    "the supplemental materials (vector search). Set false if the skill only needs static knowledge.\n\n"
                    "7. **skill_key** (string): Optional unique identifier. Leave null for auto-generation.\n\n"
                    "8. **index_path** (string): Always null - backend will fill this.\n\n"
                    "## Context Awareness:\n"
                    "- Consider the profile's topic, target_audience, and persona_hints when naming and describing the skill.\n"
                    "- Align the skill's purpose with the learning objectives of the course.\n"
                    "- Use terminology appropriate for the target_audience level.\n\n"
                    "## Output Format:\n"
                    "- Return ONLY the JSON object, no additional text.\n"
                    "- All string fields must be non-empty except skill_key and index_path.",
                ),
                (
                    "user",
                    "## Task\n"
                    "Analyze the supplemental materials below and create a custom skill definition.\n\n"
                    "## Profile Context\n"
                    "{profile_context}\n\n"
                    "## User Hint (if provided)\n"
                    "{hint}\n\n"
                    "## Supplemental Materials\n"
                    "{materials}\n\n"
                    "Generate a skill draft JSON that follows the format instructions above.",
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
