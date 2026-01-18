"""Profile management routes.

This module handles HTTP endpoints for tutor profile operations.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Body, Depends, File, Form, HTTPException, UploadFile, status

import json
from pathlib import Path

from api.routes.auth import get_current_user
from config import PROFILES_DIR, RAW_DATA_DIR
from core.dependencies import ProfileManagerDep
from core.exceptions import ProfileNotFoundError
from generators.ProfileGenerateManager import ProfileGenerateManager
from pydantic import BaseModel, Field
from schemas.curriculum import SocraticCurriculum
from schemas.definition import TutorPersona
from schemas.profile import Profile
from schemas.user import User
from utils.skills import build_lab_manual_index

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/profiles", tags=["Profile"])


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


@router.get("", response_model=List[Profile], summary="获取所有可用的导师配置列表")
def list_profiles(profile_manager: ProfileManagerDep) -> List[Profile]:
    """List all available tutor profiles.

    Args:
        profile_manager: Injected ProfileManager instance.

    Returns:
        List of Profile objects.
    """
    return profile_manager.list_profiles()


@router.get("/lab-manuals", summary="列出所有实验文档")
def list_lab_manuals(
    current_user: User = Depends(get_current_user),
) -> List[dict]:
    """List all lab manuals in data_raw directory.

    Only admins and teachers can list lab manuals.

    Args:
        current_user: Current authenticated user from dependency.

    Returns:
        List of lab manual directories with metadata.

    Raises:
        HTTPException: 403 if user doesn't have permission.
    """
    # Check permissions
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can list lab manuals.",
        )

    lab_manuals = []
    if RAW_DATA_DIR.exists():
        for lab_dir in RAW_DATA_DIR.iterdir():
            if lab_dir.is_dir() and not lab_dir.name.startswith('.'):
                lab_manual_path = lab_dir / "lab_manual.md"
                has_persona = (lab_dir / "definition.json").exists()
                has_curriculum = (lab_dir / "curriculum.json").exists()
                
                lab_manuals.append({
                    "lab_name": lab_dir.name,
                    "has_lab_manual": lab_manual_path.exists(),
                    "has_persona": has_persona,
                    "has_curriculum": has_curriculum,
                })
    
    logger.info("Found %d lab manuals in %s", len(lab_manuals), RAW_DATA_DIR)
    return sorted(lab_manuals, key=lambda x: x["lab_name"])


@router.get("/lab-manuals/{lab_name}/content", summary="获取实验文档内容")
def get_lab_manual_content(
    lab_name: str,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Get the content of a lab manual file.

    Only admins and teachers can access lab manual content.

    Args:
        lab_name: Name of the lab directory.
        current_user: Current authenticated user from dependency.

    Returns:
        Dictionary with lab_name and content.

    Raises:
        HTTPException: 403 if user doesn't have permission.
        HTTPException: 404 if lab or lab manual not found.
    """
    # Check permissions
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can access lab manuals.",
        )

    lab_dir = RAW_DATA_DIR / lab_name
    if not lab_dir.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lab '{lab_name}' not found.",
        )

    lab_manual_path = lab_dir / "lab_manual.md"
    if not lab_manual_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lab manual not found for lab '{lab_name}'.",
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
) -> dict:
    """Delete a lab manual directory and all its contents.

    Only admins and teachers can delete lab manuals.

    Args:
        lab_name: Name of the lab directory to delete.
        current_user: Current authenticated user from dependency.

    Returns:
        Dictionary with success message.

    Raises:
        HTTPException: 403 if user doesn't have permission.
        HTTPException: 404 if lab not found.
    """
    import shutil

    # Check permissions
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can delete lab manuals.",
        )

    lab_dir = RAW_DATA_DIR / lab_name
    if not lab_dir.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lab '{lab_name}' not found.",
        )

    try:
        # Delete the entire lab directory
        shutil.rmtree(lab_dir)
        logger.info(
            "Lab manual directory deleted by user %s: %s",
            current_user.username,
            lab_dir,
        )
        return {
            "success": True,
            "message": f"Lab manual '{lab_name}' deleted successfully.",
            "lab_name": lab_name,
        }
    except Exception as e:
        logger.error("Failed to delete lab manual: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete lab manual: {str(e)}",
        )


@router.get("/{profile_id}", response_model=Profile, summary="获取指定导师的完整配置")
def get_profile(profile_id: str, profile_manager: ProfileManagerDep) -> Profile:
    """Get a specific tutor profile by ID.

    Args:
        profile_id: The ID of the profile to retrieve.
        profile_manager: Injected ProfileManager instance.

    Returns:
        Profile object.

    Raises:
        HTTPException: 404 if profile not found.
    """
    try:
        return profile_manager.read_profile(profile_id)
    except ProfileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/upload-lab-manual", summary="上传实验文档")
async def upload_lab_manual(
    file: UploadFile = File(..., description="Lab manual file (markdown or text)"),
    lab_name: str = Form(..., description="Lab directory name in data_raw"),
    current_user: User = Depends(get_current_user),
    background_tasks: BackgroundTasks = None,
) -> dict:
    """Upload a lab manual file and save it to data_raw directory.

    Only admins and teachers can upload lab manuals.
    The file will be saved to data_raw/{lab_name}/lab_manual.md.

    Args:
        file: The uploaded lab manual file.
        lab_name: Name of the lab directory (will be created if not exists).
        current_user: Current authenticated user from dependency.

    Returns:
        Dictionary with success message and saved path.

    Raises:
        HTTPException: 403 if user doesn't have permission.
        HTTPException: 400 if file is invalid or lab_name is invalid.
        HTTPException: 500 if upload fails.
    """
    from pathlib import Path
    from config import RAW_DATA_DIR

    # Check permissions
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can upload lab manuals.",
        )

    # Validate lab_name (basic sanitization)
    if not lab_name or not lab_name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lab name cannot be empty.",
        )
    
    # Sanitize lab_name: remove invalid characters
    import re
    lab_name = re.sub(r'[^\w\-_\.]', '_', lab_name.strip())
    if not lab_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lab name contains only invalid characters.",
        )

    # Validate file type
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
        # Read file content
        content = await file.read()
        content_str = content.decode("utf-8")

        if not content_str.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File is empty.",
            )

        # Create lab directory in data_raw
        lab_dir = RAW_DATA_DIR / lab_name
        lab_dir.mkdir(parents=True, exist_ok=True)

        # Save file as lab_manual.md
        lab_manual_path = lab_dir / "lab_manual.md"
        with open(lab_manual_path, "w", encoding="utf-8") as f:
            f.write(content_str)

        logger.info(
            "Lab manual uploaded by user %s: %s -> %s (%d bytes)",
            current_user.username,
            file.filename,
            lab_manual_path,
            len(content_str),
        )

        if background_tasks is not None:
            background_tasks.add_task(build_lab_manual_index, lab_name)

        return {
            "success": True,
            "message": "Lab manual uploaded successfully",
            "lab_name": lab_name,
            "saved_path": str(lab_manual_path.relative_to(RAW_DATA_DIR.parent)),
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
    """Generate a tutor profile from lab manual content.

    Only admins and teachers can generate profiles.

    Args:
        req: GenerateProfileRequest containing lab manual content and optional profile name.
        current_user: Current authenticated user from dependency.
        profile_manager: Injected ProfileManager instance.

    Returns:
        Generated Profile object.

    Raises:
        HTTPException: 403 if user doesn't have permission.
        HTTPException: 400 if lab manual content is invalid.
        HTTPException: 500 if generation fails.
    """
    # Check permissions
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can generate profiles.",
        )

    # Validate content
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
            if not lab_name:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Lab name contains only invalid characters.",
                )

        # Auto-generate profile_name if not provided
        if not req.profile_name:
            import uuid
            from pathlib import Path
            
            # Extract base filename without extension
            base_filename = "lab_manual"
            if req.filename:
                base_filename = Path(req.filename).stem
            
            # Generate unique profile name: username_filename_uuid
            profile_name = f"{current_user.username}_{base_filename}_{str(uuid.uuid4())[:8]}"
            logger.info(
                "Auto-generating profile_name: %s (user: %s, filename: %s)",
                profile_name,
                current_user.username,
                req.filename,
            )
        else:
            profile_name = req.profile_name

        logger.info(
            "Generating profile for user %s (profile_name: %s)",
            current_user.username,
            profile_name,
        )

        # Create ProfileGenerateManager
        profile_generator = ProfileGenerateManager(req.lab_manual_content)

        # Generate profile with auto-generated or provided profile_name
        output_dir = PROFILES_DIR / lab_name if lab_name else None
        profile = await profile_generator.compile_profile(
            profile_name=profile_name,
            lab_name=lab_name,
            output_dir=output_dir,
        )

        logger.info(
            "Profile generated successfully: %s (profile_id: %s)",
            profile.profile_name or profile.topic_name,
            profile.profile_id,
        )

        # Note: ProfileManager.list_profiles() scans filesystem each time,
        # so no cache refresh is needed.

        return profile
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
) -> TutorPersona:
    """Get persona (definition.json) for a lab manual.

    Args:
        lab_name: Name of the lab directory.
        current_user: Current authenticated user from dependency.

    Returns:
        TutorPersona object.

    Raises:
        HTTPException: 403 if user doesn't have permission.
        HTTPException: 404 if lab or persona not found.
    """
    # Check permissions
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can access lab manuals.",
        )

    lab_dir = RAW_DATA_DIR / lab_name
    if not lab_dir.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lab '{lab_name}' not found.",
        )

    persona_path = lab_dir / "definition.json"
    if not persona_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Persona not found for lab '{lab_name}'.",
        )

    try:
        with open(persona_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return TutorPersona.model_validate(data)
    except (json.JSONDecodeError, Exception) as e:
        logger.error("Failed to load persona: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load persona: {str(e)}",
        )


@router.post("/lab-manuals/{lab_name}/persona", response_model=TutorPersona, summary="保存Persona")
def save_persona(
    lab_name: str,
    persona: TutorPersona,
    current_user: User = Depends(get_current_user),
) -> TutorPersona:
    """Save persona (definition.json) for a lab manual.

    Args:
        lab_name: Name of the lab directory.
        persona: TutorPersona object to save.
        current_user: Current authenticated user from dependency.

    Returns:
        Saved TutorPersona object.

    Raises:
        HTTPException: 403 if user doesn't have permission.
        HTTPException: 404 if lab not found.
    """
    # Check permissions
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can save lab manuals.",
        )

    lab_dir = RAW_DATA_DIR / lab_name
    if not lab_dir.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lab '{lab_name}' not found.",
        )

    persona_path = lab_dir / "definition.json"
    try:
        with open(persona_path, "w", encoding="utf-8") as f:
            json.dump(persona.model_dump(), f, ensure_ascii=False, indent=2)
        logger.info("Persona saved to %s", persona_path)
        return persona
    except Exception as e:
        logger.error("Failed to save persona: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save persona: {str(e)}",
        )


@router.get("/lab-manuals/{lab_name}/curriculum", response_model=SocraticCurriculum, summary="获取Curriculum")
def get_curriculum(
    lab_name: str,
    current_user: User = Depends(get_current_user),
) -> SocraticCurriculum:
    """Get curriculum (curriculum.json) for a lab manual.

    Args:
        lab_name: Name of the lab directory.
        current_user: Current authenticated user from dependency.

    Returns:
        SocraticCurriculum object.

    Raises:
        HTTPException: 403 if user doesn't have permission.
        HTTPException: 404 if lab or curriculum not found.
    """
    # Check permissions
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can access lab manuals.",
        )

    lab_dir = RAW_DATA_DIR / lab_name
    if not lab_dir.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lab '{lab_name}' not found.",
        )

    curriculum_path = lab_dir / "curriculum.json"
    if not curriculum_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Curriculum not found for lab '{lab_name}'.",
        )

    try:
        with open(curriculum_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return SocraticCurriculum.model_validate(data)
    except (json.JSONDecodeError, Exception) as e:
        logger.error("Failed to load curriculum: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load curriculum: {str(e)}",
        )


@router.post("/lab-manuals/{lab_name}/curriculum", response_model=SocraticCurriculum, summary="保存Curriculum")
def save_curriculum(
    lab_name: str,
    curriculum_data: dict = Body(...),
    current_user: User = Depends(get_current_user),
) -> SocraticCurriculum:
    """Save curriculum (curriculum.json) for a lab manual.

    Args:
        lab_name: Name of the lab directory.
        curriculum_data: Curriculum data (can be {root: [...]} or direct array).
        current_user: Current authenticated user from dependency.

    Returns:
        Saved SocraticCurriculum object.

    Raises:
        HTTPException: 403 if user doesn't have permission.
        HTTPException: 404 if lab not found.
        HTTPException: 422 if curriculum data is invalid.
    """
    # Check permissions
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can save lab manuals.",
        )

    lab_dir = RAW_DATA_DIR / lab_name
    if not lab_dir.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lab '{lab_name}' not found.",
        )

    # Parse curriculum data - handle both {root: [...]} and direct array formats
    # SocraticCurriculum is RootModel[List[SocraticStep]], so it expects a list directly
    try:
        logger.debug("Received curriculum data type: %s", type(curriculum_data))
        # If data has 'root' key, extract the root list
        if isinstance(curriculum_data, dict) and "root" in curriculum_data:
            root_list = curriculum_data["root"]
            if not isinstance(root_list, list):
                raise ValueError("'root' field must be a list")
            curriculum = SocraticCurriculum.model_validate(root_list)
        # If data is a direct array (RootModel root value)
        elif isinstance(curriculum_data, list):
            curriculum = SocraticCurriculum.model_validate(curriculum_data)
        # Otherwise, try to validate as-is (might be a dict that can be converted)
        else:
            # Try to extract root if it's a dict, otherwise validate directly
            if isinstance(curriculum_data, dict):
                raise ValueError("Expected 'root' field containing a list, or a direct list")
            curriculum = SocraticCurriculum.model_validate(curriculum_data)
        logger.debug("Parsed curriculum successfully, root length: %d", len(curriculum.root))
    except Exception as e:
        logger.error("Failed to parse curriculum data: %s, data type: %s, data: %s", 
                     e, type(curriculum_data), curriculum_data, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid curriculum data format: {str(e)}",
        )

    curriculum_path = lab_dir / "curriculum.json"
    try:
        # Save using model_dump() which will serialize RootModel correctly
        with open(curriculum_path, "w", encoding="utf-8") as f:
            json.dump(curriculum.model_dump(), f, ensure_ascii=False, indent=2)
        logger.info("Curriculum saved to %s", curriculum_path)
        return curriculum
    except Exception as e:
        logger.error("Failed to save curriculum: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save curriculum: {str(e)}",
        )


@router.post("/lab-manuals/{lab_name}/generate-persona", response_model=TutorPersona, summary="生成Persona")
async def generate_persona(
    lab_name: str,
    current_user: User = Depends(get_current_user),
) -> TutorPersona:
    """Generate persona for a lab manual.

    Args:
        lab_name: Name of the lab directory.
        current_user: Current authenticated user from dependency.

    Returns:
        Generated TutorPersona object.

    Raises:
        HTTPException: 403 if user doesn't have permission.
        HTTPException: 404 if lab not found.
        HTTPException: 500 if generation fails.
    """
    # Check permissions
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can generate personas.",
        )

    lab_dir = RAW_DATA_DIR / lab_name
    if not lab_dir.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lab '{lab_name}' not found.",
        )

    lab_manual_path = lab_dir / "lab_manual.md"
    if not lab_manual_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lab manual not found for lab '{lab_name}'.",
        )

    try:
        # Load lab manual content
        with open(lab_manual_path, "r", encoding="utf-8") as f:
            lab_manual_content = f.read()

        # Generate persona
        profile_generator = ProfileGenerateManager(lab_manual_content)
        persona = await profile_generator.generate_persona()

        # Save persona
        persona_path = lab_dir / "definition.json"
        with open(persona_path, "w", encoding="utf-8") as f:
            json.dump(persona.model_dump(), f, ensure_ascii=False, indent=2)

        logger.info("Persona generated and saved for lab '%s'", lab_name)
        return persona
    except Exception as e:
        logger.error("Failed to generate persona: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate persona: {str(e)}",
        )


@router.post("/lab-manuals/{lab_name}/generate-curriculum", response_model=SocraticCurriculum, summary="生成Curriculum")
async def generate_curriculum(
    lab_name: str,
    current_user: User = Depends(get_current_user),
) -> SocraticCurriculum:
    """Generate curriculum for a lab manual.

    Args:
        lab_name: Name of the lab directory.
        current_user: Current authenticated user from dependency.

    Returns:
        Generated SocraticCurriculum object.

    Raises:
        HTTPException: 403 if user doesn't have permission.
        HTTPException: 404 if lab not found.
        HTTPException: 500 if generation fails.
    """
    # Check permissions
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can generate curricula.",
        )

    lab_dir = RAW_DATA_DIR / lab_name
    if not lab_dir.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lab '{lab_name}' not found.",
        )

    lab_manual_path = lab_dir / "lab_manual.md"
    if not lab_manual_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lab manual not found for lab '{lab_name}'.",
        )

    try:
        # Load lab manual content
        with open(lab_manual_path, "r", encoding="utf-8") as f:
            lab_manual_content = f.read()

        # Generate curriculum
        profile_generator = ProfileGenerateManager(lab_manual_content)
        curriculum = await profile_generator.generate_curriculum()

        # Save curriculum
        curriculum_path = lab_dir / "curriculum.json"
        with open(curriculum_path, "w", encoding="utf-8") as f:
            json.dump(curriculum.model_dump(), f, ensure_ascii=False, indent=2)

        logger.info("Curriculum generated and saved for lab '%s'", lab_name)
        return curriculum
    except Exception as e:
        logger.error("Failed to generate curriculum: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate curriculum: {str(e)}",
        )


class GenerateProfileFromLabRequest(BaseModel):
    """Request schema for generating profile from lab."""

    profile_name: Optional[str] = Field(
        default=None,
        description="Optional name for the profile. If None, auto-generated.",
    )


@router.post("/lab-manuals/{lab_name}/generate-profile", response_model=Profile, summary="生成Profile")
async def generate_profile_from_lab(
    lab_name: str,
    req: GenerateProfileFromLabRequest,
    profile_manager: ProfileManagerDep,
    current_user: User = Depends(get_current_user),
) -> Profile:
    """Generate a profile from a lab manual using existing persona and curriculum.

    Args:
        lab_name: Name of the lab directory.
        profile_name: Optional name for the profile. If None, auto-generated.
        current_user: Current authenticated user from dependency.
        profile_manager: Injected ProfileManager instance.

    Returns:
        Generated Profile object.

    Raises:
        HTTPException: 403 if user doesn't have permission.
        HTTPException: 404 if lab, persona, or curriculum not found.
        HTTPException: 500 if generation fails.
    """
    # Check permissions
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can generate profiles.",
        )

    lab_dir = RAW_DATA_DIR / lab_name
    if not lab_dir.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lab '{lab_name}' not found.",
        )

    persona_path = lab_dir / "definition.json"
    curriculum_path = lab_dir / "curriculum.json"

    if not persona_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Persona not found for lab '{lab_name}'. Please generate it first.",
        )

    if not curriculum_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Curriculum not found for lab '{lab_name}'. Please generate it first.",
        )

    try:
        # Load persona and curriculum
        with open(persona_path, "r", encoding="utf-8") as f:
            persona_data = json.load(f)
        persona = TutorPersona.model_validate(persona_data)

        with open(curriculum_path, "r", encoding="utf-8") as f:
            curriculum_data = json.load(f)
        curriculum = SocraticCurriculum.model_validate(curriculum_data)

        # Load lab manual content for ProfileGenerateManager
        lab_manual_path = lab_dir / "lab_manual.md"
        with open(lab_manual_path, "r", encoding="utf-8") as f:
            lab_manual_content = f.read()

        # Auto-generate profile_name if not provided
        profile_name = req.profile_name
        if not profile_name:
            import uuid
            profile_name = f"{current_user.username}_{lab_name}_{str(uuid.uuid4())[:8]}"

        # Generate profile
        profile_generator = ProfileGenerateManager(lab_manual_content)
        profile = await profile_generator.compile_profile(
            curriculum=curriculum,
            definition=persona,
            profile_name=profile_name,
            lab_name=lab_name,
            output_dir=PROFILES_DIR / lab_name,
        )

        logger.info(
            "Profile generated successfully for lab '%s': %s (profile_id: %s)",
            lab_name,
            profile.profile_name or profile.topic_name,
            profile.profile_id,
        )

        return profile
    except Exception as e:
        logger.error("Failed to generate profile: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate profile: {str(e)}",
        )
