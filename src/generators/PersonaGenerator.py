"""Persona generation module.

This module generates tutor persona information from lab manuals.
"""

import asyncio
import logging
from typing import Any, Dict, List

from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate

from config import MAX_INPUT_TOKENS
from schemas.definition import TutorPersona

logger = logging.getLogger(__name__)

class PersonaGenerator:
    """Generate persona for tutor.

    This class generates persona information (persona_hints/target_audience)
    in JSON format from lab manual content.
    """
    def __init__(self, llm: Any):
        self.llm = llm
        self.output_parser = JsonOutputParser(pydantic_object=TutorPersona)
        self.prompt = ChatPromptTemplate.from_messages([
            ("system",
             "You are an expert Instructional Designer and AI Persona Architect for a Socratic tutoring system. "
             "Your task is to analyze a raw technical lab manual and generate a complete, structured metadata file for it. "
             "You must infer all information, including a creative and fitting persona for the tutor.\n\n"
             "Analyze the provided lab manual to determine the following:\n"
             "1.  **topic_name**: Create a clear, compelling title for the lab.\n"
             "2.  **target_audience**: Infer the intended audience (e.g., 'Beginners in Python', 'Advanced cybersecurity students') based on the manual's complexity, prerequisites, and tone.\n"
             "3.  **persona_hints**: Be creative. Invent an engaging persona that fits the lab's subject matter. For a hacking lab, a 'CTF champion' persona is great. For a data science lab, a 'data detective' might be fitting. Define their role, tone, style, and a catchphrase.\n"
             "4.  **domain_specific_constraints**: Identify crucial rules or ethical guidelines. For security labs, this is about ethics. For science labs, it could be about safety.\n\n"
             "Produce a single JSON object that strictly follows the provided format instructions:\"{format_instructions}\". Be insightful and creative."),
            ("user",
             "Here is the lab manual. Please analyze it and generate the complete definition metadata.\n\n"
             "<lab_manual>\n"
             "{lab_manual_content}\n"
             "</lab_manual>")
        ])
        self.chain = self.prompt | self.llm | self.output_parser
        
    def _create_excerpt(self, content: str, max_chars: int = 4000) -> str:
        """Creates an excerpt of the content to avoid exceeding token limits."""
        if len(content) <= max_chars:
            return content
        # Combine the beginning and end, which are often the most info-rich parts.
        return content[:max_chars//2] + "\n\n... (content truncated) ...\n\n" + content[-max_chars//2:]

 
    async def generate(self, lab_manual_content: str) -> TutorPersona:
        """Generate persona information for tutor from lab manual content.

        Only the beginning and ending slice of the content will be used to
        avoid exceeding token limits. Generates information about what kind
        of persona the tutor is, who they are trying to teach, and what
        main concepts they will teach.

        Args:
            lab_manual_content: The content of the lab manual.

        Returns:
            TutorPersona object containing the generated persona.

        Raises:
            RuntimeError: If persona generation fails.
        """
        logger.info("Analyzing lab manual to generate definition.json...")
        content_excerpt = self._create_excerpt(
            lab_manual_content, max_chars=MAX_INPUT_TOKENS - 1000
        )

        try:
            generated_data = await self.chain.ainvoke(
                {
                    "lab_manual_content": content_excerpt,
                    "format_instructions": self.output_parser.get_format_instructions(),
                }
            )
            result = TutorPersona.model_validate(generated_data)
            logger.info("Definition generated successfully")
            return result
        except Exception as e:
            raise RuntimeError(f"Failed to generate definition: {str(e)}") from e
        
if __name__ == "__main__":
    # Debug/example usage; run at the root directory
    import config
    from dotenv import load_dotenv
    from langchain_deepseek import ChatDeepSeek

    load_dotenv()

    async def main():
        with open("./data_raw/ShellShock-Attack/lab_manual.md", "r", encoding="utf-8") as f:
            lab_manual_content = f.read()

        generator = PersonaGenerator(
            llm=ChatDeepSeek(model="deepseek-chat", temperature=config.TEMPERATURE)
        )
        definition = await generator.generate(lab_manual_content)
        print(definition.model_dump_json(indent=2))  # Debug output

    asyncio.get_event_loop().run_until_complete(main())
    