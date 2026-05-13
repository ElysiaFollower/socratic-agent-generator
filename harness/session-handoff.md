# 会话交接

## 仓库状态

- 分支：`rag-memory-adapter`
- 当前功能项：`linux01-live-deployment`，状态为 `active`
- 当前计划：`plans/active/20260513-linux01-live-deployment.md`
- 当前目标：把 RAG memory adapter、Remote Runner 工具、6 个预制 SEED 实验 profile 和统一火山方舟 embedding 的最终形态部署到 `linux-01`。
- 当前代码状态：`manual-enhance` 已合并进 `rag-memory-adapter`，因此当前分支包含 remote-tool、manual-enhance/default profile、DreamingRAG public API adapter 和部署文档。

## 当前已验证状态

- 初始化：`./init.sh` 通过；当前 active plan 为 linux-01 部署。
- Harness：`./scripts/harness-check.sh` 通过，0 warning。
- 语法验证：`python3 -m compileall src scripts tests` 通过。
- 合并后 focused tests：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_embedding_provider.py tests/test_memory_provider.py tests/test_remote_runner_provider.py tests/test_default_profile_seed.py tests/test_manual_enhance_profiles.py -q` 通过，22 passed。
- 默认 embedding 检查：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python - <<'PY' ... check_and_download_models() ... PY` 输出 `(True, [], [])`，确认默认 `EMBEDDING_PROVIDER=volcengine` 不再触发 HuggingFace 下载。
- linux-01 远端连通：`remote-runner machine doctor linux-01 --json` 通过；先前部署尝试确认旧 Socratic 进程可清理、tmux 可用、conda env `/root/miniconda3/envs/SocraticAgent` 可用。

## 本会话改动

- 将 `manual-enhance` 合并入 `rag-memory-adapter`，保留：
  - `src/utils/remote_runner_provider.py`、`src/utils/remote_tool_skill.py` 和 Remote Runner tests；
  - `docs/manual-enhance/` 的 generator 初稿、人工校准 profile、mismatch taxonomy；
  - `src/utils/default_profile_seed.py` 和默认 profile seed tests；
  - 6 个内置 public profile：`ARP_Attack`、`LocalDNSAttack`、`RemoteDNSAttack`、`Sniffing_Spoofing`、`TCP_Attacks`、`VPN_Tunnel`。
- 新增 `src/utils/embedding_provider.py`，提供 LangChain-compatible `VolcengineArkEmbeddings`。
- Socratic 文档 RAG 与 DreamingRAG memory 统一使用 `EMBEDDING_PROVIDER=volcengine`、`VOLCENGINE_API_KEY`、`VOLCENGINE_EMBEDDING_MODEL`、`VOLCENGINE_EMBEDDING_BASE_URL`。
- `src/utils/skills.py` 改为通过统一 embedding factory 获取 embeddings。
- `src/utils/model_manager.py` 在非 `huggingface` provider 下跳过 HuggingFace 模型下载；HuggingFace 仅作为显式 fallback。
- 更新 `.env.example`、`docs/deployment.md` 和 `requirements.txt`，把 Volcengine embedding 写入默认部署路径，并显式说明 HuggingFace 不是默认部署依赖。
- 新增 `tests/test_embedding_provider.py`，覆盖火山文本 embedding 和 vision/multimodal embedding payload。
- 修复 student 创建内置 public profile session 的 403 问题，避免演示账号能看到 profile 但不能进入学习会话。

## 仍损坏或未验证

- linux-01 当前正式服务还未收口到最终成功链接；上一次后端启动卡在旧 HuggingFace embedding 下载路径，本会话已修复代码，下一步需要重新打包、上传、部署并验证。
- 远端 `.env` 必须包含 `VOLCENGINE_API_KEY`；可从服务器既有 Socratic `.env` 复用，但部署命令不能打印密钥。
- `DREAMINGRAG_MEMORY_MOCK_MODE` 是否开启取决于演示稳定性：若只展示 Socratic 主流程，可用 mock memory；若展示真实长期记忆，需要确认 Volcengine 与 DreamingRAG real mode 真实 API 可用。
- Remote Runner tool 仍默认关闭：`REMOTE_TOOL_ENABLED=false`。若导师演示需要远程环境观察，要在部署 env 中显式开启并设置 allowlist。

## 清洁状态

- 不提交 `_local/`、`frontend/node_modules/`、`data/*.db`、`data/dreamingrag_memory/`、向量索引、模型缓存、日志或任何 provider key。
- `plans/active/` 只保留当前 linux-01 部署计划；`.gitkeep` 已删除以满足 WIP=1。
- 当前还需要提交并 push 当前分支，然后继续远端部署验证。

## 下一步最佳动作

1. 提交当前 embedding 统一、部署 plan 和 harness 更新。
2. push `rag-memory-adapter` 到远端。
3. 重新生成 linux-01 部署包，远端清理旧 Socratic 数据，部署当前分支。
4. 用 tmux 启动后端和前端，验证 `http://10.203.15.128:5173` 与 `http://10.203.15.128:8000/docs`。

## 命令

- 初始化：`./init.sh`
- Harness 检查：`./scripts/harness-check.sh`
- 后端 focused tests：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_embedding_provider.py tests/test_memory_provider.py tests/test_remote_runner_provider.py tests/test_default_profile_seed.py tests/test_manual_enhance_profiles.py -q`
- 语法验证：`python3 -m compileall src scripts tests`
- 默认 embedding 下载检查：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python - <<'PY' ... check_and_download_models() ... PY`
