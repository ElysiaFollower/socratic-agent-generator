# Harness 质量

## 快照

- 上次审查：2026-05-14
- 审查者：Codex
- 总体状态：vNext demo stack is implemented and documented; remaining work is quality evaluation, persistent shell integration, and production hardening.

## 健康信号

- `AGENTS.md` 长度：72 行，处于目标范围内。
- WIP limit：1
- 功能清单有效性：2026-05-14 `./scripts/harness-check.sh` 通过，0 warning。
- 交接新鲜度：2026-05-14 更新。
- 验证命令健康度：harness check、init、backend compile、frontend test、frontend build 均已通过。
- 冷启动测试：2026-05-11 `./init.sh` 通过。
- 官方部署文档：`docs/deployment.md` 是维护入口；默认部署包含 DreamingRAG editable install、`.env` 配置、smoke checks 和故障排查。
- 产品北极星：`docs/product/vision.md` 已成为唯一事实来源之一；后续学习流、Tutor、profile、benchmark、Remote tool 和前端证据面板变更必须显式对齐。
- 端到端覆盖：已有 `scripts/benchmarks/single_lab_e2e.py`，但仍需补学习质量检查；通关、step completion 和工具 audit 不能单独证明学生真的学到了。
- Remote Runner 可观察性：会话 Shell/Evidence 面板已从 command tabs 修正为 terminal/session transcript tabs；当前只读，可建立证据信任，但学生可写 terminal 依赖上游持久 shell 能力。
- 重复失败是否已执行化：后续 review/CI 失败应转为测试、脚本、schema 或 lint 规则。

## 维护队列

- 为后端补充最小 pytest 覆盖，至少覆盖配置加载、health endpoint 和关键 manager 的纯逻辑。
- 为 Profile 生成和学习会话建立可重复的端到端 smoke test，并增加学生 reasoning、Tutor evidence-to-learning 转化、工具循环检测等质量信号。
- 合并并部署 `vnext-session-shell-terminal-tabs` 后，在 linux-01 做一次轻量 smoke，确认 Shell/Evidence 面板以 terminal transcript 方式展示真实 remote audit。
- Persistent shell 已接入 Socratic 的受控命令输入和 transcript 展示；后续若要支持复杂 TUI/raw input，应单独设计 raw `session send` 的 policy、audit 和前端渲染。
- 为 RAG 检索建立一等 audit API，让 benchmark 能直接检查 lab manual/document retrieval 是否发生，以及 Tutor 是否把检索结果转化为教学。
- 当 `src/utils/memory_provider.py`、`src/config.py`、`.env.example` 或 DreamingRAG `public_api`/依赖变化时，同步维护 `docs/deployment.md`、README 链接和部署 smoke。
- 评估并处理 npm audit 报告的 20 个依赖漏洞。
- 处理 Vite build 的大 chunk 警告和 Browserslist 数据过旧提示。
