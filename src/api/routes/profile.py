"""Profile management routes.

This module handles HTTP endpoints for tutor profile operations.
"""

import io
import json
import logging
import re
from pathlib import Path
from typing import List, Optional

import pdfplumber
from fastapi import APIRouter, BackgroundTasks, Body, Depends, File, Form, HTTPException, Query, UploadFile, status

from api.routes.auth import get_current_user
from config import RAW_DATA_DIR, ROOT_DIR, DOCUMENTS_DIR, DEFAULT_OUTPUT_LANGUAGE
from core.dependencies import ProfileManagerDep, DocumentManagerDep, ClassManagerDep
from core.exceptions import ProfileNotFoundError
from generators.ProfileGenerateManager import ProfileGenerateManager
from models.document import Document
from models.profile import ProfileModel
from pydantic import BaseModel, Field
from schemas.curriculum import SocraticCurriculum
from schemas.definition import TutorPersona
from schemas.profile import Profile
from schemas.user import User
from utils.skills import build_lab_manual_index

logger = logging.getLogger(__name__)

# Constants
MAX_PDF_SIZE = 10 * 1024 * 1024  # 10MB limit for PDF files
MIN_EXTRACTED_TEXT_LENGTH = 100  # Minimum length for extracted PDF text
LAB_MANUAL_EXCERPT_CHARS = 700

router = APIRouter(prefix="/api/profiles", tags=["Profile"])


def _absolute_repo_path(path_value: str) -> Path:
    path = Path(path_value)
    if path.is_absolute():
        return path
    return ROOT_DIR / path


def _display_repo_path(path_value: Optional[str]) -> Optional[str]:
    if not path_value:
        return None
    path = Path(path_value)
    if not path.is_absolute():
        return path.as_posix()
    try:
        return path.relative_to(ROOT_DIR).as_posix()
    except ValueError:
        return path.name


def _read_excerpt(path: Path, limit: int = LAB_MANUAL_EXCERPT_CHARS) -> str:
    if not path.exists() or not path.is_file():
        return ""
    try:
        with open(path, "r", encoding="utf-8") as file:
            content = file.read(limit * 2)
    except UnicodeDecodeError:
        return ""
    except OSError:
        return ""
    normalized = re.sub(r"\s+", " ", content).strip()
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 1].rstrip() + "…"


def _profile_has_persona(model: ProfileModel) -> bool:
    hints = model.persona_hints or []
    return bool(hints) or bool(model.target_audience)


def _profile_has_curriculum(model: ProfileModel) -> bool:
    curriculum = model.curriculum
    if isinstance(curriculum, dict):
        root = curriculum.get("root")
        if isinstance(root, list):
            return len(root) > 0
        return bool(curriculum)
    if isinstance(curriculum, list):
        return len(curriculum) > 0
    return False


def _document_reference_models(
    document_manager: DocumentManagerDep,
    doc_id: int,
) -> List[ProfileModel]:
    return (
        document_manager.db.query(ProfileModel)
        .filter(ProfileModel.document_id == doc_id)
        .order_by(ProfileModel.profile_name.asc())
        .all()
    )


def _profile_reference_payload(models: List[ProfileModel]) -> List[dict]:
    return [
        {
            "profile_id": model.profile_id,
            "profile_name": model.profile_name,
            "lab_name": model.lab_name,
            "owner_id": model.owner_id,
        }
        for model in models
    ]


def _document_references(document_manager: DocumentManagerDep, doc_id: int) -> List[dict]:
    return _profile_reference_payload(
        _document_reference_models(document_manager, doc_id)
    )


def _lab_manual_info(
    document_manager: DocumentManagerDep,
    doc: Document,
    include_excerpt: bool = True,
) -> dict:
    lab_dir = _absolute_repo_path(str(Path(doc.storage_path).parent))
    lab_manual_path = _absolute_repo_path(doc.storage_path)
    meta_info = doc.meta_info or {}
    references = _document_reference_models(document_manager, doc.id)
    has_lab_manual = lab_manual_path.exists()
    has_persona = (lab_dir / "definition.json").exists() or any(
        _profile_has_persona(model) for model in references
    )
    has_curriculum = (lab_dir / "curriculum.json").exists() or any(
        _profile_has_curriculum(model) for model in references
    )
    size_bytes = lab_manual_path.stat().st_size if has_lab_manual else None
    display_name = str(meta_info.get("display_name") or doc.doc_name)

    return {
        "document_id": doc.id,
        "lab_name": doc.doc_name,
        "display_name": display_name,
        "owner_id": doc.owner_id,
        "filename": doc.filename,
        "upload_time": doc.upload_time,
        "source_path": _display_repo_path(doc.storage_path),
        "index_path": _display_repo_path(doc.index_path),
        "size_bytes": size_bytes,
        "excerpt": _read_excerpt(lab_manual_path) if include_excerpt else "",
        "has_lab_manual": has_lab_manual,
        "has_persona": has_persona,
        "has_curriculum": has_curriculum,
        "is_builtin": bool(meta_info.get("is_builtin")),
        "referenced_profiles": _profile_reference_payload(references),
        "referenced_profile_count": len(references),
    }


def check_document_access(
    document_manager: DocumentManagerDep,
    lab_name: str,
    current_user: User,
    allow_admin: bool = True
) -> Document:
    """检查用户是否有权限访问指定文档。
    
    Args:
        document_manager: DocumentManager 依赖
        lab_name: 文档名称
        current_user: 当前用户
        allow_admin: admin 是否拥有所有权限
    
    Returns:
        Document 对象
    
    Raises:
        HTTPException: 如果用户无权访问
    """
    # Admin 可以访问所有文档
    if allow_admin and current_user.role == "admin":
        doc = document_manager.get_document_by_name(lab_name)
        if not doc:
            raise HTTPException(
                status_code=404,
                detail=f"Document '{lab_name}' not found."
            )
        return doc
    
    # Teacher 只能访问自己的文档
    if current_user.role == "teacher":
        doc = document_manager.get_document_by_owner_and_name(
            current_user.user_id, 
            lab_name
        )
        if not doc:
            doc = document_manager.get_document_by_owner_and_name("builtin", lab_name)
        if not doc:
            raise HTTPException(
                status_code=404,
                detail=f"Document '{lab_name}' not found or access denied."
            )
        return doc
    
    # Student 不能访问文档
    raise HTTPException(
        status_code=403,
        detail="Students cannot access lab manuals."
    )


def check_document_access_by_id(
    document_manager: DocumentManagerDep,
    document_id: int,
    current_user: User,
    allow_admin: bool = True,
    allow_builtin_for_teacher: bool = True,
) -> Document:
    """Check access to a document by stable database ID."""
    doc = document_manager.get_document_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    if allow_admin and current_user.role == "admin":
        return doc
    if current_user.role == "teacher":
        if doc.owner_id == current_user.user_id:
            return doc
        if allow_builtin_for_teacher and doc.owner_id == "builtin":
            return doc
    if current_user.role == "student":
        raise HTTPException(
            status_code=403,
            detail="Students cannot access lab manuals.",
        )
    raise HTTPException(status_code=403, detail="Document access denied.")


class GenerateProfileRequest(BaseModel):
    """Request schema for generating a profile."""

    lab_manual_content: str = Field(
        description="The content of the lab manual.",
    )
    profile_name: Optional[str] = Field(
        default=None,
        description="Optional name for the profile. If None, auto-generated from username + filename + uuid.",
    )
    filename: Optional[str] = Field(
        default=None,
        description="Original filename of the uploaded lab manual (for auto-generating profile_name).",
    )
    lab_name: Optional[str] = Field(
        default=None,
        description="Optional lab directory name for RAG indexing and profile storage.",
    )
    output_language: Optional[str] = Field(
        default=None,
        description="Output language for generated content. Defaults to DEFAULT_OUTPUT_LANGUAGE.",
    )


class RenameProfileRequest(BaseModel):
    """Request schema for renaming a profile."""

    profile_name: str = Field(
        description="New profile name.",
        min_length=1,
    )


class UpdateLabManualDisplayNameRequest(BaseModel):
    """Request schema for updating a lab manual display name."""

    display_name: str = Field(
        description="Human-facing document display name.",
        min_length=1,
        max_length=160,
    )


class GenerateProfileFromLabRequest(BaseModel):
    """Request schema for generating a profile from an existing lab."""

    profile_name: Optional[str] = Field(
        default=None,
        description="Optional name for the profile. If None, auto-generated from username + lab_name + uuid.",
    )
    output_language: Optional[str] = Field(
        default=None,
        description="Output language for generated content. Defaults to DEFAULT_OUTPUT_LANGUAGE.",
    )


@router.get("", response_model=List[Profile], summary="获取所有可用的导师配置列表")
def list_profiles(
    profile_manager: ProfileManagerDep,
    class_manager: ClassManagerDep,
    current_user: User = Depends(get_current_user),
) -> List[Profile]:
    """List all available tutor profiles.

    Args:
        profile_manager: Injected ProfileManager instance.

    Returns:
        List of Profile objects.
    """
    if current_user.role == "student":
        class_ids = class_manager.list_class_ids_for_user(current_user.user_id)
        return profile_manager.list_profiles_by_visible_classes(class_ids)
    if current_user.role == "admin":
        return profile_manager.list_profiles()
    return profile_manager.list_profiles_by_owner(
        current_user.user_id, include_unowned=True
    )


@router.get("/lab-manuals", summary="列出所有实验文档")
def list_lab_manuals(
    current_user: User = Depends(get_current_user),
    document_manager: DocumentManagerDep = None # Inject DocumentManager
) -> List[dict]:
    """List lab manuals accessible to the current user."""
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    # ✅ Admin 可以看到所有文档，Teacher 只能看到自己的
    if current_user.role == "admin":
        docs = document_manager.list_documents()
    else:
        docs = document_manager.db.query(Document).filter(
            (Document.owner_id == current_user.user_id) | (Document.owner_id == "builtin")
        ).order_by(Document.upload_time.desc()).all()
    
    lab_manuals = [
        _lab_manual_info(document_manager, doc, include_excerpt=True)
        for doc in docs
    ]
    
    return sorted(lab_manuals, key=lambda x: x["display_name"].lower())


@router.put("/lab-manuals/by-id/{document_id}/display-name", summary="更新实验文档显示名")
def update_lab_manual_display_name(
    document_id: int,
    request: UpdateLabManualDisplayNameRequest,
    current_user: User = Depends(get_current_user),
    document_manager: DocumentManagerDep = None,
) -> dict:
    """Update a lab manual display name without changing document identity."""
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    doc = check_document_access_by_id(
        document_manager,
        document_id,
        current_user,
        allow_builtin_for_teacher=False,
    )
    display_name = request.display_name.strip()
    if not display_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Display name cannot be empty.",
        )
    updated = document_manager.update_display_name(doc.id, display_name)
    if not updated:
        raise HTTPException(status_code=404, detail="Document not found.")
    return _lab_manual_info(document_manager, updated, include_excerpt=True)


def _lab_manual_content_response(
    document_manager: DocumentManagerDep,
    doc: Document,
) -> dict:
    lab_manual_path = _absolute_repo_path(doc.storage_path)
    
    if not lab_manual_path.exists():
         raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lab manual file not found for lab '{doc.doc_name}'.",
        )

    try:
        with open(lab_manual_path, "r", encoding="utf-8") as f:
            content = f.read()
        return {
            "document_id": doc.id,
            "lab_name": doc.doc_name,
            "display_name": str((doc.meta_info or {}).get("display_name") or doc.doc_name),
            "filename": doc.filename,
            "content": content,
            "size": len(content),
            "source_path": _display_repo_path(doc.storage_path),
            "referenced_profiles": _document_references(document_manager, doc.id),
        }
    except Exception as e:
        logger.error("Failed to read lab manual content: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read lab manual content: {str(e)}",
        )


@router.get("/lab-manuals/by-id/{document_id}/content", summary="按ID获取实验文档内容")
def get_lab_manual_content_by_id(
    document_id: int,
    current_user: User = Depends(get_current_user),
    document_manager: DocumentManagerDep = None,
) -> dict:
    """Get lab manual content by stable document ID."""
    doc = check_document_access_by_id(document_manager, document_id, current_user)
    return _lab_manual_content_response(document_manager, doc)


@router.get("/lab-manuals/{lab_name}/content", summary="获取实验文档内容")
def get_lab_manual_content(
    lab_name: str,
    current_user: User = Depends(get_current_user),
    document_manager: DocumentManagerDep = None
) -> dict:
    """Get the content of a lab manual file."""
    # ✅ 检查文档访问权限
    doc = check_document_access(document_manager, lab_name, current_user)
    return _lab_manual_content_response(document_manager, doc)


def _delete_lab_manual_document(
    document_manager: DocumentManagerDep,
    doc: Document,
    username: str,
) -> dict:
    """Delete a document record and unlink profiles that reference it."""
    import shutil

    doc_id = doc.id
    doc_name = doc.doc_name
    lab_dir = _absolute_repo_path(str(Path(doc.storage_path).parent))
    index_dir = Path(doc.index_path) if doc.index_path else None
    if index_dir and not index_dir.is_absolute():
        index_dir = ROOT_DIR / index_dir
    meta_info = doc.meta_info or {}
    is_builtin = bool(meta_info.get("is_builtin"))
    references = _document_references(document_manager, doc.id)

    for profile_model in (
        document_manager.db.query(ProfileModel)
        .filter(ProfileModel.document_id == doc.id)
        .all()
    ):
        profile_model.document_id = None
    document_manager.db.commit()

    document_manager.delete_document_by_id(doc_id)

    # Delete user-uploaded files. Built-in source artifacts are versioned repo
    # fixtures, so deletion only removes their DB/index binding at runtime.
    if not is_builtin and lab_dir.exists():
        try:
            shutil.rmtree(lab_dir)
            logger.info(
                "Lab manual directory deleted by user %s: %s",
                username,
                lab_dir,
            )
        except Exception as e:
            logger.error("Failed to delete lab manual files: %s", e)
            # We continue even if file deletion fails, as DB record is gone
    if index_dir and index_dir.exists():
        try:
            shutil.rmtree(index_dir)
        except Exception as e:
            logger.error("Failed to delete lab manual index: %s", e)

    return {
        "success": True,
        "message": f"Lab manual '{doc_name}' deleted successfully.",
        "lab_name": doc_name,
        "document_id": doc_id,
        "affected_profiles": references,
        "affected_profile_count": len(references),
        "document_unlinked": True,
    }


@router.delete("/lab-manuals/by-id/{document_id}", summary="按ID删除实验文档")
def delete_lab_manual_by_id(
    document_id: int,
    current_user: User = Depends(get_current_user),
    document_manager: DocumentManagerDep = None,
) -> dict:
    """Delete a lab manual by stable document ID."""
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can delete lab manuals.",
        )
    doc = check_document_access_by_id(document_manager, document_id, current_user)
    return _delete_lab_manual_document(
        document_manager,
        doc,
        current_user.username,
    )


@router.delete("/lab-manuals/{lab_name}", summary="删除实验文档")
def delete_lab_manual(
    lab_name: str,
    current_user: User = Depends(get_current_user),
    document_manager: DocumentManagerDep = None
) -> dict:
    """Delete a lab manual directory and all its contents."""
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can delete lab manuals.",
        )

    doc = check_document_access(document_manager, lab_name, current_user)
    return _delete_lab_manual_document(
        document_manager,
        doc,
        current_user.username,
    )


@router.get("/{profile_id}", response_model=Profile, summary="获取指定导师的完整配置")
def get_profile(
    profile_id: str,
    profile_manager: ProfileManagerDep,
    class_manager: ClassManagerDep,
    current_user: User = Depends(get_current_user),
) -> Profile:
    try:
        profile = profile_manager.read_profile(profile_id)
    except ProfileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if current_user.role == "student":
        class_ids = class_manager.list_class_ids_for_user(current_user.user_id)
        visible_ids = set(profile.visible_class_ids or [])
        if not visible_ids.intersection(set(class_ids)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Profile is not visible to your classes.",
            )
    elif current_user.role == "teacher":
        if profile.owner_id and profile.owner_id != current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only access your own profiles.",
            )

    return profile


@router.put(
    "/{profile_id}/rename",
    response_model=Profile,
    summary="重命名Profile",
)
def rename_profile(
    profile_id: str,
    req: RenameProfileRequest,
    profile_manager: ProfileManagerDep,
    current_user: User = Depends(get_current_user),
) -> Profile:
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can rename profiles.",
        )

    try:
        profile = profile_manager.read_profile(profile_id)
    except ProfileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if profile.owner_id and current_user.role == "teacher":
        if profile.owner_id != current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only rename your own profiles.",
            )

    return profile_manager.rename_profile(profile_id, req.profile_name.strip())


class UpdatePersonaHintsRequest(BaseModel):
    """Request schema for updating persona hints."""

    persona_hints: List[str] = Field(
        description="New persona hints.",
    )


class UpdateCurriculumRequest(BaseModel):
    """Request schema for updating curriculum."""

    curriculum: SocraticCurriculum = Field(
        description="New curriculum.",
    )


@router.put(
    "/{profile_id}/persona-hints",
    response_model=Profile,
    summary="更新Profile的Persona提示",
)
def update_persona_hints(
    profile_id: str,
    req: UpdatePersonaHintsRequest,
    profile_manager: ProfileManagerDep,
    current_user: User = Depends(get_current_user),
) -> Profile:
    """Update persona hints for a profile.

    Args:
        profile_id: The profile ID to update.
        req: UpdatePersonaHintsRequest containing new persona hints.
        profile_manager: Injected ProfileManager instance.
        current_user: Current authenticated user.

    Returns:
        Updated Profile object.
    """
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can update persona hints.",
        )

    try:
        profile = profile_manager.read_profile(profile_id)
    except ProfileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if profile.owner_id and current_user.role == "teacher":
        if profile.owner_id != current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update your own profiles.",
            )

    # Update persona hints
    updated_profile = profile.model_copy(update={"persona_hints": req.persona_hints})
    return profile_manager.save_profile(updated_profile)


@router.put(
    "/{profile_id}/curriculum",
    response_model=Profile,
    summary="更新Profile的学习步骤",
)
def update_curriculum(
    profile_id: str,
    req: UpdateCurriculumRequest,
    profile_manager: ProfileManagerDep,
    current_user: User = Depends(get_current_user),
) -> Profile:
    """Update curriculum for a profile.

    Args:
        profile_id: The profile ID to update.
        req: UpdateCurriculumRequest containing new curriculum.
        profile_manager: Injected ProfileManager instance.
        current_user: Current authenticated user.

    Returns:
        Updated Profile object.
    """
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can update curriculum.",
        )

    try:
        profile = profile_manager.read_profile(profile_id)
    except ProfileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if profile.owner_id and current_user.role == "teacher":
        if profile.owner_id != current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update your own profiles.",
            )

    # Update curriculum - SocraticCurriculum is a RootModel, so model_dump() returns the list directly
    curriculum_list = req.curriculum.model_dump()

    # Create SocraticCurriculum object for the Profile (Profile.curriculum expects SocraticCurriculum, not list)
    curriculum_obj = SocraticCurriculum(curriculum_list)

    updated_profile = profile.model_copy(update={"curriculum": curriculum_obj})
    return profile_manager.save_profile(updated_profile)


@router.delete(
    "/{profile_id}",
    summary="删除Profile",
)
def delete_profile(
    profile_id: str,
    profile_manager: ProfileManagerDep,
    current_user: User = Depends(get_current_user),
) -> dict:
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can delete profiles.",
        )

    try:
        profile = profile_manager.read_profile(profile_id)
    except ProfileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if profile.owner_id and current_user.role == "teacher":
        if profile.owner_id != current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own profiles.",
            )

    profile_manager.delete_profile(profile_id)

    return {"success": True, "message": "Profile deleted successfully"}


@router.post("/upload-lab-manual", summary="上传实验文档")
async def upload_lab_manual(
    file: UploadFile = File(..., description="Lab manual file (markdown or text)"),
    lab_name: str = Form(..., description="Lab directory name in data/documents"),
    current_user: User = Depends(get_current_user),
    background_tasks: BackgroundTasks = None,
    document_manager: DocumentManagerDep = None
) -> dict:
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can upload lab manuals.",
        )

    if not lab_name or not lab_name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lab name cannot be empty.",
        )
    
    lab_name = re.sub(r'[^\w\-_\.]', '_', lab_name.strip())

    # ✅ 检查当前用户是否已有同名文档
    existing_doc = document_manager.get_document_by_owner_and_name(
        current_user.user_id, 
        lab_name
    )
    if existing_doc:
        raise HTTPException(
            status_code=400,
            detail=f"Document with name '{lab_name}' already exists in your document domain."
        )
    
    # ✅ 检查文件系统是否已存在同名文档（防止数据库记录丢失但文件存在的情况）
    user_doc_dir = DOCUMENTS_DIR / current_user.user_id / lab_name
    lab_manual_path = user_doc_dir / "lab_manual.md"
    pdf_path = user_doc_dir / f"{lab_name}.pdf"
    if lab_manual_path.exists() or pdf_path.exists():
        raise HTTPException(
            status_code=400,
            detail=f"Document '{lab_name}' already exists in file system. Please delete it first or use a different name."
        )

    allowed_extensions = [".md", ".txt", ".markdown", ".tex", ".pdf"]
    
    file_extension = ""
    if file.filename:
        file_extension = file.filename.lower().split(".")[-1]
        if f".{file_extension}" not in allowed_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type. Allowed types: {', '.join(allowed_extensions)}",
            )

    try:
        content = await file.read()
        
        # PDF文件大小检查
        if file_extension == "pdf" and len(content) > MAX_PDF_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"PDF file size exceeds maximum allowed size of {MAX_PDF_SIZE / 1024 / 1024}MB"
            )
        
        # PDF文件类型验证（使用文件头）
        if file_extension == "pdf":
            if not content.startswith(b'%PDF'):
                raise HTTPException(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    detail="Invalid PDF file format"
                )
        
        # ✅ 使用用户ID组织目录结构（确保目录存在）
        user_doc_dir.mkdir(parents=True, exist_ok=True)
        
        # 文件类型处理分支
        if file_extension == "pdf":
            # PDF文件处理
            try:
                with pdfplumber.open(io.BytesIO(content)) as pdf:
                    text_parts = []
                    for page_num, page in enumerate(pdf.pages, 1):
                        # 使用layout=True保持布局顺序
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
                    
                    # 检查提取的文本是否为空或过短
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
            except Exception as e:
                logger.error(f"PDF extraction failed: {e}", exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to extract text from PDF: {str(e)}"
                )
            
            # 保存原始PDF文件
            pdf_path = user_doc_dir / f"{lab_name}.pdf"
            with open(pdf_path, "wb") as f:
                f.write(content)
            
            # 保存提取的文本
            lab_manual_path = user_doc_dir / "lab_manual.md"
            with open(lab_manual_path, "w", encoding="utf-8") as f:
                f.write(content_str)
            
            # 记录PDF文件路径
            pdf_relative_path = f"data/documents/{current_user.user_id}/{lab_name}/{lab_name}.pdf"
            text_relative_path = f"data/documents/{current_user.user_id}/{lab_name}/lab_manual.md"
            
        else:
            # 现有的文本文件处理逻辑
            content_str = content.decode("utf-8")
            
            if not content_str.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File is empty.",
                )
            
            lab_manual_path = user_doc_dir / "lab_manual.md"
            with open(lab_manual_path, "w", encoding="utf-8") as f:
                f.write(content_str)
            
            text_relative_path = f"data/documents/{current_user.user_id}/{lab_name}/lab_manual.md"
            pdf_relative_path = None
        
        # 创建文档记录
        relative_path = text_relative_path  # 主要路径指向文本文件
        meta_info = {
            "uploader": current_user.username,
            "original_format": file_extension,
        }
        
        if pdf_relative_path:
            meta_info["pdf_path"] = pdf_relative_path
            meta_info["text_path"] = text_relative_path
        
        document_manager.create_document(
            owner_id=current_user.user_id,  # ✅ 设置所有者
            doc_name=lab_name,
            filename=file.filename or f"{lab_name}.{file_extension}",
            storage_path=relative_path,
            meta_info=meta_info
        )

        logger.info(
            "Lab manual uploaded by user %s: %s -> %s",
            current_user.username,
            file.filename,
            lab_manual_path,
        )

        # ✅ 构建索引路径
        index_path = f"data/vector_stores/{current_user.user_id}/{lab_name}"
        
        # 更新文档的索引路径
        document_manager.update_index_path(
            lab_name, 
            index_path, 
            owner_id=current_user.user_id
        )

        if background_tasks is not None:
            # ✅ 传递owner_id和lab_name给索引构建函数
            background_tasks.add_task(
                build_lab_manual_index, 
                current_user.user_id, 
                lab_name
            )

        return {
            "success": True,
            "message": "Lab manual uploaded successfully",
            "lab_name": lab_name,
            "owner_id": current_user.user_id,  # ✅ 返回所有者信息
            "saved_path": relative_path,
            "pdf_path": pdf_relative_path,  # 如果是PDF
            "size": len(content_str),
            "rag_status": "building",
        }
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be UTF-8 encoded text.",
        )
    except Exception as e:
        logger.error("Failed to upload lab manual: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload lab manual: {str(e)}",
        )


@router.post("/generate", response_model=Profile, summary="生成Profile")
async def generate_profile(
    req: GenerateProfileRequest,
    profile_manager: ProfileManagerDep,
    current_user: User = Depends(get_current_user),
) -> Profile:
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can generate profiles.",
        )

    if not req.lab_manual_content or not req.lab_manual_content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lab manual content cannot be empty.",
        )

    try:
        lab_name = None
        if req.lab_name:
            import re
            lab_name = re.sub(r"[^\w\-_\.]", "_", req.lab_name.strip())

        if not req.profile_name:
            import uuid
            from pathlib import Path
            base_filename = "lab_manual"
            if req.filename:
                base_filename = Path(req.filename).stem
            profile_name = f"{current_user.username}_{base_filename}_{str(uuid.uuid4())[:8]}"
        else:
            profile_name = req.profile_name

        output_language = req.output_language or DEFAULT_OUTPUT_LANGUAGE
        profile_generator = ProfileGenerateManager(
            req.lab_manual_content, output_language=output_language
        )

        # Compile but DO NOT save to file (logic in ProfileGenerateManager needs update)
        # We will update ProfileGenerateManager to respect output_dir=None means no save,
        # or we update compile_profile to just return.
        # Assuming we update ProfileGenerateManager to just return if output_dir is None,
        # or we manually save.

        # NOTE: ProfileGenerateManager.compile_profile currently saves.
        # I will update it to NOT save if output_dir is None, or similar.
        # For now, I'll pass a dummy path or better yet, I will update ProfileGenerateManager
        # to accept a flag or just separate generation from saving.

        # Let's assume ProfileGenerateManager.compile_profile is updated to have a 'save=False' param
        # or we just rely on it returning the object and we ignore the file it might create (cleanup?)
        # Better: I will update ProfileGenerateManager next.

        profile = await profile_generator.compile_profile(
            profile_name=profile_name,
            lab_name=lab_name,
            output_dir=None, # Signal to not save to file
        )
        profile = profile.model_copy(
            update={
                "owner_id": current_user.user_id,
                "visible_class_ids": [],
                "document_id": doc.id,
            }
        )

        # Save to DB
        saved_profile = profile_manager.save_profile(profile)

        return saved_profile
    except Exception as e:
        logger.error("Failed to generate profile: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate profile: {str(e)}",
        )


@router.get("/lab-manuals/{lab_name}/persona", response_model=TutorPersona, summary="获取Persona")
def get_persona(
    lab_name: str,
    current_user: User = Depends(get_current_user),
    document_manager: DocumentManagerDep = None
) -> TutorPersona:
    # ✅ 检查文档访问权限
    doc = check_document_access(document_manager, lab_name, current_user)
    
    # ✅ 使用文档的存储路径
    persona_path = Path(doc.storage_path).parent / "definition.json"
    if not persona_path.is_absolute():
        persona_path = ROOT_DIR / persona_path

    if not persona_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Persona not found for lab '{lab_name}'. Please generate it first.",
        )

    try:
        with open(persona_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return TutorPersona.model_validate(data)
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))


@router.post("/lab-manuals/{lab_name}/persona", response_model=TutorPersona, summary="保存Persona")
def save_persona(
    lab_name: str,
    persona: TutorPersona,
    current_user: User = Depends(get_current_user),
    document_manager: DocumentManagerDep = None
) -> TutorPersona:
    # ✅ 检查文档访问权限
    doc = check_document_access(document_manager, lab_name, current_user)
    
    # ✅ 使用文档的存储路径
    lab_dir = Path(doc.storage_path).parent
    if not lab_dir.is_absolute():
        lab_dir = ROOT_DIR / lab_dir
    
    if not lab_dir.exists():
        raise HTTPException(status_code=404, detail="Lab not found")

    persona_path = lab_dir / "definition.json"
    try:
        with open(persona_path, "w", encoding="utf-8") as f:
            json.dump(persona.model_dump(), f, ensure_ascii=False, indent=2)
        return persona
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/lab-manuals/{lab_name}/curriculum", response_model=SocraticCurriculum, summary="获取Curriculum")
def get_curriculum(
    lab_name: str,
    current_user: User = Depends(get_current_user),
    document_manager: DocumentManagerDep = None
) -> SocraticCurriculum:
    # ✅ 检查文档访问权限
    doc = check_document_access(document_manager, lab_name, current_user)
    
    # ✅ 使用文档的存储路径
    curriculum_path = Path(doc.storage_path).parent / "curriculum.json"
    if not curriculum_path.is_absolute():
        curriculum_path = ROOT_DIR / curriculum_path
    if not curriculum_path.exists():
        raise HTTPException(
            status_code=404, 
            detail=f"Curriculum not found for lab '{lab_name}'. Please generate it first."
        )

    try:
        with open(curriculum_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return SocraticCurriculum.model_validate(data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/lab-manuals/{lab_name}/curriculum", response_model=SocraticCurriculum, summary="保存Curriculum")
def save_curriculum(
    lab_name: str,
    curriculum_data: dict = Body(...),
    current_user: User = Depends(get_current_user),
    document_manager: DocumentManagerDep = None
) -> SocraticCurriculum:
    # ✅ 检查文档访问权限
    doc = check_document_access(document_manager, lab_name, current_user)
    
    # ✅ 使用文档的存储路径
    lab_dir = Path(doc.storage_path).parent
    if not lab_dir.is_absolute():
        lab_dir = ROOT_DIR / lab_dir
    
    if not lab_dir.exists():
        raise HTTPException(status_code=404, detail="Lab not found")

    try:
        if isinstance(curriculum_data, dict) and "root" in curriculum_data:
            curriculum = SocraticCurriculum.model_validate(curriculum_data["root"])
        elif isinstance(curriculum_data, list):
            curriculum = SocraticCurriculum.model_validate(curriculum_data)
        else:
            curriculum = SocraticCurriculum.model_validate(curriculum_data)
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))

    curriculum_path = lab_dir / "curriculum.json"
    try:
        with open(curriculum_path, "w", encoding="utf-8") as f:
            json.dump(curriculum.model_dump(), f, ensure_ascii=False, indent=2)
        return curriculum
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/lab-manuals/{lab_name}/generate-persona", response_model=TutorPersona, summary="生成Persona")
async def generate_persona_endpoint(
    lab_name: str,
    output_language: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    document_manager: DocumentManagerDep = None
) -> TutorPersona:
    # ✅ 检查文档访问权限
    doc = check_document_access(document_manager, lab_name, current_user)
    
    # ✅ 使用文档的存储路径
    lab_manual_path = Path(doc.storage_path)
    if not lab_manual_path.is_absolute():
        lab_manual_path = ROOT_DIR / lab_manual_path
    
    if not lab_manual_path.exists():
        raise HTTPException(status_code=404, detail="Lab manual not found")

    try:
        with open(lab_manual_path, "r", encoding="utf-8") as f:
            content = f.read()
        output_language = output_language or DEFAULT_OUTPUT_LANGUAGE
        pg = ProfileGenerateManager(content, output_language=output_language)
        persona = await pg.generate_persona()

        lab_dir = lab_manual_path.parent
        with open(lab_dir / "definition.json", "w", encoding="utf-8") as f:
            json.dump(persona.model_dump(), f, ensure_ascii=False, indent=2)
        return persona
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/lab-manuals/{lab_name}/generate-curriculum", response_model=SocraticCurriculum, summary="生成Curriculum")
async def generate_curriculum_endpoint(
    lab_name: str,
    output_language: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    document_manager: DocumentManagerDep = None
) -> SocraticCurriculum:
    # ✅ 检查文档访问权限
    doc = check_document_access(document_manager, lab_name, current_user)
    
    # ✅ 使用文档的存储路径
    lab_manual_path = Path(doc.storage_path)
    if not lab_manual_path.is_absolute():
        lab_manual_path = ROOT_DIR / lab_manual_path
    
    if not lab_manual_path.exists():
        raise HTTPException(status_code=404, detail="Lab manual not found")

    try:
        with open(lab_manual_path, "r", encoding="utf-8") as f:
            content = f.read()
        output_language = output_language or DEFAULT_OUTPUT_LANGUAGE
        pg = ProfileGenerateManager(content, output_language=output_language)
        curriculum = await pg.generate_curriculum()

        lab_dir = lab_manual_path.parent
        with open(lab_dir / "curriculum.json", "w", encoding="utf-8") as f:
            json.dump(curriculum.model_dump(), f, ensure_ascii=False, indent=2)
        return curriculum
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/lab-manuals/{lab_name}/generate-profile", response_model=Profile, summary="生成Profile")
async def generate_profile_from_lab(
    lab_name: str,
    req: GenerateProfileFromLabRequest,
    profile_manager: ProfileManagerDep,
    current_user: User = Depends(get_current_user),
    document_manager: DocumentManagerDep = None,
) -> Profile:
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    # ✅ 检查文档访问权限
    doc = check_document_access(document_manager, lab_name, current_user)
    
    # ✅ 使用文档的存储路径
    lab_manual_path = Path(doc.storage_path)
    if not lab_manual_path.is_absolute():
        lab_manual_path = ROOT_DIR / lab_manual_path
    
    lab_dir = lab_manual_path.parent
    if not lab_dir.exists():
        raise HTTPException(status_code=404, detail="Lab not found")

    # Load intermediates from file
    try:
        with open(lab_dir / "definition.json", "r", encoding="utf-8") as f:
            persona = TutorPersona.model_validate(json.load(f))
        with open(lab_dir / "curriculum.json", "r", encoding="utf-8") as f:
            curriculum = SocraticCurriculum.model_validate(json.load(f))
        with open(lab_manual_path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Files missing: {str(e)}")

    profile_name = req.profile_name
    if not profile_name:
        import uuid
        profile_name = f"{current_user.username}_{lab_name}_{str(uuid.uuid4())[:8]}"

    try:
        output_language = req.output_language or DEFAULT_OUTPUT_LANGUAGE
        pg = ProfileGenerateManager(content, output_language=output_language)
        profile = await pg.compile_profile(
            curriculum=curriculum,
            definition=persona,
            profile_name=profile_name,
            lab_name=lab_name,
            output_dir=None, # No file save
        )
        profile = profile.model_copy(
            update={
                "owner_id": current_user.user_id,
                "visible_class_ids": [],
            }
        )

        # Save to DB
        saved_profile = profile_manager.save_profile(profile)
        return saved_profile
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
