"""Tests for default calibrated profile database seeding."""

from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import models  # noqa: F401
from api.routes.session import _is_builtin_public_profile
from api.routes.profile import delete_lab_manual
from models.base import Base
from models.document import Document
from models.profile import ProfileModel
from schemas.user import User
from utils.document_manager import DocumentManager
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
    assert first.documents_inserted == EXPECTED_DEFAULT_PROFILE_COUNT
    assert first.documents_updated == 0

    second = seed_default_profiles(SessionLocal, source_dir=CALIBRATED_DIR)
    assert second.discovered == EXPECTED_DEFAULT_PROFILE_COUNT
    assert second.inserted == 0
    assert second.updated == EXPECTED_DEFAULT_PROFILE_COUNT
    assert second.documents_inserted == 0
    assert second.documents_updated == EXPECTED_DEFAULT_PROFILE_COUNT

    with SessionLocal() as db:
        models = db.query(ProfileModel).all()
        documents = db.query(Document).all()
        assert len(models) == EXPECTED_DEFAULT_PROFILE_COUNT
        assert len(documents) == EXPECTED_DEFAULT_PROFILE_COUNT
        assert {model.owner_id for model in models} == {None}
        assert all(model.visible_class_ids == [] for model in models)
        assert all(model.document_id is not None for model in models)
        assert {doc.owner_id for doc in documents} == {"builtin"}
        assert all((doc.meta_info or {}).get("is_builtin") is True for doc in documents)
        assert all(doc.storage_path.endswith("/lab_manual.tex") for doc in documents)


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
    assert {profile.document_status for profile in profiles} == {"available"}
    assert all(profile.document_source for profile in profiles)


def test_seeded_default_profiles_can_start_student_sessions_without_classes():
    SessionLocal = make_session_factory()
    seed_default_profiles(SessionLocal, source_dir=CALIBRATED_DIR)

    with SessionLocal() as db:
        profile = ProfileManager(db).list_profiles_by_visible_classes([])[0]

    assert _is_builtin_public_profile(profile)


def test_deleting_builtin_document_unlinks_profiles_without_deleting_profile():
    SessionLocal = make_session_factory()
    seed_default_profiles(SessionLocal, source_dir=CALIBRATED_DIR)

    with SessionLocal() as db:
        manager = DocumentManager(db)
        user = User(
            user_id="admin",
            username="admin",
            password_hash="x",
            role="admin",
        )
        response = delete_lab_manual(
            "ARP_Attack",
            current_user=user,
            document_manager=manager,
        )

        assert response["affected_profile_count"] == 1
        assert response["document_unlinked"] is True
        assert db.query(Document).filter(Document.doc_name == "ARP_Attack").first() is None
        profile_model = (
            db.query(ProfileModel)
            .filter(ProfileModel.lab_name == "ARP_Attack")
            .one()
        )
        assert profile_model.document_id is None

        profile = ProfileManager(db).read_profile(profile_model.profile_id)
        assert profile.document_status == "unlinked"
