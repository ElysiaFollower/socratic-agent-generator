<!--
职责：为实现 agent 定义一个 active task 合同，让范围、验收、验证和交接可执行。
边界：不要在这里累积长期架构事实、原始日志或无关 follow-up 想法。
-->

# Remote Runner Session Tools

## 目标

让学生在 Socratic 中配置自己的实验机，并在创建学习会话时绑定其中一台机器；该会话中的 Tutor 拥有内置 Remote Runner skill，且只能访问这台绑定机器，从而能在对话中执行实验诊断命令、收集实验结果、辅助排错，并支撑完整实验报告材料的形成。

本任务的单一用户可见行为是：`demo` 学生用户选择一个 SEED 实验 profile 和一台已配置实验机创建会话后，可以要求 Tutor 在该机器中执行命令、解释输出、排查实验问题，并最终完整完成一个实验会话。

## 非目标

- 不把 Remote Runner 源码复制进本仓库；Socratic 只依赖其 CLI/API 边界。
- 不实现通用远程桌面、完整 Web terminal、任意文件同步或 shell 录屏能力。
- 不把密码、私钥、JWT、LLM key、Remote Runner 日志、SQLite 数据库、向量索引或远程机器状态提交进仓库。
- 不为历史旧会话做复杂兼容迁移；若本任务改变会话 remote binding 结构，允许旧会话没有绑定机器且不启用远程工具。
- 不放开任意命令执行；命令能力必须受会话绑定机器、用户所有权、超时、脱敏、审计和 command policy 限制。
- 不把 `seed-lab` 写成产品默认机器；它只作为本地/演示环境中可用的验收测试机器。

## 当前仓库事实

- 入口规则：`AGENTS.md`
- 初始化契约：`harness/bootstrap-contract.md`
- 当前功能项：`remote-runner-session-tools`
- 相关文件/模块：
  - 后端设置入口：`src/api/routes/settings.py`、`src/utils/llm_manager.py`、`src/models/llm_provider_setting.py`
  - 会话创建和持久化：`src/api/routes/session.py`、`src/utils/session_manager.py`、`src/models/session.py`、`src/schemas/message.py`、`src/schemas/session.py`
  - Tutor 工具注入：`src/utils/tutor_core.py`、`src/utils/remote_tool_skill.py`、`src/utils/remote_runner_provider.py`
  - 前端设置与会话创建入口：`frontend/src/components/settings/SettingsModal.tsx`、`frontend/src/pages/ChatPage.tsx`、`frontend/src/api/settings.ts`、`frontend/src/api/session.ts`
  - 部署与 vNext 事实：`docs/deployment.md`、`docs/architecture/vnext-integrations.md`
  - 本任务设计文档：`docs/architecture/remote-runner-session-tools.md`
- 已知约束：
  - 当前 Remote Runner 原型是全局 env 开关和全局 allowlist；尚未支持 per-user 机器配置和 per-session 机器绑定。
  - 当前 `observe_remote_environment` 只支持 `list_machines`、`list_sessions`、`machine_doctor`、`session_exec`，且 `session_exec` 只允许精确匹配的安全命令。
  - 现有 LLM 设置已有 per-user 加密/降级存储模式，可作为 remote credential storage 的参考，但不能把明文 credential 返回给前端或 LLM。
  - 默认部署文档已要求 conda；本任务继续沿用 conda 和官方部署文档。
  - 本地 Remote Runner 已有名为 `seed-lab` 的真实实验机，可用于最终验收，但仓库内只能记录机器名和验收方式，不能记录凭据。

## 允许改动

- 新增用户实验机配置模型、schema、manager、API、测试和必要的数据库表。
- 扩展 Settings UI，允许用户维护实验机：machine name、user name、ip/host、port、认证方式、password 或 SSH key 引用/内容。
- 扩展创建会话请求、会话模型和前端创建入口，允许选择一台用户拥有的实验机并生成 session-bound remote binding。
- 扩展 Remote Runner provider，让 Tutor 从当前 session binding 构造 provider，并只允许访问绑定机器和绑定 Remote Runner session。
- 扩展 Tutor remote skill，使其能执行实验诊断命令、返回脱敏输出、把关键命令与结果写入会话历史或可审计记录。
- 新增会话专用文件缓存和 LabSetup 上传路径，让用户可把 `docker-compose.yml`、脚本或实验附件上传到会话，再由系统转存到绑定实验机。
- 新增后端调试 API，覆盖前端与 Tutor 会使用的同一条 remote binding、文件上传、命令执行和审计链路，便于维护者不用手点前端也能复现实验流程。
- 更新官方部署文档、架构文档、`.env.example`、tests 和 live demo example，反映真实 Remote Runner 会话工具能力。
- 必要时调整 linux-01 演示部署数据；仍不得提交数据库、密钥、日志或机器状态。

## 禁止改动

- 不破坏 DreamingRAG public API adapter、默认 Volcengine embedding、6 个内置 SEED profile 和 lab manual seed。
- 不让没有绑定机器的会话自动获得全局 Remote Runner 权限。
- 不允许学生访问其他用户机器、其他会话的 Remote Runner session，或绕过 machine binding 直接传任意 machine id。
- 不在 API 响应、前端状态、Tutor prompt、日志、example artifact 或测试 fixture 中暴露 password、private key、token、host 私密细节。
- 不把本地绝对路径写进运行时代码、默认配置或可迁移部署文档。
- 不在计划阶段实现运行时代码；本文件只定义下一阶段实现合同。

## 验收标准

- 用户设置中可以新增、查看、测试、删除自己的实验机配置；API 返回中不含 password/private key 明文。
- 创建会话时可以选择用户自己的实验机；未选择机器的会话不注入 Remote Runner skill。
- 已绑定机器的会话中，Tutor 的 Remote Runner skill 只能访问该绑定机器；传入其他 machine id、session id 或未允许命令会被拒绝并留下可诊断错误。
- Tutor 可以通过 Remote Runner 在绑定机器中执行实验所需的诊断/辅助命令，输出经过脱敏、截断和审计，并可用于后续教学回复。
- 每个会话可以维护专用文件缓存；用户上传的 LabSetup 文件只归属于该会话，可通过 API 上传到该会话绑定的远程实验机。
- 后端提供调试友好的 API：列出/上传会话文件、把会话文件转存到绑定实验机、执行会话绑定命令、查询远程命令审计；这些 API 与 Tutor 使用同一套权限和审计逻辑。
- `demo` student 用户在真实 `seed-lab` 机器上完整完成一个 SEED 实验会话；验收会话不只是通关进度完成，还必须包含 Tutor 执行命令、收集输出、解释结果或排查问题的证据。
- 推荐验收实验为 Sniffing and Spoofing Lab，LabSetup 来源记录为 `https://github.com/seed-labs/seed-labs/tree/master/category-network/Sniffing_Spoofing/Labsetup`；本地可复用的实际 `docker-compose.yml` 来自 SEEDRunner runs 下的 Sniffing_Spoofing/Labsetup，验收不应为了这个简单 LabSetup 专门远程 `git clone` 整仓库。如执行时选择其他更稳定实验，必须在 evidence 中说明原因。
- 完成会话的历史和导出的 example artifact 足以支撑一份实验报告：包含关键环境信息、命令、输出摘要、错误/排查过程、原理解释和完成状态。
- 官方部署文档说明 Remote Runner 集成的 conda 安装、配置、credential 安全、session binding、command policy 和 smoke test。

## 验证命令

```sh
./scripts/harness-check.sh
PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_remote_runner_provider.py tests/test_session_progress.py tests/test_skill_names.py -q
python3 -m compileall src tests
cd frontend && npm test -- --run
cd frontend && npm run build
remote-runner machine doctor seed-lab --json
后端 API 调试流：以 demo student 登录，配置/选择 seed-lab，创建 Sniffing/Spoofing 会话，上传 docker-compose.yml 到会话缓存，把文件转存到远程 LabSetup 目录，运行 docker compose up/ps 和若干实验命令，确认审计记录。
手动端到端：以 demo student 登录，配置/选择 seed-lab，创建一个 SEED 实验会话，让 Tutor 通过 Remote Runner 执行实验命令与排错，并完成全部课程节点；导出完成会话 example。
```

## Evidence 记录要求

验证通过后，将命令、结果、关键输出摘要、远端 session id、Socratic session id、导出的 example artifact 路径和脱敏说明写入 `harness/feature_list.json` 的 `evidence`。真实命令输出只记录必要摘要，不能记录凭据、token、私钥或完整敏感日志。

## 完成定义

- 请求行为已实现。
- 非目标没有被触碰。
- 上方验证命令已运行；未运行的命令必须说明原因。
- `harness/feature_list.json` 状态和 evidence 已更新。
- 职责、接口、setup 或边界改变时，docs、注释、测试或 harness 文件已更新。
- `harness/session-handoff.md` 写明当前状态、风险和下一步。
- 清洁状态检查已说明。

## 阻塞条件

- Remote Runner CLI 无法对 `seed-lab` 完成 `machine doctor` 或创建可执行命令的 session。
- 真实实验机缺少 SEED LabSetup、Docker/Compose、必要网络权限或 root 权限，导致无法完成推荐实验。
- 无法在不暴露明文 credential 的前提下完成用户机器配置存储和连接测试。
- Tutor 工具调用在真实 LLM 下仍然无法稳定执行多轮命令观察并生成最终回复。

## 下一步最佳动作

1. 检查 Remote Runner 当前 CLI 的 machine/session 配置与 credential 写入接口，确定 Socratic 侧 manager 调用边界。
2. 设计并实现 user remote machine、session remote binding 和 audit 数据模型。
3. 扩展 API/UI，让 `demo` 用户能配置并在创建会话时选择 `seed-lab`。
4. 增加 session file cache、文件转存和 remote-command 调试 API，确保 LabSetup 可以由系统包办。
5. 将 Tutor remote skill 改为 session-bound provider，并补 focused tests。
6. 用 `seed-lab` 完成真实 Sniffing/Spoofing 端到端会话并导出 example。
