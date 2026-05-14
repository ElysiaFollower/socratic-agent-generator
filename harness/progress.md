# 进度日志

## 当前状态

- 当前功能项：无 active；`vnext-shell-evidence-panel` 已 passing。
- 当前任务计划：无 active；Shell/Evidence 面板计划已归档到 `plans/archive/20260514-shell-evidence-panel.md`。
- 上次验证：2026-05-14，remote machine focused tests 5 passed，`python3 -m compileall src tests` 通过，前端 test/build 通过，`./scripts/harness-check.sh` 0 warning，`git diff --check` 通过；Playwright 本地登录页 smoke 通过。
- 下一步最佳动作：提交并推送 `vnext-shell-evidence-panel` 分支，创建 PR 到 `dev`；后续开启 Profile Management 文档身份 UX。

## 状态约定

- `not_started`：尚未开始。
- `active`：当前唯一在制任务。
- `blocked`：缺少输入、环境、依赖或决策。
- `passing`：验证通过且 evidence 已记录。

## 日志

### 2026-05-13 - 开启 session-bound Remote Runner 导师工具任务

- 用户已审核通过 PR #16；已将 `feat: integrate vNext Socratic demo stack` 合并到 `dev`。
- 本地 `dev/...` 层级分支因已有 `dev` 分支无法创建，改为从最新 `dev` 创建分支 `remote-runner-session-tools`。
- 创建 active plan：`plans/active/20260513-remote-runner-session-tools.md`。
- 新增架构任务说明：`docs/architecture/remote-runner-session-tools.md`，明确 per-user 机器配置、per-session 机器绑定、Tutor session-bound Remote Runner skill、命令审计、credential 脱敏和 demo 学生完整实验验收。
- 将 `remote-runner-session-tools` 设置为当前唯一 active feature。
- 范围判断：之前的 Remote Runner 原型只是全局 env 开关和全局 allowlist，本任务要把它产品化为学生可配置、会话可绑定、Tutor 可真实执行实验命令并收集报告证据的能力。
- 下一步：先读 Remote Runner CLI 当前 machine/session/credential 接口，再设计并实现 Socratic 侧 DB model、API、UI、Tutor provider 注入和真实 `seed-lab` 验收路径。

### 2026-05-14 - 开启 Remote Runner 后台命令工具升级

- 用户确认上游 Remote Runner 已解决后台运行和显式 wait time 支持，要求 Socratic 侧跟进 agent 工具设计。
- 本地检查：`/Users/ely/workspace/research/agent/SEEDRunner` 在 `dev/remote-runner-background-commands` 分支，`git pull --ff-only` 已是最新。
- 已确认上游 CLI 形态：`remote-runner session exec --mode wait|background --timeout <seconds> --json`；`remote-runner session command list/show/result/wait/stop --json`。
- 创建 active plan：`plans/active/20260514-remote-runner-background-command-tools.md`。
- 将 `remote-runner-background-command-tools` 设置为当前唯一 active feature。
- 范围判断：这次只升级 Socratic 后端 agent 工具表面、provider 适配、tests 和 docs；不改前端布局，不重新做 linux-01 完整演示会话。
- 下一步：先扩展 provider 的 CLI action 支持，再把 session-bound skill 从单 router tool 改为多个明确工具，并保持旧调试路径兼容。

### 2026-05-14 - 完成 Remote Runner 后台命令工具升级

- `RemoteRunnerProvider` 新增 `session_exec_background`、`session_command_list`、`session_command_show/result`、`session_command_wait`、`session_command_stop`，并支持 `wait_timeout_seconds`。
- `SessionBoundRemoteEnvironmentSkill` 暴露显式 LangChain tools：`check_remote_connection`、`run_remote_command`、`start_remote_command`、`list_remote_commands`、`get_remote_command_result`、`wait_remote_command`、`stop_remote_command`；旧 `observe_remote_environment` 仍保留兼容。
- `Tutor` 工具收集支持 `get_tools()` flatten，同时兼容旧 `get_tool()`。
- 后端调试 API `POST /api/sessions/{session_id}/remote-command` 支持 action、command_id 和 wait_timeout_seconds，方便不用前端也能验证后台命令生命周期。
- 更新 `docs/architecture/remote-runner-session-tools.md` 和 `docs/deployment.md`，明确短命令同步执行与长命令后台生命周期的区别。
- 验证：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_remote_runner_provider.py tests/test_remote_machine_manager.py tests/test_skill_names.py -q` 通过 21 passed；`python3 -m compileall src tests` 通过；`./scripts/harness-check.sh` 通过 0 warning；`cd frontend && npm test -- --run` 通过；`git diff --check` 通过。
- 部署侧收口：linux-01 上 Socratic 已更新到当前 archive，SEEDRunner 也同步到支持 `--mode background` 的版本；重启 `socratic-backend`/`socratic-frontend` 后，`/api/health` 返回 OK，前端 HTTP 200。真实 demo session `42f4f635-4ab3-41a0-911a-233cf4cebe0d` 的 session-bound 工具 smoke 通过：`start_remote_command -> wait_remote_command -> get_remote_command_result -> list_remote_commands`，命令 `cmd_20260513_172642_504854_653050c4` 退出码 0，`wait_timed_out=false`，stdout 命中 `socratic-background-ok`。
- 状态：`remote-runner-background-command-tools` 标记为 `passing`，计划归档。

### 2026-05-14 - 记录下一阶段 vNext 目标

- 根据用户反馈更新 `docs/architecture/vnext-integrations.md`：Remote Runner 工具保持通用，不做过度教学化封装；教学策略由模型、profile、实验文档和上下文决定。
- 新增 vNext 目标：会话右侧 Shell/Evidence 面板、单实验端到端 benchmark、profile 生成质量评估体系、Profile Management 文档身份与元信息 UX。
- 更新 `docs/architecture/remote-runner-session-tools.md` 的 tool boundary，明确远程工具职责是连通、执行、生命周期管理、结构化反馈和审计。
- 创建 GitHub issue `https://github.com/ElysiaFollower/socratic-agent-generator/issues/18`，跟踪 Profile Management 中 lab manual/persona 元信息显示、文档重命名和 Generate Profile 文档选择难以核验的问题；实施前需要先决策 UX 方案。
- 这些目标均记录为 `not_started`，未开启 active plan。

### 2026-05-14 - 修复 PR17 安全 review 问题

- 读取 PR #17 reviewer 评论，确认两个问题：远程机器密码在缺少 `REMOTE_MACHINE_SECRET_KEY` 时会明文存储；Remote Runner 命令策略空配置时会默认 allow-all。
- 修复 `RemoteMachineManager`：继续使用 `cryptography.fernet.Fernet`，但缺失或无效 key 时 password auth 远程机器保存/解密直接失败，不再明文 fallback。
- 修复 `RemoteRunnerProvider`：`allowed_commands` 和 `allowed_command_prefixes` 均为空时拒绝执行命令。
- 更新 `.env.example`、`docs/deployment.md`、`docs/architecture/remote-runner-session-tools.md`，记录 Fernet key 生成方式和命令策略 deny-all 语义。
- 验证：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_remote_machine_manager.py tests/test_remote_runner_provider.py -q` 通过 22 passed；`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_remote_runner_provider.py tests/test_remote_machine_manager.py tests/test_skill_names.py -q` 通过 24 passed；`python3 -m compileall src tests` 通过；`./scripts/harness-check.sh` 0 warning；`git diff --check` 通过。
- 状态：`pr17-security-review-fixes` 标记为 `passing`，计划归档。

### 2026-05-14 - 完成单实验端到端 Benchmark

- PR #17 已合并到 `dev`；本地/远端已删除已合入 `dev` 的完成分支 `manual-enhance`、`rag-memory-adapter`、`remote-tool`，PR head `remote-runner-session-tools` 已删除。
- 检查集成仓库：DreamingRAG `dev` 和 SEEDRunner `dev/remote-runner-background-commands` 均 `git pull --ff-only` 后 up to date。
- 创建分支 `vnext-single-lab-e2e-benchmark`，实现 `scripts/benchmarks/single_lab_e2e.py`。
- benchmark 通过后端 API 驱动：login、profile selection、session create、optional remote machine binding、optional LabSetup upload/remote-put、sync remote smoke、optional background start/wait/result smoke、streamed Tutor turns、final progress、remote audits、step completions。
- 新增 `docs/benchmarks/single-lab-e2e.md`，记录 linux-01 真实运行命令和环境变量；不在仓库保存密码、JWT、远程机器凭据或运行时输出。
- 新增 `tests/test_single_lab_e2e_benchmark.py`，覆盖 SSE 解析、成功路径、profile failure、turns file loading 和 background command lifecycle。
- 验证：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_single_lab_e2e_benchmark.py -q` 通过 5 passed；`python3 -m compileall scripts tests` 通过；`./scripts/harness-check.sh` 0 warning；`git diff --check` 通过。真实 linux-01 benchmark 未在本提交运行，因为仓库和 shell 中没有保存 benchmark password。
- 状态：`vnext-single-lab-e2e-benchmark` 标记为 `passing`，计划归档。

### 2026-05-14 - 完成会话 Shell/Evidence 面板

- PR #19 已合并到 `dev`，从最新 `dev` 创建分支 `vnext-shell-evidence-panel`。
- 后端 `RemoteCommandAudit` 增加 `create_at` 非敏感时间字段，方便前端展示命令执行顺序。
- 前端新增 `SessionEvidencePanel`，会话顶栏新增终端图标；面板从 `/api/sessions/{session_id}/remote-audits` 读取当前会话审计记录，以 tab 形式显示命令/action/status，并展示 cwd、时间、stdout/stderr/error 摘要。
- 面板只读，不提供任意 Web terminal，不绕过 Tutor/session-bound Remote Runner 权限模型。
- 更新中英文 i18n、frontend API/types、`docs/architecture/vnext-integrations.md` 和 harness 状态。
- 验证：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_remote_machine_manager.py -q` 通过 5 passed；`python3 -m compileall src tests` 通过；`cd frontend && npm test -- --run` 通过；`cd frontend && npm run build` 通过；`./scripts/harness-check.sh` 0 warning；`git diff --check` 通过。Playwright 本地 smoke 成功打开 `http://127.0.0.1:5174/login`；仅观察到既有 favicon 404、React Router future warning 和 Emotion duplicate warning。
- 状态：`vnext-shell-evidence-panel` 标记为 `passing`，计划归档。

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
- 已同步部署到 linux-01：通过 Remote Runner 上传 `c014790` 的 git archive，解包到 `/home/ely/deploy/socratic-live/socratic-agent-generator`，重启 `socratic-backend` 和 `socratic-frontend` 两个 tmux session。远端验证：`/api/health` 返回 OK，前端 HTTP 200，数据库检查输出 `linked_builtin_profiles=6`、`builtin_documents=6`，后端日志确认 `EMBEDDING_PROVIDER=volcengine` 并跳过 HuggingFace 下载。

### 2026-05-13 - 处理 PR #16 绝对路径可迁移性评论

- 查看 Gemini Code Assist 在 PR #16 的评论，确认 critical 点为 `src/utils/default_profile_seed.py` 中硬编码 `/Users/ely/.../SEEDRunner/runs`，另有 `.env.example` 和 `docs/manual-enhance/README.md` 中的本机路径示例。
- 修复运行时代码：删除 `ORIGINAL_SEEDRUNNER_MANUALS`，内置 Document metadata 只记录 repo-relative `source_artifact_path`，不再写入外部绝对路径。
- 修复生成脚本：`scripts/generate_manual_enhance_profiles.py` 改为通过 `--runs-root`、`SEEDRUNNER_RUNS_ROOT` 或 sibling `../SEEDRunner/runs` 定位外部语料；manifest 中记录相对路径和环境变量提示。
- 修复文档/配置：`.env.example` 使用 `/path/to/your/...` placeholder；`docs/manual-enhance/README.md` 的复现命令改为 placeholder；`corpus-manifest.json` 不再包含本机绝对路径。
- 验证：`rg -n "/Users/ely|/home/ely|/root/miniconda3|ORIGINAL_SEEDRUNNER|external_source_path" src scripts tests .env.example docs/manual-enhance -S` 无命中；`python3 -m compileall scripts/generate_manual_enhance_profiles.py src tests` 通过；focused pytest 13 passed；前端 test/build 通过；`./scripts/harness-check.sh` 通过 0 warning；`git diff --check` 通过。

### 2026-05-13 - 实现 session-bound Remote Runner 工具主链路

- 新增 per-user 实验机配置、session remote binding 和 remote command audit 三类持久模型；Settings API/UI 支持新增、编辑、测试、删除实验机，创建会话时可选择用户自己的实验机。
- Tutor remote skill 改为 session-bound：有绑定机器的会话才注入 `observe_remote_environment`，工具固定使用该绑定的 Remote Runner machine/session，并把每次命令或错误写入审计。
- 新增会话文件缓存和 LabSetup 链路：用户可以在聊天会话中上传文件，后端可把缓存文件转存到绑定实验机；删除会话时清理会话缓存。
- 新增后端调试 API：`GET/POST /api/sessions/{session_id}/files`、`POST /api/sessions/{session_id}/files/{filename}/remote-put`、`POST /api/sessions/{session_id}/remote-command`，与 Tutor 使用同一套 binding、policy 和 audit 逻辑。
- 修复部署可用性：增加 `REMOTE_RUNNER_PYTHON_EXECUTABLE`，便于 Socratic 与 Remote Runner 分别由不同 conda 环境维护；官方部署文档同步 Remote Runner、session file cache 和 debug API。
- 真实 `seed-lab` API smoke 通过：`demo` 用户创建 Sniffing/Spoofing remote-bound session `92ccedf3-c448-44e6-8537-1f62e58719c2`，绑定 Remote Runner session `sess_20260513_121525_193889_2c50ecbe`；上传本地 SEEDRunner `Sniffing_Spoofing/Labsetup/docker-compose.yml` 到会话缓存，转存到远程 LabSetup 目录，运行 `mkdir -p .../volumes`、`docker-compose up -d`、`docker-compose ps`、`docker ps ...`、`docker exec seed-attacker ip addr` 均返回 exit 0；审计记录 6 条。
- Tutor-bound skill 也通过真实调用验证：直接从该 Socratic session 加载 `get_remote_environment_skill(session=...)`，调用 `run_command` 执行 `docker ps --format '{{.Names}}'` 成功返回 seed-lab 容器输出并追加审计；验证后已 destroy 相关 Remote Runner probe/session，日志保留在本地 Remote Runner log 目录但不提交。
- 验证：`./init.sh` 通过；`./scripts/harness-check.sh` 通过 0 warning；`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_remote_runner_provider.py tests/test_remote_machine_manager.py tests/test_session_file_manager.py tests/test_session_progress.py tests/test_skill_names.py -q` 通过 18 passed；`python3 -m compileall src tests` 通过；`cd frontend && npm test -- --run` 通过；`cd frontend && npm run build` 通过；`remote-runner machine doctor seed-lab --json` 返回 reachable/auth/default_cwd 全 true；`git diff --check` 通过。
- 剩余限制：本地仓库没有真实 LLM/embedding API key，完整“学生弱理解路径 + Tutor 多轮自然语言完成全部课程节点”的真实 LLM 会话尚未在本分支本地跑完；已有 linux-01 旧基线验证过完整 Sniffing/Spoofing 对话，但它尚未包含本分支新增的 remote-bound tool。

### 2026-05-13 - 完成 linux-01 session-bound Remote Runner 全实验验收

- 将本分支部署到 linux-01 的 `/home/ely/deploy/socratic-live/socratic-agent-generator`，Remote Runner 以 `/home/ely/deploy/socratic-live/SEEDRunner` 安装到 `SocraticAgent` conda 环境；后端和前端分别运行在 tmux `socratic-backend`、`socratic-frontend`。
- 通过后端 API 为 `demo` 学生配置 `seed-lab` 机器，绑定 linux-01 可访问的 `ssh -p 2222 seed@localhost` 实验机；连接测试返回 ready。
- 完成最终真实会话：Socratic session `42f4f635-4ab3-41a0-911a-233cf4cebe0d`，Remote Runner session `sess_20260513_144634_689262_63b90a86`，profile 为 Sniffing/Spoofing。
- LabSetup 由系统包办：通过 session file API 上传 `docker-compose.yml`，remote-put 到 `/home/seed/socratic-labs/<session>/Sniffing_Spoofing/Labsetup/docker-compose.yml`，创建 `volumes/`，运行 `docker-compose up -d`、`docker-compose ps` 和 `docker ps` 成功。
- Tutor 在完整自然语言会话中使用 session-bound `observe_remote_environment`，完成 9/9 个课程节点，最终 state 为 `stepIndex=9,totalSteps=9,isFinished=true`，history_len=27，remote audit 16 条。
- 导出脱敏 example：`docs/examples/live-demo-sessions/remote-runner-sniffing-spoofing-final.json`；不包含 token、私钥、密码或数据库。
- 修复验收暴露的问题：linux-01 当前 LangChain classic 不支持 `early_stopping_method=generate`，改为 `force`；`REMOTE_TOOL_AGENT_IDLE_TIMEOUT` 默认降到 15 秒，避免学生因工具调用等待过久；`LANGCHAIN_MAX_ITERATIONS` 默认设为 4，避免一次 Tutor 轮次无限工具循环。
- 记录上游接口缺口：Remote Runner 当前只有同步 `session exec --timeout`，不适合 packet capture、server、长 build 等持久命令；已在 SEEDRunner 提 issue `https://github.com/ElysiaFollower/SEEDRunner/issues/3`，建议提供 `run_and_wait`、`run_background`、`get_command_result` 三段式接口。
- 验证：`python3 -m compileall src` 通过；`./scripts/harness-check.sh` 通过 0 warning；远端后端 `/api/health` 返回 OK；最终验证脚本返回 `VALIDATION_OK 42f4f635-4ab3-41a0-911a-233cf4cebe0d`。

### 2026-05-13 - 调整会话页顶栏实验机与文件入口

- 用户反馈会话页底部的常驻文件面板太碍眼，期望把实验机选择放进会话信息顶栏，并把文件上传收纳为旁边的小入口。
- 实现：会话头部新增实验机切换按钮与会话文件按钮，文件面板改为顶栏弹出式，输入栏上方不再常驻显示。
- 后端补充 `PUT /api/sessions/{session_id}/remote-binding`，支持会话创建后切换或解绑实验机；切换时重建 Remote Runner session，并保持 tutor 侧绑定一致。
- 文档同步：`docs/deployment.md` 与 `docs/architecture/remote-runner-session-tools.md` 补充会话后切换/解绑实验机和顶栏文件入口的约定。
- 验证：`./scripts/harness-check.sh` 通过 0 warning；`python3 -m compileall src` 通过；`cd frontend && npm test -- --run` 通过；`cd frontend && npm run build` 通过；`git diff --check` 通过。
- 补充：`SessionManager` 的 session summary 现在也携带 `default_cwd`，让顶栏弹出式文件面板能继承实验机默认工作目录；上述验证已在最新改动后重跑并通过。

### 2026-05-14 - 完成 Profile Management 文档身份与元信息 UX

- 修复 lab manual readiness：列表不再只看同目录 `definition.json` / `curriculum.json`，也会读取引用该 document 的 profile 中是否已有 persona hints、target audience 和 curriculum，避免内置校准 profile 显示“有 curriculum、无 persona”的误导。
- 后端 lab manual 列表增加稳定 `document_id`、`display_name`、filename、owner、相对 source/index path、size、preview excerpt 和引用 profile 列表；所有路径对外保持 repo-relative 或文件名，不暴露本机绝对路径。
- 新增 display name 更新 API：只改 `Document.meta_info.display_name`，不改 `doc_name`、存储路径、索引路径或 profile 的 `document_id` 引用。
- 新增按 `document_id` 查看/删除 lab manual 的 API，旧的按 `lab_name` API 保留兼容；前端管理页优先使用 ID，避免 admin 视角下同名文档误查看/误删。
- Lab Manual Management 支持编辑显示名、搜索显示名/文件名/来源，并保留删除前显示引用 profile 的语义。
- Generate Profile 文档选择列表增加只读身份卡、引用数、source path、文件大小和短 preview；完整查看、删除、重命名仍保留在 Lab Manuals 管理入口。
- 计划已归档到 `plans/archive/20260514-profile-management-document-identity.md`，功能项 `vnext-profile-management-document-identity` 标记为 passing。
- 验证：`./scripts/harness-check.sh` 通过 0 warning；`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_default_profile_seed.py -q` 通过 6 passed；`python3 -m compileall src tests` 通过；`cd frontend && npm test -- --run` 通过；`cd frontend && npm run build` 通过；`git diff --check` 通过。

### 2026-05-14 - 完成 Profile 生成质量评估第一版

- 新增 `scripts/benchmarks/profile_generation_eval.py`，离线比较候选 generated profiles 与人工 calibrated profiles，不调用 LLM、不需要 provider key。
- 固定评分维度：profile/step 结构完整性、persona 完整性、curriculum alignment、manual calibration mismatch risk coverage。
- 风险检查复用 `docs/manual-enhance/mismatch-taxonomy.json`，覆盖环境摩擦、过度确定成功标准、负例/失败实验、证据链、任务粒度和 TCP 源文档编号问题。
- 新增 `docs/benchmarks/profile-generation-evaluation.md`，记录命令、指标、权重、阈值和当前基线。
- 新增 `tests/test_profile_generation_eval.py`，覆盖真实 6 个 SEED profile 可评分、弱 profile 分数下降、完全匹配 curriculum alignment。
- 当前基线：`profile_generation_eval score=0.7343 status=warn labs=6 pass=2 warn=4 fail=0`。这是 generated draft 对 calibrated profile 的质量差距信号，不要求全部 pass。
- 计划已归档到 `plans/archive/20260514-profile-generation-evaluation.md`，功能项 `vnext-profile-generation-evaluation` 标记为 passing。
- 验证：`./scripts/harness-check.sh` 通过 0 warning；`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_profile_generation_eval.py -q` 通过 3 passed；`python3 -m compileall scripts tests` 通过；`python3 scripts/benchmarks/profile_generation_eval.py --json` 返回 score 0.7343/status warn/lab_count 6。

### 2026-05-14 - 同步最终 vNext 状态到 linux-01

- `dev` 已包含 Remote Runner session tools、Shell/Evidence 面板、单实验 E2E benchmark、Profile Management 文档身份 UX 和 Profile 生成质量评估第一版。
- 通过 Remote Runner `linux-01` 上传 `0af3a48` archive 到 `/home/ely/deploy/socratic-live/`，保留旧 `.env`、`data/`、`frontend/node_modules` 和 `frontend/dist`，切换应用目录并保留备份 `/home/ely/deploy/socratic-live/socratic-agent-generator.prev-20260514050023`。
- 远端运行 `python3 scripts/benchmarks/profile_generation_eval.py` 通过，输出 `score=0.7343 status=warn labs=6 pass=2 warn=4 fail=0`。
- 已重启 tmux `socratic-backend` 和 `socratic-frontend`；后端日志显示 `EMBEDDING_PROVIDER=volcengine` 并跳过 HuggingFace 下载。
- 可访问性验证：本地访问 `http://10.203.15.128:8000/api/health` 返回 `{\"status\":\"ok\"}`，`http://10.203.15.128:5173` 返回 HTTP 200；linux-01 本机 curl 同样返回后端 OK、前端 200。

### 2026-05-14 - 固化 live benchmark 的 `.env` 配置约定

- 用户明确 benchmark 使用者应在 `.env` 中提供测试用户和实验机器；当前演示场景使用 admin 用户，以及 admin Settings 中已有的 `SEED Lab on linux-01` 实验机配置。
- `scripts/benchmarks/single_lab_e2e.py` 现在会在构建参数默认值前加载 `.env`，也支持 `--dotenv` 或 `SOCRATIC_BENCHMARK_DOTENV` 指定其他配置文件。
- live benchmark 默认用户名改为 `admin`，默认要求提供 `SOCRATIC_BENCHMARK_REMOTE_MACHINE`；只有显式 `--allow-no-remote-machine` / `SOCRATIC_BENCHMARK_ALLOW_NO_REMOTE_MACHINE=true` 才允许非远程弱 smoke。
- `.env.example` 和 `docs/benchmarks/single-lab-e2e.md` 已补充 linux-01 当前推荐配置：`SOCRATIC_BENCHMARK_BASE_URL=http://10.203.15.128:8000`、`SOCRATIC_BENCHMARK_USERNAME=admin`、`SOCRATIC_BENCHMARK_REMOTE_MACHINE=\"SEED Lab on linux-01\"` 等。
- 验证：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_single_lab_e2e_benchmark.py -q` 通过 7 passed；`python3 -m compileall scripts/benchmarks/single_lab_e2e.py tests/test_single_lab_e2e_benchmark.py` 通过；`./scripts/harness-check.sh` 通过 0 warning；`git diff --check` 通过。

### 2026-05-14 - 在 linux-01 真实部署环境运行 live single-lab benchmark

- 按用户要求在 linux-01 部署机的真实服务上运行 `scripts/benchmarks/single_lab_e2e.py`，使用 admin 测试用户、Profile `Sniffing_Spoofing manual calibrated` 和 admin Settings 中的 `SEED Lab on linux-01` 实验机配置。
- 运行前将本地 `07d600d` 同步到 `/home/ely/deploy/socratic-live/socratic-agent-generator`，保留部署 `.env`、`data/`、`frontend/node_modules`、`frontend/dist`，重启 tmux `socratic-backend` 与 `socratic-frontend`；后端 `/api/health` 返回 OK，前端 HTTP 200。
- 如部署机原有 admin 配置中没有该实验机，则通过后端 Settings API 创建 `SEED Lab on linux-01`，连接测试返回 `ready Connection ready.`。
- benchmark 真实执行结果未通过最终验收：`stage=final_validation`，错误为 `Session did not finish within the scripted turns.`；session `df650fd7-3bba-43fa-b3c7-ffbbcba7c75b`，profile `3b76689b-1cea-4961-a68b-6b4bd5743e00`，remote machine `8460e4fe-6217-470f-86e0-1d667f00f166`。
- 失败时 `turns_sent=7`，`final_progress={isFinished:false, stepIndex:0, totalSteps:9}`，`step_completion_count=0`，但 `remote_audit_count=37`，说明登录、会话创建、profile 发现、实验机绑定和 remote tool 调用链路均可用，失败点在 Tutor 没有推动学习节点完成。
- 后端日志显示 evaluator 多次低置信度保守拒绝推进步骤，并出现 LangChain agent 因 stop condition 提前停止；这是需要继续修复的教学策略/工具规划问题，而不是凭据或部署连通性问题。
- 脱敏结果文件保留在部署机 `/home/ely/deploy/socratic-live/logs/single-lab-e2e-live-result.json`；临时 `.benchmark.env` 和本地临时凭据文件已删除，Remote Runner 会话 `sess_20260514_061128_790975_7fada631` 已销毁。

### 2026-05-14 - 沉淀产品愿景与价值标准线

- 用户指出项目缺少单一权威入口来定义核心需求、终极目标和理想产品形态，导致实现时容易把 Tutor 做成工具执行 agent，而不是学习系统。
- 新增 `docs/product/vision.md`，明确 Socratic Tutor 的产品定位：用 AI 降低实验摩擦，让学生始终参与关键判断、关键推理和关键验证，在真实环境中 learning by doing。
- 文档同时包含速读总结和可长期引用的标准线：背景问题、核心痛点、产品使命、职责分工、理想学习循环、Tutor 行为硬标准、Profile/Benchmark/前端要求和设计判断问题。
- 文档保留两个真实场景例子：网络/系统实验中如何从长实验文档进入最小真实验证；复杂系统类或模块实现中如何让 Tutor 压缩代码库外围复杂度，但保留学生对职责、接口和状态流的理解。
- `docs/overview.md` 和 `AGENTS.md` 已增加产品愿景入口，`docs/.gitignore` 也显式允许 `docs/product/`，后续 prompt、profile、benchmark、Remote tool 和前端交互的设计分歧应优先回到该文档对齐。
- 验证：`./scripts/harness-check.sh` 通过 0 warning；`git diff --check` 通过。

### 2026-05-14 - 精炼产品原则，降低速读版认知偏差

- 用户反馈 `docs/product/vision.md` 的速读版仍偏抽象，容易让读者忽略本项目不是“禁用 AI”，而是重新分配学生、AI 和系统职责。
- 在 `docs/product/vision.md` 增加 `产品原则` 小节，明确反对两种低质量学习形态：传统实验的高摩擦低投入产出比，以及纯 AI 代做导致学生绕过思维过程。
- 进一步写清三方分工：学生负责理解、判断、解释和工程思维路径；AI 负责检索、整理、补全细节、执行命令和收集反馈；系统负责把大实验拆成连续小认知任务。
- 补充更具体的 learning-by-doing、Remote tool、Tutor 非工具循环和实验学习摩擦成本原则，作为后续实现、benchmark 和 prompt 校准的高优先级判断依据。

### 2026-05-14 - 按产品北极星校准设计文档和归档计划

- 用户要求从北极星出发，修正目前设计不合理的文档和计划，避免后续实现继续把系统推向工具执行 agent 或只看通关指标。
- `docs/architecture/vnext-integrations.md` 增加产品北极星入口，并把 Remote Runner、single-lab benchmark、profile generation evaluation 的目标改写为“降低外围摩擦、保留学生核心思考、避免工具循环和纯代做”。
- `docs/architecture/remote-runner-session-tools.md` 明确 remote tool 是通用反馈通道，命令返回后 Tutor 必须转化为当前学习问题、学生判断和证据链；同时更新会话机器绑定可切换的当前事实，并强化 acceptance demo 的学习质量要求。
- `docs/benchmarks/single-lab-e2e.md` 与 `docs/benchmarks/profile-generation-evaluation.md` 补充产品质量边界：`isFinished=true`、step completion、remote audit 和静态 profile 分数都是必要但不充分信号。
- `harness/evaluator-rubric.md`、`harness/quality.md` 和 `harness/decisions.md` 加入产品对齐要求：涉及 Tutor、profile、benchmark、Remote tool 或学习前端的变更必须检查是否替代了学生核心思考。
- 相关归档 plan 增加北极星校准说明，保留历史实现合同，但指向最新产品愿景和设计文档，避免未来照旧口径继续扩展。
