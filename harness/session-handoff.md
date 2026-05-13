# 会话交接

## 仓库状态

- 分支：`rag-memory-adapter`
- 基线提交：`594b684`（`chore(harness): initialize repo-native project harness`）
- 当前功能项：无 active；`dreamingrag-memory-integration` 与 `dreamingrag-public-api-adapter` 均已标记为 `passing`
- 当前计划：无 active；已归档 `plans/archive/20260511-dreamingrag-memory-adapter-prototype.md` 和 `plans/archive/20260513-dreamingrag-public-api-adapter.md`
- 归档范围：RAG adapter 代码、配置、测试、harness evidence、public API 迁移和归档计划；本机 smoke 工件保持 ignored。
- 分支结论：当前分支已从 DreamingRAG 内部原型对象迁移到稳定 `dreaming_rag.public_api`，可作为后续规范接口对接基线。

## 当前已验证状态

- `./scripts/harness-check.sh`：通过，0 warning。
- `python3 -m unittest tests.test_memory_provider`：通过 5 个测试。
- `python3 -m compileall src tests`：通过。
- `cd frontend && npm test -- --run`：通过 1 个测试。
- DreamingRAG adapter mock smoke：`PYTHONPATH=src conda run -n DreamingRAG python ...` 通过，确认 provider enabled、mock-mode per-session storage、turn write 和 recall context 基本可用。
- DreamingRAG adapter real smoke：使用 DreamingRAG 本地 `.env` 中的 DeepSeek 和 embedding 配置，`DreamingRAGMemoryProvider(mock_mode=False)` 写入后 recall 非空且包含 `return address`。
- CLI real smoke：创建 `_local/socratic-smoke-venv` 并安装 Socratic/DreamingRAG 依赖；种入临时 Profile `rag-smoke-buffer-overflow` 后，`src/tutor_cli.py --list` 和 `--profile-id` 可用，真实 DeepSeek 返回非空导师回复。
- 续轮 memory smoke：`Tutor.from_id("31dfa50a-3e77-4643-9993-560ee1218ab9", owner_id="cli")` 恢复同一 session 后，`pre_recall_nonempty=True`、`pre_recall_mentions_return_address=True`、`pre_recall_chars=583`、第二轮回复非空、`history_len=4`。
- DreamingRAG public API mock smoke：`PYTHONPATH=src:/Users/ely/workspace/research/agent/DreamingRAG _local/socratic-smoke-venv/bin/python ...` 通过，确认 `enabled=True`、`status_prefix=['dreamingrag', 'mock']`、`has_context=True`、`mentions_syn=True`。

## 本会话改动

- 创建实现分支 `rag-memory-adapter`；因本地已有 `dev` 分支，未使用 `dev/rag-*` 命名空间。
- 新增 `src/utils/memory_provider.py`，定义窄 `MemoryProvider` 协议、null provider、DreamingRAG provider、prompt context 格式化和安全路径分段。
- 更新 `src/config.py` 和 `.env.example`，加入 DreamingRAG memory adapter 开关、repo path、mock mode、recall 数量和 context 长度配置；默认开启，显式设置 `DREAMINGRAG_MEMORY_ENABLED=false` 可关闭。
- 更新 `src/utils/tutor_core.py`：Tutor 初始化 provider，生成前 recall 并追加系统记忆 note，生成后容错写入 user/assistant turn。
- 新增 `tests/test_memory_provider.py` 和 `tests/__init__.py`，覆盖 adapter 关键行为。
- 更新 `data/.gitignore`，忽略 `data/dreamingrag_memory/` 运行时记忆数据。
- 更新 harness evidence、progress 和归档计划。
- 更新 `.env.example`，说明 real mode 需要在后端 Python 环境安装 DreamingRAG 依赖。
- 迁移 `src/utils/memory_provider.py` 到 DreamingRAG public API：通过 `DreamingRAGMemory(MemoryAPIConfig(...))` 初始化，使用 `recall(..., include_scores=True)` 和 `remember(..., metadata=...)`，不再调用 DreamingRAG 内部对象或私有检索方法。
- 更新 `tests/test_memory_provider.py`，用 fake public API client 覆盖 session-scoped storage、public record formatting 和 turn metadata。
- 更新 `docs/architecture/vnext-integrations.md` 与 `.env.example`，声明当前集成边界为 `dreaming_rag.public_api`。
- 为真实 smoke 创建了忽略目录 `_local/socratic-smoke-venv`，并产生忽略的 `data/socratic_agent.db` 与 `data/dreamingrag_memory/` 本地运行时数据。

## 仍损坏或未验证

- 已跑真实 `.env` + DeepSeek + DreamingRAG real-mode CLI smoke；未跑完整 Web 前端端到端人工流程。
- DreamingRAG 仍是外部开发中项目；当前集成已锚定其 public API，但真实模式性能、依赖安装稳定性和长期兼容仍需后续 hardening。
- Socratic 后端环境若未安装 DreamingRAG 依赖，adapter 会降级为空记忆，不会阻断 Tutor；本次系统 `python3` smoke 中缺 `openai` 时已验证该降级路径。
- 记忆写入现在是同步调用；真实模式若写入慢，可能影响响应完成后的尾部延迟。
- 没有前端设置页、记忆管理、删除/导出或用户可见开关；本原型只靠环境变量。
- CLI 可用但不是零配置 demo：`src/tutor_cli.py --profile-id` 需要数据库中已有 Profile；初始空数据库只能 `--list` 显示无 Profile。
- `npm ci` 既有 20 个依赖漏洞、Vite chunk 超 500 kB 和 Browserslist 过旧问题仍未处理。

## 清洁状态

- 构建/静态检查：`python3 -m compileall src tests` 已通过；运行后产生的 `__pycache__` 在收尾时清理。
- 测试/端到端：focused unittest、前端 smoke、CLI real smoke 和 Tutor resumed-session memory smoke 已通过；完整 Web 端到端未跑。
- 进度状态：`harness/feature_list.json`、`harness/progress.md`、归档计划和本 handoff 已同步到 `passing`。
- 临时工件：不应提交 `_local/`、`frontend/node_modules/`、`__pycache__/`、`data/socratic_agent.db`、`data/dreamingrag_memory/`、日志、模型缓存或记忆索引；这些当前均为忽略文件。
- 启动路径：下一会话可先运行 `./init.sh` 和 `./scripts/harness-check.sh` 恢复上下文。

## 下一步最佳动作

1. 提交并推送 `rag-memory-adapter` 分支；后续可在该基线上处理依赖安装说明、真实模式性能、异步写入、错误观测和更完整的 Web E2E。

## 命令

- 初始化：`./init.sh`
- Harness 检查：`./scripts/harness-check.sh`
- 后端语法验证：`python3 -m compileall src tests`
- DreamingRAG adapter focused test：`python3 -m unittest tests.test_memory_provider`
- DreamingRAG public API smoke：`PYTHONPATH=src:/Users/ely/workspace/research/agent/DreamingRAG _local/socratic-smoke-venv/bin/python <mock-mode smoke script>`
- 前端单元验证：`cd frontend && npm test -- --run`
- 前端构建验证：`cd frontend && npm run build`
- 调试说明：后端看 FastAPI 日志和 `/docs`；前端看浏览器控制台、Network 面板和 Vite 输出。
