<!--
职责：将 Remote Runner 持久 shell 能力接入 Socratic 会话。
边界：不重写 Remote Runner，不放宽 session binding/command policy，不提交运行时数据或凭据。
-->

# Persistent Remote Shell Integration

## 目标

把上游 Remote Runner 已完成的持久 session shell 接入 Socratic。用户在会话绑定实验机后，应能在会话右侧 Shell/Evidence 面板中看到 Remote Runner 的真实持久 transcript，并能通过受控命令输入在该 session shell 中执行命令；Tutor 也应继续通过同一个 Remote Runner session 执行命令，因此 `cd`、`export` 等 shell-local state 能在同一会话内持续生效。

## 非目标

- 不实现完整浏览器终端模拟器、ANSI 全量渲染、vim/top 等复杂 TUI 支持。
- 不允许未绑定机器的会话访问 Remote Runner。
- 不绕过现有 Remote Runner command allowlist、session binding、credential redaction 和 audit 机制。
- 不把 Remote Runner 源码复制进本仓库。
- 不在仓库保存 linux-01 密码、JWT、Remote Runner state、transcript log、runtime SQLite 或真实远程输出全量。

## 当前仓库事实

- 入口规则：`AGENTS.md`
- 初始化契约：`harness/bootstrap-contract.md`
- 当前功能项：`vnext-persistent-remote-shell`
- 相关文件/模块：`src/utils/remote_runner_provider.py`、`src/utils/remote_machine_manager.py`、`src/utils/remote_tool_skill.py`、`src/api/routes/session.py`、`src/schemas/remote_machine.py`、`frontend/src/components/session/SessionEvidencePanel.tsx`、`frontend/src/api/sessions.ts`、`frontend/src/types/index.ts`、`docs/architecture/remote-runner-session-tools.md`
- 已知约束：PR #23 已将 Shell/Evidence 面板修正为 terminal/session tabs，但当前仍主要展示 Socratic audit transcript；新的上游 Remote Runner main 已提供持久 shell：`session exec` 在 session shell 内执行并保留 shell-local state，`session send/read` 提供原始输入和增量 transcript。

## 允许改动

- 扩展 Socratic RemoteRunnerProvider，适配 `remote-runner session read/send` 和持久 shell transcript response。
- 扩展后端 session API，提供绑定会话的 shell transcript 读取和受控命令执行入口。
- 更新 Shell/Evidence 面板，让其优先展示 Remote Runner persistent transcript，并提供受 command policy 约束的命令输入。
- 更新 Tutor tools、benchmark、tests、docs、harness 状态。

## 禁止改动

- 不给 LLM 或前端传递 Remote Runner 机器凭据、host 私密细节、password、key、token。
- 不开放 raw `session send` 作为默认学生入口，除非同样能被 policy/audit 约束；正常命令执行优先走 `session exec`。
- 不新增全局机器访问入口；所有 shell 操作必须通过当前 Socratic session binding。
- 不把本任务扩大成学习质量 benchmark 或 Profile generator 改造。

## 验收标准

- 后端能通过当前 session binding 读取 Remote Runner `session read` transcript，支持 cursor/since 增量读取。
- 后端能通过当前 session binding 执行学生/前端提交的 shell command，仍走现有 command policy、timeout、redaction 和 audit。
- 前端 Shell/Evidence 面板展示真实 Remote Runner persistent transcript；没有 transcript 时仍可回退展示 Socratic audit transcript。
- 前端命令输入只在 session 已绑定实验机时可用，执行后刷新 transcript/audit，并清楚显示失败/被 policy 拒绝的错误。
- Focused tests 覆盖 provider read/send/exec 持久 shell 接口、manager binding policy、API schema 或 frontend build。
- 文档明确：`session exec` 是默认受控命令入口；`session send/read` 是未来复杂交互 shell 的底层能力，不能绕过教学和权限边界。

## 验证命令

```sh
./scripts/harness-check.sh
PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_remote_runner_provider.py tests/test_remote_machine_manager.py -q
python3 -m compileall src tests
cd frontend && npm test -- --run
cd frontend && npm run build
git diff --check
```

## Evidence 记录要求

验证通过后，将命令、结果、关键输出摘要写入 `harness/feature_list.json` 的 `evidence`。若执行真实 linux-01 smoke，只记录 session id、命令摘要、状态和脱敏结果，不记录凭据或完整 transcript。

## 完成定义

- 请求行为已实现。
- 非目标没有被触碰。
- 上方验证命令已运行；未运行的命令必须说明原因。
- `harness/feature_list.json` 状态和 evidence 已更新。
- 职责、接口、setup 或边界改变时，docs、注释、测试或 harness 文件已更新。
- `harness/session-handoff.md` 写明当前状态、风险和下一步。
- 清洁状态检查已说明。

## 阻塞条件

- 上游 Remote Runner CLI 返回 JSON 与文档不一致，导致无法可靠读取 transcript 或保持 shell state。
- 现有 command policy 无法约束学生输入，且没有可接受的安全替代路径。
- linux-01 或本地测试环境无法导入新版 Remote Runner，且无法用 fake runner 覆盖最小行为。

## 下一步最佳动作

1. 已完成并归档。后续先合并/部署 PR #23 及本分支，再在 linux-01 上用真实 persistent shell 做一次 `cd/export/read` smoke。
