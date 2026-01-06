"""Skills module for Tutor.

This module provides tools/skills that the Tutor can use.
The primary skill currently implemented is the 'Technical Documentation Expert',
which allows the Tutor to consult the lab manual for specific technical details,
instructions, and definitions.
"""

import logging
from pathlib import Path
from typing import Optional

from langchain_community.vectorstores import FAISS
from langchain_core.embeddings import Embeddings
from langchain_core.tools import tool
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import MarkdownHeaderTextSplitter
import yaml

from config import RAW_DATA_DIR, DATA_DIR

logger = logging.getLogger(__name__)

# Directory to store vector store indices
VECTOR_STORE_DIR = DATA_DIR / "vector_stores"
# Directory for pedagogical strategies
STRATEGIES_FILE = DATA_DIR / "strategies" / "pedagogical_patterns.yaml"


class LabManualSkill:
    """Skill for querying the lab manual using RAG.

    This skill acts as a technical expert that can be consulted by the Tutor
    to retrieve ground-truth information about the lab.
    """

    def __init__(self, topic_name: str):
        """Initialize the LabManualSkill.

        Args:
            topic_name: The name of the topic (corresponds to directory in data_raw).
        """
        self.topic_name = topic_name
        self.vector_store_path = VECTOR_STORE_DIR / topic_name
        self.lab_manual_path = RAW_DATA_DIR / topic_name / "lab_manual.md"
        self.embeddings = self._get_embeddings()
        self.vector_store = self._load_or_create_vector_store()

    def _get_embeddings(self) -> Embeddings:
        """Get the embeddings model."""
        # Use a small, efficient model suitable for CPU
        return HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )

    def _load_or_create_vector_store(self) -> Optional[FAISS]:
        """Load the vector store if it exists, otherwise create it."""
        if not self.lab_manual_path.exists():
            logger.warning(
                "Lab manual not found for topic: %s at %s",
                self.topic_name,
                self.lab_manual_path,
            )
            return None

        if self.vector_store_path.exists():
            try:
                logger.info(
                    "Loading vector store for topic: %s", self.topic_name
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
        if not self.lab_manual_path.exists():
            return None

        logger.info("Creating vector store for topic: %s", self.topic_name)
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
            self.vector_store_path.parent.mkdir(parents=True, exist_ok=True)
            vector_store.save_local(str(self.vector_store_path))
            return vector_store

        except Exception as e:
            logger.error(
                "Failed to create vector store for topic %s: %s",
                self.topic_name,
                e,
            )
            return None

    def get_tool(self):
        """Get the LangChain tool for consulting the lab manual."""

        @tool
        def consult_lab_manual(query: str) -> str:
            """
            Consult the official lab manual to find specific technical details, definitions,
            step-by-step instructions, or command syntax.

            Use this tool when:
            1. You need to verify specific commands, file paths, or IP addresses mentioned in the lab.
            2. The student asks for a definition or explanation of a technical concept covered in the manual.
            3. You want to check the expected output of a step to guide the student correctly.

            Do not guess. If you are unsure about a specific lab detail, use this tool to check.
            """
            if not self.vector_store:
                return "The lab manual is not available for this topic."

            try:
                # Retrieve top 3 relevant chunks
                docs = self.vector_store.similarity_search(query, k=3)
                if not docs:
                    return "No relevant information found in the lab manual."

                result = "\n\n".join(
                    [f"--- Excerpt from Lab Manual ---\n{doc.page_content}" for doc in docs]
                )
                return result
            except Exception as e:
                logger.error("Error searching lab manual: %s", e)
                return f"Error occurred while searching lab manual: {e}"

        return consult_lab_manual


class PedagogicalStrategySkill:
    """Skill for retrieving specialized teaching strategies.

    This skill acts as a 'Pedagogy Coach' that provides the Tutor with
    structured scripts or patterns for handling specific teaching situations
    (e.g., explaining complex concepts via analogy, conducting deep-dive debugging).
    """

    def __init__(self):
        """Initialize the PedagogicalStrategySkill."""
        self.strategies = self._load_strategies()

    def _load_strategies(self) -> dict:
        """Load teaching strategies from the YAML file."""
        if not STRATEGIES_FILE.exists():
            logger.warning("Pedagogical strategies file not found at %s", STRATEGIES_FILE)
            return {}

        try:
            with open(STRATEGIES_FILE, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
                # Convert list to dict for easier lookup
                return {item["name"]: item for item in data}
        except Exception as e:
            logger.error("Failed to load pedagogical strategies: %s", e)
            return {}

    def get_tool(self):
        """Get the LangChain tool for consulting the pedagogy coach."""

        @tool
        def consult_pedagogy_coach(strategy_name: str) -> str:
            """
            Consult the Pedagogy Coach to get a specific teaching strategy script.

            Available strategies:
            - 'conceptual_analogy': Use when a student struggles with an abstract concept. Returns instructions on how to build a relevant analogy.
            - 'debugging_checklist': Use when a student is stuck finding a bug. Returns a systematic checklist to guide the student (without giving the answer).
            - 'socratic_deep_dive': Use when a student gives a correct but shallow answer. Returns questions to probe for deeper understanding.

            Args:
                strategy_name: The name of the strategy to retrieve (e.g., 'conceptual_analogy').

            Returns:
                Detailed instructions and examples for applying the chosen strategy.
            """
            strategy = self.strategies.get(strategy_name)
            if not strategy:
                valid_names = ", ".join(self.strategies.keys())
                return f"Strategy '{strategy_name}' not found. Available strategies: {valid_names}"

            return (
                f"--- Strategy: {strategy['name']} ---\n"
                f"Description: {strategy['description']}\n\n"
                f"INSTRUCTIONS FOR THE AGENT:\n{strategy['instructions']}"
            )

        return consult_pedagogy_coach
