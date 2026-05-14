# 会话交接

## 仓库状态

- 分支：`vnext-profile-management-doc-identity`
- 当前功能项：无 active；`vnext-profile-management-document-identity` 状态 `passing`。
- Active plan：无；计划已归档到 `plans/archive/20260514-profile-management-document-identity.md`。
- 目标分支：`dev`。
- 当前 PR：尚未创建。

## 当前已验证状态

- PR #17、#19、#20 已合并到 `dev`；当前分支基于最新 `dev`。
- 已完成 vNext 单实验 E2E benchmark：`scripts/benchmarks/single_lab_e2e.py` 与 `docs/benchmarks/single-lab-e2e.md`。
- 已完成会话右侧 Shell/Evidence 面板：会话顶栏终端按钮打开只读面板，展示 `/api/sessions/{session_id}/remote-audits` 中的脱敏命令证据。
- 已完成 Profile Management 文档身份 UX：lab manual 列表返回稳定 `document_id`、`display_name`、filename、owner、相对 source/index path、size、preview excerpt 和引用 profile 列表。
- Lab Manual Management 支持 display name 编辑；该操作只改 `Document.meta_info.display_name`，不改变 `doc_name`、存储路径、索引路径或已有 profile 的 `document_id` 引用。
- Lab Manual Management 的查看/删除优先使用 `document_id` API，旧 `lab_name` API 保留兼容；删除仍提示引用 profile 并将引用标记失效，而不是阻止删除或级联删除 profile。
- Generate Profile 文档选择列表增加只读身份卡、引用数、source path、文件大小和短 preview；完整查看、删除、重命名仍保留在 Lab Manuals 管理入口。
- lab manual readiness 同时检查同目录 artifact 与引用 profile 的 persona/curriculum 数据，修复内置校准 profile 显示“有 curriculum、无 persona”的误导。
- linux-01 最终演示部署在上一轮已通过，服务仍预期为 tmux `socratic-backend`、`socratic-frontend`。

## 验证记录

- `./init.sh` 通过。
- `PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_default_profile_seed.py -q` 通过 6 passed。
- `python3 -m compileall src tests` 通过。
- `cd frontend && npm test -- --run` 通过。
- `cd frontend && npm run build` 通过。
- `git diff --check` 通过。
- `./scripts/harness-check.sh` 通过 0 warning。

## 仍损坏或未验证

- 当前分支未重新部署到 linux-01；这是管理页 UX/API 改动，本地构建验证已通过。
- vNext 单实验 benchmark 的 live linux-01 run 仍需要通过环境变量提供 `SOCRATIC_BENCHMARK_PASSWORD`，未写入仓库。
- Profile generation quality evaluation 仍是下一项 vNext 目标，尚未开始实现。

## 设计结论

- 文档身份以 `Document.id` 为稳定操作键；`doc_name` 保持向后兼容和生成链路输入，display name 仅用于人类可读识别。
- 对外展示路径使用 repo-relative 或文件名，不暴露本机绝对路径。
- Generate Profile 不复制完整 Lab Manuals 管理能力，只提供足够核验选中文档身份的只读 preview。
- 删除文档时提示引用方并使引用失效；不应因为存在引用而彻底不能删。

## 清洁状态

- 不提交 runtime SQLite、session cache、Remote Runner state/logs、tmux 日志、LLM key、SSH key、password 或 token。
- 当前改动集中在 Profile API、DocumentManager、Lab Manual/Profile Generator 前端、i18n、测试和 harness/docs。

## 下一步最佳动作

1. 运行 `./scripts/harness-check.sh` 和必要的最终验证。
2. 提交并推送 `vnext-profile-management-doc-identity`。
3. 创建 PR 到 `dev` 并合并。
4. 之后开启 `vnext-profile-generation-evaluation`。

## 命令

- `./init.sh`
- `./scripts/harness-check.sh`
- `PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_default_profile_seed.py -q`
- `python3 -m compileall src tests`
- `cd frontend && npm test -- --run`
- `cd frontend && npm run build`
- `git diff --check`
