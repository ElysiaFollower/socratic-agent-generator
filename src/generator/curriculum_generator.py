from typing import List, Dict, Any
from pydantic import BaseModel, Field

# --- LangChain & LLM ---
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_deepseek import ChatDeepSeek

# ----------------------------------------------------------------
# 1. 定义数据结构 (使用Pydantic保证精密专业)
# ----------------------------------------------------------------

class DigestedTask(BaseModel):
    """单个任务的结构化摘要"""
    task_id: str = Field(description="任务编号，例如 '0.', '1.'")
    task_title: str = Field(description="任务的标题，例如 '熟悉 Shellcode'")
    objective: str = Field(description="该任务的核心学习目标或挑战，一句话总结")
    key_elements: List[str] = Field(description="任务中提到的关键技术、命令或概念列表")

class DigestedManual(BaseModel):
    """整个实验文档的结构化摘要"""
    overall_goal: str = Field(description="整个实验的最终目标")
    tasks: List[DigestedTask] = Field(description="从文档中提取的所有任务的列表")


# ----------------------------------------------------------------
# 2. 定义核心生成逻辑
# ----------------------------------------------------------------

class CurriculumGenerator:
    """
    一个能够读取实验文档并生成苏格拉底教学大纲的智能体。
    """
    def __init__(self, llm: Any):
        self.llm = llm

    def _digest_document(self, lab_manual_content: str) -> DigestedManual:
        """
        阶段一：文档解析与结构化 (The "Reader" Agent)
        """
        print("⏳ [阶段1/3] 正在解析与摘要化实验文档...")
        
        parser = JsonOutputParser(pydantic_object=DigestedManual)
        
        prompt = ChatPromptTemplate.from_template(
            """
            你是一位顶级的计算机实验助教。你的任务是仔细阅读并解析以下实验文档，并严格按照JSON格式提取核心信息。

            {format_instructions}

            --- 实验文档开始 ---
            {lab_manual}
            --- 实验文档结束 ---
            """
        )

        chain = prompt | self.llm | parser
        
        digest = chain.invoke({
            "lab_manual": lab_manual_content,
            "format_instructions": parser.get_format_instructions()
        })
        
        print("✅ [阶段1/3] 文档摘要完成。")
        # TODO: 确认一下这里接口的变化
        return DigestedManual.model_validate(digest)
        #return DigestedManual.parse_obj(digest)

    def _transform_to_socratic_curriculum(self, digest: DigestedManual) -> List[str]:
        """
        阶段二与阶段三：苏格拉底式转化与精炼 (未来实现)
        """
        print("⏳ [阶段2&3/3] 正在将摘要转化为苏格拉底教学大纲...")
        # 在这里，我们将设计一个更强大的链，它会遍历 digest.tasks,
        # 并应用预定义的苏格拉底式智能体设计原则来生成每一步。
        #
        # 为了让第一版能跑通，我们暂时使用一个简单的占位逻辑。
        
        final_curriculum = []
        step_counter = 1
        
        # 添加一个开场白
        final_curriculum.append(f"{step_counter}. 实验介绍与目标：你好！本次实验的目标是 '{digest.overall_goal}'。让我们开始吧！")
        step_counter += 1

        for task in digest.tasks:
            final_curriculum.append(f"{step_counter}. {task.task_id} - {task.task_title}: 让我们来完成这个任务，它的目标是'{task.objective}'。")
            step_counter += 1

        print("✅ [阶段2&3/3] 教学大纲初步生成。")
        return final_curriculum

    def generate(self, lab_manual_content: str) -> List[str]:
        """
        执行完整的三阶段流水线，生成最终的教学大纲。
        """
        # 阶段一
        digested_manual = self._digest_document(lab_manual_content)
        
        # 阶段二 & 三
        final_curriculum = self._transform_to_socratic_curriculum(digested_manual)
        
        return final_curriculum