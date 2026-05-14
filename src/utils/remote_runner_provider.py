"""Remote Runner adapter for permissioned lab environment observation.

Socratic depends on this narrow boundary instead of importing Remote Runner
internals throughout TutorCore. The first prototype uses the external CLI so
local tests can replace the process runner without touching SSH.
"""

from __future__ import annotations

import json
import logging
import os
import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, Mapping, Optional, Sequence

from config import (
    REMOTE_RUNNER_PYTHON_EXECUTABLE,
    REMOTE_RUNNER_REPO_PATH,
    REMOTE_RUNNER_STATE_DIR,
    REMOTE_TOOL_ALLOWED_COMMANDS,
    REMOTE_TOOL_ALLOWED_COMMAND_PREFIXES,
    REMOTE_TOOL_ALLOWED_CWD_PREFIXES,
    REMOTE_TOOL_ALLOWED_MACHINE_IDS,
    REMOTE_TOOL_COMMAND_TIMEOUT,
    REMOTE_TOOL_ENABLED,
    REMOTE_TOOL_OUTPUT_CHARS,
)

logger = logging.getLogger(__name__)


class RemoteRunnerError(RuntimeError):
    """Base error for Remote Runner adapter failures."""


class RemoteRunnerPermissionError(RemoteRunnerError):
    """Raised when a requested remote action violates local policy."""


class RemoteRunnerUnavailable(RemoteRunnerError):
    """Raised when Remote Runner cannot be invoked."""


@dataclass(frozen=True)
class RunnerResult:
    """Small subprocess result shape used by tests and the default runner."""

    returncode: int
    stdout: str = ""
    stderr: str = ""


CommandRunner = Callable[
    [Sequence[str], Mapping[str, str], Optional[Path], int],
    RunnerResult,
]


@dataclass(frozen=True)
class RemoteRunnerProviderConfig:
    """Runtime policy for the Socratic Remote Runner adapter."""

    enabled: bool = REMOTE_TOOL_ENABLED
    repo_path: Optional[str] = REMOTE_RUNNER_REPO_PATH
    state_dir: Optional[str] = REMOTE_RUNNER_STATE_DIR
    python_executable: str = REMOTE_RUNNER_PYTHON_EXECUTABLE
    timeout_seconds: int = REMOTE_TOOL_COMMAND_TIMEOUT
    wait_timeout_seconds: int = REMOTE_TOOL_COMMAND_TIMEOUT
    max_output_chars: int = REMOTE_TOOL_OUTPUT_CHARS
    allowed_machine_ids: Sequence[str] = field(
        default_factory=lambda: tuple(REMOTE_TOOL_ALLOWED_MACHINE_IDS)
    )
    allowed_commands: Sequence[str] = field(
        default_factory=lambda: tuple(REMOTE_TOOL_ALLOWED_COMMANDS)
    )
    allowed_command_prefixes: Sequence[str] = field(
        default_factory=lambda: tuple(REMOTE_TOOL_ALLOWED_COMMAND_PREFIXES)
    )
    allowed_cwd_prefixes: Sequence[str] = field(
        default_factory=lambda: tuple(REMOTE_TOOL_ALLOWED_CWD_PREFIXES)
    )


class RemoteRunnerProvider:
    """CLI-backed Remote Runner provider with Socratic-side guardrails."""

    def __init__(
        self,
        config: Optional[RemoteRunnerProviderConfig] = None,
        command_runner: Optional[CommandRunner] = None,
    ) -> None:
        self.config = config or RemoteRunnerProviderConfig()
        self._command_runner = command_runner or self._default_command_runner

    @property
    def enabled(self) -> bool:
        return self.config.enabled

    @property
    def status(self) -> str:
        if not self.enabled:
            return "disabled"
        repo_path = self._repo_path()
        if self.config.repo_path and repo_path is None:
            return "unavailable:repo_path_missing"
        return "ready"

    def observe(
        self,
        *,
        action: str,
        machine_id: str = "",
        session_id: str = "",
        command: str = "",
        command_id: str = "",
        cwd: str = "",
        reason: str = "",
        wait_timeout_seconds: int = 0,
    ) -> str:
        """Run a guarded observation action and return prompt-ready text."""
        normalized_action = _normalize_action(action)
        try:
            payload = self.run_action(
                action=normalized_action,
                machine_id=machine_id,
                session_id=session_id,
                command=command,
                command_id=command_id,
                cwd=cwd,
                reason=reason,
                wait_timeout_seconds=wait_timeout_seconds,
            )
        except RemoteRunnerError as exc:
            payload = {
                "ok": False,
                "action": normalized_action,
                "error": str(exc),
            }
        except Exception as exc:
            logger.warning("Remote Runner observation failed: %s", exc, exc_info=True)
            payload = {
                "ok": False,
                "action": normalized_action,
                "error": "Remote Runner observation failed.",
            }

        return self._format_observation(payload)

    def run_action(
        self,
        *,
        action: str,
        machine_id: str = "",
        session_id: str = "",
        command: str = "",
        command_id: str = "",
        cwd: str = "",
        reason: str = "",
        wait_timeout_seconds: int = 0,
    ) -> Dict[str, Any]:
        """Run a supported Remote Runner action and return sanitized data."""
        if not self.enabled:
            raise RemoteRunnerUnavailable("Remote tool is disabled by configuration.")

        normalized_action = _normalize_action(action)
        cli_args = self._build_cli_args(
            normalized_action,
            machine_id=machine_id,
            session_id=session_id,
            command=command,
            command_id=command_id,
            cwd=cwd,
            wait_timeout_seconds=wait_timeout_seconds,
        )
        result = self._run_json(
            cli_args,
            timeout_seconds=self._cli_timeout_seconds(normalized_action, wait_timeout_seconds),
        )
        filtered = self._filter_payload(normalized_action, result)

        return {
            "ok": True,
            "action": normalized_action,
            "reason": reason.strip()[:300] if reason else "",
            "result": filtered,
        }

    def add_machine(
        self,
        *,
        machine_id: str,
        host: str,
        port: int,
        user: str,
        auth_type: str,
        password: str = "",
        key_path: str = "",
        default_cwd: str = "",
        startup_commands: Sequence[str] = (),
        replace: bool = True,
    ) -> Dict[str, Any]:
        """Add or update a Remote Runner machine through the CLI."""
        args = [
            "machine",
            "add",
            "--machine-id",
            _require_value(machine_id, "machine_id"),
            "--host",
            _require_value(host, "host"),
            "--port",
            str(port),
            "--user",
            _require_value(user, "user"),
            "--auth-type",
            _require_value(auth_type, "auth_type"),
        ]
        if default_cwd:
            args.extend(["--default-cwd", default_cwd])
        for command in startup_commands:
            if command.strip():
                args.extend(["--startup-command", command.strip()])
        if auth_type == "password":
            args.extend(["--password", _require_value(password, "password")])
        elif auth_type == "key":
            args.extend(["--key-path", _require_value(key_path, "key_path")])
        else:
            raise RemoteRunnerPermissionError("auth_type must be password or key.")
        if replace:
            args.extend(["--replace", "--confirm-replace", machine_id])
        args.append("--json")
        return redact_sensitive(self._run_json(tuple(args)))

    def create_session(self, *, machine_id: str, cwd: str = "") -> Dict[str, Any]:
        """Create a Remote Runner session for a machine."""
        safe_machine = self._require_machine(machine_id)
        args = ["session", "create", "--machine", safe_machine]
        if cwd:
            args.extend(["--cwd", cwd])
        args.append("--json")
        return redact_sensitive(self._run_json(tuple(args)))

    def destroy_session(self, *, session_id: str) -> Dict[str, Any]:
        """Destroy a Remote Runner session."""
        safe_session = _require_value(session_id, "session_id")
        return redact_sensitive(
            self._run_json(("session", "destroy", "--session", safe_session, "--json"))
        )

    def put_file(
        self,
        *,
        session_id: str,
        local_path: str | Path,
        remote_path: str,
    ) -> Dict[str, Any]:
        """Upload a local file into a Remote Runner session."""
        safe_session = _require_value(session_id, "session_id")
        local = Path(local_path).expanduser().resolve()
        if not local.exists() or not local.is_file():
            raise RemoteRunnerError("Local file does not exist.")
        safe_remote = _require_value(remote_path, "remote_path")
        return redact_sensitive(
            self._run_json(
                (
                    "file",
                    "put",
                    "--session",
                    safe_session,
                    "--local",
                    str(local),
                    "--remote",
                    safe_remote,
                    "--json",
                )
            )
        )

    def read_session_transcript(
        self,
        *,
        session_id: str,
        machine_id: str = "",
        since: int = 0,
        max_chars: int = 12000,
    ) -> Dict[str, Any]:
        """Read the persistent Remote Runner shell transcript for a session."""
        if not self.enabled:
            raise RemoteRunnerUnavailable("Remote tool is disabled by configuration.")
        safe_session = _require_value(session_id, "session_id")
        self._validate_session_machine(safe_session, machine_id)
        args = [
            "session",
            "read",
            "--session",
            safe_session,
            "--since",
            str(max(0, since)),
            "--max-chars",
            str(max(1, max_chars)),
            "--json",
        ]
        return redact_sensitive(self._run_json(tuple(args)))

    def send_session_input(
        self,
        *,
        session_id: str,
        machine_id: str = "",
        input_text: str,
        enter: bool = True,
    ) -> Dict[str, Any]:
        """Send raw input to the persistent shell.

        This is intentionally not the default student command path; normal
        command entry should use session_exec so command policy and audit stay
        structured.
        """
        if not self.enabled:
            raise RemoteRunnerUnavailable("Remote tool is disabled by configuration.")
        safe_session = _require_value(session_id, "session_id")
        safe_input = _require_value(input_text, "input")
        self._validate_session_machine(safe_session, machine_id)
        args = [
            "session",
            "send",
            "--session",
            safe_session,
            "--input",
            safe_input,
        ]
        if not enter:
            args.append("--no-enter")
        args.append("--json")
        return redact_sensitive(self._run_json(tuple(args)))

    def _build_cli_args(
        self,
        action: str,
        *,
        machine_id: str,
        session_id: str,
        command: str,
        command_id: str,
        cwd: str,
        wait_timeout_seconds: int,
    ) -> Sequence[str]:
        if action == "list_machines":
            return ("machine", "list", "--json")

        if action == "list_sessions":
            return ("session", "list", "--json")

        if action == "machine_doctor":
            safe_machine = self._require_machine(machine_id)
            return ("machine", "doctor", safe_machine, "--json")

        if action == "session_exec":
            safe_session = _require_value(session_id, "session_id")
            safe_command = self._require_allowed_command(command)
            safe_cwd = self._validate_cwd(cwd)
            self._validate_session_machine(safe_session, machine_id)
            args = [
                "session",
                "exec",
                "--session",
                safe_session,
                "--cmd",
                safe_command,
                "--timeout",
                str(max(1, self.config.timeout_seconds)),
                "--mode",
                "wait",
            ]
            if safe_cwd:
                args.extend(["--cwd", safe_cwd])
            args.append("--json")
            return tuple(args)

        if action == "session_exec_background":
            safe_session = _require_value(session_id, "session_id")
            safe_command = self._require_allowed_command(command)
            safe_cwd = self._validate_cwd(cwd)
            self._validate_session_machine(safe_session, machine_id)
            args = [
                "session",
                "exec",
                "--session",
                safe_session,
                "--cmd",
                safe_command,
                "--timeout",
                str(max(1, self.config.timeout_seconds)),
                "--mode",
                "background",
            ]
            if safe_cwd:
                args.extend(["--cwd", safe_cwd])
            args.append("--json")
            return tuple(args)

        if action == "session_command_list":
            safe_session = _require_value(session_id, "session_id")
            self._validate_session_machine(safe_session, machine_id)
            return ("session", "command", "list", "--session", safe_session, "--json")

        if action in {"session_command_show", "session_command_result"}:
            safe_session = _require_value(session_id, "session_id")
            safe_command_id = _require_value(command_id, "command_id")
            self._validate_session_machine(safe_session, machine_id)
            command_action = "show" if action == "session_command_show" else "result"
            return (
                "session",
                "command",
                command_action,
                "--session",
                safe_session,
                "--command-id",
                safe_command_id,
                "--stdout-bytes",
                "8192",
                "--stderr-bytes",
                "8192",
                "--json",
            )

        if action == "session_command_wait":
            safe_session = _require_value(session_id, "session_id")
            safe_command_id = _require_value(command_id, "command_id")
            safe_wait = max(1, wait_timeout_seconds or self.config.wait_timeout_seconds)
            self._validate_session_machine(safe_session, machine_id)
            return (
                "session",
                "command",
                "wait",
                "--session",
                safe_session,
                "--command-id",
                safe_command_id,
                "--timeout",
                str(safe_wait),
                "--stdout-bytes",
                "8192",
                "--stderr-bytes",
                "8192",
                "--json",
            )

        if action == "session_command_stop":
            safe_session = _require_value(session_id, "session_id")
            safe_command_id = _require_value(command_id, "command_id")
            self._validate_session_machine(safe_session, machine_id)
            return (
                "session",
                "command",
                "stop",
                "--session",
                safe_session,
                "--command-id",
                safe_command_id,
                "--json",
            )

        raise RemoteRunnerPermissionError(
            "Unsupported remote observation action. "
            "Allowed actions: list_machines, list_sessions, machine_doctor, "
            "session_exec, session_exec_background, session_command_list, "
            "session_command_show, session_command_result, session_command_wait, "
            "session_command_stop."
        )

    def _run_json(
        self, cli_args: Sequence[str], timeout_seconds: Optional[int] = None
    ) -> Dict[str, Any]:
        if self.config.repo_path and self._repo_path() is None:
            raise RemoteRunnerUnavailable("Remote Runner repo path does not exist.")

        base_args = [self.config.python_executable, "-m", "remote_runner.cli"]
        full_args = [*base_args, *cli_args]
        env = self._build_env()
        cwd = self._repo_path()

        completed = self._command_runner(
            full_args,
            env,
            cwd,
            max(1, (timeout_seconds or self.config.timeout_seconds) + 2),
        )
        output = completed.stdout.strip() or completed.stderr.strip()
        payload = self._parse_json(output)
        payload = redact_sensitive(payload)

        if completed.returncode != 0:
            error = payload.get("error") if isinstance(payload, dict) else None
            raise RemoteRunnerError(str(error or "Remote Runner command failed."))

        return payload

    def _build_env(self) -> Dict[str, str]:
        env = dict(os.environ)
        repo_path = self._repo_path()
        if repo_path is not None:
            existing = env.get("PYTHONPATH", "")
            path_parts = [str(repo_path)]
            if existing:
                path_parts.append(existing)
            env["PYTHONPATH"] = os.pathsep.join(path_parts)
        if self.config.state_dir:
            env["REMOTE_RUNNER_STATE_DIR"] = str(
                Path(self.config.state_dir).expanduser()
            )
        return env

    def _repo_path(self) -> Optional[Path]:
        if not self.config.repo_path:
            return None
        path = Path(self.config.repo_path).expanduser()
        if not path.exists():
            return None
        return path.resolve()

    def _parse_json(self, output: str) -> Dict[str, Any]:
        if not output:
            raise RemoteRunnerError("Remote Runner returned no JSON output.")
        try:
            payload = json.loads(output)
        except json.JSONDecodeError as exc:
            redacted = redact_text(output[:500])
            raise RemoteRunnerError(
                f"Remote Runner returned invalid JSON: {redacted}"
            ) from exc
        if not isinstance(payload, dict):
            raise RemoteRunnerError("Remote Runner JSON output must be an object.")
        return payload

    def _filter_payload(self, action: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        if action == "list_machines" and self.config.allowed_machine_ids:
            allowed = set(self.config.allowed_machine_ids)
            machines = payload.get("machines")
            if isinstance(machines, list):
                payload = dict(payload)
                payload["machines"] = [
                    item
                    for item in machines
                    if isinstance(item, dict) and item.get("machine_id") in allowed
                ]
                payload["summary"] = {"machine_count": len(payload["machines"])}

        if action == "list_sessions" and self.config.allowed_machine_ids:
            allowed = set(self.config.allowed_machine_ids)
            sessions = payload.get("sessions")
            if isinstance(sessions, list):
                payload = dict(payload)
                payload["sessions"] = [
                    item
                    for item in sessions
                    if isinstance(item, dict) and item.get("machine_id") in allowed
                ]
                payload["summary"] = {"session_count": len(payload["sessions"])}

        return redact_sensitive(payload)

    def _format_observation(self, payload: Dict[str, Any]) -> str:
        text = json.dumps(
            redact_sensitive(payload),
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
        limit = max(500, self.config.max_output_chars)
        if len(text) <= limit:
            return text
        return text[:limit].rstrip() + "\n...[truncated]"

    def _require_machine(self, machine_id: str) -> str:
        safe_machine = _require_value(machine_id, "machine_id")
        allowed = set(self.config.allowed_machine_ids)
        if allowed and safe_machine not in allowed:
            raise RemoteRunnerPermissionError(
                f"Machine '{safe_machine}' is not allowed for this Tutor."
            )
        return safe_machine

    def _require_allowed_command(self, command: str) -> str:
        safe_command = _require_value(command, "command")
        allowed = {item.strip() for item in self.config.allowed_commands if item.strip()}
        prefixes = tuple(
            item for item in self.config.allowed_command_prefixes if item.strip()
        )
        if allowed and safe_command in allowed:
            return safe_command
        if prefixes and safe_command.startswith(prefixes):
            return safe_command
        if allowed or prefixes:
            raise RemoteRunnerPermissionError(
                "Command is not allowed by Remote Runner command policy."
            )
        raise RemoteRunnerPermissionError(
            "No Remote Runner command allowlist is configured; refusing to execute "
            "commands by default."
        )

    def _validate_cwd(self, cwd: str) -> str:
        safe_cwd = cwd.strip()
        if not safe_cwd:
            return ""
        prefixes = tuple(self.config.allowed_cwd_prefixes)
        if prefixes and not safe_cwd.startswith(prefixes):
            raise RemoteRunnerPermissionError(
                "cwd is outside REMOTE_TOOL_ALLOWED_CWD_PREFIXES."
            )
        return safe_cwd

    def _validate_session_machine(self, session_id: str, machine_id: str) -> None:
        if not self.config.allowed_machine_ids:
            return

        session = self._run_json(
            ("session", "show", "--session", session_id, "--json"),
            timeout_seconds=self.config.timeout_seconds,
        )
        observed_machine = str(session.get("machine_id") or "")
        allowed = set(self.config.allowed_machine_ids)
        if observed_machine not in allowed:
            raise RemoteRunnerPermissionError(
                "Session belongs to a machine that is not allowed for this Tutor."
            )
        if machine_id.strip() and observed_machine != machine_id.strip():
            raise RemoteRunnerPermissionError(
                "Provided machine_id does not match the session machine."
            )

    def _cli_timeout_seconds(
        self, action: str, wait_timeout_seconds: int = 0
    ) -> int:
        if action == "session_command_wait":
            return max(1, wait_timeout_seconds or self.config.wait_timeout_seconds)
        return max(1, self.config.timeout_seconds)

    def _default_command_runner(
        self,
        args: Sequence[str],
        env: Mapping[str, str],
        cwd: Optional[Path],
        timeout: int,
    ) -> RunnerResult:
        try:
            completed = subprocess.run(
                list(args),
                cwd=str(cwd) if cwd else None,
                env=dict(env),
                capture_output=True,
                text=True,
                timeout=timeout,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise RemoteRunnerError("Remote Runner command timed out.") from exc
        except OSError as exc:
            raise RemoteRunnerUnavailable(
                f"Remote Runner could not be started: {exc}"
            ) from exc
        return RunnerResult(
            returncode=completed.returncode,
            stdout=completed.stdout,
            stderr=completed.stderr,
        )


def get_remote_runner_provider() -> RemoteRunnerProvider:
    """Factory used by Tutor to create the configured provider."""
    return RemoteRunnerProvider()


def _normalize_action(action: str) -> str:
    normalized = action.strip().lower().replace("-", "_")
    aliases = {
        "machines": "list_machines",
        "machine_list": "list_machines",
        "sessions": "list_sessions",
        "session_list": "list_sessions",
        "doctor": "machine_doctor",
        "exec": "session_exec",
        "execute": "session_exec",
        "background": "session_exec_background",
        "session_exec_background": "session_exec_background",
        "start": "session_exec_background",
        "session_command_list": "session_command_list",
        "command_list": "session_command_list",
        "session_command_show": "session_command_show",
        "show_command": "session_command_show",
        "session_command_result": "session_command_result",
        "result_command": "session_command_result",
        "session_command_wait": "session_command_wait",
        "wait_command": "session_command_wait",
        "session_command_stop": "session_command_stop",
        "stop_command": "session_command_stop",
    }
    return aliases.get(normalized, normalized)


def _require_value(value: str, field_name: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise RemoteRunnerPermissionError(f"{field_name} is required.")
    if "\x00" in cleaned:
        raise RemoteRunnerPermissionError(f"{field_name} contains an invalid byte.")
    return cleaned


SENSITIVE_KEY_PARTS = (
    "password",
    "token",
    "secret",
    "credential",
    "private_key",
    "key_path",
    "api_key",
    "host",
    "user",
)
LOCAL_PATH_KEYS = (
    "log_file_local",
    "log_dir_local",
    "local_path",
    "remote_state_dir",
    "remote_stdout_file",
    "remote_stderr_file",
    "remote_status_file",
    "remote_pid_file",
    "remote_exit_code_file",
    "remote_ended_at_file",
    "remote_worker_file",
)


def redact_sensitive(value: Any) -> Any:
    """Redact credentials and local machine details before LLM exposure."""
    if isinstance(value, dict):
        redacted = {}
        for key, item in value.items():
            key_text = str(key)
            lowered = key_text.lower()
            if any(part in lowered for part in SENSITIVE_KEY_PARTS):
                redacted[key_text] = "<redacted>"
            elif lowered in LOCAL_PATH_KEYS or lowered.endswith("_local"):
                redacted[key_text] = "<local_path_redacted>"
            else:
                redacted[key_text] = redact_sensitive(item)
        return redacted
    if isinstance(value, list):
        return [redact_sensitive(item) for item in value]
    if isinstance(value, str):
        return redact_text(value)
    return value


def redact_text(text: str) -> str:
    """Redact secret-looking inline text from stdout/stderr payloads."""
    redacted = re.sub(
        r"-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----",
        "<private_key_redacted>",
        text,
        flags=re.DOTALL,
    )
    redacted = re.sub(
        r"(?i)\b(password|token|secret|api[_-]?key|key_path)\s*[:=]\s*([^\s,;]+)",
        r"\1=<redacted>",
        redacted,
    )
    return redacted
