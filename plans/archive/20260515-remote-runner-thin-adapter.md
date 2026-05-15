<!--
职责：定义 Socratic Remote Runner adapter 收敛为薄转发层的当前任务合同。
边界：不要在这里记录长期设计全文、凭据、部署日志或真实会话原始数据。
-->

# Remote Runner Thin Adapter

## 目标

把 Socratic 的 Remote Runner 集成从“重解释命令语义”收敛为薄 adapter：Socratic 只做用户鉴权、session 机器绑定、凭据隐藏、输出脱敏/截断、audit 记录和前端 transcript 展示；命令字符串的 shell 语义交还 Remote Runner，不在 Socratic tutor-facing 层禁止 compound command。

## 非目标

- 不修改 Remote Runner 仓库源码。
- 不删除部署机上刚保留的真实 conduct session 数据。
- 不引入新的前端 Shell 交互形态。
- 不把 Tutor 教学风格改成鼓励复杂 one-liner；单条清晰命令仍是提示词层面的偏好，不是 adapter 的硬限制。

## 当前仓库事实

- Remote Runner 持久 session shell 支持 shell expression；`session exec --cmd 'id && whoami'` 是一条 command record。
- 当前 Socratic 侧存在两个过重行为：`SessionBoundRemoteEnvironmentSkill` 拒绝 compound 命令；`RemoteRunnerProvider` 用 exact/prefix allowlist 粗略解释命令字符串，造成 `whoami && id` 被拦但 `ip ... | grep ... || ...` 可能放行的不一致。
- 仍必须保留的边界：用户只能访问当前 Socratic session 绑定的 runner session/machine；凭据不暴露给模型；Remote Runner observation 和 audit 需要脱敏并限制输出长度。

## 允许改动

- 移除 tutor-facing compound command guard。
- 将命令策略改为默认 pass-through，保留显式部署级 `REMOTE_TOOL_COMMAND_POLICY=allowlist|deny_all|passthrough` 选项以兼容更严格部署。
- 让 tutor observation 保留 Remote Runner 的结构化错误信息，尤其是 `Session is busy`，不把它误折叠成 policy failure。
- 更新 tests、docs、harness，使“adapter 不重定义 shell 语义”成为事实来源。

## 禁止改动

- 不提交 `.env`、runtime DB、logs、Remote Runner state、真实凭据或真实 SSH key。
- 不放松 machine/session binding。
- 不移除 audit、redaction 或 output limit。

## 验收标准

- 默认配置下 `whoami && id`、`ip link show | grep ...` 这类 shell expression 会被 provider 作为原始 command 字符串传给 Remote Runner。
- 显式 `REMOTE_TOOL_COMMAND_POLICY=allowlist` 时保留旧 exact/prefix 行为；显式 `deny_all` 时拒绝命令。
- `SessionBoundRemoteEnvironmentSkill` 不再在调用 provider 前拒绝 compound command，但仍串行化同一 `runner_session_id` 的 command actions。
- `Session is busy` 类错误在 tutor fallback summary 中显示为 busy/terminal occupied，而不是 command policy。
- 文档说明 Socratic adapter 的职责边界：绑定、鉴权、脱敏、审计、截断和转发。

## 验证命令

```sh
./scripts/harness-check.sh
PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_remote_runner_provider.py tests/test_tutor_executor.py -q
python3 -m compileall src tests
git diff --check
```

## 完成定义

- 行为实现并有 focused tests。
- feature list 记录 evidence，active plan 归档。
- `harness/progress.md` 与 `harness/session-handoff.md` 写明当前状态和下一步。
- 本地工作区不包含不应提交的 runtime artifact。
