"""Evaluate generated profiles against calibrated SEED profiles.

This benchmark is intentionally credential-free. It gives future generator
prompt or architecture changes a stable first gate before any LLM-as-judge or
full Tutor conversation benchmark is introduced.
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


DEFAULT_CANDIDATE_ROOT = Path("docs/manual-enhance/generated")
DEFAULT_REFERENCE_ROOT = Path("docs/manual-enhance/calibrated")
DEFAULT_TAXONOMY = Path("docs/manual-enhance/mismatch-taxonomy.json")
PROFILE_FILENAME = "profile.json"

REQUIRED_PROFILE_FIELDS = (
    "profile_name",
    "topic_name",
    "lab_name",
    "persona_hints",
    "target_audience",
    "curriculum",
    "prompt_template",
)
REQUIRED_STEP_FIELDS = (
    "step_title",
    "guiding_question",
    "success_criteria",
    "learning_objective",
)

RISK_PROBES = {
    "环境摩擦被省略": {
        "terms": ("环境", "接口", "bridge", "docker", "compose", "路由", "缓存", "cache", "基线"),
        "scope": "early",
    },
    "成功标准过度确定": {
        "terms": ("概率", "多次", "间歇", "可能", "复现", "竞速", "高丢包", "不稳定"),
        "scope": "all",
    },
    "负例和失败实验没有被当作学习节点": {
        "terms": ("负例", "失败", "无效", "不能", "不会", "不被", "受限", "反例"),
        "scope": "all",
    },
    "证据链不足": {
        "terms": ("证据", "记录", "抓包", "tcpdump", "dump", "观察", "证明", "输出", "结果", "arp 表"),
        "scope": "all",
    },
    "任务粒度不贴合真实认知负担": {
        "terms": (),
        "scope": "step_count",
    },
    "源文档编号问题未被校正": {
        "terms": ("rst", "session hijacking", "reverse shell", "video"),
        "scope": "all",
    },
}


@dataclass(frozen=True)
class ProfileBundle:
    """Loaded profile plus normalized curriculum text."""

    lab: str
    path: Path
    data: dict[str, Any]
    steps: list[dict[str, Any]]


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_steps(profile: dict[str, Any]) -> list[dict[str, Any]]:
    curriculum = profile.get("curriculum") or []
    if isinstance(curriculum, dict):
        curriculum = curriculum.get("root") or []
    if not isinstance(curriculum, list):
        return []
    return [step for step in curriculum if isinstance(step, dict)]


def load_profile(root: Path, lab: str) -> ProfileBundle:
    path = root / lab / PROFILE_FILENAME
    data = load_json(path)
    return ProfileBundle(lab=lab, path=path, data=data, steps=normalize_steps(data))


def discover_labs(candidate_root: Path, reference_root: Path) -> list[str]:
    candidate_labs = {
        path.parent.name for path in candidate_root.glob(f"*/{PROFILE_FILENAME}")
    }
    reference_labs = {
        path.parent.name for path in reference_root.glob(f"*/{PROFILE_FILENAME}")
    }
    return sorted(candidate_labs & reference_labs)


def text_of_profile(bundle: ProfileBundle, steps: Iterable[dict[str, Any]] | None = None) -> str:
    selected_steps = bundle.steps if steps is None else list(steps)
    parts: list[str] = [
        str(bundle.data.get("profile_name") or ""),
        str(bundle.data.get("topic_name") or ""),
        " ".join(str(item) for item in bundle.data.get("persona_hints") or []),
        str(bundle.data.get("target_audience") or ""),
        str(bundle.data.get("prompt_template") or ""),
    ]
    for step in selected_steps:
        parts.extend(str(step.get(field) or "") for field in REQUIRED_STEP_FIELDS)
        hints = step.get("scaffolding_hints") or []
        if isinstance(hints, list):
            parts.append(" ".join(str(item) for item in hints))
    return "\n".join(parts).lower()


def token_set(text: str) -> set[str]:
    latin = set(re.findall(r"[a-zA-Z][a-zA-Z0-9_+-]{2,}", text.lower()))
    cjk_chars = re.findall(r"[\u4e00-\u9fff]", text)
    cjk_bigrams = {
        "".join(pair) for pair in zip(cjk_chars, cjk_chars[1:]) if pair[0] != pair[1]
    }
    return latin | cjk_bigrams


def jaccard(left: set[str], right: set[str]) -> float:
    if not left and not right:
        return 1.0
    if not left or not right:
        return 0.0
    return len(left & right) / len(left | right)


def clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def score_structure(candidate: ProfileBundle) -> float:
    present_profile = sum(
        1 for field in REQUIRED_PROFILE_FIELDS if candidate.data.get(field)
    ) / len(REQUIRED_PROFILE_FIELDS)
    if not candidate.steps:
        return present_profile * 0.4
    step_scores = []
    for step in candidate.steps:
        step_scores.append(
            sum(1 for field in REQUIRED_STEP_FIELDS if step.get(field))
            / len(REQUIRED_STEP_FIELDS)
        )
    return 0.45 * present_profile + 0.55 * (sum(step_scores) / len(step_scores))


def score_persona(candidate: ProfileBundle, reference: ProfileBundle) -> float:
    candidate_hints = candidate.data.get("persona_hints") or []
    reference_hints = reference.data.get("persona_hints") or []
    hint_ratio = (
        min(len(candidate_hints), len(reference_hints)) / len(reference_hints)
        if reference_hints
        else 1.0
    )
    audience = 1.0 if candidate.data.get("target_audience") else 0.0
    prompt = 1.0 if candidate.data.get("prompt_template") else 0.0
    return clamp(0.45 * hint_ratio + 0.35 * audience + 0.20 * prompt)


def score_curriculum_alignment(candidate: ProfileBundle, reference: ProfileBundle) -> float:
    if not candidate.steps or not reference.steps:
        return 0.0
    candidate_texts = [
        token_set(
            " ".join(str(step.get(field) or "") for field in REQUIRED_STEP_FIELDS)
        )
        for step in candidate.steps
    ]
    reference_texts = [
        token_set(
            " ".join(str(step.get(field) or "") for field in REQUIRED_STEP_FIELDS)
        )
        for step in reference.steps
    ]
    best_scores = [
        max(jaccard(reference_tokens, candidate_tokens) for candidate_tokens in candidate_texts)
        for reference_tokens in reference_texts
    ]
    step_count_ratio = min(len(candidate.steps), len(reference.steps)) / max(
        len(candidate.steps),
        len(reference.steps),
    )
    return clamp(0.75 * (sum(best_scores) / len(best_scores)) + 0.25 * step_count_ratio)


def taxonomy_for_lab(taxonomy: list[dict[str, Any]], lab: str) -> list[dict[str, Any]]:
    return [item for item in taxonomy if lab in set(item.get("labs") or [])]


def check_risk(candidate: ProfileBundle, reference: ProfileBundle, pattern: str) -> dict[str, Any]:
    probe = RISK_PROBES.get(pattern)
    if not probe:
        return {"pattern": pattern, "passed": False, "reason": "No probe defined"}

    scope = probe["scope"]
    if scope == "early":
        haystack = text_of_profile(candidate, candidate.steps[:2])
    elif scope == "step_count":
        ratio = len(candidate.steps) / max(1, len(reference.steps))
        passed = 0.75 <= ratio <= 1.35
        return {
            "pattern": pattern,
            "passed": passed,
            "reason": f"candidate_steps={len(candidate.steps)}, reference_steps={len(reference.steps)}",
        }
    else:
        haystack = text_of_profile(candidate)

    matched = [term for term in probe["terms"] if term.lower() in haystack]
    return {
        "pattern": pattern,
        "passed": bool(matched),
        "reason": f"matched_terms={matched[:5]}" if matched else "no required signal found",
    }


def score_risk_coverage(
    candidate: ProfileBundle,
    reference: ProfileBundle,
    taxonomy: list[dict[str, Any]],
) -> tuple[float, list[dict[str, Any]]]:
    checks = [
        check_risk(candidate, reference, item["pattern"])
        for item in taxonomy_for_lab(taxonomy, candidate.lab)
    ]
    if not checks:
        return 1.0, []
    score = sum(1 for check in checks if check["passed"]) / len(checks)
    return score, checks


def evaluate_lab(
    lab: str,
    candidate_root: Path,
    reference_root: Path,
    taxonomy: list[dict[str, Any]],
) -> dict[str, Any]:
    candidate = load_profile(candidate_root, lab)
    reference = load_profile(reference_root, lab)
    structure = score_structure(candidate)
    persona = score_persona(candidate, reference)
    curriculum = score_curriculum_alignment(candidate, reference)
    risk, risk_checks = score_risk_coverage(candidate, reference, taxonomy)
    total = clamp(
        0.25 * structure
        + 0.15 * persona
        + 0.35 * curriculum
        + 0.25 * risk
    )
    return {
        "lab": lab,
        "candidate_profile": candidate.path.as_posix(),
        "reference_profile": reference.path.as_posix(),
        "score": round(total, 4),
        "status": status_for_score(total),
        "metrics": {
            "structure": round(structure, 4),
            "persona": round(persona, 4),
            "curriculum_alignment": round(curriculum, 4),
            "risk_coverage": round(risk, 4),
            "candidate_steps": len(candidate.steps),
            "reference_steps": len(reference.steps),
        },
        "risk_checks": risk_checks,
    }


def status_for_score(score: float) -> str:
    if score >= 0.75:
        return "pass"
    if score >= 0.55:
        return "warn"
    return "fail"


def evaluate_profiles(
    candidate_root: Path = DEFAULT_CANDIDATE_ROOT,
    reference_root: Path = DEFAULT_REFERENCE_ROOT,
    taxonomy_path: Path = DEFAULT_TAXONOMY,
) -> dict[str, Any]:
    taxonomy = load_json(taxonomy_path)
    labs = discover_labs(candidate_root, reference_root)
    lab_results = [
        evaluate_lab(lab, candidate_root, reference_root, taxonomy) for lab in labs
    ]
    average = (
        sum(result["score"] for result in lab_results) / len(lab_results)
        if lab_results
        else 0.0
    )
    return {
        "version": 1,
        "candidate_root": candidate_root.as_posix(),
        "reference_root": reference_root.as_posix(),
        "taxonomy": taxonomy_path.as_posix(),
        "lab_count": len(lab_results),
        "aggregate": {
            "score": round(average, 4),
            "status": status_for_score(average),
            "pass_count": sum(1 for result in lab_results if result["status"] == "pass"),
            "warn_count": sum(1 for result in lab_results if result["status"] == "warn"),
            "fail_count": sum(1 for result in lab_results if result["status"] == "fail"),
        },
        "labs": lab_results,
    }


def print_summary(report: dict[str, Any]) -> None:
    aggregate = report["aggregate"]
    print(
        f"profile_generation_eval score={aggregate['score']:.4f} "
        f"status={aggregate['status']} labs={report['lab_count']} "
        f"pass={aggregate['pass_count']} warn={aggregate['warn_count']} "
        f"fail={aggregate['fail_count']}"
    )
    for result in report["labs"]:
        metrics = result["metrics"]
        print(
            f"- {result['lab']}: score={result['score']:.4f} "
            f"status={result['status']} steps={metrics['candidate_steps']}/"
            f"{metrics['reference_steps']} risk={metrics['risk_coverage']:.2f}"
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Evaluate generated profiles against calibrated profiles.",
    )
    parser.add_argument("--candidate-root", type=Path, default=DEFAULT_CANDIDATE_ROOT)
    parser.add_argument("--reference-root", type=Path, default=DEFAULT_REFERENCE_ROOT)
    parser.add_argument("--taxonomy", type=Path, default=DEFAULT_TAXONOMY)
    parser.add_argument("--output", type=Path, default=None)
    parser.add_argument("--json", action="store_true", help="Print full JSON report.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    report = evaluate_profiles(args.candidate_root, args.reference_root, args.taxonomy)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print_summary(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
