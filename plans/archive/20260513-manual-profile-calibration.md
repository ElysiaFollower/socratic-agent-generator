<!--
职责：为本轮“真实实验历程驱动的 Profile 手工增强”定义可执行边界。
边界：不在此文件保存原始实验报告、密钥、运行日志或生成缓存。
-->

# 真实 SEED 实验 Profile 手工校准

## 目标

基于 `/Users/ely/workspace/research/agent/SEEDRunner/runs` 中本学期真实实验资料，使用当前 Socratic generator 为每个可用 SEED 实验生成初始 Persona/Curriculum/Profile，结合 `mine/` 下手写报告、真实 `.tex` 手册和已核验自动报告进行人工比对，产出更贴近学生实际实验流程的校准版 profile，并记录初始节点流设计与真实实验感受不符的模式，作为后续改进 generator 的依据。

## 非目标

- 不导入原始报告全文、截图、日志、数据库、压缩包、学生个人信息或运行缓存到本仓库。
- 不修改 generator 提示词或运行时代码；本任务先产出校准样本和失配依据。
- 不修复 Remote Runner、DreamingRAG、前端 UI 或认证问题。
- 不把自动生成 profile 直接保存到生产 SQLite 数据库作为正式发布数据。

## 当前仓库事实

- 入口规则：`AGENTS.md`
- 初始化契约：`harness/bootstrap-contract.md`
- 当前功能项：`seed-manual-profile-calibration`
- 相关文件/模块：`src/main.py`、`src/generators/ProfileGenerateManager.py`、`src/schemas/curriculum.py`、`src/schemas/definition.py`、`src/schemas/profile.py`、`docs/architecture/vnext-integrations.md`
- 已知约束：当前 base Python 缺少 LangChain 依赖；可用 `_local/socratic-smoke-venv/bin/python` 跑 generator。Socratic `.env` 没有 LLM key；DreamingRAG `.env` 中存在 DeepSeek key，但不得复制或输出密钥。

## 允许改动

- 新增 `docs/manual-enhance/` 下的语料清单、生成摘要、人工校准 profile、失配模式和后续 generator 改进依据。
- 新增只用于本任务的辅助脚本或测试，前提是不提交原始实验资料或密钥。
- 更新 `harness/feature_list.json`、`harness/progress.md`、`harness/session-handoff.md`。

## 禁止改动

- 不提交 `/Users/ely/workspace/research/agent/SEEDRunner/runs` 的原始文件副本。
- 不提交 `.env`、API key、PDF/图片、日志、数据库、向量索引、zip 或运行态缓存。
- 不改动无关功能分支遗留代码。

## 验收标准

- 识别并记录本轮覆盖的 SEED 实验、每个实验使用的 `.tex` 手册、手写报告/自动报告来源和资料可信度。
- 每个覆盖实验都有 generator 初始输出摘要、人工校准后的 profile JSON，以及校准理由。
- 有一份“与真实实验报告感触不符的节点流设计”清单，按失配模式归纳，并能追溯到具体实验和节点。
- 校准版 profile 能通过仓库 schema 校验；harness 状态与 evidence 一致。

## 验证命令

```sh
./scripts/harness-check.sh
PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_manual_enhance_profiles.py -q
python3 -m compileall src
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

- LLM provider 不可用导致无法生成初始 profile 时，先记录阻塞和已完成的语料清单，不伪造“generator 输出”。
- 真实资料缺失到无法判断某实验流程时，标记为资料不足，不凭空补全。

## 下一步最佳动作

1. 建立 SEEDRunner runs 语料清单，区分 `mine/` 手写资料和工具自动报告。
2. 通过 generator 为可覆盖实验生成初始 Persona/Curriculum/Profile 到任务 artifact 目录。
3. 人工比对真实报告体验，校准 profile，并沉淀失配模式。
