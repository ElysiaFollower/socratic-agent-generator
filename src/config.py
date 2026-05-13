"""Configuration module for Socratic Agent Generator.

This module provides centralized configuration management, including directory
paths, API server settings, LLM configuration, and application defaults.
All configuration values can be overridden via environment variables.
"""

import os
import sys
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

# Session-scoped uploaded files and lab setup cache.
SESSION_FILES_DIR_NAME = "session_files"
SESSION_FILES_DIR = DATA_DIR / SESSION_FILES_DIR_NAME
SESSION_FILE_MAX_BYTES: int = int(os.getenv("SESSION_FILE_MAX_BYTES", "20971520"))

# Prompt templates directory name
PROMPT_TEMPLATE_DIR_NAME = "templates"
PROMPT_TEMPLATE_DIR = ROOT_DIR / "src" / PROMPT_TEMPLATE_DIR_NAME

# HuggingFace models cache directory. This is only used when
# EMBEDDING_PROVIDER="huggingface"; the default deployment uses Volcengine Ark.
HF_MODELS_DIR_NAME = os.getenv("HF_MODELS_DIR", "models")
HF_MODELS_DIR = ROOT_DIR / HF_MODELS_DIR_NAME

# --- Model Configuration ---
EMBEDDING_PROVIDER: str = os.getenv("EMBEDDING_PROVIDER", "volcengine").strip().lower()
EMBEDDING_REQUEST_TIMEOUT: int = int(
    os.getenv("EMBEDDING_REQUEST_TIMEOUT", os.getenv("OLLAMA_REQUEST_TIMEOUT", "60"))
)
VOLCENGINE_API_KEY: Optional[str] = os.getenv("VOLCENGINE_API_KEY") or os.getenv("ARK_API_KEY")
VOLCENGINE_EMBEDDING_BASE_URL: str = os.getenv(
    "VOLCENGINE_EMBEDDING_BASE_URL",
    os.getenv("ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3"),
).rstrip("/")
VOLCENGINE_EMBEDDING_MODEL: str = os.getenv(
    "VOLCENGINE_EMBEDDING_MODEL",
    os.getenv("EMBEDDING_MODEL_NAME", "doubao-embedding-text-240515"),
)
HUGGINGFACE_EMBEDDING_MODEL: str = os.getenv(
    "HUGGINGFACE_EMBEDDING_MODEL",
    "sentence-transformers/all-MiniLM-L6-v2",
)

# List of all HuggingFace models used in this project
# Format: {"model_name": "description"}
REQUIRED_MODELS: Dict[str, str] = {
    HUGGINGFACE_EMBEDDING_MODEL: "Embeddings model for RAG (Lab Manual Skill)",
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

# Default provider if user has no preference set
DEFAULT_LLM_PROVIDER: str = os.getenv("DEFAULT_LLM_PROVIDER", "deepseek")

# Provider registry for OpenAI-compatible endpoints
LLM_PROVIDERS: Dict[str, Dict[str, Optional[str]]] = {
    "deepseek": {
        "display_name": "DeepSeek",
        "base_url": "https://api.deepseek.com",
        "default_model": "deepseek-chat",
        "env_key": "DEEPSEEK_API_KEY",
    },
    "gemini": {
        "display_name": "Google Gemini",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "default_model": "gemini-2.5-flash",
        "env_key": "GOOGLE_API_KEY",
    },
    "openai": {
        "display_name": "OpenAI",
        "base_url": None,
        "default_model": "gpt-4o",
        "env_key": "OPENAI_API_KEY",
    },
    "glm": {
        "display_name": "GLM",
        "base_url": "https://open.bigmodel.cn/api/paas/v4/",
        "default_model": "glm-4.7",
        "env_key": "GLM_API_KEY",
    },
    "minimax": {
        "display_name": "MiniMax",
        "base_url": "https://api.minimax.io/v1",
        "default_model": "abab6.5s-chat",
        "env_key": "MINIMAX_API_KEY",
    },
}

# --- LangChain Agent Configuration ---

# Verbose mode for LangChain agents (set to "true" to enable verbose logging)
LANGCHAIN_VERBOSE: bool = os.getenv("LANGCHAIN_VERBOSE", "false").lower() == "true"

# Maximum iterations for LangChain agent executor.
# Keep a floor above the common "look up -> narrow search -> answer" pattern
# so the tutor can finish one tool-heavy turn instead of stopping early.
LANGCHAIN_MAX_ITERATIONS: int = max(
    int(os.getenv("LANGCHAIN_MAX_ITERATIONS", "4")),
    1,
)

# --- Evaluation Configuration ---

# Evaluation pass threshold (0.0-1.0). When evaluator output confidence >= this
# value, the step is considered passed.
EVALUATION_PASS_THRESHOLD: float = float(
    os.getenv("EVALUATION_PASS_THRESHOLD", "0.70")
)

# Fallback threshold (0.0-1.0). When evaluator output confidence < this value,
# return conservative result (confidence=0.0) and do not advance the step.
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

# --- DreamingRAG Memory Adapter Configuration ---

_BOOL_TRUE_VALUES = {"1", "true", "yes", "on"}


def _env_bool(name: str, default: str = "false") -> bool:
    """Read a boolean flag from environment variables."""
    return os.getenv(name, default).strip().lower() in _BOOL_TRUE_VALUES


def _env_list(name: str, default: str = "") -> List[str]:
    """Read a comma-separated list from environment variables."""
    value = os.getenv(name, default)
    return [item.strip() for item in value.split(",") if item.strip()]


_default_dreamingrag_repo = ROOT_DIR.parent / "DreamingRAG"

# Enabled by default because Tutor needs persistent long-term memory for
# realistic long conversations. The adapter still falls back to NullMemoryProvider
# when DreamingRAG is unavailable or not installed.
DREAMINGRAG_MEMORY_ENABLED: bool = _env_bool("DREAMINGRAG_MEMORY_ENABLED", "true")
DREAMINGRAG_REPO_PATH: Optional[str] = os.getenv(
    "DREAMINGRAG_REPO_PATH",
    str(_default_dreamingrag_repo) if _default_dreamingrag_repo.exists() else "",
)
DREAMINGRAG_MEMORY_STORAGE_DIR_NAME = "dreamingrag_memory"
DREAMINGRAG_MEMORY_STORAGE_DIR = DATA_DIR / DREAMINGRAG_MEMORY_STORAGE_DIR_NAME
DREAMINGRAG_MEMORY_MOCK_MODE: bool = _env_bool("DREAMINGRAG_MEMORY_MOCK_MODE")
DREAMINGRAG_MEMORY_ENABLE_CUE_RECALL: bool = _env_bool(
    "DREAMINGRAG_MEMORY_ENABLE_CUE_RECALL",
    "true",
)
DREAMINGRAG_MEMORY_TOP_N: int = int(os.getenv("DREAMINGRAG_MEMORY_TOP_N", "3"))
DREAMINGRAG_MEMORY_CONTEXT_CHARS: int = int(
    os.getenv("DREAMINGRAG_MEMORY_CONTEXT_CHARS", "2000")
)

# --- Remote Runner Tool Adapter Configuration ---

_default_remote_runner_repo = ROOT_DIR.parent / "SEEDRunner"

REMOTE_TOOL_ENABLED: bool = _env_bool("REMOTE_TOOL_ENABLED")
REMOTE_RUNNER_REPO_PATH: Optional[str] = os.getenv(
    "REMOTE_RUNNER_REPO_PATH",
    str(_default_remote_runner_repo) if _default_remote_runner_repo.exists() else "",
)
REMOTE_RUNNER_PYTHON_EXECUTABLE: str = (
    os.getenv("REMOTE_RUNNER_PYTHON_EXECUTABLE") or sys.executable
)
REMOTE_RUNNER_STATE_DIR: Optional[str] = os.getenv("REMOTE_RUNNER_STATE_DIR", "")
REMOTE_TOOL_COMMAND_TIMEOUT: int = int(os.getenv("REMOTE_TOOL_COMMAND_TIMEOUT", "20"))
REMOTE_TOOL_AGENT_IDLE_TIMEOUT: int = int(
    os.getenv("REMOTE_TOOL_AGENT_IDLE_TIMEOUT", "15")
)
REMOTE_TOOL_OUTPUT_CHARS: int = int(os.getenv("REMOTE_TOOL_OUTPUT_CHARS", "4000"))
REMOTE_TOOL_ALLOWED_MACHINE_IDS: List[str] = _env_list(
    "REMOTE_TOOL_ALLOWED_MACHINE_IDS"
)
REMOTE_TOOL_ALLOWED_CWD_PREFIXES: List[str] = _env_list(
    "REMOTE_TOOL_ALLOWED_CWD_PREFIXES"
)
REMOTE_TOOL_ALLOWED_COMMANDS: List[str] = _env_list(
    "REMOTE_TOOL_ALLOWED_COMMANDS",
    (
        "pwd,ls,ls -la,whoami,hostname,uname -a,id,ip addr,ip route,"
        "ifconfig,cat /etc/os-release,python --version,python3 --version"
    ),
)
REMOTE_TOOL_ALLOWED_COMMAND_PREFIXES: List[str] = _env_list(
    "REMOTE_TOOL_ALLOWED_COMMAND_PREFIXES",
    "ls ,cat ,ip ,docker ps,docker exec,docker network inspect,docker compose ps,python ,python3 ,ping ",
)
REMOTE_MACHINE_SECRET_KEY: Optional[str] = os.getenv(
    "REMOTE_MACHINE_SECRET_KEY",
    os.getenv("LLM_API_KEY_ENCRYPTION_KEY"),
)


def get_user_doc_dir(user_id: str) -> Path:
    """获取指定用户的文档目录"""
    return DOCUMENTS_DIR / user_id


def get_user_vector_store_dir(user_id: str) -> Path:
    """获取指定用户的向量存储目录"""
    return VECTOR_STORE_DIR / user_id
