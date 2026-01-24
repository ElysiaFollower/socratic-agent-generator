"""Session management routes.

This module handles HTTP endpoints for learning session operations.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException

from api.routes.auth import get_current_user
from core.dependencies import (
    ProfileManagerDep,
    SessionManagerDep,
    TutorManagerDep,
    ClassManagerDep,
    StepCompletionManagerDep,
)
from core.exceptions import ProfileNotFoundError, SessionNotFoundError
from schemas.message import CreateSessionRequest, RenameSessionRequest, UpdateSessionLanguageRequest
from schemas.session import Session, SessionSummary
from schemas.step_completion import StepCompletion
from schemas.user import User

router = APIRouter(prefix="/api/sessions", tags=["Session"])


@router.get("", response_model=List[SessionSummary], summary="获取所有会话元信息列表")
def list_sessions(
    session_manager: SessionManagerDep,
    current_user: User = Depends(get_current_user),
) -> List[SessionSummary]:
    """List all available sessions.

    Args:
        session_manager: Injected SessionManager instance.

    Returns:
        List of SessionSummary objects.
    """
    return session_manager.list_sessions(current_user.user_id)


@router.post("/create", summary="创建一个新的会话")
def create_session(
    req: CreateSessionRequest,
    profile_manager: ProfileManagerDep,
    tutor_manager: TutorManagerDep,
    class_manager: ClassManagerDep,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Create a new learning session.

    Args:
        req: CreateSessionRequest containing profile_id, session_name,
            and output_language.
        profile_manager: Injected ProfileManager instance.
        tutor_manager: Injected TutorManager instance.

    Returns:
        Dictionary containing the session_id.

    Raises:
        HTTPException: 404 if profile not found.
    """
    try:
        profile = profile_manager.read_profile(req.profile_id)
    except ProfileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if current_user.role == "student":
        class_ids = class_manager.list_class_ids_for_user(current_user.user_id)
        visible_ids = set(profile.visible_class_ids or [])
        if not visible_ids.intersection(set(class_ids)):
            raise HTTPException(
                status_code=403,
                detail="Profile is not visible to your classes.",
            )
    elif current_user.role == "teacher":
        if profile.owner_id and profile.owner_id != current_user.user_id:
            raise HTTPException(
                status_code=403,
                detail="You can only use your own profiles.",
            )

    tutor = tutor_manager.create_tutor(
        profile=profile,
        session_name=req.session_name,
        output_language=req.output_language,
        owner_id=current_user.user_id,
    )
    return {"session_id": tutor.session.session_id}


@router.get("/{session_id}", response_model=Session, summary="获取一个会话的详细信息")
def get_session(
    session_id: str,
    session_manager: SessionManagerDep,
    current_user: User = Depends(get_current_user),
) -> Session:
    """Get detailed information about a session.

    Args:
        session_id: The ID of the session.
        session_manager: Injected SessionManager instance.

    Returns:
        Session object.

    Raises:
        HTTPException: 404 if session not found.
    """
    try:
        return session_manager.read_session(
            session_id, owner_id=current_user.user_id
        )
    except SessionNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get(
    "/{session_id}/step-completions",
    response_model=List[StepCompletion],
    summary="获取会话的步骤完成记录",
)
def list_step_completions(
    session_id: str,
    session_manager: SessionManagerDep,
    step_completion_manager: StepCompletionManagerDep,
    current_user: User = Depends(get_current_user),
) -> List[StepCompletion]:
    """List step completion records for a session."""
    try:
        session_manager.read_session(
            session_id, owner_id=current_user.user_id
        )
    except SessionNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    records = step_completion_manager.list_completions(session_id)
    return [
        StepCompletion(step_index=record.step_index, message_id=record.message_id)
        for record in records
    ]


@router.put("/{session_id}/rename", summary="重命名会话")
def rename_session(
    session_id: str,
    req: RenameSessionRequest,
    session_manager: SessionManagerDep,
    tutor_manager: TutorManagerDep,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Rename a session.

    Args:
        session_id: The ID of the session to rename.
        req: RenameSessionRequest containing the new session_name.
        session_manager: Injected SessionManager instance.
        tutor_manager: Injected TutorManager instance.

    Returns:
        Success message.

    Raises:
        HTTPException: 404 if session not found.
    """
    try:
        session_manager.rename_session(
            session_id, req.session_name, owner_id=current_user.user_id
        )
        tutor_manager.remove_from_cache(
            session_id, owner_id=current_user.user_id
        )
        return {"success": True, "message": "会话重命名成功"}
    except SessionNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put(
    "/{session_id}/output-language",
    summary="更新会话输出语言"
)
def update_session_language(
    session_id: str,
    req: UpdateSessionLanguageRequest,
    session_manager: SessionManagerDep,
    tutor_manager: TutorManagerDep,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Update output language for a session.

    Args:
        session_id: The ID of the session to update.
        req: UpdateSessionLanguageRequest containing new output_language.
        session_manager: Injected SessionManager instance.
        tutor_manager: Injected TutorManager instance.
        current_user: Current authenticated user.

    Returns:
        Success message with updated output_language.

    Raises:
        HTTPException: 404 if session not found.
    """
    try:
        session_manager.update_output_language(
            session_id,
            req.output_language,
            owner_id=current_user.user_id
        )
        # 清除 Tutor 缓存，强制重新加载（会读取新的 output_language）
        tutor_manager.remove_from_cache(
            session_id, owner_id=current_user.user_id
        )
        return {
            "success": True,
            "message": "输出语言更新成功",
            "output_language": req.output_language
        }
    except SessionNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{session_id}", summary="删除会话")
def delete_session(
    session_id: str,
    session_manager: SessionManagerDep,
    tutor_manager: TutorManagerDep,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Delete a session.

    Args:
        session_id: The ID of the session to delete.
        session_manager: Injected SessionManager instance.
        tutor_manager: Injected TutorManager instance.

    Returns:
        Success message.
    """
    tutor_manager.remove_from_cache(
        session_id, owner_id=current_user.user_id
    )
    session_manager.delete_session(
        session_id, owner_id=current_user.user_id
    )
    return {"success": True, "message": "会话删除成功"}
