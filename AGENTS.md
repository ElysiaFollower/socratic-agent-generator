<!--
职责：为自动化 agent 指明本仓库的事实来源、启动流程、范围规则和验证门禁。
边界：不要把任务历史、长篇架构说明、临时笔记、密钥、日志或生成文件放进这个入口文件。
-->

# AGENTS.md

## 项目目标

Socratic Agent Generator 是一个基于苏格拉底式教学的智能辅导系统，将技术实验手册自动转换为可交互的 AI 导师，并通过 Web 界面支持生成、审阅、部署和学习对话。

## 唯一事实来源

- 项目概览和边界：`docs/overview.md`
- vNext 集成方向：`docs/architecture/vnext-integrations.md`
- 架构事实：`docs/architecture/`
- 初始化契约：`harness/bootstrap-contract.md`
- 功能清单：`harness/feature_list.json`
- 当前任务：`plans/active/`
- 进度日志：`harness/progress.md`
- 决策日志：`harness/decisions.md`
- 当前交接：`harness/session-handoff.md`
- 可观测性：`harness/observability.md`
- 质量和维护：`harness/quality.md`

## 每次会话开始

1. 读本文件、`docs/overview.md` 和 `harness/bootstrap-contract.md`。
2. 运行 `./init.sh`，或记录无法运行的原因。
3. 读 `harness/session-handoff.md`、`harness/progress.md`、`harness/feature_list.json`。
4. 若有 `plans/active/`，先读 active plan，再决定继续、阻塞、归档或切换任务。
5. 编辑前检查将触碰的文件，并保留用户已有本地改动。

## 硬性规则

1. 仓库是唯一事实来源；不要依赖聊天历史保存项目事实。
2. 默认 WIP=1；最多一个功能项处于 `active`。
3. 不因“顺便”扩大范围；先完成当前任务，再开启下一个。
4. `passing` 必须有验证 evidence；自信、代码观感和部分测试不算完成。
5. 初始化、规划和业务实现分阶段推进；规划提交不应顺手改运行时代码。
6. 外部报告、Remote Runner 和 DreamingRAG 先作为接口与方案设计，不直接复制源码或敏感数据。
7. 公共接口、不变量和非显然边界要在代码附近说明。
8. 行为变化必须补充或更新测试；多组件流程必须有端到端或手动流程验证。
9. 不提交密钥、token、日志、下载缓存、数据库、向量索引、用户数据或机器特定状态。
10. `AGENTS.md` 只做路由；详细规则放 docs、harness、测试或脚本。

## 验证阶梯

先用最轻命令证明本次改动，再按风险扩大范围。

1. Harness sanity：`./scripts/harness-check.sh`
2. 后端语法验证：`python3 -m compileall src`
3. 前端单元验证：`cd frontend && npm test -- --run`
4. 前端构建验证：`cd frontend && npm run build`
5. 端到端或手动流程：启动 `python src/app.py` 与 `cd frontend && npm run dev`，验证登录、上传文档、生成 Profile、创建会话和流式对话。

## 完成定义

工作完成必须同时满足：

- active plan 的目标已实现，非目标未被触碰。
- 验证阶梯中约定的命令已运行，并记录 evidence。
- `harness/feature_list.json` 状态与 evidence 一致。
- 相关 docs、注释、测试或 harness 文件已更新。
- `harness/session-handoff.md` 写明当前状态、风险和下一步。
- 清洁状态检查已说明：构建、测试、进度、临时工件、启动路径。

## 专题文档规则

如果新规则超过几行、只适用于某模块、或需要例子，不要写进本文件。把它放到 `docs/`、模块旁文档、测试或脚本，并在这里保留一行路由。
