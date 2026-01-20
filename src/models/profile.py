from sqlalchemy import Column, String, Integer, JSON, ForeignKey, Text
from sqlalchemy.orm import relationship
from .base import Base

class ProfileModel(Base):
    __tablename__ = "profiles"

    profile_id = Column(String, primary_key=True, index=True)
    profile_name = Column(String)
    topic_name = Column(String)

    # We keep lab_name for backward compatibility or easy lookup,
    # but strictly it should be derived from document.
    lab_name = Column(String)

    owner_id = Column(String, index=True)
    visible_class_ids = Column(JSON, default=list)

    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)

    persona_hints = Column(JSON) # List[str]
    target_audience = Column(String)

    curriculum = Column(JSON) # SocraticCurriculum (as dict/list)

    prompt_template = Column(Text)

    create_at = Column(String) # Keeping as ISO string to match Pydantic schema

    # Relationship
    document = relationship("Document")
    sessions = relationship("SessionModel", back_populates="profile", cascade="all, delete-orphan")
