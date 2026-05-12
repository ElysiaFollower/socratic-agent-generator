<!--
职责：为 Remote Runner 工具接入定义当前 active task 合同。
边界：不记录真实机器、凭据、完整命令日志或外部项目源码。
-->

# Remote Runner Tool Adapter Prototype

## 目标

快速产出一个可用原型：Socratic Tutor 能通过受限的 Remote Runner adapter 获取学生实验环境信息，并把结构化观察结果作为 LangChain tool 返回给导师，用于更具体地追问、定位错误和指导下一步。

第一版只要求证明工具链路可用：从 Socratic 配置读取 Remote Runner 路径和状态目录，调用 Remote Runner 的机器/会话/命令查询接口，返回有长度限制、脱敏后的文本结果，并用 focused tests 或 CLI smoke 验证 Tutor 工具能被创建和调用。

## 非目标

- 不在本任务中实现完整 Web UI、机器管理页面、凭据录入页面或学生授权弹窗。
- 不直接复制 `/Users/ely/workspace/research/agent/SEEDRunner` 源码到本仓库；仅作为外部依赖、submodule 候选或可配置本地路径调用。
- 不连接真实 SSH 机器；本阶段只做 Socratic 侧代码开发和本地 fake/隔离状态测试。等 adapter、tool 注入、安全边界和本地验证都准备好后，再由用户提供可连通机器进入单独的 opt-in 真实 SSH 验证。
- 不让导师无约束执行任意写操作；第一版以环境观察和诊断命令为主，写入/上传/下载作为后续扩展。
- 不把 Remote Runner 后端细节暴露为教学系统的长期产品边界。

## 当前仓库事实

- 入口规则：`AGENTS.md`
- 初始化契约：`harness/bootstrap-contract.md`
- 当前功能项：`remote-runner-integration`
- 相关文件/模块：`src/utils/tutor_core.py`、`src/utils/skills.py`、`src/config.py`、`tests/`、`docs/architecture/vnext-integrations.md`
- 已知约束：
  - Tutor 当前已经使用 LangChain tool-calling agent；内置技能通过 `get_tool()` 注入 `self.tools`。
  - `PromptAssembler` 能把技能名称和描述注入 system prompt。
  - Remote Runner 外部项目位于 `/Users/ely/workspace/research/agent/SEEDRunner`，当前具备 `remote_runner` Python 包和 `remote-runner`/`python -m remote_runner.cli` CLI。
  - Remote Runner 当前支持 `machine`、`session`、`file`、`run` 四类 CLI 命令，并支持 `--json` 输出；状态目录可通过 `REMOTE_RUNNER_STATE_DIR` 覆盖。
  - 已验证 Remote Runner 基础可用：`./init.sh` 通过；`python3 -m remote_runner.cli --help` 可运行；`python3 -m pytest tests/test_remote_runner_mvp.py tests/test_remote_runner_launch_suite.py -q` 通过 `28 passed, 1 skipped`；manager import smoke 通过；隔离状态目录下 `machine/session/run list --json` 返回空列表 JSON。
  - Remote Runner API 文档把 `--state-dir` 列为目标全局选项，但当前实现实际使用环境变量 `REMOTE_RUNNER_STATE_DIR`；Socratic 原型应优先用环境变量，不依赖尚未实现的 CLI 全局参数。

## 允许改动

- 新增 Socratic 侧 Remote Runner adapter/provider，例如 `src/utils/remote_runner_provider.py`。
- 在 `src/config.py` 添加远程工具开关、外部 repo path、state dir、允许机器列表、命令超时、输出长度限制等配置。
- 在 `src/utils/skills.py` 或相邻模块新增一个内置 LangChain tool，并在 `Tutor` 初始化时按配置注入。
- 新增 focused tests，使用 fake provider、隔离临时状态目录或 monkeypatch，验证配置、脱敏、超时、输出截断和 tool callable 行为。
- 更新 `.env.example`、docs/harness 状态和必要注释。

## 禁止改动

- 不提交真实 Remote Runner 状态目录、SSH 凭据、日志、机器配置、实验输出、下载 artifact 或用户数据。
- 不在默认测试中依赖真实 SSH、真实 SEED VM、DreamingRAG real mode 或外部网络。
- 不破坏已有 DreamingRAG memory 默认开启和 fallback 行为。
- 不改变现有自定义技能、实验手册 RAG、课堂/会话/认证接口的行为，除非是最小必要接入点。

## 验收标准

- Socratic 存在一个窄 Remote Runner adapter，能在 Remote Runner 不可用时返回安全降级结果，不阻断 Tutor 初始化。
- Tutor 在配置开启时会注入一个远程环境观察 tool；配置关闭时不注入。
- 该 tool 至少支持一个只读/低风险观察路径，例如列出允许机器、检查 machine doctor、或在预注册 session/machine 上执行受限诊断命令。
- tool 输出有超时、长度限制、错误包装和基本脱敏；不会把密码、密钥内容或原始凭据返回给 LLM。
- focused tests 覆盖成功、禁用、不可用、输出截断/脱敏和 Tutor tool 注入。
- 文档和 harness 说明真实 SSH 验证本阶段不运行；后续 opt-in 时再列出需要用户显式准备的机器配置。

## 验证命令

```sh
./scripts/harness-check.sh
python3 -m unittest tests.test_remote_runner_provider
python3 -m compileall src
cd frontend && npm test -- --run
# 真实 SSH 验证本阶段不运行；等用户提供可连通机器后单独执行。
```

## Evidence 记录要求

验证通过后，将命令、结果、关键输出摘要或 artifact 路径写入 `harness/feature_list.json` 的 `evidence`。

## 完成定义

- 请求行为已实现。
- 非目标没有被触碰。
- 上方验证命令已运行；未运行的命令必须说明原因。
- `harness/feature_list.json` 状态和 evidence 已更新。
- 职责、接口、setup 或边界改变时，docs、注释、测试或 harness 文件已更新。
- `harness/session-handoff.md` 写明当前状态、风险和下一步。
- 清洁状态检查已说明。

## 阻塞条件

- Remote Runner CLI/manager 无法被 Socratic 测试环境导入或调用，且无法通过可配置本地路径或 subprocess 方式稳定调用。
- 实现或本地测试意外依赖真实 SSH、真实 SEED VM、真实凭据或真实机器状态。
- 发现 Remote Runner 需要新增核心 API 才能完成最小原型；此时应把缺口反馈给 SEEDRunner 项目，而不是在 Socratic 内部复制实现。

## 下一步最佳动作

1. 该原型已完成并验证通过，可归档。
2. 如后续要扩展写操作、权限确认、审计或 Web UI，再另开新分支。

## 完成结果

- 状态：`passing`
- 实现：新增 CLI-backed `RemoteRunnerProvider`、`observe_remote_environment` LangChain tool、Tutor tool 注入、配置开关、允许命令/机器/cwd 边界、脱敏和输出截断。
- 验证：`python3 -m unittest tests.test_remote_runner_provider`、`_local/socratic-smoke-venv/bin/python -m unittest tests.test_remote_runner_provider`、`python3 -m unittest tests.test_memory_provider tests.test_remote_runner_provider`、`python3 -m compileall src tests`、`./scripts/harness-check.sh`、`cd frontend && npm test -- --run` 通过；`REMOTE_TOOL_ENABLED=true` 的 no-SSH local smoke 通过；`linux-01` 的 `machine doctor` 通过，随后创建 session 并执行 `pwd` 成功，最后销毁 session 成功。
- 后续：若要继续扩展 Remote Runner 能力，优先考虑 session 创建/销毁封装、写操作白名单、审计日志、用户确认和更细的状态展示。
