"""Template assembly module.

This module provides classes for assembling Jinja2 templates with dynamic
content for the Socratic tutor system.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Tuple

import jinja2

from config import DEFAULT_OUTPUT_LANGUAGE
from schemas.curriculum import SocraticCurriculum
from schemas.definition import TutorPersona


class TemplateAssembler(ABC):
    """Abstract base class for assembling templates.

    This class provides a common interface for template assembly operations.
    Subclasses implement specific assembly logic for different use cases.
    """

    def __init__(self, template_string: str):
        """Initialize the assembler with a Jinja2 template.

        Args:
            template_string: Jinja2 template string to use.
        """
        self.template = jinja2.Template(template_string)

    @abstractmethod
    def assemble(self, *args, **kwargs) -> str:
        """Assemble a template.

        Must be implemented by subclasses.

        Args:
            *args: Variable positional arguments.
            **kwargs: Variable keyword arguments.

        Returns:
            Assembled template string.
        """
        pass


class BaseTemplateAssembler(TemplateAssembler):
    """Assembles the base template for the Socratic tutor.

    Used during profile generation to create a renderable template with
    static content filled in, leaving only dynamic step information as
    placeholders.
    """

    def assemble(
        self, definition: TutorPersona, curriculum: SocraticCurriculum
    ) -> str:
        """Assemble the base prompt template.

        Fills in static components (persona, domain rules, curriculum
        overview) and leaves dynamic step information as placeholders.

        Args:
            definition: TutorPersona containing persona and domain information.
            curriculum: SocraticCurriculum containing the learning steps.

        Returns:
            A renderable Jinja2 template string with static parts filled
            and dynamic parts as placeholders.
        """
        # Format static components
        persona_description = self._format_persona(definition)
        domain_rules = "\n".join(
            f"- {rule}" for rule in definition.get_domain_specific_constraints()
        )
        curriculum_str = self._format_curriculum_for_prompt(curriculum)

        # Create base context with static parts
        base_context = {
            "persona_description": persona_description,
            "topic_name": definition.get_topic_name(),
            "domain_specific_rules": domain_rules,
            "curriculum_str": curriculum_str,
        }

        # Placeholders for dynamic variables
        waited_to_render = {
            "current_step": {
                "step_title": "{{current_step.step_title}}",
                "learning_objective": "{{current_step.learning_objective}}",
                "guiding_question": "{{current_step.guiding_question}}",
                "success_criteria": "{{current_step.success_criteria}}",
            },
            "output_language": "{{output_language}}",
        }

        # Partially render template with placeholders unchanged
        base_template = self.template.render(base_context | waited_to_render)
        return base_template

    def _format_persona(self, definition: TutorPersona) -> str:
        """Format persona description from definition.

        Args:
            definition: TutorPersona object.

        Returns:
            Formatted persona description string.
        """
        hints = "\n- ".join(definition.get_persona_hints())
        topic_name = definition.get_topic_name()
        target_audience = definition.get_target_audience()
        return (
            f"You are an Socratic AI Tutor for the topic: \"{topic_name}\".\n"
            f"Your target audience is: {target_audience}.\n"
            f"Your persona and style should be guided by these hints:\n- {hints}"
        )

    def _format_curriculum_for_prompt(
        self, curriculum: SocraticCurriculum
    ) -> str:
        """Format curriculum as a numbered list for the prompt.

        Args:
            curriculum: SocraticCurriculum object.

        Returns:
            Formatted curriculum string with step titles and objectives.
        """
        formatted_steps = []
        for i in range(1, curriculum.get_len() + 1):
            step_title = curriculum.get_step_title(i)
            learning_objective = curriculum.get_learning_objective(i)
            formatted_steps.append(f"{i}. {step_title}: {learning_objective}")
        return "\n".join(formatted_steps)


class PromptAssembler(TemplateAssembler):
    """Assembles the final dynamic prompt for the Socratic tutor.

    Used during interactive sessions to render the template with current
    step information. Implements caching for static parts to improve performance.

    Attributes:
        template: Jinja2 template instance.
        _static_cache: Cache for static prompt parts, keyed by (curriculum_len,
            output_language, skills_tuple).
    """

    def __init__(self, template_string: str):
        """Initialize the assembler with a Jinja2 template.

        Args:
            template_string: Jinja2 template string to use.
        """
        super().__init__(template_string)
        self._static_cache: Dict[Tuple[int, str, Tuple[str, ...]], Dict[str, str]] = {}

    def assemble(
        self,
        curriculum: SocraticCurriculum,
        step_index: int,
        output_language: str = DEFAULT_OUTPUT_LANGUAGE,
        skills: Optional[List] = None,
    ) -> str:
        """Assemble the final prompt with dynamic content.

        Uses caching for static parts (persona, domain rules, curriculum overview,
        skills summary) to avoid redundant processing. Only dynamic parts (current
        step information) are updated on each call.

        Args:
            curriculum: SocraticCurriculum containing learning steps.
            step_index: Current step index (1-based).
            output_language: Output language for the tutor. Defaults to
                DEFAULT_OUTPUT_LANGUAGE.
            skills: Optional list of BaseSkill instances to include in prompt.
                If provided, their metadata will be formatted as available tools.

        Returns:
            Fully assembled prompt string.

        Raises:
            ValueError: If step_index is out of range.
        """
        if step_index < 1:
            raise ValueError("Invalid step index; must be >= 1")
        elif step_index > curriculum.get_len():
            return (
                "Task Complete. No additional task. "
                "Just Congratulations to user!"
            )

        # Generate cache key for static parts
        skills_tuple = tuple(skill.name for skill in (skills or []))
        cache_key = (
            curriculum.get_len(),
            output_language,
            skills_tuple,
        )

        # Get or build static context from cache
        if cache_key not in self._static_cache:
            static_context = self._build_static_context(
                curriculum, output_language, skills
            )
            self._static_cache[cache_key] = static_context
        else:
            static_context = self._static_cache[cache_key]

        # Prepare dynamic context for current step (changes every call)
        dynamic_context = {
            "current_step": {
                "step_title": curriculum.get_step_title(step_index),
                "learning_objective": curriculum.get_learning_objective(
                    step_index
                ),
                "guiding_question": curriculum.get_guiding_question(
                    step_index
                ),
                "success_criteria": curriculum.get_success_criteria(step_index),
            },
        }

        # Merge static and dynamic context
        final_context = {**static_context, **dynamic_context}

        # Render template with merged context
        final_prompt = self.template.render(final_context)
        return final_prompt

    def _build_static_context(
        self,
        curriculum: SocraticCurriculum,
        output_language: str,
        skills: Optional[List],
    ) -> Dict[str, str]:
        """Build static context that can be cached.

        Static parts include persona, domain rules, curriculum overview, and
        skills summary. These don't change between steps, so they can be cached.

        Args:
            curriculum: SocraticCurriculum containing learning steps.
            output_language: Output language for the tutor.
            skills: Optional list of BaseSkill instances.

        Returns:
            Dictionary containing static context variables.
        """
        # Note: This method assumes that persona_description, topic_name,
        # and domain_specific_rules are already in the template context.
        # In the current implementation, these are set during profile generation
        # and stored in the template. For caching to work fully, we would need
        # access to the TutorPersona definition here, but that's not available
        # in PromptAssembler. So we cache what we can: skills_summary and
        # curriculum_str (if curriculum doesn't change).

        static_context: Dict[str, str] = {
            "output_language": output_language,
        }

        # Add skills summary if provided
        if skills:
            static_context["skills_summary"] = self._format_skills_summary(skills)
        else:
            static_context["skills_summary"] = None

        # Note: curriculum_str is static for a given curriculum, but we don't
        # have access to it here. It's already in the template from profile
        # generation. For now, we cache skills_summary which is the main
        # dynamic part that changes.

        return static_context
    
    def _format_skills_summary(self, skills: List) -> str:
        """Format skills metadata as a summary for the system prompt.
        
        This method formats the skills' metadata (name and description) into
        a readable summary that helps the LLM understand available tools.
        Only metadata is included (Progressive Disclosure), not full instructions.
        
        Args:
            skills: List of BaseSkill instances.
            
        Returns:
            Formatted string containing skills summary.
        """
        if not skills:
            return ""
        
        lines = [
            "You have access to the following tools:",
            ""
        ]
        
        for i, skill in enumerate(skills, 1):
            skill_name = skill.name
            skill_description = skill.description
            lines.append(f"{i}. **{skill_name}**: {skill_description}")
        
        lines.append("")
        lines.append(
            "Use these tools when appropriate. The tool descriptions indicate "
            "when each tool should be used."
        )
        
        return "\n".join(lines)

