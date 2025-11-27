from fastapi import APIRouter, HTTPException, Depends
from typing import List
from ..schemas.session import Session, SessionSummary
from ..schemas.message import CreateSessionRequest, RenameSessionRequest
from ..utils.SessionManager import SessionManager
from ..utils.TutorManager import TutorManager
from ..utils.ProfileManager import ProfileManager
from ..core.auth import main as auth
from ..core.auth.schemas import user as user_schema

router = APIRouter()
session_manager = SessionManager()
tutor_manager = TutorManager()
profile_manager = ProfileManager()

@router.get("/sessions", response_model=List[SessionSummary], summary="Get a list of all session metadata.")
def list_sessions(current_user: user_schema.User = Depends(auth.get_current_user)):
    return session_manager.list_sessions()

@router.post("/sessions/create", summary="Create a new session.")
def create_session(req: CreateSessionRequest, current_user: user_schema.User = Depends(auth.get_current_user)):
    try:
        profile = profile_manager.read_profile(req.profile_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Profile '{req.profile_id}' not found")
    tutor = tutor_manager.create_tutor(
        profile=profile,
        session_name=req.session_name,
        output_language=req.output_language,
        user_id=current_user.id
    )
    return {"session_id": tutor.session.session_id}

@router.get("/sessions/{session_id}", response_model=Session, summary="Get detailed information for a session.")
def get_session(session_id: str, current_user: user_schema.User = Depends(auth.get_current_user)):
    try:
        session = session_manager.read_session(session_id)
        if session.user_id != current_user.id and current_user.role != user_schema.Role.admin:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        return session
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Session not found")

@router.put("/sessions/{session_id}/rename", summary="Rename a session.")
def rename_session(session_id: str, req: RenameSessionRequest, current_user: user_schema.User = Depends(auth.get_current_user)):
    try:
        session = session_manager.read_session(session_id)
        if session.user_id != current_user.id and current_user.role != user_schema.Role.admin:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        session_manager.rename_session(session_id, req.session_name)
        tutor_manager.remove_from_cache(session_id)
        return {"success": True, "message": "Session renamed successfully"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Session not found")

@router.delete("/sessions/{session_id}", summary="Delete a session.")
def delete_session(session_id: str, current_user: user_schema.User = Depends(auth.get_current_user)):
    try:
        session = session_manager.read_session(session_id)
        if session.user_id != current_user.id and current_user.role != user_schema.Role.admin:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        tutor_manager.remove_from_cache(session_id)
        session_manager.delete_session(session_id)
        return {"success": True, "message": "Session deleted successfully"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Session not found")
