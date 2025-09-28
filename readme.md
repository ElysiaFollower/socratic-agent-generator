# TODO: out of date

# Socratic Agent Generator

Socratic Agent Generator 是一个基于苏格拉底式教学法的 AI 导师生成器。它能自动将实验手册转换为个性化的 AI 导师配置文件。并提供一个交互式 Web 界面，让学生可以与加载任意配置的导师进行循序渐进的对话式学习。

## 项目特性

- 🤖 **智能导师生成**: 从实验手册自动生成苏格拉底式AI导师
- 🎯 **个性化教学**: AI 导师将根据您提供的教学大纲，循序渐进地引导学生完成学习节点。
- 🌐 **Web界面**: React前端 + FastAPI后端的现代化交互界面
- 🔄 **实时对话**: 支持实时师生对话和学习进度跟踪

## 系统架构

```
Socratic Agent Generator
├── Backend (Python + FastAPI)
│   ├── Agent Profile Generator  # 导师配置生成器
│   ├── Curriculum Generator     # 教学大纲生成器
│   ├── LLM Integration (DeepSeek)
│   └── RESTful API
├── Frontend (React + TypeScript)
│   ├── Tutor Selection UI     # 导师选择界面
│   ├── Real-time Chat Window  # 实时聊天窗口
│   └── Learning Progress Display # 学习进度展示
└── Configuration Management
    ├── Lab Manual Parser      # 实验手册解析
    └── Profile Exporter       # 导师配置输出
```

## 文件结构

```
socratic-agent-generator/
├── .env.example                  # 环境变量模板文件
├── .gitignore                    # Git忽略文件配置
├── readme.md                     # 项目说明文档
├── requirements.txt              # Python依赖包列表
├── configs/                      # 课程配置和实验手册
│   └── seed_buffer_overflow/     # 缓冲区溢出课程**示例**
│       ├── definition.yaml       # 课程元数据定义
│       ├── lab_manual.md         # 实验手册，无格式要求
│       ├── curriculum.json       # 生成的苏格拉底式教学大纲
│       └── curriculum-human.json # 人工编写的教学大纲参考 —— curriculum.json的中间态是生成出来就是让人有自主审核权的
├── src/                          # 后端核心代码
│   ├── app.py                    # FastAPI服务器主程序
│   ├── config.py                 # 项目配置文件
│   ├── main.py                   # 导师配置生成主程序
│   ├── generate_curriculum.py    # 课程大纲生成器
│   ├── tutor_runner_cli.py       # 命令行导师运行器
│   ├── tutor_core.py             # 苏格拉底智能体核心逻辑
│   ├── generator/                # 生成器模块
│   │   ├── curriculum_generator.py # 教学大纲生成器
│   │   ├── prompt_assembler.py   # 提示词组装器
│   │   └── persona_generator.py  # 导师人格生成器(尚未实现)
│   └── data/                     # 数据存储目录
│       └── session_data/         # 会话数据存储
│           └── *.json            # 用户会话记录文件
├── tutor-profiles/               # 生成的导师配置文件目录
│   └── seed_buffer_overflow_profile.json # **示例**导师配置
└── frontend/                     # React前端应用
    ├── package.json              # 前端依赖配置
    ├── vite.config.ts            # Vite构建配置
    ├── src/
    │   ├── App.tsx               # 主应用组件
    │   ├── api/tutor.ts          # 后端API客户端
    │   └── ...
    └── dist/                     # 前端构建输出目录
```

## 快速开始

本节将指导您如何在本地环境中设置并运行整个 Web 应用。

### 1. 环境设置与依赖安装

- **Python**: 3.8+ 
- **Node.js**: 18+

#### 克隆项目

```bash
git clone https://github.com/ElysiaFollower/socratic-agent-generator.git
cd socratic-agent-generator
```

#### 配置环境变量

```bash
cp .env.example .env
```
然后，编辑 .env 文件，填入你的 DEEPSEEK_API_KEY。
- 目前仅支持了Deepseek的调用，如有需要，可修改tutor_core的初始化部分，将初始化模型更换为目标模型

#### 后端环境(Python)

推荐使用 Conda 创建独立的 Python 虚拟环境，需要先安装conda。不过若不怕弄脏环境的话也可以不配置虚拟环境，不怕安装科学计算库可能遇到的二进制编译问题的话也可以使用venv。
创建虚拟环境
```bash
# 创建并激活 Conda 环境 (环境名可自定义)
conda create -n SocraticAgent python=3.9 -y
conda activate SocraticAgent

# 安装 Python 依赖
pip install -r requirements.txt
```

#### 前端环境(Node.js)
```bash
# 进入前端目录
cd frontend

# 安装 Node.js 依赖
npm install
```

### 2. 启动服务

您需要分别启动后端和前端服务。

#### 启动后端服务(FastAPI)

```bash
# 确保位于项目根目录，并已激活 Conda 环境
python src/app.py
```
- 后端默认运行在 http://localhost:8000 。您可以在 src/config.py 中修改端口; 不过此时要同步修改前端的配置文件，将代理/api请求的端口也指向正确的位置

#### 启动前端服务(React)

```bash
# 打开一个新的终端，进入前端目录
cd frontend

# 启动开发服务器
npm run dev
```

前端默认运行在 http://localhost:5173 。您可以在 frontend/vite.config.ts 中修改端口。


## 创建你的专属AI导师

本节介绍如何从零开始，为你自己的课程创建一个新的 AI 导师。

### 1. 准备课程材料

首先，在 configs/ 目录下为你的新课程创建一个文件夹，例如 my_new_course。
```bash
mkdir configs/my_new_course
```
在该文件夹中，你需要准备两个核心文件：
- definition.yaml: 课程的元数据文件，定义课程的名称、目标、前置知识等。
- lab_manual.md: 详细的实验手册，这是 AI 生成教学大纲的主要依据。

### 2. 生成教学大纲 (Curriculum)

运行以下命令，让 AI 分析你的实验手册并生成结构化的教学大纲。
```bash
python src/generate_curriculum.py --manual configs/my_new_course/lab_manual.md
```

命令执行后，会在 configs/my_new_course/ 目录下生成一个 curriculum.json 文件。
强烈建议：请人工审核并微调此文件，确保教学流程的准确性和逻辑性。

### 3. 组装最终导师配置 (Profile)

最后，将所有课程材料组装成一个完整的导师配置文件。
```bash
python src/main.py --config-dir configs/my_new_course
```

此命令会读取 my_new_course 目录下的所有配置，并在 tutor-profiles/ 目录下生成一个最终的 my_new_course_profile.json 文件。

现在，你可以在 Web 界面或命令行中加载这个新的导师配置了！

## 与 AI 导师互动

### Web 界面模式

1. 确保前后端服务已按 快速开始 的指引成功启动。
2. 在浏览器打开前端页面（默认为 http://localhost:5173）。
3. 在导师选择列表中，找到并选择你想要互动的课程。
4. 开始与你的 AI 导师进行对话学习！

### 命令行模式

如果你希望在终端中快速验证导师效果，可以使用以下命令：
```bash
# --profile 参数指定要加载的导师配置文件
python src/tutor_runner_cli.py --profile tutor-profiles/seed_buffer_overflow_profile.json
```



## API文档

后端启动后，可通过访问 http://localhost:8000/docs 查看由 FastAPI 自动生成的 API 文档。(后端端口若自行修改，此处也相应修改)

## 技术栈

- **后端**：Python, FastAPI, LangChain
- **前端**：React, TypeScript, Vite, Tailwind CSS


## 故障排查

### 常见问题

**1. 前端依赖安装失败**  
- 删除 `frontend/node_modules` 后重新运行 `npm install`
- 确保 Node.js 版本 >= 18

**2. 后端启动失败**
- 检查虚拟环境是否正确激活
- 确保所有Python依赖已安装: `pip install -r requirements.txt`
- 若失败提示为“ERROR:    [WinError 10013] 以一种访问权限不允许的方式做了一个访问套接字的尝试。”则很可能是因为端口被其他进程占用，请在src/config.py中修改端口并尝试重新启动。成功后请同步修改vite.config.ts中的代理端口。

**3. LLM调用失败**
- 检查 `.env` 文件中的API密钥配置
- 确认网络连接正常


## 贡献指南

我们欢迎任何形式的贡献！无论是新功能、Bug 修复还是文档改进。

1. Fork 项目
2. 创建您的特性分支: `git checkout -b feature/AmazingFeature`
3. 提交您的更改: `git commit -am 'Add some AmazingFeature'`
4. 推送分支: `git push origin feature/AmazingFeature`
5. 提交Pull Request


## 更新日志

### v1.0.0 (2025-9-12)
- ✨ 初始版本发布
- 🎯 支持苏格拉底式导师生成
- 🌐 Web界面支持苏格拉底智能体运行

---

📧 如有问题或建议，请提交Issue或联系维护者。

## 许可证

本项目基于 MIT License 授权。