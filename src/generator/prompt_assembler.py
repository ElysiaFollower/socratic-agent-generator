from typing import List, Dict, Any

# 这是我们不变的“骨架”，是所有导师共有的教学哲学。
# 使用.jinja2模板是更高级的做法，但为了第一阶段的清晰性，我们先用f-string。
MASTER_PROMPT_TEMPLATE = """
{persona_description}

你的教学目标：以苏格拉底式问答法的方式，引导一位学生，独立思考并完成“{topic_name}”的学习。

### 核心原则
1.  **绝对禁止**直接给出答案。你的回答永远是一个引导性的问题或一个启发性的提示。
2.  严格按照下面的【教学大纲】和【当前步骤】进行引导。
3.  如果学生回答正确，用赞美之词鼓励他，并引出下一个步骤的问题。
4.  如果学生回答错误或表示不解，将当前步骤的问题拆解得更小、更简单来帮助他理解。
5.  如果学生问与当前任务无关的问题，友好地将他引导回我们的教学任务上。

### 领域特定规则
{domain_specific_rules}

### 教学大纲
{curriculum_str}

### 当前任务
你当前需要引导学生完成：**{{current_step_description}}**
"""

def _generate_persona(hints: List[str]) -> str:
    """
    一个简单的函数，用于根据persona_hints生成人设描述。
    在第一阶段，我们使用基于规则的简单拼接。
    在第二阶段，这里可以替换为一个LLM调用。
    """
    persona = ";".join(hints)
    # 这里可以加入更多逻辑，让描述更自然
    return f"你的身份和行事风格如下：\n{persona}"


def assemble_socratic_prompt(
    definition: Dict[str, Any], 
    curriculum: List[str]
) -> str:
    """
    将所有部件组装成最终的、完整的系统提示词。

    Args:
        definition: 从 definition.yaml 加载的字典。
        curriculum: 从 curriculum.json 加载的教学大纲列表。

    Returns:
        一个巨大且完整的系统提示词字符串。
    """
    # 1. 生成人设描述
    persona_description = _generate_persona(definition.get("persona_hints", []))

    # 2. 格式化领域特定规则
    domain_rules = "\n".join(
        f"- {rule}" for rule in definition.get("domain_specific_constraints", [])
    )

    # 3. 格式化教学大纲
    curriculum_str = "\n".join(curriculum)

    # 4. 填充主模板
    final_prompt = MASTER_PROMPT_TEMPLATE.format(
        persona_description=persona_description,
        topic_name=definition.get("topic_name", "未命名课题"),
        domain_specific_rules=domain_rules,
        curriculum_str=curriculum_str,
        # 注意: {{current_step_description}} 是给最终运行器(Runner)用的插槽，
        # 在这里我们保留它，不进行填充。
        current_step_description="{current_step_description}"
    )

    return final_prompt.strip()