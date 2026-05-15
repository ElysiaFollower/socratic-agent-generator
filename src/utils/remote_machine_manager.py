"""Managers for user remote machines and session-bound Remote Runner access."""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import pytz
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.orm import Session

from config import REMOTE_MACHINE_SECRET_KEY
from models.remote_machine import (
    RemoteCommandAuditModel,
    SessionRemoteBindingModel,
    SessionRemoteShellModel,
    UserRemoteMachineModel,
)
from schemas.remote_machine import (
    RemoteCommandAudit,
    RemoteMachineCreate,
    RemoteMachineSummary,
    RemoteMachineTestResponse,
    RemoteMachineUpdate,
    RemoteBindingSummary,
    SessionRemoteShellSummary,
)
from utils.remote_runner_provider import (
    RemoteRunnerError,
    RemoteRunnerProvider,
    RemoteRunnerProviderConfig,
    get_remote_runner_provider,
    redact_text,
)

logger = logging.getLogger(__name__)

_CIPHER = None
_CIPHER_ERROR: Optional[Exception] = None
if REMOTE_MACHINE_SECRET_KEY:
    try:
        _CIPHER = Fernet(REMOTE_MACHINE_SECRET_KEY.encode())
    except (TypeError, ValueError) as exc:
        _CIPHER_ERROR = exc
        logger.error("REMOTE_MACHINE_SECRET_KEY is not a valid Fernet key.")
else:
    logger.info(
        "REMOTE_MACHINE_SECRET_KEY is not set; password-based remote machines are disabled."
    )


class RemoteMachineSecretError(ValueError):
    """Raised when remote machine credentials cannot be encrypted or decrypted."""


class RemoteMachineNotFoundError(ValueError):
    """Raised when a user's remote machine is not found."""


class RemoteBindingNotFoundError(ValueError):
    """Raised when a session has no remote binding."""


class RemoteShellNotFoundError(ValueError):
    """Raised when a requested session shell does not exist."""


class RemoteShellLabelError(ValueError):
    """Raised when a requested shell label is invalid or reserved."""


_SHELL_LABEL_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,59}$")
_PRIMARY_SHELL_IDS = {"", "primary", "main", "default"}


class RemoteMachineManager:
    """Manage per-user lab machines and session remote bindings."""

    def __init__(
        self,
        db: Session,
        provider: Optional[RemoteRunnerProvider] = None,
    ) -> None:
        self.db = db
        self.provider = provider or get_remote_runner_provider()

    def list_machines(self, owner_id: str) -> List[RemoteMachineSummary]:
        models = (
            self.db.query(UserRemoteMachineModel)
            .filter(UserRemoteMachineModel.owner_id == owner_id)
            .order_by(UserRemoteMachineModel.display_name.asc())
            .all()
        )
        return [self._summary(model) for model in models]

    def get_machine_model(self, owner_id: str, machine_id: str) -> UserRemoteMachineModel:
        model = (
            self.db.query(UserRemoteMachineModel)
            .filter(
                UserRemoteMachineModel.owner_id == owner_id,
                UserRemoteMachineModel.machine_id == machine_id,
            )
            .first()
        )
        if model is None:
            raise RemoteMachineNotFoundError(machine_id)
        return model

    def create_machine(
        self, owner_id: str, payload: RemoteMachineCreate
    ) -> RemoteMachineSummary:
        self._validate_payload(payload)
        model = UserRemoteMachineModel(
            machine_id=str(uuid.uuid4()),
            owner_id=owner_id,
            display_name=payload.display_name,
            runner_machine_name=payload.runner_machine_name,
            host=payload.host,
            port=payload.port,
            username=payload.username,
            auth_type=payload.auth_type,
            password_secret=self._encrypt(payload.password)
            if payload.password
            else None,
            key_path=payload.key_path,
            default_cwd=payload.default_cwd,
            startup_commands=payload.startup_commands,
            status="untested",
        )
        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)
        return self._summary(model)

    def update_machine(
        self, owner_id: str, machine_id: str, payload: RemoteMachineUpdate
    ) -> RemoteMachineSummary:
        self._validate_payload(payload)
        model = self.get_machine_model(owner_id, machine_id)
        model.display_name = payload.display_name
        model.runner_machine_name = payload.runner_machine_name
        model.host = payload.host
        model.port = payload.port
        model.username = payload.username
        model.auth_type = payload.auth_type
        if payload.password:
            model.password_secret = self._encrypt(payload.password)
        elif payload.auth_type != "password":
            model.password_secret = None
        model.key_path = payload.key_path
        model.default_cwd = payload.default_cwd
        model.startup_commands = payload.startup_commands
        model.status = "untested"
        model.last_error = None
        self.db.commit()
        self.db.refresh(model)
        return self._summary(model)

    def delete_machine(self, owner_id: str, machine_id: str) -> None:
        model = self.get_machine_model(owner_id, machine_id)
        self.db.delete(model)
        self.db.commit()

    def test_machine(self, owner_id: str, machine_id: str) -> RemoteMachineTestResponse:
        model = self.get_machine_model(owner_id, machine_id)
        ok, status, detail, message = self._sync_and_doctor(model)
        model.status = status
        model.last_error = None if ok else message
        model.last_checked_at = datetime.now(pytz.utc).isoformat()
        self.db.commit()
        return RemoteMachineTestResponse(
            ok=ok,
            status=status,
            message=message,
            detail=detail,
        )

    def create_binding(
        self,
        *,
        owner_id: str,
        session_id: str,
        machine_id: str,
    ) -> RemoteBindingSummary:
        model = self.get_machine_model(owner_id, machine_id)
        ok, status, detail, message = self._sync_and_doctor(model)
        if not ok:
            model.status = status
            model.last_error = message
            model.last_checked_at = datetime.now(pytz.utc).isoformat()
            self.db.commit()
            raise RemoteRunnerError(message or "Remote machine connection failed.")

        session_payload = self._session_provider(model).create_session(
            machine_id=model.runner_machine_name,
            cwd=model.default_cwd or "",
        )
        runner_session_id = str(session_payload.get("session_id") or "")
        if not runner_session_id:
            raise RemoteRunnerError("Remote Runner did not return a session_id.")

        existing = self.get_binding_model(session_id, owner_id, required=False)
        old_provider = None
        old_runner_session_id = None
        if existing and existing.runner_session_id:
            old_provider = self._session_provider_from_binding(existing)
            old_runner_session_id = existing.runner_session_id
        if existing:
            existing.user_machine_id = model.machine_id
            existing.runner_machine_name = model.runner_machine_name
            existing.runner_session_id = runner_session_id
            existing.default_cwd = model.default_cwd
            existing.status = "active"
            existing.last_error = None
            binding = existing
        else:
            binding = SessionRemoteBindingModel(
                binding_id=str(uuid.uuid4()),
                session_id=session_id,
                owner_id=owner_id,
                user_machine_id=model.machine_id,
                runner_machine_name=model.runner_machine_name,
                runner_session_id=runner_session_id,
                default_cwd=model.default_cwd,
                status="active",
            )
            self.db.add(binding)
        model.status = "ready"
        model.last_error = None
        model.last_checked_at = datetime.now(pytz.utc).isoformat()
        self.db.commit()
        self.db.refresh(binding)
        if old_provider and old_runner_session_id:
            try:
                old_provider.destroy_session(session_id=old_runner_session_id)
            except Exception as exc:
                logger.warning("Failed to destroy replaced Remote Runner session: %s", exc)
        return self._binding_summary(binding, model)

    def get_binding_model(
        self,
        session_id: str,
        owner_id: str,
        *,
        required: bool = True,
    ) -> Optional[SessionRemoteBindingModel]:
        binding = (
            self.db.query(SessionRemoteBindingModel)
            .filter(
                SessionRemoteBindingModel.session_id == session_id,
                SessionRemoteBindingModel.owner_id == owner_id,
            )
            .first()
        )
        if binding is None and required:
            raise RemoteBindingNotFoundError(session_id)
        return binding

    def get_binding_summary(
        self, session_id: str, owner_id: str
    ) -> Optional[RemoteBindingSummary]:
        binding = self.get_binding_model(session_id, owner_id, required=False)
        if binding is None:
            return None
        machine = None
        if binding.user_machine_id:
            machine = (
                self.db.query(UserRemoteMachineModel)
                .filter(UserRemoteMachineModel.machine_id == binding.user_machine_id)
                .first()
            )
        return self._binding_summary(binding, machine)

    def destroy_binding(self, session_id: str, owner_id: str) -> None:
        binding = self.get_binding_model(session_id, owner_id, required=False)
        if not binding:
            return
        provider = self._session_provider_from_binding(binding)
        extra_shells = (
            self.db.query(SessionRemoteShellModel)
            .filter(
                SessionRemoteShellModel.session_id == session_id,
                SessionRemoteShellModel.owner_id == owner_id,
                SessionRemoteShellModel.binding_id == binding.binding_id,
            )
            .all()
        )
        for shell in extra_shells:
            try:
                provider.destroy_session(session_id=shell.runner_session_id)
            except Exception as exc:
                logger.warning(
                    "Failed to destroy named Remote Runner shell %s: %s",
                    shell.runner_session_id,
                    exc,
                )
        try:
            provider.destroy_session(session_id=binding.runner_session_id)
        except Exception as exc:
            logger.warning("Failed to destroy Remote Runner session: %s", exc)
        self.db.delete(binding)
        self.db.commit()

    def list_shells(
        self,
        *,
        owner_id: str,
        session_id: str,
    ) -> List[SessionRemoteShellSummary]:
        """List the primary and named shell terminals for a learning session."""
        binding = self.get_binding_model(session_id, owner_id)
        rows = (
            self.db.query(SessionRemoteShellModel)
            .filter(
                SessionRemoteShellModel.session_id == session_id,
                SessionRemoteShellModel.owner_id == owner_id,
                SessionRemoteShellModel.binding_id == binding.binding_id,
            )
            .order_by(SessionRemoteShellModel.create_at.asc())
            .all()
        )
        shells = [
            SessionRemoteShellSummary(
                shell_id="primary",
                label="main",
                runner_machine_name=binding.runner_machine_name,
                runner_session_id=binding.runner_session_id,
                default_cwd=binding.default_cwd,
                status=binding.status,
                is_primary=True,
            )
        ]
        shells.extend(self._shell_summary(row, is_primary=False) for row in rows)
        return shells

    def create_shell(
        self,
        *,
        owner_id: str,
        session_id: str,
        label: str,
        cwd: str = "",
        reason: str = "",
    ) -> SessionRemoteShellSummary:
        """Create a named persistent shell for concurrent evidence collection."""
        binding = self.get_binding_model(session_id, owner_id)
        cleaned_label = self._normalize_shell_label(label)
        existing = (
            self.db.query(SessionRemoteShellModel)
            .filter(
                SessionRemoteShellModel.session_id == session_id,
                SessionRemoteShellModel.owner_id == owner_id,
                SessionRemoteShellModel.label == cleaned_label,
            )
            .first()
        )
        if existing:
            return self._shell_summary(existing, is_primary=False)

        provider = self._session_provider_from_binding(binding)
        session_payload = provider.create_session(
            machine_id=binding.runner_machine_name,
            cwd=cwd or binding.default_cwd or "",
        )
        runner_session_id = str(session_payload.get("session_id") or "")
        if not runner_session_id:
            raise RemoteRunnerError("Remote Runner did not return a session_id.")
        shell = SessionRemoteShellModel(
            shell_id=str(uuid.uuid4()),
            binding_id=binding.binding_id,
            session_id=session_id,
            owner_id=owner_id,
            label=cleaned_label,
            runner_machine_name=binding.runner_machine_name,
            runner_session_id=runner_session_id,
            default_cwd=cwd or binding.default_cwd,
            status="active",
        )
        self.db.add(shell)
        self.db.commit()
        self.db.refresh(shell)
        self.record_audit(
            owner_id=owner_id,
            session_id=session_id,
            binding_id=binding.binding_id,
            runner_session_id=runner_session_id,
            action="shell_create",
            command=f"shell={cleaned_label}",
            cwd=cwd or binding.default_cwd or "",
            result={
                **session_payload,
                "runner_session_id": runner_session_id,
                "label": cleaned_label,
                "reason": reason,
            },
            error="",
        )
        return self._shell_summary(shell, is_primary=False)

    def read_shell(
        self,
        *,
        owner_id: str,
        session_id: str,
        shell: str = "",
        since: int = 0,
        max_chars: int = 12000,
    ) -> Dict[str, Any]:
        """Read the transcript for the primary or a named shell terminal."""
        binding, shell_model, runner_session_id, label = self._resolve_shell_target(
            owner_id=owner_id,
            session_id=session_id,
            shell=shell,
        )
        provider = self._session_provider_from_binding(binding)
        payload = provider.read_session_transcript(
            session_id=runner_session_id,
            machine_id=binding.runner_machine_name,
            since=since,
            max_chars=max_chars,
        )
        payload.setdefault("runner_session_id", runner_session_id)
        payload.setdefault("label", label)
        payload.setdefault("shell_id", shell_model.shell_id if shell_model else "primary")
        return payload

    def run_shell_command(
        self,
        *,
        owner_id: str,
        session_id: str,
        shell: str = "",
        command: str = "",
        action: str = "session_exec",
        command_id: str = "",
        cwd: str = "",
        reason: str = "",
        wait_timeout_seconds: int = 0,
    ) -> Dict[str, Any]:
        """Run an audited action on a primary or named shell terminal."""
        binding, _shell_model, runner_session_id, _label = self._resolve_shell_target(
            owner_id=owner_id,
            session_id=session_id,
            shell=shell,
        )
        provider = self._session_provider_from_binding(binding)
        try:
            payload = provider.run_action(
                action=action,
                machine_id=binding.runner_machine_name,
                session_id=runner_session_id,
                command=command,
                command_id=command_id,
                cwd=cwd,
                reason=reason,
                wait_timeout_seconds=wait_timeout_seconds,
            )
            self.record_audit(
                owner_id=owner_id,
                session_id=session_id,
                binding_id=binding.binding_id,
                runner_session_id=runner_session_id,
                action=action,
                command=command or (f"command_id={command_id}" if command_id else ""),
                cwd=cwd,
                result=payload.get("result"),
                error="",
            )
            return payload
        except RemoteRunnerError as exc:
            self.record_audit(
                owner_id=owner_id,
                session_id=session_id,
                binding_id=binding.binding_id,
                runner_session_id=runner_session_id,
                action=action,
                command=command or (f"command_id={command_id}" if command_id else ""),
                cwd=cwd,
                result=None,
                error=str(exc),
            )
            raise

    def run_bound_command(
        self,
        *,
        owner_id: str,
        session_id: str,
        command: str = "",
        action: str = "session_exec",
        command_id: str = "",
        cwd: str = "",
        reason: str = "",
        wait_timeout_seconds: int = 0,
    ) -> Dict[str, Any]:
        """Run one audited action on the session-bound machine."""
        return self.run_shell_command(
            owner_id=owner_id,
            session_id=session_id,
            shell="primary",
            command=command,
            action=action,
            command_id=command_id,
            cwd=cwd,
            reason=reason,
            wait_timeout_seconds=wait_timeout_seconds,
        )

    def read_bound_shell(
        self,
        *,
        owner_id: str,
        session_id: str,
        since: int = 0,
        max_chars: int = 12000,
    ) -> Dict[str, Any]:
        """Read the persistent shell transcript for the bound Remote Runner session."""
        return self.read_shell(
            owner_id=owner_id,
            session_id=session_id,
            shell="primary",
            since=since,
            max_chars=max_chars,
        )

    def put_session_file(
        self,
        *,
        owner_id: str,
        session_id: str,
        local_path: Path,
        remote_path: str,
    ) -> Dict[str, Any]:
        """Upload a cached session file into the bound Remote Runner session."""
        binding = self.get_binding_model(session_id, owner_id)
        provider = self._session_provider_from_binding(binding)
        try:
            payload = provider.put_file(
                session_id=binding.runner_session_id,
                local_path=local_path,
                remote_path=remote_path,
            )
            self.record_audit(
                owner_id=owner_id,
                session_id=session_id,
                binding_id=binding.binding_id,
                action="file_put",
                command=f"{local_path.name} -> {remote_path}",
                result=payload,
                error="",
            )
            return payload
        except RemoteRunnerError as exc:
            self.record_audit(
                owner_id=owner_id,
                session_id=session_id,
                binding_id=binding.binding_id,
                action="file_put",
                command=f"{local_path.name} -> {remote_path}",
                result=None,
                error=str(exc),
            )
            raise

    def record_audit(
        self,
        *,
        owner_id: str,
        session_id: str,
        binding_id: Optional[str],
        action: str,
        command: str = "",
        cwd: str = "",
        result: Optional[Dict[str, Any]] = None,
        error: str = "",
        runner_session_id: Optional[str] = None,
    ) -> None:
        result = result or {}
        runner_session_id = runner_session_id or _extract_runner_session_id(result)
        if not runner_session_id and binding_id:
            binding = (
                self.db.query(SessionRemoteBindingModel)
                .filter(
                    SessionRemoteBindingModel.binding_id == binding_id,
                    SessionRemoteBindingModel.session_id == session_id,
                    SessionRemoteBindingModel.owner_id == owner_id,
                )
                .first()
            )
            runner_session_id = binding.runner_session_id if binding else None
        audit = RemoteCommandAuditModel(
            audit_id=str(uuid.uuid4()),
            owner_id=owner_id,
            session_id=session_id,
            binding_id=binding_id,
            runner_session_id=runner_session_id,
            action=action,
            command=command or None,
            cwd=cwd or None,
            exit_code=_extract_exit_code(result),
            stdout_excerpt=redact_text(str(result.get("stdout") or ""))[:2000] or None,
            stderr_excerpt=redact_text(str(result.get("stderr") or ""))[:2000] or None,
            error=redact_text(error)[:1000] if error else None,
        )
        self.db.add(audit)
        self.db.commit()

    def list_audits(self, session_id: str, owner_id: str) -> List[RemoteCommandAudit]:
        rows = (
            self.db.query(RemoteCommandAuditModel)
            .filter(
                RemoteCommandAuditModel.session_id == session_id,
                RemoteCommandAuditModel.owner_id == owner_id,
            )
            .order_by(RemoteCommandAuditModel.create_at.asc())
            .all()
        )
        binding_ids = {row.binding_id for row in rows if row.binding_id}
        bindings_by_id: Dict[str, SessionRemoteBindingModel] = {}
        if binding_ids:
            bindings_by_id = {
                binding.binding_id: binding
                for binding in self.db.query(SessionRemoteBindingModel)
                .filter(
                    SessionRemoteBindingModel.binding_id.in_(binding_ids),
                    SessionRemoteBindingModel.session_id == session_id,
                    SessionRemoteBindingModel.owner_id == owner_id,
                )
                .all()
            }
        return [
            RemoteCommandAudit(
                audit_id=row.audit_id,
                session_id=row.session_id,
                binding_id=row.binding_id,
                runner_session_id=(
                    row.runner_session_id
                    or (
                        bindings_by_id[row.binding_id].runner_session_id
                        if row.binding_id in bindings_by_id
                        else None
                    )
                ),
                terminal_id=(
                    row.runner_session_id
                    or (
                        bindings_by_id[row.binding_id].runner_session_id
                        if row.binding_id in bindings_by_id
                        else row.binding_id or "session"
                    )
                ),
                action=row.action,
                command=row.command,
                cwd=row.cwd,
                exit_code=row.exit_code,
                stdout_excerpt=row.stdout_excerpt,
                stderr_excerpt=row.stderr_excerpt,
                error=row.error,
                create_at=row.create_at.isoformat() if row.create_at else None,
            )
            for row in rows
        ]

    def _sync_and_doctor(
        self, model: UserRemoteMachineModel
    ) -> tuple[bool, str, Dict[str, Any], str]:
        if not self.provider.enabled:
            return False, "disabled", {}, "Remote Runner tools are disabled by configuration."
        provider = self._session_provider(model)
        try:
            if model.auth_type != "existing":
                provider.add_machine(
                    machine_id=model.runner_machine_name,
                    host=model.host or "",
                    port=model.port or 22,
                    user=model.username or "",
                    auth_type=model.auth_type,
                    password=self._decrypt(model.password_secret) or "",
                    key_path=model.key_path or "",
                    default_cwd=model.default_cwd or "",
                    startup_commands=model.startup_commands or [],
                )
            detail = provider.run_action(
                action="machine_doctor",
                machine_id=model.runner_machine_name,
                reason="Socratic remote machine connection test",
            )
        except RemoteRunnerError as exc:
            return False, "error", {}, str(exc)

        result = detail.get("result") or {}
        ok = bool(
            result.get("reachable")
            and result.get("auth_ok")
            and result.get("default_cwd_ok", True)
        )
        if ok:
            return True, "ready", detail, "Connection ready."
        return False, "error", detail, "Remote machine failed connectivity checks."

    def _session_provider(self, model: UserRemoteMachineModel) -> RemoteRunnerProvider:
        return RemoteRunnerProvider(
            RemoteRunnerProviderConfig(
                enabled=True,
                repo_path=self.provider.config.repo_path,
                state_dir=self.provider.config.state_dir,
                python_executable=self.provider.config.python_executable,
                timeout_seconds=self.provider.config.timeout_seconds,
                wait_timeout_seconds=self.provider.config.wait_timeout_seconds,
                max_output_chars=self.provider.config.max_output_chars,
                command_policy=self.provider.config.command_policy,
                allowed_machine_ids=(model.runner_machine_name,),
                allowed_commands=self.provider.config.allowed_commands,
                allowed_command_prefixes=self.provider.config.allowed_command_prefixes,
                allowed_cwd_prefixes=self.provider.config.allowed_cwd_prefixes,
            ),
            command_runner=self.provider._command_runner,
        )

    def _session_provider_from_binding(
        self, binding: SessionRemoteBindingModel
    ) -> RemoteRunnerProvider:
        return RemoteRunnerProvider(
            RemoteRunnerProviderConfig(
                enabled=True,
                repo_path=self.provider.config.repo_path,
                state_dir=self.provider.config.state_dir,
                python_executable=self.provider.config.python_executable,
                timeout_seconds=self.provider.config.timeout_seconds,
                wait_timeout_seconds=self.provider.config.wait_timeout_seconds,
                max_output_chars=self.provider.config.max_output_chars,
                command_policy=self.provider.config.command_policy,
                allowed_machine_ids=(binding.runner_machine_name,),
                allowed_commands=self.provider.config.allowed_commands,
                allowed_command_prefixes=self.provider.config.allowed_command_prefixes,
                allowed_cwd_prefixes=self.provider.config.allowed_cwd_prefixes,
            ),
            command_runner=self.provider._command_runner,
        )

    def _validate_payload(self, payload: RemoteMachineCreate | RemoteMachineUpdate) -> None:
        if payload.auth_type == "existing":
            return
        if not payload.host or not payload.username:
            raise ValueError("host and username are required unless auth_type is existing.")
        if payload.auth_type == "password" and not (
            payload.password or isinstance(payload, RemoteMachineUpdate)
        ):
            raise ValueError("password is required for password authentication.")
        if payload.auth_type == "key" and not payload.key_path:
            raise ValueError("key_path is required for key authentication.")

    def _summary(self, model: UserRemoteMachineModel) -> RemoteMachineSummary:
        return RemoteMachineSummary(
            machine_id=model.machine_id,
            display_name=model.display_name,
            runner_machine_name=model.runner_machine_name,
            host=model.host,
            port=model.port,
            username=model.username,
            auth_type=model.auth_type,
            key_path=model.key_path,
            default_cwd=model.default_cwd,
            startup_commands=model.startup_commands or [],
            has_password=bool(model.password_secret),
            status=model.status,
            last_error=model.last_error,
            last_checked_at=model.last_checked_at,
        )

    def _binding_summary(
        self,
        binding: SessionRemoteBindingModel,
        machine: Optional[UserRemoteMachineModel],
    ) -> RemoteBindingSummary:
        return RemoteBindingSummary(
            binding_id=binding.binding_id,
            machine_id=binding.user_machine_id,
            display_name=machine.display_name if machine else None,
            runner_machine_name=binding.runner_machine_name,
            runner_session_id=binding.runner_session_id,
            default_cwd=binding.default_cwd,
            status=binding.status,
        )

    def _shell_summary(
        self,
        shell: SessionRemoteShellModel,
        *,
        is_primary: bool,
    ) -> SessionRemoteShellSummary:
        return SessionRemoteShellSummary(
            shell_id=shell.shell_id,
            label=shell.label,
            runner_machine_name=shell.runner_machine_name,
            runner_session_id=shell.runner_session_id,
            default_cwd=shell.default_cwd,
            status=shell.status,
            is_primary=is_primary,
        )

    def _normalize_shell_label(self, label: str) -> str:
        cleaned = label.strip()
        if cleaned.lower() in _PRIMARY_SHELL_IDS:
            raise RemoteShellLabelError("'main' and 'primary' are reserved for the default shell.")
        if not _SHELL_LABEL_RE.fullmatch(cleaned):
            raise RemoteShellLabelError(
                "Shell label must start with a letter or number and contain only "
                "letters, numbers, dots, underscores, or hyphens."
            )
        return cleaned

    def _resolve_shell_target(
        self,
        *,
        owner_id: str,
        session_id: str,
        shell: str = "",
    ) -> tuple[SessionRemoteBindingModel, Optional[SessionRemoteShellModel], str, str]:
        binding = self.get_binding_model(session_id, owner_id)
        requested = (shell or "").strip()
        if requested.lower() in _PRIMARY_SHELL_IDS:
            return binding, None, binding.runner_session_id, "main"
        shell_model = (
            self.db.query(SessionRemoteShellModel)
            .filter(
                SessionRemoteShellModel.session_id == session_id,
                SessionRemoteShellModel.owner_id == owner_id,
                SessionRemoteShellModel.binding_id == binding.binding_id,
            )
            .filter(
                (SessionRemoteShellModel.shell_id == requested)
                | (SessionRemoteShellModel.label == requested)
                | (SessionRemoteShellModel.runner_session_id == requested)
            )
            .first()
        )
        if shell_model is None:
            raise RemoteShellNotFoundError(requested)
        return binding, shell_model, shell_model.runner_session_id, shell_model.label

    def _encrypt(self, secret: Optional[str]) -> Optional[str]:
        if not secret:
            return None
        return _remote_machine_cipher().encrypt(secret.encode()).decode()

    def _decrypt(self, secret: Optional[str]) -> Optional[str]:
        if not secret:
            return None
        try:
            return _remote_machine_cipher().decrypt(secret.encode()).decode()
        except InvalidToken as exc:
            raise RemoteMachineSecretError(
                "Stored remote machine password cannot be decrypted with the current "
                "REMOTE_MACHINE_SECRET_KEY."
            ) from exc


def _extract_exit_code(result: Dict[str, Any]) -> Optional[int]:
    if "exit_code" in result:
        try:
            return int(result["exit_code"])
        except (TypeError, ValueError):
            return None
    nested = result.get("result")
    if isinstance(nested, dict):
        return _extract_exit_code(nested)
    return None


def _extract_runner_session_id(result: Dict[str, Any]) -> Optional[str]:
    value = result.get("session_id") or result.get("runner_session_id")
    if value:
        return str(value)
    nested = result.get("result")
    if isinstance(nested, dict):
        return _extract_runner_session_id(nested)
    return None


def _remote_machine_cipher() -> Fernet:
    if _CIPHER is not None:
        return _CIPHER
    if _CIPHER_ERROR is not None:
        raise RemoteMachineSecretError(
            "REMOTE_MACHINE_SECRET_KEY must be a valid Fernet key before saving or "
            "using password-based remote machines."
        ) from _CIPHER_ERROR
    raise RemoteMachineSecretError(
        "REMOTE_MACHINE_SECRET_KEY must be set before saving or using "
        "password-based remote machines. Generate one with: python -c "
        "'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
    )
