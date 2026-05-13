"""Generate manual-enhance profile artifacts from external SEEDRunner runs.

This script intentionally keeps the raw SEEDRunner reports outside this repo.
It reads them as generator input, records source paths and derived profile JSON,
and avoids printing or persisting LLM credentials.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from generators.ProfileGenerateManager import ProfileGenerateManager  # noqa: E402
from generators.config import FAST_CONFIG, PRODUCTION_CONFIG  # noqa: E402


RUNS_ROOT = Path("/Users/ely/workspace/research/agent/SEEDRunner/runs")
OUTPUT_ROOT = ROOT / "docs" / "manual-enhance"


@dataclass(frozen=True)
class LabSpec:
    lab_id: str
    title: str
    manual: Path
    reports: tuple[Path, ...]
    handwritten: tuple[Path, ...] = ()
    notes: str = ""


LABS: tuple[LabSpec, ...] = (
    LabSpec(
        lab_id="ARP_Attack",
        title="ARP Cache Poisoning and MITM",
        manual=RUNS_ROOT / "ARP_Attack/docs/ARP_Attack.tex",
        reports=(RUNS_ROOT / "ARP_Attack/report/ARP_Attack.zh.md",),
        handwritten=(RUNS_ROOT / "mine/ARP_Attack/docs/report_draft.md",),
        notes="Handwritten report emphasizes packet loss under disabled forwarding and Telnet/Netcat payload rewriting.",
    ),
    LabSpec(
        lab_id="LocalDNSAttack",
        title="Local DNS Cache Poisoning",
        manual=RUNS_ROOT / "LocalDNSAttack/docs/DNS_Local.tex",
        reports=(RUNS_ROOT / "LocalDNSAttack/report/local-dns-attack.zh.md",),
        handwritten=(RUNS_ROOT / "mine/LocalDNSAttack/report/report_draft.md",),
        notes="Handwritten report is detailed and highlights role relationships, cache flushing, bridge interface discovery, and section-specific DNS caching behavior.",
    ),
    LabSpec(
        lab_id="RemoteDNSAttack",
        title="Remote DNS Kaminsky Attack",
        manual=RUNS_ROOT / "RemoteDNSAttack/docs/DNS_Remote.tex",
        reports=(RUNS_ROOT / "RemoteDNSAttack/report/report_draft.md",),
        notes="Only draft notes were found; treat as lower-confidence than labs with completed reports.",
    ),
    LabSpec(
        lab_id="Sniffing_Spoofing",
        title="Packet Sniffing and Spoofing",
        manual=RUNS_ROOT / "Sniffing_Spoofing/docs/Sniffing_Spoofing.tex",
        reports=(RUNS_ROOT / "Sniffing_Spoofing/report/Sniffing_Spoofing.zh.md",),
        handwritten=(RUNS_ROOT / "mine/Sniffing_Spoofing/docs/report_draft.md",),
        notes="Handwritten artifacts include Scapy and C/pcap code paths; generated report records the bridge-interface discovery issue.",
    ),
    LabSpec(
        lab_id="TCP_Attacks",
        title="TCP Attacks",
        manual=RUNS_ROOT / "TCP_Attacks/docs/TCP_Attacks.tex",
        reports=(RUNS_ROOT / "TCP_Attacks/report/TCP_Attacks.zh.md",),
        handwritten=(
            RUNS_ROOT / "mine/TCP_Attacks/docs/report.md",
            RUNS_ROOT / "mine/TCP_Attacks/docs/report_draft.md",
        ),
        notes="Handwritten report stresses empirical instability in SYN flood/RST attacks and the need to compare Python/C implementations and mitigations.",
    ),
    LabSpec(
        lab_id="VPN_Tunnel",
        title="VPN Tunneling",
        manual=RUNS_ROOT / "VPN_Tunnel/docs/VPN_Tunnel.tex",
        reports=(
            RUNS_ROOT / "VPN_Tunnel/report/report.md",
            RUNS_ROOT / "VPN_Tunnel/report/Agent-report.md",
            RUNS_ROOT / "VPN_Tunnel/report/report_draft.md",
        ),
        notes="Most detailed generated report; emphasizes routing as the main learning bottleneck and TUN/TAP semantic contrast.",
    ),
)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def excerpt(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    head = max_chars // 2
    tail = max_chars - head
    return text[:head] + "\n\n...[middle omitted for generator budget]...\n\n" + text[-tail:]


def iter_existing(paths: Iterable[Path]) -> Iterable[Path]:
    for path in paths:
        if path.exists():
            yield path


def build_generator_input(spec: LabSpec, report_chars: int) -> str:
    parts = [
        "# Generator Input: Real SEED Experiment Calibration",
        "",
        "This input combines the official lab manual with real execution reports.",
        "Use the reports to anchor the curriculum in the order, friction points, observations, and evidence students actually encounter.",
        "Do not teach by dumping commands. Create Socratic nodes that help the student decide what to check next and why.",
        "",
        f"## Lab: {spec.title}",
        f"Lab id: {spec.lab_id}",
        f"Calibration notes: {spec.notes}",
        "",
        "## Official lab manual (.tex)",
        f"Source path: {spec.manual}",
        "",
        read_text(spec.manual),
    ]

    for path in iter_existing(spec.handwritten):
        parts.extend(
            [
                "",
                "## Handwritten student report or notes",
                f"Source path: {path}",
                "",
                excerpt(read_text(path), report_chars),
            ]
        )

    for path in iter_existing(spec.reports):
        parts.extend(
            [
                "",
                "## Verified generated or polished report",
                f"Source path: {path}",
                "",
                excerpt(read_text(path), report_chars),
            ]
        )

    return "\n".join(parts)


def source_record(spec: LabSpec) -> dict:
    paths = [spec.manual, *spec.handwritten, *spec.reports]
    return {
        **asdict(spec),
        "manual": str(spec.manual),
        "reports": [str(path) for path in spec.reports],
        "handwritten": [str(path) for path in spec.handwritten],
        "source_stats": [
            {
                "path": str(path),
                "exists": path.exists(),
                "bytes": path.stat().st_size if path.exists() else 0,
            }
            for path in paths
        ],
    }


async def generate_one(spec: LabSpec, args: argparse.Namespace) -> dict:
    lab_dir = OUTPUT_ROOT / "generated" / spec.lab_id
    lab_dir.mkdir(parents=True, exist_ok=True)

    definition_path = lab_dir / "definition.json"
    curriculum_path = lab_dir / "curriculum.json"
    profile_path = lab_dir / "profile.json"

    if args.skip_existing and definition_path.exists() and curriculum_path.exists() and profile_path.exists():
        return {"lab_id": spec.lab_id, "status": "skipped-existing"}

    content = build_generator_input(spec, args.report_chars)
    config = FAST_CONFIG if args.fast else PRODUCTION_CONFIG
    manager = ProfileGenerateManager(
        content,
        config=config,
        output_language="Simplified Chinese",
    )

    persona, curriculum = await asyncio.gather(
        manager.generate_persona(),
        manager.generate_curriculum(),
    )
    profile = await manager.compile_profile(
        curriculum=curriculum,
        definition=persona,
        profile_name=f"{spec.lab_id} calibrated seed draft",
        lab_name=spec.lab_id,
        output_dir=None,
    )

    definition_path.write_text(
        json.dumps(persona.model_dump(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    curriculum_path.write_text(
        json.dumps(curriculum.model_dump(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    profile_path.write_text(
        json.dumps(profile.model_dump(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    summary = {
        "lab_id": spec.lab_id,
        "status": "generated",
        "definition": str(definition_path.relative_to(ROOT)),
        "curriculum": str(curriculum_path.relative_to(ROOT)),
        "profile": str(profile_path.relative_to(ROOT)),
        "topic_name": persona.topic_name,
        "step_count": curriculum.get_len(),
        "steps": [step.step_title for step in curriculum.root],
    }
    (lab_dir / "generation-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return summary


async def run(args: argparse.Namespace) -> None:
    if args.dotenv:
        load_dotenv(Path(args.dotenv))
    elif (ROOT / ".env").exists():
        load_dotenv(ROOT / ".env")

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    manifest = {
        "runs_root": str(RUNS_ROOT),
        "mode": "fast" if args.fast else "production",
        "raw_source_policy": "Raw reports and manuals remain external; this repo stores only paths, stats, generated profiles, and derived review notes.",
        "labs": [source_record(spec) for spec in LABS],
    }
    (OUTPUT_ROOT / "corpus-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    requested = set(args.lab or [])
    specs = [spec for spec in LABS if not requested or spec.lab_id in requested]
    results = []
    for spec in specs:
        print(f"Generating {spec.lab_id}...", flush=True)
        results.append(await generate_one(spec, args))

    (OUTPUT_ROOT / "generation-run-summary.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dotenv", help="Optional dotenv path to load LLM credentials from.")
    parser.add_argument("--fast", action="store_true", help="Use FAST_CONFIG to reduce API calls.")
    parser.add_argument("--skip-existing", action="store_true")
    parser.add_argument("--report-chars", type=int, default=18000)
    parser.add_argument("--lab", action="append", choices=[spec.lab_id for spec in LABS])
    return parser.parse_args()


if __name__ == "__main__":
    asyncio.run(run(parse_args()))
