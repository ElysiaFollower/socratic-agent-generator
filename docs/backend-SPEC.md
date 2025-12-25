# 后端架构规范文档 (Backend Specification)

## 1. 概述

本系统是一个基于 FastAPI 的苏格拉底式 AI 导师后端服务，提供导师配置管理、学习会话管理和交互式对话功能。

### 1.1 技术栈

- **框架**: FastAPI 2.0+
- **Python版本**: 3.8+
- **LLM**: LangChain + DeepSeek Chat
- **数据存储**: JSON 文件系统存储
- **依赖注入**: FastAPI Depends

Google python style guide

### 1.2 项目结构

```
src/
├── app.py                 # FastAPI应用入口
├── main.py                # Profile生成CLI工具
├── config.py              # 配置管理
├── api/                   # API路由模块
│   └── routes/
│       ├── profile.py     # Profile管理路由
│       ├── session.py     # Session管理路由
│       ├── interaction.py # 交互路由
│       └── adapter.py     # OpenAI适配器路由
├── core/                  # 核心模块
│   ├── dependencies.py    # 依赖注入
│   ├── exceptions.py      # 异常定义
│   └── logging_config.py # 日志配置
├── generators/            # Profile生成器
│   ├── PersonaGenerator.py
│   ├── CurriculumGenerator.py
│   └── ProfileGenerateManager.py
├── schemas/               # 数据模型定义
│   ├── profile.py
│   ├── session.py
│   ├── message.py
│   └── curriculum.py
└── utils/                 # 工具模块
    ├── profile_manager.py # Profile管理器
    ├── session_manager.py # Session管理器
    ├── tutor_manager.py   # Tutor实例管理器
    └── tutor_core.py      # Tutor核心逻辑
```

## 2. 核心架构

### 2.1 应用初始化

应用入口位于 `src/app.py`，主要功能：

- 初始化 FastAPI 应用
- 配置 CORS 中间件
- 注册路由处理器
- 确保数据目录存在

```12:46:src/app.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.logging_config import setup_logging
from config import (
    CORS_ALLOWED_ORIGINS,
    API_HOST,
    API_PORT,
    PROFILES_DIR,
    SESSION_DATA_DIR,
)
from api.routes import profile, session, interaction, adapter

# Setup logging
setup_logging()

# Initialize FastAPI application
app = FastAPI(
    title="Socratic Agent API",
    description="后端API服务，用于驱动苏格拉底式AI导师前端。",
    version="2.0.0",
)

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure directories exist
PROFILES_DIR.mkdir(parents=True, exist_ok=True)
SESSION_DATA_DIR.mkdir(parents=True, exist_ok=True)

# Register route handlers
app.include_router(profile.router)
app.include_router(session.router)
app.include_router(interaction.router)
app.include_router(adapter.router)
```

### 2.2 配置管理

配置模块 `src/config.py` 管理所有配置项，支持环境变量覆盖：

- **目录配置**: 数据目录路径
- **API配置**: 服务器地址和端口
- **CORS配置**: 允许的跨域来源
- **LLM配置**: 温度、最大token数等

```12:31:src/config.py
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
```

### 2.3 依赖注入

使用 FastAPI 的依赖注入系统管理单例管理器实例：

```24:69:src/core/dependencies.py
def get_profile_manager() -> profile_manager.ProfileManager:
    """Get ProfileManager singleton instance.

    Returns:
        ProfileManager instance (singleton).
    """
    global _profile_manager_instance
    if _profile_manager_instance is None:
        _profile_manager_instance = profile_manager.ProfileManager()
    return _profile_manager_instance


def get_session_manager() -> session_manager.SessionManager:
    """Get SessionManager singleton instance.

    Returns:
        SessionManager instance (singleton).
    """
    global _session_manager_instance
    if _session_manager_instance is None:
        _session_manager_instance = session_manager.SessionManager()
    return _session_manager_instance


def get_tutor_manager() -> tutor_manager.TutorManager:
    """Get TutorManager singleton instance.

    Returns:
        TutorManager instance (singleton).
    """
    global _tutor_manager_instance
    if _tutor_manager_instance is None:
        _tutor_manager_instance = tutor_manager.TutorManager()
    return _tutor_manager_instance


# Type aliases for dependency injection
ProfileManagerDep = Annotated[
    profile_manager.ProfileManager, Depends(get_profile_manager)
]
SessionManagerDep = Annotated[
    session_manager.SessionManager, Depends(get_session_manager)
]
TutorManagerDep = Annotated[
    tutor_manager.TutorManager, Depends(get_tutor_manager)
]
```

## 3. 数据模型

### 3.1 Profile（导师配置）

Profile 包含一个导师的完整配置信息：

- `profile_id`: 唯一标识符（UUID）
- `profile_name`: 配置名称
- `topic_name`: 主题名称
- `persona_hints`: 人设提示列表
- `target_audience`: 目标受众
- `curriculum`: 教学大纲（SocraticCurriculum）
- `prompt_template`: 提示词模板
- `create_at`: 创建时间

**保存位置**: `data/tutor_profiles/{profile_id}.json`

### 3.2 Session（学习会话）

Session 表示一个学习会话实例：

- `session_id`: 唯一标识符（UUID，不可变）
- `session_name`: 会话名称
- `profile`: 关联的 Profile
- `state`: 会话状态（当前步骤索引）
- `create_at`: 创建时间
- `update_at`: 更新时间
- `output_language`: 输出语言
- `history`: 对话历史

**保存位置**: `data/session_data/{session_id}.json`

### 3.3 SessionState（会话状态）

- `stepIndex`: 当前步骤索引（从1开始）

## 4. 核心管理器

### 4.1 ProfileManager

负责 Profile 的持久化管理：

- `list_profiles()`: 列出所有可用的 Profile
- `read_profile(profile_id)`: 读取指定 Profile
- `save_profile(profile)`: 保存 Profile
- `delete_profile(profile_id)`: 删除 Profile

**数据存储**: `data/tutor_profiles/{profile_id}.json`

### 4.2 SessionManager

负责 Session 的持久化管理：

- `list_sessions()`: 列出所有会话摘要
- `read_session(session_id)`: 读取完整会话
- `create_session(profile, session_name, output_language)`: 创建新会话
- `save_session(session)`: 保存会话
- `rename_session(session_id, session_name)`: 重命名会话
- `delete_session(session_id)`: 删除会话

**数据存储**: `data/session_data/{session_id}.json`

### 4.3 TutorManager

管理内存中的 Tutor 实例缓存：

- `get_tutor(session_id)`: 获取或加载 Tutor 实例
- `create_tutor(profile, session_name, output_language)`: 创建新 Tutor
- `remove_from_cache(session_id)`: 从缓存移除

**缓存策略**: 首次访问时从磁盘加载，后续访问使用内存缓存

## 5. Tutor 核心逻辑

Tutor 类封装了苏格拉底式教学的核心逻辑：

- **对话管理**: 维护对话历史，支持历史截断
- **步骤推进**: 根据学生回答评估是否进入下一步
- **流式响应**: 支持 Server-Sent Events (SSE) 流式输出
- **状态持久化**: 自动保存会话状态到磁盘

### 5.1 评估机制

使用独立的评估器 LLM 判断学生回答是否满足成功标准：

```40:58:src/utils/tutor_core.py
# Evaluator prompt template - relatively simple and static
EVALUATOR_PROMPT_TEMPLATE = """
<TASK>
You are a strict, impartial assessment assistant. Your role is to determine if the <STUDENT'S RESPONSE> meets the <SUCCESS CRITERIA> for the given <TOPIC>.
You MUST and ONLY answer with a single word: 'Yes' or 'No'. Do not provide any explanation, punctuation, or additional text.
</TASK>

<TOPIC>
{step_title}
</TOPIC>

<SUCCESS CRITERIA>
{success_criteria}
</SUCCESS CRITERIA>

<STUDENT'S RESPONSE>
{user_input}
</STUDENT'S RESPONSE>
"""
```

## 6. 数据存储规范

### 6.1 Profile 存储

**目录**: `data/tutor_profiles/`

**文件命名**: `{profile_id}.json`

**文件结构**: 符合 `schemas.profile.Profile` 模型

**示例路径**: `data/tutor_profiles/example/profile_id.json`

### 6.2 Session 存储

**目录**: `data/session_data/`

**文件命名**: `{session_id}.json`

**文件结构**: 符合 `schemas.session.Session` 模型

### 6.3 原始数据存储

**目录**: `data_raw/{lab_name}/`

**文件**:
- `lab_manual.md`: 实验手册
- `definition.json`: Persona定义（可选）
- `curriculum.json`: 教学大纲（可选）

## 7. 错误处理

### 7.1 自定义异常

- `ProfileNotFoundError`: Profile 不存在
- `SessionNotFoundError`: Session 不存在

### 7.2 HTTP 状态码

- `200`: 成功
- `400`: 请求错误
- `404`: 资源未找到
- `500`: 服务器内部错误

## 8. 日志系统

使用 Python `logging` 模块，配置在 `core/logging_config.py` 中：

- 日志级别可通过环境变量配置
- 记录关键操作和错误信息
- 支持调试模式

## 9. 安全考虑

### 9.1 CORS 配置

默认允许本地开发地址，生产环境需通过环境变量配置：

```45:54:src/config.py
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
```

### 9.2 消息编码

用户消息使用 Base64 编码传输，防止特殊字符被误解：

```144:150:src/api/routes/interaction.py
    try:
        # Decode Base64 message
        decoded_message = base64.b64decode(req.message).decode("utf-8")
    except Exception as e:
        # If decoding fails, use original message as fallback
        logger.warning("Base64 decode failed: %s, using original message", e)
        decoded_message = req.message
```

## 10. 性能优化

### 10.1 缓存策略

- Tutor 实例在内存中缓存，减少磁盘 I/O
- 会话删除或重命名时自动清理缓存

### 10.2 历史截断

对话历史超过 `MAX_HISTORY_TOKENS` 时自动截断，保留最近的对话：

```82:88:src/utils/tutor_core.py
        self.history = self._restore_history_from_session()
        self.truncate_history_note = (
            f"History is truncated under max_history_tokens: "
            f"{MAX_HISTORY_TOKENS}"
        )
        # Lazy initialization to avoid initial delay
        self.current_history_tokens = None
        self.truncated_history = deepcopy(self.history)
```

## 11. 扩展性

### 11.1 添加新的路由

1. 在 `api/routes/` 创建新路由文件
2. 定义路由处理器
3. 在 `app.py` 中注册路由

### 11.2 添加新的数据模型

1. 在 `schemas/` 中定义 Pydantic 模型
2. 更新相关的 Manager 类
3. 更新 API 路由和响应模型

### 11.3 更换 LLM 提供商

修改 `config.py` 中的 `get_default_llm()` 函数，返回新的 LLM 实例。


