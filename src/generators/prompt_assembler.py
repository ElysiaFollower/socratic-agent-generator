from abc import ABC, abstractmethod
import jinja2
from typing import List, Dict, Any

import sys
from pathlib import Path
# Add the src directory to sys.path
sys.path.append(str(Path(__file__).resolve().parents[1]))
import config

class TemplateAssembler(ABC):
    """
    Abstract base class for assembling templates.
    
    when used for profile generation:
    - use `assemble_template`
        Assembles **prompt template** for the Socratic tutor
        by combining static templates with generated content.
        
    when used for interactive session:
    - load base templete in profile and use `assemble_prompt`
        Assembles the final, **dynamic prompt** for the Socratic tutor with the current step.
    """
    def __init__(self, template_string: str):
        """
        Initializes the assembler by loading a Jinja2 template.
        """
        self.template = jinja2.Template(template_string)

    @abstractmethod
    def assemble(self, *args, **kwargs) -> str:
        """
        Abstract method to assemble a template.
        Must be implemented by subclasses.
        """
        pass


class BaseTemplateAssembler(TemplateAssembler):
    """
    Assembles the base template for the Socratic tutor.
    used for profile generation
    """
    
    def assemble(self, definition: Dict[str, Any], curriculum: List[Dict[str, Any]]) -> str:
        """
        Assembles the base prompt by filling in the static parts of the template.

        Args:
            definition: The loaded content of definition.json.
            curriculum: The loaded content of curriculum.json (list of SocraticStep dicts).
            
        Returns:
            A renderable Jinja2 template object ready for runtime. only "current_step.xx" waiting for filling at runtime.
        """
        # 1. Format the static components for the prompt
        persona_description = self._format_persona(definition)
        domain_rules = "\n".join(f"- {rule}" for rule in definition.get("domain_specific_constraints", []))
        curriculum_str = self._format_curriculum_for_prompt(curriculum)

        # 2. Create a "partial" render of the template, filling only the static parts
        # Jinja2 doesn't have a direct partial render, so we load it and it's ready to be rendered with all vars.
        # We can create a simple dictionary to hold the static parts.
        base_context = {
            "persona_description": persona_description,
            "topic_name": definition.get("topic_name", "Unnamed Topic"),
            "domain_specific_rules": domain_rules,
            "curriculum_str": curriculum_str
        }
        
        # placeholders for dynamic variables
        waited_to_render = {
            "current_step": {
                "step_title": "{{current_step.step_title}}",
                "learning_objective": "{{current_step.learning_objective}}",
                "guiding_question": "{{current_step.guiding_question}}",
                "success_criteria": "{{current_step.success_criteria}}"
            },
            "output_language": "{{output_language}}"
        }

        base_template = self.template.render(base_context | waited_to_render) # partially render the template, with placeholders unchanged
        return base_template
    
    def _format_persona(self, definition: Dict[str, Any]) -> str:
        """
        Creates a rich persona description from the definition file.
        This is a significant upgrade from the simple join.
        """
        hints = "\n- ".join(definition.get("persona_hints", ["A helpful AI tutor."]))
        return (
            f"You are an Socratic AI Tutor for the topic: \"{definition.get('topic_name', 'Unnamed Topic')}\".\n"
            f"Your target audience is: {definition.get('target_audience', 'students')}.\n"
            f"Your persona and style should be guided by these hints:\n- {hints}"
        )

    def _format_curriculum_for_prompt(self, curriculum: List[Dict[str, Any]]) -> str:
        """
        Formats the list of SocraticStep objects into a human-readable numbered list.
        step title + objective can mostly represent the overall curriculum
        """
        formatted_steps = []
        for i, step in enumerate(curriculum, 1):
            formatted_steps.append(f"{i}. {step.get('step_title', 'Untitled Step')}: {step.get('learning_objective', '')}")
        return "\n".join(formatted_steps)


    
class PromptAssembler(TemplateAssembler):
    """
    Assembles the final dynamic prompt for the Socratic tutor.
    """
    def assemble(self, curriculum: List[Dict[str, Any]], step: int, output_language: str=config.DEFAULT_OUTPUT_LANGUAGE) -> str:
        """
        Assembles the final prompt by rendering the template with the dynamic content.
        used for interactive session
        
        Args:
            curriculum: content of curriculum
            step: current step index, start from 1
            output_language: output language
            
        Returns:
            The assembled prompt as a string.
        """
        if step < 1 or step > len(curriculum): 
            raise ValueError("Invalid step index; out of range.")    
    
        # Extract the current step data
        current_step = curriculum[step - 1]

        # Prepare the dynamic context for the current step
        dynamic_context = {
            "current_step": {
                "step_title": current_step.get("step_title", "Untitled Step"),
                "learning_objective": current_step.get("learning_objective", "No objective provided."),
                "guiding_question": current_step.get("guiding_question", "No question provided."),
                "success_criteria": current_step.get("success_criteria", "No criteria provided.")
            },
            "output_language": output_language
        }
        
        # render the template with the dynamic context
        final_prompt = self.template.render(dynamic_context)
        return final_prompt


if __name__ == "__main__":
    # run at root directory
    # Example usage
    with open("./src/templates/master_prompt_system.jinja2", 'r', encoding='utf-8') as f:
        template_string = f.read()
    base_assembler = BaseTemplateAssembler(template_string)

    # Assemble the base template
    import json
    with open("./data_raw/seed_buffer_overflow/definition.json", "r", encoding="utf-8") as f:
        definition = json.load(f)
    with open("./data_raw/seed_buffer_overflow/curriculum.json", "r", encoding="utf-8") as f:
        curriculum = json.load(f)
    base_template = base_assembler.assemble(definition, curriculum)
    print(base_template)
    print("\n\n --------------- \n\n")
    
    dynamic_assembler = PromptAssembler(base_template)

    # Assemble the dynamic prompt
    final_prompt = dynamic_assembler.assemble(curriculum, step=2, output_language="English")
    print(final_prompt)
    
    

# # 这是不变的“骨架”，是所有导师共有的教学哲学。
# MASTER_PROMPT_TEMPLATE = """
# {persona_description}

# 你的教学目标：以苏格拉底式问答法的方式，引导一位学生，独立思考并完成“{topic_name}”的学习。
# **Instruction:** Your response must be in language:**{{output_language}}**.

# ### 核心原则
# 1.  禁止直接给出答案。你的回答永远是一个引导性的问题或一个启发性的提示。
# 2.  严格按照下面的【教学大纲】和【当前步骤】进行引导。
# 3.  如果学生回答正确，用赞美之词鼓励他，并引出下一个步骤的问题。
# 4.  如果学生回答错误或表示不解，将当前步骤的问题拆解得更小、更简单来帮助他理解。
# 5.  如果学生问与当前任务无关的问题，友好地将他引导回我们的教学任务上。

# ### 领域特定规则
# {domain_specific_rules}

# ### 教学大纲
# {curriculum_str}

# ### 当前任务
# 你当前需要引导学生完成：**{{current_step_description}}**
# """