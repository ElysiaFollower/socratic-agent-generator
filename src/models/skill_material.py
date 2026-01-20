from sqlalchemy import Column, Integer, String, Text, JSON, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from .base import Base


class SkillMaterial(Base):
    __tablename__ = "skill_materials"

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(
        String, ForeignKey("profiles.profile_id", ondelete="CASCADE"), index=True
    )
    owner_id = Column(String, index=True, nullable=True)

    filename = Column(String)
    mime_type = Column(String)
    size = Column(Integer)
    content = Column(Text, nullable=False)
    content_hash = Column(String, index=True)
    meta_info = Column(JSON, default=dict)
    upload_time = Column(DateTime(timezone=True), server_default=func.now())

    skills = relationship(
        "CustomSkill",
        secondary="custom_skill_materials",
        back_populates="materials",
    )
