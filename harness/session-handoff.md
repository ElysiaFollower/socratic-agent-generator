# 会话交接

## 仓库状态

- 分支：`rag-memory-adapter`
- 当前功能项：无 active；`linux01-live-deployment` 已标记为 `passing`
- 当前计划：无 active；`plans/archive/20260513-linux01-live-deployment.md` 已归档
- 当前目标：最终演示形态已部署到 `linux-01`，包含 RAG memory adapter、Remote Runner 工具、6 个预制 SEED 实验 profile 和统一火山方舟 embedding。
- 当前代码状态：`manual-enhance` 已合并进 `rag-memory-adapter`，因此当前分支包含 remote-tool、manual-enhance/default profile、DreamingRAG public API adapter 和部署文档。

## 当前已验证状态

- 初始化：`./init.sh` 通过；当前 active plan 为 linux-01 部署。
- Harness：`./scripts/harness-check.sh` 通过，0 warning。
- 语法验证：`python3 -m compileall src scripts tests` 通过。
- 合并后 focused tests：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_skill_names.py tests/test_embedding_provider.py tests/test_memory_provider.py tests/test_remote_runner_provider.py tests/test_default_profile_seed.py tests/test_manual_enhance_profiles.py -q` 通过，24 passed。
- 追加验证：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_tutor_executor.py -q` 通过；随后又补跑全量 focused suite，25 passed。
- 默认 embedding 检查：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python - <<'PY' ... check_and_download_models() ... PY` 输出 `(True, [], [])`，确认默认 `EMBEDDING_PROVIDER=volcengine` 不再触发 HuggingFace 下载。
- linux-01 远端连通：`remote-runner machine doctor linux-01 --json` 通过；先前部署尝试确认旧 Socratic 进程可清理、tmux 可用、conda env `/root/miniconda3/envs/SocraticAgent` 可用。
- linux-01 最终部署：远端 focused pytest 22 passed；`model_check=(True, [], [])`；`embedding_class=VolcengineArkEmbeddings`；默认 public profile count=6；外部 health/docs/frontend curl 通过；demo 登录、profile list、session creation 和 `yes` 流式回复通过，且工具迭代不会过早截断。
- 追加真实演示：使用 `admin` 账号在 linux-01 上完成了一次两轮真实对话 smoke，session 历史已保留，`history_len=5`。

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
- 修复 `BaseSkill.name` 在远端缺少 `SKILL.md` 时回退为 `unknown_skill` 的问题，避免 DeepSeek 拒绝重复工具名。
- 调整 Tutor 的 AgentExecutor 配置为更高的最小迭代数并启用 `early_stopping_method="generate"`，避免工具驱动的教学回复在查资料阶段提前收尾。
- 完成 admin 真实对话 smoke，验证会话历史可保留并在后续展示时继续读取。

## 仍损坏或未验证

- 尚未配置正式域名、HTTPS、反向代理或 systemd；当前按用户要求使用 tmux 持久化演示服务。
- `DREAMINGRAG_MEMORY_MOCK_MODE` 是否开启取决于演示稳定性：若只展示 Socratic 主流程，可用 mock memory；若展示真实长期记忆，需要确认 Volcengine 与 DreamingRAG real mode 真实 API 可用。
- Remote Runner tool 仍默认关闭：`REMOTE_TOOL_ENABLED=false`。若导师演示需要远程环境观察，要在部署 env 中显式开启并设置 allowlist。

## 清洁状态

- 不提交 `_local/`、`frontend/node_modules/`、`data/*.db`、`data/dreamingrag_memory/`、向量索引、模型缓存、日志或任何 provider key。
- `plans/active/` 只保留 `.gitkeep`；当前无 active plan。
- 当前还需要提交并 push 本 handoff/progress/feature evidence 收口记录。

## 下一步最佳动作

1. 将 `http://10.203.15.128:5173` 发给导师演示。
2. 如需长期公开访问，再补域名、HTTPS、反向代理和 systemd。
3. 如需展示 Remote Runner 工具能力，开启 `REMOTE_TOOL_ENABLED=true` 并收紧 machine/command allowlist。

## 命令

- 初始化：`./init.sh`
- Harness 检查：`./scripts/harness-check.sh`
- 后端 focused tests：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_skill_names.py tests/test_embedding_provider.py tests/test_memory_provider.py tests/test_remote_runner_provider.py tests/test_default_profile_seed.py tests/test_manual_enhance_profiles.py -q`
- 语法验证：`python3 -m compileall src scripts tests`
- 默认 embedding 下载检查：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python - <<'PY' ... check_and_download_models() ... PY`
