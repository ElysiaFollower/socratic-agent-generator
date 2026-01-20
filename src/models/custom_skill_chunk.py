from sqlalchemy import Column, Integer, String, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship

from .base import Base


class CustomSkillChunk(Base):
    __tablename__ = "custom_skill_chunks"

    id = Column(Integer, primary_key=True, index=True)
    skill_id = Column(
        Integer, ForeignKey("custom_skills.id", ondelete="CASCADE"), index=True
    )
    material_id = Column(
        Integer, ForeignKey("skill_materials.id", ondelete="SET NULL"), nullable=True
    )
    content = Column(Text, nullable=False)
    embedding = Column(JSON, default=list)

    skill = relationship("CustomSkill")
    material = relationship("SkillMaterial")
