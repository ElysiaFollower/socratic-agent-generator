"""LangChain skill wrapper for Remote Runner environment observation."""

from __future__ import annotations

import logging
import threading
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

_COMMAND_ACTIONS = {"session_exec", "session_exec_background"}
_RUNNER_SESSION_LOCKS: dict[str, threading.Lock] = {}
_RUNNER_SESSION_LOCKS_GUARD = threading.Lock()


def _runner_session_lock(session_id: str) -> threading.Lock:
    with _RUNNER_SESSION_LOCKS_GUARD:
        return _RUNNER_SESSION_LOCKS.setdefault(session_id, threading.Lock())

class RemoteEnvironmentSkill:
    """Expose permissioned remote lab observation as a Tutor tool."""

    name = "observe_remote_environment"
    description = (
        "Observe the student's configured lab environment through Remote Runner. "
        "Use only when the student's current machine state, shell output, files, "
        "or diagnostic context are needed to guide them. Supported actions are "
        "list_machines, list_sessions, machine_doctor, session_exec, "
        "session_exec_background, session_command_list, session_command_show, "
        "session_command_result, session_command_wait, and session_command_stop. "
        "session_exec stays restricted to configured safe commands."
    )

    def __init__(self, provider: RemoteRunnerProvider) -> None:
        self.provider = provider

    def get_tools(self):
        return [self._build_tool()]

    def get_tool(self):
        return self.get_tools()[0]

    def _build_tool(self):
        tool_name = self.name
        tool_description = self.description
        provider = self.provider

        @tool(tool_name)
        def observe_remote_environment(
            action: str,
            machine_id: str = "",
            session_id: str = "",
            command: str = "",
            command_id: str = "",
            cwd: str = "",
            reason: str = "",
            wait_timeout_seconds: int = 0,
        ) -> str:
            """Observe the configured remote lab environment.

            Args:
                action: One of the supported Remote Runner observation actions.
                machine_id: Machine id for machine_doctor or policy checks.
                session_id: Existing Remote Runner session id for session actions.
                command: Safe diagnostic command for command execution.
                command_id: Session command id for result/wait/stop inspection.
                cwd: Optional cwd override, subject to configured prefixes.
                reason: Short reason this observation helps the tutoring step.
                wait_timeout_seconds: Explicit wait time for command polling.

            Returns:
                Sanitized Remote Runner JSON result or a safe error payload.
            """
            return provider.observe(
                action=action,
                machine_id=machine_id,
                session_id=session_id,
                command=command,
                command_id=command_id,
                cwd=cwd,
                reason=reason,
                wait_timeout_seconds=wait_timeout_seconds,
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
        "for machine ids or credentials. Supported actions: check_connection, "
        "run_command, start_command, list_commands, get_command_result, "
        "wait_command, and stop_command. Use run_command for short lab "
        "diagnostics, start_command for long-running lab work, and the other "
        "tools to inspect or control previously started commands."
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

    def get_tools(self):
        return [
            self._build_check_connection_tool(),
            self._build_run_command_tool(),
            self._build_start_command_tool(),
            self._build_list_commands_tool(),
            self._build_get_result_tool(),
            self._build_wait_command_tool(),
            self._build_stop_command_tool(),
        ]

    def get_tool(self):
        tool_name = self.name
        tool_description = self.description
        skill = self

        @tool(tool_name)
        def observe_remote_environment(
            action: str,
            command: str = "",
            command_id: str = "",
            cwd: str = "",
            reason: str = "",
            wait_timeout_seconds: int = 0,
        ) -> str:
            """Observe or execute commands on the session-bound lab machine.

            Args:
                action: check_connection, run_command, start_command,
                    list_commands, get_command_result, wait_command, or stop_command.
                command: Command to run when action is command execution.
                command_id: Background command id for result/wait/stop actions.
                cwd: Optional cwd override, subject to configured policy.
                reason: Short reason this observation helps the tutoring step.
                wait_timeout_seconds: Explicit wait time for wait_command.
            """
            normalized = action.strip().lower().replace("-", "_")
            if normalized in {"check", "doctor", "check_connection"}:
                return skill._run_bound_action(
                    action="machine_doctor",
                    command="",
                    command_id="",
                    cwd="",
                    reason=reason,
                )
            if normalized in {"run", "exec", "execute", "run_command", "session_exec"}:
                return skill._run_bound_action(
                    action="session_exec",
                    command=command,
                    command_id="",
                    cwd=cwd,
                    reason=reason,
                )
            if normalized in {"start", "background", "start_command", "run_background"}:
                return skill._run_bound_action(
                    action="session_exec_background",
                    command=command,
                    command_id="",
                    cwd=cwd,
                    reason=reason,
                )
            if normalized in {"list", "list_commands", "command_list", "session_command_list"}:
                return skill._run_bound_action(
                    action="session_command_list",
                    command="",
                    command_id="",
                    cwd="",
                    reason=reason,
                )
            if normalized in {"result", "get_result", "get_command_result", "session_command_result", "show"}:
                return skill._run_bound_action(
                    action="session_command_result",
                    command="",
                    command_id=command_id,
                    cwd="",
                    reason=reason,
                )
            if normalized in {"wait", "wait_command", "session_command_wait"}:
                return skill._run_bound_action(
                    action="session_command_wait",
                    command="",
                    command_id=command_id,
                    cwd="",
                    reason=reason,
                    wait_timeout_seconds=wait_timeout_seconds,
                )
            if normalized in {"stop", "stop_command", "session_command_stop"}:
                return skill._run_bound_action(
                    action="session_command_stop",
                    command="",
                    command_id=command_id,
                    cwd="",
                    reason=reason,
                )
            return skill._error_payload(normalized, "Unsupported remote action.")

        observe_remote_environment.name = tool_name
        observe_remote_environment.description = tool_description
        return observe_remote_environment

    def _build_check_connection_tool(self):
        skill = self

        @tool("check_remote_connection")
        def check_remote_connection(reason: str = "") -> str:
            """Check whether the bound lab machine is reachable and authenticated."""
            return skill._run_bound_action(
                action="machine_doctor",
                command="",
                command_id="",
                cwd="",
                reason=reason,
            )

        return check_remote_connection

    def _build_run_command_tool(self):
        skill = self

        @tool("run_remote_command")
        def run_remote_command(
            command: str,
            cwd: str = "",
            reason: str = "",
        ) -> str:
            """Run a short bounded command and wait for the result."""
            return skill._run_bound_action(
                action="session_exec",
                command=command,
                command_id="",
                cwd=cwd,
                reason=reason,
            )

        return run_remote_command

    def _build_start_command_tool(self):
        skill = self

        @tool("start_remote_command")
        def start_remote_command(
            command: str,
            cwd: str = "",
            reason: str = "",
        ) -> str:
            """Start a long-running command in the background and return its id."""
            return skill._run_bound_action(
                action="session_exec_background",
                command=command,
                command_id="",
                cwd=cwd,
                reason=reason,
            )

        return start_remote_command

    def _build_list_commands_tool(self):
        skill = self

        @tool("list_remote_commands")
        def list_remote_commands(reason: str = "") -> str:
            """List the commands recorded for the bound Remote Runner session."""
            return skill._run_bound_action(
                action="session_command_list",
                command="",
                command_id="",
                cwd="",
                reason=reason,
            )

        return list_remote_commands

    def _build_get_result_tool(self):
        skill = self

        @tool("get_remote_command_result")
        def get_remote_command_result(
            command_id: str,
            reason: str = "",
        ) -> str:
            """Inspect the latest state and accumulated output for a background command."""
            return skill._run_bound_action(
                action="session_command_result",
                command="",
                command_id=command_id,
                cwd="",
                reason=reason,
            )

        return get_remote_command_result

    def _build_wait_command_tool(self):
        skill = self

        @tool("wait_remote_command")
        def wait_remote_command(
            command_id: str,
            timeout_seconds: int = 0,
            reason: str = "",
        ) -> str:
            """Wait for a background command for a bounded amount of time."""
            return skill._run_bound_action(
                action="session_command_wait",
                command="",
                command_id=command_id,
                cwd="",
                reason=reason,
                wait_timeout_seconds=timeout_seconds,
            )

        return wait_remote_command

    def _build_stop_command_tool(self):
        skill = self

        @tool("stop_remote_command")
        def stop_remote_command(
            command_id: str,
            reason: str = "",
        ) -> str:
            """Request that a running background command stop."""
            return skill._run_bound_action(
                action="session_command_stop",
                command="",
                command_id=command_id,
                cwd="",
                reason=reason,
            )

        return stop_remote_command

    def _run_bound_action(
        self,
        *,
        action: str,
        command: str,
        command_id: str,
        cwd: str,
        reason: str,
        wait_timeout_seconds: int = 0,
    ) -> str:
        try:
            if action in _COMMAND_ACTIONS:
                with _runner_session_lock(self.runner_session_id):
                    payload = self.provider.run_action(
                        action=action,
                        machine_id=self.runner_machine_name,
                        session_id=self.runner_session_id,
                        command_id=command_id,
                        command=command,
                        cwd=cwd,
                        reason=reason,
                        wait_timeout_seconds=wait_timeout_seconds,
                    )
            else:
                payload = self.provider.run_action(
                    action=action,
                    machine_id=self.runner_machine_name,
                    session_id=self.runner_session_id,
                    command_id=command_id,
                    command=command,
                    cwd=cwd,
                    reason=reason,
                    wait_timeout_seconds=wait_timeout_seconds,
                )
            self._record_audit(
                action,
                command,
                command_id,
                cwd,
                payload.get("result"),
                "",
            )
        except RemoteRunnerError as exc:
            payload = {"ok": False, "action": action, "error": str(exc)}
            self._record_audit(action, command, command_id, cwd, None, str(exc))
        except Exception as exc:
            logger.warning("Session-bound Remote Runner action failed: %s", exc, exc_info=True)
            payload = {
                "ok": False,
                "action": action,
                "error": "Remote Runner action failed.",
            }
            self._record_audit(
                action,
                command,
                command_id,
                cwd,
                None,
                "Remote Runner action failed.",
            )
        return self.provider._format_observation(payload)

    def _record_audit(
        self,
        action: str,
        command: str,
        command_id: str,
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
                    command=command or (f"command_id={command_id}" if command_id else ""),
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
                    wait_timeout_seconds=provider.config.wait_timeout_seconds,
                    max_output_chars=provider.config.max_output_chars,
                    command_policy=provider.config.command_policy,
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
