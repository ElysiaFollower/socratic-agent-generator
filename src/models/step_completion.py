from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func

from .base import Base


class StepCompletionModel(Base):
    __tablename__ = "step_completions"
    __table_args__ = (
        UniqueConstraint(
            "session_id",
            "step_index",
            name="uq_step_completions_session_step",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(
        String,
        ForeignKey("sessions.session_id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    step_index = Column(Integer, index=True, nullable=False)
    message_id = Column(Integer, nullable=False)
    create_at = Column(DateTime(timezone=True), server_default=func.now())
