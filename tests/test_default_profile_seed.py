"""Tests for default calibrated profile database seeding."""

from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import models  # noqa: F401
from api.routes.session import _is_builtin_public_profile
from models.base import Base
from models.profile import ProfileModel
from utils.default_profile_seed import seed_default_profiles
from utils.profile_manager import ProfileManager


ROOT = Path(__file__).resolve().parents[1]
CALIBRATED_DIR = ROOT / "docs" / "manual-enhance" / "calibrated"
EXPECTED_DEFAULT_PROFILE_COUNT = 6


def make_session_factory():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


def test_seed_default_profiles_inserts_and_updates_idempotently():
    SessionLocal = make_session_factory()

    first = seed_default_profiles(SessionLocal, source_dir=CALIBRATED_DIR)
    assert first.discovered == EXPECTED_DEFAULT_PROFILE_COUNT
    assert first.inserted == EXPECTED_DEFAULT_PROFILE_COUNT
    assert first.updated == 0

    second = seed_default_profiles(SessionLocal, source_dir=CALIBRATED_DIR)
    assert second.discovered == EXPECTED_DEFAULT_PROFILE_COUNT
    assert second.inserted == 0
    assert second.updated == EXPECTED_DEFAULT_PROFILE_COUNT

    with SessionLocal() as db:
        models = db.query(ProfileModel).all()
        assert len(models) == EXPECTED_DEFAULT_PROFILE_COUNT
        assert {model.owner_id for model in models} == {None}
        assert all(model.visible_class_ids == [] for model in models)


def test_seeded_default_profiles_are_visible_to_students_without_classes():
    SessionLocal = make_session_factory()
    seed_default_profiles(SessionLocal, source_dir=CALIBRATED_DIR)

    with SessionLocal() as db:
        manager = ProfileManager(db)
        profiles = manager.list_profiles_by_visible_classes([])

    assert len(profiles) == EXPECTED_DEFAULT_PROFILE_COUNT
    assert {profile.lab_name for profile in profiles} == {
        "ARP_Attack",
        "LocalDNSAttack",
        "RemoteDNSAttack",
        "Sniffing_Spoofing",
        "TCP_Attacks",
        "VPN_Tunnel",
    }


def test_seeded_default_profiles_can_start_student_sessions_without_classes():
    SessionLocal = make_session_factory()
    seed_default_profiles(SessionLocal, source_dir=CALIBRATED_DIR)

    with SessionLocal() as db:
        profile = ProfileManager(db).list_profiles_by_visible_classes([])[0]

    assert _is_builtin_public_profile(profile)
