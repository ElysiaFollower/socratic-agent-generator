<!--
职责：定义 Tutor 命名 shell session 能力的任务合同。
边界：不要记录真实凭据、部署日志、完整会话 transcript 或 runtime DB 数据。
-->

# Tutor Named Shell Sessions

## 目标

让一个已绑定实验机的 Socratic 会话可以拥有多个命名 Remote Runner shell terminal。Tutor 在需要并行证据采集时可以创建新 shell 并命名，例如 `capture` 用于 `tcpdump` 监听，`stimulus` 用于 `ping` 触发；每个 shell 保留自己的 runner session 和 transcript，前端 Shell 面板按 terminal tab 展示。

## 非目标

- 不实现浏览器里的全交互 PTY。
- 不让学生绕过现有 session binding、credential hiding、audit、redaction 和 deployment policy。
- 不改 Remote Runner 源码。
- 不重写所有 remote command API；旧主 shell API 必须继续可用。
- 不在本任务中修复最终收尾文案割裂问题。

## 当前仓库事实

- 主绑定模型：`SessionRemoteBindingModel` 目前一条 Socratic session 只有一个主 `runner_session_id`。
- Remote Runner provider 已支持 `create_session`、`session_exec`、`session_exec_background`、`session read`。
- Shell 面板 tab 已按 `runner_session_id`/`terminal_id` 聚合。
- 真实会话 `e9293b21-6f37-465a-8fc9-3508696409da` 暴露 `tcpdump + ping` 顺序执行导致 `0 packets captured`。

## 允许改动

- 增加命名 shell/terminal DB model、schema 和窄 SQLite 兼容迁移。
- 增加 RemoteMachineManager 的 list/create/read/run named shell 方法。
- 增加 session API，用于列出、创建、读取和在指定 shell 执行命令。
- 给 Tutor session-bound remote skill 增加创建/list/read/指定 shell 执行工具。
- 更新 Shell 面板数据源，使没有 audit 的命名 shell 也能显示为 tab。
- 更新 focused tests、架构文档、harness。

## 禁止改动

- 不提交 runtime SQLite、Remote Runner state/logs、tmux 日志、真实 session artifact、密码、token 或 SSH key。
- 不删除或迁移部署机真实会话数据。
- 不放宽 `REMOTE_TOOL_COMMAND_POLICY`。
- 不把用户机器配置暴露给 LLM。

## 验收标准

- Tutor 工具集中包含创建命名 shell、列出 shell、读取 shell transcript、在指定 shell 中运行/启动/等待命令的能力。
- 创建 `capture` 和 `stimulus` 两个 shell 时，它们使用同一绑定机器但不同 Remote Runner `runner_session_id`。
- Audit 记录带正确 `runner_session_id`，Shell 面板可显示多个 terminal tab，并使用 shell label 作为 tab 名。
- 旧单 shell 会话和旧 API 仍可运行。

## 验证命令

```sh
./scripts/harness-check.sh
PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_remote_machine_manager.py tests/test_remote_runner_provider.py tests/test_tutor_executor.py -q
python3 -m compileall src tests
cd frontend && npm test -- --run
cd frontend && npm run build
git diff --check
```

## 完成定义

- 代码实现并通过验证。
- `harness/feature_list.json` 将 `vnext-tutor-concurrent-evidence-planning` 更新为 `passing` 并记录 evidence。
- 本 active plan 归档。
- `harness/progress.md` 和 `harness/session-handoff.md` 记录当前状态、风险和下一步。

## 结果

- 新增 `SessionRemoteShellModel`，一个 Socratic session 可以在主绑定 shell 之外拥有多个命名 Remote Runner shell terminal。
- 后端新增 shell list/create/read/run API；旧 `/remote-shell` 与 `/remote-shell/command` 继续作为 primary shell 兼容入口。
- Tutor session-bound remote skill 新增 `create_remote_shell`、`list_remote_shells`、`read_remote_shell`，并支持在 `run/start/list/result/wait/stop` 工具中通过 `shell` 参数指定命名 terminal。
- Shell 面板现在从后端 shell list 构造 tab，使用 shell label 作为 tab 名，并可读取选中 terminal 的真实 persistent transcript。
- Focused tests 覆盖创建命名 shell、列出 primary+extra shell、在命名 shell 中执行命令并将 audit 归到正确 `runner_session_id`。
