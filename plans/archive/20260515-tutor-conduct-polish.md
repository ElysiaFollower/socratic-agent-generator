<!--
职责：定义本轮 Tutor 真实会话收口体验修正的任务合同。
边界：不要记录真实凭据、完整会话原文、部署日志或长期愿景全文。
-->

# Tutor Conduct Polish

## 目标

修复部署侧完整 Sniffing/Spoofing 会话暴露出的两个 tutor 运行时体验问题：不要把 LangChain early stopping 文本 `Agent stopped due to max iterations` 暴露给学生；当最后一个课程节点通过后，Tutor 应给出清晰的实验完成收尾和报告证据链提示，而不是继续像还要进入下一步任务。

## 非目标

- 不重写 StepEvaluator。
- 不调整 SEED profile 内容和成功标准。
- 不改变 Remote Runner adapter、sudo、Shell 面板或部署数据。
- 不把最终总结做成新的 LLM 调用；收尾应稳定、低风险、不会增加流式等待。

## 当前仓库事实

- 产品北极星：`docs/product/vision.md` 要求 Tutor 回到学习目标，并把实验结果整理为报告可用证据链。
- Tutor 流式核心：`src/utils/tutor_core.py::stream_message()`。
- 转场消息：`src/utils/tutor_core.py::_generate_transition_message()`。
- Focused tests：`tests/test_tutor_executor.py`。
- 真实部署会话 `03afb887-1cb8-4769-8e17-ff6f33c9fc17` 已完成 9/9，但中途出现过 early stopping 文本，最终回复收尾不够清晰。

## 允许改动

- 在 tutor runtime 中增加 reply 后处理 helper，清理 early stopping 系统文本。
- 在最后一步通过时追加或替换为确定性的完成收尾消息。
- 更新 focused tests、harness 和必要文档记录。

## 禁止改动

- 不提交 runtime DB、Remote Runner state、logs、真实 session artifact、token、密码或 SSH key。
- 不修改部署机数据。
- 不绕过 evaluator 强行推进进度。

## 验收标准

- 如果 AgentExecutor 返回 `Agent stopped due to max iterations.`，最终给学生的 reply 不包含该系统文本。
- 如果最后一个 step 通过并使 session finished，最终 reply 明确说明实验已完成，并包含报告证据链提示。
- 非最终 step 的 transition 行为保持不变。
- Focused tests 覆盖 early stopping 清理和最终完成消息。

## 验证命令

```sh
./scripts/harness-check.sh
PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_tutor_executor.py -q
python3 -m compileall src tests
git diff --check
```

## 完成定义

- 行为实现并通过验证。
- `harness/feature_list.json` 记录 evidence。
- active plan 归档。
- `harness/progress.md` 和 `harness/session-handoff.md` 更新当前状态、风险和下一步。
