from pathlib import Path
import os

# root
ROOT_DIR = Path(__file__).parent.parent.resolve()

# Raw data
RAW_DATA_DIR_NAME = 'data_raw'
RAW_DATA_DIR = ROOT_DIR / RAW_DATA_DIR_NAME

# data folder
DATA_DIR_NAME = 'data'
DATA_DIR = ROOT_DIR / DATA_DIR_NAME

# generated tutor profiles
PROFILES_DIR_NAME = 'tutor_profiles'
PROFILES_DIR = DATA_DIR / PROFILES_DIR_NAME

# session data
SESSION_DATA_DIR_NAME = 'session_data'
SESSION_DATA_DIR = DATA_DIR / SESSION_DATA_DIR_NAME

# prompt templates
PROMPT_TEMPLATE_DIR_NAME = 'templates'
PROMPT_TEMPLATE_DIR = ROOT_DIR / 'src' / PROMPT_TEMPLATE_DIR_NAME


# --- API Server Config ---
API_HOST: str = os.getenv('API_HOST', '0.0.0.0')
API_PORT: int = int(os.getenv('API_PORT', '8000'))

# Allowed frontend origins to access the backend API
# 默认包含本地开发地址，生产环境请通过环境变量 CORS_ALLOWED_ORIGINS 设置您的域名
_cors_allowed_origins_str: str = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000,http://0.0.0.0:5173')
CORS_ALLOWED_ORIGINS: list[str] = [origin.strip() for origin in _cors_allowed_origins_str.split(',') if origin.strip()]
# will be like this
# CORS_ALLOWED_ORIGINS = [
#     "http://localhost:5173",
#     "http://127.0.0.1:5173",
# ]

# --- Agent Config ---
LESSON_DOMAIN: str = os.getenv('LESSON_DOMAIN', '计算机安全')

# --- LLM Config ---
TEMPERATURE: float = float(os.getenv('TEMPERATURE', '0.7'))
MAX_INPUT_TOKENS: int = int(os.getenv('MAX_INPUT_TOKENS', '128000'))
def get_default_llm():
    """DEFAULT_LLM"""
    from langchain_deepseek import ChatDeepSeek
    return ChatDeepSeek(model="deepseek-chat", temperature=TEMPERATURE)

# --- Output Language ---
# A list of supported languages. The key is what the user sees (e.g., in a dropdown),
# and the value is the precise instruction for the LLM.
SUPPORTED_LANGUAGES = {
    "简体中文": "Simplified Chinese",
    "English": "English"
}

# The default language to use if none is specified by the user.
DEFAULT_OUTPUT_LANGUAGE = "Simplified Chinese"


# --- Conversation Config ---
DEFAULT_SESSION_NAME = "新会话" # if no name is specified, try to use the topic name, if not available, use this