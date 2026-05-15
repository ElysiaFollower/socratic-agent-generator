# Shell 面板 UX 修正

## 目标

把会话右侧 Shell 面板从“证据文本框”修正为更接近真实 terminal 的学习辅助界面：标题只称为 Shell；面板宽度可由用户拖动；transcript 以终端风格渲染；对话中泄露的 raw JSON evidence 不再以未渲染文本污染聊天；shell session 关闭或不可读时有明确状态，而不是只显示 records 数量。

## 非目标

- 不改变 Remote Runner 的权限模型、命令 allowlist、审计和脱敏策略。
- 不实现完整浏览器 PTY 或任意 raw `session send` 交互；学生命令输入仍默认走受控 `session exec`。
- 不重写聊天消息系统或 Tutor 教学策略；本任务只处理 remote tool/evidence 的用户可见呈现。
- 不把运行时 session、日志、凭据、数据库或 benchmark 输出提交到仓库。

## 当前仓库事实

- 入口规则：`AGENTS.md`
- 初始化契约：`harness/bootstrap-contract.md`
- 当前功能项：`vnext-shell-panel-ux`
- 相关文件/模块：
  - `frontend/src/components/session/SessionEvidencePanel.tsx`
  - `frontend/src/pages/ChatPage.tsx`
  - `frontend/src/i18n/locales/en.json`
  - `frontend/src/i18n/locales/zh.json`
  - `frontend/src/types/index.ts`
  - `frontend/src/api/sessions.ts`
  - `src/utils/tutor_core.py`
  - `src/utils/remote_tool_skill.py`
  - `src/api/routes/session.py`
  - `docs/architecture/remote-runner-session-tools.md`
- 已知约束：
  - Shell tab 代表 Remote Runner session/terminal，不代表单条命令。
  - 前端 Shell 面板已能读取 `GET /api/sessions/{session_id}/remote-shell`，命令输入走 `POST /api/sessions/{session_id}/remote-shell/command`。
  - 当前 `xx records` 对学生价值低，应替换为 session 状态、connected/closed/error/running 等更有意义的状态。
  - 聊天中出现的 `Relevant evidence: {...}` raw JSON 是用户可见缺陷；如果必须展示，应渲染为结构化块，优先避免出现在普通聊天正文中。

## 允许改动

- 调整 Shell 面板文案、布局、宽度状态和拖拽逻辑。
- 引入小而维护良好的前端 terminal 渲染组件或使用现有依赖/CSS 实现 terminal 风格；新增依赖必须记录理由并通过 build。
- 增加前端工具函数和测试，用于 transcript/JSON evidence/status 的格式化与渲染。
- 调整 Tutor remote evidence 输出策略，避免 raw JSON 直接进入聊天正文；必要时返回前端可识别的结构化 evidence block。
- 更新相关架构文档、i18n 和 harness 状态。

## 禁止改动

- 不放宽远程命令策略，不暴露 password/key/token/local log path。
- 不在聊天正文中显示未脱敏完整工具 payload。
- 不把 Shell 面板做成新的独立远程执行权限入口。
- 不修改默认 profile、DreamingRAG、benchmark 语义或部署凭据。

## 验收标准

- 会话顶栏和面板文案只称为 `Shell`，不再强调 `Shell evidence`。
- Shell 面板左边界可拖动调整宽度，宽度有合理 min/max，桌面端不挤坏聊天区，移动端仍全宽或合理降级。
- Transcript 区域具备真实 terminal 风格：等宽字体、深色/高对比背景、命令/输出层次、滚动行为稳定，长行和长输出不破坏布局。
- 聊天回复中不再出现 `Relevant evidence: { ... }` 这类未渲染 raw JSON；若 evidence 需要展示，前端以结构化、可读、可折叠或代码块样式呈现。
- Shell tab 或 header 显示 session 状态，例如 connected/running/closed/error；`xx records` 不作为主要状态信息。
- 关闭、无绑定、无法读取 transcript、命令被 policy 拒绝时，Shell 面板有明确状态和错误呈现。

## 验证命令

```sh
./scripts/harness-check.sh
PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_tutor_executor.py tests/test_remote_runner_provider.py tests/test_remote_machine_manager.py -q
python3 -m compileall src tests
cd frontend && npm test -- --run
cd frontend && npm run build
git diff --check
```

手动/端到端验证：

```sh
# 启动后端和前端，打开一个绑定远程机器且已有 remote audit 的会话：
python src/app.py
cd frontend && npm run dev

# 验证：
# 1. 顶栏按钮和右侧面板标题显示 Shell。
# 2. 桌面端拖动 Shell 面板左边界可改变宽度。
# 3. transcript 以 terminal 风格显示，长输出不撑破布局。
# 4. 触发一次 policy denied 命令，聊天正文不出现 raw JSON，Shell 面板状态/错误可读。
# 5. 读取已关闭或不可用 runner session 时，面板显示明确 closed/error 状态。
```

## Evidence 记录要求

验证通过后，将命令、结果、关键输出摘要或截图/手动验证说明写入 `harness/feature_list.json` 的 `evidence`。

## 完成定义

- 请求行为已实现。
- 非目标没有被触碰。
- 上方验证命令已运行；未运行的命令必须说明原因。
- `harness/feature_list.json` 状态和 evidence 已更新。
- 职责、接口、setup 或边界改变时，docs、注释、测试或 harness 文件已更新。
- `harness/session-handoff.md` 写明当前状态、风险和下一步。
- 清洁状态检查已说明。

## 阻塞条件

- 如果需要新增重量级 terminal 依赖但包体积、兼容性或许可证风险不清楚，应先停下来说明取舍。
- 如果 raw JSON 来自模型输出而非系统注入，且无法稳定区分教学文本与工具 payload，应先把复现路径和最小修复方案说明清楚。
- 如果 Remote Runner API 无法提供 closed/error 状态，应先用现有 binding/audit/read error 做前端状态，并记录后续 API 缺口。

## 下一步最佳动作

已完成并归档。

- `Relevant evidence` raw JSON 来源定位为 Tutor remote-tool fallback 直接拼接 tool observation；已改为 `_summarize_remote_observations()` 生成可读 Shell 结果摘要。
- 未引入重量级 terminal emulator 依赖；使用现有 MUI + monospace terminal surface 实现当前只读 transcript 风格，避免为尚未开放 raw PTY 输入的阶段增加维护成本。
- Shell 面板已完成文案、拖拽宽度、terminal 渲染和状态显示。
- 验证已记录在 `harness/feature_list.json`、`harness/progress.md` 和 `harness/session-handoff.md`。
