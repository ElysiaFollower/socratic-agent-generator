# Persona Generator 深度设计文档

## 1. 架构逻辑：多维特征解耦与合成

我们不再尝试通过一个巨大的 Prompt 让模型一次性生成所有属性，而是将其拆解为三个专业化节点。这种设计实现了**技术分析与创意生成的解耦**，并通过**一致性评论家**确保生成的人设符合苏格拉底教学原则。

### 1.1 设计目标

- **解耦设计**：技术分析与创意生成分离，逻辑清晰，易于维护
- **质量保证**：通过评论家节点确保人设质量，避免与教学原则冲突
- **论文价值**：符合"Multi-Agent Collaborative Design"的叙事，展示从技术指标到对话风格的演变过程

### 1.2 与现有实现的兼容性

- ✅ **接口兼容**：保持 `async def generate(lab_manual_content: str) -> TutorPersona` 接口不变
- ✅ **输出兼容**：仍然返回 `TutorPersona` 对象，符合现有 Schema
- ✅ **向后兼容**：现有调用代码无需修改，可以渐进式实施

### 1.3 架构对比

**现有实现（单阶段）**：
```
实验手册 → [单阶段 Prompt] → TutorPersona
延迟：~1-2s，1次 LLM 调用
```

**新设计（三阶段）**：
```
实验手册 → [阶段1: 技术特征提取器] → TechnicalAnalysis
         → [阶段2: 创意人格合成器] → TutorPersona (初版)
         → [阶段3: 一致性评论家] → CriticScore
         → [循环] 如果评分 < 8，返回阶段2重新生成
         → 最终 TutorPersona
延迟：~3-6s（无循环）或 ~6-12s（有循环），3-6次 LLM 调用
```

---

## 2. 核心节点详细设计

### 阶段一：技术特征提取器 (Technical Analyst)

* **职责**：剥离感性色彩，客观分析实验手册的技术深度、目标受众和潜在风险。
* **设计目标**：为后续阶段提供客观、专业的技术分析基础，避免创意生成阶段的技术误判。

* **输入**：
  - 实验手册全文（截取首尾，使用 `_create_excerpt()` 方法，与现有实现一致）

* **输出**：`TechnicalAnalysis` 对象（中间数据结构）

* **中间数据结构**：

```python
from typing import Dict, List, Any
from pydantic import BaseModel, Field

class TechnicalAnalysis(BaseModel):
    """技术分析报告 - 阶段一的输出"""
    knowledge_density: Dict[str, Any] = Field(
        description="知识密度评估：涉及的核心概念及其层级"
    )
    target_audience_profile: str = Field(
        description="受众画像：推断学生的基础能力储备"
    )
    hard_constraints: List[str] = Field(
        description="硬性约束：法律、伦理、安全方面的底线"
    )
```

* **完整 Prompt 设计**（保持英文和XML格式，与现有实现一致）：

```python
TECHNICAL_ANALYST_PROMPT_TEMPLATE = """
<TASK>
You are a senior instructional engineer. Your role is to objectively analyze a technical lab manual and extract core technical metadata, stripping away emotional elements.

You must analyze the provided lab manual and output the following:
1. **Knowledge Density Assessment**: Core concepts involved and their hierarchy.
2. **Target Audience Profile**: Infer the student's baseline competency requirements.
3. **Hard Constraints**: Legal, ethical, and safety bottom lines.

Be objective and technical. Do not include creative or stylistic elements at this stage.
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
  - 使用 `JsonOutputParser(pydantic_object=TechnicalAnalysis)` 解析输出
  - 与现有实现保持一致的内容截取策略（`_create_excerpt()`）

* **输出映射关系**：
  - `target_audience_profile` → 将用于 `TutorPersona.target_audience`
  - `hard_constraints` → 将用于 `TutorPersona.domain_specific_constraints`
  - `knowledge_density` → 将作为阶段二的输入，指导创意生成

---

### 阶段二：创意人格合成器 (Creative Director)

* **职责**：基于技术分析，构建一个既符合学科属性又具有吸引力的导师形象。
* **设计目标**：将客观的技术分析转化为富有创意和吸引力的人设，同时确保人设符合实验特征。

* **输入**：
  1. **技术分析报告** (`TechnicalAnalysis` 对象，转为 JSON 字符串)
  2. **实验手册摘要**（用于补充上下文）
  3. **修改建议**（如果来自循环优化，包含评论家的建议；首次生成时为空）

* **输出**：`TutorPersona` 对象（初版）

* **完整 Prompt 设计**（保持英文和XML格式）：

```python
CREATIVE_DIRECTOR_PROMPT_TEMPLATE = """
<TASK>
You are a creative character design master. Based on the technical analysis below, design a unique and engaging AI tutor persona for this lab.

**Design Requirements**:
1. **Roleplay**: Do not just be a "teacher". Create a specific role that fits the lab's subject matter (e.g., "Penetration Testing Team Leader" for security labs, "Genetic Engineering Researcher" for biology labs).
2. **Style**: Define unique catchphrases, response tendencies (e.g., rigorous, humorous, challenging).
3. **Tone**: Adjust tone depth based on the target audience profile from the technical analysis.

Ensure the persona is engaging while maintaining pedagogical effectiveness. The persona should inspire students and make learning enjoyable.
</TASK>

<TECHNICAL_ANALYSIS>
{technical_analysis_json}
</TECHNICAL_ANALYSIS>

<LAB_MANUAL_SUMMARY>
{lab_manual_summary}
</LAB_MANUAL_SUMMARY>

<MODIFICATION_SUGGESTIONS>
{modification_suggestions}
</MODIFICATION_SUGGESTIONS>

<FORMAT_INSTRUCTIONS>
{format_instructions}
</FORMAT_INSTRUCTIONS>
"""
```

* **技术实现**：
  - 使用 `JsonOutputParser(pydantic_object=TutorPersona)` 解析输出
  - `modification_suggestions` 字段：如果来自循环优化，包含评论家的修改建议；首次生成时为空字符串

* **关键设计点**：
  - 基于技术分析的 `target_audience_profile` 调整人设的 `target_audience`
  - 基于技术分析的 `hard_constraints` 生成 `domain_specific_constraints`
  - 基于技术分析的 `knowledge_density` 指导 `persona_hints` 的创作方向

---

### 阶段三：一致性评论家 (Consistency Critic) —— **核心反思点**

* **职责**：进行质量自检，确保生成的人设不会干扰苏格拉底教学原则。
* **设计目标**：确保"有趣的人设"不会破坏"苏格拉底式提问"的严肃性，实现**Pedagogical-Persona Alignment**。

* **反思维度**：
  1. **适配性 (Adaptability)**：人设是否与实验严肃性冲突？（例如：在核安全实验中使用过于轻浮的口吻）
  2. **安全性 (Safety)**：约束条件是否完整？是否足以防止滥用？
  3. **可执行性 (Executability)**：人设要求是否会导致 LLM 在后续对话中过于沉溺于角色扮演而忘记教学任务？
  4. **苏格拉底对齐 (Socratic Alignment)**：角色是否会为了维持人设而直接给出答案？（必须拒绝）

* **输出结构**：

```python
class CriticScore(BaseModel):
    """评论家评分结果"""
    overall_score: int = Field(ge=1, le=10, description="总体评分（1-10）")
    adaptability_score: int = Field(ge=1, le=10, description="适配性评分")
    safety_score: int = Field(ge=1, le=10, description="安全性评分")
    executability_score: int = Field(ge=1, le=10, description="可执行性评分")
    socratic_alignment_score: int = Field(ge=1, le=10, description="苏格拉底对齐评分")
    suggestions: List[str] = Field(description="修改建议列表")
    critical_issues: List[str] = Field(default=[], description="严重问题列表（如果存在）")
```

* **完整 Prompt 设计**（保持英文和XML格式）：

```python
CONSISTENCY_CRITIC_PROMPT_TEMPLATE = """
<TASK>
You are a pedagogical quality monitoring expert. Review the generated Persona and check for the following issues:

1. **Adaptability**: Does the persona conflict with the lab's seriousness? (e.g., overly casual tone in nuclear safety labs)
2. **Safety**: Are constraint conditions complete enough to prevent misuse?
3. **Executability**: Will the persona requirements cause the LLM to be too immersed in roleplay and forget teaching tasks?
4. **Socratic Alignment**: Will the persona maintain the persona and directly give answers? (Should reject)

Output a score (1-10) for each dimension and overall score, along with modification suggestions.
</TASK>

<GENERATED_PERSONA>
{persona_json}
</GENERATED_PERSONA>

<TECHNICAL_ANALYSIS>
{technical_analysis_json}
</TECHNICAL_ANALYSIS>

<FORMAT_INSTRUCTIONS>
{format_instructions}
</FORMAT_INSTRUCTIONS>
"""
```

* **评分标准**：
  - **8分及以上**：人设质量良好，可以接受
  - **6-7分**：存在轻微问题，建议优化但可以接受
  - **5分及以下**：存在严重问题，必须重新生成

---

## 3. 具体实现流程 (Workflow)

### 3.1 主流程

```
实验手册
  ↓
[阶段1] 技术特征提取器 → TechnicalAnalysis
  ↓
[阶段2] 创意人格合成器 → TutorPersona (初版)
  ↓
[阶段3] 一致性评论家 → CriticScore
  ↓
判断评分
  ├─ 如果 overall_score >= 8 → 返回 TutorPersona
  └─ 如果 overall_score < 8 → 进入循环优化
```

### 3.2 循环优化机制

**循环条件**：
- 如果 `overall_score < 8`，将 `CriticScore.suggestions` 传递给阶段2重新生成
- **终止条件**：
  1. `overall_score >= 8`（达到目标分数）
  2. 达到最大循环次数（建议：`MAX_ITERATIONS = 3`）
  3. 检测到严重问题（`critical_issues` 不为空，且无法通过修改解决）

**循环流程**：

```
[阶段2] 创意人格合成器 (第N次)
  ↓
[阶段3] 一致性评论家
  ↓
判断评分
  ├─ overall_score >= 8 → 返回 TutorPersona
  ├─ iteration >= MAX_ITERATIONS → 返回最后一次生成的 TutorPersona（记录警告）
  └─ 存在 critical_issues → 返回最后一次生成的 TutorPersona（记录警告）
```

**实现示例**：

```python
async def generate(self, lab_manual_content: str) -> TutorPersona:
    """生成 Persona（三阶段流程，可能循环）"""
    # 阶段1：技术分析
    technical_analysis = await self.technical_analyst.analyze(lab_manual_content)
    
    # 阶段2和3：循环优化
    max_iterations = self.config.max_iterations if self.config.enable_loop else 1
    previous_suggestions = []
    
    for iteration in range(max_iterations):
        # 阶段2：创意生成
        persona = await self.creative_director.generate(
            technical_analysis,
            lab_manual_content,
            modification_suggestions=previous_suggestions
        )
        
        # 阶段3：质量检查
        if not self.config.enable_critic:
            return persona
        
        critic_result = await self.consistency_critic.review(
            persona,
            technical_analysis
        )
        
        # 判断是否达到目标
        if critic_result.overall_score >= self.config.critic_threshold:
            logger.info("Persona generation passed critic check (score: %d)", critic_result.overall_score)
            return persona
        
        # 如果未达标，准备下一次循环
        previous_suggestions = critic_result.suggestions
        logger.info("Persona generation iteration %d failed (score: %d), retrying...", 
                   iteration + 1, critic_result.overall_score)
    
    # 达到最大循环次数仍未达标
    logger.warning("Persona generation did not reach target score after %d iterations", max_iterations)
    return persona  # 返回最后一次生成的结果
```

### 3.3 最终输出

通过 `JsonOutputParser` 格式化为标准的 `TutorPersona` 对象，持久化到 `definition.json` 文件。

---

## 4. 配置选项与实施建议

### 4.1 配置选项

为了保持向后兼容和灵活性，建议添加配置选项：

```python
class PersonaGeneratorConfig:
    """PersonaGenerator 配置选项"""
    use_three_stage: bool = True  # 是否使用三阶段设计（默认开启）
    enable_critic: bool = True  # 是否启用评论家（默认开启）
    enable_loop: bool = False  # 是否启用循环优化（默认关闭，避免延迟过高）
    critic_threshold: int = 8  # 评论家评分阈值
    max_iterations: int = 3  # 最大循环次数
```

### 4.2 实施建议

**阶段1：基础三阶段（无循环）**
1. 实现技术特征提取器
2. 实现创意人格合成器（基于技术分析）
3. 实现一致性评论家（仅评分，不循环）
4. 测试和验证

**阶段2：添加循环机制（可选）**
5. 实现循环优化逻辑
6. 添加终止条件
7. 测试和优化

**阶段3：性能优化**
8. 添加缓存机制（技术分析结果可以缓存）
9. 优化 Prompt 设计
10. 性能监控和指标收集

### 4.3 性能考虑

**延迟影响**：
- **当前实现**：~1-2s（单次 LLM 调用）
- **三阶段（无循环）**：~3-6s（3次顺序 LLM 调用）
- **三阶段（有循环，平均2次）**：~6-12s（6次 LLM 调用）

**优化策略**：
- 添加进度提示（前端显示生成进度）
- 考虑缓存技术分析结果（相同实验手册）
- 循环机制建议默认关闭，避免延迟过高

---

## 5. 针对论文的叙事建议 (Scientific Contributions)

为了让论文更有深度，可以将此设计描述为：

### 5.1 核心贡献

* **Context-Aware Identity Synthesis (上下文感知身份合成)**
  - 强调 Persona 是基于实验手册的"技术语义"自动合成的，而非随机选择
  - 通过技术特征提取器实现客观的技术分析
  - 展示从原始手册到技术分析的语义提取过程

* **Pedagogical-Persona Alignment (教学-人格对齐)**
  - 利用 Critic 节点确保"有趣的人设"不会破坏"苏格拉底式提问"的严肃性
  - 通过多维度评分（适配性、安全性、可执行性、苏格拉底对齐）确保质量
  - 展示自动化质量保证机制

* **Multi-Agent Collaborative Design (多智能体协同设计)**
  - 在论文中展示从原始手册到最终 Persona 的演变过程
  - 展示从硬性的技术指标到软性的对话风格的转换
  - 体现专业化和分工的设计理念

### 5.2 论文术语映射

| 设计概念 | 论文术语 | 说明 |
|---------|---------|------|
| 技术特征提取器 | **Technical Semantic Extraction** | 强调基于技术语义的分析 |
| 创意人格合成器 | **Adaptive Identity Synthesis** | 强调人设的自适应合成 |
| 一致性评论家 | **Pedagogical-Persona Alignment Monitor** | 强调教学-人格对齐监控 |
| 三阶段流程 | **Multi-Agent Collaborative Design** | 强调多智能体协同 |

---

## 6. 与现有实现的对比

### 6.1 现有实现（单阶段）

**当前架构**（`PersonaGenerator.py`）：
```
实验手册 → [单阶段 Prompt] → TutorPersona
```

**特点**：
- ✅ 简单直接，单次 LLM 调用
- ✅ 延迟低（~1-2s）
- ✅ 已验证可用
- ⚠️ 技术分析与创意生成混合

### 6.2 新设计（三阶段）

**设计架构**：
```
实验手册 → [阶段1: 技术特征提取器] → TechnicalAnalysis
         → [阶段2: 创意人格合成器] → TutorPersona (初版)
         → [阶段3: 一致性评论家] → CriticScore
         → [循环] 如果评分 < 8，返回阶段2重新生成
         → 最终 TutorPersona
```

**优势**：
- ✅ 解耦设计，逻辑清晰
- ✅ 质量保证机制
- ✅ 论文价值高
- ⚠️ 复杂度增加，延迟增加

### 6.3 兼容性保证

- ✅ **接口兼容**：`async def generate(lab_manual_content: str) -> TutorPersona` 保持不变
- ✅ **输出兼容**：仍然返回 `TutorPersona` 对象
- ✅ **向后兼容**：现有调用代码无需修改
- ✅ **渐进式实施**：可以通过配置开关控制是否启用新功能

---

## 7. 实施路线图

### 阶段1：基础三阶段（1-2周）

1. **定义中间数据结构**
   - 创建 `TechnicalAnalysis` Schema
   - 创建 `CriticScore` Schema

2. **实现技术特征提取器**
   - 实现 `TechnicalAnalyst` 类
   - 设计并实现 Prompt
   - 测试和验证

3. **实现创意人格合成器**
   - 实现 `CreativeDirector` 类
   - 设计并实现 Prompt
   - 集成技术分析输入
   - 测试和验证

4. **实现一致性评论家**
   - 实现 `ConsistencyCritic` 类
   - 设计并实现 Prompt
   - 实现评分逻辑
   - 测试和验证

### 阶段2：循环优化（1周）

5. **实现循环机制**
   - 添加循环逻辑
   - 实现终止条件
   - 添加配置选项
   - 测试和验证

### 阶段3：优化和增强（1周）

6. **性能优化**
   - 添加缓存机制
   - 优化 Prompt 设计
   - 添加进度提示
   - 性能监控

---

## 8. 风险评估

| 风险项 | 风险等级 | 影响 | 缓解措施 |
|--------|---------|------|---------|
| 延迟增加 | 中 | 用户体验 | 添加进度提示，循环机制默认关闭 |
| 成本增加 | 中 | 运营成本 | 添加缓存，优化 Prompt |
| 复杂度增加 | 中 | 维护成本 | 模块化设计，充分测试 |
| 循环无限 | 低 | 系统稳定性 | 添加终止条件，超时保护 |
| 质量下降 | 低 | 输出质量 | 充分测试，A/B 对比 |

---

## 9. 总结

**设计合理性**：⭐⭐⭐⭐（高）

**核心优势**：
- ✅ 解耦设计，逻辑清晰
- ✅ 质量保证机制
- ✅ 论文价值高
- ✅ 向后兼容

**主要挑战**：
- ⚠️ 延迟和成本增加
- ⚠️ 复杂度增加

**建议**：
- ✅ **推荐实施**，但分阶段进行
- ✅ 先实施基础三阶段，验证效果
- ✅ 循环机制作为可选功能，默认关闭
- ✅ 添加配置选项，允许用户选择

这种设计既提高了人设生成的质量，又为论文提供了有价值的创新点，值得实施。
