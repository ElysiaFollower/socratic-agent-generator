<!--
职责：为实现 agent 定义一个 active task 合同，让范围、验收、验证和交接可执行。
边界：不要在这里累积长期架构事实、原始日志或无关 follow-up 想法。
-->

# Manual Conduct Follow-up Hardening

## 目标

把 2026-05-15 真实 Sniffing/Spoofing 完整会话暴露出的两个缺陷收口：Tutor 远程工具调用必须在 tutor-facing 层避免 compound/pipe 命令和同 session 并发命令；StepEvaluator 必须优先看到当前 step 的最近上下文，避免长会话后 tutor 文本已确认通过但后端迟迟不推进。

## 非目标

- 不重做 profile 内容、不更改 6 个内置实验 profile。
- 不放宽 Remote Runner 全局 command allowlist，也不在 Socratic 中实现 Remote Runner compound command 支持。
- 不删除刚留存的真实会话样本；它是后续分析 artifact。
- 不把所有教学质量问题一次性解决，本任务只处理本次真实会话直接暴露的两个工程缺陷。

## 当前仓库事实

- 入口规则：`AGENTS.md`
- 初始化契约：`harness/bootstrap-contract.md`
- 当前功能项：`vnext-manual-conduct-followup-hardening`
- 相关文件/模块：`src/utils/remote_tool_skill.py`、`src/utils/tutor_core.py`、`src/utils/step_evaluator.py`、`tests/test_remote_runner_provider.py`、`tests/test_tutor_executor.py`、`docs/architecture/remote-runner-session-tools.md`
- 已知约束：真实会话 `8dff9e8f-fa86-449c-93a8-836987c4ee9b` 已完成并保留；artifact 位于 `/home/ely/deploy/socratic-live/logs/manual-conduct-sniffing-spoofing-20260515-consolidated.json`。

## 允许改动

- 为 session-bound tutor remote tools 增加单命令守卫和同 runner session 串行化执行。
- 修正 evaluator context 截断策略，使最近对话优先进入评估 prompt。
- 增加 focused tests 和架构/harness 记录。

## 禁止改动

- 不提交 runtime DB、远程会话数据、logs、凭据、token 或部署 artifact。
- 不修改 Remote Runner 仓库源码。
- 不使用 cheat code 补造测试结果。

## 验收标准

- Tutor-facing remote command tools 对 `id && whoami`、`ip link | grep br-` 这类 compound/pipe 输入返回明确的 split-command 指导，并记录 audit error；不调用 provider 执行。
- 同一 `runner_session_id` 的 tutor command actions 在本进程内串行执行，降低 LangChain 并发工具调用造成的 `Session is busy`。
- `extract_step_context()` 在长会话里保留最近消息，而不是只保留最早消息；focused test 能复现并防回归。
- 文档记录这次真实会话发现的问题和修复边界。

## 验证命令

```sh
./scripts/harness-check.sh
PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_tutor_executor.py tests/test_remote_runner_provider.py -q
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

- 若 focused tests 无法构造现有 LangChain tool 调用路径，先用 helper 级单测覆盖并在 handoff 中说明剩余验证缺口。

## 下一步最佳动作

1. 实现 remote tool 单命令守卫与 evaluator 最近上下文修正，并补 focused tests。
