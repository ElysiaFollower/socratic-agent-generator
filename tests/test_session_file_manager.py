import io
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from utils.session_file_manager import SessionFileManager


def test_session_file_manager_sanitizes_and_lists_uploaded_file(tmp_path):
    manager = SessionFileManager(root_dir=tmp_path)

    saved = manager.save_file(
        owner_id="user/1",
        session_id="session:1",
        filename="../docker-compose.yml",
        fileobj=io.BytesIO(b"services: {}\n"),
    )
    files = manager.list_files(owner_id="user/1", session_id="session:1")
    resolved = manager.resolve_file(
        owner_id="user/1",
        session_id="session:1",
        filename="../docker-compose.yml",
    )

    assert saved.filename == "docker-compose.yml"
    assert len(files) == 1
    assert resolved.read_text(encoding="utf-8") == "services: {}\n"
