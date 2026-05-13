"""Validation tests for manually calibrated SEED profile artifacts."""

import json
from pathlib import Path

from schemas.curriculum import SocraticCurriculum
from schemas.profile import Profile


ROOT = Path(__file__).resolve().parents[1]
MANUAL_ENHANCE_DIR = ROOT / "docs" / "manual-enhance"
EXPECTED_LABS = {
    "ARP_Attack",
    "LocalDNSAttack",
    "RemoteDNSAttack",
    "Sniffing_Spoofing",
    "TCP_Attacks",
    "VPN_Tunnel",
}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_calibrated_profiles_match_schema_and_summary():
    summary = load_json(MANUAL_ENHANCE_DIR / "calibrated-profile-summary.json")
    assert {item["lab_id"] for item in summary} == EXPECTED_LABS

    for item in summary:
        profile_path = ROOT / item["profile"]
        curriculum_path = ROOT / item["curriculum"]
        assert profile_path.exists(), profile_path
        assert curriculum_path.exists(), curriculum_path

        profile = Profile.model_validate(load_json(profile_path))
        curriculum = SocraticCurriculum.model_validate(load_json(curriculum_path))

        assert profile.lab_name == item["lab_id"]
        assert profile.curriculum.get_len() == item["step_count"]
        assert curriculum.get_len() == item["step_count"]
        assert item["step_count"] >= 5
        assert profile.prompt_template.strip()

        for step in profile.curriculum.root:
            assert step.step_title.strip()
            assert step.guiding_question.strip()
            assert step.success_criteria.strip()
            assert step.learning_objective.strip()
            assert len(step.scaffolding_hints) >= 3


def test_corpus_manifest_references_external_sources_without_copying_raw_files():
    manifest = load_json(MANUAL_ENHANCE_DIR / "corpus-manifest.json")
    assert manifest["runs_root"] == "/Users/ely/workspace/research/agent/SEEDRunner/runs"
    assert "Raw reports and manuals remain external" in manifest["raw_source_policy"]
    assert {item["lab_id"] for item in manifest["labs"]} == EXPECTED_LABS

    for lab in manifest["labs"]:
        assert Path(lab["manual"]).is_absolute()
        assert str(lab["manual"]).startswith(manifest["runs_root"])
        for stats in lab["source_stats"]:
            assert stats["path"].startswith(manifest["runs_root"])
            assert stats["exists"] is True
            assert stats["bytes"] > 0


def test_mismatch_taxonomy_is_actionable_and_traceable():
    mismatches = load_json(MANUAL_ENHANCE_DIR / "mismatch-taxonomy.json")
    assert len(mismatches) >= 5

    covered_labs = set()
    for item in mismatches:
        assert item["pattern"].strip()
        assert item["generator_symptom"].strip()
        assert item["manual_fix"].strip()
        assert item["labs"]
        assert set(item["labs"]).issubset(EXPECTED_LABS)
        covered_labs.update(item["labs"])

    assert covered_labs >= EXPECTED_LABS - {"RemoteDNSAttack"}


def test_generated_and_calibrated_outputs_are_kept_separate():
    generated = load_json(MANUAL_ENHANCE_DIR / "generation-run-summary.json")
    calibrated = load_json(MANUAL_ENHANCE_DIR / "calibrated-profile-summary.json")

    generated_by_lab = {
        item["lab_id"]: item
        for item in generated
        if item.get("status") in {"generated", "skipped-existing"}
    }
    calibrated_by_lab = {item["lab_id"]: item for item in calibrated}
    assert set(generated_by_lab) == EXPECTED_LABS
    assert set(calibrated_by_lab) == EXPECTED_LABS

    changed_labs = []
    for lab_id, item in calibrated_by_lab.items():
        generated_path = MANUAL_ENHANCE_DIR / "generated" / lab_id / "curriculum.json"
        calibrated_path = ROOT / item["curriculum"]
        assert generated_path.exists()
        assert calibrated_path.exists()
        if load_json(generated_path) != load_json(calibrated_path):
            changed_labs.append(lab_id)

    assert set(changed_labs) == EXPECTED_LABS
