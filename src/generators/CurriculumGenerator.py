"""Curriculum generation module.

This module generates Socratic curriculum from lab manuals through a
three-stage process: Technical Deconstruction -> Socratic Architecture -> Logical Critic.

Core Value: Transform static lab manuals into living teaching curricula with
pedagogical depth, dependency awareness, and Socratic alignment.
"""

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional

from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate

from pydantic import ValidationError

from config import DEFAULT_OUTPUT_LANGUAGE, LESSON_DOMAIN, SUPPORTED_LANGUAGES
from schemas.curriculum import SocraticCurriculum
from schemas.others import DigestedManual
from schemas.generator_intermediate import DependencyMap, CurriculumCriticResult
from generators.cache import get_cache
from generators.config import GeneratorConfig, PRODUCTION_CONFIG

logger = logging.getLogger(__name__)


class CurriculumGenerator:
    """Generates Socratic curriculum from lab manuals.

    This agent reads lab manuals and generates Socratic teaching curriculum
    through either a two-phase (legacy) or three-phase (enhanced) process.

    The three-stage design embodies the core value of "creative empowerment":
    transforming static documents into living teaching curricula.
    """

    def __init__(
        self,
        llm: Any,
        config: Optional[GeneratorConfig] = None,
        output_language: str = DEFAULT_OUTPUT_LANGUAGE,
    ):
        """Initialize CurriculumGenerator.

        Args:
            llm: LLM instance for generation.
            config: Generator configuration. If None, uses PRODUCTION_CONFIG.
            output_language: Output language for generated content. Defaults to
                DEFAULT_OUTPUT_LANGUAGE.

        Raises:
            ValueError: If output_language is not supported.
        """
        self.llm = llm
        self.config = config or PRODUCTION_CONFIG
        
        # Validate output_language
        if output_language not in SUPPORTED_LANGUAGES.values():
            logger.warning(
                "Unsupported output_language '%s', using default '%s'",
                output_language,
                DEFAULT_OUTPUT_LANGUAGE
            )
            output_language = DEFAULT_OUTPUT_LANGUAGE
        
        self.output_language = output_language
        self.cache = get_cache() if self.config.enable_cache else None

        # Legacy two-stage prompts (for backward compatibility)
        self._init_legacy_prompts()

        # Three-stage prompts (for enhanced generation)
        if self.config.use_three_stage:
            self._init_three_stage_prompts()

    def _init_legacy_prompts(self):
        """Initialize legacy two-stage prompts."""
        # Phase 1: Document Digest
        digest_parser = JsonOutputParser(pydantic_object=DigestedManual)
        self.legacy_digest_prompt = ChatPromptTemplate.from_messages([
            ("system",
             f"""<TASK>
You are an experienced and meticulous {LESSON_DOMAIN} lab teaching assistant. 
Your task is to carefully read the lab manual and decompose its content into a series of logical, progressive task steps.

**Your Responsibilities**:
- Focus on extracting operational, verifiable tasks.
- Ignore background introductions, pleasantries, and other non-core content.
- Ensure each task is clearly defined and measurable.

**Output Language**: All output must be in {self.output_language}.

**Output Requirements**:
- Strictly follow the JSON format specified in {{format_instructions}}.
- Ensure all tasks are structured and sequential.
</TASK>

<LAB_MANUAL>
{{lab_manual}}
</LAB_MANUAL>

<FORMAT_INSTRUCTIONS>
{{format_instructions}}
</FORMAT_INSTRUCTIONS>"""),
        ])
        self.legacy_digest_chain = self.legacy_digest_prompt | self.llm | digest_parser

        # Phase 2: Socratic Transformation
        curriculum_parser = JsonOutputParser(pydantic_object=SocraticCurriculum)
        self.legacy_transform_prompt = ChatPromptTemplate.from_messages([
            ("system",
             f"""<TASK>
You are a top-tier instructional designer, especially proficient in Socratic teaching methods and {LESSON_DOMAIN} education.

Your task is to transform a structured task list into a complete set of Socratic teaching nodes rich in pedagogical metadata.

**Teaching Principles**:
1. **Concept First, Progressive Depth**: Before introducing specific operations, explain core concepts with simple analogies.
2. **Heuristic Questioning**: Each step should not be a simple command, but should contain a question that guides students to think (e.g., "What consequences do you think tampering with this return address would bring?").
3. **Logical Connection**: Steps should have clear causal and logical relationships, helping students understand "why" to do this.
4. **Focus on Core**: Naturally integrate task objectives and key technical points into the conversation.
5. **Complete Loop**: Form a complete learning loop from background introduction, theoretical preparation, hands-on practice, to final summary and prevention.

**Output Language**: All output must be in {self.output_language}.

**Critical Requirements**:
- You MUST generate complete fields for **every** step in the list: `step_title`, `guiding_question`, `success_criteria`, `learning_objective`.
- Do not omit any fields, even if content is similar. Maintain structural completeness.
- Strictly follow the JSON format specified in {{format_instructions}}.
</TASK>

<STRUCTURED_TASK_LIST>
{{digest}}
</STRUCTURED_TASK_LIST>

<FORMAT_INSTRUCTIONS>
{{format_instructions}}
</FORMAT_INSTRUCTIONS>"""),
        ])
        self.legacy_transform_chain = self.legacy_transform_prompt | self.llm | curriculum_parser

    def _init_three_stage_prompts(self):
        """Initialize three-stage prompts."""
        # Stage 1: Technical Deconstructor
        deconstructor_parser = JsonOutputParser(pydantic_object=DependencyMap)
        self.technical_deconstructor_prompt = ChatPromptTemplate.from_messages([
            ("system",
             f"""<TASK>
You are a rigorous systems analyst specializing in educational content decomposition. Your role is to analyze a technical lab manual and extract a structured **Dependency Map** containing atomic tasks and their relationships.

**Your Responsibilities**:
1. **Atomic Tasks**: Extract the smallest executable operational units.
2. **Prerequisites**: Identify concepts or prerequisite steps that students must master before starting each task.
3. **Verifiable Evidence**: Determine how to prove the task is completed through console output or file changes (this will become the Success Criteria).

**Output Requirements**:
- Be objective and technical. Focus on extracting operational milestones and technical dependencies.
- Ensure each task has clear prerequisites and verifiable evidence.
- Build a dependency graph that represents the logical learning progression.
- All output must be in {self.output_language}.
</TASK>

<LAB_MANUAL>
{{lab_manual_content}}
</LAB_MANUAL>

<FORMAT_INSTRUCTIONS>
{{format_instructions}}
</FORMAT_INSTRUCTIONS>"""),
        ])
        self.technical_deconstructor_chain = self.technical_deconstructor_prompt | self.llm | deconstructor_parser

        # Stage 2: Socratic Architect
        curriculum_parser = JsonOutputParser(pydantic_object=SocraticCurriculum)
        self.socratic_architect_prompt = ChatPromptTemplate.from_messages([
            ("system",
             f"""<TASK>
You are a top-tier instructional designer, especially proficient in Socratic teaching methods and {LESSON_DOMAIN} education.

Your mission is to **transform a static task list into a living teaching curriculum** that guides students through a journey of discovery and understanding. This is not just content reorganization—this is **pedagogical architecture** and **cognitive path design**.

Your task is to **create** a complete set of Socratic teaching nodes rich in pedagogical metadata, where each node is designed to **provoke thought**, **inspire curiosity**, and **guide discovery**.

**Design Requirements**:
1. **The "Why" Question**: For each task, design a guiding question that focuses on "why" rather than "how". The question should involve principles, not operations.
2. **Scaffolding Levels**: Design 3-5 progressive hints (from simple to complex) that can be used to break down the question if the student cannot answer.
3. **Concept-First Approach**: Ensure "concept understanding" always takes priority over "instruction input".
4. **Verifiable Success Criteria**: Based on the verifiable_evidence from the dependency map, create observable success criteria (e.g., "The student can explain..." rather than "The student understands...").

**Teaching Principles**:
- **Concept First, Progressive Depth**: Explain core concepts with simple analogies before introducing specific operations.
- **Heuristic Questioning**: Each step should not be a simple command, but should contain a question that guides students to think (e.g., "What consequences do you think tampering with this 'return address' would bring?").
- **Logical Connection**: Steps should have clear causal and logical relationships, helping students understand "why" to do this.
- **Focus on Core**: Naturally integrate task objectives and key technical points into the conversation.
- **Complete Loop**: Form a complete learning loop from background introduction, theoretical preparation, hands-on practice, to final summary and prevention.

**Output Language**: All output must be in {self.output_language}.
</TASK>

<DEPENDENCY_MAP>
{{dependency_map_json}}
</DEPENDENCY_MAP>

<MODIFICATION_SUGGESTIONS>
{{modification_suggestions}}
</MODIFICATION_SUGGESTIONS>

<FORMAT_INSTRUCTIONS>
{{format_instructions}}
</FORMAT_INSTRUCTIONS>"""),
        ])
        self.socratic_architect_chain = self.socratic_architect_prompt | self.llm | curriculum_parser

        # Stage 3: Logical Critic
        if self.config.enable_critic:
            critic_parser = JsonOutputParser(pydantic_object=CurriculumCriticResult)
            self.logical_critic_prompt = ChatPromptTemplate.from_messages([
                ("system",
                 f"""<TASK>
You are a meticulous pedagogical supervisor. Review the generated teaching curriculum from a student's perspective and check for the following issues:

1. **Answer Leak Check**: Do guiding questions accidentally contain operational instructions? (e.g., "Run gcc with -fno-stack-protector" should be rejected)
2. **Difficulty Gradient Check**: Is the gap between steps too large? Can students follow the progression?
3. **Verifiability Check**: Can Success Criteria really be determined through a single student response? Are they observable behaviors rather than vague statements like "the student understands..."?

**Your Task**:
Find all sentences that "directly tell students what to do" and require the Architect to rewrite them as "guide students to think about why".

**Output Requirements**:
- Output a score (1-10) for each dimension and overall score, along with modification suggestions.
- All output must be in {self.output_language}.
</TASK>

<GENERATED_CURRICULUM>
{{curriculum_json}}
</GENERATED_CURRICULUM>

<DEPENDENCY_MAP>
{{dependency_map_json}}
</DEPENDENCY_MAP>

<FORMAT_INSTRUCTIONS>
{{format_instructions}}
</FORMAT_INSTRUCTIONS>"""),
            ])
            self.logical_critic_chain = self.logical_critic_prompt | self.llm | critic_parser

    async def _generate_legacy(self, lab_manual_content: str) -> SocraticCurriculum:
        """Legacy two-stage generation (for backward compatibility)."""
        overall_start = time.time()
        logger.info(
            "[Legacy Mode] Starting curriculum generation (output_lang=%s)",
            self.output_language
        )
        
        # Phase 1: Extract and structure information
        phase1_start = time.time()
        logger.info("[Phase 1/2] Parsing and structuring lab document...")
        digested_manual = await self.legacy_digest_chain.ainvoke({
            "lab_manual": lab_manual_content,
            "format_instructions": JsonOutputParser(pydantic_object=DigestedManual).get_format_instructions(),
        })
        digested_manual = DigestedManual.model_validate(digested_manual)
        phase1_elapsed = time.time() - phase1_start
        logger.info(
            "[Phase 1/2] Document structuring completed (elapsed=%.2fs, tasks=%d)",
            phase1_elapsed,
            len(digested_manual.tasks)
        )

        # Phase 2: Transform structured information into Socratic curriculum
        phase2_start = time.time()
        logger.info("[Phase 2/2] Transforming structured tasks to Socratic curriculum...")
        digest_str = digested_manual.model_dump_json(indent=2)
        curriculum_data = await self.legacy_transform_chain.ainvoke({
            "digest": digest_str,
            "format_instructions": JsonOutputParser(pydantic_object=SocraticCurriculum).get_format_instructions(),
        })
        
        if not curriculum_data:
            raise ValueError("LLM returned empty result")
        
        try:
            curriculum = SocraticCurriculum.model_validate(curriculum_data)
            phase2_elapsed = time.time() - phase2_start
            overall_elapsed = time.time() - overall_start
            logger.info(
                "[Phase 2/2] Socratic curriculum generation completed (phase2_elapsed=%.2fs, total_elapsed=%.2fs, steps=%d)",
                phase2_elapsed,
                overall_elapsed,
                curriculum.get_len()
            )
            return curriculum
        except ValidationError as e:
            logger.error("Schema validation failed in legacy mode: %s", e)
            raise ValueError(f"Invalid output format: {str(e)}") from e

    async def _generate_three_stage(self, lab_manual_content: str) -> SocraticCurriculum:
        """Three-stage generation: Technical Deconstruction -> Socratic Architecture -> Logical Critic."""
        overall_start = time.time()
        logger.info(
            "[Three-Stage Mode] Starting curriculum generation (output_lang=%s, critic=%s, loop=%s)",
            self.output_language,
            self.config.enable_critic,
            self.config.enable_loop
        )

        try:
            # Stage 1: Technical Deconstructor (with caching)
            stage1_start = time.time()
            logger.info("[Stage 1/3] Technical deconstruction...")
            
            # Try cache first
            dependency_map = None
            if self.cache:
                dependency_map = self.cache.get_dependency_map(lab_manual_content)
            
            if dependency_map is None:
                dependency_map_data = await self.technical_deconstructor_chain.ainvoke({
                    "lab_manual_content": lab_manual_content,
                    "format_instructions": JsonOutputParser(pydantic_object=DependencyMap).get_format_instructions(),
                })
                dependency_map = DependencyMap.model_validate(dependency_map_data)
                
                # Cache the result
                if self.cache:
                    self.cache.set_dependency_map(lab_manual_content, dependency_map)
            
            stage1_elapsed = time.time() - stage1_start
            logger.info(
                "[Stage 1/3] Technical deconstruction completed (elapsed=%.2fs, cached=%s, tasks=%d)",
                stage1_elapsed,
                dependency_map is not None and self.cache and self.cache.get_dependency_map(lab_manual_content) is not None,
                len(dependency_map.atomic_tasks) if dependency_map else 0
            )

            # Stage 2 & 3: Socratic Architecture with optional loop
            max_iterations = self.config.max_iterations if self.config.enable_loop else 1
            previous_suggestions = []

            for iteration in range(max_iterations):
                # Stage 2: Socratic Architect
                stage2_start = time.time()
                logger.info(
                    "[Stage 2/3] Socratic architecture (iteration %d/%d)...",
                    iteration + 1,
                    max_iterations
                )
                modification_suggestions = "\n".join(previous_suggestions) if previous_suggestions else ""
                
                curriculum_data = await self.socratic_architect_chain.ainvoke({
                    "dependency_map_json": dependency_map.model_dump_json(indent=2),
                    "modification_suggestions": modification_suggestions,
                    "format_instructions": JsonOutputParser(pydantic_object=SocraticCurriculum).get_format_instructions(),
                })
                
                if not curriculum_data:
                    raise ValueError("LLM returned empty result")
                
                curriculum = SocraticCurriculum.model_validate(curriculum_data)
                stage2_elapsed = time.time() - stage2_start
                logger.info(
                    "[Stage 2/3] Socratic architecture completed (iteration %d, elapsed=%.2fs, steps=%d)",
                    iteration + 1,
                    stage2_elapsed,
                    curriculum.get_len()
                )

                # Stage 3: Logical Critic (if enabled)
                if not self.config.enable_critic:
                    logger.info("[Stage 3/3] Critic disabled, returning curriculum")
                    return curriculum

                stage3_start = time.time()
                logger.info("[Stage 3/3] Logical critic review...")
                critic_data = await self.logical_critic_chain.ainvoke({
                    "curriculum_json": curriculum.model_dump_json(indent=2),
                    "dependency_map_json": dependency_map.model_dump_json(indent=2),
                    "format_instructions": JsonOutputParser(pydantic_object=CurriculumCriticResult).get_format_instructions(),
                })
                critic_result = CurriculumCriticResult.model_validate(critic_data)
                stage3_elapsed = time.time() - stage3_start
                logger.info(
                    "[Stage 3/3] Critic score: %d/10 (elapsed=%.2fs, answer_leak=%d, difficulty=%d, verifiability=%d)",
                    critic_result.overall_score,
                    stage3_elapsed,
                    critic_result.answer_leak_score,
                    critic_result.difficulty_gradient_score,
                    critic_result.verifiability_score
                )

                # Check for critical issues (early termination)
                if critic_result.critical_issues:
                    logger.warning(
                        "Critical issues detected: %s. Stopping optimization.",
                        critic_result.critical_issues
                    )
                    return curriculum  # Return current result, stop optimization

                # Check if score meets threshold
                if critic_result.overall_score >= self.config.critic_threshold:
                    logger.info(
                        "Curriculum generation passed critic check (score: %d)",
                        critic_result.overall_score
                    )
                    return curriculum

                # If not meeting threshold and loop enabled, prepare for next iteration
                if iteration < max_iterations - 1:
                    previous_suggestions = critic_result.suggestions
                    logger.info(
                        "Curriculum generation iteration %d failed (score: %d), retrying...",
                        iteration + 1,
                        critic_result.overall_score
                    )
                else:
                    logger.warning(
                        "Curriculum generation did not reach target score after %d iterations (score: %d)",
                        max_iterations,
                        critic_result.overall_score
                    )
                    return curriculum  # Return the last generated curriculum

            overall_elapsed = time.time() - overall_start
            logger.info(
                "[Three-Stage Mode] Curriculum generation completed (total_elapsed=%.2fs, iterations=%d, steps=%d)",
                overall_elapsed,
                iteration + 1,
                curriculum.get_len()
            )
            return curriculum

        except ValidationError as e:
            elapsed = time.time() - overall_start
            logger.error(
                "Schema validation failed in three-stage mode (elapsed=%.2fs): %s",
                elapsed,
                e
            )
            raise ValueError(f"Invalid output format: {str(e)}") from e
        except Exception as e:
            elapsed = time.time() - overall_start
            logger.error(
                "Generation failed in three-stage mode (elapsed=%.2fs): %s",
                elapsed,
                e,
                exc_info=True
            )
            raise RuntimeError(f"Failed to generate curriculum: {str(e)}") from e

    async def generate(self, lab_manual_content: str) -> SocraticCurriculum:
        """Execute the generation process to create final curriculum.

        This method supports both legacy two-stage and enhanced three-stage generation
        based on the configuration. The interface remains unchanged for backward compatibility.

        Args:
            lab_manual_content: The content of the lab manual.

        Returns:
            SocraticCurriculum object containing the final teaching curriculum.

        Raises:
            ValueError: If lab_manual_content is empty or invalid.
            RuntimeError: If curriculum generation fails.
        """
        # Input validation
        if not lab_manual_content or not lab_manual_content.strip():
            raise ValueError("lab_manual_content cannot be empty")
        
        if self.config.use_three_stage:
            return await self._generate_three_stage(lab_manual_content)
        else:
            return await self._generate_legacy(lab_manual_content)


if __name__ == "__main__":
    # Debug/example usage; run at root directory
    import config
    from dotenv import load_dotenv
    from langchain_deepseek import ChatDeepSeek

    load_dotenv()

    async def main():
        with open("./data/documents/ShellShock-Attack/lab_manual.md", "r", encoding="utf-8") as f:
            lab_manual_content = f.read()

        # Test with three-stage design
        generator = CurriculumGenerator(
            llm=ChatDeepSeek(model="deepseek-chat", temperature=config.TEMPERATURE),
            config=PRODUCTION_CONFIG
        )
        curriculum = await generator.generate(lab_manual_content)
        print(curriculum.model_dump_json(indent=2))  # Debug output

    asyncio.get_event_loop().run_until_complete(main())
