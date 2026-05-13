"""Session management routes.

This module handles HTTP endpoints for learning session operations.
"""

from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from api.routes.auth import get_current_user
from core.dependencies import (
    ProfileManagerDep,
    SessionManagerDep,
    TutorManagerDep,
    ClassManagerDep,
    StepCompletionManagerDep,
    RemoteMachineManagerDep,
    SessionFileManagerDep,
)
from core.exceptions import ProfileNotFoundError, SessionNotFoundError
from schemas.message import CreateSessionRequest, RenameSessionRequest, UpdateSessionLanguageRequest
from schemas.session import Session, SessionSummary
from schemas.step_completion import StepCompletion
from schemas.user import User
from schemas.remote_machine import (
    RemoteCommandAudit,
    SessionFileInfo,
    SessionFileRemotePutRequest,
    SessionFileRemotePutResponse,
    SessionRemoteCommandRequest,
    SessionRemoteCommandResponse,
)
from utils.remote_machine_manager import RemoteBindingNotFoundError, RemoteMachineNotFoundError
from utils.remote_runner_provider import RemoteRunnerError
from utils.session_file_manager import SessionFileError

router = APIRouter(prefix="/api/sessions", tags=["Session"])


def _is_builtin_public_profile(profile) -> bool:
    """Return whether a profile is globally visible without class membership."""
    return profile.owner_id is None and not (profile.visible_class_ids or [])


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
    session_manager: SessionManagerDep,
    tutor_manager: TutorManagerDep,
    class_manager: ClassManagerDep,
    remote_manager: RemoteMachineManagerDep,
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
        if not _is_builtin_public_profile(profile) and not visible_ids.intersection(
            set(class_ids)
        ):
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
    remote_binding = None
    if req.remote_machine_id:
        try:
            remote_binding = remote_manager.create_binding(
                owner_id=current_user.user_id,
                session_id=tutor.session.session_id,
                machine_id=req.remote_machine_id,
            )
            tutor_manager.remove_from_cache(
                tutor.session.session_id,
                owner_id=current_user.user_id,
            )
        except RemoteMachineNotFoundError as exc:
            session_id = tutor.session.session_id
            tutor_manager.remove_from_cache(session_id, owner_id=current_user.user_id)
            session_manager.delete_session(session_id, owner_id=current_user.user_id)
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except RemoteRunnerError as exc:
            session_id = tutor.session.session_id
            tutor_manager.remove_from_cache(session_id, owner_id=current_user.user_id)
            session_manager.delete_session(session_id, owner_id=current_user.user_id)
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "session_id": tutor.session.session_id,
        "remote_binding": remote_binding.model_dump() if remote_binding else None,
    }


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


@router.get(
    "/{session_id}/remote-audits",
    response_model=List[RemoteCommandAudit],
    summary="获取会话的远程命令审计",
)
def list_remote_audits(
    session_id: str,
    session_manager: SessionManagerDep,
    remote_manager: RemoteMachineManagerDep,
    current_user: User = Depends(get_current_user),
) -> List[RemoteCommandAudit]:
    try:
        session_manager.read_session(
            session_id, owner_id=current_user.user_id
        )
    except SessionNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return remote_manager.list_audits(session_id, current_user.user_id)


@router.get(
    "/{session_id}/files",
    response_model=List[SessionFileInfo],
    summary="获取会话文件缓存列表",
)
def list_session_files(
    session_id: str,
    session_manager: SessionManagerDep,
    file_manager: SessionFileManagerDep,
    current_user: User = Depends(get_current_user),
) -> List[SessionFileInfo]:
    try:
        session_manager.read_session(
            session_id, owner_id=current_user.user_id
        )
    except SessionNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return file_manager.list_files(
        owner_id=current_user.user_id,
        session_id=session_id,
    )


@router.post(
    "/{session_id}/files",
    response_model=SessionFileInfo,
    summary="上传文件到会话缓存",
)
def upload_session_file(
    session_id: str,
    session_manager: SessionManagerDep,
    file_manager: SessionFileManagerDep,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> SessionFileInfo:
    try:
        session_manager.read_session(
            session_id, owner_id=current_user.user_id
        )
        return file_manager.save_file(
            owner_id=current_user.user_id,
            session_id=session_id,
            filename=file.filename or "upload.bin",
            fileobj=file.file,
        )
    except SessionNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except SessionFileError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/{session_id}/files/{filename}/remote-put",
    response_model=SessionFileRemotePutResponse,
    summary="将会话缓存文件上传到绑定实验机",
)
def put_session_file_to_remote(
    session_id: str,
    filename: str,
    req: SessionFileRemotePutRequest,
    session_manager: SessionManagerDep,
    file_manager: SessionFileManagerDep,
    remote_manager: RemoteMachineManagerDep,
    current_user: User = Depends(get_current_user),
) -> SessionFileRemotePutResponse:
    try:
        session_manager.read_session(
            session_id, owner_id=current_user.user_id
        )
        local_path = file_manager.resolve_file(
            owner_id=current_user.user_id,
            session_id=session_id,
            filename=filename,
        )
        result = remote_manager.put_session_file(
            owner_id=current_user.user_id,
            session_id=session_id,
            local_path=local_path,
            remote_path=req.remote_path,
        )
        return SessionFileRemotePutResponse(
            ok=True,
            local_filename=local_path.name,
            remote_path=req.remote_path,
            result=result,
        )
    except SessionNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except (SessionFileError, RemoteBindingNotFoundError, RemoteRunnerError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/{session_id}/remote-command",
    response_model=SessionRemoteCommandResponse,
    summary="调试执行绑定实验机命令",
)
def run_session_remote_command(
    session_id: str,
    req: SessionRemoteCommandRequest,
    session_manager: SessionManagerDep,
    remote_manager: RemoteMachineManagerDep,
    current_user: User = Depends(get_current_user),
) -> SessionRemoteCommandResponse:
    """Run the same guarded session-bound command path used by the Tutor skill."""
    try:
        session_manager.read_session(
            session_id, owner_id=current_user.user_id
        )
        payload = remote_manager.run_bound_command(
            owner_id=current_user.user_id,
            session_id=session_id,
            command=req.command,
            cwd=req.cwd or "",
            reason=req.reason or "API debug command",
        )
        return SessionRemoteCommandResponse(**payload)
    except SessionNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except (RemoteBindingNotFoundError, RemoteRunnerError) as e:
        raise HTTPException(status_code=400, detail=str(e))


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
    remote_manager: RemoteMachineManagerDep,
    file_manager: SessionFileManagerDep,
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
    remote_manager.destroy_binding(session_id, owner_id=current_user.user_id)
    file_manager.delete_session_files(
        owner_id=current_user.user_id,
        session_id=session_id,
    )
    session_manager.delete_session(
        session_id, owner_id=current_user.user_id
    )
    return {"success": True, "message": "会话删除成功"}
