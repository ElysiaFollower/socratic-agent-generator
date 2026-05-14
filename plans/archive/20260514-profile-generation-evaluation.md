# Profile Generation Quality Evaluation

## Goal

Create a lightweight, repeatable evaluation framework for generated profiles so
future generator prompt or multi-agent architecture changes can be compared
against calibrated SEED profiles before adding complexity.

## Scope

- Add a credential-free benchmark script that compares candidate generated
  profiles with the calibrated SEED profiles.
- Encode fixed rubrics for structure, persona, curriculum coverage, and known
  manual-calibration mismatch risks.
- Add tests for scoring and report generation.
- Document how to run and interpret the evaluation.
- Update harness evidence.

## Non-goals

- Change generator prompts or architecture.
- Call an LLM judge.
- Run a full Tutor conversation benchmark.
- Import external reports or runtime user data.

## Acceptance

- The benchmark can score all six existing generated profiles against calibrated
  profiles and produce JSON plus readable summary output.
- Scores include objective per-lab metrics and a repository-wide aggregate.
- Known mismatch categories from `docs/manual-enhance/mismatch-taxonomy.json`
  are checked as risk signals.
- Tests cover success and degraded profile cases.

## Validation

- `./scripts/harness-check.sh`
- `PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_profile_generation_eval.py -q`
- `python3 -m compileall scripts tests`
- `git diff --check`
