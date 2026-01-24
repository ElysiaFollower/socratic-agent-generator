"""Step completion schema definitions."""

from pydantic import BaseModel, Field


class StepCompletion(BaseModel):
    """Step completion record for a session."""

    step_index: int = Field(description="Completed step index (0-based).")
    message_id: int = Field(
        description="Message id recorded at evaluation time."
    )
