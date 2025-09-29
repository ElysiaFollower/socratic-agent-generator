from typing import List, Dict, Any

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
    