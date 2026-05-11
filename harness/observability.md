# 可观测性

## 运行时信号

- 应用启动/就绪：后端 `GET /api/health` 返回 `{"status":"ok"}`；根路径返回 API 信息；Swagger 位于 `/docs`。
- 关键用户路径：登录/注册、Profile 列表、文档上传、Persona/Curriculum 生成、Profile 保存、Session 创建、流式对话、step completion。
- 数据/副作用检查：SQLite 数据库位于 `data/socratic_agent.db`；用户文档位于 `data/documents/{user_id}/`；向量索引位于 `data/vector_stores/{user_id}/`；模型缓存默认位于 `models/`。
- 错误上下文：FastAPI 日志、浏览器控制台、Network 面板、API 响应 body、生成器日志、custom skill indexing 日志。

## 过程工件

- 任务合同：`plans/active/`
- 功能状态：`harness/feature_list.json`
- 验证证据：feature item 的 `evidence`
- 会话交接：`harness/session-handoff.md`
- 长期方向：`docs/architecture/vnext-integrations.md`
- 质量评估：`harness/evaluator-rubric.md` 和 `harness/quality.md`

## 面向 agent 的错误消息规则

验证失败时，错误消息应说明：

- 哪个命令失败；
- 失败的可观察症状；
- 最可能的检查位置；
- 下一步修复建议。

不要只写 “test failed”。
