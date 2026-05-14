"""Run a backend-driven single-lab E2E benchmark against a live Socratic API.

The benchmark intentionally uses only public backend APIs. Secrets are supplied
through CLI arguments or environment variables and are never written to the
result payload.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable, Optional, Sequence

import httpx

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - dependency is in requirements.txt
    load_dotenv = None  # type: ignore[assignment]


DEFAULT_TURNS = [
    "I am ready to start. Please guide me through the lab step by step, and use the bound lab machine when checking the environment would help.",
    "I am not fully sure what packet sniffing should show. Can you break down the next task and check the lab environment for me?",
    "I think I should inspect interfaces and containers before running the sniffing task. Please help me verify the setup.",
    "Can you help me reason about BPF filters for ICMP and TCP traffic? I may make mistakes, so please ask smaller questions.",
    "Please help me collect enough command output and observations to support a short lab report, then continue to the next task.",
    "Let's continue. If a command would clarify the state, please run it and explain the result.",
    "I want to finish the remaining tasks. Please check any final environment evidence and summarize what I should understand.",
]
DEFAULT_DOTENV = ".env"


class BenchmarkFailure(RuntimeError):
    """A benchmark failure with an explicit stage label."""

    def __init__(self, stage: str, message: str, detail: Optional[dict[str, Any]] = None):
        super().__init__(message)
        self.stage = stage
        self.message = message
        self.detail = detail or {}


@dataclass
class BenchmarkConfig:
    base_url: str
    username: str
    password: str
    profile_query: str = "Sniffing_Spoofing"
    session_name: str = "benchmark-sniffing-spoofing"
    output_language: str = "English"
    remote_machine_query: Optional[str] = None
    ensure_existing_remote_machine: bool = False
    labsetup_file: Optional[Path] = None
    remote_labsetup_path: Optional[str] = None
    remote_smoke_command: str = "pwd"
    background_smoke_command: Optional[str] = None
    background_wait_seconds: int = 5
    turns: list[str] = field(default_factory=lambda: list(DEFAULT_TURNS))
    request_timeout_seconds: float = 60.0
    stream_timeout_seconds: float = 180.0
    require_finished: bool = True
    min_remote_audits: Optional[int] = None
    require_reply_contains: list[str] = field(default_factory=list)


@dataclass
class BenchmarkResult:
    ok: bool
    stage: str
    session_id: Optional[str] = None
    profile_id: Optional[str] = None
    profile_name: Optional[str] = None
    remote_machine_id: Optional[str] = None
    turns_sent: int = 0
    final_progress: dict[str, Any] = field(default_factory=dict)
    remote_audit_count: int = 0
    step_completion_count: int = 0
    reply_excerpt: str = ""
    error: str = ""
    detail: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "stage": self.stage,
            "session_id": self.session_id,
            "profile_id": self.profile_id,
            "profile_name": self.profile_name,
            "remote_machine_id": self.remote_machine_id,
            "turns_sent": self.turns_sent,
            "final_progress": self.final_progress,
            "remote_audit_count": self.remote_audit_count,
            "step_completion_count": self.step_completion_count,
            "reply_excerpt": self.reply_excerpt,
            "error": self.error,
            "detail": self.detail,
        }


class SingleLabE2EBenchmark:
    """Small API client that drives one representative lab session."""

    def __init__(
        self,
        config: BenchmarkConfig,
        client: Optional[httpx.Client] = None,
    ) -> None:
        self.config = config
        self.client = client or httpx.Client(
            base_url=config.base_url.rstrip("/"),
            timeout=config.request_timeout_seconds,
        )
        self._owns_client = client is None
        self.token = ""

    def close(self) -> None:
        if self._owns_client:
            self.client.close()

    def run(self) -> BenchmarkResult:
        result = BenchmarkResult(ok=False, stage="init")
        try:
            self._login()
            profile = self._select_profile()
            result.profile_id = profile.get("profile_id")
            result.profile_name = profile.get("profile_name")

            machine_id = self._resolve_remote_machine_id()
            result.remote_machine_id = machine_id

            session_payload = self._create_session(profile["profile_id"], machine_id)
            session_id = session_payload["session_id"]
            result.session_id = session_id

            if self.config.labsetup_file:
                self._upload_labsetup(session_id)

            if machine_id:
                self._remote_smoke(session_id)

            reply_text = self._drive_conversation(session_id, result)
            final_progress = self._get_state(session_id)
            audits = self._get_remote_audits(session_id)
            completions = self._get_step_completions(session_id)

            result.final_progress = final_progress
            result.remote_audit_count = len(audits)
            result.step_completion_count = len(completions)
            result.reply_excerpt = _excerpt(reply_text)
            self._validate_final(result, reply_text)
            result.ok = True
            result.stage = "passed"
            return result
        except BenchmarkFailure as exc:
            result.stage = exc.stage
            result.error = exc.message
            result.detail = exc.detail
            return result

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    def _login(self) -> None:
        response = self.client.post(
            "/api/auth/login",
            json={"username": self.config.username, "password": self.config.password},
        )
        payload = _json_or_fail(response, "login")
        token = payload.get("token")
        if not token:
            raise BenchmarkFailure("login", "Login response did not include a token.")
        self.token = token

    def _select_profile(self) -> dict[str, Any]:
        response = self.client.get("/api/profiles", headers=self._headers())
        profiles = _json_or_fail(response, "profile")
        query = self.config.profile_query.lower()
        for profile in profiles:
            haystack = " ".join(
                str(profile.get(key) or "")
                for key in ("profile_id", "profile_name", "topic_name", "lab_name")
            ).lower()
            if query in haystack:
                return profile
        raise BenchmarkFailure(
            "profile",
            f"No profile matched query '{self.config.profile_query}'.",
            {"available": [_profile_label(item) for item in profiles[:20]]},
        )

    def _resolve_remote_machine_id(self) -> Optional[str]:
        query = self.config.remote_machine_query
        if not query:
            return None
        response = self.client.get("/api/settings/remote-machines", headers=self._headers())
        machines = _json_or_fail(response, "remote_machine")
        matched = _find_machine(machines, query)
        if matched:
            return matched["machine_id"]
        if not self.config.ensure_existing_remote_machine:
            raise BenchmarkFailure(
                "remote_machine",
                f"No remote machine matched query '{query}'.",
                {"available": [_machine_label(item) for item in machines[:20]]},
            )
        response = self.client.post(
            "/api/settings/remote-machines",
            headers=self._headers(),
            json={
                "display_name": query,
                "runner_machine_name": query,
                "auth_type": "existing",
                "default_cwd": "/home/seed",
                "startup_commands": [],
            },
        )
        created = _json_or_fail(response, "remote_machine")
        return created["machine_id"]

    def _create_session(self, profile_id: str, machine_id: Optional[str]) -> dict[str, Any]:
        response = self.client.post(
            "/api/sessions/create",
            headers=self._headers(),
            json={
                "profile_id": profile_id,
                "session_name": self.config.session_name,
                "output_language": self.config.output_language,
                "remote_machine_id": machine_id,
            },
        )
        payload = _json_or_fail(response, "session")
        if not payload.get("session_id"):
            raise BenchmarkFailure("session", "Session create response had no session_id.")
        return payload

    def _upload_labsetup(self, session_id: str) -> None:
        path = self.config.labsetup_file
        if not path or not path.exists():
            raise BenchmarkFailure(
                "remote_setup",
                f"LabSetup file does not exist: {path}",
            )
        with path.open("rb") as handle:
            response = self.client.post(
                f"/api/sessions/{session_id}/files",
                headers=self._headers(),
                files={"file": (path.name, handle, "application/octet-stream")},
            )
        uploaded = _json_or_fail(response, "remote_setup")
        remote_path = self.config.remote_labsetup_path
        if remote_path:
            response = self.client.post(
                f"/api/sessions/{session_id}/files/{uploaded['filename']}/remote-put",
                headers=self._headers(),
                json={"remote_path": remote_path},
            )
            _json_or_fail(response, "remote_setup")

    def _remote_smoke(self, session_id: str) -> None:
        response = self.client.post(
            f"/api/sessions/{session_id}/remote-command",
            headers=self._headers(),
            json={
                "action": "session_exec",
                "command": self.config.remote_smoke_command,
                "reason": "single-lab-e2e remote smoke",
            },
        )
        payload = _json_or_fail(response, "remote_setup")
        if not payload.get("ok"):
            raise BenchmarkFailure(
                "remote_setup",
                "Remote command smoke failed.",
                {"payload": _safe_detail(payload)},
            )
        if self.config.background_smoke_command:
            self._remote_background_smoke(session_id)

    def _remote_background_smoke(self, session_id: str) -> None:
        start = self.client.post(
            f"/api/sessions/{session_id}/remote-command",
            headers=self._headers(),
            json={
                "action": "session_exec_background",
                "command": self.config.background_smoke_command,
                "reason": "single-lab-e2e background remote smoke",
            },
        )
        start_payload = _json_or_fail(start, "remote_setup")
        command_id = str((start_payload.get("result") or {}).get("command_id") or "")
        if not start_payload.get("ok") or not command_id:
            raise BenchmarkFailure(
                "remote_setup",
                "Background command smoke did not return command_id.",
                {"payload": _safe_detail(start_payload)},
            )
        wait = self.client.post(
            f"/api/sessions/{session_id}/remote-command",
            headers=self._headers(),
            json={
                "action": "session_command_wait",
                "command_id": command_id,
                "wait_timeout_seconds": self.config.background_wait_seconds,
                "reason": "single-lab-e2e background wait",
            },
        )
        _json_or_fail(wait, "remote_setup")
        result = self.client.post(
            f"/api/sessions/{session_id}/remote-command",
            headers=self._headers(),
            json={
                "action": "session_command_result",
                "command_id": command_id,
                "reason": "single-lab-e2e background result",
            },
        )
        result_payload = _json_or_fail(result, "remote_setup")
        if not result_payload.get("ok"):
            raise BenchmarkFailure(
                "remote_setup",
                "Background command result failed.",
                {"payload": _safe_detail(result_payload)},
            )

    def _drive_conversation(self, session_id: str, result: BenchmarkResult) -> str:
        last_reply = ""
        for turn in self.config.turns:
            events = self._send_stream_message(session_id, turn)
            result.turns_sent += 1
            end_payload = _last_end_payload(events)
            if not end_payload:
                raise BenchmarkFailure(
                    "conversation",
                    "Stream ended without an END event.",
                    {"events": events[-5:]},
                )
            last_reply = str(end_payload.get("reply") or "")
            state = self._get_state(session_id)
            result.final_progress = state
            if state.get("isFinished"):
                break
        return last_reply

    def _send_stream_message(self, session_id: str, message: str) -> list[dict[str, Any]]:
        encoded = base64.b64encode(message.encode("utf-8")).decode("ascii")
        deadline = time.monotonic() + self.config.stream_timeout_seconds
        events: list[dict[str, Any]] = []
        with self.client.stream(
            "POST",
            f"/api/sessions/{session_id}/messages/stream",
            headers=self._headers(),
            json={"message": encoded},
        ) as response:
            if response.status_code >= 400:
                raise BenchmarkFailure(
                    "conversation",
                    f"Stream request failed with HTTP {response.status_code}.",
                    {"body": response.text[:500]},
                )
            for line in response.iter_lines():
                if time.monotonic() > deadline:
                    raise BenchmarkFailure("conversation", "Stream timed out.")
                parsed = parse_sse_line(line)
                if parsed:
                    events.append(parsed)
                    if parsed.get("type") == "error":
                        raise BenchmarkFailure(
                            "conversation",
                            f"Stream returned error: {parsed.get('data')}",
                        )
        return events

    def _get_state(self, session_id: str) -> dict[str, Any]:
        response = self.client.get(
            f"/api/tutor/{session_id}/state",
            headers=self._headers(),
        )
        return _json_or_fail(response, "final_validation")

    def _get_remote_audits(self, session_id: str) -> list[dict[str, Any]]:
        response = self.client.get(
            f"/api/sessions/{session_id}/remote-audits",
            headers=self._headers(),
        )
        return _json_or_fail(response, "final_validation")

    def _get_step_completions(self, session_id: str) -> list[dict[str, Any]]:
        response = self.client.get(
            f"/api/sessions/{session_id}/step-completions",
            headers=self._headers(),
        )
        return _json_or_fail(response, "final_validation")

    def _validate_final(self, result: BenchmarkResult, reply_text: str) -> None:
        if self.config.require_finished and not result.final_progress.get("isFinished"):
            raise BenchmarkFailure(
                "final_validation",
                "Session did not finish within the scripted turns.",
                {"progress": result.final_progress, "turns_sent": result.turns_sent},
            )
        min_audits = self.config.min_remote_audits
        if min_audits is None:
            min_audits = 1 if result.remote_machine_id else 0
        if result.remote_audit_count < min_audits:
            raise BenchmarkFailure(
                "final_validation",
                f"Expected at least {min_audits} remote audit entries.",
                {"remote_audit_count": result.remote_audit_count},
            )
        missing = [
            phrase
            for phrase in self.config.require_reply_contains
            if phrase.lower() not in reply_text.lower()
        ]
        if missing:
            raise BenchmarkFailure(
                "final_validation",
                "Final reply did not contain required evidence phrases.",
                {"missing_phrases": missing},
            )


def parse_sse_line(line: str | bytes) -> Optional[dict[str, Any]]:
    if isinstance(line, bytes):
        line = line.decode("utf-8")
    line = line.strip()
    if not line or not line.startswith("data:"):
        return None
    payload = line[5:].strip()
    if not payload:
        return None
    return json.loads(payload)


def load_turns(path: Optional[Path]) -> list[str]:
    if path is None:
        return list(DEFAULT_TURNS)
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, list) and all(isinstance(item, str) for item in payload):
        return payload
    if isinstance(payload, dict) and isinstance(payload.get("turns"), list):
        turns = payload["turns"]
        if all(isinstance(item, str) for item in turns):
            return turns
    raise ValueError("turns file must be a JSON string list or an object with turns")


def _last_end_payload(events: Sequence[dict[str, Any]]) -> Optional[dict[str, Any]]:
    for event in reversed(events):
        if event.get("type") == "END" and isinstance(event.get("data"), dict):
            return event["data"]
    return None


def _json_or_fail(response: httpx.Response, stage: str) -> Any:
    if response.status_code >= 400:
        raise BenchmarkFailure(
            stage,
            f"HTTP {response.status_code}: {response.text[:500]}",
        )
    try:
        return response.json()
    except ValueError as exc:
        raise BenchmarkFailure(stage, "Response was not valid JSON.") from exc


def _safe_detail(payload: dict[str, Any]) -> dict[str, Any]:
    return json.loads(json.dumps(payload, ensure_ascii=False)) if payload else {}


def _find_machine(machines: Iterable[dict[str, Any]], query: str) -> Optional[dict[str, Any]]:
    query_lower = query.lower()
    for machine in machines:
        haystack = " ".join(
            str(machine.get(key) or "")
            for key in ("machine_id", "display_name", "runner_machine_name")
        ).lower()
        if query_lower in haystack:
            return machine
    return None


def _profile_label(profile: dict[str, Any]) -> str:
    return " / ".join(
        str(profile.get(key) or "")
        for key in ("profile_id", "profile_name", "topic_name")
        if profile.get(key)
    )


def _machine_label(machine: dict[str, Any]) -> str:
    return " / ".join(
        str(machine.get(key) or "")
        for key in ("machine_id", "display_name", "runner_machine_name")
        if machine.get(key)
    )


def _excerpt(text: str, limit: int = 600) -> str:
    cleaned = " ".join(text.split())
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[:limit].rstrip() + "...[truncated]"


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dotenv", default=os.getenv("SOCRATIC_BENCHMARK_DOTENV", DEFAULT_DOTENV))
    parser.add_argument("--base-url", default=os.getenv("SOCRATIC_BENCHMARK_BASE_URL", "http://localhost:8000"))
    parser.add_argument("--username", default=os.getenv("SOCRATIC_BENCHMARK_USERNAME", "admin"))
    parser.add_argument("--password", default=os.getenv("SOCRATIC_BENCHMARK_PASSWORD"))
    parser.add_argument("--profile-query", default=os.getenv("SOCRATIC_BENCHMARK_PROFILE", "Sniffing_Spoofing"))
    parser.add_argument("--session-name", default=os.getenv("SOCRATIC_BENCHMARK_SESSION_NAME", "benchmark-sniffing-spoofing"))
    parser.add_argument("--output-language", default=os.getenv("SOCRATIC_BENCHMARK_OUTPUT_LANGUAGE", "English"))
    parser.add_argument("--remote-machine", default=os.getenv("SOCRATIC_BENCHMARK_REMOTE_MACHINE"))
    parser.add_argument(
        "--ensure-existing-remote-machine",
        action="store_true",
        default=_env_bool(os.getenv("SOCRATIC_BENCHMARK_ENSURE_EXISTING_REMOTE_MACHINE"), False),
    )
    parser.add_argument(
        "--allow-no-remote-machine",
        action="store_true",
        default=_env_bool(os.getenv("SOCRATIC_BENCHMARK_ALLOW_NO_REMOTE_MACHINE"), False),
    )
    parser.add_argument("--labsetup-file", type=Path, default=_optional_path(os.getenv("SOCRATIC_BENCHMARK_LABSETUP_FILE")))
    parser.add_argument("--remote-labsetup-path", default=os.getenv("SOCRATIC_BENCHMARK_REMOTE_LABSETUP_PATH"))
    parser.add_argument("--remote-smoke-command", default=os.getenv("SOCRATIC_BENCHMARK_REMOTE_SMOKE_COMMAND", "pwd"))
    parser.add_argument("--background-smoke-command", default=os.getenv("SOCRATIC_BENCHMARK_BACKGROUND_SMOKE_COMMAND"))
    parser.add_argument("--background-wait-seconds", type=int, default=int(os.getenv("SOCRATIC_BENCHMARK_BACKGROUND_WAIT_SECONDS", "5")))
    parser.add_argument("--turns-file", type=Path, default=_optional_path(os.getenv("SOCRATIC_BENCHMARK_TURNS_FILE")))
    parser.add_argument("--stream-timeout", type=float, default=float(os.getenv("SOCRATIC_BENCHMARK_STREAM_TIMEOUT", "180")))
    parser.add_argument("--request-timeout", type=float, default=float(os.getenv("SOCRATIC_BENCHMARK_REQUEST_TIMEOUT", "60")))
    parser.add_argument(
        "--allow-unfinished",
        action="store_true",
        default=_env_bool(os.getenv("SOCRATIC_BENCHMARK_ALLOW_UNFINISHED"), False),
    )
    parser.add_argument("--min-remote-audits", type=int, default=_optional_int(os.getenv("SOCRATIC_BENCHMARK_MIN_REMOTE_AUDITS")))
    parser.add_argument("--require-reply-contains", action="append", default=[])
    return parser


def config_from_args(args: argparse.Namespace) -> BenchmarkConfig:
    if not args.username:
        raise SystemExit("Missing username: set SOCRATIC_BENCHMARK_USERNAME or pass --username.")
    if not args.password:
        raise SystemExit("Missing password: set SOCRATIC_BENCHMARK_PASSWORD or pass --password.")
    if not args.remote_machine and not args.allow_no_remote_machine:
        raise SystemExit(
            "Missing remote machine: set SOCRATIC_BENCHMARK_REMOTE_MACHINE, "
            "pass --remote-machine, or pass --allow-no-remote-machine for a non-remote smoke."
        )
    return BenchmarkConfig(
        base_url=args.base_url,
        username=args.username,
        password=args.password,
        profile_query=args.profile_query,
        session_name=args.session_name,
        output_language=args.output_language,
        remote_machine_query=args.remote_machine,
        ensure_existing_remote_machine=args.ensure_existing_remote_machine,
        labsetup_file=args.labsetup_file,
        remote_labsetup_path=args.remote_labsetup_path,
        remote_smoke_command=args.remote_smoke_command,
        background_smoke_command=args.background_smoke_command,
        background_wait_seconds=args.background_wait_seconds,
        turns=load_turns(args.turns_file),
        request_timeout_seconds=args.request_timeout,
        stream_timeout_seconds=args.stream_timeout,
        require_finished=not args.allow_unfinished,
        min_remote_audits=args.min_remote_audits,
        require_reply_contains=args.require_reply_contains,
    )


def _optional_path(value: Optional[str]) -> Optional[Path]:
    return Path(value).expanduser() if value else None


def _optional_int(value: Optional[str]) -> Optional[int]:
    return int(value) if value else None


def _env_bool(value: Optional[str], default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _extract_dotenv_path(argv: Optional[Sequence[str]]) -> Optional[Path]:
    values = list(argv or [])
    for index, value in enumerate(values):
        if value == "--dotenv" and index + 1 < len(values):
            return Path(values[index + 1]).expanduser()
        if value.startswith("--dotenv="):
            return Path(value.split("=", 1)[1]).expanduser()
    env_value = os.getenv("SOCRATIC_BENCHMARK_DOTENV")
    if env_value:
        return Path(env_value).expanduser()
    return Path(DEFAULT_DOTENV)


def load_benchmark_dotenv(argv: Optional[Sequence[str]] = None) -> Optional[Path]:
    dotenv_path = _extract_dotenv_path(argv)
    if not dotenv_path or not dotenv_path.exists() or load_dotenv is None:
        return dotenv_path
    load_dotenv(dotenv_path, override=False)
    return dotenv_path


def main(argv: Optional[Sequence[str]] = None) -> int:
    load_benchmark_dotenv(argv)
    parser = build_arg_parser()
    args = parser.parse_args(argv)
    config = config_from_args(args)
    runner = SingleLabE2EBenchmark(config)
    try:
        result = runner.run()
    finally:
        runner.close()
    print(json.dumps(result.to_dict(), ensure_ascii=False, indent=2, sort_keys=True))
    return 0 if result.ok else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
