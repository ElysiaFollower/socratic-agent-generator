"""Persona generation module.

This module generates tutor persona information from lab manuals through a
three-stage process: Technical Analysis -> Creative Synthesis -> Consistency Critic.

Core Value: Transform static lab manuals into living tutor profiles with
personality, teaching style, and pedagogical alignment.
"""

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional

from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate

from pydantic import ValidationError

from config import DEFAULT_OUTPUT_LANGUAGE, MAX_INPUT_TOKENS, SUPPORTED_LANGUAGES
from schemas.definition import TutorPersona
from schemas.generator_intermediate import TechnicalAnalysis, CriticScore
from generators.cache import get_cache
from generators.config import GeneratorConfig, PRODUCTION_CONFIG

logger = logging.getLogger(__name__)


class PersonaGenerator:
    """Generate persona for tutor.

    This class generates persona information (persona_hints/target_audience)
    in JSON format from lab manual content.

    Supports both single-stage (legacy) and three-stage (enhanced) generation modes.
    The three-stage design embodies the core value of "creative empowerment":
    transforming static documents into living tutor profiles.
    """

    def __init__(
        self,
        llm: Any,
        config: Optional[GeneratorConfig] = None,
        output_language: str = DEFAULT_OUTPUT_LANGUAGE,
    ):
        """Initialize PersonaGenerator.

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
        self.output_parser = JsonOutputParser(pydantic_object=TutorPersona)
        self.cache = get_cache() if self.config.enable_cache else None
        
        # Legacy single-stage prompt (for backward compatibility)
        self.legacy_prompt = ChatPromptTemplate.from_messages([
            ("system",
             f"""<TASK>
You are an expert Instructional Designer and AI Persona Architect for a Socratic tutoring system. 
Your task is to analyze a raw technical lab manual and generate a complete, structured metadata file for it. 
You must infer all information, including a creative and fitting persona for the tutor.

**Your Responsibilities**:
1. **topic_name**: Create a clear, compelling title for the lab.
2. **target_audience**: Infer the intended audience (e.g., 'Beginners in Python', 'Advanced cybersecurity students') based on the manual's complexity, prerequisites, and tone.
3. **persona_hints**: Be creative. Invent an engaging persona that fits the lab's subject matter. For a hacking lab, a 'CTF champion' persona is great. For a data science lab, a 'data detective' might be fitting. Define their role, tone, style, and a catchphrase.
4. **domain_specific_constraints**: Identify crucial rules or ethical guidelines. For security labs, this is about ethics. For science labs, it could be about safety.

**Output Language**: All output must be in {self.output_language}.

**Output Requirements**:
- Produce a single JSON object that strictly follows the provided format instructions.
- Be insightful and creative.
</TASK>

<LAB_MANUAL>
{{lab_manual_content}}
</LAB_MANUAL>

<FORMAT_INSTRUCTIONS>
{{format_instructions}}
</FORMAT_INSTRUCTIONS>"""),
        ])
        self.legacy_chain = self.legacy_prompt | self.llm | self.output_parser

        # Three-stage prompts (for enhanced generation)
        if self.config.use_three_stage:
            self._init_three_stage_prompts()

    def _init_three_stage_prompts(self):
        """Initialize three-stage prompts."""
        # Stage 1: Technical Analyst
        technical_parser = JsonOutputParser(pydantic_object=TechnicalAnalysis)
        self.technical_analyst_prompt = ChatPromptTemplate.from_messages([
            ("system",
             f"""<TASK>
You are a senior instructional engineer specializing in technical content analysis. Your role is to objectively analyze a technical lab manual and extract core technical metadata, stripping away emotional elements.

**Your Responsibilities**:
1. **Knowledge Density Assessment**: Identify core concepts involved and their hierarchy.
2. **Target Audience Profile**: Infer the student's baseline competency requirements based on technical complexity.
3. **Hard Constraints**: Extract legal, ethical, and safety bottom lines.

**Output Requirements**:
- Be objective and technical. Do not include creative or stylistic elements at this stage.
- Focus on extractable, verifiable technical facts.
- Use structured analysis rather than narrative descriptions.
- All output must be in {self.output_language}.
</TASK>

<LAB_MANUAL>
{{lab_manual_content}}
</LAB_MANUAL>

<FORMAT_INSTRUCTIONS>
{{format_instructions}}
</FORMAT_INSTRUCTIONS>"""),
        ])
        self.technical_analyst_chain = self.technical_analyst_prompt | self.llm | technical_parser

        # Stage 2: Creative Director
        self.creative_director_prompt = ChatPromptTemplate.from_messages([
            ("system",
             f"""<TASK>
You are a creative character design master specializing in educational AI personas. Your mission is to **bring a static lab manual to life** by creating a unique, engaging, and memorable AI tutor persona.

**Your Creative Mission**:
Transform the technical analysis below into a **living, breathing tutor** with personality, style, and teaching charisma. This is not just information extraction—this is **character creation** and **identity synthesis**.

**Design Requirements**:
1. **Roleplay Creation**: Do not just be a generic "teacher". **Create** a specific, memorable role that fits the lab's subject matter (e.g., "Penetration Testing Team Leader" for security labs, "Genetic Engineering Researcher" for biology labs). Give this persona a **backstory** and **professional identity**.
2. **Style Definition**: **Invent** unique catchphrases, response tendencies (e.g., rigorous, humorous, challenging), and communication patterns that make this tutor memorable and engaging.
3. **Tone Adaptation**: **Craft** the tone depth based on the target audience profile from the technical analysis, ensuring the persona resonates with students.

**Creative Constraints**:
- Ensure the persona is engaging while maintaining pedagogical effectiveness.
- The persona should **inspire** students and make learning enjoyable.
- Maintain alignment with Socratic teaching principles (guiding, not giving direct answers).
- **Remember**: You are creating a **character**, not just extracting information. Be creative, be memorable, be engaging.

**Output Language**: All output must be in {self.output_language}.
</TASK>

<TECHNICAL_ANALYSIS>
{{technical_analysis_json}}
</TECHNICAL_ANALYSIS>

<LAB_MANUAL_SUMMARY>
{{lab_manual_summary}}
</LAB_MANUAL_SUMMARY>

<MODIFICATION_SUGGESTIONS>
{{modification_suggestions}}
</MODIFICATION_SUGGESTIONS>

<FORMAT_INSTRUCTIONS>
{{format_instructions}}
</FORMAT_INSTRUCTIONS>"""),
        ])
        self.creative_director_chain = self.creative_director_prompt | self.llm | self.output_parser

        # Stage 3: Consistency Critic
        if self.config.enable_critic:
            critic_parser = JsonOutputParser(pydantic_object=CriticScore)
            self.consistency_critic_prompt = ChatPromptTemplate.from_messages([
                ("system",
                 f"""<TASK>
You are a pedagogical quality monitoring expert. Review the generated Persona and check for the following issues:

1. **Adaptability**: Does the persona conflict with the lab's seriousness? (e.g., overly casual tone in nuclear safety labs)
2. **Safety**: Are constraint conditions complete enough to prevent misuse?
3. **Executability**: Will the persona requirements cause the LLM to be too immersed in roleplay and forget teaching tasks?
4. **Socratic Alignment**: Will the persona maintain the persona and directly give answers? (Should reject)

**Output Requirements**:
- Output a score (1-10) for each dimension and overall score, along with modification suggestions.
- All output must be in {self.output_language}.
</TASK>

<GENERATED_PERSONA>
{{persona_json}}
</GENERATED_PERSONA>

<TECHNICAL_ANALYSIS>
{{technical_analysis_json}}
</TECHNICAL_ANALYSIS>

<FORMAT_INSTRUCTIONS>
{{format_instructions}}
</FORMAT_INSTRUCTIONS>"""),
            ])
            self.consistency_critic_chain = self.consistency_critic_prompt | self.llm | critic_parser

    def _create_excerpt(self, content: str, max_chars: int = 4000) -> str:
        """Creates an excerpt of the content to avoid exceeding token limits."""
        if len(content) <= max_chars:
            return content
        # Combine the beginning and end, which are often the most info-rich parts.
        return content[:max_chars//2] + "\n\n... (content truncated) ...\n\n" + content[-max_chars//2:]

    async def _generate_legacy(self, lab_manual_content: str) -> TutorPersona:
        """Legacy single-stage generation (for backward compatibility)."""
        start_time = time.time()
        logger.info(
            "[Legacy Mode] Analyzing lab manual to generate definition.json (output_lang=%s)",
            self.output_language
        )
        content_excerpt = self._create_excerpt(
            lab_manual_content, max_chars=MAX_INPUT_TOKENS - 1000
        )

        try:
            generated_data = await self.legacy_chain.ainvoke({
                "lab_manual_content": content_excerpt,
                "format_instructions": self.output_parser.get_format_instructions(),
            })
            result = TutorPersona.model_validate(generated_data)
            elapsed = time.time() - start_time
            logger.info(
                "[Legacy Mode] Definition generated successfully (elapsed=%.2fs, topic=%s)",
                elapsed,
                result.topic_name[:50] if result.topic_name else "N/A"
            )
            return result
        except ValidationError as e:
            logger.error("Schema validation failed in legacy mode: %s", e)
            raise ValueError(f"Invalid output format: {str(e)}") from e
        except Exception as e:
            logger.error("Generation failed in legacy mode: %s", e, exc_info=True)
            raise RuntimeError(f"Failed to generate definition: {str(e)}") from e

    async def _generate_three_stage(self, lab_manual_content: str) -> TutorPersona:
        """Three-stage generation: Technical Analysis -> Creative Synthesis -> Consistency Critic."""
        overall_start = time.time()
        logger.info(
            "[Three-Stage Mode] Starting persona generation (output_lang=%s, critic=%s, loop=%s)",
            self.output_language,
            self.config.enable_critic,
            self.config.enable_loop
        )
        content_excerpt = self._create_excerpt(
            lab_manual_content, max_chars=MAX_INPUT_TOKENS - 1000
        )

        try:
            # Stage 1: Technical Analyst (with caching)
            stage1_start = time.time()
            logger.info("[Stage 1/3] Technical analysis...")
            
            # Try cache first
            technical_analysis = None
            if self.cache:
                technical_analysis = self.cache.get_technical_analysis(lab_manual_content)
            
            if technical_analysis is None:
                technical_analysis_data = await self.technical_analyst_chain.ainvoke({
                    "lab_manual_content": content_excerpt,
                    "format_instructions": JsonOutputParser(pydantic_object=TechnicalAnalysis).get_format_instructions(),
                })
                technical_analysis = TechnicalAnalysis.model_validate(technical_analysis_data)
                
                # Cache the result
                if self.cache:
                    self.cache.set_technical_analysis(lab_manual_content, technical_analysis)
            
            stage1_elapsed = time.time() - stage1_start
            logger.info(
                "[Stage 1/3] Technical analysis completed (elapsed=%.2fs, cached=%s, constraints=%d)",
                stage1_elapsed,
                technical_analysis is not None and self.cache and self.cache.get_technical_analysis(lab_manual_content) is not None,
                len(technical_analysis.hard_constraints) if technical_analysis else 0
            )

            # Stage 2 & 3: Creative Synthesis with optional loop
            max_iterations = self.config.max_iterations if self.config.enable_loop else 1
            previous_suggestions = []

            for iteration in range(max_iterations):
                # Stage 2: Creative Director
                stage2_start = time.time()
                logger.info(
                    "[Stage 2/3] Creative synthesis (iteration %d/%d)...",
                    iteration + 1,
                    max_iterations
                )
                modification_suggestions = "\n".join(previous_suggestions) if previous_suggestions else ""
                
                persona_data = await self.creative_director_chain.ainvoke({
                    "technical_analysis_json": technical_analysis.model_dump_json(indent=2),
                    "lab_manual_summary": content_excerpt[:500],  # Summary for context
                    "modification_suggestions": modification_suggestions,
                    "format_instructions": self.output_parser.get_format_instructions(),
                })
                persona = TutorPersona.model_validate(persona_data)
                stage2_elapsed = time.time() - stage2_start
                logger.info(
                    "[Stage 2/3] Creative synthesis completed (iteration %d, elapsed=%.2fs, topic=%s)",
                    iteration + 1,
                    stage2_elapsed,
                    persona.topic_name[:50] if persona.topic_name else "N/A"
                )

                # Stage 3: Consistency Critic (if enabled)
                if not self.config.enable_critic:
                    logger.info("[Stage 3/3] Critic disabled, returning persona")
                    return persona

                stage3_start = time.time()
                logger.info("[Stage 3/3] Consistency critic review...")
                critic_data = await self.consistency_critic_chain.ainvoke({
                    "persona_json": persona.model_dump_json(indent=2),
                    "technical_analysis_json": technical_analysis.model_dump_json(indent=2),
                    "format_instructions": JsonOutputParser(pydantic_object=CriticScore).get_format_instructions(),
                })
                critic_result = CriticScore.model_validate(critic_data)
                stage3_elapsed = time.time() - stage3_start
                logger.info(
                    "[Stage 3/3] Critic score: %d/10 (elapsed=%.2fs, adaptability=%d, safety=%d, executability=%d, socratic=%d)",
                    critic_result.overall_score,
                    stage3_elapsed,
                    critic_result.adaptability_score,
                    critic_result.safety_score,
                    critic_result.executability_score,
                    critic_result.socratic_alignment_score
                )

                # Check for critical issues (early termination)
                if critic_result.critical_issues:
                    logger.warning(
                        "Critical issues detected: %s. Stopping optimization.",
                        critic_result.critical_issues
                    )
                    return persona  # Return current result, stop optimization

                # Check if score meets threshold
                if critic_result.overall_score >= self.config.critic_threshold:
                    logger.info(
                        "Persona generation passed critic check (score: %d)",
                        critic_result.overall_score
                    )
                    return persona

                # If not meeting threshold and loop enabled, prepare for next iteration
                if iteration < max_iterations - 1:
                    previous_suggestions = critic_result.suggestions
                    logger.info(
                        "Persona generation iteration %d failed (score: %d), retrying...",
                        iteration + 1,
                        critic_result.overall_score
                    )
                else:
                    logger.warning(
                        "Persona generation did not reach target score after %d iterations (score: %d)",
                        max_iterations,
                        critic_result.overall_score
                    )
                    return persona  # Return the last generated persona

            overall_elapsed = time.time() - overall_start
            logger.info(
                "[Three-Stage Mode] Persona generation completed (total_elapsed=%.2fs, iterations=%d)",
                overall_elapsed,
                iteration + 1
            )
            return persona

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
            raise RuntimeError(f"Failed to generate definition: {str(e)}") from e

    async def generate(self, lab_manual_content: str) -> TutorPersona:
        """Generate persona information for tutor from lab manual content.

        This method supports both legacy single-stage and enhanced three-stage generation
        based on the configuration. The interface remains unchanged for backward compatibility.

        Args:
            lab_manual_content: The content of the lab manual.

        Returns:
            TutorPersona object containing the generated persona.

        Raises:
            ValueError: If lab_manual_content is empty or invalid.
            RuntimeError: If persona generation fails.
        """
        # Input validation
        if not lab_manual_content or not lab_manual_content.strip():
            raise ValueError("lab_manual_content cannot be empty")
        
        if self.config.use_three_stage:
            return await self._generate_three_stage(lab_manual_content)
        else:
            return await self._generate_legacy(lab_manual_content)


if __name__ == "__main__":
    # Debug/example usage; run at the root directory
    import config
    from dotenv import load_dotenv
    from langchain_deepseek import ChatDeepSeek

    load_dotenv()

    async def main():
        with open("./data/documents/ShellShock-Attack/lab_manual.md", "r", encoding="utf-8") as f:
            lab_manual_content = f.read()

        # Test with three-stage design
        generator = PersonaGenerator(
            llm=ChatDeepSeek(model="deepseek-chat", temperature=config.TEMPERATURE),
            config=PRODUCTION_CONFIG
        )
        definition = await generator.generate(lab_manual_content)
        print(definition.model_dump_json(indent=2))  # Debug output

    asyncio.get_event_loop().run_until_complete(main())
