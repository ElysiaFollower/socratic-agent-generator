from sqlalchemy import Column, Integer, ForeignKey

from .base import Base


class CustomSkillMaterial(Base):
    __tablename__ = "custom_skill_materials"

    skill_id = Column(
        Integer,
        ForeignKey("custom_skills.id", ondelete="CASCADE"),
        primary_key=True,
    )
    material_id = Column(
        Integer,
        ForeignKey("skill_materials.id", ondelete="CASCADE"),
        primary_key=True,
    )
