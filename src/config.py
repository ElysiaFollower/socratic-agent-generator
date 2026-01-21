"""Configuration module for Socratic Agent Generator.

This module provides centralized configuration management, including directory
paths, API server settings, LLM configuration, and application defaults.
All configuration values can be overridden via environment variables.
"""

import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- Directory Configuration ---

# Root directory of the project
ROOT_DIR = Path(__file__).parent.parent.resolve()

# Data directory name
DATA_DIR_NAME = "data"
DATA_DIR = ROOT_DIR / DATA_DIR_NAME

# Documents directory (moved from data_raw to data/documents)
DOCUMENTS_DIR_NAME = "documents"
DOCUMENTS_DIR = DATA_DIR / DOCUMENTS_DIR_NAME

# Legacy: Keep RAW_DATA_DIR for backward compatibility, but point to new location
RAW_DATA_DIR = DOCUMENTS_DIR

# Generated tutor profiles directory name
PROFILES_DIR_NAME = "tutor_profiles"
PROFILES_DIR = DATA_DIR / PROFILES_DIR_NAME

# Session data directory name
SESSION_DATA_DIR_NAME = "session_data"
SESSION_DATA_DIR = DATA_DIR / SESSION_DATA_DIR_NAME

# Prompt templates directory name
PROMPT_TEMPLATE_DIR_NAME = "templates"
PROMPT_TEMPLATE_DIR = ROOT_DIR / "src" / PROMPT_TEMPLATE_DIR_NAME

# HuggingFace models cache directory (can be overridden via HF_MODELS_DIR env var)
# Models will be stored in project directory for transparency and portability
HF_MODELS_DIR_NAME = os.getenv("HF_MODELS_DIR", "models")
HF_MODELS_DIR = ROOT_DIR / HF_MODELS_DIR_NAME

# --- Model Configuration ---
# List of all HuggingFace models used in this project
# Format: {"model_name": "description"}
REQUIRED_MODELS: Dict[str, str] = {
    "sentence-transformers/all-MiniLM-L6-v2": "Embeddings model for RAG (Lab Manual Skill)",
}

# --- API Server Configuration ---

API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
API_PORT: int = int(os.getenv("API_PORT", "8000"))

# CORS allowed origins (comma-separated list)
# Default includes local development addresses. For production, set via
# CORS_ALLOWED_ORIGINS environment variable.
_CORS_ALLOWED_ORIGINS_STR: str = os.getenv(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,"
    "http://127.0.0.1:3000,http://0.0.0.0:5173",
)
CORS_ALLOWED_ORIGINS: List[str] = [
    origin.strip()
    for origin in _CORS_ALLOWED_ORIGINS_STR.split(",")
    if origin.strip()
]

# --- LLM Configuration ---

TEMPERATURE: float = float(os.getenv("TEMPERATURE", "0.7"))
MAX_INPUT_TOKENS: int = int(os.getenv("MAX_INPUT_TOKENS", "128000"))
MAX_HISTORY_TOKENS: int = int(os.getenv("MAX_HISTORY_TOKENS", "60000"))

# --- LangChain Agent Configuration ---

# Verbose mode for LangChain agents (set to "true" to enable verbose logging)
LANGCHAIN_VERBOSE: bool = os.getenv("LANGCHAIN_VERBOSE", "false").lower() == "true"

# Maximum iterations for LangChain agent executor
LANGCHAIN_MAX_ITERATIONS: int = int(os.getenv("LANGCHAIN_MAX_ITERATIONS", "3"))

# --- Evaluation Configuration ---

# Evaluation pass threshold (0.0-1.0). When evaluator output confidence >= this
# value, the step is considered passed.
EVALUATION_PASS_THRESHOLD: float = float(
    os.getenv("EVALUATION_PASS_THRESHOLD", "0.70")
)

# Fallback threshold (0.0-1.0). When evaluator output confidence < this value,
# use AssessmentSkill as fallback.
EVALUATION_FALLBACK_THRESHOLD: float = float(
    os.getenv("EVALUATION_FALLBACK_THRESHOLD", "0.50")
)

# Evaluator LLM temperature (recommended 0.1-0.3 for evaluation consistency).
EVALUATION_TEMPERATURE: float = float(
    os.getenv("EVALUATION_TEMPERATURE", "0.2")
)


def get_default_llm() -> Any:
    """Get the default LLM instance.

    Returns:
        An instance of ChatDeepSeek configured with default settings.

    Note:
        This function uses lazy import to avoid circular dependencies.
        The LLM is configured with the temperature from TEMPERATURE constant.
    """
    from langchain_deepseek import ChatDeepSeek

    return ChatDeepSeek(model="deepseek-chat", temperature=TEMPERATURE)


# --- Output Language Configuration ---

# Mapping of display names to LLM instruction strings
SUPPORTED_LANGUAGES: Dict[str, str] = {
    "简体中文": "Simplified Chinese",
    "English": "English",
}

# Default output language if none is specified by the user
DEFAULT_OUTPUT_LANGUAGE: str = "Simplified Chinese"

# --- Conversation Configuration ---

# Default session name if no name is specified
# If topic name is available, it will be used instead
DEFAULT_SESSION_NAME: str = "新会话"

# --- Authentication Configuration ---

# Admin token for admin registration (set via ADMIN_TOKEN environment variable)
ADMIN_TOKEN: Optional[str] = os.getenv("ADMIN_TOKEN")

# --- User Document Domain Configuration ---

# Vector store directory (defined in skills.py, but we need it here too)
VECTOR_STORE_DIR_NAME = "vector_stores"
VECTOR_STORE_DIR = DATA_DIR / VECTOR_STORE_DIR_NAME


def get_user_doc_dir(user_id: str) -> Path:
    """获取指定用户的文档目录"""
    return DOCUMENTS_DIR / user_id


def get_user_vector_store_dir(user_id: str) -> Path:
    """获取指定用户的向量存储目录"""
    return VECTOR_STORE_DIR / user_id