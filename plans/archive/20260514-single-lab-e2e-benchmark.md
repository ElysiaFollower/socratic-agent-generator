<!--
职责：为单实验端到端 benchmark 定义边界、验收和验证。
边界：不记录密钥、真实用户密码、运行时数据库、远程机器日志或完整对话隐私数据。
-->

# Single Lab E2E Benchmark

> 北极星校准说明：本 plan 已归档，保留历史任务边界。后续继续维护 benchmark 时，应以 `docs/product/vision.md` 和 `docs/benchmarks/single-lab-e2e.md` 的最新口径为准：`isFinished=true`、step completion 和 remote audit 是必要信号，但不能单独证明学习成功。benchmark 还需要逐步检查学生 reasoning、Tutor 是否把工具证据转化为教学，以及是否存在工具循环。

## 目标

实现一套后端 API 驱动的单实验端到端 benchmark，初始目标为 Sniffing/Spoofing。它应能在真实部署环境中登录学生账号、选择内置 profile、创建会话、可选绑定实验机、可选上传 LabSetup、驱动若干轮学生消息、检查进度、检查远程命令 audit，并输出结构化结果。

## 非目标

- 不依赖前端手点流程。
- 不在仓库中保存真实账号密码、JWT、远程机器密码、运行时 SQLite、Remote Runner state 或完整敏感日志。
- 不试图一次覆盖所有 SEED 实验。
- 不在本任务中重做 Tutor prompt、profile generator 或 Shell/Evidence 面板。
- 不强制 benchmark 在没有外部 LLM/provider/部署服务的本地 CI 中完成真实对话；本地测试覆盖 benchmark 程序逻辑和失败报告。

## 允许改动

- 新增 benchmark CLI 脚本和文档。
- 新增针对 benchmark 逻辑的单元测试。
- 更新 `docs/architecture/vnext-integrations.md`、harness feature/progress/handoff。

## 验收标准

- 有一个可执行命令能运行单实验 benchmark，并通过参数或环境变量指定 base URL、学生账号、profile、remote machine、LabSetup 文件和对话脚本。
- benchmark 输出 JSON，包含 session_id、profile_id、turns、final progress、remote audit 数量、step completion 数量、失败阶段和关键错误摘要。
- benchmark 对失败阶段有明确命名，例如 login/profile/session/remote_setup/conversation/final_validation。
- benchmark 支持 dry unit tests，不需要真实 LLM 或远程机器也能验证 SSE 解析和最终判定逻辑。
- docs 说明如何在 linux-01 上运行真实 benchmark，且不要求把密钥写进仓库。

## 验证命令

```sh
./scripts/harness-check.sh
PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_single_lab_e2e_benchmark.py -q
python3 -m compileall scripts tests
git diff --check
```

## 完成定义

- benchmark CLI、测试、文档和 harness 状态均已更新。
- 验证命令已运行并记录 evidence。
- active plan 归档。
