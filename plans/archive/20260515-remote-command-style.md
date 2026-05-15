<!--
职责：为实现 agent 定义一个 active task 合同，让范围、验收、验证和交接可执行。
边界：不要在这里累积长期架构事实、原始日志或无关 follow-up 想法。
-->

# Remote Command Style And Compound Command Issue

## 目标

让 Socratic tutor 在远程实验工具调用中优先使用单条、可解释、可审计的命令；当需要多个观察时，拆成多次工具调用，并把 Remote Runner compound command 支持缺口同步为上游 issue。

## 非目标

- 不在本任务中放宽 Socratic 命令 allowlist 或实现 compound command parser。
- 不修改 Remote Runner 源码、不改变其 CLI 契约。
- 不重做 Shell 面板渲染、benchmark 完整流程或远程机器配置。

## 当前仓库事实

- 入口规则：`AGENTS.md`
- 初始化契约：`harness/bootstrap-contract.md`
- 当前功能项：`vnext-remote-command-style`
- 相关文件/模块：`src/utils/template_assembler.py`、`tests/test_tutor_executor.py`、`docs/architecture/remote-runner-session-tools.md`、`harness/feature_list.json`
- 已知约束：正常 tutor 工具调用依赖 LangChain agent 自主规划；直接 API/benchmark 命令路径没有自动拆分重试能力。

## 允许改动

- 更新 tutor runtime contract，使工具策略明确偏向单条命令。
- 增加 focused test，防止后续 prompt 退化为鼓励 compound command。
- 更新架构文档和 harness 状态，记录上游 issue 链接和本仓库边界。

## 禁止改动

- 不提交数据库、部署数据、Remote Runner state、凭据或远端日志。
- 不改变 Remote Runner command policy 的允许命令集合。
- 不把 compound command 作为 Socratic 默认推荐用法。

## 验收标准

- Remote Runner 上游存在 issue，说明 `session exec`/shell 工具不支持或未明确支持 compound command，并给出 `id && whoami` 这类真实场景。
- Socratic runtime contract 明确要求 tutor 优先单条命令；需要多个观察时拆分调用；命令被 policy 拒绝时改用更小的单条命令恢复。
- Focused tests 覆盖上述 prompt/contract 规则。

## 验证命令

```sh
./scripts/harness-check.sh
PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_tutor_executor.py -q
python3 -m compileall src tests
git diff --check
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

- GitHub CLI 无法创建 SEEDRunner issue，或当前分支存在不可安全合并的用户改动。

## 下一步最佳动作

1. 创建上游 issue，再更新 Socratic prompt contract、测试和架构文档。
