from sqlalchemy import Column, Integer, String, Text, JSON, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from .base import Base


class CustomSkill(Base):
    __tablename__ = "custom_skills"

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(
        String, ForeignKey("profiles.profile_id", ondelete="CASCADE"), index=True
    )
    owner_id = Column(String, index=True, nullable=True)

    skill_key = Column(String, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=False)
    skill_type = Column(String)
    tool_name = Column(String, nullable=False)
    instructions = Column(Text)
    index_path = Column(String)
    status = Column(String, default="pending")
    meta_info = Column(JSON, default=dict)

    create_at = Column(DateTime(timezone=True), server_default=func.now())
    update_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    materials = relationship(
        "SkillMaterial",
        secondary="custom_skill_materials",
        back_populates="skills",
    )
