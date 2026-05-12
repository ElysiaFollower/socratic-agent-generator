# 会话交接

## 仓库状态

- 分支：`remote-tool`
- 基线：从 `rag-memory-adapter` 创建，包含远端 `origin/dev` 当前代码、repo-native harness 和默认开启的 DreamingRAG adapter。
- 当前功能项：`remote-runner-integration`，状态为 `passing`
- 当前计划：无 active；`plans/archive/20260512-remote-runner-tool-adapter-prototype.md` 已归档
- 当前目标：Socratic 侧 Remote Runner tool adapter 原型已完成并通过 linux-01 真实连通验证。

## 当前已验证状态

- Socratic `./init.sh`：通过，harness 检查 0 warning。
- SEEDRunner `./init.sh`：通过，harness 检查 0 warning。
- SEEDRunner CLI help：`python3 -m remote_runner.cli --help` 可运行，暴露 `machine`、`session`、`file`、`run` 命令组。
- SEEDRunner focused tests：`python3 -m pytest tests/test_remote_runner_mvp.py tests/test_remote_runner_launch_suite.py -q` 通过 `28 passed, 1 skipped`。
- SEEDRunner manager import smoke：`RemoteMachineManager`、`RemoteSessionManager`、`RemoteFileManager`、`RemoteRunManager` 可导入。
- SEEDRunner isolated state smoke：设置临时 `REMOTE_RUNNER_STATE_DIR` 后，`machine list --json`、`session list --json`、`run list --json` 均返回合法空 JSON。
- Socratic provider focused test：`python3 -m unittest tests.test_remote_runner_provider` 通过 `8 tests, skipped=3`；跳过项是 base python 未安装 `langchain_core` 时的 wrapper/Tutor 用例。
- Socratic full local wrapper test：`_local/socratic-smoke-venv/bin/python -m unittest tests.test_remote_runner_provider` 通过全部 8 个测试，覆盖 LangChain wrapper 和 Tutor 注入。
- Socratic regression test：`python3 -m unittest tests.test_memory_provider tests.test_remote_runner_provider` 通过 `13 tests, skipped=3`。
- 后端语法验证：`python3 -m compileall src tests` 通过。
- Harness：`./scripts/harness-check.sh` 通过，0 warning。
- No-SSH CLI smoke：`REMOTE_TOOL_ENABLED=true`、隔离 `REMOTE_RUNNER_STATE_DIR` 下，`RemoteRunnerProvider.observe(action="list_machines")` 返回 `status=ready`、`ok=true` 和空机器列表。
- 前端 smoke：`cd frontend && npm test -- --run` 通过 1 个测试。
- 真实连通 smoke：`linux-01` `machine doctor` 通过，session 创建成功，`pwd` 返回 `/home/ely`，随后 session destroy 通过。

## 本会话改动

- 创建并修正分支 `remote-tool`：最初从 `origin/dev` 创建时缺少 harness/RAG 状态，已删除并从 `rag-memory-adapter` 重建。
- 新增并归档 `plans/active/20260512-remote-runner-tool-adapter-prototype.md` / `plans/archive/20260512-remote-runner-tool-adapter-prototype.md`。
- 更新 `harness/feature_list.json`，将 `remote-runner-integration` 标记为 `passing`，并记录 Remote Runner readiness、本地实现和真实连通 evidence。
- 更新 `harness/progress.md`，写明当前状态、验证结果和后续方向。
- 新增 `src/utils/remote_runner_provider.py`，实现 CLI-backed provider、配置策略、命令允许列表、机器过滤、cwd 前缀限制、错误包装、输出截断和脱敏。
- 新增 `src/utils/remote_tool_skill.py`，实现 `observe_remote_environment` LangChain tool wrapper；配置关闭时不注入。
- 更新 `src/utils/tutor_core.py`，把远程环境 skill 纳入 Tutor runtime tools 和 prompt skill summary。
- 更新 `src/config.py` 和 `.env.example`，加入 Remote Runner tool adapter 配置。
- 新增 `tests/test_remote_runner_provider.py`，覆盖 provider、policy、sanitization、tool wrapper 和 Tutor 注入。

## 结论

Remote Runner 接口已经准备到足够开始 Socratic adapter 原型。当前不需要先让 SEEDRunner 项目补基础能力。

可直接依赖的能力：

- 结构化 CLI：`python3 -m remote_runner.cli ... --json`
- Python manager：machine/session/file/run 四类 manager 可导入
- 状态隔离：`REMOTE_RUNNER_STATE_DIR`
- 远程 SSH 后端：Paramiko 后端已存在
- 测试边界：fake/MVP 和 launch suite 已通过

Socratic 侧本地 adapter 原型已完成，且 linux-01 真实连通验证通过。

## 仍损坏或未验证

- Remote Runner API 文档中的 `--state-dir` 是目标全局选项；当前实现实际通过 `REMOTE_RUNNER_STATE_DIR` 环境变量控制状态目录。
- 没有 Web UI、授权弹窗或机器管理界面；本 active plan 第一版也不做这些。
- DreamingRAG real mode 依赖稳定性仍是 RAG 分支遗留约束，不属于 remote-tool 第一版目标。

## 清洁状态

- 运行态目录 `_local/`、`frontend/node_modules/`、`data/socratic_agent.db` 是 ignored，不应提交。
- 不应提交 Remote Runner 状态目录、真实 SSH 配置、日志、下载 artifact、数据库、记忆索引或用户数据。
- 完成本地阶段已运行并记录：`./scripts/harness-check.sh`、`python3 -m unittest tests.test_remote_runner_provider`、`_local/socratic-smoke-venv/bin/python -m unittest tests.test_remote_runner_provider`、`python3 -m unittest tests.test_memory_provider tests.test_remote_runner_provider`、`python3 -m compileall src tests`、`cd frontend && npm test -- --run`。

## 下一步最佳动作

1. 如需继续扩展 Remote Runner 的写操作、审计、session 管理或 Web UI，再开新分支。
2. 当前原型已可用，后续可把 `session create`/`destroy` 封装进 Socratic 侧工具时再继续。

## 命令

- 初始化：`./init.sh`
- Harness 检查：`./scripts/harness-check.sh`
- 后端语法验证：`python3 -m compileall src`
- Remote Runner provider focused test：`python3 -m unittest tests.test_remote_runner_provider`
- 前端单元验证：`cd frontend && npm test -- --run`
- 前端构建验证：`cd frontend && npm run build`
