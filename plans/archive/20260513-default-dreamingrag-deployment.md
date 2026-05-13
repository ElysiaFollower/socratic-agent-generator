<!--
职责：把 DreamingRAG 默认安装和配置沉淀为官方部署文档。
边界：不修改 DreamingRAG 源码，不引入 submodule，不处理生产运维平台、Docker、CI/CD 或完整 Web E2E。
-->

# Default DreamingRAG Deployment Docs

## 目标

让默认部署路径真实包含 DreamingRAG：

- 新增或更新官方部署文档，明确 Socratic + DreamingRAG 的默认安装、配置、验证和启动流程。
- README 和中文 README 从快速开始入口指向官方部署文档。
- `.env.example` 和 `init.sh` 的依赖说明与默认 DreamingRAG 安装保持一致。
- Harness 记录部署文档需要长期维护，避免后续接口或依赖变化后文档漂移。

## 非目标

- 不把 DreamingRAG 复制进本仓库或改成 submodule。
- 不修改 DreamingRAG 项目代码、依赖或 public API。
- 不新增 Docker、systemd、Nginx、云平台或 CI/CD 部署流程。
- 不跑完整 Web 手动端到端；本任务验证文档、配置说明和轻量 import/smoke。

## 当前事实

- Socratic adapter 已通过 `dreaming_rag.public_api.DreamingRAGMemory` 集成 DreamingRAG。
- 默认配置 `DREAMINGRAG_MEMORY_ENABLED=true`。
- `DREAMINGRAG_REPO_PATH` 默认指向 sibling `../DreamingRAG`。
- DreamingRAG 有 `setup.py`，`python_requires=">=3.10"`，可用 `pip install -e ../DreamingRAG` 安装。

## 允许改动

- `docs/`
- `README.md`
- `docs/README.zh.md`
- `.env.example`
- `init.sh`
- `requirements.txt` 中的安装说明注释
- `harness/feature_list.json`
- `harness/progress.md`
- `harness/session-handoff.md`
- `harness/quality.md`
- `plans/active/` 与 `plans/archive/`

## 验收标准

- 仓库存在官方部署文档，并把 DreamingRAG 列为默认安装项而非可选事后补充。
- 部署文档包含 clone 布局、Python 版本、后端依赖、DreamingRAG editable install、前端依赖、`.env` 配置、mock smoke、启动命令和故障排查。
- README 和中文 README 能引导用户进入官方部署文档。
- `init.sh` 输出的依赖安装命令与官方部署文档一致。
- Harness 状态、进度和 handoff 记录本任务 evidence。

## 验证命令

```bash
./scripts/harness-check.sh
python3 -m compileall src tests
python3 - <<'PY'
from pathlib import Path
for path in [
    Path("docs/deployment.md"),
    Path("README.md"),
    Path("docs/README.zh.md"),
    Path(".env.example"),
    Path("init.sh"),
]:
    text = path.read_text()
    assert "DreamingRAG" in text, path
print("deployment_docs_reference_dreamingrag=True")
PY
```

## 完成定义

- active feature 切到 `passing` 并包含验证 evidence。
- 本 plan 归档。
- `harness/session-handoff.md` 写明当前状态、风险、下一步和清洁状态。

## 归档结果

- 新增官方部署文档：`docs/deployment.md`。
- 默认安装路径：Python 3.10、`pip install -r requirements.txt`、`pip install -e ../DreamingRAG`、`cd frontend && npm ci`。
- 默认配置路径：`.env.example` 保持 `DREAMINGRAG_MEMORY_ENABLED=true`，并补充 DreamingRAG repo path、mock mode、cue recall 和 Volcengine embedding provider 配置。
- 入口同步：`README.md`、`docs/README.zh.md`、`AGENTS.md`、`docs/overview.md`、`harness/bootstrap-contract.md`、`init.sh` 和 `requirements.txt` 已指向默认部署路径。
- 维护要求：`harness/quality.md` 已记录 `docs/deployment.md` 是官方部署维护入口。
- 验证：2026-05-13 `./scripts/harness-check.sh` 通过 0 warning；harness audit 通过 0 warning；`python3 -m compileall src tests` 通过；部署文档引用检查输出 `deployment_docs_reference_dreamingrag=True`；`_local/socratic-smoke-venv/bin/pip install -e ../DreamingRAG` 成功安装 `dreaming-rag-0.5.0`；DreamingRAG public API smoke 输出 `dreamingrag_public_api_ready=True`；Socratic adapter smoke 输出 `socratic_dreamingrag_context_ready=True`。
