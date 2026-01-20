"""Profile management routes.

This module handles HTTP endpoints for tutor profile operations.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Body, Depends, File, Form, HTTPException, UploadFile, status

import json
from pathlib import Path

from api.routes.auth import get_current_user
from config import RAW_DATA_DIR, ROOT_DIR, DOCUMENTS_DIR
from core.dependencies import ProfileManagerDep, DocumentManagerDep, ClassManagerDep
from core.exceptions import ProfileNotFoundError
from generators.ProfileGenerateManager import ProfileGenerateManager
from models.document import Document
from pydantic import BaseModel, Field
from schemas.curriculum import SocraticCurriculum
from schemas.definition import TutorPersona
from schemas.profile import Profile
from schemas.user import User
from utils.skills import build_lab_manual_index

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/profiles", tags=["Profile"])


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


class RenameProfileRequest(BaseModel):
    """Request schema for renaming a profile."""

    profile_name: str = Field(
        description="New profile name.",
        min_length=1,
    )


class GenerateProfileFromLabRequest(BaseModel):
    """Request schema for generating a profile from an existing lab."""

    profile_name: Optional[str] = Field(
        default=None,
        description="Optional name for the profile. If None, auto-generated from username + lab_name + uuid.",
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
        docs = document_manager.list_documents_by_owner(current_user.user_id)
    
    lab_manuals = []
    for doc in docs:
        lab_dir = Path(doc.storage_path).parent
        if not lab_dir.is_absolute():
            lab_dir = ROOT_DIR / lab_dir
        
        # ✅ 检查文件是否存在（使用绝对路径）
        has_persona = (lab_dir / "definition.json").exists()
        has_curriculum = (lab_dir / "curriculum.json").exists()
        has_lab_manual = (lab_dir / "lab_manual.md").exists()
        
        lab_manuals.append({
            "lab_name": doc.doc_name,
            "owner_id": doc.owner_id,  # ✅ 返回所有者信息
            "filename": doc.filename,
            "upload_time": doc.upload_time,
            "has_lab_manual": has_lab_manual,  # ✅ 明确返回是否有lab_manual
            "has_persona": has_persona,
            "has_curriculum": has_curriculum,
        })
    
    return sorted(lab_manuals, key=lambda x: x["lab_name"])


@router.get("/lab-manuals/{lab_name}/content", summary="获取实验文档内容")
def get_lab_manual_content(
    lab_name: str,
    current_user: User = Depends(get_current_user),
    document_manager: DocumentManagerDep = None
) -> dict:
    """Get the content of a lab manual file."""
    # ✅ 检查文档访问权限
    doc = check_document_access(document_manager, lab_name, current_user)
    
    # ✅ 使用文档的存储路径
    lab_manual_path = Path(doc.storage_path)
    if not lab_manual_path.is_absolute():
        lab_manual_path = ROOT_DIR / lab_manual_path
    
    if not lab_manual_path.exists():
         raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lab manual file not found for lab '{lab_name}'.",
        )

    try:
        with open(lab_manual_path, "r", encoding="utf-8") as f:
            content = f.read()
        return {
            "lab_name": lab_name,
            "content": content,
            "size": len(content),
        }
    except Exception as e:
        logger.error("Failed to read lab manual content: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read lab manual content: {str(e)}",
        )


@router.delete("/lab-manuals/{lab_name}", summary="删除实验文档")
def delete_lab_manual(
    lab_name: str,
    current_user: User = Depends(get_current_user),
    document_manager: DocumentManagerDep = None
) -> dict:
    """Delete a lab manual directory and all its contents."""
    import shutil

    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can delete lab manuals.",
        )

    # ✅ 检查文档访问权限
    doc = check_document_access(document_manager, lab_name, current_user)
    
    # ✅ 使用文档的存储路径
    lab_dir = Path(doc.storage_path).parent
    if not lab_dir.is_absolute():
        lab_dir = ROOT_DIR / lab_dir

    # Delete from DB
    document_manager.delete_document(lab_name, current_user.user_id)

    # Delete files
    if lab_dir.exists():
        try:
            shutil.rmtree(lab_dir)
            logger.info(
                "Lab manual directory deleted by user %s: %s",
                current_user.username,
                lab_dir,
            )
        except Exception as e:
            logger.error("Failed to delete lab manual files: %s", e)
            # We continue even if file deletion fails, as DB record is gone

    return {
        "success": True,
        "message": f"Lab manual '{lab_name}' deleted successfully.",
        "lab_name": lab_name,
    }


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
    
    import re
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
    if lab_manual_path.exists():
        raise HTTPException(
            status_code=400,
            detail=f"Document '{lab_name}' already exists in file system. Please delete it first or use a different name."
        )

    allowed_extensions = [".md", ".txt", ".markdown"]
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
        content_str = content.decode("utf-8")

        if not content_str.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File is empty.",
            )

        # ✅ 使用用户ID组织目录结构
        user_doc_dir = DOCUMENTS_DIR / current_user.user_id / lab_name
        user_doc_dir.mkdir(parents=True, exist_ok=True)

        lab_manual_path = user_doc_dir / "lab_manual.md"
        with open(lab_manual_path, "w", encoding="utf-8") as f:
            f.write(content_str)

        # ✅ 创建文档记录，指定所有者
        relative_path = f"data/documents/{current_user.user_id}/{lab_name}/lab_manual.md"
        document_manager.create_document(
            owner_id=current_user.user_id,  # ✅ 设置所有者
            doc_name=lab_name,
            filename=file.filename or "lab_manual.md",
            storage_path=relative_path,
            meta_info={"uploader": current_user.username}
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

        profile_generator = ProfileGenerateManager(req.lab_manual_content)

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
        pg = ProfileGenerateManager(content)
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
        pg = ProfileGenerateManager(content)
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
) -> Profile:
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    lab_dir = RAW_DATA_DIR / lab_name
    if not lab_dir.exists():
        raise HTTPException(status_code=404, detail="Lab not found")

    # Load intermediates from file
    try:
        with open(lab_dir / "definition.json", "r", encoding="utf-8") as f:
            persona = TutorPersona.model_validate(json.load(f))
        with open(lab_dir / "curriculum.json", "r", encoding="utf-8") as f:
            curriculum = SocraticCurriculum.model_validate(json.load(f))
        with open(lab_dir / "lab_manual.md", "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Files missing: {str(e)}")

    profile_name = req.profile_name
    if not profile_name:
        import uuid
        profile_name = f"{current_user.username}_{lab_name}_{str(uuid.uuid4())[:8]}"

    try:
        pg = ProfileGenerateManager(content)
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
