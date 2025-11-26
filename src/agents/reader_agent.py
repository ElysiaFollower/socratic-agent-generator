from typing import Any
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))
from config import LESSON_DOMAIN
from schemas.curriculum import SocraticCurriculum
from schemas.others import DigestedManual

class ReaderAgent:
    """
    An agent that reads a lab manual and digests it into a structured format.
    """
    def __init__(self, llm: Any):
        """
        Initializes the ReaderAgent.

        Args:
            llm: The language model to use for digesting the document.
        """
        self.llm = llm

    async def digest_document(self, lab_manual_content: str) -> DigestedManual:
        """
        Digests the lab manual content into a structured DigestedManual object.

        Args:
            lab_manual_content: The content of the lab manual.

        Returns:
            A DigestedManual object representing the structured content.

        Raises:
            RuntimeError: If the document processing fails.
        """
        print("⏳ [Phase 1/2] Digesting and structuring the lab manual...")

        parser = JsonOutputParser(pydantic_object=DigestedManual)

        prompt = ChatPromptTemplate.from_messages([
            ("system",
             "You are an experienced and meticulous " + LESSON_DOMAIN + " lab assistant. "
             "Your task is to carefully read the lab manual and break down its content into a series of logical, sequential task steps. "
             "Focus on extracting actionable, verifiable tasks, ignoring background information, formalities, and other non-essential content. "
             "You must strictly follow the JSON format specified in \"{format_instructions}\" for your output."),
            ("user",
             "Here is the lab manual content, please begin the analysis:\n\n<lab_manual>\n{lab_manual}\n</lab_manual>")
        ])

        chain = prompt | self.llm | parser

        try:
            digest_json = await chain.ainvoke({
                "lab_manual": lab_manual_content,
                "format_instructions": parser.get_format_instructions(),
            })

            result = DigestedManual.model_validate(digest_json)
            print("✅ [Phase 1/2] Document structuring complete.")
            return result

        except Exception as e:
            raise RuntimeError(f"Document processing failed: {str(e)}") from e
