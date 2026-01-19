"""Skills module for Tutor.

This module provides tools/skills that the Tutor can use.
It implements the Anthropic 'Agent Skills' pattern where skills are defined
by filesystem directories containing `SKILL.md` files with metadata and instructions.
"""

import logging
import os
from pathlib import Path
from typing import Optional, Dict

import frontmatter
from langchain_community.vectorstores import FAISS
from langchain_core.embeddings import Embeddings
from langchain_core.tools import tool
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import MarkdownHeaderTextSplitter

from config import RAW_DATA_DIR, DATA_DIR, HF_MODELS_DIR

logger = logging.getLogger(__name__)

# Directory to store vector store indices
VECTOR_STORE_DIR = DATA_DIR / "vector_stores"
# Base directory for skills
SKILLS_DIR = DATA_DIR / "skills"


class BaseSkill:
    """Base class for Agent Skills defined by SKILL.md."""

    def __init__(self, skill_name: str):
        """Initialize the skill.

        Args:
            skill_name: The name of the directory in data/skills/
        """
        self.skill_dir = SKILLS_DIR / skill_name
        self.skill_file = self.skill_dir / "SKILL.md"
        self.metadata = {}
        self.instructions = ""
        self._load_skill_definition()

    def _load_skill_definition(self):
        """Load metadata and instructions from SKILL.md."""
        if not self.skill_file.exists():
            logger.warning("Skill file not found at %s", self.skill_file)
            return

        try:
            with open(self.skill_file, "r", encoding="utf-8") as f:
                post = frontmatter.load(f)
                self.metadata = post.metadata
                self.instructions = post.content
        except Exception as e:
            logger.error("Failed to load skill definition for %s: %s", self.skill_dir.name, e)

    @property
    def name(self) -> str:
        return self.metadata.get("name", "unknown_skill")

    @property
    def description(self) -> str:
        return self.metadata.get("description", "No description provided.")


class LabManualSkill(BaseSkill):
    """Skill for querying the lab manual using RAG.

    This skill acts as a technical expert that can be consulted by the Tutor
    to retrieve ground-truth information about the lab.
    """

    def __init__(self, topic_name: str, lab_name: Optional[str] = None):
        """Initialize the LabManualSkill.

        Args:
            topic_name: The name of the topic (used for display and fallback).
            lab_name: The lab manual directory name in data_raw.
        """
        super().__init__("lab_manual")
        self.topic_name = topic_name
        self.lab_name = lab_name or topic_name
        self.vector_store_path = (
            VECTOR_STORE_DIR / self.lab_name if self.lab_name else None
        )
        self.lab_manual_path = (
            RAW_DATA_DIR / self.lab_name / "lab_manual.md"
            if self.lab_name
            else None
        )
        self.embeddings = self._get_embeddings()
        self.vector_store = self._load_or_create_vector_store()

    def _get_embeddings(self) -> Embeddings:
        """Get the embeddings model."""
        # Use a small, efficient model suitable for CPU
        # Store models in project directory for transparency and portability
        model_cache_dir = str(HF_MODELS_DIR)
        HF_MODELS_DIR.mkdir(parents=True, exist_ok=True)
        
        return HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            cache_folder=model_cache_dir
        )

    def _load_or_create_vector_store(self) -> Optional[FAISS]:
        """Load the vector store if it exists, otherwise create it."""
        if not self.lab_name or not self.lab_manual_path:
            logger.warning("Lab name is not set; cannot load lab manual.")
            return None

        if not self.lab_manual_path.exists():
            logger.warning(
                "Lab manual not found for topic: %s at %s",
                self.lab_name,
                self.lab_manual_path,
            )
            return None

        if self.vector_store_path and self.vector_store_path.exists():
            try:
                logger.info(
                    "Loading vector store for lab: %s", self.lab_name
                )
                return FAISS.load_local(
                    str(self.vector_store_path),
                    self.embeddings,
                    allow_dangerous_deserialization=True
                )
            except Exception as e:
                logger.error(
                    "Failed to load vector store: %s. Recreating...", e
                )

        return self._create_vector_store()

    def _create_vector_store(self) -> Optional[FAISS]:
        """Create a new vector store from the lab manual."""
        if not self.lab_manual_path or not self.lab_manual_path.exists():
            return None

        logger.info("Creating vector store for lab: %s", self.lab_name)
        try:
            # Read the file directly to handle potential encoding issues or just use TextLoader
            with open(self.lab_manual_path, "r", encoding="utf-8") as f:
                text = f.read()

            # Split by markdown headers
            headers_to_split_on = [
                ("#", "Header 1"),
                ("##", "Header 2"),
                ("###", "Header 3"),
            ]
            markdown_splitter = MarkdownHeaderTextSplitter(
                headers_to_split_on=headers_to_split_on
            )
            docs = markdown_splitter.split_text(text)

            # Create vector store
            vector_store = FAISS.from_documents(docs, self.embeddings)

            # Save vector store
            if not self.vector_store_path:
                return None
            self.vector_store_path.parent.mkdir(parents=True, exist_ok=True)
            vector_store.save_local(str(self.vector_store_path))
            return vector_store

        except Exception as e:
            logger.error(
                "Failed to create vector store for topic %s: %s",
                self.lab_name,
                e,
            )
            return None

    def get_tool(self):
        """Get the LangChain tool for consulting the lab manual."""

        # Define tool using metadata from SKILL.md if available
        tool_name = self.name
        tool_description = self.description

        @tool(tool_name)
        def consult_lab_manual(query: str) -> str:
            # Use the docstring from SKILL.md description as a fallback or hint
            # But the @tool decorator uses the function's docstring for the LLM.
            # We can dynamically set it, but for simplicity, we keep the docstring here
            # and rely on the name/description passed to the tool constructor (via @tool or Tool class).
            # LangChain's @tool decorator usually takes the function name/docstring.
            # To use dynamic name/description, we need to return a StructuredTool.

            """
            Consult the official lab manual for technical details.
            """

            if not self.vector_store:
                return "The lab manual is not available for this topic."

            try:
                # Retrieve top 3 relevant chunks
                docs = self.vector_store.similarity_search(query, k=3)
                if not docs:
                    return "No relevant information found in the lab manual."

                search_results = "\n\n".join(
                    [f"--- Excerpt ---\n{doc.page_content}" for doc in docs]
                )

                # Combine instructions from SKILL.md with the results
                return (
                    f"{self.instructions}\n\n"
                    f"--- Search Results for '{query}' ---\n"
                    f"{search_results}"
                )
            except Exception as e:
                logger.error("Error searching lab manual: %s", e)
                return f"Error occurred while searching lab manual: {e}"

        # Override name/description
        consult_lab_manual.name = tool_name
        consult_lab_manual.description = tool_description

        return consult_lab_manual


def build_lab_manual_index(lab_name: str) -> bool:
    """Build or load a lab manual vector store for a given lab name."""
    try:
        skill = LabManualSkill(topic_name=lab_name, lab_name=lab_name)
        return skill.vector_store is not None
    except Exception as e:
        logger.error("Failed to build lab manual index for %s: %s", lab_name, e)
        return False


class PedagogicalStrategySkill(BaseSkill):
    """Skill for retrieving specialized teaching strategies."""

    def __init__(self):
        """Initialize the PedagogicalStrategySkill."""
        super().__init__("pedagogy")
        self.strategies_dir = self.skill_dir / "strategies"

    def get_tool(self):
        """Get the LangChain tool for consulting the pedagogy coach."""

        tool_name = self.name
        tool_description = self.description

        @tool(tool_name)
        def consult_pedagogy_coach(strategy_name: str) -> str:
            """
            Consult the Pedagogy Coach to get a specific teaching strategy script.
            """

            # Sanitize strategy name to prevent path traversal
            safe_name = os.path.basename(strategy_name)
            if not safe_name.endswith(".md"):
                safe_name += ".md"

            strategy_file = self.strategies_dir / safe_name

            if not strategy_file.exists():
                # List available strategies
                available = [f.stem for f in self.strategies_dir.glob("*.md")]
                return (
                    f"Strategy '{strategy_name}' not found. "
                    f"Available strategies: {', '.join(available)}"
                )

            try:
                with open(strategy_file, "r", encoding="utf-8") as f:
                    content = f.read()

                return (
                    f"{self.instructions}\n\n"
                    f"--- Strategy Content ---\n"
                    f"{content}"
                )
            except Exception as e:
                logger.error("Error reading strategy file: %s", e)
                return f"Error reading strategy: {e}"

        consult_pedagogy_coach.name = tool_name
        consult_pedagogy_coach.description = tool_description

        return consult_pedagogy_coach


class AssessmentSkill(BaseSkill):
    """Skill for assessing student progress and managing curriculum flow."""

    def __init__(self, session):
        """Initialize the AssessmentSkill.

        Args:
            session: The Tutor session object (mutable).
        """
        super().__init__("assessment")
        self.session = session

    def get_tool(self):
        """Get the tool for marking steps as complete."""

        tool_name = self.name
        tool_description = self.description

        @tool(tool_name)
        def complete_current_step(reason: str = "") -> str:
            """
            Mark the current learning step as complete.
            Call this tool when the student has satisfied the success criteria.
            """
            current_step_idx = self.session.state.stepIndex
            curriculum = self.session.get_curriculum()

            if current_step_idx > curriculum.get_len():
                return "The curriculum is already complete."

            # Advance step
            self.session.state.stepIndex += 1

            # Save session state
            # Note: The Tutor class usually saves after processing, but since this
            # changes state that might be relevant immediately, we rely on the object reference.
            # The Tutor's save() method will persist it to disk at the end of the turn.

            # Check if finished
            if self.session.state.stepIndex > curriculum.get_len():
                return (
                    "Step marked as complete.\n"
                    "CONGRATULATIONS: The student has completed the entire curriculum.\n"
                    "Wrap up the session."
                )

            # Get next step info
            next_step_title = curriculum.get_step_title(self.session.state.stepIndex)
            next_objective = curriculum.get_learning_objective(self.session.state.stepIndex)
            next_question = curriculum.get_guiding_question(self.session.state.stepIndex)

            return (
                f"Step {current_step_idx} marked as complete.\n"
                f"NEW STEP: {next_step_title}\n"
                f"OBJECTIVE: {next_objective}\n"
                f"GUIDING QUESTION: {next_question}\n\n"
                f"INSTRUCTIONS: Congratulate the student and proceed to the new step."
            )

        complete_current_step.name = tool_name
        complete_current_step.description = tool_description

        return complete_current_step
