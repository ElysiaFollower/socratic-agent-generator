"""Custom skill management routes."""

import io
import logging
import re
from typing import List, Optional

import pdfplumber
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from api.routes.auth import get_current_user
from core.dependencies import CustomSkillManagerDep, ProfileManagerDep
from core.exceptions import ProfileNotFoundError
from generators.CustomSkillGenerator import CustomSkillGenerator
from config import get_default_llm
from utils.custom_skill_indexer import build_custom_skill_index
from schemas.custom_skill import (
    CustomSkillCreateRequest,
    CustomSkillDetail,
    CustomSkillInfo,
    CustomSkillGenerateRequest,
    CustomSkillGenerateResponse,
    CustomSkillUpdateRequest,
    CustomSkillAssignRequest,
    SkillMaterialInfo,
    SkillMaterialDetail,
    SkillMaterialTextRequest,
)
from schemas.user import User

logger = logging.getLogger(__name__)

# Constants
MAX_PDF_SIZE = 10 * 1024 * 1024  # 10MB limit for PDF files
MIN_EXTRACTED_TEXT_LENGTH = 100  # Minimum length for extracted PDF text

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


def _sanitize_tool_name(name: str) -> str:
    safe = re.sub(r"[^a-zA-Z0-9_]", "_", name.strip())
    if not safe.startswith("custom_"):
        safe = f"custom_{safe}"
    return safe.lower()


def _format_profile_context(profile) -> str:
    """Format profile context for skill generation prompt."""
    hints = profile.persona_hints or []

    # Extract curriculum steps for context (profile.curriculum is already a list from DB)
    curriculum = profile.curriculum if isinstance(profile.curriculum, list) else []
    steps_summary = ""
    if curriculum:
        steps_summary = "\nlearning_steps:\n" + "\n".join(
            f"  - Step {i+1}: {step.get('step_title', 'Untitled')}"
            for i, step in enumerate(curriculum[:5])  # First 5 steps
        )
        if len(curriculum) > 5:
            steps_summary += f"\n  ... and {len(curriculum) - 5} more steps"

    lines = [
        "# Profile Context",
        f"topic_name: {profile.topic_name}",
        f"profile_name: {profile.profile_name or 'N/A'}",
        f"lab_name: {profile.lab_name or 'N/A'}",
        f"target_audience: {profile.target_audience}",
        "",
        "# Persona Hints (Tutor's role and style)",
    ]
    if hints:
        lines.extend(f"  - {hint}" for hint in hints)
    else:
        lines.append("  - (No specific persona hints)")

    lines.append(steps_summary)

    return "\n".join(lines)


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
        profile = profile_manager.read_profile(profile_id)
    except ProfileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    content_bytes = await file.read()

    # Check file extension
    file_extension = ""
    if file.filename:
        file_extension = file.filename.lower().split(".")[-1]

    # PDF file processing
    if file_extension == "pdf":
        # PDF file size check
        if len(content_bytes) > MAX_PDF_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"PDF file size exceeds maximum allowed size of {MAX_PDF_SIZE / 1024 / 1024}MB"
            )

        # PDF file type validation (using file header)
        if not content_bytes.startswith(b'%PDF'):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Invalid PDF file format"
            )

        try:
            with pdfplumber.open(io.BytesIO(content_bytes)) as pdf:
                text_parts = []
                for page_num, page in enumerate(pdf.pages, 1):
                    # Use layout=True to maintain layout order
                    text = page.extract_text(layout=True)
                    if text:
                        text_parts.append(text)
                    logger.debug(f"Extracted text from PDF page {page_num}/{len(pdf.pages)}")

                if not text_parts:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="PDF file contains no extractable text. It may be a scanned image. OCR support is not yet available."
                    )

                content_str = "\n\n".join(text_parts)

                # Check if extracted text is too short
                if len(content_str.strip()) < MIN_EXTRACTED_TEXT_LENGTH:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Extracted text from PDF is too short. The PDF may be primarily images or corrupted."
                    )

        except ImportError:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="PDF processing library (pdfplumber) is not installed. Please install it: pip install pdfplumber>=0.11.9"
            )
        except pdfplumber.exceptions.PDFSyntaxError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid or corrupted PDF file: {str(e)}"
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"PDF extraction failed: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to extract text from PDF: {str(e)}"
            )
    else:
        # Text file processing
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

    # Store original format in meta_info
    if file_extension:
        meta_info["original_format"] = file_extension

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
        profile = profile_manager.read_profile(profile_id)
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
        profile = profile_manager.read_profile(profile_id)
    except ProfileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    materials = custom_skill_manager.list_materials(profile_id)
    return [_material_to_info(material) for material in materials]


@router.get(
    "/profiles/{profile_id}/skill-materials/{material_id}",
    response_model=SkillMaterialDetail,
    summary="获取自定义技能资料详情",
)
def get_skill_material(
    profile_id: str,
    material_id: int,
    current_user: User = Depends(get_current_user),
    custom_skill_manager: CustomSkillManagerDep = None,
) -> SkillMaterialDetail:
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can access skill materials.",
        )

    material = custom_skill_manager.get_material(material_id)
    if not material or material.profile_id != profile_id:
        raise HTTPException(status_code=404, detail="Material not found.")

    return SkillMaterialDetail(
        **_material_to_info(material).model_dump(),
        content=material.content,
    )


@router.delete(
    "/profiles/{profile_id}/skill-materials/{material_id}",
    summary="删除自定义技能资料",
)
def delete_skill_material(
    profile_id: str,
    material_id: int,
    current_user: User = Depends(get_current_user),
    custom_skill_manager: CustomSkillManagerDep = None,
) -> dict:
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can delete skill materials.",
        )

    material = custom_skill_manager.get_material(material_id)
    if not material or material.profile_id != profile_id:
        raise HTTPException(status_code=404, detail="Material not found.")

    custom_skill_manager.delete_material(material)
    return {"success": True, "material_id": material_id}


@router.post(
    "/profiles/{profile_id}/skills/generate",
    response_model=CustomSkillGenerateResponse,
    summary="生成自定义技能草稿",
)
async def generate_custom_skill(
    profile_id: str,
    req: CustomSkillGenerateRequest,
    current_user: User = Depends(get_current_user),
    profile_manager: ProfileManagerDep = None,
    custom_skill_manager: CustomSkillManagerDep = None,
) -> CustomSkillGenerateResponse:
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can generate custom skills.",
        )

    try:
        profile = profile_manager.read_profile(profile_id)
    except ProfileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    materials = custom_skill_manager.get_materials_by_ids(
        profile_id, req.material_ids
    )
    if req.material_ids and len(materials) != len(set(req.material_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more material_ids are invalid for this profile.",
        )

    combined = "\n\n".join(
        f"## Material {m.id}\n\n{m.content}" for m in materials
    )

    from config import DEFAULT_OUTPUT_LANGUAGE
    output_language = req.output_language or DEFAULT_OUTPUT_LANGUAGE
    generator = CustomSkillGenerator(get_default_llm(), output_language=output_language)
    draft = await generator.generate(
        combined, hint=req.hint, profile_context=_format_profile_context(profile)
    )
    draft.tool_name = _sanitize_tool_name(draft.tool_name)

    return CustomSkillGenerateResponse(draft=draft, material_ids=req.material_ids)


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
        profile = profile_manager.read_profile(profile_id)
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
            tool_name=_sanitize_tool_name(req.tool_name),
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
        profile = profile_manager.read_profile(profile_id)
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
            tool_name=_sanitize_tool_name(req.tool_name)
            if req.tool_name
            else None,
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


@router.post(
    "/skills/{skill_id}/assign",
    response_model=CustomSkillDetail,
    summary="分配自定义技能到Profile",
)
def assign_custom_skill(
    skill_id: int,
    req: CustomSkillAssignRequest,
    current_user: User = Depends(get_current_user),
    profile_manager: ProfileManagerDep = None,
    custom_skill_manager: CustomSkillManagerDep = None,
) -> CustomSkillDetail:
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can assign custom skills.",
        )

    skill = custom_skill_manager.get_skill(skill_id)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found.")

    try:
        profile = profile_manager.read_profile(req.profile_id)
    except ProfileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    retrieval_needed = bool(skill.meta_info.get("retrieval_needed"))
    status = "ready"
    if retrieval_needed and not req.material_ids:
        status = "pending"

    meta_info = dict(skill.meta_info or {})
    meta_info["source_skill_id"] = skill.id
    meta_info["assigned_from_profile"] = skill.profile_id

    try:
        created = custom_skill_manager.create_skill(
            profile_id=req.profile_id,
            owner_id=current_user.user_id,
            skill_key=skill.skill_key,
            name=skill.name,
            description=skill.description,
            skill_type=skill.skill_type,
            tool_name=_sanitize_tool_name(skill.tool_name),
            instructions=skill.instructions,
            index_path=None,
            status=status,
            meta_info=meta_info,
            material_ids=req.material_ids,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    return _skill_to_info(created, include_instructions=True)


@router.post(
    "/skills/{skill_id}/rebuild",
    summary="重建自定义技能索引",
)
def rebuild_custom_skill_index(
    skill_id: int,
    current_user: User = Depends(get_current_user),
    custom_skill_manager: CustomSkillManagerDep = None,
) -> dict:
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can rebuild skill indexes.",
        )

    skill = custom_skill_manager.get_skill(skill_id)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found.")

    try:
        result = build_custom_skill_index(skill_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    return {"success": True, **result}
