import json
from pathlib import Path
from typing import List

import sys
from pathlib import Path
# Add the src directory to sys.path
sys.path.append(str(Path(__file__).resolve().parents[1]))
from config import SESSION_DATA_DIR, DEFAULT_OUTPUT_LANGUAGE, DEFAULT_SESSION_NAME
from schemas.session import Session, SessionSummary
from schemas.profile import Profile


class SessionManager:
    """Handles file system operations for sessions."""

    def list_sessions(self) -> List[SessionSummary]:
        """Scans the data directory and lists summaries of all sessions."""
        session_list = []
        for s_file in SESSION_DATA_DIR.glob("*.json"):
            try: 
                with open(s_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    session_list.append(SessionSummary.model_validate(data)) # SessionSummary: no faster now; but for future database improvement
            except (json.JSONDecodeError, Exception) as e: 
                print(f"Warning[SessionManager]：list_sessions :skip Session: {s_file.name} . Due to error: {e}")
                continue 
            
        # Sort by creation time, newest first
        session_list.sort(key=lambda s: s.create_at, reverse=True)
        return session_list

    @staticmethod
    def read_session(session_id: str)-> Session:
        """Reads a session from disk."""
        session_path = SESSION_DATA_DIR / f"{session_id}.json"
        if not session_path.exists():
            raise FileNotFoundError(f"error: tutor session not found -> {session_path}")
        with open(session_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return Session.model_validate(data)

    @staticmethod
    def create_session(profile:Profile, session_name:str=DEFAULT_SESSION_NAME, output_language:str=DEFAULT_OUTPUT_LANGUAGE)-> Session:
        session = Session(
            profile=profile,
            session_name=session_name,
            output_language=output_language,
        )
        SessionManager.save_session(session)
        return session
    
    @staticmethod
    def rename_session(session_id: str, session_name: str):
        """Renames a session."""
        session = SessionManager.read_session(session_id)
        session.session_name = session_name
        SessionManager.save_session(session)

    @staticmethod
    def save_session(session: Session):
        """Saves a session to disk."""
        session_path = SESSION_DATA_DIR / f"{session.session_id}.json"
        with open(session_path, 'w', encoding='utf-8') as f:
            json.dump(session.model_dump(), f, ensure_ascii=False, indent=2)
            
    @staticmethod
    def delete_session(session_id: str):
        """Deletes a session file from disk."""
        session_path = SESSION_DATA_DIR / f"{session_id}.json"
        if not session_path.exists():
            return 
        session_path.unlink()