"""Custom skill management routes."""

from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from api.routes.auth import get_current_user
from core.dependencies import CustomSkillManagerDep, ProfileManagerDep
from core.exceptions import ProfileNotFoundError
from schemas.custom_skill import (
    CustomSkillCreateRequest,
    CustomSkillDetail,
    CustomSkillInfo,
    CustomSkillUpdateRequest,
    SkillMaterialInfo,
    SkillMaterialTextRequest,
)
from schemas.user import User

router = APIRouter(prefix="/api", tags=["CustomSkill"])


def _material_to_info(material) -> SkillMaterialInfo:
    return SkillMaterialInfo(
        id=material.id,
        profile_id=material.profile_id,
        owner_id=material.owner_id,
        filename=material.filename,
        mime_type=material.mime_type,
        size=material.size,
        content_hash=material.content_hash,
        meta_info=material.meta_info or {},
        upload_time=material.upload_time,
    )


def _skill_to_info(skill, include_instructions: bool) -> CustomSkillDetail:
    material_ids = [m.id for m in getattr(skill, "materials", []) or []]
    return CustomSkillDetail(
        id=skill.id,
        profile_id=skill.profile_id,
        owner_id=skill.owner_id,
        skill_key=skill.skill_key,
        name=skill.name,
        description=skill.description,
        skill_type=skill.skill_type,
        tool_name=skill.tool_name,
        instructions=skill.instructions if include_instructions else None,
        index_path=skill.index_path,
        status=skill.status,
        meta_info=skill.meta_info or {},
        create_at=skill.create_at,
        update_at=skill.update_at,
        material_ids=material_ids,
    )


@router.post(
    "/profiles/{profile_id}/skill-materials",
    response_model=SkillMaterialInfo,
    summary="上传自定义技能资料",
)
async def upload_skill_material(
    profile_id: str,
    file: UploadFile = File(..., description="Skill material file"),
    hint: Optional[str] = Form(default=None),
    current_user: User = Depends(get_current_user),
    profile_manager: ProfileManagerDep = None,
    custom_skill_manager: CustomSkillManagerDep = None,
) -> SkillMaterialInfo:
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can upload skill materials.",
        )

    try:
        profile_manager.read_profile(profile_id)
    except ProfileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    content_bytes = await file.read()
    try:
        content_str = content_bytes.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be UTF-8 encoded text.",
        )

    if not content_str.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is empty.",
        )

    meta_info = {}
    if hint:
        meta_info["hint"] = hint

    material = custom_skill_manager.create_material(
        profile_id=profile_id,
        owner_id=current_user.user_id,
        content=content_str,
        filename=file.filename,
        mime_type=file.content_type,
        meta_info=meta_info,
    )
    return _material_to_info(material)


@router.post(
    "/profiles/{profile_id}/skill-materials/text",
    response_model=SkillMaterialInfo,
    summary="创建自定义技能资料(文本)",
)
def create_skill_material_text(
    profile_id: str,
    req: SkillMaterialTextRequest,
    current_user: User = Depends(get_current_user),
    profile_manager: ProfileManagerDep = None,
    custom_skill_manager: CustomSkillManagerDep = None,
) -> SkillMaterialInfo:
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can create skill materials.",
        )

    if not req.content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Content is empty.",
        )

    try:
        profile_manager.read_profile(profile_id)
    except ProfileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    meta_info = dict(req.meta_info or {})
    if req.hint:
        meta_info["hint"] = req.hint

    material = custom_skill_manager.create_material(
        profile_id=profile_id,
        owner_id=current_user.user_id,
        content=req.content,
        filename=req.filename,
        mime_type=req.mime_type,
        meta_info=meta_info,
    )
    return _material_to_info(material)


@router.get(
    "/profiles/{profile_id}/skill-materials",
    response_model=List[SkillMaterialInfo],
    summary="列出自定义技能资料",
)
def list_skill_materials(
    profile_id: str,
    current_user: User = Depends(get_current_user),
    profile_manager: ProfileManagerDep = None,
    custom_skill_manager: CustomSkillManagerDep = None,
) -> List[SkillMaterialInfo]:
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can list skill materials.",
        )

    try:
        profile_manager.read_profile(profile_id)
    except ProfileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    materials = custom_skill_manager.list_materials(profile_id)
    return [_material_to_info(material) for material in materials]


@router.post(
    "/profiles/{profile_id}/skills",
    response_model=CustomSkillDetail,
    summary="创建自定义技能",
)
def create_custom_skill(
    profile_id: str,
    req: CustomSkillCreateRequest,
    current_user: User = Depends(get_current_user),
    profile_manager: ProfileManagerDep = None,
    custom_skill_manager: CustomSkillManagerDep = None,
) -> CustomSkillDetail:
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can create custom skills.",
        )

    try:
        profile_manager.read_profile(profile_id)
    except ProfileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    try:
        skill = custom_skill_manager.create_skill(
            profile_id=profile_id,
            owner_id=current_user.user_id,
            skill_key=req.skill_key,
            name=req.name,
            description=req.description,
            skill_type=req.skill_type,
            tool_name=req.tool_name,
            instructions=req.instructions,
            index_path=req.index_path,
            status=req.status,
            meta_info=req.meta_info,
            material_ids=req.material_ids,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    return _skill_to_info(skill, include_instructions=True)


@router.get(
    "/profiles/{profile_id}/skills",
    response_model=List[CustomSkillInfo],
    summary="列出自定义技能",
)
def list_custom_skills(
    profile_id: str,
    current_user: User = Depends(get_current_user),
    profile_manager: ProfileManagerDep = None,
    custom_skill_manager: CustomSkillManagerDep = None,
) -> List[CustomSkillInfo]:
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can list custom skills.",
        )

    try:
        profile_manager.read_profile(profile_id)
    except ProfileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    skills = custom_skill_manager.list_skills(profile_id)
    return [_skill_to_info(skill, include_instructions=False) for skill in skills]


@router.get(
    "/skills/{skill_id}",
    response_model=CustomSkillDetail,
    summary="获取自定义技能详情",
)
def get_custom_skill(
    skill_id: int,
    current_user: User = Depends(get_current_user),
    custom_skill_manager: CustomSkillManagerDep = None,
) -> CustomSkillDetail:
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can access custom skills.",
        )

    skill = custom_skill_manager.get_skill(skill_id)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found.")

    return _skill_to_info(skill, include_instructions=True)


@router.patch(
    "/skills/{skill_id}",
    response_model=CustomSkillDetail,
    summary="更新自定义技能",
)
def update_custom_skill(
    skill_id: int,
    req: CustomSkillUpdateRequest,
    current_user: User = Depends(get_current_user),
    custom_skill_manager: CustomSkillManagerDep = None,
) -> CustomSkillDetail:
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can update custom skills.",
        )

    skill = custom_skill_manager.get_skill(skill_id)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found.")

    try:
        updated = custom_skill_manager.update_skill(
            skill,
            skill_key=req.skill_key,
            name=req.name,
            description=req.description,
            skill_type=req.skill_type,
            tool_name=req.tool_name,
            instructions=req.instructions,
            index_path=req.index_path,
            status=req.status,
            meta_info=req.meta_info,
            material_ids=req.material_ids,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    return _skill_to_info(updated, include_instructions=True)


@router.delete(
    "/skills/{skill_id}",
    summary="删除自定义技能",
)
def delete_custom_skill(
    skill_id: int,
    current_user: User = Depends(get_current_user),
    custom_skill_manager: CustomSkillManagerDep = None,
) -> dict:
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can delete custom skills.",
        )

    skill = custom_skill_manager.get_skill(skill_id)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found.")

    custom_skill_manager.delete_skill(skill)
    return {"success": True, "skill_id": skill_id}
