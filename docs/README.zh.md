# Socratic Agent Generator（中文说明）

> [English Version](../README.md)

基于苏格拉底式教学的智能辅导系统，可将技术类实验手册自动转换为可交互的 AI 导师，并通过 Web 界面进行对话式学习。

## 概述

### 核心创新

本系统的核心贡献在于 **将静态、被动的技术手册自动转换为可交互的、节点化的苏格拉底式教学代理**。相比需要手工配置导师的方案，本系统实现了 **一键式的文档到导师转换**，并保留教育者的审核与干预。

**转换流程**：

1. **上传文档**：提供技术实验手册（Markdown/PDF）
2. **自动生成**：AI 分析文档并 **创建**：
   - **Persona（教学人格）**：具备风格与教学策略的教学角色
   - **Curriculum（课程图谱）**：结构化的苏格拉底式提问路径
3. **人工审阅**：教师可审查、修改或重新生成
4. **部署与学习**：生成的 Profile 即为可部署的完整导师

### 设计理念

- **创造式生成**：系统 **生成** 教学人格与课程结构，而非简单抽取内容
- **Profile = 文档 + AI 配置**：文档提供知识，AI 生成“教学风格与路径”
- **人类在环**：生成可控，确保教学质量与目标一致

### 核心贡献

1. **文档到导师的自动流水线**
2. **双阶段创造式生成架构（Persona + Curriculum）**
3. **节点化学习路径，支持渐进式掌握**
4. **人工审阅与修改能力集成**

## 系统架构

![](docs/images/system-architecture.png)

### 后端（`src/`）

基于 **Python 3.8+ / FastAPI / LangChain**：

- **生成器**（`generators/`）
  - `PersonaGenerator`：将技术特征转化为教学风格
  - `CurriculumGenerator`：将技术依赖转化为教学逻辑
  - `ProfileGenerateManager`：管理生成流程
- **导师核心**（`utils/tutor_core.py`）：动态 Prompt 组装、对话历史管理与流式输出
- **API**（`api/routes/`）：认证、Profile、Session、课堂与技能管理
- **数据层**：SQLite + SQLAlchemy；文档与向量索引存储于文件系统（按用户隔离）

### 前端（`frontend/`）

基于 **React 18 / TypeScript / Vite / Material-UI**：

- 账号与 JWT 管理
- Profile 选择
- 对话与流式响应
- 课堂与技能管理
- 学习进度可视化

## 快速开始

### 前置条件

- Python 3.8+
- Node.js 18+
- 支持的 LLM 服务商 API Key（若用户自行配置可不在全局设置）

### 安装

```bash
# 克隆仓库
git clone https://github.com/ElysiaFollower/socratic-agent-generator.git
cd socratic-agent-generator

# 配置环境变量
cp .env.example .env
# 编辑 .env 并配置以下必要字段：
#   - JWT_SECRET_KEY: JWT 签名密钥（认证必需）
#   - ADMIN_TOKEN: 管理员注册密钥（必须在注册管理员前设置）
# 可选 LLM 预设（所有用户共享，除非用户在设置中配置自己的 Key）：
#   - DEEPSEEK_API_KEY / OPENAI_API_KEY / GLM_API_KEY / MINIMAX_API_KEY
#   - DEFAULT_LLM_PROVIDER: 当用户未选择/配置时的默认服务商
#   - LLM_API_KEY_ENCRYPTION_KEY: 用户 Key 入库时的加密密钥

# 安装后端依赖
conda create -n SocraticAgent python=3.9 -y
conda activate SocraticAgent
pip install -r requirements.txt

# 安装前端依赖
cd frontend && npm install && cd ..
```

### 启动

```bash
# 终端 1：启动后端（http://localhost:8000）
python src/app.py

# 终端 2：启动前端（http://localhost:5173）
cd frontend && npm run dev
```

数据库会在首次启动时自动初始化。打开 `http://localhost:5173` 注册账号。

**重要说明**：注册管理员前必须在 `.env` 中配置 `ADMIN_TOKEN`，注册页面会校验该 Token。

## LLM 配置说明

- `.env` 中的 API Key 为 **全局预设**，可供所有用户共享使用。
- 用户可在 **设置面板** 中配置自己的 API Key，**优先级高于全局预设**。
- `DEFAULT_LLM_PROVIDER` 在用户未选择/未配置时生效。
- 用户配置的 Key 会 **加密后存储在数据库**（由 `LLM_API_KEY_ENCRYPTION_KEY` 控制）。

## 使用方式

### 创建 AI 导师

**三步流程**：

1. **上传文档**（Markdown/PDF）
2. **自动生成** Persona 与 Curriculum，并可审阅/修改
3. **部署并学习**

**Web 方式（推荐）**：

- 上传文档
- 自动生成 Persona 与 Curriculum
- 审核/修改后保存
- Profile 即可用于教学对话

**CLI 工具**（`src/main.py`）：

```bash
# 将实验手册放置在 data/documents/{lab_name}/lab_manual.md
# 需要数据库中已有管理员账号（默认使用第一个管理员）
python src/main.py [lab_name]
```

交互命令：

- `[rp]` / `regenerate-persona`
- `[rc]` / `regenerate-curriculum`
- `[c]` / `continue`
- `[q]` / `quit`

中间文件保存至 `data/documents/{lab_name}/`，最终 Profile 写入 SQLite。

### 学习与对话

1. 登录并选择可见的 Profile
2. 创建会话（自动保存）
3. 进行苏格拉底式对话（流式输出）
4. 监控学习进度与会话管理

### 课堂管理

教师/管理员可创建班级、生成邀请码、控制 Profile 可见性；学生使用邀请码加入。

### 自定义技能

教师可创建自定义技能并自动构建向量索引。

## 技术栈

**后端**：Python 3.8+, FastAPI, LangChain, SQLAlchemy, SQLite, Pydantic, JWT (python-jose), Uvicorn  
**前端**：React 18, TypeScript, Vite, Material-UI, Axios, React Router, Notistack  
**存储**：SQLite（用户数据/会话/技能），文件系统（文档/向量索引），内存缓存（活跃导师）

## API

API 文档：`http://localhost:8000/docs`

## License

MIT

## 联系方式

- Issues: https://github.com/ElysiaFollower/socratic-agent-generator/issues
- Pull Requests: https://github.com/ElysiaFollower/socratic-agent-generator/pulls
