import json
from pathlib import Path
import sys

from cryptography.fernet import Fernet
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from models.base import Base
from models.remote_machine import UserRemoteMachineModel
import models  # noqa: F401
from schemas.remote_machine import RemoteMachineCreate
import utils.remote_machine_manager as remote_machine_module
from utils.remote_machine_manager import RemoteMachineManager
from utils.remote_runner_provider import (
    RemoteRunnerProvider,
    RemoteRunnerProviderConfig,
    RunnerResult,
)


class FakeRunner:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def __call__(self, args, env, cwd, timeout):
        self.calls.append(list(args))
        return self.responses.pop(0)


def make_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


def test_existing_remote_machine_can_be_tested_without_returning_secret_fields():
    SessionLocal = make_db()
    runner = FakeRunner(
        [
            RunnerResult(
                returncode=0,
                stdout=json.dumps(
                    {
                        "machine_id": "seed-lab",
                        "reachable": True,
                        "auth_ok": True,
                        "default_cwd_ok": True,
                    }
                ),
            )
        ]
    )
    provider = RemoteRunnerProvider(
        RemoteRunnerProviderConfig(enabled=True, repo_path=None),
        command_runner=runner,
    )

    with SessionLocal() as db:
        manager = RemoteMachineManager(db, provider=provider)
        created = manager.create_machine(
            "user1",
            RemoteMachineCreate(
                display_name="SEED Lab",
                runner_machine_name="seed-lab",
                auth_type="existing",
                default_cwd="/home/seed",
            ),
        )
        result = manager.test_machine("user1", created.machine_id)
        machines = manager.list_machines("user1")

    assert result.ok is True
    assert machines[0].has_password is False
    assert machines[0].status == "ready"
    assert runner.calls[0][3:] == ["machine", "doctor", "seed-lab", "--json"]


def test_password_remote_machine_requires_encryption_key(monkeypatch):
    monkeypatch.setattr(remote_machine_module, "_CIPHER", None)
    monkeypatch.setattr(remote_machine_module, "_CIPHER_ERROR", None)
    SessionLocal = make_db()
    provider = RemoteRunnerProvider(
        RemoteRunnerProviderConfig(enabled=True, repo_path=None),
        command_runner=FakeRunner([]),
    )

    with SessionLocal() as db:
        manager = RemoteMachineManager(db, provider=provider)
        with pytest.raises(ValueError, match="REMOTE_MACHINE_SECRET_KEY"):
            manager.create_machine(
                "user1",
                RemoteMachineCreate(
                    display_name="SEED Lab",
                    runner_machine_name="seed-lab",
                    auth_type="password",
                    host="127.0.0.1",
                    port=2222,
                    username="seed",
                    password="secret",
                ),
            )
        assert db.query(UserRemoteMachineModel).count() == 0


def test_password_remote_machine_stores_fernet_ciphertext(monkeypatch):
    key = Fernet.generate_key()
    cipher = Fernet(key)
    monkeypatch.setattr(remote_machine_module, "_CIPHER", cipher)
    monkeypatch.setattr(remote_machine_module, "_CIPHER_ERROR", None)
    SessionLocal = make_db()
    provider = RemoteRunnerProvider(
        RemoteRunnerProviderConfig(enabled=True, repo_path=None),
        command_runner=FakeRunner([]),
    )

    with SessionLocal() as db:
        manager = RemoteMachineManager(db, provider=provider)
        created = manager.create_machine(
            "user1",
            RemoteMachineCreate(
                display_name="SEED Lab",
                runner_machine_name="seed-lab",
                auth_type="password",
                host="127.0.0.1",
                port=2222,
                username="seed",
                password="secret",
            ),
        )
        model = db.query(UserRemoteMachineModel).filter_by(
            machine_id=created.machine_id
        ).one()

    assert model.password_secret != "secret"
    assert cipher.decrypt(model.password_secret.encode()).decode() == "secret"


def test_create_binding_creates_runner_session_for_owned_machine():
    SessionLocal = make_db()
    runner = FakeRunner(
        [
            RunnerResult(
                returncode=0,
                stdout=json.dumps(
                    {
                        "machine_id": "seed-lab",
                        "reachable": True,
                        "auth_ok": True,
                        "default_cwd_ok": True,
                    }
                ),
            ),
            RunnerResult(
                returncode=0,
                stdout=json.dumps({"session_id": "rr-sess", "machine_id": "seed-lab"}),
            ),
        ]
    )
    provider = RemoteRunnerProvider(
        RemoteRunnerProviderConfig(enabled=True, repo_path=None),
        command_runner=runner,
    )

    with SessionLocal() as db:
        manager = RemoteMachineManager(db, provider=provider)
        machine = manager.create_machine(
            "user1",
            RemoteMachineCreate(
                display_name="SEED Lab",
                runner_machine_name="seed-lab",
                auth_type="existing",
                default_cwd="/home/seed",
            ),
        )
        binding = manager.create_binding(
            owner_id="user1",
            session_id="socratic-session",
            machine_id=machine.machine_id,
        )

    assert binding.runner_session_id == "rr-sess"
    assert runner.calls[0][3:] == ["machine", "doctor", "seed-lab", "--json"]
    assert runner.calls[1][3:] == [
        "session",
        "create",
        "--machine",
        "seed-lab",
        "--cwd",
        "/home/seed",
        "--json",
    ]


def test_bound_command_records_audit():
    SessionLocal = make_db()
    runner = FakeRunner(
        [
            RunnerResult(
                returncode=0,
                stdout=json.dumps(
                    {
                        "machine_id": "seed-lab",
                        "reachable": True,
                        "auth_ok": True,
                        "default_cwd_ok": True,
                    }
                ),
            ),
            RunnerResult(
                returncode=0,
                stdout=json.dumps({"session_id": "rr-sess", "machine_id": "seed-lab"}),
            ),
            RunnerResult(
                returncode=0,
                stdout=json.dumps({"session_id": "rr-sess", "machine_id": "seed-lab"}),
            ),
            RunnerResult(
                returncode=0,
                stdout=json.dumps(
                    {
                        "session_id": "rr-sess",
                        "machine_id": "seed-lab",
                        "command": "pwd",
                        "exit_code": 0,
                        "stdout": "/home/seed\n",
                        "stderr": "",
                    }
                ),
            ),
        ]
    )
    provider = RemoteRunnerProvider(
        RemoteRunnerProviderConfig(
            enabled=True,
            repo_path=None,
            allowed_commands=("pwd",),
        ),
        command_runner=runner,
    )

    with SessionLocal() as db:
        manager = RemoteMachineManager(db, provider=provider)
        machine = manager.create_machine(
            "user1",
            RemoteMachineCreate(
                display_name="SEED Lab",
                runner_machine_name="seed-lab",
                auth_type="existing",
                default_cwd="/home/seed",
            ),
        )
        manager.create_binding(
            owner_id="user1",
            session_id="socratic-session",
            machine_id=machine.machine_id,
        )
        result = manager.run_bound_command(
            owner_id="user1",
            session_id="socratic-session",
            command="pwd",
            reason="debug",
        )
        audits = manager.list_audits("socratic-session", "user1")

    assert result["result"]["stdout"] == "/home/seed\n"
    assert len(audits) == 1
    assert audits[0].command == "pwd"
    assert audits[0].exit_code == 0
