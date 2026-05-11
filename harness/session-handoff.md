# 会话交接

## 仓库状态

- 分支：`dev`
- 提交：本文件随 harness 初始化提交一起提交；上一提交记录 vNext roadmap。
- 脏文件：提交后应为 clean；本次提交前预期包含 harness 文档、`init.sh`、`scripts/harness-check.sh`、plans 占位文件和一个前端 smoke test 维护改动。
- 当前计划：无 active plan。
- 当前功能项：无；`harness-cold-start` 已标记为 `passing`。

## 当前已验证状态

- 上次运行命令：`./scripts/harness-check.sh`、`./init.sh`、`python3 -m compileall src`、`cd frontend && npm test -- --run`、`cd frontend && npm run build`。
- 结果：全部通过。
- 证据：`harness/feature_list.json` 的 `harness-cold-start` evidence 已记录；前端测试 1/1 通过，前端构建通过。

## 本会话改动

- 从 `main` 创建本地 `dev` 分支。
- 记录 vNext 集成方向：SEED 报告语料、Remote Runner/SEEDRunner、DreamingRAG。
- 初始化 repo-native harness：`AGENTS.md`、`init.sh`、`docs/overview.md`、`harness/`、`plans/` 和 `scripts/harness-check.sh`。
- 将现有前端 App smoke test 的登录标题断言调整为默认 English i18n 文案。

## 仍损坏或未验证

- 新 checkout 的前端依赖需要先运行 `cd frontend && npm ci`。
- 完整端到端流程仍需要有效 `.env`、LLM provider 和必要模型缓存。
- 后端没有独立 pytest 套件，当前只能做语法级验证。
- `npm ci` 报告 20 个既有依赖漏洞；Vite build 报告部分 chunk 超过 500 kB 和 Browserslist 数据过旧。

## 清洁状态

- 构建/静态检查：`python3 -m compileall src` 和 `cd frontend && npm run build` 通过。
- 测试/端到端：`cd frontend && npm test -- --run` 通过；完整浏览器端到端未运行。
- 进度文件同步：`harness/progress.md`、`harness/feature_list.json`、`harness/quality.md` 已同步。
- 临时工件：`node_modules` 和 `dist` 为忽略文件，不应提交；不得提交 `data/*.db`、模型缓存或日志。
- 启动路径：README、`init.sh` 和 `harness/bootstrap-contract.md` 已记录。

## 下一步最佳动作

1. 审核 vNext 三个方向，并为 SEED 报告语料、Remote Runner 集成、DreamingRAG 记忆集成分别创建独立 plan 和实现分支。

## 命令

- 初始化：`./init.sh`
- Harness 检查：`./scripts/harness-check.sh`
- 后端语法验证：`python3 -m compileall src`
- 前端单元验证：`cd frontend && npm test -- --run`
- 前端构建验证：`cd frontend && npm run build`
- 调试说明：后端看 FastAPI 日志和 `/docs`；前端看浏览器控制台、Network 面板和 Vite 输出。
