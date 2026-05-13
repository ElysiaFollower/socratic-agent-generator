# 会话交接

## 仓库状态

- 分支：`manual-enhance`
- 基线：从 `remote-tool` 切出，保留 repo-native harness、DreamingRAG adapter 和 Remote Runner adapter 原型。
- 当前功能项：`seed-manual-profile-calibration`，状态为 `passing`
- 当前计划：无 active；`plans/archive/20260513-manual-profile-calibration.md` 已归档
- 当前目标：本学期真实 SEED 实验的 generator 初稿、人工校准版 profile 和 mismatch 改进依据已经沉淀到仓库。

## 当前已验证状态

- 初始化：`./init.sh` 通过，harness 检查 0 warning。
- Generator 环境：base Python 缺少 `langchain_deepseek` / `langchain_core`；`_local/socratic-smoke-venv/bin/python` 可导入这些依赖。
- LLM key：Socratic `.env` 无 key；生成初稿时通过 `--dotenv /Users/ely/workspace/research/agent/DreamingRAG/.env` 临时加载 DeepSeek key，未复制或输出密钥。
- 初始生成：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python scripts/generate_manual_enhance_profiles.py --dotenv /Users/ely/workspace/research/agent/DreamingRAG/.env --fast --skip-existing` 成功，输出在 `docs/manual-enhance/generated/`。
- 校准生成：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python scripts/build_manual_enhance_calibrated_profiles.py` 成功，输出在 `docs/manual-enhance/calibrated/`。
- Focused tests：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_manual_enhance_profiles.py -q` 通过 `4 passed`。
- Harness：`./scripts/harness-check.sh` 通过，0 warning。
- 语法验证：`python3 -m compileall src scripts tests` 通过。

## 本会话改动

- 创建并切换分支 `manual-enhance`；`dev/manual-enhance` 因本地已有 `dev` 分支无法创建。
- 新增并归档 `plans/archive/20260513-manual-profile-calibration.md`。
- 更新 `harness/feature_list.json`，新增 `seed-manual-profile-calibration` 并标记为 `passing`，记录 evidence。
- 更新 `harness/progress.md` 和本交接文件。
- 更新 `docs/.gitignore`，允许提交 `docs/manual-enhance/`。
- 新增 `scripts/generate_manual_enhance_profiles.py`，从外部 SEEDRunner runs 读取资料并生成 first-pass profile。
- 新增 `scripts/build_manual_enhance_calibrated_profiles.py`，构建人工校准版 profile 和 mismatch taxonomy。
- 新增 `tests/test_manual_enhance_profiles.py`，校验 schema、语料来源策略、mismatch 可追溯性和初稿/校准版分离。
- 新增 `docs/manual-enhance/`，包含 corpus manifest、6 个实验 generator 初稿、6 个实验校准版 profile、summary、mismatch taxonomy 和 README。

## 结论

已覆盖 6 个 SEED 实验：

- `ARP_Attack`
- `LocalDNSAttack`
- `RemoteDNSAttack`
- `Sniffing_Spoofing`
- `TCP_Attacks`
- `VPN_Tunnel`

人工校准后的主线更贴近真实实验过程：先建立环境/角色/路由/缓存基线，再推进攻击或隧道任务，并把失败、竞态、负例和证据链作为学习节点。

记录的 generator 改进依据在 `docs/manual-enhance/mismatch-taxonomy.json`，核心模式包括：环境摩擦被省略、成功标准过度确定、负例没有成为学习节点、证据链不足、任务粒度不贴合真实认知负担、源文档编号问题未被校正。

## 仍损坏或未验证

- `RemoteDNSAttack` 校准可信度低于其他实验，因为只找到 `.tex` 和 draft notes，没有同等详细的手写完整报告。
- 校准版 profile 已通过 schema 校验，但尚未导入 SQLite，也未通过 Web UI 真实对话体验验证。
- 本任务没有修改 generator 提示词或 critic；mismatch taxonomy 是后续改进依据。
- 既有 Remote Runner 远端部署阻塞仍存在：`linux-01` 的保存认证配置此前已过期，不属于本分支目标。

## 清洁状态

- 原始 SEEDRunner 报告、`.tex`、PDF、图片、日志、zip、数据库和密钥没有复制进本仓库；仓库只保存外部路径、文件大小、生成 profile、校准 profile 和人工归纳。
- 运行态目录 `_local/`、`frontend/node_modules/`、`data/socratic_agent.db` 是 ignored，不应提交。
- `plans/active/` 只保留 `.gitkeep`；当前无 active plan。
- 已运行并记录：`./scripts/harness-check.sh`、`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_manual_enhance_profiles.py -q`、`python3 -m compileall src scripts tests`。

## 下一步最佳动作

1. 基于 `docs/manual-enhance/mismatch-taxonomy.json` 新开任务改 generator prompt / critic，让生成器默认保留环境摩擦、负例、证据链和真实认知粒度。
2. 将 `docs/manual-enhance/calibrated/*/profile.json` 中的 profile 导入本地开发数据库，启动前后端做一次真实 Tutor 对话 smoke。
3. 若要提高 RemoteDNSAttack 可信度，补充或重新执行该实验的完整报告，再更新校准版 profile。

## 命令

- 初始化：`./init.sh`
- Harness 检查：`./scripts/harness-check.sh`
- 手工增强 profile 测试：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_manual_enhance_profiles.py -q`
- 语法验证：`python3 -m compileall src scripts tests`
- 重新生成初稿：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python scripts/generate_manual_enhance_profiles.py --dotenv /Users/ely/workspace/research/agent/DreamingRAG/.env --fast --skip-existing`
- 重建校准版：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python scripts/build_manual_enhance_calibrated_profiles.py`
