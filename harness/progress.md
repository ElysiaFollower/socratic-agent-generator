# 进度日志

## 当前状态

- 当前功能项：无 active；`linux01-live-deployment` 已标记为 `passing`。
- 当前任务计划：无 active；`plans/archive/20260513-linux01-live-deployment.md` 已归档。
- 上次验证：2026-05-13，linux-01 live deployment 通过；远端 focused tests 22 passed；默认 `EMBEDDING_PROVIDER=volcengine` 下 `check_and_download_models()` 返回 `(True, [], [])`；外部 curl health/docs/frontend 通过；admin 真实对话 smoke 通过，session 历史成功保留，且 demo 登录、profile list、session creation 和 `yes` 流式回复不再触发工具迭代过早截断。
- 下一步最佳动作：把 `http://10.203.15.128:5173` 发给导师；需要时再配置域名、HTTPS 或 systemd。

## 状态约定

- `not_started`：尚未开始。
- `active`：当前唯一在制任务。
- `blocked`：缺少输入、环境、依赖或决策。
- `passing`：验证通过且 evidence 已记录。

## 日志

### 2026-05-11 - 记录 vNext 集成路线

- 新增 `docs/architecture/vnext-integrations.md`，记录 SEED 报告语料、Remote Runner 环境观察和 DreamingRAG 长程记忆三个未来方向。
- 验证：规划文档单独提交为 `docs: record vnext integration roadmap`。
- 下一步：为项目补齐 repo-native harness scaffold。

### 2026-05-11 - Harness 初始化

- 创建 `AGENTS.md`、`init.sh`、`docs/overview.md`、`harness/` 状态文件、`plans/` 目录和 `scripts/harness-check.sh`。
- 修复现有前端 smoke test 的默认语言断言，使其与 `i18n` 默认 English 配置一致。
- 验证：`./scripts/harness-check.sh` 通过且 0 warning；`./init.sh` 通过；`python3 -m compileall src` 通过；`cd frontend && npm test -- --run` 通过 1 个测试；`cd frontend && npm run build` 通过。
- 注意：`npm ci` 成功，但 npm audit 报告 20 个既有依赖漏洞；Vite build 报告部分 chunk 超过 500 kB，Browserslist 数据过旧。
- 下一步：分别为 SEED 报告语料、Remote Runner 集成和 DreamingRAG 记忆集成创建独立 active plan。

### 2026-05-11 - 开启 DreamingRAG adapter 原型任务

- 创建分支 `rag-memory-adapter`。
- 创建 active plan：`plans/active/20260511-dreamingrag-memory-adapter-prototype.md`。
- 将 `dreamingrag-memory-integration` 切换为当前唯一 active feature。
- 任务目标：快速产出可用原型，先把 adapter 接入 Tutor，并用 mock/fake 路径验证基本功能。
- 下一步：实现 provider、配置开关、Tutor prompt 注入和 focused tests。

### 2026-05-11 - 完成 DreamingRAG adapter 可用原型

- 新增 `src/utils/memory_provider.py`，提供 `NullMemoryProvider` 和 `DreamingRAGMemoryProvider`，隔离 DreamingRAG 不稳定 SDK 边界。
- 在 `Tutor` 回复前注入长期记忆 context，回复后容错写入 user/assistant turn；默认配置关闭，导入失败时降级为 null provider。
- 新增 DreamingRAG 配置项和 `.env.example` 说明；新增 `data/dreamingrag_memory/` 忽略规则，避免提交运行时记忆数据。
- 新增 `tests/test_memory_provider.py`，验证 null no-op、context 格式化、prompt note 拼接、per-session storage 和 turn 写入调用。
- 验证：`./scripts/harness-check.sh` 通过且 0 warning；`python3 -m unittest tests.test_memory_provider` 通过 5 个测试；`python3 -m compileall src` 通过；`cd frontend && npm test -- --run` 通过 1 个测试；DreamingRAG mock-mode adapter smoke 通过。
- 状态：`dreamingrag-memory-integration` 标记为 `passing`；任务计划归档到 `plans/archive/20260511-dreamingrag-memory-adapter-prototype.md`。

### 2026-05-11 - 验证 DreamingRAG real-mode 与 CLI 路径

- 创建忽略目录 `_local/socratic-smoke-venv`，安装 Socratic 后端依赖和 DreamingRAG `dreaming_rag/requirements.txt`；网络获取结果为 success。
- 确认仓库 CLI 存在且可运行：`src/tutor_cli.py --list` 正常；但它依赖 SQLite 中已有 Profile，初始数据库为空时只能列出“未找到任何Profile”。
- 种入临时 smoke Profile `rag-smoke-buffer-overflow` 后，`src/tutor_cli.py --list` 能列出 Profile，`--profile-id rag-smoke-buffer-overflow` 能创建会话并通过 DeepSeek 返回非空导师回复。
- 使用 DreamingRAG 本地 `.env` 的 `DEEPSEEK_API_KEY`、`VOLCENGINE_API_KEY` 和 embedding 配置运行 real mode；未打印密钥。
- 独立 adapter real-mode smoke 通过：`DreamingRAGMemoryProvider(mock_mode=False)` 写入后 recall 非空，且 context 包含 `return address`。
- 续轮验证通过：`Tutor.from_id("31dfa50a-3e77-4643-9993-560ee1218ab9", owner_id="cli")` 恢复同一 session 后，`pre_recall_nonempty=True`、`pre_recall_mentions_return_address=True`、`pre_recall_chars=583`，随后 `process_message` 返回非空回复并继续写入记忆。
- 发现的真实约束：Socratic 运行环境若未安装 DreamingRAG 依赖，会在导入 DreamingRAG 时缺 `pandas`；adapter 会降级为空记忆，不会阻断 Tutor，但 real mode 需要额外安装 DreamingRAG 依赖。

### 2026-05-11 - 准备归档 RAG adapter 分支

- 判断：当前分支已经完成“能接上 DreamingRAG 并在真实对话路径可用”的原型目标，继续扩展收益低。
- 保留价值：窄 adapter 边界、默认开启策略、显式关闭开关、真实 CLI smoke evidence 和回归测试，可作为未来 DreamingRAG 稳定后的集成基线。
- 暂缓事项：不在本分支继续做 UI、异步写入、生产级依赖管理、记忆管理页面、删除/导出或 DreamingRAG 深层 API 适配。
- 下一步：提交当前分支作为归档点；未来从新分支推进 hardening。

### 2026-05-11 - 将 DreamingRAG 记忆改为默认开启

- 决策：长会话导师默认应具备持久记忆能力，原先只靠裁剪 history 的记忆策略不足以支撑真实学习场景。
- 改动：`DREAMINGRAG_MEMORY_ENABLED` 默认值改为 `true`，`.env.example` 同步为默认开启；仍可通过显式设置 `DREAMINGRAG_MEMORY_ENABLED=false` 关闭。
- 安全边界：DreamingRAG 依赖缺失、路径不可用或初始化失败时，adapter 仍降级为空记忆，不阻断 Tutor 初始化和对话。

### 2026-05-12 - 开启 Remote Runner 工具接入任务

- 创建分支 `remote-tool`，并确认正确基线为 `rag-memory-adapter`：它包含远端 `origin/dev` 当前代码、repo-native harness 和默认开启的 DreamingRAG adapter。
- 创建 active plan：`plans/active/20260512-remote-runner-tool-adapter-prototype.md`。
- 将 `remote-runner-integration` 切换为当前唯一 active feature。
- 接口检查结论：`/Users/ely/workspace/research/agent/SEEDRunner` 的 Remote Runner 接口已经足够开始 Socratic adapter 原型，不需要先阻塞等待外部项目继续开发基础接口。
- 已验证外部接口：SEEDRunner `./init.sh` 通过；`python3 -m remote_runner.cli --help` 可运行；`python3 -m pytest tests/test_remote_runner_mvp.py tests/test_remote_runner_launch_suite.py -q` 通过 `28 passed, 1 skipped`；核心 manager import smoke 通过；隔离 `REMOTE_RUNNER_STATE_DIR` 下 `machine/session/run list --json` 返回合法空 JSON。
- 已知接口差异：Remote Runner API 文档把 `--state-dir` 作为目标全局选项，但当前实现通过 `REMOTE_RUNNER_STATE_DIR` 环境变量选择状态目录；Socratic 原型应使用环境变量集成。

### 2026-05-12 - 完成 Remote Runner 本地 adapter 原型

- 新增 `src/utils/remote_runner_provider.py`，通过可替换 command runner 调用 `python -m remote_runner.cli`，支持 `list_machines`、`list_sessions`、`machine_doctor` 和受限 `session_exec`。
- 新增 `src/utils/remote_tool_skill.py`，提供 `observe_remote_environment` LangChain tool；配置关闭时不注入 Tutor。
- 更新 `src/utils/tutor_core.py`，将远程环境 skill 纳入 runtime skills 和 prompt skill summary，同时保留 DreamingRAG 默认记忆能力。
- 新增配置项：`REMOTE_TOOL_ENABLED`、`REMOTE_RUNNER_REPO_PATH`、`REMOTE_RUNNER_STATE_DIR`、命令超时、输出长度、允许机器、允许命令和 cwd 前缀。
- 本地安全边界：默认关闭；不执行真实 SSH；`session_exec` 只允许精确匹配的诊断命令；输出会脱敏 host/user/key/password/token/local log path 并截断。
- 验证：`python3 -m unittest tests.test_remote_runner_provider` 通过 `8 tests, skipped=3`（base python 缺 `langchain_core`，跳过 wrapper/Tutor 用例）；`_local/socratic-smoke-venv/bin/python -m unittest tests.test_remote_runner_provider` 通过全部 8 个测试；`python3 -m unittest tests.test_memory_provider tests.test_remote_runner_provider` 通过 `13 tests, skipped=3`；`python3 -m compileall src tests` 通过；`./scripts/harness-check.sh` 通过 0 warning；隔离 `REMOTE_RUNNER_STATE_DIR` 的 no-SSH local smoke 返回 provider ready 和空机器列表；`cd frontend && npm test -- --run` 通过 1 个测试。
- 状态：本地代码和测试已准备好，等待真实 SSH smoke。

### 2026-05-12 - 完成 Remote Runner 本地 adapter 原型并通过 linux-01 真实连通验证

- 在 Socratic 侧实现 CLI-backed `RemoteRunnerProvider`，并通过 `observe_remote_environment` LangChain tool 将其注入 Tutor。
- 增加配置项、allowlist、cwd 限制、输出截断和脱敏，保持默认关闭，避免未授权机器或命令被调用。
- 本地验证通过：`python3 -m unittest tests.test_remote_runner_provider`、`_local/socratic-smoke-venv/bin/python -m unittest tests.test_remote_runner_provider`、`python3 -m unittest tests.test_memory_provider tests.test_remote_runner_provider`、`python3 -m compileall src tests`、`./scripts/harness-check.sh`、`cd frontend && npm test -- --run`。
- 真实连通验证通过：`linux-01` 的 `machine doctor` 返回 reachable/auth/default_cwd 均为 true；创建 session 后用 `pwd` 成功返回 `/home/ely`；随后会话已销毁。
- 当前结论：Remote Runner 基础接口可直接用于 Socratic 的环境观察原型，后续可在新分支上继续做写操作、审计和 UI。

### 2026-05-13 - linux-01 部署尝试被 SSH 认证阻塞

- 本地重新生成部署包：`/tmp/socratic-deploy.ccCbya/socratic-agent-generator.tar.gz`，内容来自当前 `remote-tool` HEAD，并追加 `/Users/ely/workspace/research/agent/DreamingRAG/.env` 为 Socratic 运行 `.env`；未输出密钥内容。
- 交叉验证结果：`remote-runner machine doctor linux-01 --json` 返回 `reachable=false`、`auth_ok=false`、`Authentication failed.`；`session exec` 和 `file put` 同样失败；OpenSSH password auth 使用 Remote Runner 保存密码连续被远端拒绝。
- 结论：当前阻塞不是已确认的 SFTP-only 问题，而是 `linux-01` 的 Remote Runner 认证配置过期或与远端不匹配。
- 已提出 SEEDRunner 工具侧 issue：`https://github.com/ElysiaFollower/SEEDRunner/issues/2`，要求 `session create` 在认证不可用时不要返回误导性的 active session。
- 已清理本次创建的无效 Remote Runner session，日志保留在本地 Remote Runner 状态目录。

### 2026-05-13 - 开启真实 SEED 实验 Profile 手工校准任务

- 创建并切换分支 `manual-enhance`；`dev/manual-enhance` 因本地已有 `dev` 分支无法创建。
- 创建 active plan：`plans/active/20260513-manual-profile-calibration.md`。
- 将 `seed-manual-profile-calibration` 设置为当前唯一 active feature。
- 初步语料定位：`/Users/ely/workspace/research/agent/SEEDRunner/runs` 包含 VPN_Tunnel、ARP_Attack、LocalDNSAttack、RemoteDNSAttack、Sniffing_Spoofing、TCP_Attacks；`mine/` 下有手写实验材料和报告，其他目录有已核验自动报告和 `.tex` 实验文档。
- 环境检查：`_local/socratic-smoke-venv/bin/python` 可导入 `langchain_deepseek` 和 `langchain_core`；Socratic `.env` 无 LLM key，DreamingRAG `.env` 有 DeepSeek key，可在不输出密钥的前提下用于 generator。

### 2026-05-13 - 完成真实 SEED 实验 Profile 手工校准

- 新增 `scripts/generate_manual_enhance_profiles.py`，从外部 SEEDRunner runs 读取 `.tex`、手写报告和已核验自动报告，用当前 generator 生成初始 profile；运行时通过 DreamingRAG `.env` 加载 DeepSeek key，但未复制或输出密钥。
- 新增 `scripts/build_manual_enhance_calibrated_profiles.py`，根据人工比对结果生成校准版 profile，并保持 `generated/` 初稿和 `calibrated/` 校准版分离。
- 新增 `docs/manual-enhance/`：包含 `corpus-manifest.json`、6 个实验的初稿、6 个实验的校准版 profile、`calibrated-profile-summary.json`、`mismatch-taxonomy.json` 和 README。
- 覆盖实验：ARP_Attack、LocalDNSAttack、RemoteDNSAttack、Sniffing_Spoofing、TCP_Attacks、VPN_Tunnel。RemoteDNSAttack 只有 draft notes，可信度低于其他有手写或详细报告的实验。
- 归纳 mismatch 模式：环境摩擦被省略、成功标准过度确定、负例没有成为学习节点、证据链不足、任务粒度不贴合真实认知负担、源文档编号问题未被校正。
- 新增 `tests/test_manual_enhance_profiles.py`，校验校准 profile schema、外部语料引用策略、mismatch 可追溯性和初稿/校准版分离。
- 验证：`./scripts/harness-check.sh` 通过且 0 warning；`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_manual_enhance_profiles.py -q` 通过 4 个测试；`python3 -m compileall src scripts tests` 通过。
- 状态：`seed-manual-profile-calibration` 标记为 `passing`；计划归档到 `plans/archive/20260513-manual-profile-calibration.md`。

### 2026-05-13 - 完成默认校准 Profile 自动导入

- 创建 active plan：`plans/active/20260513-default-seed-profiles.md`，完成后归档到 `plans/archive/20260513-default-seed-profiles.md`。
- 新增 `src/utils/default_profile_seed.py`，从 `docs/manual-enhance/calibrated/*/profile.json` 读取并校验 6 个校准 profile，在 SQLite `profiles` 表中按 `profile_id` 幂等插入或更新。
- 更新 `src/core/database.py`，在 `init_db()` 建表后自动调用默认 profile seed；因此新部署启动后自带这 6 个 profile。
- 更新 `src/utils/profile_manager.py`，让 `owner_id is None` 且 `visible_class_ids == []` 的内置 public profile 对没有 class 的 student 也可见；admin 和 teacher 仍按已有逻辑可见。
- 新增 `tests/test_default_profile_seed.py`，覆盖 fresh DB 导入、重复 seed 幂等更新和 student 无 class 可见。
- 更新 `docs/manual-enhance/README.md`，记录 calibrated profile 会作为内置 public profile 在启动时导入。
- 验证：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_default_profile_seed.py tests/test_manual_enhance_profiles.py -q` 通过 6 个测试；`python3 -m compileall src scripts tests` 通过；启动 smoke 输出 `builtin_public_count= 6`；`./scripts/harness-check.sh` 通过且 0 warning。
- 状态：`default-seed-profiles` 标记为 `passing`。

### 2026-05-13 - 统一 Socratic 与 DreamingRAG embedding provider

- 修复部署阻塞：Socratic 原文档 RAG 启动时仍会加载 `sentence-transformers/all-MiniLM-L6-v2` 并访问 HuggingFace，与用户已配置的豆包/火山 embedding 路线不一致。
- 新增 `src/utils/embedding_provider.py`，实现 LangChain-compatible `VolcengineArkEmbeddings`，支持普通 `/embeddings` 文本模型和包含 `vision` 的 `/embeddings/multimodal` 模型。
- 更新 `src/utils/skills.py`，Socratic 文档 RAG 通过统一 factory 获取 embeddings；默认 provider 为 `EMBEDDING_PROVIDER=volcengine`。
- 更新 `src/utils/model_manager.py`，默认火山 provider 下跳过 HuggingFace 模型下载；只有显式 `EMBEDDING_PROVIDER=huggingface` 才检查和下载本地模型。
- 更新 `.env.example`、`docs/deployment.md` 和 `requirements.txt`，把 Volcengine embedding 作为 Socratic 文档 RAG 与 DreamingRAG memory 的共享默认配置。
- 发现并修复一个演示流程 bug：student 能看到内置 public profile，但创建 session 时仍被 class visibility 检查拦截。`src/api/routes/session.py` 现在允许 `owner_id is None` 且 `visible_class_ids == []` 的内置 public profile 创建 student session。
- 验证：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_embedding_provider.py tests/test_memory_provider.py tests/test_remote_runner_provider.py tests/test_default_profile_seed.py tests/test_manual_enhance_profiles.py -q` 通过 22 passed；`python3 -m compileall src tests` 通过；`./scripts/harness-check.sh` 通过 0 warning；`check_and_download_models()` 输出 `(True, [], [])`。

### 2026-05-13 - 完成 linux-01 最终演示部署

- 将当前 `rag-memory-adapter` 分支部署到 `linux-01` 的 `/home/ely/deploy/socratic-live/`，旧 Socratic runtime data 已按用户授权清理。
- 服务通过 tmux 持久运行：`socratic-backend` 监听 `0.0.0.0:8000`，`socratic-frontend` 监听 `0.0.0.0:5173`。
- 远端 `.env` 确认有 DeepSeek 与 Volcengine key，embedding provider 为 `volcengine`，模型为 `doubao-embedding-vision-251215`；未打印密钥。
- 远端验证通过：focused pytest 22 passed；`model_check= (True, [], [])`；`embedding_class= VolcengineArkEmbeddings`；默认 public profile count 为 6。
- 外部可访问验证通过：`http://10.203.15.128:8000/api/health` 返回 `{"status":"ok"}`；`http://10.203.15.128:8000/docs` 返回 Swagger HTML；`http://10.203.15.128:5173` 返回前端 HTML。
- 演示流程 smoke 通过：demo 用户可登录，`/api/profiles` 返回 6 个 SEED profile，并可创建 session。
- 状态：`linux01-live-deployment` 标记为 `passing`；计划归档到 `plans/archive/20260513-linux01-live-deployment.md`。

### 2026-05-13 - 修复 linux-01 首条消息 `yes` 兜底报错

- 复现结果：demo 用户登录、profile 列表和 session 创建都成功，但向新 session 发送 `yes` 会立刻返回“抱歉，我在生成回复时遇到了问题。请稍后再试。”。
- 根因 1：远端 DeepSeek key 已失效，日志显示 `401 Authorization Required` 和 `Authentication Fails, Your api key: ****9679 is invalid`。
- 根因 2：在远端缺少 `data/skills/*/SKILL.md` 的部署环境里，`BaseSkill.name` 统一回退成 `unknown_skill`，导致 DeepSeek 报 `Tool names must be unique.`。
- 修复：先把本地校验通过的 DreamingRAG `.env` 同步到 linux-01，再把 `BaseSkill.name` 改为在 metadata 缺失时回退到技能目录名，并补回归测试。
- 验证：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_skill_names.py tests/test_embedding_provider.py tests/test_memory_provider.py tests/test_remote_runner_provider.py tests/test_default_profile_seed.py tests/test_manual_enhance_profiles.py -q` 通过 24 passed；`python3 -m compileall src tests` 通过；`./scripts/harness-check.sh` 通过 0 warning；远端 smoke 重新验证 `yes` 后返回正常导师回复，`token_events=93`，`end_seen=True`，`error_seen=None`。

### 2026-05-13 - 修复 linux-01 `yes` 回复提前截断

- 复现结果：新的 `yes` 会话能开始正常对话，但某些 session 会在查找实验手册的多轮工具调用后提前结束，只留下“让我再查一下”的中间语句。
- 根因：`LANGCHAIN_MAX_ITERATIONS` 默认值过低，且 AgentExecutor 在触及 stop condition 时直接收尾，导致工具驱动回复没有机会生成完整结论。
- 修复：把 LangChain agent 的最小迭代数提高到 5，并把 early stopping 改为 `generate`，让模型在到达上限时补出最终答复而不是只返回中间思考。
- 验证：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_skill_names.py tests/test_tutor_executor.py tests/test_embedding_provider.py tests/test_memory_provider.py tests/test_remote_runner_provider.py tests/test_default_profile_seed.py tests/test_manual_enhance_profiles.py -q` 通过 25 passed；`python3 -m compileall src tests` 通过；远端重启后 smoke 重新验证 `yes` 返回 102 个 token，`end=True`，`error=None`，并输出完整后续提问，而不再停在“Let me try a broader search”。

### 2026-05-13 - 完成 linux-01 admin 全链路真实对话 smoke

- 使用远端 `admin` 账号登录 linux-01 上的 Socratic 服务，选择 `VPN_Tunnel manual calibrated` profile，创建新 session，并连续发送两轮真实消息。
- 第一轮发送 `yes`，返回完整引导式提问而非中断文案。
- 第二轮发送对拓扑和路由的简短回答，系统继续追问并给出分步引导。
- 会话通过 `/api/sessions/{session_id}` 读取回验证，`history_len=5`，说明对话历史已经落库并可用于后续展示或继续对话。
- 结果：这个部署不仅能跑，还能完成一段真实、可回看的教学会话。

### 2026-05-13 - 完成 linux-01 学生困难路径完整实验会话

- 使用远端学生账号创建并完成 `Sniffing_Spoofing manual calibrated` 会话：`362d3773-bc6e-41e2-a97e-bc76f82c54a1`。
- 为该 profile 上传本地 SEEDRunner `Sniffing_Spoofing.tex` 实验文档，并创建 DB-backed custom skill `custom_sniffing_spoofing_lab_search`；索引重建成功，生成 51 个 chunk。
- 真实测试了“不完全懂行学生”路径：学生先问权限/接口困惑，导师调用实验文档 RAG，定位 `br-xxxxx` 接口和 root 权限线索，并把问题拆成接口与权限两个子问题。
- 在 BPF 过滤器节点故意提交不完整答案，导师再次调用文档检索，指出 `ping` 不是 BPF 关键字，解释应使用 `icmp`、`tcp port 23`、`src net ...` 等协议/端口/地址表达式；该轮没有推进 step。
- 补充正确答案后继续完成所有步骤，最终 `/api/tutor/362d3773-bc6e-41e2-a97e-bc76f82c54a1/state` 返回 `{"stepIndex":9,"totalSteps":9,"isFinished":true}`，会话历史 `history_len=30`，最后消息为完成提示。
- 修复测试中暴露的流式稳定性问题：SSE 客户端断开时清理 `evaluation_pending` 锁；通过步骤后的过渡消息改为本地确定性生成，避免额外 LLM 调用拖住 `END`；完成态统一为 `stepIndex >= totalSteps`。
- 验证：`python3 -m compileall src/api/routes/interaction.py src/schemas/session.py src/utils/tutor_core.py tests/test_session_progress.py` 通过；`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_tutor_executor.py tests/test_skill_names.py tests/test_default_profile_seed.py tests/test_session_progress.py -q` 通过 7 passed；`./scripts/harness-check.sh` 通过 0 warning；远端 health/frontend/session state 均通过。

### 2026-05-13 - 归档 live demo example sessions

- 用户确认通过 UI 观测验证系统有效；随后发现完整学生会话最初属于 `student_rag_demo_20260513`，不是导师演示使用的 `demo` 账号。
- 已在 linux-01 将学生完整会话 `362d3773-bc6e-41e2-a97e-bc76f82c54a1` 迁移到 `demo` 用户名下，并复制对应 DreamingRAG memory 目录；用 `demo` 登录 API 验证 `/api/sessions` 可见该会话，`history_len=30`。
- 补完 admin VPN 会话最后 TAP/TUN 节点，`65120875-88a4-48f8-b20c-0fade4b2e8c6` 最终返回 `stepIndex=10,totalSteps=10,isFinished=true`。
- 新增 `docs/examples/live-demo-sessions/`，提交两个预制 example JSON：admin VPN 完整会话和 demo 学生 Sniffing/Spoofing 困难路径完整会话；只提交导出的会话内容和 profile 元数据，不提交 SQLite、向量索引、日志、token 或密码。
- 新增 `tests/test_demo_session_examples.py`，校验 example 会话均为完成态、历史长度合理并标记不含凭据/API token。

### 2026-05-13 - 修复内置 Profile 的 lab manual 来源链路

- 用户指出 6 个默认 profile 虽然内容可用，但不是系统内生 `lab_manual -> profile -> 人工审核定稿` 路径里的数据，导致 Profile Management 和实验文档检索工具缺少真实 lab manual 元信息。
- 将 SEEDRunner `runs/` 下 6 个实验的 `.tex` 手册复制为版本化内置 artifact：`docs/manual-enhance/calibrated/*/lab_manual.tex`。仍不提交报告、截图、日志、PDF、数据库、向量索引或用户数据。
- 更新默认 seed：启动时为 6 个实验创建 owner_id=`builtin` 的内置 `Document` 记录，`storage_path` 指向版本化 `.tex`，`index_path` 指向 `data/vector_stores/builtin/<lab>`，并把内置 profile 的 `document_id` 关联到该文档。
- 更新 RAG 查找：`LabManualSkill` 支持按 `document_id` 精确定位文档和索引，`.tex` 走通用文本 splitter；避免同名 lab 文档时误用第一个 `lab_name`。
- 更新 Profile/API/UI：Profile schema/API 返回 `document_status` 和 `document_source`；Profile Management 卡片展示文档引用状态；Lab Manual Management 显示引用 profile 数。
- 更新删除语义：删除 lab manual 时返回并提示引用它的 profile，删除后清空这些 profile 的 `document_id`，profile 保留但文档引用变为 `unlinked`，而不是级联删除或禁止删除。
- 新增 `.tex` 上传支持；官方部署文档记录内置 SEED lab manual/profile seed、删除引用语义和部署 smoke。
- 验证：`python3 -m compileall src tests` 通过；`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_default_profile_seed.py tests/test_manual_enhance_profiles.py tests/test_demo_session_examples.py tests/test_session_progress.py tests/test_tutor_executor.py tests/test_skill_names.py -q` 通过 13 tests；`cd frontend && npm test -- --run` 通过；`cd frontend && npm run build` 通过；`./scripts/harness-check.sh` 通过 0 warning；`git diff --check` 通过。
