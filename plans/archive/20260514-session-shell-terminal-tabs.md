<!--
职责：修正会话 Shell/Evidence 面板的 terminal 分组模型。
边界：不实现学生可写 terminal，不重写 Remote Runner，不提交运行时数据或凭据。
-->

# Session Shell Terminal Tabs

## 目标

把会话右侧 Shell/Evidence 面板从“每条命令一个 tab”修正为“每个 Remote Runner shell/session 一个 tab”。每个 tab 应像真实 terminal 一样按时间顺序展示该 shell 内连续执行的多条命令、stdout/stderr、exit code、错误和时间，让学生能以更高信息密度核验 Tutor 使用真实实验环境得到的证据。

## 非目标

- 不实现学生可直接输入命令的交互式 Web terminal。
- 不绕过 Tutor/session-bound Remote Runner 权限模型。
- 不重写 Remote Runner 的 session/command lifecycle。
- 不扩大命令 allowlist、credential 存储或远程部署策略。

## 当前仓库事实

- 入口规则：`AGENTS.md`
- 初始化契约：`harness/bootstrap-contract.md`
- 当前功能项：`vnext-session-shell-terminal-tabs`
- 相关文件/模块：`src/schemas/remote_machine.py`、`src/utils/remote_machine_manager.py`、`frontend/src/components/session/SessionEvidencePanel.tsx`、`frontend/src/types/index.ts`、`docs/architecture/vnext-integrations.md`、`docs/architecture/remote-runner-session-tools.md`
- 已知约束：现有 `vnext-shell-evidence-panel` 已实现只读证据面板，但 UI 以 audit/command 为 tab；用户明确要求 tab 应代表 terminal/shell session。

## 允许改动

- 后端 remote audit response 增补非敏感 terminal grouping 字段，例如 binding id、runner session id 或 terminal id/label。
- 前端证据面板按 terminal 分组渲染连续 transcript。
- 更新相关 types、i18n、focused tests、架构文档和 harness 状态。

## 禁止改动

- 不提交或读取真实密码、私钥、token、runtime SQLite、Remote Runner state/logs 或远程机器输出全量。
- 不把本地绝对路径写成部署必需配置。
- 不修改无关 profile、benchmark 或 LLM provider 行为。

## 验收标准

- `GET /api/sessions/{session_id}/remote-audits` 返回的 audit 足以按 Remote Runner terminal/session 分组；没有真实 runner session 时有稳定 fallback terminal id。
- 前端 Shell/Evidence 面板的 tab 表示 terminal/shell，而不是单条命令。
- 选中一个 terminal tab 后，面板以连续 transcript 形式展示该 terminal 内多条命令/动作及其输出摘要。
- 文档明确：当前只读面板是 terminal transcript view；未来可在该 terminal 模型上评估学生可写命令。

## 验证命令

```sh
./scripts/harness-check.sh
PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_remote_machine_manager.py -q
python3 -m compileall src tests
cd frontend && npm test -- --run
cd frontend && npm run build
git diff --check
```

## Evidence 记录要求

验证通过后，将命令、结果、关键输出摘要写入 `harness/feature_list.json` 的 `evidence`。

## 完成定义

- 请求行为已实现。
- 非目标没有被触碰。
- 上方验证命令已运行；未运行的命令必须说明原因。
- `harness/feature_list.json` 状态和 evidence 已更新。
- 职责、接口、setup 或边界改变时，docs、注释、测试或 harness 文件已更新。
- `harness/session-handoff.md` 写明当前状态、风险和下一步。
- 清洁状态检查已说明。

## 阻塞条件

- 发现 Remote Runner 无法稳定提供 session/terminal 级标识，且 Socratic audit 中也无法从 binding 建立稳定分组；此时应记录 Socratic fallback 并向 Remote Runner 反馈接口缺口。

## 下一步最佳动作

1. 已完成并归档。后续若要让学生直接输入命令，应先跟进 Remote Runner 持久 terminal 能力：`https://github.com/ElysiaFollower/SEEDRunner/issues/5`。
