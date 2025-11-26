from typing import Any
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))
from config import LESSON_DOMAIN
from schemas.curriculum import SocraticCurriculum
from schemas.others import DigestedManual

class OutlineAgent:
    """
    An agent that transforms a structured document into a Socratic curriculum.
    """
    def __init__(self, llm: Any):
        """
        Initializes the OutlineAgent.

        Args:
            llm: The language model to use for transforming the document.
        """
        self.llm = llm

    async def transform_to_socratic_curriculum(self, digest: DigestedManual) -> SocraticCurriculum:
        """
        Transforms a structured task list into a Socratic teaching curriculum.

        Args:
            digest: The structured task list.

        Returns:
            A SocraticCurriculum object representing the transformed curriculum.

        Raises:
            RuntimeError: If the document processing fails.
        """
        print("⏳ [Phase 2/2] Transforming structured tasks into a Socratic curriculum...")

        try:
            digest_str = digest.model_dump_json(indent=2)

            parser = JsonOutputParser(pydantic_object=SocraticCurriculum)

            prompt = ChatPromptTemplate.from_messages([
                ("system",
                "You are a top-tier instructional designer, specializing in the Socratic method and " + LESSON_DOMAIN + " education."
                "Your task is to convert a structured list of lab tasks into a complete, pedagogically-rich set of Socratic learning nodes."
                "Your teaching style should adhere to the following principles:"
                "1. **Concept First, Simple to Complex**: Explain core concepts with accessible analogies before introducing specific operations."
                "2. **Inquiry-Based Questions**: Each step should not be a simple command, but should include a question that guides student thinking (e.g., 'What consequences do you think tampering with this 'return address' will have?')."
                "3. **Logical Connection**: Steps should have clear causal and logical relationships, helping students understand the 'why' behind their actions."
                "4. **Focus on the Core**: Naturally integrate task objectives and key technical points into the dialogue."
                "5. **Complete Loop**: Create a complete learning cycle, from introducing the background and theory, to hands-on practice, and finally to summarizing and prevention."
                "Strictly follow the JSON format specified in {format_instructions} for your output."),
                ("user",
                "Here is the structured list of lab tasks. Please design the curriculum based on it:\n\n{digest}")
            ])

            chain = prompt | self.llm | parser

            format_instructions = parser.get_format_instructions()
            result = await chain.ainvoke({
                "digest": digest_str,
                "format_instructions": format_instructions,
            })

            result = SocraticCurriculum.model_validate(result)
            print("✅ [Phase 2/2] Socratic curriculum generation complete.")
            return result
        except Exception as e:
            raise RuntimeError(f"Document processing failed: {str(e)}") from e
