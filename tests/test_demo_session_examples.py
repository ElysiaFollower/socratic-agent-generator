import json
from pathlib import Path


EXAMPLE_DIR = Path("docs/examples/live-demo-sessions")


def test_live_demo_session_examples_are_complete_and_sanitized():
    paths = sorted(EXAMPLE_DIR.glob("*.json"))

    assert {path.name for path in paths} == {
        "admin-vpn-tunnel-full-session.json",
        "demo-sniffing-spoofing-full-session.json",
    }

    for path in paths:
        payload = json.loads(path.read_text(encoding="utf-8"))
        progress = payload["session"]["progress"]
        privacy = payload["privacy"]

        assert progress["isFinished"] is True
        assert progress["stepIndex"] == progress["totalSteps"]
        assert len(payload["session"]["history"]) >= progress["totalSteps"] * 2
        assert privacy["contains_credentials"] is False
        assert privacy["contains_api_tokens"] is False

        serialized = json.dumps(payload, ensure_ascii=False).lower()
        for forbidden in ("bearer ", "api_key", "jwt", "socraticadmin2026"):
            assert forbidden not in serialized
