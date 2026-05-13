"""LangChain skill wrapper for Remote Runner environment observation."""

from __future__ import annotations

import logging
from typing import Optional

from langchain_core.tools import tool

from core.database import SessionLocal
from schemas.session import Session
from utils.remote_machine_manager import RemoteMachineManager
from utils.remote_runner_provider import (
    RemoteRunnerError,
    RemoteRunnerProvider,
    RemoteRunnerProviderConfig,
    get_remote_runner_provider,
)

logger = logging.getLogger(__name__)


class RemoteEnvironmentSkill:
    """Expose permissioned remote lab observation as a Tutor tool."""

    name = "observe_remote_environment"
    description = (
        "Observe the student's configured lab environment through Remote Runner. "
        "Use only when the student's current machine state, shell output, files, "
        "or diagnostic context are needed to guide them. Supported actions are "
        "list_machines, list_sessions, machine_doctor, and session_exec. "
        "session_exec is restricted to configured safe commands."
    )

    def __init__(self, provider: RemoteRunnerProvider) -> None:
        self.provider = provider

    def get_tool(self):
        tool_name = self.name
        tool_description = self.description

        @tool(tool_name)
        def observe_remote_environment(
            action: str,
            machine_id: str = "",
            session_id: str = "",
            command: str = "",
            cwd: str = "",
            reason: str = "",
        ) -> str:
            """Observe the configured remote lab environment.

            Args:
                action: One of list_machines, list_sessions, machine_doctor,
                    or session_exec.
                machine_id: Machine id for machine_doctor or policy checks.
                session_id: Existing Remote Runner session id for session_exec.
                command: Safe diagnostic command for session_exec.
                cwd: Optional cwd override, subject to configured prefixes.
                reason: Short reason this observation helps the tutoring step.

            Returns:
                Sanitized Remote Runner JSON result or a safe error payload.
            """
            return self.provider.observe(
                action=action,
                machine_id=machine_id,
                session_id=session_id,
                command=command,
                cwd=cwd,
                reason=reason,
            )

        observe_remote_environment.name = tool_name
        observe_remote_environment.description = tool_description
        return observe_remote_environment


class SessionBoundRemoteEnvironmentSkill:
    """Expose Remote Runner actions for exactly one Socratic session binding."""

    name = "observe_remote_environment"
    description = (
        "Use the lab machine bound to this learning session. The machine and "
        "Remote Runner session are fixed by the system; do not ask the student "
        "for machine ids or credentials. Supported actions: check_connection "
        "and run_command. Use run_command for lab diagnostics, collecting "
        "evidence, and debugging command output."
    )

    def __init__(
        self,
        provider: RemoteRunnerProvider,
        *,
        owner_id: str,
        session_id: str,
        binding_id: str,
        runner_machine_name: str,
        runner_session_id: str,
    ) -> None:
        self.provider = provider
        self.owner_id = owner_id
        self.session_id = session_id
        self.binding_id = binding_id
        self.runner_machine_name = runner_machine_name
        self.runner_session_id = runner_session_id

    def get_tool(self):
        tool_name = self.name
        tool_description = self.description
        skill = self

        @tool(tool_name)
        def observe_remote_environment(
            action: str,
            command: str = "",
            cwd: str = "",
            reason: str = "",
        ) -> str:
            """Observe or execute commands on the session-bound lab machine.

            Args:
                action: check_connection or run_command.
                command: Command to run when action is run_command.
                cwd: Optional cwd override, subject to configured policy.
                reason: Short reason this observation helps the tutoring step.
            """
            normalized = action.strip().lower().replace("-", "_")
            if normalized in {"check", "doctor", "check_connection"}:
                return skill._run_bound_action(
                    action="machine_doctor",
                    command="",
                    cwd="",
                    reason=reason,
                )
            if normalized in {"run", "exec", "execute", "run_command", "session_exec"}:
                return skill._run_bound_action(
                    action="session_exec",
                    command=command,
                    cwd=cwd,
                    reason=reason,
                )
            return skill._error_payload(normalized, "Unsupported remote action.")

        observe_remote_environment.name = tool_name
        observe_remote_environment.description = tool_description
        return observe_remote_environment

    def _run_bound_action(
        self,
        *,
        action: str,
        command: str,
        cwd: str,
        reason: str,
    ) -> str:
        try:
            payload = self.provider.run_action(
                action=action,
                machine_id=self.runner_machine_name,
                session_id=self.runner_session_id if action == "session_exec" else "",
                command=command,
                cwd=cwd,
                reason=reason,
            )
            self._record_audit(action, command, cwd, payload.get("result"), "")
        except RemoteRunnerError as exc:
            payload = {"ok": False, "action": action, "error": str(exc)}
            self._record_audit(action, command, cwd, None, str(exc))
        except Exception as exc:
            logger.warning("Session-bound Remote Runner action failed: %s", exc, exc_info=True)
            payload = {
                "ok": False,
                "action": action,
                "error": "Remote Runner action failed.",
            }
            self._record_audit(action, command, cwd, None, "Remote Runner action failed.")
        return self.provider._format_observation(payload)

    def _record_audit(
        self,
        action: str,
        command: str,
        cwd: str,
        result: Optional[dict],
        error: str,
    ) -> None:
        try:
            with SessionLocal() as db:
                RemoteMachineManager(db, provider=self.provider).record_audit(
                    owner_id=self.owner_id,
                    session_id=self.session_id,
                    binding_id=self.binding_id,
                    action=action,
                    command=command,
                    cwd=cwd,
                    result=result,
                    error=error,
                )
        except Exception as exc:
            logger.warning("Failed to record remote command audit: %s", exc)

    def _error_payload(self, action: str, message: str) -> str:
        return self.provider._format_observation(
            {"ok": False, "action": action, "error": message}
        )


def get_remote_environment_skill(
    provider: Optional[RemoteRunnerProvider] = None,
    session: Optional[Session] = None,
) -> Optional[RemoteEnvironmentSkill]:
    """Return the remote skill only when the feature is enabled."""
    provider = provider or get_remote_runner_provider()
    if session is not None:
        if not provider.enabled:
            logger.info("Session-bound remote skill disabled: %s", provider.status)
            return None
        owner_id = session.owner_id
        if not owner_id:
            return None
        with SessionLocal() as db:
            manager = RemoteMachineManager(db, provider=provider)
            binding = manager.get_binding_model(
                session.session_id,
                owner_id,
                required=False,
            )
            if binding is None or binding.status != "active":
                return None
            bound_provider = RemoteRunnerProvider(
                RemoteRunnerProviderConfig(
                    enabled=True,
                    repo_path=provider.config.repo_path,
                    state_dir=provider.config.state_dir,
                    python_executable=provider.config.python_executable,
                    timeout_seconds=provider.config.timeout_seconds,
                    max_output_chars=provider.config.max_output_chars,
                    allowed_machine_ids=(binding.runner_machine_name,),
                    allowed_commands=provider.config.allowed_commands,
                    allowed_command_prefixes=provider.config.allowed_command_prefixes,
                    allowed_cwd_prefixes=provider.config.allowed_cwd_prefixes,
                ),
                command_runner=provider._command_runner,
            )
            return SessionBoundRemoteEnvironmentSkill(
                bound_provider,
                owner_id=owner_id,
                session_id=session.session_id,
                binding_id=binding.binding_id,
                runner_machine_name=binding.runner_machine_name,
                runner_session_id=binding.runner_session_id,
            )
    if not provider.enabled:
        logger.info("Remote environment skill disabled: %s", provider.status)
        return None
    return RemoteEnvironmentSkill(provider)
