
# Tutor 智能体：高可靠苏格拉底导师架构设计

## 1. 总体架构图

本架构采用 **"评估-生成-校验"** 的 Agentic Workflow，确保在流式输出的同时，逻辑推进不乱，教学原则不丢。

## 2. 核心节点详细设计

### 节点 A：上下文感知评估器 (Context-Aware Evaluator)

* **设计目标**：基于多轮对话上下文，判定学生是否掌握当前步骤，决定教学状态机（FSM）的跳转。
* **核心问题**：学生可能在多轮对话后才理解概念，单次对话评估可能导致误判，使学生卡在当前步骤。
* **输入**：
  1. `Current Task Success Criteria`（当前步骤的成功标准）
  2. `Current Step Title`（当前步骤标题）
  3. **对话上下文**（最近 N 轮与当前步骤相关的对话，包括学生的多次回答和导师的引导）
* **输出**：`Yes` 或 `No`（仅用于状态机跳转，不输出给 Tutor）
* **设计原则**：
  - 评估器**独立运行**，不阻塞主对话流
  - 评估结果**仅用于状态机控制**，不传递给生成器
  - 考虑学生在多轮对话中的**渐进式理解过程**

* **提示词 (Prompt) 设计**（保持英文和XML格式）：

```python
EVALUATOR_PROMPT_TEMPLATE = """
<TASK>
You are a strict, impartial assessment assistant. Your role is to determine if the student has demonstrated understanding of the current step based on their responses in the conversation context.

Consider the student's learning progression across multiple turns. A student may need several rounds of guidance before demonstrating understanding. If the student shows understanding in any recent response, even after initial confusion, you should answer 'Yes'.

You MUST and ONLY answer with a single word: 'Yes' or 'No'. Do not provide any explanation, punctuation, or additional text.
</TASK>

<TOPIC>
{step_title}
</TOPIC>

<SUCCESS CRITERIA>
{success_criteria}
</SUCCESS CRITERIA>

<CONVERSATION CONTEXT>
{conversation_context}
</CONVERSATION CONTEXT>

<CURRENT STUDENT RESPONSE>
{user_input}
</CURRENT STUDENT RESPONSE>
"""
```

* **上下文提取策略**：
  - 提取当前步骤开始后的所有对话（`stepIndex` 不变的所有轮次）
  - 或提取最近 K 轮对话（如最近 5-10 轮）
  - 优先保留包含关键概念讨论的对话片段
  - Token 限制：建议不超过 2000 tokens，避免评估延迟过高



### 节点 B：苏格拉底生成器 (Socratic Generator) - *核心运行流*

* **设计目标**：融合 Persona 信息，生成符合苏格拉底教学原则的引导性回复。
* **输入**：
1. **Persona 元数据** (Topic, Target Audience, Hints)
2. **当前步骤信息** (Step Title, Learning Objective, Guiding Question, Success Criteria)
3. **上下文记忆** (最近 N 轮对话)
4. **可选的反思反馈** (From Node C，如果存在)

* **重要设计决策**：
  - **评估结果不直接传递给生成器**：评估器仅用于状态机控制（决定是否推进 `stepIndex`）
  - **生成器通过系统 Prompt 中的原则自主判断**：系统 Prompt 已包含处理正确/错误回答的原则
  - **状态推进在评估后立即执行**：如果评估为 "Yes"，`stepIndex` 立即 +1，生成器通过 `additional_note` 感知状态变化

* **提示词 (Prompt) 设计**（保持现有格式）：

采用现有的 `master_prompt_system.jinja2` 模板结构，包含：
- Persona 描述
- 核心教学原则（5条）
- 领域特定规则
- 教学大纲摘要
- 当前任务详情

**关键原则**（已在系统 Prompt 中）：
1. Never give direct answers
2. Strictly follow Teaching Syllabus and Current Task
3. If student answers correctly → praise and introduce next step
4. If student is wrong or confused → break down into smaller questions
5. If unrelated question → guide back to learning task

* **状态感知机制**：
  - 当 `stepIndex` 推进时，通过 `additional_note` 提示生成器：
    ```
    "\n\n(user just passed last step. Please review and introduce current step)"
    ```
  - 生成器据此判断需要引入新步骤，而非继续当前步骤的引导



### 节点 C：原则反思者 (Principle Critic) - *论文亮点*

* **设计目标**：针对 CHI 2026 论文中"教育一致性"的论点。异步监控生成器的输出，确保苏格拉底教学原则的一致性。
* **运行模式**：
  - **完全异步执行**：不阻塞用户对话体验，不影响首字延迟
  - **后台监控**：在生成器完成回复后，异步检查回复内容
  - **延迟反馈机制**：检查结果不立即使用，而是作为**可空字段**添加到下一次对话的系统 Prompt 中

* **设计逻辑**：
  - 检查回复是否包含"直接答案"、"完整代码块"、"解释性过强"等违规内容
  - 生成**非侵入性的反思提示**，格式类似："对了，之前的回复可能过于直接，请确保以引导性问题为主。"
  - 反思提示作为**可选的系统消息**添加到下一次对话，不强制要求 Tutor 立即修正

* **实现方式**：

```python
# 异步执行，不阻塞主流程
async def _critic_check_async(self, generated_response: str) -> Optional[str]:
    """异步检查生成回复是否违反苏格拉底原则"""
    # 检查逻辑...
    if violation_detected:
        return "Note: Previous response may have been too direct. Ensure responses are guiding questions."
    return None

# 在生成完成后触发异步检查
async def stream_message(self, user_input: str):
    # ... 生成回复 ...
    reply = ""
    async for chunk in self.main_chain_with_history.astream(...):
        reply += chunk
        yield chunk
    
    # 异步检查（不等待结果）
    asyncio.create_task(self._critic_check_async(reply))
    
    # 保存历史...
    
# 在下次对话时，如果有反思提示，添加到系统 Prompt
critic_note = await self._get_pending_critic_note()  # 获取上次的检查结果
if critic_note:
    system_prompt += f"\n\n{critic_note}"
```

* **优势**：
  - ✅ **零延迟影响**：完全异步，不影响用户体验
  - ✅ **非侵入性**：反思提示作为建议，而非强制修正
  - ✅ **论文价值**：体现"教育一致性"的自动化监控机制
  - ✅ **可观测性**：记录教学偏离度，便于分析和改进

---

## 3. 状态与记忆管理 (Memory Layer)

### 3.1 混合窗口记忆

* **当前实现**：采用 `Max_History_Tokens` 截断的滑动窗口，保留最近的详细对话上下文。
* **技术备注**：此部分预留接口。待 **Dreaming RAG** (你的另一研究项目) 完成后，可将其作为"长期记忆检索"插件。
* **论文叙事点**：你可以称之为 "Short-term Operational Buffer"，并提及未来将通过仿生记忆机制 (Dreaming RAG) 实现跨会话的学习进度追踪。

### 3.2 上下文提取策略（用于评估器）

* **目标**：为评估器提供当前步骤相关的多轮对话上下文
* **策略选项**：
  1. **步骤级上下文**：提取当前 `stepIndex` 开始后的所有对话
     - 优点：完整反映学生在当前步骤的学习过程
     - 缺点：如果步骤对话很长，可能超出 token 限制
  2. **滑动窗口上下文**：提取最近 K 轮对话（如最近 5-10 轮）
     - 优点：固定 token 消耗，可控性强
     - 缺点：可能丢失步骤早期的关键对话
  3. **混合策略**：优先保留当前步骤的对话，不足时补充更早的对话
     - 优点：平衡完整性和效率
     - 推荐：采用此策略

* **实现建议**：
```python
def _extract_evaluation_context(self, max_tokens: int = 2000) -> str:
    """提取用于评估器的对话上下文"""
    context_messages = []
    tokens_used = 0
    
    # 优先提取当前步骤的对话
    current_step_start_idx = self._find_step_start_index()
    for msg in self.history.messages[current_step_start_idx:]:
        msg_tokens = self.llm.get_num_tokens(msg.content)
        if tokens_used + msg_tokens > max_tokens:
            break
        context_messages.append(msg)
        tokens_used += msg_tokens
    
    # 如果还有空间，补充更早的对话
    if tokens_used < max_tokens * 0.8:  # 保留20%余量
        # 补充更早的对话...
        pass
    
    return self._format_context(context_messages)
```

### 3.3 反思提示存储

* **存储方式**：在 Session 对象中添加可选字段 `pending_critic_note: Optional[str]`
* **生命周期**：
  - 生成：在异步反思检查完成后
  - 使用：在下次对话时添加到系统 Prompt
  - 清除：使用后立即清除，避免重复使用

---

## 4. 关键流程控制逻辑

### 4.1 主流程（同步）

1. **接收输入**：捕获用户消息 `user_input`

2. **准备上下文**：
   - 从 Session 读取当前步骤信息（`stepIndex`, `curriculum`）
   - 提取当前步骤相关的对话上下文（用于评估器）

3. **上下文感知评估**（Node A）：
   - 将 `user_input` + `conversation_context` + `success_criteria` 送入评估器
   - 获取评估结果 `Yes/No`
   - **状态机跳转**：如果 `Yes`，立即更新 `stepIndex += 1`

4. **生成回复**（Node B）：
   - 组装系统 Prompt（包含当前步骤信息、Persona、教学原则等）
   - 如果 `stepIndex` 已推进，添加 `additional_note` 提示引入新步骤
   - 检查是否有待处理的反思提示（From Node C），如有则添加到系统 Prompt
   - 开始流式生成回复

5. **更新历史**：
   - 将 `user_input` 和生成的 `reply` 添加到对话历史
   - 保存 Session 状态

### 4.2 异步流程（不阻塞主流程）

6. **原则反思**（Node C）：
   - 在生成完成后，**异步触发**原则反思检查
   - 检查生成的 `reply` 是否违反苏格拉底原则
   - 如果发现违规，生成反思提示并**存储为待处理状态**
   - 反思提示将在**下一次对话**时作为可空字段添加到系统 Prompt

### 4.3 流程时序图

```
用户输入
  ↓
提取上下文 + 当前步骤信息
  ↓
[评估器] 上下文感知评估 → Yes/No
  ↓ (如果 Yes)
状态机跳转 (stepIndex += 1)
  ↓
[生成器] 组装 Prompt + 检查反思提示
  ↓
流式生成回复 (开始输出)
  ↓
更新历史 + 保存状态
  ↓
[异步] 原则反思检查 → 存储反思提示（用于下次）
```

**关键设计点**：
- ✅ 评估器使用多轮对话上下文，避免单次回答误判
- ✅ 评估结果仅用于状态机控制，不传递给生成器
- ✅ 生成器通过系统 Prompt 原则和状态变化自主判断
- ✅ 原则反思完全异步，零延迟影响
- ✅ 反思提示延迟反馈，非侵入性修正

---

## 5. 针对科研论文的创新点设计建议

| 模块名称 | 论文中的术语 (Scientific Terms) | 理由 |
| --- | --- | --- |
| **Evaluator** | **State Transition Controller** | 强调 Agent 并不是胡乱聊天，而是受限状态机控制的逻辑推进。 |
| **Critic** | **Pedagogical Alignment Monitor** | 体现了对苏格拉底原则的自动化强制约束。 |
| **Persona** | **Adaptive Identity Synthesis** | 说明导师的人设是从实验手册中"涌现"并合成的。 |

---

## 6. 实现状态与计划

### 6.1 当前实现状态

**评估器实现**：
- ❌ **独立评估器未实现**：当前使用Skill-based Tool调用方式（`AssessmentSkill`）
- ❌ **上下文感知未实现**：仅考虑单次回答，未提取多轮对话上下文
- ✅ **状态推进已实现**：通过`complete_current_step` tool推进`stepIndex`

**详细分析**：见 `docs/26-01-19-skiils/PROGRESS_EVALUATION_DISCUSSION.md`

### 6.2 未来实施计划

**已决策采用混合方案**：

1. **短期（1-2周）**：优化现有实现
   - 增强`AssessmentSkill`的SKILL.md文档
   - 添加评估日志
   - 优化系统Prompt

2. **中期（1-2个月）**：实现独立评估器
   - 实现轻量级评估器（使用Haiku模型）
   - 实现上下文提取机制
   - 异步执行，不阻塞主流程
   - 并行运行，收集对比数据

3. **长期（3-6个月）**：根据数据决定是否完全切换
   - 分析评估器vs Skill-based的效果
   - 优化评估器效果
   - 增强可观测性

**实施细节**：见 `docs/26-01-19-skiils/ECO.md` Phase 1.4

---
