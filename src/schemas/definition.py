from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

# structure of definition.json
class TutorPersona(BaseModel):
    """
    The complete, structured metadata for a lesson, automatically inferred
    from a lab manual. This will be saved as definition.json.
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
    
    # def get(self, key: str, default: Any=None):
    #     return getattr(self, key, default)

    def get_topic_name(self) -> str:
        return self.topic_name
    def get_persona_hints(self) -> List[str]:
        return self.persona_hints
    def get_domain_specific_constraints(self) -> List[str]:
        return self.domain_specific_constraints
    def get_target_audience(self) -> str:
        return self.target_audience
