# 会话交接

## 仓库状态

- 分支：`vnext-persistent-remote-shell`
- 当前功能项：无 active。
- Active plan：无；计划已归档到 `plans/archive/20260514-persistent-remote-shell.md`。
- 目标分支：`dev`。
- 当前 PR：#23 open，`https://github.com/ElysiaFollower/socratic-agent-generator/pull/23`；本分支待推送/开 stacked PR。

## 当前已验证状态

- PR #17、#19、#20 已合并到 `dev`；当前分支基于最新 `dev`。
- 已完成 vNext 单实验 E2E benchmark：`scripts/benchmarks/single_lab_e2e.py` 与 `docs/benchmarks/single-lab-e2e.md`。
- 已完成会话右侧 Shell/Evidence 面板：会话顶栏终端按钮打开只读面板，展示 `/api/sessions/{session_id}/remote-audits` 中的脱敏命令证据。
- 已完成 Profile Management 文档身份 UX：lab manual 列表返回稳定 `document_id`、`display_name`、filename、owner、相对 source/index path、size、preview excerpt 和引用 profile 列表。
- Lab Manual Management 支持 display name 编辑；该操作只改 `Document.meta_info.display_name`，不改变 `doc_name`、存储路径、索引路径或已有 profile 的 `document_id` 引用。
- Lab Manual Management 的查看/删除优先使用 `document_id` API，旧 `lab_name` API 保留兼容；删除仍提示引用 profile 并将引用标记失效，而不是阻止删除或级联删除 profile。
- Generate Profile 文档选择列表增加只读身份卡、引用数、source path、文件大小和短 preview；完整查看、删除、重命名仍保留在 Lab Manuals 管理入口。
- lab manual readiness 同时检查同目录 artifact 与引用 profile 的 persona/curriculum 数据，修复内置校准 profile 显示“有 curriculum、无 persona”的误导。
- 已完成 Profile 生成质量评估第一版：`scripts/benchmarks/profile_generation_eval.py` 对 generated vs calibrated profile 做离线评分，维度包括结构、persona、curriculum alignment 和 mismatch taxonomy risk coverage。
- 评估文档：`docs/benchmarks/profile-generation-evaluation.md`；当前基线为 score 0.7343/status warn/labs 6。
- linux-01 已同步本地 `dev` commit `a0642d6`，包含 Remote Runner session tools、Shell/Evidence 面板、单实验 E2E benchmark、Profile Management 文档身份 UX、Profile 生成质量评估第一版，以及 Tutor remote-tool pedagogical turn 修复。
- linux-01 服务运行在 tmux `socratic-backend`、`socratic-frontend`；后端 `http://10.203.15.128:8000/api/health` 返回 OK，前端 `http://10.203.15.128:5173` 返回 HTTP 200。
- 本次部署保留旧 `.env`、`data/`、`frontend/node_modules` 和 `frontend/dist`，备份目录为 `/home/ely/deploy/socratic-live/socratic-agent-generator.prev-20260514050023`。
- live `single_lab_e2e.py` benchmark 已改为 `.env` 驱动：默认加载 `.env`，默认测试用户为 `admin`，默认要求 `SOCRATIC_BENCHMARK_REMOTE_MACHINE`；当前推荐机器名为 `SEED Lab on linux-01`。
- 2026-05-14 已按用户要求在 linux-01 真实部署环境运行 live benchmark。基础链路通过：admin 登录、profile 发现、session 创建、Settings 机器配置、remote machine 连接、Tutor remote tool 调用和 backend memory/provider 调用均可用。
- 同一次 live benchmark 未通过完整教学验收：session `df650fd7-3bba-43fa-b3c7-ffbbcba7c75b` 在 7 个 scripted turns 后仍停在 `stepIndex=0,totalSteps=9,isFinished=false`，`step_completion_count=0`，但 `remote_audit_count=37`。结果文件保留在 linux-01：`/home/ely/deploy/socratic-live/logs/single-lab-e2e-live-result.json`。
- 新增产品北极星文档 `docs/product/vision.md`，定义本项目不是自动代做系统，而是用 AI 吸收外围实验摩擦、保留学生核心思考的 learning-by-doing 系统。`docs/overview.md` 已加入该入口。
- 修复并部署 `a0642d6` 后，linux-01 live benchmark 重新通过：session `d37e5ce4-bcb7-4a0b-8d56-0efd7b04a1c6`，`final_progress={isFinished:true, stepIndex:9, totalSteps:9}`，`step_completion_count=9`，`remote_audit_count=30`。但用户随后指出需要先沉淀产品愿景文档，后续实现应按 `docs/product/vision.md` 重新校准学习质量，而不是只看通关。
- `docs/product/vision.md` 已进一步增加 `产品原则` 小节，用更具体的语言写清：反对传统实验高摩擦和纯 AI 代做两种低质量形态；目标是重新分配学生、AI、系统职责；Tutor 不能陷入工具循环；系统真正解决的是实验学习摩擦成本。
- 已按北极星校准关键设计文档和计划：`docs/architecture/vnext-integrations.md`、`docs/architecture/remote-runner-session-tools.md`、`docs/benchmarks/single-lab-e2e.md`、`docs/benchmarks/profile-generation-evaluation.md`、harness rubric/quality/decisions，以及 Remote Runner / benchmark 相关归档 plan。
- 已提交上一轮遗留的 Tutor remote-tool streaming 收束修复：`97783d5 fix(tutor): defer remote tool stream until final turn`。
- 已完成 Shell/Evidence 面板 terminal-tab 修正：`RemoteCommandAuditModel` 记录 `runner_session_id`，audit API 返回 `binding_id`、`runner_session_id`、`terminal_id`；前端 tab 现在代表 Remote Runner terminal/session，选中 tab 后展示连续 transcript，而不是一条命令一个 tab。
- 旧 SQLite 通过 `init_db()` 做窄兼容加列：缺少 `remote_command_audits.runner_session_id` 时自动 `ALTER TABLE`，不迁移运行时数据进 git。
- PR #23 阶段曾因 Remote Runner 尚非持久 shell 提交 issue `https://github.com/ElysiaFollower/SEEDRunner/issues/5`；当前 SEEDRunner main 已提供持久 session shell，Socratic 已完成第一版受控对接。
- 已整理 `docs/overview.md`、`harness/quality.md`、`harness/progress.md` 和本 handoff，明确当前已实现价值、剩余缺口和下一阶段持久化 shell 对接入口。
- 已完成 Persistent Remote Shell 对接：基于 SEEDRunner `9324432 feat(remote-runner): unify sessions with persistent shell backend`，Socratic 后端可读取 `session read` transcript，前端 Shell/Evidence 面板优先显示真实 persistent transcript，学生面板命令输入走受控 `session exec` 而不是 raw `session send`。

## 验证记录

- `./init.sh` 通过。
- `PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_default_profile_seed.py -q` 通过 6 passed。
- `python3 -m compileall src tests` 通过。
- `cd frontend && npm test -- --run` 通过。
- `cd frontend && npm run build` 通过。
- `git diff --check` 通过。
- `./scripts/harness-check.sh` 通过 0 warning。
- 2026-05-14 profile generation eval：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_profile_generation_eval.py -q` 通过 3 passed；`python3 -m compileall scripts tests` 通过；`python3 scripts/benchmarks/profile_generation_eval.py --json` 返回 score 0.7343/status warn/lab_count 6。
- 2026-05-14 linux-01 deploy：Remote Runner `linux-01` doctor reachable/auth/default_cwd 全 true；远端 `python3 scripts/benchmarks/profile_generation_eval.py` 返回 score 0.7343/status warn/labs 6；重启后本地与远端 curl 均验证后端 OK、前端 200。
- 2026-05-14 benchmark env update：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_single_lab_e2e_benchmark.py -q` 通过 7 passed；`python3 -m compileall scripts/benchmarks/single_lab_e2e.py tests/test_single_lab_e2e_benchmark.py` 通过；`./scripts/harness-check.sh` 通过 0 warning；`git diff --check` 通过。
- 2026-05-14 live single-lab benchmark：部署机命令 `/root/miniconda3/envs/SocraticAgent/bin/python scripts/benchmarks/single_lab_e2e.py --dotenv /home/ely/deploy/socratic-live/.benchmark.env` 已真实运行，退出码 1；失败阶段为 `final_validation`，错误为 `Session did not finish within the scripted turns.`。
- 2026-05-14 Tutor remote-tool pedagogical fix：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_tutor_executor.py tests/test_single_lab_e2e_benchmark.py -q` 通过 10 passed；`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_remote_runner_provider.py tests/test_session_progress.py tests/test_default_profile_seed.py -q` 通过 24 passed；`python3 -m compileall src scripts/benchmarks/single_lab_e2e.py tests/test_tutor_executor.py` 通过；linux-01 live benchmark 退出码 0。
- 2026-05-14 product vision docs：`./scripts/harness-check.sh` 通过 0 warning；`git diff --check` 通过。
- 2026-05-14 north-star doc alignment：`./scripts/harness-check.sh` 通过 0 warning；`git diff --check` 通过。
- 2026-05-14 Tutor streaming 收束提交前验证：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_tutor_executor.py tests/test_single_lab_e2e_benchmark.py -q` 通过 10 passed；`python3 -m compileall src/utils/tutor_core.py tests/test_tutor_executor.py` 通过；`git diff --check` 通过。
- 2026-05-14 session shell terminal tabs：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_remote_machine_manager.py -q` 通过 5 passed；`python3 -m compileall src tests` 通过；`cd frontend && npm test -- --run` 通过；`cd frontend && npm run build` 通过；`./scripts/harness-check.sh` 0 warning；`git diff --check` 通过。
- 2026-05-14 persistent remote shell：`PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_remote_runner_provider.py tests/test_remote_machine_manager.py -q` 通过 25 passed；`python3 -m compileall src tests` 通过；`cd frontend && npm test -- --run` 通过；`cd frontend && npm run build` 通过；`./scripts/harness-check.sh` 0 warning；`git diff --check` 通过；SEEDRunner 上游 focused test `tests/test_remote_runner_mvp.py::test_session_preserves_shell_state_and_incremental_transcript` 通过 1 passed。

## 仍损坏或未验证

- PR #23 尚未合并到 `dev`；本分支基于 PR #23 之后的状态，适合创建 stacked PR 到 `vnext-session-shell-terminal-tabs` 或在 #23 合并后 rebase 到 `dev`。
- linux-01 未部署本次 terminal-tab UI 和 persistent shell 适配；本任务目前只完成本地代码、文档和测试。
- live benchmark 在 `a0642d6` 后已能通关，但这不等价于学习质量完全达标。后续 benchmark 和 Tutor 行为仍要按 `docs/product/vision.md` 校准，尤其关注是否真正 learning by doing、是否保留学生核心思考。
- benchmark 密码只应通过 `.env` 或临时文件注入，不写入仓库；本次临时 `.benchmark.env`、本地临时凭据文件和 Remote Runner session 均已清理。
- linux-01 未部署本次 persistent shell Socratic 适配；真实部署 smoke 待 PR 合并后执行。

## 设计结论

- 文档身份以 `Document.id` 为稳定操作键；`doc_name` 保持向后兼容和生成链路输入，display name 仅用于人类可读识别。
- 对外展示路径使用 repo-relative 或文件名，不暴露本机绝对路径。
- Generate Profile 不复制完整 Lab Manuals 管理能力，只提供足够核验选中文档身份的只读 preview。
- 删除文档时提示引用方并使引用失效；不应因为存在引用而彻底不能删。
- Profile generator 改造前应先跑静态评估；该评估不能替代单实验 E2E benchmark 和真实 Tutor 会话。
- Shell/Evidence 面板的 tab 代表 terminal/session，不代表命令；命令是选中 terminal transcript 中的连续片段。
- Socratic audit 需要在记录时保存当时的 `runner_session_id`，不能只依赖当前 binding 反查，否则切换机器后旧 evidence 会被错分。
- 学生面板命令默认走 `session exec`，不是 raw `session send`；这样既利用 Remote Runner 持久 shell，又保留 command allowlist、exit code、stdout/stderr、timeout、redaction 和 audit。

## 清洁状态

- 不提交 runtime SQLite、session cache、Remote Runner state/logs、tmux 日志、LLM key、SSH key、password 或 token。
- 当前待提交范围：persistent shell 适配相关后端 provider/manager/API/schema、前端 Shell/Evidence 面板/API/types/i18n、docs、tests、harness 状态和归档 plan。
- 当前不应包含：runtime DB/cache/logs、远程机器状态、真实凭据、linux-01 部署数据。

## 下一步最佳动作

1. 提交并推送 `vnext-persistent-remote-shell`。
2. 创建 stacked PR；若 PR #23 先合并，则 rebase/retarget 到 `dev`。
3. 合并后部署 linux-01，并做真实 persistent shell smoke：在同一会话中执行 `cd`、`export`、`pwd && printf "$VAR"`，再通过 Shell/Evidence 面板/API 验证 transcript。

## 命令

- `./init.sh`
- `./scripts/harness-check.sh`
- `PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_default_profile_seed.py -q`
- `python3 -m compileall src tests`
- `cd frontend && npm test -- --run`
- `cd frontend && npm run build`
- `git diff --check`
- `python3 scripts/benchmarks/profile_generation_eval.py`
