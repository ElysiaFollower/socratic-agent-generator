# 会话交接

## 仓库状态

- 分支：`remote-tool`
- 基线：从 `rag-memory-adapter` 创建，包含远端 `origin/dev` 当前代码、repo-native harness 和默认开启的 DreamingRAG adapter。
- 当前功能项：`remote-runner-integration`，状态为 `passing`
- 当前计划：无 active；`plans/archive/20260512-remote-runner-tool-adapter-prototype.md` 已归档
- 当前目标：Socratic 侧 Remote Runner tool adapter 原型已完成并通过 linux-01 真实连通验证；后续远端部署尝试被当前 SSH 认证配置阻塞。

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
- 部署包 smoke：`/tmp/socratic-deploy.ccCbya/socratic-agent-generator.tar.gz` 已生成，包含当前仓库文件、`src/app.py`、`frontend/package.json` 和追加的 `.env`。
- 当前 linux-01 认证 smoke：`remote-runner machine doctor linux-01 --json`、`session exec`、`file put` 和 OpenSSH password auth 均返回认证失败；说明 Remote Runner 保存的 `linux-01` 密码认证已不可用。

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
- 尝试将当前项目部署到 `linux-01`：本地包已准备好，但远端 SSH 认证失败，尚未移动旧目录或解包新版本。
- 在 SEEDRunner 创建 issue `https://github.com/ElysiaFollower/SEEDRunner/issues/2`，记录 `session create` 在认证失效时仍返回 active session 的诊断问题。

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
- `linux-01` 当前 Remote Runner 认证配置不可用：保存的 password auth 已被远端拒绝。需要更新机器配置为当前密码或 key auth 后，才能继续执行远端备份和部署。

## 清洁状态

- 运行态目录 `_local/`、`frontend/node_modules/`、`data/socratic_agent.db` 是 ignored，不应提交。
- 不应提交 Remote Runner 状态目录、真实 SSH 配置、日志、下载 artifact、数据库、记忆索引或用户数据。
- 完成本地阶段已运行并记录：`./scripts/harness-check.sh`、`python3 -m unittest tests.test_remote_runner_provider`、`_local/socratic-smoke-venv/bin/python -m unittest tests.test_remote_runner_provider`、`python3 -m unittest tests.test_memory_provider tests.test_remote_runner_provider`、`python3 -m compileall src tests`、`cd frontend && npm test -- --run`。
- 本次部署包位于 `/tmp/socratic-deploy.ccCbya/socratic-agent-generator.tar.gz`，是临时工件，不应提交。

## 下一步最佳动作

1. 更新 `linux-01` 的 Remote Runner 机器认证配置，建议改为 key auth 或写入当前可用密码。
2. 重新运行 `python3 -m remote_runner.cli machine doctor linux-01 --json`，确认 `auth_ok=true`。
3. 继续远端部署：备份 `/home/ely/socratic-agent-generator`，解包 `/tmp/socratic-deploy.ccCbya/socratic-agent-generator.tar.gz` 到 `/home/ely/socratic-agent-generator`，再校验 `.env` 存在且不输出密钥。
4. 如需继续扩展 Remote Runner 的写操作、审计、session 管理或 Web UI，再开新分支。

## 命令

- 初始化：`./init.sh`
- Harness 检查：`./scripts/harness-check.sh`
- 后端语法验证：`python3 -m compileall src`
- Remote Runner provider focused test：`python3 -m unittest tests.test_remote_runner_provider`
- 前端单元验证：`cd frontend && npm test -- --run`
- 前端构建验证：`cd frontend && npm run build`
