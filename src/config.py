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


# --- API Server Config ---
API_HOST: str = os.getenv('API_HOST', '127.0.0.1')
API_PORT: int = int(os.getenv('API_PORT', '8000'))

# Allowed frontend origins to access the backend API
_cors_allowed_origins_str: str = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173')
CORS_ALLOWED_ORIGINS: list[str] = [origin.strip() for origin in _cors_allowed_origins_str.split(',') if origin.strip()]
# will be like this
# CORS_ALLOWED_ORIGINS = [
#     "http://localhost:5173",
#     "http://127.0.0.1:5173",
# ]

# --- Agent Config ---
LESSON_DOMAIN: str = os.getenv('LESSON_DOMAIN', '计算机安全')