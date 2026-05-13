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
from models.profile import ProfileModel
from schemas.profile import Profile
from utils.converters import profile_to_model

logger = logging.getLogger(__name__)

DEFAULT_PROFILE_SOURCE_DIR = ROOT_DIR / "docs" / "manual-enhance" / "calibrated"


@dataclass(frozen=True)
class DefaultProfileSeedResult:
    """Summary of a default profile seed run."""

    source_dir: str
    discovered: int
    inserted: int
    updated: int


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

    with session_factory() as db:
        for path in profile_paths:
            profile = load_default_profile(path)
            model = profile_to_model(profile, document_id=None)
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
                existing.document_id = None
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
    )
    logger.info(
        "Seeded default profiles from %s (discovered=%d, inserted=%d, updated=%d)",
        result.source_dir,
        result.discovered,
        result.inserted,
        result.updated,
    )
    return result
