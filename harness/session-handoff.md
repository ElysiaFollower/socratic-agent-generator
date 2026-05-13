# 会话交接

## 仓库状态

- 分支：`remote-runner-session-tools`
- 基线：最新 `dev`，PR #16 `feat: integrate vNext Socratic demo stack` 已合并。
- 当前功能项：`remote-runner-session-tools`，状态 `active`。
- 当前计划：`plans/active/20260513-remote-runner-session-tools.md`。
- 当前目标：将 Remote Runner 从全局原型升级为学生可配置、会话可绑定、Tutor 可真实使用的实验机工具能力。

## 当前已验证状态

- 初始化：`./init.sh` 通过，harness 检查 0 warning。
- PR 状态：PR #16 已通过 `gh pr merge 16 --merge` 合并到 `dev`。
- 分支状态：`remote-runner-session-tools` 从 fast-forward 后的 `dev` 创建。
- 任务初始化：active plan 与架构说明已创建；实现尚未开始。

## 本会话改动

- 合并 PR #16 到 `dev`。
- 创建新分支 `remote-runner-session-tools`。本地已有 `dev` 分支，因此没有使用 `dev/...` 层级分支名。
- 新增 `plans/active/20260513-remote-runner-session-tools.md`，定义本任务目标、非目标、允许/禁止改动、验收标准、验证命令和阻塞条件。
- 新增 `docs/architecture/remote-runner-session-tools.md`，记录 per-user remote machine、session remote binding、remote command audit、API/UI/Tutor tool 边界和最终 demo 验收形态。
- 更新 `harness/feature_list.json`，新增并激活 `remote-runner-session-tools`。
- 更新 `harness/progress.md`，记录当前 active plan 和下一步最佳动作。

## 关键任务边界

- 目标行为：`demo` student 用户在创建会话时选择自己的实验机，Tutor 在该会话中只能通过 Remote Runner 访问这台绑定机器，并能执行命令、收集输出、排查问题、完成完整实验。
- 推荐验收实验：SEED Sniffing and Spoofing Lab，LabSetup 来源为 `https://github.com/seed-labs/seed-labs/tree/master/category-network/Sniffing_Spoofing/Labsetup`。
- 本地验收机器：Remote Runner 中已有 `seed-lab`，只能作为测试机器名使用；不要把凭据或机器状态提交进仓库。
- 不兼容旧会话可接受：旧会话可以没有 remote binding，且默认不注入 Remote Runner skill。

## 仍损坏或未验证

- 尚未检查 Remote Runner 当前 CLI 对 machine upsert、credential 写入、session create/exec 的完整接口。
- 尚未实现 per-user 机器配置、credential 存储、session binding、命令审计、前端设置页或创建会话机器选择。
- 尚未验证 `seed-lab` 的 SEED LabSetup、Docker/Compose、root 权限和 Sniffing/Spoofing 实验运行状态。
- 尚未完成真实 `demo` student 全实验会话。

## 清洁状态要求

- 不提交 SQLite DB、向量索引、Remote Runner state、远端日志、LLM key、SSH 密钥、password 或导出的敏感命令输出。
- 不把本机绝对路径写进运行时代码、默认配置或可迁移部署文档。
- 实现阶段需要补 focused tests、前端测试/构建、官方部署文档和最终 demo example artifact。

## 下一步最佳动作

1. 检查 Remote Runner CLI 当前 machine/session/credential 接口，确认 Socratic 应调用 CLI 还是 Python API。
2. 设计并实现 `UserRemoteMachine`、`SessionRemoteBinding` 和 `RemoteCommandAudit`。
3. 扩展 Settings API/UI 与 session create API/UI。
4. 将 Tutor remote tool 改为从 session binding 构造 provider，并拒绝跨机器/跨会话调用。
5. 用 `seed-lab` 完成 `demo` student 全实验验收并导出脱敏 example。

## 命令

- 初始化：`./init.sh`
- Harness 检查：`./scripts/harness-check.sh`
- 计划内 focused tests：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_remote_runner_provider.py tests/test_session_progress.py tests/test_skill_names.py -q`
- 语法验证：`python3 -m compileall src tests`
- 前端验证：`cd frontend && npm test -- --run && npm run build`
- 远端机器 smoke：`remote-runner machine doctor seed-lab --json`
