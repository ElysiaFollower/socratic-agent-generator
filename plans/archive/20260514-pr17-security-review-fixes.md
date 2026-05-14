<!--
职责：记录 PR review 安全修复的范围、验收和验证。
边界：不在这里扩展新产品能力或记录长期架构事实。
-->

# PR17 Security Review Fixes

## 目标

修复 PR #17 reviewer 标出的 critical/high 安全问题：远程机器密码不能在缺少加密 key 时明文入库；Remote Runner 命令策略在空配置或误配置时不能默认 allow-all。

## 非目标

- 不重做 Remote Runner 工具产品形态。
- 不改 Tutor 的教学策略或前端布局。
- 不迁移、提交或读取运行时 SQLite、Remote Runner state、日志或真实凭据。
- 不在本任务中重构既有 LLM API key 存储模块。

## 允许改动

- `src/utils/remote_machine_manager.py` 的远程机器 secret 加密/解密失败策略。
- `src/utils/remote_runner_provider.py` 的命令 allowlist fail-closed 策略。
- 对应单元测试、部署文档、架构文档、harness 状态。

## 验收标准

- password auth 远程机器在 `REMOTE_MACHINE_SECRET_KEY` 缺失或无效时拒绝保存密码。
- password auth 远程机器在 key 有效时只存储 Fernet ciphertext，不存明文。
- Remote Runner `session_exec` / background exec 在 exact/prefix allowlist 都为空时拒绝执行命令。
- 配置了 exact command 或 prefix 时，已有允许命令行为不回归。
- 文档明确如何生成 Fernet key，以及空命令策略是 deny-all。

## 验证命令

```sh
./scripts/harness-check.sh
PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_remote_machine_manager.py tests/test_remote_runner_provider.py -q
python3 -m compileall src tests
git diff --check
```

## 完成定义

- 上述验收标准均通过测试或文档覆盖。
- active plan 归档，harness 记录 evidence。
- PR #17 评论可被回复为已处理。
