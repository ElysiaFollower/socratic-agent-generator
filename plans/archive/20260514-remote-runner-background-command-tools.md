<!--
职责：为实现 agent 定义一个 active task 合同，让范围、验收、验证和交接可执行。
边界：不要在这里累积长期架构事实、原始日志或无关 follow-up 想法。
-->

# Remote Runner Background Command Tools

> 北极星校准说明：本 plan 已归档，保留历史实现合同。后续继续扩展 Remote Runner 工具时，应以 `docs/product/vision.md` 和 `docs/architecture/remote-runner-session-tools.md` 的最新口径为准：工具保持通用，负责连通和反馈；Tutor 负责把命令输出转化为当前学习问题、学生判断和证据链。长命令后台化是为降低等待摩擦，不是为了让 Tutor 自动代做完整实验。

## 目标

把上游 Remote Runner 新增的后台命令和显式 wait time 接口接入 Socratic Tutor，让绑定实验机会话中的导师不再只能发起同步 `session exec`。本任务的用户可见行为是：Tutor 可以把短诊断命令作为同步命令执行，也可以为抓包、服务、构建、长时间实验步骤启动后台命令，立即返回 command id，并在后续对话中显式等待、查询结果或停止命令。

## 非目标

- 不重新实现 Remote Runner；Socratic 只适配其 CLI 边界。
- 不在本任务中扩展前端 UI；已有机器绑定和文件上传入口继续沿用。
- 不放开任意机器或任意会话访问；所有工具仍必须绑定当前 Socratic session 的 Remote Runner session。
- 不把长命令包装成 900 秒同步等待；长命令必须走后台命令生命周期。
- 不提交 Remote Runner state、日志、远程机器输出全量、SQLite、密钥或部署侧 runtime 数据。

## 当前仓库事实

- 入口规则：`AGENTS.md`
- 初始化契约：`harness/bootstrap-contract.md`
- 当前功能项：`remote-runner-background-command-tools`
- 相关文件/模块：
  - `src/utils/remote_runner_provider.py`
  - `src/utils/remote_tool_skill.py`
  - `src/utils/tutor_core.py`
  - `tests/test_remote_runner_provider.py`
  - `docs/architecture/remote-runner-session-tools.md`
  - `docs/deployment.md`
- 已知约束：
  - 当前 Socratic provider 只支持同步 `session_exec`。
  - 当前 Tutor tool collection 假设每个 skill 只有一个 `get_tool()`，不支持一个 skill 暴露多个显式工具。
  - 上游 `/Users/ely/workspace/research/agent/SEEDRunner` 已支持 `remote-runner session exec --mode wait|background --timeout <seconds> --json`，以及 `session command list/show/result/wait/stop --json`。
  - `session command wait` 的 timeout 是显式等待时长；等待超时不应杀死远程后台命令。

## 允许改动

- 扩展 `RemoteRunnerProvider` action 集合，支持 background exec、command list/result/wait/stop/show，并允许 wait action 传入显式 timeout。
- 扩展 session-bound remote skill，暴露多个明确命名的 LangChain tools，例如连接检查、短命令执行、后台启动、等待、查询结果、停止命令。
- 调整 Tutor tool collection，让一个 skill 可以通过 `get_tools()` 返回多个工具，同时兼容旧的 `get_tool()`。
- 保留旧 `observe_remote_environment` 兼容路径，避免已有调试或测试入口突然失效。
- 更新 focused tests、架构文档、部署文档和 harness 状态。

## 禁止改动

- 不绕过 `SessionRemoteBindingModel`，不让 LLM 指定任意 machine id 或 Remote Runner session id。
- 不把 password、private key、host 私密细节、local log path、remote state path 等敏感字段暴露给 LLM 或 example。
- 不改变默认 Volcengine embedding、DreamingRAG adapter、内置 profile seed 或 session progression 行为。
- 不引入新的前端常驻面板或改变用户已经认可的会话顶栏布局。

## 验收标准

- `RemoteRunnerProvider` 能生成并执行新 CLI 形态：`session exec --mode background`、`session command list/result/wait/stop/show`，且 wait action 能使用调用者指定的 timeout。
- session-bound Tutor 看到的是清晰的多工具表面，而不是只靠一个 `observe_remote_environment(action=...)` 路由工具。
- 短命令仍走 `run_remote_command`/`session_exec` 并受原有 command policy、cwd policy、绑定 session 校验、输出脱敏和审计约束。
- 长命令可走 `start_remote_command` 返回 command id；后续 `wait_remote_command` 在显式 timeout 后若未完成，应返回 `wait_timed_out` 风格结果而不把工具调用阻塞到长时间超时。
- 旧的 `observe_remote_environment` 兼容工具或 provider action 不破坏现有 API/debug 路径。
- 文档明确区分 “运行并等待返回结果”、“运行但不等待返回结果”、“查询/等待/停止之前的命令”。

## 验证命令

```sh
./scripts/harness-check.sh
PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_remote_runner_provider.py tests/test_skill_names.py -q
python3 -m compileall src tests
cd frontend && npm test -- --run
git diff --check
```

## Evidence 记录要求

验证通过后，将命令、结果、关键输出摘要和新工具/CLI 覆盖范围写入 `harness/feature_list.json` 的 `evidence`。真实远程输出只记录必要摘要，不能记录凭据、token、私钥、完整日志或机器敏感路径。

## 完成定义

- 请求行为已实现。
- 非目标没有被触碰。
- 上方验证命令已运行；未运行的命令必须说明原因。
- `harness/feature_list.json` 状态和 evidence 已更新。
- 职责、接口、setup 或边界改变时，docs、注释、测试或 harness 文件已更新。
- `harness/session-handoff.md` 写明当前状态、风险和下一步。
- 清洁状态检查已说明。

## 阻塞条件

- 上游 Remote Runner CLI 的后台命令参数或返回 JSON 与本地代码检查不一致，导致无法可靠适配。
- LangChain 当前版本无法接受一个 skill 暴露多个工具，且没有兼容替代路径。
- focused tests 无法在不访问真实 SSH 凭据的情况下覆盖新命令形态。

## 下一步最佳动作

1. 扩展 `RemoteRunnerProvider` action/timeout 支持。
2. 重构 session-bound remote skill 为显式多工具表面。
3. 补测试和文档，然后运行验证阶梯。
