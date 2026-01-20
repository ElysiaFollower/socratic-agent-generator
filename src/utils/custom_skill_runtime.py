"""Runtime wrapper for DB-backed custom skills."""

import logging
from typing import Optional

from langchain_core.tools import tool

from models.custom_skill import CustomSkill
from utils.custom_skill_indexer import search_custom_skill_chunks

logger = logging.getLogger(__name__)


class CustomDbSkill:
    """DB-backed custom skill with optional retrieval."""

    def __init__(self, skill: CustomSkill):
        self.skill_id = skill.id
        self.tool_name = skill.tool_name
        self._description = skill.description
        self._instructions = skill.instructions or ""
        self._meta_info = skill.meta_info or {}
        self._name = skill.tool_name

    @property
    def name(self) -> str:
        return self._name

    @property
    def description(self) -> str:
        return self._description

    def _needs_retrieval(self) -> bool:
        retrieval_flag = self._meta_info.get("retrieval_needed")
        if retrieval_flag is None:
            return bool(self._meta_info.get("vector_backend"))
        return bool(retrieval_flag)

    def get_tool(self):
        tool_name = self.name
        tool_description = self.description

        @tool(tool_name)
        def consult_custom_skill(query: str) -> str:
            """Consult a custom skill with optional retrieval."""
            if not self._instructions:
                return "Skill instructions are not available."

            if not self._needs_retrieval():
                return self._instructions

            try:
                chunks = search_custom_skill_chunks(self.skill_id, query, k=3)
            except Exception as exc:
                logger.error("Custom skill search failed: %s", exc)
                return f"{self._instructions}\n\nError searching skill materials: {exc}"

            if not chunks:
                return f"{self._instructions}\n\nNo relevant information found."

            results = "\n\n".join(
                f"--- Excerpt ---\n{chunk.content}" for chunk in chunks
            )
            return (
                f"{self._instructions}\n\n"
                f"--- Search Results for '{query}' ---\n"
                f"{results}"
            )

        consult_custom_skill.name = tool_name
        consult_custom_skill.description = tool_description
        return consult_custom_skill
