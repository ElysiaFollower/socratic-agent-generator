import json
from pathlib import Path
import sys

import httpx

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.benchmarks.single_lab_e2e import (  # noqa: E402
    BenchmarkConfig,
    SingleLabE2EBenchmark,
    build_arg_parser,
    config_from_args,
    load_turns,
    load_benchmark_dotenv,
    parse_sse_line,
)


class FakeStream:
    def __init__(self, status_code=200, lines=None, text=""):
        self.status_code = status_code
        self._lines = list(lines or [])
        self.text = text

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def iter_lines(self):
        yield from self._lines


class FakeClient:
    def __init__(self):
        self.posts = []
        self.gets = []
        self.streams = []

    def post(self, url, **kwargs):
        self.posts.append((url, kwargs))
        if url == "/api/auth/login":
            return httpx.Response(200, json={"token": "token"})
        if url == "/api/sessions/create":
            return httpx.Response(
                200,
                json={
                    "session_id": "sess-1",
                    "remote_binding": {"runner_session_id": "rr-1"},
                },
            )
        if url == "/api/sessions/sess-1/remote-command":
            action = kwargs.get("json", {}).get("action")
            if action == "session_exec_background":
                return httpx.Response(
                    200,
                    json={
                        "ok": True,
                        "action": action,
                        "result": {"command_id": "cmd-1", "status": "running"},
                    },
                )
            if action in {"session_command_wait", "session_command_result"}:
                return httpx.Response(
                    200,
                    json={
                        "ok": True,
                        "action": action,
                        "result": {"command_id": "cmd-1", "status": "exited"},
                    },
                )
            return httpx.Response(
                200,
                json={
                    "ok": True,
                    "action": action or "session_exec",
                    "result": {"stdout": "/home/seed\n", "exit_code": 0},
                },
            )
        raise AssertionError(f"unexpected POST {url}")

    def get(self, url, **kwargs):
        self.gets.append((url, kwargs))
        if url == "/api/profiles":
            return httpx.Response(
                200,
                json=[
                    {
                        "profile_id": "sniffing_spoofing",
                        "profile_name": "Sniffing Spoofing",
                        "topic_name": "Network Sniffing",
                        "lab_name": "Sniffing_Spoofing",
                    }
                ],
            )
        if url == "/api/settings/remote-machines":
            return httpx.Response(
                200,
                json=[
                    {
                        "machine_id": "machine-1",
                        "display_name": "seed-lab",
                        "runner_machine_name": "seed-lab",
                    }
                ],
            )
        if url == "/api/tutor/sess-1/state":
            return httpx.Response(
                200,
                json={"stepIndex": 9, "totalSteps": 9, "isFinished": True},
            )
        if url == "/api/sessions/sess-1/remote-audits":
            return httpx.Response(
                200,
                json=[
                    {
                        "audit_id": "audit-1",
                        "session_id": "sess-1",
                        "action": "session_exec",
                        "command": "pwd",
                    }
                ],
            )
        if url == "/api/sessions/sess-1/step-completions":
            return httpx.Response(200, json=[{"step_index": 0, "message_id": 1}])
        raise AssertionError(f"unexpected GET {url}")

    def stream(self, method, url, **kwargs):
        self.streams.append((method, url, kwargs))
        end_event = {
            "type": "END",
            "data": {
                "reply": "Finished with packet sniffing evidence.",
                "state": {"stepIndex": 9},
                "is_finished": True,
            },
        }
        return FakeStream(lines=[f"data: {json.dumps(end_event)}"])


def test_parse_sse_line_extracts_json_payload():
    assert parse_sse_line('data: {"type":"token","data":"hi"}') == {
        "type": "token",
        "data": "hi",
    }
    assert parse_sse_line("") is None
    assert parse_sse_line(": keepalive") is None


def test_single_lab_benchmark_success_path():
    client = FakeClient()
    config = BenchmarkConfig(
        base_url="http://testserver",
        username="demo",
        password="secret",
        remote_machine_query="seed-lab",
        turns=["start"],
    )
    result = SingleLabE2EBenchmark(config, client=client).run()

    assert result.ok is True
    assert result.stage == "passed"
    assert result.session_id == "sess-1"
    assert result.profile_id == "sniffing_spoofing"
    assert result.remote_machine_id == "machine-1"
    assert result.remote_audit_count == 1
    assert result.final_progress["isFinished"] is True
    assert client.posts[0][0] == "/api/auth/login"
    assert client.streams[0][1] == "/api/sessions/sess-1/messages/stream"


def test_single_lab_benchmark_can_cover_background_command_lifecycle():
    client = FakeClient()
    config = BenchmarkConfig(
        base_url="http://testserver",
        username="demo",
        password="secret",
        remote_machine_query="seed-lab",
        background_smoke_command="pwd",
        turns=["start"],
    )
    result = SingleLabE2EBenchmark(config, client=client).run()

    assert result.ok is True
    remote_actions = [
        kwargs.get("json", {}).get("action")
        for url, kwargs in client.posts
        if url == "/api/sessions/sess-1/remote-command"
    ]
    assert remote_actions == [
        "session_exec",
        "session_exec_background",
        "session_command_wait",
        "session_command_result",
    ]


def test_single_lab_benchmark_reports_profile_failure():
    class NoProfileClient(FakeClient):
        def get(self, url, **kwargs):
            if url == "/api/profiles":
                return httpx.Response(200, json=[])
            return super().get(url, **kwargs)

    config = BenchmarkConfig(
        base_url="http://testserver",
        username="demo",
        password="secret",
        turns=["start"],
    )
    result = SingleLabE2EBenchmark(config, client=NoProfileClient()).run()

    assert result.ok is False
    assert result.stage == "profile"
    assert "No profile matched" in result.error


def test_load_turns_accepts_list_or_object(tmp_path):
    list_path = tmp_path / "turns-list.json"
    list_path.write_text(json.dumps(["a", "b"]), encoding="utf-8")
    object_path = tmp_path / "turns-object.json"
    object_path.write_text(json.dumps({"turns": ["c"]}), encoding="utf-8")

    assert load_turns(list_path) == ["a", "b"]
    assert load_turns(object_path) == ["c"]


def test_benchmark_loads_dotenv_before_building_defaults(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    for name in [
        "SOCRATIC_BENCHMARK_USERNAME",
        "SOCRATIC_BENCHMARK_PASSWORD",
        "SOCRATIC_BENCHMARK_REMOTE_MACHINE",
    ]:
        monkeypatch.delenv(name, raising=False)
    (tmp_path / ".env").write_text(
        "\n".join(
            [
                "SOCRATIC_BENCHMARK_USERNAME=admin",
                "SOCRATIC_BENCHMARK_PASSWORD=secret",
                "SOCRATIC_BENCHMARK_REMOTE_MACHINE=SEED Lab on linux-01",
            ]
        ),
        encoding="utf-8",
    )

    load_benchmark_dotenv([])
    args = build_arg_parser().parse_args([])

    assert args.username == "admin"
    assert args.password == "secret"
    assert args.remote_machine == "SEED Lab on linux-01"


def test_config_requires_remote_machine_unless_explicitly_disabled(monkeypatch):
    for name in [
        "SOCRATIC_BENCHMARK_USERNAME",
        "SOCRATIC_BENCHMARK_PASSWORD",
        "SOCRATIC_BENCHMARK_REMOTE_MACHINE",
    ]:
        monkeypatch.delenv(name, raising=False)
    args = build_arg_parser().parse_args(["--password", "secret"])

    try:
        config_from_args(args)
    except SystemExit as exc:
        assert "Missing remote machine" in str(exc)
    else:
        raise AssertionError("config_from_args should require a remote machine")

    args = build_arg_parser().parse_args(
        ["--password", "secret", "--allow-no-remote-machine"]
    )
    config = config_from_args(args)
    assert config.username == "admin"
    assert config.remote_machine_query is None
