from pathlib import Path

# 项目根目录
PROJECT_ROOT = Path(__file__).parent.resolve()
# 导师配置文件的输出目录名
PROFILES_DIR_NAME = 'tutor-profiles'
# 导师配置文件输出路径
PROFILES_OUTPUT_PATH = PROJECT_ROOT / PROFILES_DIR_NAME

# 会话记录存储
SESSION_DATA_DIR_NAME = 'session_data'
SESSION_DATA_PATH = PROJECT_ROOT / 'data' /SESSION_DATA_DIR_NAME


# --- API Server Config ---
# 后端服务地址
API_HOST = "127.0.0.1"
API_PORT = 8000

# 允许访问后端API的前端地址
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]