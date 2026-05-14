import json
from pathlib import Path


EXAMPLE_DIR = Path("docs/examples/live-demo-sessions")


def test_live_demo_session_examples_are_complete_and_sanitized():
    paths = sorted(EXAMPLE_DIR.glob("*.json"))

    assert {path.name for path in paths} == {
        "admin-vpn-tunnel-full-session.json",
        "demo-sniffing-spoofing-full-session.json",
        "remote-runner-sniffing-spoofing-final.json",
    }

    for path in paths:
        payload = json.loads(path.read_text(encoding="utf-8"))
        if "session" in payload:
            progress = payload["session"]["progress"]
            history_len = len(payload["session"]["history"])
            assert payload["privacy"]["contains_credentials"] is False
            assert payload["privacy"]["contains_api_tokens"] is False
        else:
            progress = payload["final_state"]
            history_len = payload["history_len"]
            assert payload["audit_count"] >= 5

        assert progress["isFinished"] is True
        assert progress["stepIndex"] == progress["totalSteps"]
        assert history_len >= progress["totalSteps"] * 2

        serialized = json.dumps(payload, ensure_ascii=False).lower()
        for forbidden in (
            "bearer ",
            "api_key",
            "jwt",
            "socraticadmin2026",
            "private key",
            "llm_api_key",
        ):
            assert forbidden not in serialized
