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

# Raw data directory name
RAW_DATA_DIR_NAME = "data_raw"
RAW_DATA_DIR = ROOT_DIR / RAW_DATA_DIR_NAME

# Data directory name
DATA_DIR_NAME = "data"
DATA_DIR = ROOT_DIR / DATA_DIR_NAME

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

# --- Agent Configuration ---

LESSON_DOMAIN: str = os.getenv("LESSON_DOMAIN", "计算机安全")

# --- LLM Configuration ---

TEMPERATURE: float = float(os.getenv("TEMPERATURE", "0.7"))
MAX_INPUT_TOKENS: int = int(os.getenv("MAX_INPUT_TOKENS", "128000"))
MAX_HISTORY_TOKENS: int = int(os.getenv("MAX_HISTORY_TOKENS", "60000"))


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