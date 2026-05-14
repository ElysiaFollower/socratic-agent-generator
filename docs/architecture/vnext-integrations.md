# vNext 集成方向

## 背景

Socratic Agent Generator 当前的核心能力是把技术实验手册转换为可交互的苏格拉底式导师。下一阶段的目标不是只让导师“读懂文档”，而是让导师能利用真实实验过程、真实运行环境和长期学习记忆，形成更贴近学生现状的指导。

产品北极星见 `docs/product/vision.md`。本文件中的所有 vNext 方向都应服务于同一个目标：AI 吸收实验外围摩擦，学生保留关键判断、关键推理和关键验证。任何把 Tutor 推向纯代做、工具循环或只追求通关的方案，都应被视为偏离方向。

本文记录未来方向，作为后续为每个方案单独开分支实现前的仓库内事实来源。当前只记录规划，不表示这些能力已经实现。

## 1. SEED 实验报告语料

用户在本学期完成了多组 SEED 实验，并积累了 step-by-step report。报告材料散落在两个本地来源：

- `/Users/ely/workspace/lesson/NetworkSecurity/Labs`
- `/Users/ely/workspace/research/agent/SEEDRunner/runs`

设计意图：

- 把正式报告作为主要语料来源，草稿、笔记和运行痕迹只作为辅助线索。
- 从真实实验路径中提取学生会遇到的步骤、错误、调试过程、截图或命令证据。
- 将这些材料用于改进实验导师的课程节点、提示策略、错误诊断和示例反馈，而不是简单把报告全文塞进上下文。

后续实现需要先建立报告索引、正式报告判定规则、脱敏规则和从报告到教学资产的转换流程。

## 2. Remote Runner / SEEDRunner 集成

用户在做 SEED 实验过程中开发了 `/Users/ely/workspace/research/agent/SEEDRunner/`。该项目已经从 SEED 专用实验工具重新定位为更通用的 Remote Runner：基于 SSH 的本地 CLI，让 AI 能通过稳定命令访问外部机器终端、执行命令、收集结构化输出、日志和产物。

设计意图：

- 将 Remote Runner 作为未来 submodule 候选集成到本项目。
- 让苏格拉底导师在对话过程中能观察学生真实实验环境，而不只依赖学生口述。
- 支持导师识别用户当前命令、文件状态、错误输出和环境差异，从而提出更具体的苏格拉底式追问与修正建议。
- 保持远程访问能力为工具层，不把 SSH、tmux、sshfs 等后端细节泄漏成教学系统的长期产品边界。
- Remote Runner 的产品价值是让 learning by doing 锚定真实机器和真实证据；命令输出必须被 Tutor 转化为当前学习问题、判断依据和下一步思考，而不是替代学生学习。

后续实现需要定义导师调用远程工具的权限模型、只读/可写边界、会话审计、错误脱敏、超时控制和用户确认机制。

当前实现任务：`docs/architecture/remote-runner-session-tools.md` 定义将 Remote Runner 原型产品化为 per-user 机器配置、per-session 机器绑定、Tutor 内置工具和真实实验会话验收的边界。

当前设计结论：

- Remote Runner 工具层保持通用，不做过度教学化封装。
- 工具职责是连通真实机器、执行命令、管理后台命令生命周期、收集结构化输出和审计记录。
- 具体执行什么命令、如何解释输出、如何把结果用于教学，由模型、profile、实验文档和会话上下文决定。
- Tutor 对工具的使用必须受 `docs/product/vision.md` 约束：不能连续环境盘点而不教学；每次工具调用后都要回到“这个结果说明什么、学生应判断什么、下一步如何推进”。

## 3. DreamingRAG 记忆系统集成

当前项目的对话记忆主要依赖简单历史裁剪。对于复杂、长程、多会话学习任务，这不足以支持稳定的个性化导师行为。

用户正在开发 `/Users/ely/workspace/research/agent/DreamingRAG/`。该项目定位为生物启发式 agent memory 研究系统，关注遗忘、整理、清洗、整合、选择性回忆，并在记忆演化公式中纳入用户情感和 insight 机制。

当前集成边界：

- Socratic 后端只依赖 DreamingRAG 的稳定本地 Python 接口 `dreaming_rag.public_api`。
- `DreamingRAGMemoryProvider` 使用 `DreamingRAGMemory` 进行 `recall` 和 `remember`，不直接触碰 DreamingRAG 内部脑模型、记忆容器或私有检索方法。
- DreamingRAG 不接管导师回复生成；它只提供长期学习记忆片段，Tutor 主流程仍负责苏格拉底式追问、skills、streaming 和 step evaluation。

设计意图：

- 将 DreamingRAG 作为未来 submodule 候选集成到本项目。
- 用演化式学习记忆替代单纯的上下文裁剪。
- 让导师长期理解学生的认知状态、情绪状态、常见误区、学习节奏和曾经出现过的关键顿悟。
- 把记忆能力用于更好的复习、追问、错误预防、个性化提示和跨实验迁移。

后续实现需要定义记忆写入事件、隐私边界、学生可见/可控机制、记忆检索接口、遗忘策略和 benchmark 评估方式。

## 4. 会话 Shell 面板

当前系统已经能通过 Remote Runner 执行真实命令，并在后端记录审计证据。但学生在前端聊天界面里不一定能直接看到完整执行过程，因此容易出现“Tutor 说它检查过了，但用户不确信”的体验问题。

当前实现入口：

- 前端右侧面板：`frontend/src/components/session/SessionEvidencePanel.tsx`
- 后端 transcript 数据源：`GET /api/sessions/{session_id}/remote-shell`
- 后端受控命令入口：`POST /api/sessions/{session_id}/remote-shell/command`
- 后端审计数据源：`GET /api/sessions/{session_id}/remote-audits`
- 非敏感审计 schema：`RemoteCommandAudit`

设计意图：

- 在会话界面右侧增加可展开的 Shell 面板。
- 面板形式类似 VS Code 的 terminal tabs：一个 tab 代表一个 Remote Runner shell/session，而不是一条命令。
- 每个 terminal tab 优先展示 Remote Runner persistent transcript；`session exec` 在同一 session shell 中执行，因此 shell-local state 能跨命令保留。
- 前端不应把每条 audit 记录做成 tab；audit 记录应作为同一个 terminal transcript 中的连续片段。
- 后台命令应能显示 running/exited/failed/stopped 状态，并支持刷新或查看最新结果。
- 面板是观察和信任建立工具。学生输入命令时应默认走受控 `session exec`，而不是绕过 policy 的 raw shell input。
- 用户可见命名应只说 Shell，而不是 Shell Evidence。审计是系统内部证据模型，前端体验应更接近真实 terminal。
- 桌面端 Shell 面板应支持拖动左边界调整宽度；移动端保持合理降级。
- transcript 应采用 terminal 风格渲染，长输出和长行不应撑破布局；shell 关闭、不可读、正在执行或出错时应显示明确状态，而不是只显示记录数量。
- Tutor fallback 回复不应把 `Relevant evidence: {...}` 这类 Remote Runner JSON 直接写进聊天正文；工具输出要先被压缩成可读的 Shell 结果摘要，再回到当前教学目标。

边界：

- 数据来源应优先复用 `RemoteCommandAuditModel`、`SessionRemoteBindingModel.runner_session_id` 和 Remote Runner command lifecycle，而不是新增一套独立日志系统。
- 不显示密码、私钥、token、host 私密细节或本地路径。
- raw `session send` 只适合未来复杂交互 flows；在没有明确 policy/audit 方案前，不应作为默认 UI 输入路径。
- 停止后台命令可以作为明确按钮单独评估。

## 5. 单实验端到端 Benchmark

当前真实验收依赖人工完整对话测试。随着 Tutor、profile generator、RAG、Remote Runner 和前端持续变化，人工测试成本高且容易遗漏回归。

当前实现入口：

- `scripts/benchmarks/single_lab_e2e.py`
- `docs/benchmarks/single-lab-e2e.md`

设计意图：

- 先为一个稳定实验建立最小端到端 benchmark，推荐继续使用 Sniffing/Spoofing。
- benchmark 应通过后端 API 驱动真实流程，而不是依赖手点前端。
- 固定测试内容包括：登录测试用户、选择 profile、绑定实验机、上传或确认 LabSetup、触发对话、观察工具调用、检查 step completion、检查远程命令 audit、确认最终完成状态。
- 初版不追求覆盖所有实验，也不追求完全模拟真实学生，但必须避免把“通关”误当成“学习成功”。如果会话几乎没有学生判断、解释或证据推理，即使 `isFinished=true` 也应被标为高风险。

验收信号：

- 会话最终 `isFinished=true`。
- 至少一次 lab manual RAG 检索生效。当前后端还没有一等 RAG audit API，因此第一版 benchmark 先记录这个缺口，并用会话完成度与回复内容作为间接信号；后续 Shell/Evidence 或 retrieval audit 接入后应改成直接检查。
- 至少一次 Remote Runner 命令生效，并留下脱敏 audit。
- 后台命令 start/wait/result 链路至少被覆盖一次。
- 学生 turns 应包含对当前 learning step 的真实回答或伪代码/判断，而不只是要求 Tutor 检查环境或继续执行。
- Tutor 回复应把工具证据转化为教学目标、学生判断和下一步问题；出现连续工具前置语或环境盘点时应判为学习质量风险。
- benchmark 失败时能输出明确失败阶段和关键响应摘要。

## 6. Profile 生成质量评估体系

Profile 自动生成是项目的重要卖点，但当前 generator 的多智能体架构、提示词和人工校准流程仍缺少稳定评估体系。没有评估体系时，提示词或 agent 架构的改动很容易只增加复杂度，而不带来真实质量提升。

设计意图：

- 在改 generator 之前，先定义可重复的 profile 质量评估。
- 评估对象应包括：课程节点结构、实验事实正确性、学生认知负担、真实实验摩擦、错误诊断节点、RAG 引用质量、step completion 判定标准，以及 profile 是否抓住“值得学生亲自想明白的判断链”。
- 评估材料应优先使用已校准的 6 个 SEED 实验 profile、真实 `.tex` lab manual、手写报告和已导出的 demo session。
- 评估输出应能比较两个 generator 版本，而不是只生成主观评价。

可能的第一版评估：

- 静态结构检查：profile schema、persona/curriculum/assessment 完整性、lab manual 引用完整性。
- 人工校准差异检查：新生成 profile 与人工校准 profile 的节点差异、缺失摩擦点、错误成功标准。
- 小型 LLM-as-judge：只用于辅助排序，必须固定 rubrics 和输入，不作为唯一结论。
- 端到端行为检查：将生成 profile 放入单实验 benchmark，观察 Tutor 是否能推进、是否过早给答案、是否陷入工具循环、是否漏掉关键实验步骤，以及是否保留学生解释真实证据的责任。

已实现的第一步：

- 新增 `scripts/benchmarks/profile_generation_eval.py`，离线比较候选 generated profile 与人工 calibrated profile，不调用 LLM、不需要密钥。
- 固定评估维度：结构完整性、persona 完整性、curriculum alignment、manual calibration mismatch risk coverage。
- 当前默认基线为 `docs/manual-enhance/generated` 对比 `docs/manual-enhance/calibrated`，风险 taxonomy 来自 `docs/manual-enhance/mismatch-taxonomy.json`。
- 使用文档：`docs/benchmarks/profile-generation-evaluation.md`。该评估是 generator 改造前的静态质量门，不能替代 `single_lab_e2e.py` 的真实后端流程验证。

## 7. Profile Management 文档身份与元信息 UX

用户发现的问题：

- Profile Management 页面中，某些 lab manual 只显示有 curriculum，没有 persona，说明 profile 或 document 元信息链路可能不完整。
- Lab Manuals 似乎不能自行重命名，导致相近文档难以区分。
- 在 Generate Profile 时，用户需要选择一个实验文档；当相似名称的文档很多时，很难快速确认“这就是我想要的那份文档”。
- 如果在 Generate Profile 中加入完整 View Manual 能力，又会和 Lab Manuals 版块定位重叠。

实施前需要决策的方案：

1. 轻量预览方案：Generate Profile 的文档选择器显示文档身份卡，包括文件名、实验名、上传者、上传时间、大小、引用 profile 数、文档摘要、前几行 preview、source path/内置来源标记。完整编辑、重命名和删除仍留在 Lab Manuals。
2. 抽屉预览方案：Generate Profile 中点击文档后打开只读 side drawer，支持搜索和片段预览，但不提供管理操作。Lab Manuals 仍是唯一管理入口。
3. 统一 Document Detail 方案：Lab Manuals 和 Generate Profile 共用同一个 Document Detail 组件；Generate Profile 只以只读模式打开，Lab Manuals 以管理模式打开。

当前建议：

- 采用方案 3 的组件复用方向，但第一步可以实现为方案 1，降低范围。
- Lab Manuals 应补充 rename/edit display name 能力，并显示“被哪些 profile 引用”。
- Generate Profile 不应复制完整文档管理功能，只提供足够让用户确认文档身份的只读 preview。
- persona/curriculum/document_status 的显示缺口应作为 bug 独立修复，而不是混入 profile generator 改造。

已实现的第一步：

- Lab manual 列表返回稳定 `document_id`、`display_name`、文件名、owner、上传时间、相对 source path、大小、引用 profile 数和短 preview。
- Lab Manuals 支持编辑 display name；该操作不改变 `doc_name`、存储路径、索引路径或已有 profile 的 `document_id` 引用。
- 文档查看和删除优先通过 `document_id` 调用，避免 admin 视角下同名文档误操作；旧的按 `lab_name` API 保留向后兼容。
- Generate Profile 的选择列表增加只读身份卡和短 preview，完整查看、删除、重命名仍留在 Lab Manuals。
- persona/curriculum readiness 同时检查同目录 artifact 和引用该 document 的 profile 数据，修复内置校准 profile 只显示 curriculum、不显示 persona 的误导。

## 实施原则

- 每个方向都应先形成独立 plan 和分支，再进入实现。
- 外部项目先以 submodule 候选和接口合同讨论，不直接复制源码进本仓库。
- 报告、远程环境输出和学生记忆都可能包含敏感信息，任何导入或调用流程必须先设计脱敏、权限和审计边界。
- 这些能力应增强苏格拉底式教学，而不是把导师变成直接给答案的自动解题器、运维 agent 或只追求 `isFinished=true` 的流程机。
- 新 plan 的验收标准必须显式说明它如何降低外围摩擦、保留学生核心思考，并提供可观察证据。
