# 进度日志

## 当前状态

- 当前功能项：`remote-runner-integration`，状态为 `blocked`。
- 当前任务计划：`plans/active/20260512-remote-runner-tool-adapter-prototype.md`。
- 上次验证：2026-05-12，Socratic `./init.sh` 通过；SEEDRunner Remote Runner readiness check 通过；Socratic 本地 adapter、LangChain tool wrapper、Tutor 注入、compileall、harness check、前端 smoke 和 no-SSH CLI smoke 通过。
- 下一步最佳动作：等待用户提供可连通的远程机器配置，再单独执行 opt-in 真实 SSH smoke；在此之前不连接真实 SSH。

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
- 状态：本地代码和测试已准备好，`remote-runner-integration` 暂标记为 `blocked`，只等待用户提供可连通机器后再做真实 SSH smoke。
