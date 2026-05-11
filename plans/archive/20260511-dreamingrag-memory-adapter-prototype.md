<!--
职责：为 DreamingRAG 记忆 adapter 原型定义可执行任务边界、验收和验证。
边界：不要在这里记录长期架构细节、原始日志、外部 API key 或无关 follow-up。
-->

# DreamingRAG 记忆 Adapter 可用原型

## 目标

在短时间内产出一个可用原型：Socratic Tutor 在生成回复前能通过一个窄 `MemoryProvider` adapter 从 DreamingRAG 检索长期记忆片段并注入 prompt，生成回复后能容错写入本轮用户/导师对话。功能必须默认关闭，可通过环境变量打开，并能在 mock DreamingRAG 模式下完成基本行为验证。

## 非目标

- 不评价或改进 DreamingRAG 的研究能力、检索质量、benchmark 分数或记忆公式。
- 不让 DreamingRAG 接管 Tutor 的回答生成、课程推进、StepEvaluator、skills 或 streaming 主流程。
- 不实现前端 UI、用户设置页、记忆管理页、删除/导出记忆功能。
- 不添加 Remote Runner、SEED 报告导入或 submodule/vendor 源码复制。
- 不提交真实记忆数据、外部 API key、数据库、向量索引或模型缓存。

## 当前仓库事实

- 入口规则：`AGENTS.md`
- 初始化契约：`harness/bootstrap-contract.md`
- 当前功能项：`dreamingrag-memory-integration`
- 相关文件/模块：`src/utils/tutor_core.py`、`src/config.py`、拟新增 `src/utils/memory_provider.py`、`tests/`
- 已知约束：`Tutor` 当前在 `tutor_core.py` 中恢复 session history、裁剪历史并把 `history` 注入 LangChain prompt；DreamingRAG 有 `DreamingBrain` facade 和 mock mode，但外部 SDK 边界未稳定，不能强依赖其完整对话 loop。

## 允许改动

- 新增一个窄后端 memory provider adapter，包含 null provider 和 DreamingRAG provider。
- 在 `Tutor` 中接入 provider：回复前 recall，回复后 record turn；失败必须降级为无记忆模式。
- 新增环境变量配置，默认关闭 DreamingRAG。
- 新增 focused 后端测试，验证 prompt 注入、写入调用、禁用/导入失败降级。
- 更新 harness 状态和必要文档。

## 禁止改动

- 不修改前端业务界面。
- 不改变数据库 schema，除非无法实现原型；如遇 schema 必须先停下说明。
- 不改变现有 session history 的持久化格式。
- 不改变 StepEvaluator、课程推进、custom skill、lab manual RAG 行为。
- 不把 `/Users/ely/workspace/research/agent/DreamingRAG` 源码复制进本仓库。

## 验收标准

- 默认配置下系统行为保持现状，DreamingRAG 未安装或未配置时不会阻塞 Tutor 初始化、回复生成或保存。
- 开启配置并提供 DreamingRAG 路径后，adapter 能创建 per-session storage，调用 DreamingRAG 记忆系统 recall，并把返回片段注入 LLM prompt 的系统上下文。
- 生成回复后，adapter 能把 user/assistant turn 写入 DreamingRAG；写入失败只记录 warning，不影响用户收到回复。
- focused tests 覆盖 null provider、DreamingRAG import/path 降级、recall context 格式化、Tutor prompt 注入和 record turn 调用。
- 原型只依赖一个窄内部接口，后续 DreamingRAG API 演化时主要改 adapter，不扩散到 Tutor 主流程。

## 验证命令

```sh
./scripts/harness-check.sh
python3 -m unittest tests.test_memory_provider
python3 -m compileall src
cd frontend && npm test -- --run
```

## Evidence 记录要求

验证通过后，将命令、结果、关键输出摘要或 artifact 路径写入 `harness/feature_list.json` 的 `dreamingrag-memory-integration.evidence`。

## 完成定义

- 请求行为已实现。
- 非目标没有被触碰。
- 上方验证命令已运行；未运行的命令必须说明原因。
- `harness/feature_list.json` 状态和 evidence 已更新。
- 职责、接口、setup 或边界改变时，docs、注释、测试或 harness 文件已更新。
- `harness/session-handoff.md` 写明当前状态、风险和下一步。
- 清洁状态检查已说明。

## 阻塞条件

- 如果 DreamingRAG 低层写入/检索接口无法在 mock mode 下运行，停止并把任务改为 blocked。
- 如果必须改变数据库 schema 或前端设置流才能做原型，停止并重新确认范围。
- 如果接入会破坏现有 Tutor streaming 或 StepEvaluator 行为，停止并拆更小垂直切片。

## 下一步最佳动作

1. 实现 `MemoryProvider` adapter 和配置开关。
2. 把 provider 接到 `Tutor` 的 prompt 注入与对话写入位置。
3. 写 focused unittest，用 fake provider 和 mock DreamingRAG 路径验证可用原型。

## 完成结果

- 状态：`passing`
- 实现：新增窄 `MemoryProvider` adapter、默认关闭配置、Tutor recall 注入、turn 写入和运行时数据忽略规则。
- 验证：`./scripts/harness-check.sh`、`python3 -m unittest tests.test_memory_provider`、`python3 -m compileall src`、`cd frontend && npm test -- --run` 均通过；DreamingRAG mock-mode adapter smoke 通过；DreamingRAG real-mode adapter smoke 通过；CLI seed profile 后可创建会话并用 DeepSeek 返回非空导师回复；同一 session 续轮能 recall 已写入记忆。
- 后续：真实模式的依赖安装、性能、错误观测、异步写入和 API 稳定性应在下一轮 hardening 中处理。
