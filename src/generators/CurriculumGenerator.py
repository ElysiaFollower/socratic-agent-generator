"""Curriculum generation module.

This module generates Socratic curriculum from lab manuals through a
two-phase process: Digest -> Transform.
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional

from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import ChatPromptTemplate

from config import LESSON_DOMAIN
from schemas.curriculum import SocraticCurriculum
from schemas.others import DigestedManual

logger = logging.getLogger(__name__)

class CurriculumGenerator:
    """Generates Socratic curriculum from lab manuals.

    This agent reads lab manuals and generates Socratic teaching curriculum
    through a two-phase process: Digest -> Transform.
    """
    def __init__(self, llm: Any):
        self.llm = llm

    async def _digest_document(self, lab_manual_content: str) -> DigestedManual:
        """Phase 1: Document parsing and structuring (The "Reader" Agent).

        Transforms raw document into structured DigestedManual object.

        Args:
            lab_manual_content: The content of the lab manual.

        Returns:
            DigestedManual object containing structured tasks.

        Raises:
            RuntimeError: If document processing fails.
        """
        logger.info("[Phase 1/2] Parsing and structuring lab document...")
        
        parser = JsonOutputParser(pydantic_object=DigestedManual)
        
        prompt = ChatPromptTemplate.from_messages([
            ("system",
             "你是一位经验丰富且专业细心的"+ LESSON_DOMAIN +"实验助教。"
             "你的任务是仔细阅读实验手册，并将其内容分解为一系列逻辑清晰、循序渐进的任务步骤。"
             "请专注于提取操作性的、可验证的任务，忽略背景介绍、客套话等非核心内容。"
             "你需要严格按照\"{format_instructions}\"指定的JSON格式进行输出。"),
            ("user", 
             "这是实验手册的内容，请开始分析：\n\n<lab_manual>\n{lab_manual}\n</lab_manual>")
        ])

        chain = prompt | self.llm | parser
        
        try:
            digest_json = await chain.ainvoke({
                "lab_manual": lab_manual_content,
                "format_instructions": parser.get_format_instructions(),
            })
            
            result = DigestedManual.model_validate(digest_json)
            logger.info("[Phase 1/2] Document structuring completed.")
            return result

        except Exception as e:
            raise RuntimeError(f"Document processing failed: {str(e)}") from e
            

    async def _transform_to_socratic_curriculum(
        self, digest: DigestedManual
    ) -> SocraticCurriculum:
        """Phase 2: Socratic transformation and refinement (The "Tutor" Agent).

        Transforms structured task list into Socratic teaching curriculum.

        Args:
            digest: DigestedManual object containing structured tasks.

        Returns:
            SocraticCurriculum object containing the teaching curriculum.

        Raises:
            RuntimeError: If curriculum transformation fails.
        """
        logger.info("[Phase 2/2] Transforming structured tasks to Socratic curriculum...")
        
        try:
            # 为了让LLM更好地理解，我们将Pydantic对象转回JSON字符串作为上下文
            digest_str = digest.model_dump_json(indent=2)

            parser = JsonOutputParser(pydantic_object=SocraticCurriculum)

            prompt = ChatPromptTemplate.from_messages([
                ("system",
                "你是一位顶级的教学设计师，尤其精通苏格拉底教学法和" + LESSON_DOMAIN + "教育。"
                "你的任务是将一份结构化的实验任务列表，转化为一套完整的、富含教学元信息的苏格拉底教学节点。"
                "你的教学风格应该遵循以下原则："
                "1. **概念先行，由浅入深**：在介绍具体操作前，先用通俗的比喻解释核心概念。"
                "2. **启发式提问**：每个步骤不应是简单的命令，而应包含一个引导学生思考的问题（例如：'你认为篡改这个‘返回地址’会带来什么后果？'）。"
                "3. **串联逻辑**：步骤之间应该有明确的因果和逻辑关系，让学生理解“为什么”要这么做。"
                "4. **聚焦核心**：将任务目标和关键技术点自然地融入到对话中。"
                "5. **完整闭环**：从介绍背景、理论铺垫，到动手实践，再到最后的总结防范，形成一个完整的学习闭环。\n\n"
                "**重要要求**：\n"
                "- 必须为列表中的**每一个**步骤生成完整的字段：`step_title`, `guiding_question`, `success_criteria`, `learning_objective`。\n"
                "- 严禁遗漏任何字段，即使内容相似也要保持结构完整。\n"
                "- 请严格按照{format_instructions}指定的JSON格式输出。"),
                ("user",
                "这是结构化的实验任务列表，请根据它设计教学大纲：\n\n{digest}")
            ])
            
            chain = prompt | self.llm | parser
            
            format_instructions = parser.get_format_instructions()
            result = await chain.ainvoke({
                "digest": digest_str,
                "format_instructions": format_instructions,
            })

            if not result:
                raise ValueError("LLM returned empty result")
                
            result = SocraticCurriculum.model_validate(result)
            logger.info("[Phase 2/2] Socratic curriculum generation completed.")
            return result
        except Exception as e:
            raise RuntimeError(f"Document processing failed: {str(e)}") from e
       

    async def generate(self, lab_manual_content: str) -> SocraticCurriculum:
        """Execute the complete two-phase process to generate final curriculum.

        Args:
            lab_manual_content: The content of the lab manual.

        Returns:
            SocraticCurriculum object containing the final teaching curriculum.
        """
        # Phase 1: Extract and structure information
        digested_manual = await self._digest_document(lab_manual_content)

        # Phase 2: Transform structured information into Socratic curriculum
        curriculum = await self._transform_to_socratic_curriculum(digested_manual)

        return curriculum
    
if __name__ == "__main__":
    # Debug/example usage; run at root directory
    import config
    from dotenv import load_dotenv
    from langchain_deepseek import ChatDeepSeek

    load_dotenv()

    async def main():
        with open("./data/documents/ShellShock-Attack/lab_manual.md", "r", encoding="utf-8") as f:
            lab_manual_content = f.read()

        generator = CurriculumGenerator(
            llm=ChatDeepSeek(model="deepseek-chat", temperature=config.TEMPERATURE)
        )
        curriculum = await generator.generate(lab_manual_content)
        print(curriculum.model_dump_json(indent=2))  # Debug output

    asyncio.get_event_loop().run_until_complete(main())
