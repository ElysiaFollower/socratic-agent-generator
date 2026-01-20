"""Custom skill management utilities."""

import hashlib
import logging
from typing import List, Optional

from sqlalchemy.orm import Session

from models.custom_skill import CustomSkill
from models.skill_material import SkillMaterial

logger = logging.getLogger(__name__)


class CustomSkillManager:
    """Manages custom skills and materials using SQLAlchemy."""

    def __init__(self, db: Session):
        self.db = db

    def create_material(
        self,
        profile_id: str,
        owner_id: Optional[str],
        content: str,
        filename: Optional[str] = None,
        mime_type: Optional[str] = None,
        meta_info: Optional[dict] = None,
    ) -> SkillMaterial:
        content_bytes = content.encode("utf-8")
        content_hash = hashlib.sha256(content_bytes).hexdigest()
        size = len(content_bytes)
        material = SkillMaterial(
            profile_id=profile_id,
            owner_id=owner_id,
            filename=filename,
            mime_type=mime_type,
            size=size,
            content=content,
            content_hash=content_hash,
            meta_info=meta_info or {},
        )
        self.db.add(material)
        self.db.commit()
        self.db.refresh(material)
        return material

    def list_materials(self, profile_id: str) -> List[SkillMaterial]:
        return (
            self.db.query(SkillMaterial)
            .filter(SkillMaterial.profile_id == profile_id)
            .order_by(SkillMaterial.id.desc())
            .all()
        )

    def get_material(self, material_id: int) -> Optional[SkillMaterial]:
        return (
            self.db.query(SkillMaterial)
            .filter(SkillMaterial.id == material_id)
            .first()
        )

    def _get_materials_by_ids(
        self, profile_id: str, material_ids: List[int]
    ) -> List[SkillMaterial]:
        if not material_ids:
            return []
        materials = (
            self.db.query(SkillMaterial)
            .filter(
                SkillMaterial.profile_id == profile_id,
                SkillMaterial.id.in_(material_ids),
            )
            .all()
        )
        return materials

    def get_materials_by_ids(
        self, profile_id: str, material_ids: List[int]
    ) -> List[SkillMaterial]:
        return self._get_materials_by_ids(profile_id, material_ids)

    def create_skill(
        self,
        profile_id: str,
        owner_id: Optional[str],
        skill_key: Optional[str],
        name: str,
        description: str,
        skill_type: Optional[str],
        tool_name: str,
        instructions: Optional[str],
        index_path: Optional[str],
        status: Optional[str],
        meta_info: Optional[dict],
        material_ids: Optional[List[int]] = None,
    ) -> CustomSkill:
        resolved_status = status
        if not resolved_status:
            resolved_status = "ready" if instructions else "pending"

        skill = CustomSkill(
            profile_id=profile_id,
            owner_id=owner_id,
            skill_key=skill_key,
            name=name,
            description=description,
            skill_type=skill_type,
            tool_name=tool_name,
            instructions=instructions,
            index_path=index_path,
            status=resolved_status,
            meta_info=meta_info or {},
        )

        materials = self._get_materials_by_ids(
            profile_id, material_ids or []
        )
        if material_ids and len(materials) != len(set(material_ids)):
            raise ValueError("One or more material_ids are invalid for this profile.")

        skill.materials = materials

        self.db.add(skill)
        self.db.commit()
        self.db.refresh(skill)
        return skill

    def list_skills(self, profile_id: str) -> List[CustomSkill]:
        return (
            self.db.query(CustomSkill)
            .filter(CustomSkill.profile_id == profile_id)
            .order_by(CustomSkill.id.desc())
            .all()
        )

    def get_skill(self, skill_id: int) -> Optional[CustomSkill]:
        return (
            self.db.query(CustomSkill)
            .filter(CustomSkill.id == skill_id)
            .first()
        )

    def update_skill(
        self,
        skill: CustomSkill,
        *,
        skill_key: Optional[str] = None,
        name: Optional[str] = None,
        description: Optional[str] = None,
        skill_type: Optional[str] = None,
        tool_name: Optional[str] = None,
        instructions: Optional[str] = None,
        index_path: Optional[str] = None,
        status: Optional[str] = None,
        meta_info: Optional[dict] = None,
        material_ids: Optional[List[int]] = None,
    ) -> CustomSkill:
        if skill_key is not None:
            skill.skill_key = skill_key
        if name is not None:
            skill.name = name
        if description is not None:
            skill.description = description
        if skill_type is not None:
            skill.skill_type = skill_type
        if tool_name is not None:
            skill.tool_name = tool_name
        if instructions is not None:
            skill.instructions = instructions
        if index_path is not None:
            skill.index_path = index_path
        if status is not None:
            skill.status = status
        if meta_info is not None:
            skill.meta_info = meta_info

        if material_ids is not None:
            materials = self._get_materials_by_ids(
                skill.profile_id, material_ids
            )
            if len(materials) != len(set(material_ids)):
                raise ValueError(
                    "One or more material_ids are invalid for this profile."
                )
            skill.materials = materials

        self.db.commit()
        self.db.refresh(skill)
        return skill

    def delete_skill(self, skill: CustomSkill) -> None:
        self.db.delete(skill)
        self.db.commit()

    def delete_material(self, material: SkillMaterial) -> None:
        self.db.delete(material)
        self.db.commit()
