<!--
职责：为“部署即自带默认校准 Profile”定义实现边界。
边界：不在此文件保存原始实验报告、密钥、数据库或运行日志。
-->

# 默认校准 Profile 自动导入

## 目标

让 `docs/manual-enhance/calibrated/*/profile.json` 中的 6 个校准 SEED profile 在系统部署并初始化 SQLite 数据库时自动、幂等导入，成为系统默认可用 profile。

## 非目标

- 不复制 SEEDRunner 原始报告、`.tex`、PDF、图片、日志或密钥。
- 不改 generator 生成逻辑或 DreamingRAG adapter。
- 不实现 profile 管理 UI。

## 当前仓库事实

- 入口规则：`AGENTS.md`
- 初始化契约：`harness/bootstrap-contract.md`
- 当前功能项：`default-seed-profiles`
- 相关文件/模块：`src/core/database.py`、`src/utils/profile_manager.py`、`docs/manual-enhance/calibrated/`、`tests/test_manual_enhance_profiles.py`
- 已知约束：系统实际从 SQLite `profiles` 表列出 profile；当前数据库初始化只建表，不 seed 默认 profile。

## 允许改动

- 新增默认 profile seed helper。
- 更新数据库初始化和 profile 可见性逻辑。
- 更新 manual-enhance 文档、测试、harness 文件。

## 禁止改动

- 不提交运行时 SQLite 数据库或用户数据。
- 不改变已有手动生成 profile 的 JSON schema。

## 验收标准

- 新部署初始化数据库后会从 `docs/manual-enhance/calibrated/` 导入 6 个默认 profile。
- 重复启动/重复 seed 不会产生重复记录，并会按 JSON 更新已有内置 profile。
- 默认内置 profile 对 admin/teacher 可见，也对没有 class 的 student 可见。
- focused tests 和 harness check 通过。

## 验证命令

```sh
./scripts/harness-check.sh
PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_manual_enhance_profiles.py tests/test_default_profile_seed.py -q
python3 -m compileall src scripts tests
```

## Evidence 记录要求

验证通过后，将命令、结果、关键输出摘要写入 `harness/feature_list.json` 的 `evidence`。

## 完成定义

- 请求行为已实现。
- 非目标没有被触碰。
- 上方验证命令已运行。
- `harness/feature_list.json` 状态和 evidence 已更新。
- `harness/session-handoff.md` 写明当前状态、风险和下一步。
- 清洁状态检查已说明。

## 阻塞条件

- 若默认 profile JSON 无法通过 schema 校验，必须停下来修 JSON 或生成脚本，不允许跳过失败文件伪装成功。

## 下一步最佳动作

1. 实现 seed helper，并在 `init_db()` 后调用。
2. 更新 student profile 可见性，让内置 public profiles 可见。
3. 补测试并归档任务。
