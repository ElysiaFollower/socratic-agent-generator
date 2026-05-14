# 会话交接

## 仓库状态

- 分支：`vnext-single-lab-e2e-benchmark`
- 当前功能项：无 active；`vnext-single-lab-e2e-benchmark` 状态 `passing`。
- Active plan：无；单实验 benchmark 计划已归档到 `plans/archive/20260514-single-lab-e2e-benchmark.md`。
- 目标分支：`dev`。
- 当前 PR：无；PR #17 已合并到 `dev`。

## 当前已验证状态

- 用户可在 Settings 中维护实验机配置，创建会话时选择一台自己的机器，也可在会话信息顶栏切换或解绑当前会话实验机。
- 后端创建 `SessionRemoteBindingModel`，Tutor 只为有绑定机器的会话注入 session-bound `observe_remote_environment`。
- Remote Runner 工具固定访问绑定 machine/session，命令输出脱敏、截断并写入 `RemoteCommandAuditModel`。
- 会话文件缓存支持上传 LabSetup 文件，并可通过同一套权限链路 remote-put 到绑定实验机。
- 后端调试 API 覆盖 remote-binding、文件列表/上传、remote-put、remote-command、remote-audits，便于不用前端也能复现实验。
- 前端完成 Remote Machines 设置页、创建会话机器选择、会话顶栏机器切换和弹出式 session file panel；输入栏上方不再常驻显示文件上传面板。
- 官方部署文档、`.env.example` 和架构文档已同步 Remote Runner conda 配置、session binding、会话后切换绑定、command policy 和短等待策略。
- 上游 Remote Runner 后台命令能力缺口已解决；Socratic 已接入新 CLI 的后台运行、显式 wait time、result/list/stop 接口。
- Tutor 工具表面现在区分短命令 `run_remote_command` 和长命令 `start_remote_command`，并提供 `wait_remote_command`、`get_remote_command_result`、`list_remote_commands`、`stop_remote_command`。
- 后端调试 API `/api/sessions/{session_id}/remote-command` 同步支持 `action`、`command_id` 和 `wait_timeout_seconds`。
- linux-01 已同步当前 Socratic archive 和支持后台命令的 SEEDRunner 代码；部署侧后台命令工具链 smoke 已通过。
- vNext 目标已记录：Shell/Evidence 面板、单实验端到端 benchmark、profile 生成质量评估体系、Profile Management 文档身份与元信息 UX。
- Profile Management 文档身份问题已创建 GitHub issue：`https://github.com/ElysiaFollower/socratic-agent-generator/issues/18`。
- PR #17 reviewer 标出的 security-critical/high 问题已修复：远程机器 password auth 缺少有效 Fernet key 时拒绝保存/使用密码；Remote Runner command allowlist 空配置时拒绝执行命令。
- 已完成 vNext 单实验 E2E benchmark：`scripts/benchmarks/single_lab_e2e.py` 和 `docs/benchmarks/single-lab-e2e.md`。
- 已清理完成分支：本地/远端仅保留 `main`、`dev`，当前工作分支为 `vnext-single-lab-e2e-benchmark`。
- DreamingRAG `dev` 与 SEEDRunner `dev/remote-runner-background-commands` 均已 `git pull --ff-only`，结果 up to date。

## 真实验收

- 部署机器：linux-01。
- 服务：tmux `socratic-backend`、`socratic-frontend`。
- 前端：`http://10.203.15.128:5173/`。
- 后端健康检查：`http://10.203.15.128:8000/api/health`。
- 用户：`demo` student。
- Socratic session：`42f4f635-4ab3-41a0-911a-233cf4cebe0d`。
- Remote Runner session：`sess_20260513_144634_689262_63b90a86`。
- 验收 profile：Sniffing/Spoofing。
- 结果：LabSetup 由系统上传并 remote-put，`docker-compose up -d`、`docker-compose ps`、`docker ps` 成功；Tutor 在完整自然语言会话中调用 remote tool；最终 `stepIndex=9,totalSteps=9,isFinished=true`，history_len=27，remote audit 16 条。
- 脱敏 example：`docs/examples/live-demo-sessions/remote-runner-sniffing-spoofing-final.json`。

## 验证记录

- `./init.sh` 通过。
- `./scripts/harness-check.sh` 通过 0 warning。
- `python3 -m compileall src tests` 通过。
- `PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_remote_runner_provider.py tests/test_remote_machine_manager.py tests/test_skill_names.py -q` 通过 21 passed。
- `cd frontend && npm test -- --run` 通过。
- `cd frontend && npm run build` 通过。
- `git diff --check` 通过。
- 2026-05-14 PR17 security fix：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_remote_machine_manager.py tests/test_remote_runner_provider.py -q` 通过 22 passed；`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_remote_runner_provider.py tests/test_remote_machine_manager.py tests/test_skill_names.py -q` 通过 24 passed；`python3 -m compileall src tests` 通过；`./scripts/harness-check.sh` 0 warning；`git diff --check` 通过。
- 2026-05-14 single-lab benchmark：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_single_lab_e2e_benchmark.py -q` 通过 5 passed；`python3 -m compileall scripts tests` 通过；`./scripts/harness-check.sh` 0 warning；`git diff --check` 通过。
- 早期完整本地验证通过：focused pytest 18 passed、`python3 -m compileall src tests`、frontend test/build、`git diff --check`。
- 远端最终验证脚本返回 `VALIDATION_OK 42f4f635-4ab3-41a0-911a-233cf4cebe0d`。
- linux-01 后端 `/api/health` 返回 OK，前端 HTTP 200。
- 2026-05-14 追加部署 smoke：demo session `42f4f635-4ab3-41a0-911a-233cf4cebe0d` 的 session-bound `start_remote_command -> wait_remote_command -> get_remote_command_result -> list_remote_commands` 通过；后台命令 `cmd_20260513_172642_504854_653050c4` 退出码 0，`wait_timed_out=false`，stdout 命中 `socratic-background-ok`，工具数 7。

## 当前 active 任务

- 无 active 任务。

## 仍损坏或未验证

- 无阻塞当前任务的问题。
- 浏览器插件连接本地页面三次超时的旧问题仍未复核；本任务预计不触碰前端 UI。
- vNext 单实验 benchmark 已完成第一版；live linux-01 run 需要通过环境变量提供 `SOCRATIC_BENCHMARK_PASSWORD`，未写入仓库。

## 设计结论

- 当前产品默认不应让学生为工具调用等待很久：`REMOTE_TOOL_AGENT_IDLE_TIMEOUT` 默认 15 秒，`REMOTE_TOOL_COMMAND_TIMEOUT` 默认 20 秒，`LANGCHAIN_MAX_ITERATIONS` 默认 4。
- Remote Runner 当前 CLI 已支持 `session exec --mode wait|background` 和 `session command list/show/result/wait/stop`。
- Socratic 侧应明确区分：短命令 `run_and_wait`、长命令 `run_background`、已有命令 `wait/result/list/stop`。不应让学生为了后台任务等待很长的同步工具调用。
- 远程机器密码存储必须使用 `cryptography.fernet.Fernet`；没有有效 `REMOTE_MACHINE_SECRET_KEY` 时不能保存或使用 password auth 凭据。
- Remote Runner 命令策略 fail-closed；exact command 和 prefix allowlist 均为空时不执行命令。
- 单实验 benchmark 只通过后端 API 运行，不依赖前端；RAG 目前没有一等 audit API，因此第一版直接验证会话完成度、远程审计和 step completion，RAG 检索只能作为间接信号。

## 清洁状态

- 不提交 runtime SQLite、session cache、Remote Runner state/logs、tmux 日志、LLM key、SSH key、password 或 token。
- linux-01 上为了演示保留最终 demo session 和运行服务。
- 本地当前有 single-lab benchmark 更新待提交；未提交 runtime SQLite、session cache、Remote Runner state/logs、tmux 日志、LLM key、SSH key、password 或 token。

## 下一步最佳动作

1. 提交并推送 `vnext-single-lab-e2e-benchmark`。
2. 创建 PR 到 `dev`。
3. 后续可在有 benchmark password 的环境中运行 live linux-01 benchmark，或开启 Shell/Evidence 面板任务。

## 命令

- `./init.sh`
- `./scripts/harness-check.sh`
- `python3 -m compileall src tests`
- `PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_remote_runner_provider.py tests/test_remote_machine_manager.py tests/test_session_file_manager.py tests/test_session_progress.py tests/test_skill_names.py tests/test_demo_session_examples.py -q`
