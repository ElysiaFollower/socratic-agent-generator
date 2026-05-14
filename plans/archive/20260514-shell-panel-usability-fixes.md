# Shell 面板可用性修正

## 目标

修复当前 Shell 面板两个用户可见问题：

- 拖拽 Shell 面板时不能让页面总宽度持续超过 viewport；桌面端最大宽度应约为对话区域容器宽度的 70%，且不会产生页面级横向滚动。
- Shell transcript 内容应更接近真实 terminal：优先显示 `路径 user $ 命令` 与输出结果，减少 `# action`、`# cwd`、timestamp、status 等让阅读变重的元信息。

## 非目标

- 不改变 Remote Runner API、命令策略、审计落库或权限模型。
- 不实现完整 raw PTY 输入。
- 不改登录、数据库、DreamingRAG 或 benchmark 逻辑。
- 不引入重量级 terminal emulator 依赖。

## 当前事实

- 相关组件：`frontend/src/components/session/SessionEvidencePanel.tsx`。
- Shell 面板由 `ChatPage.tsx` 中的 flex 容器承载。
- 当前 width 由 `window.innerWidth` 和固定 `viewport - 320` 计算，未绑定实际对话区域容器，导致拖拽后可能把页面撑出 viewport。
- audit fallback transcript 当前包含 action、cwd、status、timestamp 等元信息，阅读体验偏审计记录而非 shell。

## 允许改动

- 调整 Shell 面板 resize 计算和根容器 overflow/flex 约束。
- 调整 audit fallback transcript 的格式化。
- 增加必要 helper 函数和 focused frontend tests。
- 更新 i18n、docs 或 harness evidence。

## 禁止改动

- 不提交运行时数据、数据库、日志、凭据或远程机器状态。
- 不删除 RemoteCommandAudit 的结构化字段；只是改变前端显示方式。
- 不隐藏错误输出本身；只减少审计元信息噪声。

## 验收标准

- 桌面端拖动 Shell 左边界时，Shell 最大宽度约为对话区域可用宽度 70%，页面不出现 body 级横向滚动。
- Shell 仍可比当前稍微更宽，给长输出足够空间。
- audit fallback 里的命令提示符形如 `cwd $ command`，有 owner/user 信息时可显示 `user:cwd $ command`。
- 默认 transcript 不再显示 `# action`、`# cwd`、`# exit 0 · timestamp` 这类元信息；stderr/error 仍清晰显示。
- 前端测试和构建通过。

## 验证命令

```sh
./scripts/harness-check.sh
cd frontend && npm test -- --run
cd frontend && npm run build
git diff --check
```

## 完成定义

- 代码实现并通过验证。
- `harness/feature_list.json`、`harness/progress.md`、`harness/session-handoff.md` 记录 evidence。
- active plan 归档。
- 若需要部署，则同步 linux-01 并记录结果。

## 归档结果

- 已实现：Shell resize 上限按实际父容器宽度计算，最大约为容器 70%，并保留最小聊天区域宽度。
- 已实现：承载聊天和 Shell 的 flex 容器增加宽度约束，防止页面级横向滚动。
- 已实现：audit fallback transcript 改为 `cwd $ command` 加输出，不再默认显示 action/cwd/status/timestamp 审计元信息。
- 已验证：`./scripts/harness-check.sh`、`cd frontend && npm test -- --run`、`cd frontend && npm run build`、`git diff --check` 均通过。
