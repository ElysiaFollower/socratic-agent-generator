<!--
职责：定义会话 Shell/Evidence 面板任务边界和验证。
边界：不实现任意 Web terminal，不暴露凭据，不改 Tutor 工具策略。
-->

# Shell Evidence Panel

## 目标

在会话界面增加右侧可展开的 Shell/Evidence 只读面板，让学生能看到当前会话中 Remote Runner 命令审计记录，包括命令、状态、stdout/stderr 摘要、exit code 和时间，从而验证 Tutor 结论来自真实执行结果。

## 非目标

- 不提供任意交互式 terminal。
- 不允许学生通过面板绕过 Tutor 和 session-bound Remote Runner 权限模型。
- 不改变 Remote Runner 工具调用 prompt 或 command policy。
- 不提交运行时 DB、远程日志、凭据或完整敏感输出。

## 允许改动

- 后端 remote audit schema 增补非敏感时间字段。
- 前端 session API/type 增补 audit 字段。
- 新增只读 Shell/Evidence 面板组件，并接入 ChatPage。
- 更新 i18n、测试、docs/harness。

## 验收标准

- 绑定远程机器的会话可以展开右侧 Evidence 面板。
- 面板按命令 tab/列表展示当前 session 的 remote audit。
- 选中 audit 后展示 action、command、cwd、exit code、stdout/stderr/error 摘要和 create time。
- 面板支持刷新；没有 audit 时显示空状态。
- 不显示密码、token、host 私密细节或本地路径之外的原始未脱敏输出。

## 验证命令

```sh
./scripts/harness-check.sh
PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_remote_machine_manager.py -q
python3 -m compileall src tests
cd frontend && npm test -- --run
cd frontend && npm run build
git diff --check
```

## 完成定义

- 功能实现并验证通过。
- `harness/feature_list.json` evidence 记录验证结果。
- active plan 归档。
