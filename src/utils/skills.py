"""Skills module for Tutor.

This module provides tools/skills that the Tutor can use.
It implements the Anthropic 'Agent Skills' pattern where skills are defined
by filesystem directories containing `SKILL.md` files with metadata and instructions.
"""

import logging
import os
import threading
from pathlib import Path
from typing import Callable, Optional, Dict

import frontmatter
from langchain_community.vectorstores import FAISS
from langchain_core.embeddings import Embeddings
from langchain_core.tools import tool
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter

from config import RAW_DATA_DIR, DATA_DIR, HF_MODELS_DIR, DOCUMENTS_DIR, ROOT_DIR
from core.database import SessionLocal
from schemas.session import Session
from utils.document_manager import DocumentManager

logger = logging.getLogger(__name__)

# Cache shared embeddings to avoid reloading per Tutor instance.
_EMBEDDINGS_CACHE: Optional[Embeddings] = None
_EMBEDDINGS_LOCK = threading.Lock()


def _load_embeddings() -> Embeddings:
    """Load the embeddings model (shared across instances)."""
    model_cache_dir = str(HF_MODELS_DIR)
    HF_MODELS_DIR.mkdir(parents=True, exist_ok=True)
    return HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2",
        cache_folder=model_cache_dir,
    )


def warmup_embeddings() -> None:
    """Warm up the embeddings cache during application startup."""
    global _EMBEDDINGS_CACHE
    if _EMBEDDINGS_CACHE is not None:
        return
    with _EMBEDDINGS_LOCK:
        if _EMBEDDINGS_CACHE is None:
            _EMBEDDINGS_CACHE = _load_embeddings()


def get_shared_embeddings() -> Embeddings:
    """Get shared embeddings instance."""
    global _EMBEDDINGS_CACHE
    if _EMBEDDINGS_CACHE is None:
        with _EMBEDDINGS_LOCK:
            if _EMBEDDINGS_CACHE is None:
                _EMBEDDINGS_CACHE = _load_embeddings()
    return _EMBEDDINGS_CACHE

# Directory to store vector store indices
VECTOR_STORE_DIR = DATA_DIR / "vector_stores"
# Base directory for skills
SKILLS_DIR = DATA_DIR / "skills"


class BaseSkill:
    """Base class for Agent Skills defined by SKILL.md.

    Implements Progressive Disclosure pattern: metadata is always loaded,
    instructions are loaded on-demand to reduce token consumption.

    Attributes:
        skill_dir: Path to the skill directory.
        skill_file: Path to the SKILL.md file.
        metadata: Dictionary containing frontmatter metadata (always loaded).
        instructions: String containing the full instructions (loaded on-demand).
        _instructions_loaded: Boolean flag indicating if instructions have been loaded.
    """

    def __init__(self, skill_name: str, load_full_instructions: bool = False):
        """Initialize the skill.

        Args:
            skill_name: The name of the directory in data/skills/.
            load_full_instructions: If True, load full instructions immediately.
                Defaults to False for Progressive Disclosure.
        """
        self.skill_dir = SKILLS_DIR / skill_name
        self.skill_file = self.skill_dir / "SKILL.md"
        self.metadata = {}
        self.instructions = ""
        self._instructions_loaded = False
        
        # Always load metadata
        self._load_metadata()
        
        # Load instructions only if requested
        if load_full_instructions:
            self._load_instructions()

    def _load_metadata(self) -> None:
        """Load only frontmatter metadata from SKILL.md.
        
        This method implements Progressive Disclosure by loading only the
        minimal metadata needed for tool description, without loading the
        full instructions content.
        """
        if not self.skill_file.exists():
            logger.warning("Skill file not found at %s", self.skill_file)
            return

        try:
            with open(self.skill_file, "r", encoding="utf-8") as f:
                # Parse only frontmatter, not content
                metadata, _ = frontmatter.parse(f.read())
                self.metadata = metadata or {}
        except Exception as e:
            logger.error(
                "Failed to load skill metadata for %s: %s", 
                self.skill_dir.name, 
                e
            )
            self.metadata = {}

    def _load_instructions(self) -> None:
        """Load full instructions content from SKILL.md.
        
        This method loads the complete instructions when needed (e.g., when
        the tool is actually called). This implements Progressive Disclosure
        to reduce system prompt length.
        """
        if self._instructions_loaded:
            return
            
        if not self.skill_file.exists():
            logger.warning("Skill file not found at %s", self.skill_file)
            return

        try:
            with open(self.skill_file, "r", encoding="utf-8") as f:
                post = frontmatter.load(f)
                self.instructions = post.content
                self._instructions_loaded = True
        except Exception as e:
            logger.error(
                "Failed to load skill instructions for %s: %s",
                self.skill_dir.name,
                e,
            )
            self.instructions = ""

    @property
    def name(self) -> str:
        """Get the skill name from metadata.
        
        Returns:
            Skill name, or "unknown_skill" if not found.
        """
        return self.metadata.get("name", "unknown_skill")

    @property
    def description(self) -> str:
        """Get the skill description from metadata.
        
        Returns:
            Skill description, or default message if not found.
        """
        return self.metadata.get("description", "No description provided.")
    
    @property
    def version(self) -> str:
        """Get the skill version from metadata.
        
        Returns:
            Skill version, defaults to "1.0.0" if not specified.
        """
        return self.metadata.get("version", "1.0.0")
    
    @property
    def dependencies(self) -> Dict[str, str]:
        """Get the skill dependencies from metadata.
        
        Returns:
            Dictionary mapping dependency names to their types (e.g., "required").
        """
        deps = self.metadata.get("dependencies", {})
        if isinstance(deps, list):
            # Handle list format: [{"vector_store": "required"}]
            result = {}
            for item in deps:
                if isinstance(item, dict):
                    result.update(item)
            return result
        return deps if isinstance(deps, dict) else {}


class LabManualSkill(BaseSkill):
    """Skill for querying the lab manual using RAG.

    This skill acts as a technical expert that can be consulted by the Tutor
    to retrieve ground-truth information about the lab.
    """

    def __init__(self, topic_name: str, lab_name: Optional[str] = None):
        """Initialize the LabManualSkill.

        Args:
            topic_name: The name of the topic (used for display and fallback).
            lab_name: The lab manual directory name in data_raw (or doc_name in DB).
        """
        super().__init__("lab_manual")
        self.topic_name = topic_name
        self.lab_name = lab_name or topic_name
        self.embeddings = self._get_embeddings()

        # Resolve vector store path from DB
        self.vector_store_path = self._resolve_vector_store_path()
        self.vector_store = self._load_or_create_vector_store()

    def _get_embeddings(self) -> Embeddings:
        """Get the embeddings model."""
        global _EMBEDDINGS_CACHE
        if _EMBEDDINGS_CACHE is None:
            with _EMBEDDINGS_LOCK:
                if _EMBEDDINGS_CACHE is None:
                    _EMBEDDINGS_CACHE = _load_embeddings()
        return _EMBEDDINGS_CACHE

    def _resolve_vector_store_path(self) -> Optional[Path]:
        """Resolve vector store path using DocumentManager."""
        if not self.lab_name:
            return None

        with SessionLocal() as db:
            dm = DocumentManager(db)
            # ✅ 注意：lab_name现在可能不是全局唯一的
            # 如果有多个同名文档，get_document_by_name会返回第一个
            # 理想情况下应该通过Profile的document_id来查找，但这里保持向后兼容
            doc = dm.get_document_by_name(self.lab_name)
            if doc and doc.index_path:
                index_path = Path(doc.index_path)
                if not index_path.is_absolute():
                    # 如果是相对路径，尝试相对于项目根目录
                    index_path = ROOT_DIR / index_path
                return index_path

        # Fallback to default convention if not in DB or index_path not set
        # This allows backward compatibility or auto-healing
        # ⚠️ 注意：这个fallback可能不准确，因为lab_name不再是全局唯一的
        return VECTOR_STORE_DIR / self.lab_name

    def _load_or_create_vector_store(self) -> Optional[FAISS]:
        """Load the vector store if it exists, otherwise create it."""
        if not self.lab_name:
            logger.warning("Lab name is not set; cannot load lab manual.")
            return None

        # Check if vector store exists at resolved path
        if self.vector_store_path and self.vector_store_path.exists():
            try:
                logger.info(
                    "Loading vector store for lab: %s from %s", self.lab_name, self.vector_store_path
                )
                vector_store = FAISS.load_local(
                    str(self.vector_store_path),
                    self.embeddings,
                    allow_dangerous_deserialization=True
                )
                return vector_store
            except Exception as e:
                logger.error(
                    "Failed to load vector store: %s. Recreating...", e
                )

        return self._create_vector_store()

    def _create_vector_store(self) -> Optional[FAISS]:
        """Create a new vector store from the lab manual."""
        # Need to find lab manual file.
        # Ideally query DB, but for now check default location or DB

        lab_manual_path = None
        original_format = None
        
        with SessionLocal() as db:
            dm = DocumentManager(db)
            doc = dm.get_document_by_name(self.lab_name)
            if doc and doc.storage_path:
                lab_manual_path = Path(doc.storage_path)
                if not lab_manual_path.is_absolute():
                    # ✅ 如果是相对路径，尝试相对于项目根目录
                    lab_manual_path = ROOT_DIR / lab_manual_path
                original_format = doc.meta_info.get("original_format") if doc.meta_info else None

        # Fallback (⚠️ 注意：这个fallback可能不准确，因为lab_name不再是全局唯一的)
        if not lab_manual_path or not lab_manual_path.exists():
             lab_manual_path = DOCUMENTS_DIR / self.lab_name / "lab_manual.md"

        if not lab_manual_path.exists():
            logger.warning("Lab manual file not found: %s", lab_manual_path)
            return None

        logger.info("Creating vector store for lab: %s", self.lab_name)
        try:
            with open(lab_manual_path, "r", encoding="utf-8") as f:
                text = f.read()

            # 根据原始格式选择分割策略
            if original_format == "pdf":
                # PDF使用通用文本分割器
                splitter = RecursiveCharacterTextSplitter(
                    chunk_size=1500,
                    chunk_overlap=200,
                    separators=["\n\n", "\n", "。", ".", " "],
                    length_function=len,
                )
                docs = splitter.create_documents([text])
                logger.info(
                    "Using RecursiveCharacterTextSplitter for PDF: %d chunks created",
                    len(docs)
                )
            else:
                # Markdown使用标题分割器
                headers_to_split_on = [
                    ("#", "Header 1"),
                    ("##", "Header 2"),
                    ("###", "Header 3"),
                ]
                markdown_splitter = MarkdownHeaderTextSplitter(
                    headers_to_split_on=headers_to_split_on
                )
                docs = markdown_splitter.split_text(text)
                logger.info(
                    "Using MarkdownHeaderTextSplitter: %d chunks created",
                    len(docs)
                )

            if not docs:
                logger.warning("No documents created from text splitting")
                return None

            vector_store = FAISS.from_documents(docs, self.embeddings)

            # Save vector store
            save_path = self.vector_store_path or (VECTOR_STORE_DIR / self.lab_name)
            save_path.mkdir(parents=True, exist_ok=True)
            vector_store.save_local(str(save_path))

            # Update DB with index path
            with SessionLocal() as db:
                dm = DocumentManager(db)
                # Ensure doc exists
                doc = dm.get_document_by_name(self.lab_name)
                if not doc:
                     # Create if missing (auto-registration)
                     doc = dm.create_document(
                         doc_name=self.lab_name,
                         filename=lab_manual_path.name,
                         storage_path=str(lab_manual_path)
                     )

                dm.update_index_path(self.lab_name, str(save_path))

            return vector_store

        except Exception as e:
            logger.error(
                "Failed to create vector store for topic %s: %s",
                self.lab_name,
                e,
                exc_info=True
            )
            return None

    def get_tool(self):
        """Get the LangChain tool for consulting the lab manual.
        
        Returns:
            LangChain tool function for lab manual consultation.
        """
        # Load instructions when tool is created (on-demand)
        self._load_instructions()
        
        tool_name = self.name
        tool_description = self.description

        @tool(tool_name)
        def consult_lab_manual(query: str) -> str:
            """Consult the official lab manual for technical details.
            
            Args:
                query: The search query for lab manual content.
                
            Returns:
                Search results from the lab manual or error message.
            """
            if not self.vector_store:
                return "The lab manual is not available for this topic."

            try:
                docs = self.vector_store.similarity_search(query, k=3)
                if not docs:
                    return "No relevant information found in the lab manual."

                search_results = "\n\n".join(
                    [f"--- Excerpt ---\n{doc.page_content}" for doc in docs]
                )

                return (
                    f"{self.instructions}\n\n"
                    f"--- Search Results for '{query}' ---\n"
                    f"{search_results}"
                )
            except Exception as e:
                logger.error("Error searching lab manual: %s", e)
                return f"Error occurred while searching lab manual: {e}"

        consult_lab_manual.name = tool_name
        consult_lab_manual.description = tool_description

        return consult_lab_manual


def build_lab_manual_index(owner_id: str, lab_name: str) -> bool:
    """Build or load a lab manual vector store for a given owner and lab name.
    
    Args:
        owner_id: The owner's user ID
        lab_name: The lab manual name (doc_name)
    """
    try:
        skill = LabManualSkill(topic_name=lab_name, lab_name=lab_name)
        # Force recreation if needed?
        # The constructor calls _load_or_create. If it exists, it loads.
        # If we want to rebuild, we might need a force flag, but for now "ensure exists" is fine.
        return skill.vector_store is not None
    except Exception as e:
        logger.error("Failed to build lab manual index for %s/%s: %s", owner_id, lab_name, e)
        return False


class PedagogicalStrategySkill(BaseSkill):
    """Skill for retrieving specialized teaching strategies."""

    def __init__(self):
        """Initialize the PedagogicalStrategySkill."""
        super().__init__("pedagogy")
        self.strategies_dir = self.skill_dir / "strategies"

    def get_tool(self):
        """Get the LangChain tool for consulting the pedagogy coach.
        
        Returns:
            LangChain tool function for pedagogy strategy consultation.
        """
        # Load instructions when tool is created (on-demand)
        self._load_instructions()
        
        tool_name = self.name
        tool_description = self.description

        @tool(tool_name)
        def consult_pedagogy_coach(strategy_name: str) -> str:
            """Consult the Pedagogy Coach to get a specific teaching strategy script.
            
            Args:
                strategy_name: Name of the strategy to retrieve (e.g., "conceptual_analogy").
                
            Returns:
                Strategy content or error message if not found.
            """
            safe_name = os.path.basename(strategy_name)
            if not safe_name.endswith(".md"):
                safe_name += ".md"

            strategy_file = self.strategies_dir / safe_name

            if not strategy_file.exists():
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
    """Skill for assessing student progress and providing guidance.

    This skill helps the main LLM understand the student's learning state
    and provides information about the next step, but does NOT advance
    the step. Step advancement is controlled exclusively by StepEvaluator.
    """

    def __init__(self, session: Session) -> None:
        """Initialize the AssessmentSkill.

        Args:
            session: The Tutor session object (read-only for assessment).
        """
        super().__init__("assessment")
        self.session = session

    def get_tool(self) -> Callable:
        """Get the tool for assessing student progress.

        Returns:
            LangChain tool function for student assessment.
        """
        # Load instructions when tool is created (on-demand)
        self._load_instructions()
        
        tool_name = self.name
        tool_description = self.description

        @tool(tool_name)
        def assess_student_progress(reason: str = "") -> str:
            """Assess student progress and provide next step information.

            This tool evaluates the student's current learning state against
            the success criteria and provides information about the next step.
            It does NOT advance the step - step advancement is controlled
            exclusively by StepEvaluator.

            Args:
                reason: Optional reason for the assessment (for logging).

            Returns:
                Assessment result and next step information. The format is:
                - Current step assessment
                - Whether student meets success criteria (informational only)
                - Next step title, objective, and guiding question
                - Instructions on how to guide the student
            """
            current_step_idx = self.session.state.stepIndex
            curriculum = self.session.get_curriculum()

            if current_step_idx > curriculum.get_len():
                return "The curriculum is already complete."

            # Get current step info
            current_step_title = curriculum.get_step_title(current_step_idx)
            current_objective = curriculum.get_learning_objective(current_step_idx)
            current_criteria = curriculum.get_success_criteria(current_step_idx)

            # Get next step info (for reference, not advancing)
            next_step_idx = current_step_idx + 1
            if next_step_idx > curriculum.get_len():
                return (
                    f"ASSESSMENT: Current Step {current_step_idx}\n"
                    f"Title: {current_step_title}\n"
                    f"Objective: {current_objective}\n"
                    f"Success Criteria: {current_criteria}\n\n"
                    "The student is on the final step. Once they meet the "
                    "success criteria, the curriculum will be complete."
                )

            next_step_title = curriculum.get_step_title(next_step_idx)
            next_objective = curriculum.get_learning_objective(next_step_idx)
            next_question = curriculum.get_guiding_question(next_step_idx)

            return (
                f"ASSESSMENT: Current Step {current_step_idx}\n"
                f"Title: {current_step_title}\n"
                f"Objective: {current_objective}\n"
                f"Success Criteria: {current_criteria}\n\n"
                f"NEXT STEP INFORMATION (for reference only):\n"
                f"Step {next_step_idx}: {next_step_title}\n"
                f"Objective: {next_objective}\n"
                f"Guiding Question: {next_question}\n\n"
                f"INSTRUCTIONS: Continue guiding the student toward meeting "
                f"the current step's success criteria. When the evaluator "
                f"determines the criteria are met, the step will advance "
                f"automatically."
            )

        assess_student_progress.name = tool_name
        assess_student_progress.description = tool_description

        return assess_student_progress
