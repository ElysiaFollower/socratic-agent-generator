# 决策日志

## 记录规则

重要决策必须写明：日期、决策、原因、否决方案、后续约束。

## 决策

### 2026-05-11 - 采用 repo-native harness

- 决策：采用 repo-native harness，仓库保存指令、状态、验证、交接和质量信息。
- 原因：降低冷启动成本、上下文丢失、范围漂移、验证缺口和返工。
- 否决方案：只依赖聊天 prompt 或单个巨型 `AGENTS.md`。
- 后续约束：项目事实必须进入仓库；重复失败优先转成测试、脚本或检查。

### 2026-05-11 - vNext 方向先记录为架构事实

- 决策：SEED 报告语料、Remote Runner 集成和 DreamingRAG 记忆集成先写入 `docs/architecture/vnext-integrations.md`。
- 原因：三者会影响系统边界、数据流和权限模型，需要先成为持久事实，再分别开分支实现。
- 否决方案：在一次 harness 初始化中直接复制报告、添加 submodule 或改运行时代码。
- 后续约束：每个方向进入实现前必须有独立 plan、验证标准和隐私/权限边界。

### 2026-05-11 - 外部项目先作为 submodule 候选

- 决策：`SEEDRunner` 和 `DreamingRAG` 只作为未来 submodule 候选记录，不把源码复制进本仓库。
- 原因：两个项目仍在开发中，边界和 API 需要稳定后再集成。
- 否决方案：直接 vendor 外部源码或在本仓库中重写原型。
- 后续约束：集成前先定义接口合同、版本策略、失败模式和安全约束。

### 2026-05-14 - 产品北极星优先于局部通关指标

- 决策：`docs/product/vision.md` 作为产品北极星和价值标准线，优先级高于局部 prompt、benchmark 通过、step completion 或工具调用成功。
- 原因：项目目标是用 AI 降低实验摩擦，同时保留学生关键判断、关键推理和关键验证；单纯通关或自动执行命令会让系统偏向代做或运维 agent。
- 否决方案：只用 `isFinished=true`、remote audit 数量或 LLM 回复是否无报错来判断学习系统成功。
- 后续约束：涉及 Tutor、profile、benchmark、Remote tool 或学习前端的 plan 必须说明如何减少外围摩擦、保留学生核心思考，并给出可观察证据。
