"""Tests for the profile generation quality benchmark."""

import json
from pathlib import Path

from scripts.benchmarks.profile_generation_eval import (
    evaluate_profiles,
    score_curriculum_alignment,
    load_profile,
)


ROOT = Path(__file__).resolve().parents[1]


def write_profile(root: Path, lab: str, profile: dict) -> None:
    lab_dir = root / lab
    lab_dir.mkdir(parents=True, exist_ok=True)
    (lab_dir / "profile.json").write_text(
        json.dumps(profile, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def profile_fixture(lab: str, title: str = "环境基线与证据") -> dict:
    return {
        "profile_name": f"{lab} profile",
        "topic_name": "网络实验",
        "lab_name": lab,
        "persona_hints": ["引导学生先观察环境", "要求记录证据"],
        "target_audience": "本科网络安全学生",
        "curriculum": [
            {
                "step_title": title,
                "guiding_question": "为什么要先确认 Docker bridge 接口和缓存基线？",
                "success_criteria": "学生记录 tcpdump 输出和命令结果，解释环境基线。",
                "learning_objective": "建立实验环境和证据链。",
            },
            {
                "step_title": "负例分析",
                "guiding_question": "失败或无效结果说明了什么限制？",
                "success_criteria": "学生能解释负例，并多次复现可能的不稳定结果。",
                "learning_objective": "理解失败实验的学习价值。",
            },
        ],
        "prompt_template": "Use Socratic questions.",
    }


def test_real_manual_enhance_profiles_can_be_scored():
    report = evaluate_profiles(
        ROOT / "docs/manual-enhance/generated",
        ROOT / "docs/manual-enhance/calibrated",
        ROOT / "docs/manual-enhance/mismatch-taxonomy.json",
    )

    assert report["lab_count"] == 6
    assert 0 <= report["aggregate"]["score"] <= 1
    assert {item["lab"] for item in report["labs"]} == {
        "ARP_Attack",
        "LocalDNSAttack",
        "RemoteDNSAttack",
        "Sniffing_Spoofing",
        "TCP_Attacks",
        "VPN_Tunnel",
    }
    assert all("risk_checks" in item for item in report["labs"])


def test_degraded_profile_scores_lower_than_complete_profile(tmp_path):
    candidate_root = tmp_path / "candidate"
    reference_root = tmp_path / "reference"
    taxonomy_path = tmp_path / "taxonomy.json"
    taxonomy_path.write_text(
        json.dumps(
            [
                {
                    "pattern": "环境摩擦被省略",
                    "labs": ["DemoLab"],
                    "generator_symptom": "",
                    "manual_fix": "",
                },
                {
                    "pattern": "证据链不足",
                    "labs": ["DemoLab"],
                    "generator_symptom": "",
                    "manual_fix": "",
                },
            ],
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    write_profile(reference_root, "DemoLab", profile_fixture("DemoLab"))
    write_profile(candidate_root, "DemoLab", profile_fixture("DemoLab"))
    strong_report = evaluate_profiles(candidate_root, reference_root, taxonomy_path)

    weak = {
        "profile_name": "weak",
        "lab_name": "DemoLab",
        "curriculum": [
            {
                "step_title": "完成攻击",
                "guiding_question": "",
                "success_criteria": "",
                "learning_objective": "",
            }
        ],
    }
    write_profile(candidate_root, "DemoLab", weak)
    weak_report = evaluate_profiles(candidate_root, reference_root, taxonomy_path)

    assert strong_report["labs"][0]["score"] > weak_report["labs"][0]["score"]
    assert weak_report["labs"][0]["metrics"]["risk_coverage"] == 0


def test_curriculum_alignment_is_symmetric_enough_for_exact_match(tmp_path):
    root = tmp_path / "profiles"
    write_profile(root, "DemoLab", profile_fixture("DemoLab"))
    left = load_profile(root, "DemoLab")
    right = load_profile(root, "DemoLab")

    assert score_curriculum_alignment(left, right) == 1.0
