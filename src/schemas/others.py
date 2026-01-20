from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

# structure of digested lab manual
class Task(BaseModel):
    """单个实验任务的结构化摘要"""
    task_title: str = Field(description="任务的标题，例如 '熟悉 Shellcode' 或 '编译与侦察'")
    objective: str = Field(description="该任务的核心学习目标或挑战，用一句话高度总结。")
    key_elements: List[str] = Field(
        description="完成该任务所涉及的关键技术、命令、函数或概念的列表。例如：['-fno-stack-protector', 'gdb', 'EIP/RIP']"
    )
    prerequisites: List[str] = Field(
        default=[],
        description="前置任务或概念列表（学生必须掌握的概念或完成的前置步骤）"
    )
    verifiable_evidence: Optional[str] = Field(
        default=None,
        description="如何通过控制台输出或文件变化来证明该任务已完成（将用于生成 Success Criteria）"
    )
    
    def get(self, key: str, default: Any=None):
        return getattr(self, key, default)
    
class DigestedManual(BaseModel):
    """实验手册的完整结构化摘要"""
    overall_goal: str = Field(description="整个实验最终要达成的总体目标。")
    tasks: List[Task] = Field(description="按顺序排列的、构成整个实验的所有核心任务列表。")
    
    def get(self, key: str, default: Any=None):
        return getattr(self, key, default)