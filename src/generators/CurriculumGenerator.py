from typing import Any
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))
from schemas.curriculum import SocraticCurriculum
from agents.reader_agent import ReaderAgent
from agents.outline_agent import OutlineAgent
import asyncio

class CurriculumGenerator:
    """
    Orchestrates the process of generating a Socratic curriculum from a lab manual.
    It uses a two-phase process: Digest -> Transform, handled by ReaderAgent and
    OutlineAgent respectively.
    """
    def __init__(self, llm: Any):
        """
        Initializes the CurriculumGenerator.

        Args:
            llm: The language model to use for the agents.
        """
        self.reader_agent = ReaderAgent(llm)
        self.outline_agent = OutlineAgent(llm)

    async def generate(self, lab_manual_content: str) -> SocraticCurriculum:
        """
        Executes the full two-phase process to generate the curriculum.

        Args:
            lab_manual_content: The content of the lab manual.

        Returns:
            A SocraticCurriculum object representing the generated curriculum.
        """
        digested_manual = await self.reader_agent.digest_document(lab_manual_content)
        curriculum = await self.outline_agent.transform_to_socratic_curriculum(digested_manual)
        return curriculum

if __name__ == "__main__":
    async def main():
        """
        Example usage of the CurriculumGenerator.
        """
        with open("./data_raw/ShellShock-Attack/lab_manual.md", "r") as f:
            lab_manual_content = f.read()
        
        from langchain_deepseek import ChatDeepSeek
        import config
        from dotenv import load_dotenv
        load_dotenv()
        
        generator = CurriculumGenerator(llm=ChatDeepSeek(model="deepseek-chat", temperature=config.TEMPERATURE))
        curriculum = await generator.generate(lab_manual_content)
        print(curriculum.model_dump_json(indent=2))
        
    asyncio.run(main())
