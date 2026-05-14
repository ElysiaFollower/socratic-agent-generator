# 项目概览

## 目标

Socratic Agent Generator 将技术实验手册转换为可交互的苏格拉底式 AI 导师。系统通过生成 Persona、Curriculum 和运行时 Prompt，把静态实验文档变成可部署、可审阅、可对话的学习 Profile。

产品北极星与价值标准线见 `docs/product/vision.md`。当实现方案、prompt、profile、benchmark 或前端交互出现分歧时，优先用该文档判断系统是否仍在服务“用 AI 降低实验摩擦，同时保留学生核心思考”的目标。

## 受众

- 学生：通过分步骤追问、反馈和进度跟踪完成技术实验学习。
- 教师或助教：上传实验手册、审阅生成结果、管理班级、控制 Profile 可见性。
- 研究与开发者：扩展生成器、导师运行时、技能系统、记忆系统和实验环境观察能力。

## 范围内

- 文档到导师的生成流水线：上传实验手册，生成 Persona 和 Curriculum，经人工审阅后保存 Profile。
- Web 学习体验：认证、Profile 选择、Session 管理、流式对话、学习进度可视化。
- 教师管理：班级、邀请码、Profile 可见性和自定义技能。
- 本地开发与研究迭代：FastAPI 后端、React/Vite 前端、SQLite 数据存储、文件系统文档和向量索引。
- 官方部署：`docs/deployment.md`，默认安装并配置 DreamingRAG 长期记忆。
- vNext 规划：SEED 报告语料、Remote Runner 环境观察、DreamingRAG 长程记忆。

## 范围外

- 本次 harness 初始化不实现 vNext 功能，不导入外部报告，不新增 submodule。
- 不提交真实 API key、学生隐私数据、数据库、向量索引、模型缓存或远程机器凭据。
- 不把 SSH、tmux、sshfs、具体 LLM 服务商或某个研究原型写成不可替换的长期产品边界。

## 核心工作流

- 创建导师：上传 Markdown/PDF 实验手册，后端生成 Persona 和 Curriculum，教师审阅后保存 Profile。
- 学习对话：学生选择可见 Profile，创建 Session，通过流式对话逐步完成课程节点。
- 进度评估：StepEvaluator 根据课程节点的成功标准判断是否推进，Assessment Skill 只提供指导信息。
- 自定义技能：教师上传材料并建立向量索引，让导师能在特定实验资料中检索辅助信息。
- 未来增强：从真实 SEED 报告提取教学资产，通过 Remote Runner 观察实验环境，用 DreamingRAG 支持长期学习记忆。

## 验证

- Harness sanity：`./scripts/harness-check.sh`
- 后端语法验证：`python3 -m compileall src`
- 前端单元验证：`cd frontend && npm test -- --run`
- 前端构建验证：`cd frontend && npm run build`
- 手动流程：启动后端和前端，验证登录、上传文档、生成 Profile、创建会话和流式对话。
