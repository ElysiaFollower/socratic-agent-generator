# Harness 质量

## 快照

- 上次审查：2026-05-11
- 审查者：Codex
- 总体状态：initial passing

## 健康信号

- `AGENTS.md` 长度：70 行，处于目标范围内。
- WIP limit：1
- 功能清单有效性：2026-05-11 `./scripts/harness-check.sh` 通过，0 warning。
- 交接新鲜度：2026-05-11 更新。
- 验证命令健康度：harness check、init、backend compile、frontend test、frontend build 均已通过。
- 冷启动测试：2026-05-11 `./init.sh` 通过。
- 端到端覆盖：当前主要依赖手动流程；后续需要针对生成 Profile 和学习对话补自动化覆盖。
- 重复失败是否已执行化：后续 review/CI 失败应转为测试、脚本、schema 或 lint 规则。

## 维护队列

- 为后端补充最小 pytest 覆盖，至少覆盖配置加载、health endpoint 和关键 manager 的纯逻辑。
- 为 Profile 生成和学习会话建立可重复的端到端 smoke test。
- 为 vNext 三个方向分别创建 active plan 后再实现。
- 评估并处理 npm audit 报告的 20 个依赖漏洞。
- 处理 Vite build 的大 chunk 警告和 Browserslist 数据过旧提示。
