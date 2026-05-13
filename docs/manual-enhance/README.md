# Manual Enhance Profile Calibration

This directory records a calibrated profile set for the semester SEED labs.
The six curated lab manuals needed for built-in RAG-backed profiles are
versioned as `calibrated/<lab>/lab_manual.tex`. Reports, screenshots, logs,
PDFs, archives, and user data stay outside this repository.

## Artifacts

- `corpus-manifest.json`: external source paths, file sizes, and source notes.
- `generated/<lab>/`: first-pass generator output from the current system.
- `calibrated/<lab>/`: manually adjusted profile and curriculum JSON. These
  profiles are seeded into SQLite on startup as built-in public profiles. Each
  lab also carries `lab_manual.tex`, copied from the verified SEEDRunner run, so
  the default database can create a matching built-in `Document` and link the
  profile to a real lab manual for RAG.
- `generation-run-summary.json`: first-pass generation summary.
- `calibrated-profile-summary.json`: calibrated profile summary.
- `mismatch-taxonomy.json`: recurring ways the generated node flow diverged from real lab experience.

## Covered Labs

- `ARP_Attack`
- `LocalDNSAttack`
- `RemoteDNSAttack`
- `Sniffing_Spoofing`
- `TCP_Attacks`
- `VPN_Tunnel`

`RemoteDNSAttack` has lower calibration confidence than the other labs because
only draft notes were found alongside the `.tex` manual. Other labs have either
handwritten reports in `runs/mine/`, verified generated reports, or both.

## Calibration Principles

- Preserve real execution friction: interface discovery, cache flushing, route
  checks, Docker/compose quirks, baseline service checks, and repeated attempts.
- Treat negative results as teaching material, especially bailiwick rejection,
  invalid TUN writes, weak Python SYN flood pressure, and probabilistic DNS races.
- Bind each node to observable evidence such as ARP tables, cache dumps, tcpdump,
  ping sequence gaps, victim-side files, or route decisions.
- Keep generated and calibrated artifacts separate so future generator changes
  can be compared against the same manual review target.

## Reproduction

Generate first-pass profiles:

```sh
PYTHONPATH=src _local/socratic-smoke-venv/bin/python scripts/generate_manual_enhance_profiles.py --dotenv /path/to/your/DreamingRAG/.env --runs-root /path/to/your/SEEDRunner/runs --fast --skip-existing
```

Rebuild calibrated profiles from the curated curriculum source:

```sh
PYTHONPATH=src _local/socratic-smoke-venv/bin/python scripts/build_manual_enhance_calibrated_profiles.py
```

Validate artifacts:

```sh
PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_manual_enhance_profiles.py -q
```

Validate startup database seeding and built-in document/profile links:

```sh
PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_default_profile_seed.py -q
```
