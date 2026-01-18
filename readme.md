# Socratic Agent Generator

**Socratic Agent Generator** 是一个基于苏格拉底式教学法的智能导师系统，能够自动将技术实验手册转换为个性化的 AI 导师，并通过交互式 Web 界面提供循序渐进的对话式学习体验。

## 📖 项目简介

### 核心价值

传统的技术教学往往采用"填鸭式"的方式直接给出答案和步骤，学生缺乏主动思考的机会。本项目通过苏格拉底式教学法，让 AI 导师以**启发式提问**的方式引导学生自主探索和理解知识，从而实现更深层次的学习效果。

### 解决的问题

1. **自动化导师生成**：从任意技术实验手册自动生成结构化的教学大纲和导师配置
2. **个性化学习路径**：根据学生的回答动态调整教学节奏，确保每个学习节点都被充分理解
3. **可扩展性**：支持多个课程主题，每个主题都有独立的导师配置和教学大纲
4. **交互式学习**：提供现代化的 Web 界面，支持实时对话和学习进度跟踪

## ✨ 核心特性

- 🤖 **智能导师生成**：基于 LLM 从实验手册自动生成苏格拉底式教学大纲和导师人格
- 🎯 **循序渐进教学**：AI 导师根据教学大纲，通过启发式提问引导学生逐步完成学习目标
- 🌐 **现代化 Web 界面**：React + TypeScript 前端，支持多会话管理和实时流式对话
- 📊 **学习进度跟踪**：可视化展示当前学习进度和步骤目标
- 🔄 **流式响应**：支持 Server-Sent Events (SSE) 流式输出，提供流畅的对话体验
- 💾 **会话持久化**：自动保存学习会话，支持随时恢复学习进度
- 🔌 **OpenAI 兼容接口**：提供 OpenAI API 格式的适配器，方便集成到其他应用

## 🏗️ 系统架构

本项目采用前后端分离架构：

### 后端服务 (`src/`)

基于 **Python + FastAPI + LangChain** 构建，提供以下核心功能：

1. **导师配置生成器** (`generators/`)
   - `CurriculumGenerator`：两阶段生成教学大纲（文档结构化 → 苏格拉底式转化）
   - `PersonaGenerator`：自动推断导师人格、目标受众和教学约束
   - `ProfileGenerateManager`：统一管理配置生成流程

2. **苏格拉底智能体核心** (`utils/tutor_core.py`)
   - 基于 LangChain 实现的对话式导师
   - 动态提示词组装（根据当前学习步骤）
   - 对话历史管理和 Token 截断
   - 流式和同步两种消息处理模式

3. **RESTful API** (模块化路由架构)
   - `api/routes/profile.py`：Profile 管理（列出、读取导师配置）
   - `api/routes/session.py`：Session 管理（创建、删除、重命名学习会话）
   - `api/routes/interaction.py`：交互接口（流式消息发送、状态查询、欢迎消息）
   - `api/routes/adapter.py`：OpenAI 适配器（兼容 OpenAI API 格式的聊天接口）
   - `core/dependencies.py`：依赖注入系统（单例模式确保缓存一致性）
   - `core/exceptions.py`：统一异常处理
   - `core/logging_config.py`：集中式日志配置

4. **数据管理** (`utils/`)
   - `profile_manager.py`：导师配置文件的读写和缓存
   - `session_manager.py`：学习会话的持久化和元数据管理
   - `tutor_manager.py`：活跃导师实例的内存缓存
   - `tutor_core.py`：苏格拉底智能体核心逻辑

### 前端服务 (`frontend/`)

基于 **React + TypeScript + Vite + Tailwind CSS** 构建，提供：

- **导师选择界面**：展示所有可用的导师配置，支持创建新会话
- **会话管理侧边栏**：列出所有学习会话，支持切换、重命名、删除
- **实时聊天窗口**：流式显示 AI 导师回复，支持思考状态动画
- **学习进度展示**：可视化进度条和当前步骤的学习目标
- **响应式设计**：支持全屏模式，优化移动端体验

### 数据流

```
实验手册 (lab_manual.md)
    ↓
[CurriculumGenerator] → 教学大纲 (curriculum.json)
[PersonaGenerator] → 导师人格 (definition.json)
    ↓
[ProfileGenerateManager] → 导师配置 (profile.json)
    ↓
[Web 界面] 选择导师 → 创建会话
    ↓
[Tutor 实例] ← 学生提问
    ↓
[LLM] 生成苏格拉底式回复 → 流式返回前端
    ↓
[SessionManager] 持久化会话状态
```

## 🚀 快速开始

### 前置要求

- **Python**: 3.8 或更高版本
- **Node.js**: 18 或更高版本
- **DeepSeek API Key**: 从 [DeepSeek 平台](https://platform.deepseek.com/) 获取

### 1. 克隆项目

```bash
git clone https://github.com/ElysiaFollower/socratic-agent-generator.git
cd socratic-agent-generator
```

### 2. 配置环境变量

创建 `.env` 文件并配置 API 密钥：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的 DeepSeek API Key：

```env
DEEPSEEK_API_KEY=your_api_key_here
```

> **注意**：目前默认使用 DeepSeek API。如需使用其他 LLM，可修改 `src/config.py` 中的 `get_default_llm()` 函数。

### 3. 安装后端依赖

推荐使用 Conda 创建独立的 Python 虚拟环境：

```bash
# 创建并激活 Conda 环境
conda create -n SocraticAgent python=3.9 -y
conda activate SocraticAgent

# 安装 Python 依赖
pip install -r requirements.txt
```

> **提示**：如果不使用 Conda，也可以使用 `venv` 或直接安装到全局环境。

### 4. 安装前端依赖

```bash
cd frontend
npm install
cd ..
```

### 5. 启动服务

#### 启动后端服务

在项目根目录下运行：

```bash
python src/app.py
```

后端服务将在 `http://localhost:8000` 启动。

- API 文档：`http://localhost:8000/docs`（Swagger UI）
- 健康检查：`http://localhost:8000/api/health`

#### 启动前端服务

打开新的终端窗口，在项目根目录下运行：

```bash
cd frontend
npm run dev
```

前端服务将在 `http://localhost:5173` 启动。

### 6. 访问应用

在浏览器中打开 `http://localhost:5173`，即可开始使用 Socratic Agent Generator！

## 📚 使用指南

### 创建自定义 AI 导师

#### 方法一：交互式生成（推荐）

1. **准备实验手册**：将你的技术实验手册（Markdown 格式）放入 `data_raw/` 目录

2. **运行生成脚本**：

```bash
# 使用默认的 example 目录; 等价python src/main.py example
python src/main.py

# 或指定其他目录
python src/main.py ShellShock-Attack
```

3. **交互式流程**：
   - 程序自动从 `data_raw/{目录名}/lab_manual.md` 读取实验文档
   - 自动生成 Persona（导师人设）和 Curriculum（教学大纲）
   - 生成结果自动保存到 `data_raw/{目录名}/definition.json` 和 `curriculum.json`
   - 可以编辑这两个文件进行人工调整
   - 使用命令：
     - `[rp]` 或 `regenerate-persona` - 重新生成 Persona
     - `[rc]` 或 `regenerate-curriculum` - 重新生成 Curriculum
     - `[c]` 或 `continue` - 继续生成 Profile 并保存
     - `[q]` 或 `quit` - 退出程序

4. **查看生成结果**：
   - 中间产物保存在 `data_raw/{目录名}/`：
     - `definition.json`：导师人设（可编辑）
     - `curriculum.json`：教学大纲（可编辑）
   - 最终 Profile 保存在 `data/tutor_profiles/{目录名}/`：
     - `{profile_id}.json`：完整的导师配置

> **RAG 向量索引说明**：
> - 上传/保存实验手册后，会异步构建该手册的向量索引，存放在 `data/vector_stores/{lab_name}`。
> - 生成的 Profile 会记录 `lab_name` 用于检索，多个 Profile 可共享同一份向量索引。

#### 方法二：手动创建

1. 在 `data/tutor_profiles/` 下创建新目录，例如 `my_tutor/`

2. 创建 `profile.json` 文件，参考现有导师配置的格式：

```json
{
  "id": "my_tutor",
  "name": "我的导师",
  "description": "导师简介",
  "curriculum": {
    "topic_name": "课程主题",
    "steps": [
      {
        "step_number": 1,
        "title": "步骤标题",
        "learning_objectives": ["学习目标1", "学习目标2"],
        "key_concepts": ["关键概念1", "关键概念2"],
        "guiding_questions": ["引导问题1", "引导问题2"],
        "success_criteria": ["成功标准1", "成功标准2"]
      }
    ]
  },
  "persona": {
    "role": "导师角色",
    "teaching_style": "教学风格",
    "constraints": ["约束条件1", "约束条件2"]
  }
}
```

3. 重启后端服务，新导师将自动加载

### 使用 AI 导师进行学习

1. **选择导师**：在首页选择一个导师，点击"开始学习"
2. **创建会话**：系统自动创建新的学习会话
3. **开始对话**：
   - AI 导师会发送欢迎消息并介绍学习目标
   - 通过提问引导你思考和探索
   - 根据你的回答调整教学节奏
4. **查看进度**：右侧面板显示当前学习进度和步骤目标
5. **管理会话**：
   - 左侧边栏列出所有会话
   - 支持切换、重命名、删除会话
   - 会话自动保存，可随时恢复

### 使用 CLI 工具

#### 1. Profile 生成工具 (`main.py`)

交互式生成导师配置：

```bash
python src/main.py [目录名]
```

#### 2. 导师对话工具 (`tutor_cli.py`)

在终端中与导师对话（用于调试和批处理数据收集）：

```bash
# 列出所有可用的 Profile
python src/tutor_cli.py --list

# 使用 Profile ID 启动对话
python src/tutor_cli.py --profile-id <profile_id>

# 使用自定义 Profile 目录
python src/tutor_cli.py --profile-id <profile_id> --profiles-dir ./custom_profiles

# 自定义会话名称
python src/tutor_cli.py --profile-id <profile_id> --session-name "我的会话"
```

**功能**：
- 列出所有可用的 Profile
- 创建新的学习会话
- 交互式对话（输入 `q` 或 `exit` 退出）
- 自动保存会话状态

## 🔌 API 文档

### 主要接口

| 接口路径 | 方法 | 说明 | 模块 |
|---------|------|------|------|
| `/api/health` | GET | 健康检查 | `app.py` |
| `/api/profiles` | GET | 获取所有导师配置列表 | `api/routes/profile.py` |
| `/api/profiles/{profile_id}` | GET | 获取指定导师的完整配置 | `api/routes/profile.py` |
| `/api/sessions` | GET | 获取所有会话列表 | `api/routes/session.py` |
| `/api/sessions/create` | POST | 创建新的学习会话 | `api/routes/session.py` |
| `/api/sessions/{session_id}` | GET | 获取会话详情 | `api/routes/session.py` |
| `/api/sessions/{session_id}` | DELETE | 删除指定会话 | `api/routes/session.py` |
| `/api/sessions/{session_id}/rename` | PUT | 重命名会话 | `api/routes/session.py` |
| `/api/sessions/{session_id}/messages/stream` | POST | 发送消息（流式响应，SSE） | `api/routes/interaction.py` |
| `/api/tutor/{session_id}/welcome` | GET | 获取欢迎消息 | `api/routes/interaction.py` |
| `/api/tutor/{session_id}/state` | GET | 获取学习进度状态 | `api/routes/interaction.py` |
| `/v1/chat/completions` | POST | OpenAI 兼容的聊天接口 | `api/routes/adapter.py` |

> **注意**：所有 API 接口在 v2.0.0 重构后保持 100% 向后兼容，前端无需修改。

## 🛠️ 技术栈

### 后端

- **Python 3.8+**：核心编程语言
- **FastAPI**：现代高性能 Web 框架
- **LangChain**：LLM 应用开发框架
- **LangChain-DeepSeek**：DeepSeek API 集成
- **Pydantic**：数据验证和序列化
- **Uvicorn**：ASGI 服务器

### 前端

- **React 18**：UI 框架
- **TypeScript**：类型安全的 JavaScript
- **Vite**：快速的前端构建工具
- **Tailwind CSS**：实用优先的 CSS 框架
- **Axios**：HTTP 客户端
- **Lucide React**：图标库

### 数据存储

- **JSON 文件**：导师配置和会话数据持久化
- **内存缓存**：活跃导师实例缓存

## ❓ 故障排查

### 常见问题

#### 1. 前端依赖安装失败

**症状**：`npm install` 报错

**解决方案**：
```bash
# 删除 node_modules 和 package-lock.json
cd frontend
rm -rf node_modules package-lock.json
npm install
```

- 确保 Node.js 版本 >= 18
- 尝试使用 `npm install --legacy-peer-deps`

#### 2. 后端启动失败

**症状**：`python src/app.py` 报错

**解决方案**：
- 检查虚拟环境是否激活：`conda activate SocraticAgent`
- 重新安装依赖：`pip install -r requirements.txt`
- 检查 Python 版本：`python --version`（需 >= 3.8）

#### 3. 端口被占用

**症状**：`ERROR: [WinError 10013] 以一种访问权限不允许的方式做了一个访问套接字的尝试。`

**解决方案**：
1. 修改后端端口：编辑 `src/config.py`，修改 `API_PORT` 值
2. 同步修改前端代理：编辑 `frontend/vite.config.ts`，修改 `proxy` 中的 `target` 端口

#### 4. LLM 调用失败

**症状**：对话时报错或无响应

**解决方案**：
- 检查 `.env` 文件中的 `DEEPSEEK_API_KEY` 是否正确
- 确认网络连接正常，能访问 DeepSeek API
- 检查 API 配额是否用尽

#### 5. 前端无法连接后端

**症状**：前端显示网络错误

**解决方案**：
- 确认后端服务已启动并运行在 `http://localhost:8000`
- 检查浏览器控制台的网络请求，确认代理配置正确
- 尝试直接访问 `http://localhost:8000/docs` 测试后端是否正常

#### 6. 生成的导师配置不显示

**症状**：新创建的导师在前端看不到

**解决方案**：
- 确认配置文件已保存到 `data/tutor_profiles/` 目录
- 重启后端服务
- 刷新前端页面
- 检查配置文件的 JSON 格式是否正确

## 🤝 贡献指南

我们欢迎任何形式的贡献！无论是新功能、Bug 修复还是文档改进。

### 贡献流程

1. **Fork 项目**：点击右上角的 Fork 按钮
2. **创建分支**：`git checkout -b feature/AmazingFeature`
3. **提交更改**：`git commit -m 'Add some AmazingFeature'`
4. **推送分支**：`git push origin feature/AmazingFeature`
5. **提交 Pull Request**：在 GitHub 上创建 PR

### 开发建议

- 遵循现有的代码风格
- 为新功能添加适当的注释
- 更新相关文档
- 测试你的更改

## 📝 更新日志

### v2.0.0 (2025-12-25)
- 🏗️ **架构重构**：模块化路由系统，遵循 Google Python Style Guide
  - 从单文件 `app.py` 重构为模块化路由架构
  - 新增 `core/` 模块：依赖注入、异常处理、日志配置
  - 新增 `api/routes/` 模块：按功能分离路由
  - 文件命名统一为 `snake_case`
- 🔌 **API 增强**：
  - 新增 `GET /api/profiles/{profile_id}` 端点
  - 所有现有 API 保持 100% 向后兼容
- 🎯 **依赖注入**：引入 FastAPI 依赖注入机制，实现单例模式
- 🛡️ **异常处理**：统一的自定义异常类和错误处理逻辑
- 📝 **日志系统**：集中式日志配置，统一日志格式
- 🐛 **Bug 修复**：修复单例模式、流式响应错误处理等问题
- 🔧 **代码质量**：完整的类型注解、文档字符串，符合 Google Python Style Guide
- 🚀 **CLI 工具**：
  - `main.py`：交互式 Profile 生成工具
  - `tutor_cli.py`：命令行对话工具（支持调试和批处理）

### v1.0.0 (2025-09-12)
- ✨ 初始版本发布
- 🎯 支持苏格拉底式导师生成
- 🌐 Web 界面支持苏格拉底智能体运行

## 📄 许可证

本项目基于 [MIT License](LICENSE) 授权。

---

## 📧 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 [GitHub Issue](https://github.com/ElysiaFollower/socratic-agent-generator/issues)
- 发起 [Pull Request](https://github.com/ElysiaFollower/socratic-agent-generator/pulls)

---

**Made with ❤️ by the Socratic Agent Generator Team**
