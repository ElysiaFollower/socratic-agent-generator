# Profile Management Document Identity UX

## Goal

Fix the Profile Management document selection problem so users can reliably
identify the intended lab manual before generating a profile.

## Scope

- Add a stable document identity payload for lab manuals.
- Fix persona/curriculum readiness display so built-in calibrated profiles count.
- Add Lab Manual display-name editing without changing storage paths or profile
  references.
- Add a lightweight read-only preview in Generate Profile selection.
- Update docs, harness status, and focused tests.

## Non-goals

- Redesign the profile generator architecture.
- Add a full document editor to Generate Profile.
- Import report corpora or runtime user data.
- Change Remote Runner or DreamingRAG behavior.

## Acceptance

- Lab Manuals and Generate Profile show the same document display name,
  filename, owner/source, upload time, size, references, and preview excerpt.
- Built-in profiles no longer show curriculum-only readiness when persona data
  exists on linked profiles.
- Lab Manual Management can edit a document display name.
- Delete semantics remain unlink-not-block.
- Validation evidence is recorded in harness files.

## Validation

- `./scripts/harness-check.sh`
- `PYTHONPATH=src _local/socratic-smoke-venv/bin/python -m pytest tests/test_default_profile_seed.py -q`
- `python3 -m compileall src tests`
- `cd frontend && npm test -- --run`
- `cd frontend && npm run build`
- `git diff --check`
