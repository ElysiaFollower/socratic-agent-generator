# Profile Generation Evaluation

This benchmark is the first quality gate for profile generator changes. It does
not call an LLM and does not need provider credentials. The intent is to catch
obvious regressions before trying more expensive LLM-as-judge or full Tutor
conversation tests.

## Command

```bash
python3 scripts/benchmarks/profile_generation_eval.py
```

The default comparison is:

- Candidate profiles: `docs/manual-enhance/generated/*/profile.json`
- Reference profiles: `docs/manual-enhance/calibrated/*/profile.json`
- Risk taxonomy: `docs/manual-enhance/mismatch-taxonomy.json`

To save a machine-readable report:

```bash
python3 scripts/benchmarks/profile_generation_eval.py \
  --output _local/profile-generation-eval.json
```

Use `--json` to print the full JSON report.

## Metrics

- `structure`: required profile fields and required curriculum step fields.
- `persona`: persona hints, target audience, and prompt template presence.
- `curriculum_alignment`: token overlap from each calibrated step to its best
  matching candidate step, plus step-count balance.
- `risk_coverage`: fixed probes for the mismatch taxonomy collected during
  manual calibration.

The aggregate score is weighted:

- 25% structure
- 15% persona
- 35% curriculum alignment
- 25% risk coverage

Status thresholds:

- `pass`: score >= 0.75
- `warn`: score >= 0.55 and < 0.75
- `fail`: score < 0.55

## Current Baseline

Against the repository's initial generated drafts and manually calibrated
profiles, the benchmark currently reports:

```text
profile_generation_eval score=0.7343 status=warn labs=6 pass=2 warn=4 fail=0
```

This is expected: the benchmark is comparing first-pass generated drafts against
human-calibrated profiles, so it should reveal the quality gap rather than pass
everything. Future generator changes should be compared against this baseline
and should explain any metric movement.

## Boundaries

This benchmark is a static gate. It does not prove the Tutor can complete a live
session, retrieve lab manuals, or use Remote Runner. Use
`scripts/benchmarks/single_lab_e2e.py` for backend-driven end-to-end checks.
