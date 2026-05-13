"""Session-scoped file cache for lab setup artifacts."""

from __future__ import annotations

import re
import shutil
from pathlib import Path
from typing import BinaryIO, List

from config import SESSION_FILE_MAX_BYTES, SESSION_FILES_DIR
from schemas.remote_machine import SessionFileInfo


class SessionFileError(ValueError):
    """Raised when a session file operation is invalid."""


class SessionFileManager:
    """Store files uploaded for one learning session under a safe cache path."""

    def __init__(self, root_dir: Path = SESSION_FILES_DIR) -> None:
        self.root_dir = root_dir

    def list_files(self, *, owner_id: str, session_id: str) -> List[SessionFileInfo]:
        session_dir = self._session_dir(owner_id, session_id)
        if not session_dir.exists():
            return []
        files = []
        for path in sorted(session_dir.iterdir(), key=lambda item: item.name):
            if not path.is_file():
                continue
            stat = path.stat()
            files.append(
                SessionFileInfo(
                    filename=path.name,
                    size_bytes=stat.st_size,
                    uploaded_at=_format_mtime(stat.st_mtime),
                )
            )
        return files

    def save_file(
        self,
        *,
        owner_id: str,
        session_id: str,
        filename: str,
        fileobj: BinaryIO,
    ) -> SessionFileInfo:
        safe_name = _safe_filename(filename)
        session_dir = self._session_dir(owner_id, session_id)
        session_dir.mkdir(parents=True, exist_ok=True)
        target = session_dir / safe_name
        total = 0
        with target.open("wb") as output:
            while True:
                chunk = fileobj.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > SESSION_FILE_MAX_BYTES:
                    output.close()
                    target.unlink(missing_ok=True)
                    raise SessionFileError("Uploaded file exceeds SESSION_FILE_MAX_BYTES.")
                output.write(chunk)
        if total == 0:
            target.unlink(missing_ok=True)
            raise SessionFileError("Uploaded file is empty.")
        return SessionFileInfo(
            filename=safe_name,
            size_bytes=total,
            uploaded_at=_format_mtime(target.stat().st_mtime),
        )

    def resolve_file(self, *, owner_id: str, session_id: str, filename: str) -> Path:
        safe_name = _safe_filename(filename)
        path = self._session_dir(owner_id, session_id) / safe_name
        if not path.exists() or not path.is_file():
            raise SessionFileError("Session file not found.")
        return path

    def delete_session_files(self, *, owner_id: str, session_id: str) -> None:
        session_dir = self._session_dir(owner_id, session_id)
        if session_dir.exists():
            shutil.rmtree(session_dir)

    def _session_dir(self, owner_id: str, session_id: str) -> Path:
        return self.root_dir / _safe_path_part(owner_id) / _safe_path_part(session_id)


def _safe_path_part(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_.-]+", "_", value.strip())
    if not cleaned:
        raise SessionFileError("Invalid path component.")
    return cleaned[:160]


def _safe_filename(filename: str) -> str:
    name = Path(filename or "").name.strip()
    cleaned = re.sub(r"[^A-Za-z0-9_. -]+", "_", name)
    cleaned = cleaned.strip(" .")
    if not cleaned:
        raise SessionFileError("Invalid filename.")
    return cleaned[:180]


def _format_mtime(value: float) -> str:
    from datetime import datetime, timezone

    return datetime.fromtimestamp(value, tz=timezone.utc).isoformat()
