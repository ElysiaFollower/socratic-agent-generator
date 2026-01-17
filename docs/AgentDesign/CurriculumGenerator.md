# Curriculum Generator 深度设计文档

## 1. 设计哲学：从线性步骤到认知图谱

**Curriculum Generator (大纲生成器)** 是整个系统的"灵魂"，它决定了导师提问的逻辑深度。为了支撑 CHI 2026 论文，我们需要将原本的"两阶段"简单流程升级为基于**知识依赖图 (Knowledge Dependency Graph)** 的 **多步推理架构**。

### 1.1 设计目标

- **痛点**：传统生成器只是单纯把实验手册改写成问题，容易遗漏技术细节，且步骤间缺乏逻辑关联。
- **新规划**：采用"解构-重组-校验"三部曲，确保每一个苏格拉底节点都具有**可验证性 (Verifiability)** 和 **启发性 (Provocability)**。
- **核心价值**：基于知识点的依赖关系重新排列逻辑，而非简单翻译手册。

### 1.2 与现有实现的兼容性

- ✅ **接口兼容**：保持 `async def generate(lab_manual_content: str) -> SocraticCurriculum` 接口不变
- ✅ **输出兼容**：仍然返回 `SocraticCurriculum` 对象，符合现有 Schema
- ✅ **向后兼容**：现有调用代码无需修改，可以渐进式实施
- ⚠️ **数据结构扩展**：需要扩展 `SocraticStep` 和 `Task` Schema，但使用默认值确保兼容

### 1.3 架构对比

**现有实现（两阶段）**：
```
实验手册 → [阶段1: Digest] → DigestedManual
         → [阶段2: Transform] → SocraticCurriculum
延迟：~2-4s，2次 LLM 调用
```

**新设计（三阶段）**：
```
实验手册 → [阶段1: 技术解构者] → DependencyMap
         → [阶段2: 苏格拉底架构师] → SocraticCurriculum (初版)
         → [阶段3: 逻辑反思者] → CriticScore
         → [循环] 如果评分 < 8，返回阶段2重新生成
         → 最终 SocraticCurriculum
延迟：~3-6s（无循环）或 ~6-12s（有循环），3-6次 LLM 调用
```

---

## 2. 架构设计：多智能体流水线 (Agentic Pipeline)

### 阶段一：技术解构者 (Technical Deconstructor)

* **职责**：从原始文档中提取硬性的"操作里程碑"和"技术依赖项"，构建技术依赖图。
* **设计目标**：为后续阶段提供结构化的技术分析基础，明确任务间的依赖关系。

* **输入**：
  - 实验手册全文

* **输出**：`DependencyMap` 对象（中间数据结构）

* **中间数据结构**：

```python
from typing import List, Dict, Optional
from pydantic import BaseModel, Field

class AtomicTask(BaseModel):
    """原子任务 - 最小的可执行操作单元"""
    task_id: str = Field(description="任务唯一标识符")
    task_title: str = Field(description="任务标题")
    objective: str = Field(description="该任务的核心学习目标")
    prerequisites: List[str] = Field(
        default=[],
        description="前置任务ID或概念列表（学生必须掌握的概念或完成的前置步骤）"
    )
    verifiable_evidence: Optional[str] = Field(
        default=None,
        description="如何通过控制台输出或文件变化来证明该任务已完成（将用于生成 Success Criteria）"
    )
    key_elements: List[str] = Field(
        description="完成该任务所涉及的关键技术、命令、函数或概念列表"
    )

class DependencyMap(BaseModel):
    """技术依赖图 - 阶段一的输出"""
    overall_goal: str = Field(description="整个实验最终要达成的总体目标")
    atomic_tasks: List[AtomicTask] = Field(description="按顺序排列的原子任务列表")
    dependency_graph: Dict[str, List[str]] = Field(
        default={},
        description="依赖关系图：任务ID -> 依赖的任务ID列表（可选，用于显式表示依赖关系）"
    )
```

* **完整 Prompt 设计**（保持英文和XML格式，与现有实现一致）：

```python
TECHNICAL_DECONSTRUCTOR_PROMPT_TEMPLATE = """
<TASK>
You are a rigorous systems analyst. Your role is to analyze a technical lab manual and extract a structured **Dependency Map** containing atomic tasks and their relationships.

You must extract the following for each task:
1. **Atomic Tasks**: The smallest executable operational units.
2. **Prerequisites**: Concepts or prerequisite steps that students must master before starting each task.
3. **Verifiable Evidence**: How to prove the task is completed through console output or file changes (this will become the Success Criteria).

Be objective and technical. Focus on extracting operational milestones and technical dependencies.
</TASK>

<LAB_MANUAL>
{lab_manual_content}
</LAB_MANUAL>

<FORMAT_INSTRUCTIONS>
{format_instructions}
</FORMAT_INSTRUCTIONS>
"""
```

* **技术实现**：
  - 使用 `JsonOutputParser(pydantic_object=DependencyMap)` 解析输出
  - 可以扩展现有的 `DigestedManual`，添加 `prerequisites` 和 `verifiable_evidence` 字段
  - 或创建新的 `DependencyMap` Schema，然后映射到 `DigestedManual`

* **输出映射关系**：
  - `AtomicTask` → 对应现有的 `Task`
  - `prerequisites` → 新增字段，将用于调整教学顺序
  - `verifiable_evidence` → 新增字段，将用于生成 `success_criteria`

---

### 阶段二：苏格拉底架构师 (Socratic Architect)

* **职责**：将解构的技术点转化为具有教育学意义的"脚手架式"问题序列。
* **设计目标**：确保"概念理解"始终优先于"指令输入"，生成启发式的问题序列。

* **输入**：
  1. **技术依赖图** (`DependencyMap` 对象，转为 JSON 字符串)
  2. **修改建议**（如果来自循环优化，包含评论家的建议；首次生成时为空）

* **输出**：`SocraticCurriculum` 对象（初版）

* **数据结构扩展**：

```python
class SocraticStep(BaseModel):
    """富信息的苏格拉底教学节点"""
    step_title: str = Field(description="这一步骤的简短标题")
    guiding_question: str = Field(
        description="[对人] 用于奠定该步骤总基调，启发学生思考的生动的苏格拉底式提问（关注'为什么'而非'怎么做'）"
    )
    success_criteria: str = Field(
        description="[对机器] 用于评估该步骤完成，明确的成功标准（必须是可观测的行为，而非模糊的'理解了'）"
    )
    learning_objective: str = Field(
        description="学生在该步骤的学习中应该掌握的核心知识点"
    )
    scaffolding_hints: List[str] = Field(
        default=[],
        description="如果学生答不上来时，用于层层拆解的提示列表（从简单到复杂，3-5个递进式提示）"
    )
```

* **完整 Prompt 设计**（保持英文和XML格式）：

```python
SOCRATIC_ARCHITECT_PROMPT_TEMPLATE = """
<TASK>
You are a top-tier instructional designer, especially proficient in Socratic teaching methods and {lesson_domain} education.

Your task is to transform a structured task list into a complete set of Socratic teaching nodes rich in pedagogical metadata.

**Design Requirements**:
1. **The "Why" Question**: For each task, design a guiding question that focuses on "why" rather than "how". The question should involve principles, not operations.
2. **Scaffolding Levels**: Design 3-5 progressive hints (from simple to complex) that can be used to break down the question if the student cannot answer.
3. **Concept-First Approach**: Ensure "concept understanding" always takes priority over "instruction input".
4. **Verifiable Success Criteria**: Based on the verifiable_evidence from the dependency map, create observable success criteria (e.g., "The student can explain..." rather than "The student understands...").

Your teaching style should follow these principles:
- **Concept First, Progressive Depth**: Explain core concepts with simple analogies before introducing specific operations.
- **Heuristic Questioning**: Each step should not be a simple command, but should contain a question that guides students to think (e.g., "What consequences do you think tampering with this 'return address' would bring?").
- **Logical Connection**: Steps should have clear causal and logical relationships, helping students understand "why" to do this.
- **Focus on Core**: Naturally integrate task objectives and key technical points into the conversation.
- **Complete Loop**: Form a complete learning loop from background introduction, theoretical preparation, hands-on practice, to final summary and prevention.
</TASK>

<DEPENDENCY_MAP>
{dependency_map_json}
</DEPENDENCY_MAP>

<MODIFICATION_SUGGESTIONS>
{modification_suggestions}
</MODIFICATION_SUGGESTIONS>

<FORMAT_INSTRUCTIONS>
{format_instructions}
</FORMAT_INSTRUCTIONS>
"""
```

* **技术实现**：
  - 使用 `JsonOutputParser(pydantic_object=SocraticCurriculum)` 解析输出
  - `modification_suggestions` 字段：如果来自循环优化，包含评论家的修改建议；首次生成时为空字符串
  - 基于 `verifiable_evidence` 生成 `success_criteria`
  - 基于 `prerequisites` 调整步骤顺序（如果依赖关系明确）

* **关键设计点**：
  - **"Why" vs "How"**：引导问题应该关注"为什么"而非"怎么做"
  - **Scaffolding Hints**：生成3-5个递进式提示，从简单到复杂
  - **可验证性**：Success Criteria 必须是可观测的行为，而非模糊的"理解了"

---

### 阶段三：逻辑反思者与校验器 (Logical Critic & Validator) —— **关键反思机制**

* **职责**：模拟学生视角，检查教学大纲是否存在"逻辑断层"或"过早剧透答案"。
* **设计目标**：确保生成的教学大纲符合苏格拉底教学原则，具有可验证性和启发性。

* **自检维度**：
  1. **答案泄露检查 (Answer Leak Check)**：引导问题中是否不小心包含了操作指令？
  2. **难度梯度校验 (Difficulty Gradient Check)**：步骤之间的跨度是否太大？
  3. **闭环验证 (Verifiability Check)**：Success Criteria 是否真的能通过学生的一句话回复来判定？

* **输出结构**：

```python
class CurriculumCriticResult(BaseModel):
    """课程大纲评论结果"""
    overall_score: int = Field(ge=1, le=10, description="总体评分（1-10）")
    answer_leak_score: int = Field(ge=1, le=10, description="答案泄露检查评分（越高越好）")
    difficulty_gradient_score: int = Field(ge=1, le=10, description="难度梯度评分（越高越好）")
    verifiability_score: int = Field(ge=1, le=10, description="可验证性评分（越高越好）")
    issues: List[str] = Field(description="发现的问题列表")
    suggestions: List[str] = Field(description="修改建议列表")
    critical_issues: List[str] = Field(default=[], description="严重问题列表（如果存在）")
```

* **完整 Prompt 设计**（保持英文和XML格式）：

```python
LOGICAL_CRITIC_PROMPT_TEMPLATE = """
<TASK>
You are a meticulous pedagogical supervisor. Review the generated teaching curriculum from a student's perspective and check for the following issues:

1. **Answer Leak Check**: Do guiding questions accidentally contain operational instructions? (e.g., "Run gcc with -fno-stack-protector" should be rejected)
2. **Difficulty Gradient Check**: Is the gap between steps too large? Can students follow the progression?
3. **Verifiability Check**: Can Success Criteria really be determined through a single student response? Are they observable behaviors rather than vague statements like "the student understands..."?

Find all sentences that "directly tell students what to do" and require the Architect to rewrite them as "guide students to think about why".

Output a score (1-10) for each dimension and overall score, along with modification suggestions.
</TASK>

<GENERATED_CURRICULUM>
{curriculum_json}
</GENERATED_CURRICULUM>

<DEPENDENCY_MAP>
{dependency_map_json}
</DEPENDENCY_MAP>

<FORMAT_INSTRUCTIONS>
{format_instructions}
</FORMAT_INSTRUCTIONS>
"""
```

* **评分标准**：
  - **8分及以上**：教学大纲质量良好，可以接受
  - **6-7分**：存在轻微问题，建议优化但可以接受
  - **5分及以下**：存在严重问题，必须重新生成

* **检查逻辑设计**：

```python
def check_answer_leak(guiding_question: str) -> bool:
    """检查引导问题是否泄露答案"""
    # 检查是否包含命令（如 'gcc', 'gdb', 'run'）
    # 检查是否包含代码片段
    # 检查是否包含操作步骤
    command_keywords = ['gcc', 'gdb', 'run', 'execute', 'compile']
    return any(keyword in guiding_question.lower() for keyword in command_keywords)

def check_verifiability(success_criteria: str) -> bool:
    """检查成功标准是否可验证"""
    # 检查是否包含模糊词汇（如"理解了"、"知道了"）
    vague_keywords = ['理解', '知道', '了解', '明白', 'understands', 'knows']
    # 检查是否包含可观测行为（如"能解释"、"能描述"、"能识别"）
    observable_keywords = ['解释', '描述', '识别', '说明', 'explain', 'describe', 'identify']
    has_vague = any(keyword in success_criteria for keyword in vague_keywords)
    has_observable = any(keyword in success_criteria for keyword in observable_keywords)
    return not has_vague and has_observable
```

---

## 3. 具体实现流程 (Workflow)

### 3.1 主流程

```
实验手册
  ↓
[阶段1] 技术解构者 → DependencyMap
  ↓
[阶段2] 苏格拉底架构师 → SocraticCurriculum (初版)
  ↓
[阶段3] 逻辑反思者 → CurriculumCriticResult
  ↓
判断评分
  ├─ 如果 overall_score >= 8 → 返回 SocraticCurriculum
  └─ 如果 overall_score < 8 → 进入循环优化
```

### 3.2 循环优化机制

**循环条件**：
- 如果 `overall_score < 8`，将 `CurriculumCriticResult.suggestions` 传递给阶段2重新生成
- **终止条件**：
  1. `overall_score >= 8`（达到目标分数）
  2. 达到最大循环次数（建议：`MAX_ITERATIONS = 3`）
  3. 检测到严重问题（`critical_issues` 不为空，且无法通过修改解决）

**循环流程**：

```
[阶段2] 苏格拉底架构师 (第N次)
  ↓
[阶段3] 逻辑反思者
  ↓
判断评分
  ├─ overall_score >= 8 → 返回 SocraticCurriculum
  ├─ iteration >= MAX_ITERATIONS → 返回最后一次生成的 SocraticCurriculum（记录警告）
  └─ 存在 critical_issues → 返回最后一次生成的 SocraticCurriculum（记录警告）
```

**实现示例**：

```python
async def generate(self, lab_manual_content: str) -> SocraticCurriculum:
    """生成 Curriculum（三阶段流程，可能循环）"""
    # 阶段1：技术解构
    dependency_map = await self.technical_deconstructor.deconstruct(lab_manual_content)
    
    # 阶段2和3：循环优化
    max_iterations = self.config.max_iterations if self.config.enable_loop else 1
    previous_suggestions = []
    
    for iteration in range(max_iterations):
        # 阶段2：苏格拉底转换
        curriculum = await self.socratic_architect.architect(
            dependency_map,
            modification_suggestions=previous_suggestions
        )
        
        # 阶段3：质量检查
        if not self.config.enable_critic:
            return curriculum
        
        critic_result = await self.logical_critic.review(
            curriculum,
            dependency_map
        )
        
        # 判断是否达到目标
        if critic_result.overall_score >= self.config.critic_threshold:
            logger.info("Curriculum generation passed critic check (score: %d)", critic_result.overall_score)
            return curriculum
        
        # 如果未达标，准备下一次循环
        previous_suggestions = critic_result.suggestions
        logger.info("Curriculum generation iteration %d failed (score: %d), retrying...", 
                   iteration + 1, critic_result.overall_score)
    
    # 达到最大循环次数仍未达标
    logger.warning("Curriculum generation did not reach target score after %d iterations", max_iterations)
    return curriculum  # 返回最后一次生成的结果
```

### 3.3 最终输出

通过 `JsonOutputParser` 格式化为标准的 `SocraticCurriculum` 对象，持久化到 `curriculum.json` 文件。

---

## 4. 核心数据结构扩展

### 4.1 SocraticStep 扩展

**现有 Schema**（`schemas/curriculum.py`）：
```python
class SocraticStep(BaseModel):
    step_title: str
    guiding_question: str
    success_criteria: str
    learning_objective: str
    # 没有 scaffolding_hints
```

**扩展后**：
```python
class SocraticStep(BaseModel):
    step_title: str
    guiding_question: str
    success_criteria: str
    learning_objective: str
    scaffolding_hints: List[str] = Field(
        default=[],
        description="如果学生答不上来时，用于层层拆解的提示列表（从简单到复杂）"
    )
```

**兼容性**：
- ✅ 向后兼容（使用 `default=[]`）
- ✅ 现有数据可以正常加载（缺少字段时使用默认值）

### 4.2 Task 扩展

**现有 Schema**（`schemas/others.py`）：
```python
class Task(BaseModel):
    task_title: str
    objective: str
    key_elements: List[str]
    # 没有 prerequisites 和 verifiable_evidence
```

**扩展后**：
```python
class Task(BaseModel):
    task_title: str
    objective: str
    key_elements: List[str]
    prerequisites: List[str] = Field(
        default=[],
        description="前置任务或概念列表"
    )
    verifiable_evidence: Optional[str] = Field(
        default=None,
        description="如何通过控制台输出或文件变化来证明该任务已完成"
    )
```

**兼容性**：
- ✅ 向后兼容（使用 `default=[]` 和 `default=None`）

---

## 5. 配置选项与实施建议

### 5.1 配置选项

为了保持向后兼容和灵活性，建议添加配置选项：

```python
class CurriculumGeneratorConfig:
    """CurriculumGenerator 配置选项"""
    use_three_stage: bool = True  # 是否使用三阶段设计（默认开启）
    enable_critic: bool = True  # 是否启用逻辑反思者（默认开启）
    enable_loop: bool = False  # 是否启用循环优化（默认关闭，避免延迟过高）
    critic_threshold: int = 8  # 评论家评分阈值
    max_iterations: int = 3  # 最大循环次数
```

### 5.2 实施建议

**阶段1：数据结构扩展（1周）**
1. 扩展 `SocraticStep` 添加 `scaffolding_hints` 字段
2. 扩展 `Task` 添加 `prerequisites` 和 `verifiable_evidence` 字段
3. 测试向后兼容性

**阶段2：阶段一增强（1周）**
4. 实现技术解构者的依赖关系提取
5. 实现可验证证据提取
6. 测试和验证

**阶段3：阶段二增强（1周）**
7. 实现 Scaffolding Hints 生成
8. 优化 "Why" 问题设计
9. 测试和验证

**阶段4：阶段三实现（1-2周）**
10. 实现逻辑反思者（简单规则检查）
11. 添加 LLM 语义检查
12. 实现循环机制（可选）
13. 测试和验证

### 5.3 性能考虑

**延迟影响**：
- **当前实现**：~2-4s（2次 LLM 调用）
- **三阶段（无循环）**：~3-6s（3次顺序 LLM 调用）
- **三阶段（有循环，平均2次）**：~6-12s（6次 LLM 调用）

**优化策略**：
- 添加进度提示（前端显示生成进度）
- 考虑缓存技术解构结果（相同实验手册）
- 循环机制建议默认关闭，避免延迟过高

---

## 6. 知识依赖图 (Knowledge Dependency Graph)

### 6.1 设计概念

**核心思想**：
- 基于知识点的依赖关系重新排列逻辑
- 不仅仅是翻译手册，而是构建依赖图
- 显式表示任务间的依赖关系（概念依赖和操作依赖）

### 6.2 依赖关系的表示

**方案1：在 Task 中添加 prerequisites 字段**（推荐）
```python
class Task(BaseModel):
    prerequisites: List[str]  # 前置任务ID或概念列表
```

**方案2：单独的依赖图结构**
```python
dependency_graph: Dict[str, List[str]]  # task_id -> [依赖的task_id列表]
```

### 6.3 依赖关系的使用

**在教学顺序中的应用**：
- 在阶段2生成时，考虑依赖关系调整步骤顺序
- 或在生成后，根据依赖关系重新排序

**循环依赖检测**：
- 添加循环依赖检测逻辑
- 如果检测到循环，记录警告

---

## 7. Scaffolding Hints 设计

### 7.1 设计描述

**用途**：
- 在学生答不上来时，用于层层拆解问题
- 提供3-5个递进式提示，从简单到复杂

**生成策略**：
- Prompt 中要求生成3-5个递进式提示
- 从简单类比到具体技术概念
- 确保提示是引导性的，而非直接给出答案

### 7.2 在 Tutor 中的使用

**使用场景**：
- 可以作为系统 Prompt 的一部分
- 或在学生多次回答错误时，逐步提供这些提示

**示例**：
```python
# 在 Tutor 的 Prompt 中使用
if student_attempts > 1:
    # 提供第一个 Scaffolding Hint
    hint = current_step.scaffolding_hints[min(student_attempts - 2, len(current_step.scaffolding_hints) - 1)]
```

---

## 8. 针对论文的科研创新点 (Scientific Contributions)

### 8.1 核心贡献

1. **Automated Socratic Decomposition (自动化苏格拉底解构)**
   - 展示如何利用 LLM 将非结构化的技术文档转化为结构化的"启发式路径"
   - 通过技术解构者实现客观的技术分析

2. **Dependency-Aware Curriculum Construction (依赖感知的大纲构建)**
   - 强调大纲不仅仅是翻译手册，而是基于知识点的依赖关系重新排列逻辑
   - 通过依赖图显式表示任务间的依赖关系

3. **Critic-in-the-Loop Optimization (循环中的评论家优化)**
   - 通过离线 Critic 节点的介入，证明了生成大纲的教学质量（Pedagogical Quality）相较于单次生成有显著提升
   - 通过多维度评分（答案泄露、难度梯度、可验证性）确保质量

### 8.2 论文术语映射

| 设计概念 | 论文术语 | 说明 |
|---------|---------|------|
| 技术解构者 | **Technical Semantic Decomposition** | 强调技术语义的解构 |
| 苏格拉底架构师 | **Socratic Pedagogical Architecture** | 强调苏格拉底教学架构 |
| 逻辑反思者 | **Pedagogical Quality Critic** | 强调教学质量评论家 |
| 三阶段流程 | **Multi-Agent Collaborative Curriculum Design** | 强调多智能体协同设计 |

---

## 9. 与现有实现的对比

### 9.1 现有实现（两阶段）

**当前架构**（`CurriculumGenerator.py`）：
```
实验手册 → [阶段1: Digest] → DigestedManual
         → [阶段2: Transform] → SocraticCurriculum
```

**特点**：
- ✅ 简单清晰，两阶段流程
- ✅ 已验证可用
- ✅ 延迟适中（~2-4s）
- ⚠️ 缺乏质量校验机制
- ⚠️ 没有知识依赖关系分析

### 9.2 新设计（三阶段）

**设计架构**：
```
实验手册 → [阶段1: 技术解构者] → DependencyMap
         → [阶段2: 苏格拉底架构师] → SocraticCurriculum (初版)
         → [阶段3: 逻辑反思者] → CurriculumCriticResult
         → [循环] 如果评分 < 8，返回阶段2重新生成
         → 最终 SocraticCurriculum
```

**优势**：
- ✅ 解耦设计，逻辑清晰
- ✅ 质量保证机制
- ✅ 功能增强（依赖关系、Scaffolding）
- ✅ 论文价值高
- ⚠️ 复杂度增加，延迟增加

### 9.3 兼容性保证

- ✅ **接口兼容**：`async def generate(lab_manual_content: str) -> SocraticCurriculum` 保持不变
- ✅ **输出兼容**：仍然返回 `SocraticCurriculum` 对象
- ✅ **向后兼容**：现有调用代码无需修改
- ✅ **渐进式实施**：可以通过配置开关控制是否启用新功能

---

## 10. 实施路线图

### 阶段1：数据结构扩展（1周）

1. **扩展 SocraticStep**
   - 添加 `scaffolding_hints` 字段
   - 测试向后兼容性

2. **扩展 Task**
   - 添加 `prerequisites` 字段
   - 添加 `verifiable_evidence` 字段
   - 测试向后兼容性

### 阶段2：阶段一增强（1周）

3. **实现技术解构者**
   - 实现依赖关系提取
   - 实现可验证证据提取
   - 设计并实现 Prompt
   - 测试和验证

### 阶段3：阶段二增强（1周）

4. **实现苏格拉底架构师增强**
   - 实现 Scaffolding Hints 生成
   - 优化 "Why" 问题设计
   - 集成依赖关系调整顺序
   - 测试和验证

### 阶段4：阶段三实现（1-2周）

5. **实现逻辑反思者**
   - 实现简单规则检查（答案泄露、可验证性）
   - 添加 LLM 语义检查（难度梯度）
   - 实现评分逻辑
   - 测试和验证

6. **实现循环机制（可选）**
   - 添加循环逻辑
   - 实现终止条件
   - 添加配置选项
   - 测试和验证

---

## 11. 风险评估

| 风险项 | 风险等级 | 影响 | 缓解措施 |
|--------|---------|------|---------|
| 延迟增加 | 中 | 用户体验 | 添加进度提示，循环机制默认关闭 |
| 成本增加 | 中 | 运营成本 | 添加缓存，优化 Prompt |
| 复杂度增加 | 中 | 维护成本 | 模块化设计，充分测试 |
| Schema 兼容性 | 低 | 数据兼容 | 使用默认值，充分测试 |
| 依赖关系准确性 | 中 | 输出质量 | 仔细设计 Prompt，人工审核 |

---

## 12. 总结

**设计合理性**：⭐⭐⭐⭐（高）

**核心优势**：
- ✅ 解耦设计，逻辑清晰
- ✅ 质量保证机制
- ✅ 功能增强（依赖关系、Scaffolding）
- ✅ 论文价值高
- ✅ 向后兼容

**主要挑战**：
- ⚠️ 延迟和成本增加
- ⚠️ 复杂度增加
- ⚠️ 需要扩展数据结构

**建议**：
- ✅ **推荐实施**，但分阶段进行
- ✅ 先实施数据结构扩展和核心功能
- ✅ 再实施增强功能（逻辑反思者）
- ✅ 循环机制作为可选功能，默认关闭
- ✅ 添加配置选项，允许用户选择

这种设计既提高了课程大纲生成的质量，又为论文提供了有价值的创新点，值得实施。

---

## 13. 三个智能体的协同联动

现在，三个核心智能体已经完成了从"初级版"到"论文科研级"的进化：

1. **Persona Generator**: 赋予导师"灵魂"和特定的"语气约束"。
2. **Curriculum Generator**: 提供了"逻辑骨架"和"可验证的进度点"。
3. **Tutor (Core)**: 在运行时，利用"极速评估器"维持进度，利用"生成器"流式输出导师的魅力，并由"异步 Critic"守住苏格拉底底线。

三个智能体协同工作，共同构建了一个完整的、高质量的苏格拉底式 AI 教学系统。
