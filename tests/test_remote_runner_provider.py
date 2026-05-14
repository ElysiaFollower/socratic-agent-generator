import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from utils.remote_runner_provider import (
    RemoteRunnerProvider,
    RemoteRunnerProviderConfig,
    RunnerResult,
)

try:
    from utils.remote_tool_skill import (
        SessionBoundRemoteEnvironmentSkill,
        get_remote_environment_skill,
    )
    from utils.tutor_core import _collect_tools_from_skills

    LANGCHAIN_TOOLING_AVAILABLE = True
except ModuleNotFoundError as exc:
    if exc.name != "langchain_core":
        raise
    get_remote_environment_skill = None
    SessionBoundRemoteEnvironmentSkill = None
    _collect_tools_from_skills = None
    LANGCHAIN_TOOLING_AVAILABLE = False


class FakeRunner:
    def __init__(self, responses=None):
        self.responses = list(responses or [])
        self.calls = []

    def __call__(self, args, env, cwd, timeout):
        self.calls.append(
            {
                "args": list(args),
                "env": dict(env),
                "cwd": cwd,
                "timeout": timeout,
            }
        )
        if not self.responses:
            return RunnerResult(returncode=0, stdout="{}")
        return self.responses.pop(0)


class RemoteRunnerProviderTest(unittest.TestCase):
    def test_disabled_observation_returns_safe_payload_without_runner_call(self):
        runner = FakeRunner()
        provider = RemoteRunnerProvider(
            RemoteRunnerProviderConfig(enabled=False),
            command_runner=runner,
        )

        result = json.loads(provider.observe(action="list_machines"))

        self.assertFalse(result["ok"])
        self.assertIn("disabled", result["error"])
        self.assertEqual([], runner.calls)

    def test_list_machines_filters_allowed_and_redacts_sensitive_fields(self):
        with tempfile.TemporaryDirectory() as repo_dir, tempfile.TemporaryDirectory() as state_dir:
            runner = FakeRunner(
                [
                    RunnerResult(
                        returncode=0,
                        stdout=json.dumps(
                            {
                                "machines": [
                                    {
                                        "machine_id": "lab1",
                                        "host": "192.0.2.10",
                                        "user": "student",
                                        "auth_type": "key",
                                        "key_path": "/home/student/.ssh/id_rsa",
                                    },
                                    {
                                        "machine_id": "lab2",
                                        "host": "192.0.2.11",
                                        "user": "student",
                                    },
                                ],
                                "summary": {"machine_count": 2},
                            }
                        ),
                    )
                ]
            )
            provider = RemoteRunnerProvider(
                RemoteRunnerProviderConfig(
                    enabled=True,
                    repo_path=repo_dir,
                    state_dir=state_dir,
                    allowed_machine_ids=("lab1",),
                ),
                command_runner=runner,
            )

            payload = provider.run_action(action="list_machines")

            machines = payload["result"]["machines"]
            self.assertEqual(1, len(machines))
            self.assertEqual("lab1", machines[0]["machine_id"])
            self.assertEqual("<redacted>", machines[0]["host"])
            self.assertEqual("<redacted>", machines[0]["user"])
            self.assertEqual("<redacted>", machines[0]["key_path"])
            self.assertEqual(["machine", "list", "--json"], runner.calls[0]["args"][3:])
            self.assertEqual(state_dir, runner.calls[0]["env"]["REMOTE_RUNNER_STATE_DIR"])
            self.assertIn(repo_dir, runner.calls[0]["env"]["PYTHONPATH"])
            self.assertEqual(Path(repo_dir).resolve(), runner.calls[0]["cwd"])

    def test_session_exec_rejects_command_not_allowed(self):
        runner = FakeRunner()
        provider = RemoteRunnerProvider(
            RemoteRunnerProviderConfig(
                enabled=True,
                repo_path=None,
                allowed_commands=("pwd",),
            ),
            command_runner=runner,
        )

        result = json.loads(
            provider.observe(
                action="session_exec",
                session_id="sess1",
                command="rm -rf /",
            )
        )

        self.assertFalse(result["ok"])
        self.assertIn("not allowed", result["error"])
        self.assertEqual([], runner.calls)

    def test_session_exec_denies_all_when_command_policy_is_empty(self):
        runner = FakeRunner()
        provider = RemoteRunnerProvider(
            RemoteRunnerProviderConfig(
                enabled=True,
                repo_path=None,
                allowed_commands=(),
                allowed_command_prefixes=(),
            ),
            command_runner=runner,
        )

        result = json.loads(
            provider.observe(
                action="session_exec",
                session_id="sess1",
                command="pwd",
            )
        )

        self.assertFalse(result["ok"])
        self.assertIn("allowlist", result["error"])
        self.assertEqual([], runner.calls)

    def test_session_exec_allows_configured_prefix_command(self):
        runner = FakeRunner(
            [
                RunnerResult(
                    returncode=0,
                    stdout=json.dumps({"session_id": "sess1", "machine_id": "lab1"}),
                ),
                RunnerResult(
                    returncode=0,
                    stdout=json.dumps(
                        {
                            "session_id": "sess1",
                            "machine_id": "lab1",
                            "command": "docker ps --format '{{.Names}}'",
                            "exit_code": 0,
                            "stdout": "seed-host-a\n",
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
                allowed_machine_ids=("lab1",),
                allowed_commands=("pwd",),
                allowed_command_prefixes=("docker ps",),
            ),
            command_runner=runner,
        )

        payload = provider.run_action(
            action="session_exec",
            machine_id="lab1",
            session_id="sess1",
            command="docker ps --format '{{.Names}}'",
        )

        self.assertTrue(payload["ok"])
        self.assertIn("seed-host-a", payload["result"]["stdout"])

    def test_session_exec_checks_allowed_machine_and_redacts_output(self):
        runner = FakeRunner(
            [
                RunnerResult(
                    returncode=0,
                    stdout=json.dumps({"session_id": "sess1", "machine_id": "lab1"}),
                ),
                RunnerResult(
                    returncode=0,
                    stdout=json.dumps(
                        {
                            "session_id": "sess1",
                            "machine_id": "lab1",
                            "command": "pwd",
                            "exit_code": 0,
                            "stdout": "cwd=/home/student password=oops",
                            "stderr": "",
                            "log_file_local": "/tmp/remote-runner/logs/cmd.log",
                        }
                    ),
                ),
            ]
        )
        provider = RemoteRunnerProvider(
            RemoteRunnerProviderConfig(
                enabled=True,
                repo_path=None,
                allowed_machine_ids=("lab1",),
                allowed_commands=("pwd",),
                timeout_seconds=7,
            ),
            command_runner=runner,
        )

        payload = provider.run_action(
            action="session_exec",
            machine_id="lab1",
            session_id="sess1",
            command="pwd",
        )

        self.assertEqual(
            ["session", "show", "--session", "sess1", "--json"],
            runner.calls[0]["args"][3:],
        )
        self.assertEqual(
            [
                "session",
                "exec",
                "--session",
                "sess1",
                "--cmd",
                "pwd",
                "--timeout",
                "7",
                "--mode",
                "wait",
                "--json",
            ],
            runner.calls[1]["args"][3:],
        )
        self.assertEqual("password=<redacted>", payload["result"]["stdout"].split()[-1])

    def test_read_session_transcript_uses_persistent_shell_read(self):
        runner = FakeRunner(
            [
                RunnerResult(
                    returncode=0,
                    stdout=json.dumps({"session_id": "sess1", "machine_id": "lab1"}),
                ),
                RunnerResult(
                    returncode=0,
                    stdout=json.dumps(
                        {
                            "session_id": "sess1",
                            "transcript": "$ cd /tmp\n$ pwd\n/tmp\n",
                            "cursor": 24,
                            "since": 0,
                            "transcript_truncated": False,
                        }
                    ),
                ),
            ]
        )
        provider = RemoteRunnerProvider(
            RemoteRunnerProviderConfig(
                enabled=True,
                repo_path=None,
                allowed_machine_ids=("lab1",),
            ),
            command_runner=runner,
        )

        payload = provider.read_session_transcript(
            machine_id="lab1",
            session_id="sess1",
            since=4,
            max_chars=200,
        )

        self.assertIn("$ pwd", payload["transcript"])
        self.assertEqual(
            ["session", "read", "--session", "sess1", "--since", "4", "--max-chars", "200", "--json"],
            runner.calls[1]["args"][3:],
        )

    def test_send_session_input_uses_raw_shell_send_without_command_policy(self):
        runner = FakeRunner(
            [
                RunnerResult(
                    returncode=0,
                    stdout=json.dumps({"session_id": "sess1", "machine_id": "lab1"}),
                ),
                RunnerResult(
                    returncode=0,
                    stdout=json.dumps({"session_id": "sess1", "input_sent": True}),
                ),
            ]
        )
        provider = RemoteRunnerProvider(
            RemoteRunnerProviderConfig(
                enabled=True,
                repo_path=None,
                allowed_machine_ids=("lab1",),
                allowed_commands=("pwd",),
            ),
            command_runner=runner,
        )

        payload = provider.send_session_input(
            machine_id="lab1",
            session_id="sess1",
            input_text="python",
            enter=False,
        )

        self.assertTrue(payload["input_sent"])
        self.assertEqual(
            ["session", "send", "--session", "sess1", "--input", "python", "--no-enter", "--json"],
            runner.calls[1]["args"][3:],
        )

    def test_session_exec_background_returns_command_metadata(self):
        runner = FakeRunner(
            [
                RunnerResult(
                    returncode=0,
                    stdout=json.dumps({"session_id": "sess1", "machine_id": "lab1"}),
                ),
                RunnerResult(
                    returncode=0,
                    stdout=json.dumps(
                        {
                            "session_id": "sess1",
                            "command_id": "cmd_1",
                            "machine_id": "lab1",
                            "cwd": "/home/seed",
                            "command": "python server.py",
                            "status": "running",
                            "remote_state_dir": "/home/seed/.remote-runner/commands/cmd_1",
                            "remote_pid": 12345,
                        }
                    ),
                ),
            ]
        )
        provider = RemoteRunnerProvider(
            RemoteRunnerProviderConfig(
                enabled=True,
                repo_path=None,
                allowed_machine_ids=("lab1",),
                allowed_commands=("python server.py",),
                allowed_command_prefixes=("python ",),
            ),
            command_runner=runner,
        )

        payload = provider.run_action(
            action="session_exec_background",
            machine_id="lab1",
            session_id="sess1",
            command="python server.py",
            cwd="/home/seed",
        )

        self.assertTrue(payload["ok"])
        self.assertEqual("cmd_1", payload["result"]["command_id"])
        self.assertEqual(
            [
                "session",
                "exec",
                "--session",
                "sess1",
                "--cmd",
                "python server.py",
                "--timeout",
                "20",
                "--mode",
                "background",
                "--cwd",
                "/home/seed",
                "--json",
            ],
            runner.calls[1]["args"][3:],
        )
        self.assertEqual(
            "<local_path_redacted>",
            payload["result"]["remote_state_dir"],
        )

    def test_session_command_wait_uses_explicit_timeout(self):
        runner = FakeRunner(
            [
                RunnerResult(
                    returncode=0,
                    stdout=json.dumps({"session_id": "sess1", "machine_id": "lab1"}),
                ),
                RunnerResult(
                    returncode=0,
                    stdout=json.dumps(
                        {
                            "session_id": "sess1",
                            "command_id": "cmd_1",
                            "machine_id": "lab1",
                            "cwd": "/home/seed",
                            "command": "python server.py",
                            "status": "running",
                            "wait_timed_out": True,
                            "stdout": "",
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
                allowed_machine_ids=("lab1",),
            ),
            command_runner=runner,
        )

        payload = provider.run_action(
            action="session_command_wait",
            machine_id="lab1",
            session_id="sess1",
            command_id="cmd_1",
            wait_timeout_seconds=3,
        )

        self.assertTrue(payload["ok"])
        self.assertTrue(payload["result"]["wait_timed_out"])
        self.assertEqual(
            [
                "session",
                "command",
                "wait",
                "--session",
                "sess1",
                "--command-id",
                "cmd_1",
                "--timeout",
                "3",
                "--stdout-bytes",
                "8192",
                "--stderr-bytes",
                "8192",
                "--json",
            ],
            runner.calls[1]["args"][3:],
        )

    def test_session_command_result_and_stop_use_command_id(self):
        runner = FakeRunner(
            [
                RunnerResult(
                    returncode=0,
                    stdout=json.dumps({"session_id": "sess1", "machine_id": "lab1"}),
                ),
                RunnerResult(
                    returncode=0,
                    stdout=json.dumps(
                        {
                            "session_id": "sess1",
                            "command_id": "cmd_1",
                            "machine_id": "lab1",
                            "cwd": "/home/seed",
                            "command": "python server.py",
                            "status": "running",
                            "stdout": "ready\n",
                            "stderr": "",
                        }
                    ),
                ),
                RunnerResult(
                    returncode=0,
                    stdout=json.dumps(
                        {
                            "machine_id": "lab1",
                        }
                    ),
                ),
                RunnerResult(
                    returncode=0,
                    stdout=json.dumps(
                        {
                            "session_id": "sess1",
                            "command_id": "cmd_1",
                            "machine_id": "lab1",
                            "cwd": "/home/seed",
                            "command": "python server.py",
                            "status": "stopped",
                            "stop_requested": True,
                        }
                    ),
                ),
            ]
        )
        provider = RemoteRunnerProvider(
            RemoteRunnerProviderConfig(
                enabled=True,
                repo_path=None,
                allowed_machine_ids=("lab1",),
            ),
            command_runner=runner,
        )

        result_payload = provider.run_action(
            action="session_command_result",
            machine_id="lab1",
            session_id="sess1",
            command_id="cmd_1",
        )
        stop_payload = provider.run_action(
            action="session_command_stop",
            machine_id="lab1",
            session_id="sess1",
            command_id="cmd_1",
        )

        self.assertEqual("ready\n", result_payload["result"]["stdout"])
        self.assertTrue(stop_payload["result"]["stop_requested"])
        self.assertEqual(
            ["session", "command", "result", "--session", "sess1", "--command-id", "cmd_1", "--stdout-bytes", "8192", "--stderr-bytes", "8192", "--json"],
            runner.calls[1]["args"][3:],
        )
        self.assertEqual(
            ["session", "command", "stop", "--session", "sess1", "--command-id", "cmd_1", "--json"],
            runner.calls[3]["args"][3:],
        )

    @unittest.skipUnless(LANGCHAIN_TOOLING_AVAILABLE, "langchain_core is required")
    def test_session_bound_skill_exposes_explicit_tools_and_routes_actions(self):
        class FakeProvider:
            def __init__(self):
                self.calls = []

            def run_action(self, **kwargs):
                self.calls.append(kwargs)
                return {
                    "ok": True,
                    "action": kwargs["action"],
                    "result": {
                        "command_id": kwargs.get("command_id") or "cmd_1",
                        "wait_timed_out": kwargs.get("wait_timeout_seconds", 0) == 1,
                    },
                }

            def _format_observation(self, payload):
                return json.dumps(payload)

        provider = FakeProvider()
        skill = SessionBoundRemoteEnvironmentSkill(
            provider,
            owner_id="user1",
            session_id="session1",
            binding_id="binding1",
            runner_machine_name="seed-lab",
            runner_session_id="rr-session-1",
        )

        tools = {tool.name: tool for tool in skill.get_tools()}
        expected = {
            "check_remote_connection",
            "run_remote_command",
            "start_remote_command",
            "list_remote_commands",
            "get_remote_command_result",
            "wait_remote_command",
            "stop_remote_command",
        }
        self.assertTrue(expected.issubset(tools.keys()))

        tools["wait_remote_command"].invoke(
            {"command_id": "cmd_1", "timeout_seconds": 1, "reason": "poll"}
        )
        self.assertEqual("session_command_wait", provider.calls[-1]["action"])
        self.assertEqual("rr-session-1", provider.calls[-1]["session_id"])
        self.assertEqual(1, provider.calls[-1]["wait_timeout_seconds"])

        tools["start_remote_command"].invoke(
            {"command": "python server.py", "cwd": "/home/seed", "reason": "start"}
        )
        self.assertEqual("session_exec_background", provider.calls[-1]["action"])

        tools["get_remote_command_result"].invoke(
            {"command_id": "cmd_1", "reason": "inspect"}
        )
        self.assertEqual("session_command_result", provider.calls[-1]["action"])

    @unittest.skipUnless(LANGCHAIN_TOOLING_AVAILABLE, "langchain_core is required")
    def test_tutor_tool_collection_flattens_multi_tool_skills(self):
        from langchain_core.tools import tool

        @tool("first_tool")
        def first_tool(query: str = "") -> str:
            """First fake tool."""
            return query

        @tool("second_tool")
        def second_tool(query: str = "") -> str:
            """Second fake tool."""
            return query

        @tool("legacy_tool")
        def legacy_tool(query: str = "") -> str:
            """Legacy fake tool."""
            return query

        class MultiToolSkill:
            def get_tools(self):
                return [first_tool, second_tool]

        class LegacySkill:
            def get_tool(self):
                return legacy_tool

        tools = _collect_tools_from_skills([MultiToolSkill(), LegacySkill()])

        self.assertEqual(
            ["first_tool", "second_tool", "legacy_tool"],
            [item.name for item in tools],
        )

    def test_observation_truncates_long_payload(self):
        runner = FakeRunner(
            [
                RunnerResult(
                    returncode=0,
                    stdout=json.dumps({"sessions": [{"session_id": "s", "stdout": "A" * 2000}]}),
                )
            ]
        )
        provider = RemoteRunnerProvider(
            RemoteRunnerProviderConfig(
                enabled=True,
                repo_path=None,
                max_output_chars=600,
            ),
            command_runner=runner,
        )

        result = provider.observe(action="list_sessions")

        self.assertLessEqual(len(result), 615)
        self.assertIn("[truncated]", result)

    def test_add_machine_and_create_session_cli_arguments(self):
        runner = FakeRunner(
            [
                RunnerResult(
                    returncode=0,
                    stdout=json.dumps({"machine_id": "lab1", "password": "***REDACTED***"}),
                ),
                RunnerResult(
                    returncode=0,
                    stdout=json.dumps({"session_id": "sess1", "machine_id": "lab1"}),
                ),
            ]
        )
        provider = RemoteRunnerProvider(
            RemoteRunnerProviderConfig(enabled=True, repo_path=None),
            command_runner=runner,
        )

        added = provider.add_machine(
            machine_id="lab1",
            host="127.0.0.1",
            port=2222,
            user="seed",
            auth_type="password",
            password="secret",
            default_cwd="/home/seed",
        )
        session = provider.create_session(machine_id="lab1", cwd="/home/seed")

        self.assertEqual("lab1", added["machine_id"])
        self.assertEqual("sess1", session["session_id"])
        self.assertEqual(
            [
                "machine",
                "add",
                "--machine-id",
                "lab1",
                "--host",
                "127.0.0.1",
                "--port",
                "2222",
                "--user",
                "seed",
                "--auth-type",
                "password",
                "--default-cwd",
                "/home/seed",
                "--password",
                "secret",
                "--replace",
                "--confirm-replace",
                "lab1",
                "--json",
            ],
            runner.calls[0]["args"][3:],
        )
        self.assertEqual(
            ["session", "create", "--machine", "lab1", "--cwd", "/home/seed", "--json"],
            runner.calls[1]["args"][3:],
        )

    def test_put_file_uses_remote_runner_file_cli(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            local_file = Path(tmp_dir) / "docker-compose.yml"
            local_file.write_text("services: {}\n", encoding="utf-8")
            runner = FakeRunner(
                [
                    RunnerResult(
                        returncode=0,
                        stdout=json.dumps(
                            {
                                "session_id": "sess1",
                                "remote_path": "/home/seed/lab/docker-compose.yml",
                                "local_path": str(local_file),
                            }
                        ),
                    )
                ]
            )
            provider = RemoteRunnerProvider(
                RemoteRunnerProviderConfig(enabled=True, repo_path=None),
                command_runner=runner,
            )

            result = provider.put_file(
                session_id="sess1",
                local_path=local_file,
                remote_path="/home/seed/lab/docker-compose.yml",
            )

        self.assertEqual("/home/seed/lab/docker-compose.yml", result["remote_path"])
        self.assertEqual("<local_path_redacted>", result["local_path"])
        self.assertEqual(
            [
                "file",
                "put",
                "--session",
                "sess1",
                "--local",
                str(local_file.resolve()),
                "--remote",
                "/home/seed/lab/docker-compose.yml",
                "--json",
            ],
            runner.calls[0]["args"][3:],
        )

    @unittest.skipUnless(LANGCHAIN_TOOLING_AVAILABLE, "langchain_core is not installed")
    def test_remote_environment_skill_returns_none_when_disabled(self):
        skill = get_remote_environment_skill(
            RemoteRunnerProvider(RemoteRunnerProviderConfig(enabled=False))
        )

        self.assertIsNone(skill)

    @unittest.skipUnless(LANGCHAIN_TOOLING_AVAILABLE, "langchain_core is not installed")
    def test_remote_environment_skill_tool_invokes_provider(self):
        runner = FakeRunner(
            [
                RunnerResult(
                    returncode=0,
                    stdout=json.dumps(
                        {"machines": [{"machine_id": "lab1"}], "summary": {"machine_count": 1}}
                    ),
                )
            ]
        )
        provider = RemoteRunnerProvider(
            RemoteRunnerProviderConfig(enabled=True, repo_path=None),
            command_runner=runner,
        )
        skill = get_remote_environment_skill(provider)

        result = skill.get_tool().invoke(
            {"action": "list_machines", "reason": "check available lab machines"}
        )

        self.assertIn("lab1", result)
        self.assertEqual(1, len(runner.calls))

    @unittest.skipUnless(LANGCHAIN_TOOLING_AVAILABLE, "langchain_core is not installed")
    def test_tutor_injects_remote_skill_when_enabled(self):
        from langchain_core.tools import tool
        from utils import tutor_core

        class FakeSkill:
            def __init__(self, name):
                self.name = name
                self.description = f"{name} description"

            def get_tool(self):
                tool_name = self.name
                tool_description = self.description

                @tool(tool_name)
                def fake_tool(query: str = "") -> str:
                    """Fake tool used by Tutor injection tests."""
                    return query or "ok"

                fake_tool.name = tool_name
                fake_tool.description = tool_description
                return fake_tool

        class FakeDb:
            def __enter__(self):
                return object()

            def __exit__(self, exc_type, exc, tb):
                return False

        fake_session = SimpleNamespace(
            owner_id="user1",
            session_id="session1",
            history=[],
            profile=SimpleNamespace(
                profile_id="profile1",
                topic_name="Buffer Overflow",
                lab_name="seed-buffer-overflow",
                prompt_template="Tutor prompt",
            ),
        )
        fake_llm = SimpleNamespace(get_num_tokens=lambda text: len(str(text)))
        fake_memory = SimpleNamespace(enabled=False)

        with patch.object(tutor_core, "LabManualSkill", lambda *args, **kwargs: FakeSkill("lab")), \
            patch.object(tutor_core, "PedagogicalStrategySkill", lambda: FakeSkill("pedagogy")), \
            patch.object(tutor_core, "AssessmentSkill", lambda session: FakeSkill("assessment")), \
            patch.object(tutor_core, "get_remote_environment_skill", lambda **kwargs: FakeSkill("observe_remote_environment")), \
            patch.object(tutor_core, "SessionLocal", lambda: FakeDb()), \
            patch.object(
                tutor_core,
                "CustomSkillManager",
                lambda db: SimpleNamespace(list_skills=lambda profile_id: []),
            ), \
            patch.object(tutor_core, "StepEvaluator", lambda: SimpleNamespace()), \
            patch.object(tutor_core, "get_memory_provider", lambda context: fake_memory):
            tutor = tutor_core.Tutor(fake_session, llm=fake_llm)

        self.assertIn("observe_remote_environment", [tool.name for tool in tutor.tools])
        self.assertIn(
            "observe_remote_environment",
            [skill.name for skill in tutor._skills_for_prompt(include_custom=True)],
        )


if __name__ == "__main__":
    unittest.main()
