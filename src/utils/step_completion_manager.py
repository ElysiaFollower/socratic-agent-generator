import logging
from typing import List, Optional

from sqlalchemy.orm import Session

from models.step_completion import StepCompletionModel

logger = logging.getLogger(__name__)


class StepCompletionManager:
    """Manages step completion persistence."""

    def __init__(self, db: Session):
        self.db = db

    def record_completion(
        self,
        session_id: str,
        step_index: int,
        message_id: int,
    ) -> StepCompletionModel:
        """Insert or update a step completion record."""
        existing = (
            self.db.query(StepCompletionModel)
            .filter(
                StepCompletionModel.session_id == session_id,
                StepCompletionModel.step_index == step_index,
            )
            .first()
        )
        if existing:
            if existing.message_id != message_id:
                existing.message_id = message_id
                self.db.commit()
                self.db.refresh(existing)
                logger.info(
                    "Updated step completion: session=%s step=%d message_id=%d",
                    session_id,
                    step_index,
                    message_id,
                )
            return existing

        record = StepCompletionModel(
            session_id=session_id,
            step_index=step_index,
            message_id=message_id,
        )
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        logger.info(
            "Recorded step completion: session=%s step=%d message_id=%d",
            session_id,
            step_index,
            message_id,
        )
        return record

    def list_completions(
        self,
        session_id: str,
    ) -> List[StepCompletionModel]:
        """List step completion records for a session."""
        return (
            self.db.query(StepCompletionModel)
            .filter(StepCompletionModel.session_id == session_id)
            .order_by(StepCompletionModel.step_index.asc())
            .all()
        )

    def get_completion(
        self,
        session_id: str,
        step_index: int,
    ) -> Optional[StepCompletionModel]:
        """Get a single step completion record."""
        return (
            self.db.query(StepCompletionModel)
            .filter(
                StepCompletionModel.session_id == session_id,
                StepCompletionModel.step_index == step_index,
            )
            .first()
        )
