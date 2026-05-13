"""Seed built-in calibrated tutor profiles into SQLite.

Built-in profiles live as versioned JSON artifacts in the repository. This
module imports them into the runtime database on startup so a fresh deployment
has usable tutor profiles without manual database setup.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable

from sqlalchemy.orm import Session

from config import ROOT_DIR
from models.document import Document
from models.profile import ProfileModel
from schemas.profile import Profile
from utils.converters import profile_to_model

logger = logging.getLogger(__name__)

DEFAULT_PROFILE_SOURCE_DIR = ROOT_DIR / "docs" / "manual-enhance" / "calibrated"
DEFAULT_VECTOR_STORE_DIR = ROOT_DIR / "data" / "vector_stores" / "builtin"
BUILTIN_DOCUMENT_OWNER_ID = "builtin"


@dataclass(frozen=True)
class DefaultProfileSeedResult:
    """Summary of a default profile seed run."""

    source_dir: str
    discovered: int
    inserted: int
    updated: int
    documents_inserted: int
    documents_updated: int


def iter_default_profile_files(
    source_dir: Path = DEFAULT_PROFILE_SOURCE_DIR,
) -> Iterable[Path]:
    """Yield built-in profile JSON files in a stable order."""
    if not source_dir.exists():
        return []
    return sorted(source_dir.glob("*/profile.json"))


def load_default_profile(path: Path) -> Profile:
    """Load and validate one built-in profile JSON artifact."""
    data = json.loads(path.read_text(encoding="utf-8"))
    profile = Profile.model_validate(data)
    profile.owner_id = None
    profile.visible_class_ids = []
    return profile


def _repo_relative(path: Path) -> str:
    return str(path.relative_to(ROOT_DIR))


def _ensure_builtin_document(db: Session, lab_id: str, lab_dir: Path) -> tuple[Document, bool]:
    manual_path = lab_dir / "lab_manual.tex"
    if not manual_path.exists():
        raise FileNotFoundError(f"Built-in lab manual not found: {manual_path}")

    storage_path = _repo_relative(manual_path)
    index_path = _repo_relative(DEFAULT_VECTOR_STORE_DIR / lab_id)
    meta_info = {
        "source": "manual_enhance_calibrated",
        "is_builtin": True,
        "original_format": "tex",
        "artifact_path": storage_path,
        "source_artifact_path": storage_path,
        "profile_source": _repo_relative(lab_dir / "profile.json"),
        "curriculum_source": _repo_relative(lab_dir / "curriculum.json"),
    }

    document = (
        db.query(Document)
        .filter(
            Document.owner_id == BUILTIN_DOCUMENT_OWNER_ID,
            Document.doc_name == lab_id,
        )
        .first()
    )
    inserted = document is None
    if document is None:
        document = Document(
            owner_id=BUILTIN_DOCUMENT_OWNER_ID,
            doc_name=lab_id,
            filename="lab_manual.tex",
            storage_path=storage_path,
            index_path=index_path,
            meta_info=meta_info,
        )
        db.add(document)
        db.flush()
    else:
        document.filename = "lab_manual.tex"
        document.storage_path = storage_path
        document.index_path = index_path
        document.meta_info = meta_info

    return document, inserted


def seed_default_profiles(
    session_factory: Callable[[], Session],
    source_dir: Path = DEFAULT_PROFILE_SOURCE_DIR,
) -> DefaultProfileSeedResult:
    """Insert or update built-in profiles from repository JSON artifacts.

    The operation is idempotent by `profile_id`. Existing rows are updated from
    the artifact so deployments receive curated profile improvements after a
    code update, while user-created profiles with other IDs are left untouched.
    """
    profile_paths = list(iter_default_profile_files(source_dir))
    inserted = 0
    updated = 0
    documents_inserted = 0
    documents_updated = 0

    with session_factory() as db:
        for path in profile_paths:
            profile = load_default_profile(path)
            document, document_inserted = _ensure_builtin_document(
                db, profile.lab_name or path.parent.name, path.parent
            )
            if document_inserted:
                documents_inserted += 1
            else:
                documents_updated += 1
            model = profile_to_model(profile, document_id=document.id)
            existing = (
                db.query(ProfileModel)
                .filter(ProfileModel.profile_id == profile.profile_id)
                .first()
            )

            if existing:
                existing.profile_name = model.profile_name
                existing.topic_name = model.topic_name
                existing.lab_name = model.lab_name
                existing.owner_id = None
                existing.visible_class_ids = []
                existing.document_id = document.id
                existing.persona_hints = model.persona_hints
                existing.target_audience = model.target_audience
                existing.curriculum = model.curriculum
                existing.prompt_template = model.prompt_template
                existing.create_at = model.create_at
                updated += 1
            else:
                db.add(model)
                inserted += 1

        db.commit()

    result = DefaultProfileSeedResult(
        source_dir=str(source_dir),
        discovered=len(profile_paths),
        inserted=inserted,
        updated=updated,
        documents_inserted=documents_inserted,
        documents_updated=documents_updated,
    )
    logger.info(
        "Seeded default profiles from %s (discovered=%d, inserted=%d, updated=%d, documents_inserted=%d, documents_updated=%d)",
        result.source_dir,
        result.discovered,
        result.inserted,
        result.updated,
        result.documents_inserted,
        result.documents_updated,
    )
    return result
