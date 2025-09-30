from typing import List, Dict, Any
from pydantic import BaseModel, Field

class GeneratedDefinition(BaseModel):
    """
    The complete, structured metadata for a lesson, automatically inferred
    from a lab manual. This will be saved as definition.yaml.
    """
    topic_name: str = Field(description="A concise and descriptive title for the lab/topic.")

    persona_hints: List[str] = Field(
        description="A list of creative and fitting clues to define the tutor's persona (role, tone, style, catchphrase)."
    )

    domain_specific_constraints: List[str] = Field(
        description="Important rules or ethical considerations specific to the lab's domain (e.g., security ethics, lab safety)."
    )

    target_audience: str = Field(
        description="The inferred target audience based on the manual's complexity and content."
    )

    learning_objectives: List[str] = Field(
        description="A list of specific, action-oriented learning objectives that a student will achieve."
    )


class PersonaGenerator:
    """
    Generate persona for tutor
    given persona_hints/target_audience/learning_objectives in yaml format
    """
    def __init__(self, llm: Any):
        self.llm = llm
    
    def generate(self, lab_manual_content: str):
        """by given lab manual content, generate persona information for tutor
        like what a person he/she is, who he/she is trying to teach, what main concepts he/she is going to teach
        """
        