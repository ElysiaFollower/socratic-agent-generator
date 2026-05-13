<!--
职责：把 Socratic Tutor 的 DreamingRAG 集成从内部原型对象迁移到 DreamingRAG 稳定 public API。
边界：不扩大到记忆管理 UI、异步队列、DreamingRAG 内部实现、依赖打包或完整 Web E2E。
-->

# DreamingRAG Public API Adapter

## 背景

本地 DreamingRAG 已提供规范化接口 `dreaming_rag.public_api.DreamingRAGMemory` 和 `MemoryAPIConfig`。Socratic 当前 `rag-memory-adapter` 原型仍直接依赖 `DreamingBrain`、`_recall_memories_with_scores` 和 `hippocampus` 私有对象，不再适合作为长期集成边界。

## 目标

把 Socratic 的 `MemoryProvider` adapter 迁移到 DreamingRAG public API：

- 通过 `DreamingRAGMemory(MemoryAPIConfig(...))` 初始化 per-session 记忆客户端。
- 通过 `recall(..., include_scores=True)` 获取 `MemoryRecord`，并格式化为 prompt context。
- 通过 `remember(..., source=..., metadata=...)` 记录 user/assistant turn。
- 保留默认开启、依赖缺失降级为空记忆、per-session storage 和 prompt 注入行为。

## 非目标

- 不复制 DreamingRAG 源码或把它变成 submodule。
- 不让 DreamingRAG 接管 Tutor 回复生成。
- 不新增前端记忆管理、删除/导出、异步写入或生产级依赖安装流程。
- 不修改 DreamingRAG 仓库内部代码。

## 验收标准

- `src/utils/memory_provider.py` 不再导入或调用 `DreamingBrain`、`hippocampus`、`_recall_memories_with_scores` 等私有边界。
- focused tests 覆盖 public API 客户端初始化、recall 格式化、remember 写入 metadata 和降级路径。
- 使用本地 DreamingRAG public API 的 mock-mode smoke 能写入、recall 并生成非空 context。
- Harness 状态、进度日志和 session handoff 更新到 passing，并归档本 plan。

## 验证命令

```bash
./scripts/harness-check.sh
python3 -m unittest tests.test_memory_provider
python3 -m compileall src tests
PYTHONPATH=src:/Users/ely/workspace/research/agent/DreamingRAG _local/socratic-smoke-venv/bin/python <public API mock smoke>
```

## 实施步骤

1. 更新 active feature 状态。
2. 迁移 adapter 到 `DreamingRAGMemory` public API。
3. 更新 focused tests 和必要文档。
4. 运行验证，记录 evidence。
5. 归档 plan、提交并推送 `rag-memory-adapter`。

## 归档结果

- 实现：`src/utils/memory_provider.py` 已通过 `DreamingRAGMemory` 与 `MemoryAPIConfig` 调用 DreamingRAG public API；recall 读取 public `MemoryRecord`，turn 写入使用 `remember(..., metadata=...)`。
- 测试：`tests/test_memory_provider.py` 改为 fake public API client，不再围绕内部脑模型或私有记忆容器建模。
- 文档：`.env.example` 与 `docs/architecture/vnext-integrations.md` 已明确 public API 集成边界。
- 验证：2026-05-13 `python3 -m unittest tests.test_memory_provider` 通过 5 个测试；`python3 -m compileall src tests` 通过；`./scripts/harness-check.sh` 通过且 0 warning；public API mock smoke 通过，输出 `enabled=True`、`has_context=True`、`mentions_syn=True`。
- 降级：系统 `python3` 缺少 DreamingRAG 依赖 `openai` 时，adapter 记录 warning 并返回空 context，没有阻断调用。
