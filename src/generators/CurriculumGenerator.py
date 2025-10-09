from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

# --- LangChain & LLM ---
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))
from config import LESSON_DOMAIN

import asyncio

# ----------------------------------------------------------------
# 1. 定义数据结构 
# ----------------------------------------------------------------

# 整理实验文档的结构
class Task(BaseModel):
    """单个实验任务的结构化摘要"""
    task_title: str = Field(description="任务的标题，例如 '熟悉 Shellcode' 或 '编译与侦察'")
    objective: str = Field(description="该任务的核心学习目标或挑战，用一句话高度总结。")
    key_elements: List[str] = Field(
        description="完成该任务所涉及的关键技术、命令、函数或概念的列表。例如：['-fno-stack-protector', 'gdb', 'EIP/RIP']"
    )
    
class DigestedManual(BaseModel):
    """实验手册的完整结构化摘要"""
    overall_goal: str = Field(description="整个实验最终要达成的总体目标。")
    tasks: List[Task] = Field(description="按顺序排列的、构成整个实验的所有核心任务列表。")


# 输出教学大纲的结构
class SocraticStep(BaseModel):
    """
    富信息的苏格拉底教学节点
    """
    step_title: str = Field(description="这一步骤的简短标题，例如：'关闭栈保护'或'定位返回地址'")
    
    # --- Human-Facing Channel ---
    guiding_question: str = Field(
        description="[对人] 用于奠定该步骤总基调，启发学生思考的生动的苏格拉底式提问"
    )
    
    # --- Machine-Facing Channel ---
    success_criteria: str = Field(
        description="[对机器] 用于评估该步骤完成，明确的成功标准。例如: '学生需要描述出EIP寄存器的作用'"
    )
    
    # --- 其它元数据 ---
    learning_objective: str = Field(
        description="学生在该步骤的学习中应该掌握的核心知识点"
    )
    
class SocraticCurriculum(BaseModel):
    """最终生成的完整苏格拉底教学大纲"""
    curriculum: List[SocraticStep] = Field(description="按顺序排列的、构成整个实验的所有富信息教学节点。")


# ----------------------------------------------------------------
# 2. 定义核心生成逻辑
# ----------------------------------------------------------------

class CurriculumGenerator:
    """
    一个能够读取实验文档并生成苏格拉底教学大纲的智能体。
    它通过一个两阶段的流程来实现：Digest -> Transform。
    """
    def __init__(self, llm: Any):
        self.llm = llm

    async def _digest_document(self, lab_manual_content: str) -> DigestedManual:
        """
        阶段一：文档解析与结构化 (The "Reader" Agent)
        将原始文档转化为结构化的DigestedManual对象。
        """
        print("⏳ [阶段1/2] 正在解析与结构化实验文档...")
        
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
            print("✅ [阶段1/2] 文档结构化完成。")
            return result
        
        except Exception as e:
            raise RuntimeError(f"文档处理失败: {str(e)}") from e
            

    async def _transform_to_socratic_curriculum(self, digest: DigestedManual) -> SocraticCurriculum:
        """
        阶段二：苏格拉底式转化与精炼 (The "Tutor" Agent)
        将结构化的任务列表，转化为循循善诱的教学大纲。
        """
        print("⏳ [阶段2/2] 正在将结构化任务转化为苏格拉底教学大纲...")
        
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
                "5. **完整闭环**：从介绍背景、理论铺垫，到动手实践，再到最后的总结防范，形成一个完整的学习闭环。"
                "请严格按照{format_instructions}指定的JSON格式输出"),
                ("user",
                "这是结构化的实验任务列表，请根据它设计教学大纲：\n\n{digest}")
            ])
            
            chain = prompt | self.llm | parser
            
            format_instructions = parser.get_format_instructions()
            result = await chain.ainvoke({
                "digest": digest_str,
                "format_instructions": format_instructions,
            })

            result = SocraticCurriculum.model_validate(result)
            print("✅ [阶段2/2] 苏格拉底教学大纲生成完毕。")
            return result
        except Exception as e:
            raise RuntimeError(f"文档处理失败: {str(e)}") from e
       

    async def generate(self, lab_manual_content: str) -> SocraticCurriculum:
        """
        执行完整的两阶段流程，生成最终的教学大纲。
        """
        # 阶段一：提炼和结构化信息
        digested_manual = await self._digest_document(lab_manual_content)
        
        # 阶段二：将结构化信息转化为苏格拉底教学大纲
        curriculum = await self._transform_to_socratic_curriculum(digested_manual)
        
        return curriculum
    
if __name__ == "__main__":
    # example usages, run at root directory
    async def main():
        with open("./data_raw/seed_buffer_overflow/lab_manual.md", "r") as f:
            lab_manual_content = f.read()
        
        from langchain_deepseek import ChatDeepSeek
        import config
        from dotenv import load_dotenv
        load_dotenv()
        
        generator = CurriculumGenerator(llm = ChatDeepSeek(model="deepseek-chat", temperature=config.TEMPERATURE))
        curriculum = await generator.generate(lab_manual_content)
        print(curriculum.model_dump_json(indent=2))
        
    asyncio.get_event_loop().run_until_complete(main())