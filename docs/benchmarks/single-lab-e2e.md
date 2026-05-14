# Single Lab E2E Benchmark

This benchmark drives one representative Socratic lab flow through backend APIs.
The first target is the built-in Sniffing/Spoofing profile.

## Purpose

The script is designed to catch large regressions without manual clicking:

- student login
- built-in profile discovery
- session creation
- optional Remote Runner machine binding
- optional LabSetup upload and remote put
- one or more streamed Tutor turns
- final progress check
- remote command audit check
- step completion check

It does not store credentials in the repository. Provide live credentials through
environment variables or command line arguments.

## Command

```sh
SOCRATIC_BENCHMARK_PASSWORD="..." \
PYTHONPATH=src _local/socratic-smoke-venv/bin/python scripts/benchmarks/single_lab_e2e.py \
  --base-url http://10.203.15.128:8000 \
  --username demo \
  --profile-query Sniffing_Spoofing \
  --remote-machine seed-lab \
  --ensure-existing-remote-machine \
  --background-smoke-command pwd \
  --labsetup-file /Users/ely/workspace/research/agent/SEEDRunner/runs/Sniffing_Spoofing/Labsetup/docker-compose.yml \
  --remote-labsetup-path /home/seed/socratic-benchmark/Sniffing_Spoofing/Labsetup/docker-compose.yml
```

The command prints a JSON result. Success is `ok: true`; failure is `ok: false`
with a stage such as `login`, `profile`, `session`, `remote_setup`,
`conversation`, or `final_validation`.

## Environment Variables

- `SOCRATIC_BENCHMARK_BASE_URL`
- `SOCRATIC_BENCHMARK_USERNAME`
- `SOCRATIC_BENCHMARK_PASSWORD`
- `SOCRATIC_BENCHMARK_PROFILE`
- `SOCRATIC_BENCHMARK_REMOTE_MACHINE`
- `SOCRATIC_BENCHMARK_LABSETUP_FILE`
- `SOCRATIC_BENCHMARK_REMOTE_LABSETUP_PATH`
- `SOCRATIC_BENCHMARK_BACKGROUND_SMOKE_COMMAND`
- `SOCRATIC_BENCHMARK_BACKGROUND_WAIT_SECONDS`
- `SOCRATIC_BENCHMARK_TURNS_FILE`
- `SOCRATIC_BENCHMARK_MIN_REMOTE_AUDITS`

`SOCRATIC_BENCHMARK_TURNS_FILE` can be either a JSON list of student messages or
an object with a `turns` list.

## Current Limits

The backend currently exposes remote command audit records, but it does not yet
expose a first-class RAG retrieval audit. This benchmark therefore checks
conversation completion and Remote Runner evidence directly, while RAG-specific
coverage remains indirect until a retrieval audit API exists.
