from typing import List, Dict, Any, Optional, Iterator
from pydantic import BaseModel, Field, RootModel

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
    
    def get(self, key: str, default: Any=None):
        return getattr(self, key, default)

# structure of curriculum.json
class SocraticCurriculum(RootModel[List[SocraticStep]]): # may have some problem with pylance
    """最终生成的完整苏格拉底教学大纲"""
    root: List[SocraticStep] = Field(
        description="按顺序排列的、构成整个实验的所有富信息教学节点。"
    )
    
    def get_step_title(self, stepIndex: int) -> str:
        "start from 1"
        return self.root[stepIndex-1].step_title
    def get_guiding_question(self, stepIndex: int) -> str:
        "start from 1"
        return self.root[stepIndex-1].guiding_question
    def get_success_criteria(self, stepIndex: int) -> str:
        "start from 1"
        return self.root[stepIndex-1].success_criteria
    def get_learning_objective(self, stepIndex: int) -> str:
        "start from 1"
        return self.root[stepIndex-1].learning_objective
    
    def get_step(self, stepIndex: int) -> SocraticStep:
        "start from 1"
        return self.root[stepIndex-1]
    
    def get_len(self) -> int:
        return len(self.root)
    