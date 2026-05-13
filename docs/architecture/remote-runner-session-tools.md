# Remote Runner Session Tools

## Purpose

This document defines the product and architecture boundary for turning the existing Remote Runner prototype into a real Socratic tutor capability.

The target behavior is session-scoped lab assistance: a student configures a lab machine, selects it when creating a learning session, and the tutor can use Remote Runner only for that selected machine during that session.

A second target behavior is session-scoped lab setup assistance. A session can own uploaded files, such as `docker-compose.yml`, helper scripts, or small LabSetup artifacts. The backend can then transfer those files to the session-bound lab machine and run controlled setup commands, so the student can complete environment preparation through Socratic instead of directly operating the remote host.

## Current State

The merged vNext prototype already contains:

- A CLI-backed `RemoteRunnerProvider` in `src/utils/remote_runner_provider.py`.
- A LangChain tool wrapper named `observe_remote_environment` in `src/utils/remote_tool_skill.py`.
- Tutor injection in `src/utils/tutor_core.py` when `REMOTE_TOOL_ENABLED=true`.
- Global allowlist configuration in `src/config.py`.
- Focused tests in `tests/test_remote_runner_provider.py`.

The missing product path is:

- Per-user lab machine settings are now represented by `UserRemoteMachineModel`.
- Session creation can carry an optional remote machine id and creates `SessionRemoteBindingModel`.
- Command evidence is recorded as sanitized `RemoteCommandAuditModel` rows.
- Session files are cached under a server-owned per-session directory and can be transferred into the bound Remote Runner session.
- Backend debug APIs now exercise the same binding, file-transfer, command-policy, and audit path used by the Tutor and frontend.
- The remaining validation work is proving the full real-lab conversation path against `seed-lab`.

## Target User Flow

1. A user opens Settings and adds a lab machine.
2. The user provides a display name, Remote Runner machine name, host, port, username, and one authentication method.
3. The backend stores credentials without returning secrets to the frontend.
4. The user tests the connection.
5. When creating a learning session, the user chooses one of their configured machines or chooses no machine.
6. If a machine is selected, the backend creates or resolves a Remote Runner session for that machine and stores a Socratic session binding.
7. During the conversation, Tutor receives a Remote Runner skill bound to that session binding.
8. Tutor can execute permitted diagnostic or lab commands, read sanitized output, and use that evidence to guide the student.
9. The session history or a related audit view preserves enough command/result summaries to support a later report.
10. If the lab needs setup files, the user uploads them to the session cache; Socratic transfers them to the bound remote session and runs the controlled setup commands.

## Data Model Sketch

Expected persistent objects:

- `UserRemoteMachine`
  - `machine_id`: Socratic-owned id.
  - `owner_id`: user id.
  - `display_name`: UI label.
  - `runner_machine_name`: name used by Remote Runner.
  - `host`, `port`, `username`: connection target.
  - `auth_type`: `existing`, `password`, or `key`.
  - `encrypted_password`: nullable secret field for password auth.
  - `key_path`: path to a private key already available to the backend host for key auth.
  - `key_passphrase`: optional encrypted secret if supported.
  - `default_cwd`: optional.
  - `status`, `last_checked_at`, `create_at`, `update_at`.

- `SessionRemoteBinding`
  - `binding_id`.
  - `session_id`.
  - `owner_id`.
  - `user_machine_id`.
  - `runner_machine_name`.
  - `runner_session_id`.
  - `status`.
  - `last_error`.
  - `create_at`, `update_at`.

- `RemoteCommandAudit`
  - `audit_id`.
  - `session_id`.
  - `owner_id`.
  - `binding_id`.
  - `command`, `cwd`, `exit_code`, `duration_ms`.
  - `stdout_excerpt`, `stderr_excerpt`.
  - `redaction_applied`.
  - `created_at`.

- `SessionFile`
  - MVP storage is filesystem-backed rather than a database table.
  - Keyed by `owner_id` and `session_id`.
  - Stores sanitized filenames, file size, and upload timestamp.
  - Files are deleted with the owning session and are never included in exported examples unless explicitly curated.

Secrets must follow the same operational posture as LLM API keys: encrypted when an encryption key is configured, never returned by read APIs, and never included in LLM context.

## API Sketch

Settings:

- `GET /api/settings/remote-machines`
- `POST /api/settings/remote-machines`
- `PUT /api/settings/remote-machines/{machine_id}`
- `DELETE /api/settings/remote-machines/{machine_id}`
- `POST /api/settings/remote-machines/{machine_id}/test`

Sessions:

- Extend `POST /api/sessions/create` with optional `remote_machine_id`.
- Extend session detail/summary with a non-secret `remote_binding` summary.
- `GET /api/sessions/{session_id}/remote-audits`
- `GET /api/sessions/{session_id}/files`
- `POST /api/sessions/{session_id}/files`
- `POST /api/sessions/{session_id}/files/{filename}/remote-put`
- `POST /api/sessions/{session_id}/remote-command`

The last four routes are intentionally useful for both frontend implementation and backend-only debugging. They must call the same managers and policy checks used by the Tutor tool rather than a separate maintenance backdoor.

Tutor runtime:

- The Tutor should load the current session's `SessionRemoteBinding`.
- If no binding exists, the Remote Runner tool is not exposed.
- If a binding exists, the provider must ignore or reject any LLM-supplied machine that does not match the binding.

## Tool Boundary

The tutor-facing tool should not expose raw SSH or credential concepts. It should expose lab-oriented actions such as:

- `check_connection`
- `run_command`
- `read_file_excerpt`
- `list_directory`
- `collect_report_evidence`

The MVP tool exposes `check_connection` and `run_command`; richer lab-oriented aliases can be added once the end-to-end command evidence path is stable.

The implementation may map these actions to Remote Runner CLI calls internally. The LLM should see only sanitized command results and stable error messages.

## Command Policy

The first implementation should support a profile/session-scoped command policy rather than arbitrary shell execution.

Required controls:

- Bound machine only.
- Bound Remote Runner session only.
- Timeout for every command.
- Output length limit.
- Secret and local-path redaction.
- Audit record for every attempted command.
- Clear user-facing error when a command is blocked.

For the SEED Sniffing/Spoofing acceptance run, the command policy will likely need read-only diagnostics plus controlled lab commands such as checking interfaces, container status, routing, permissions, and packet capture outputs. The exact allowlist should be finalized after inspecting the Remote Runner CLI and the lab environment.

Setup commands still need policy. For Sniffing/Spoofing, the expected setup is small: create a LabSetup directory, upload the known `docker-compose.yml`, create the empty `volumes` directory, and run Docker Compose in that directory. The system should not require cloning the whole SEED Labs repository for this case.

## Session File And LabSetup Handling

Session files are a narrow cache for artifacts the student wants the Tutor/system to use inside that session. This is not a general file manager.

Required constraints:

- Files belong to one owner and one session.
- Filenames are sanitized and path traversal is rejected.
- File size is capped by `SESSION_FILE_MAX_BYTES`.
- Uploading to a remote machine requires an active `SessionRemoteBinding`.
- Remote transfer is audited as `file_put`.
- Cleanup happens when the session is deleted.

For the Sniffing/Spoofing demo, the LabSetup can be assembled from the locally available SEEDRunner run artifact:

- `Sniffing_Spoofing/Labsetup/docker-compose.yml`
- empty `Sniffing_Spoofing/Labsetup/volumes/`

The product lesson is broader than this one lab: future profiles should be able to reference required setup artifacts as metadata, and session creation can offer to attach or stage those artifacts automatically.

## Frontend Shape

Settings should gain a Remote Machines tab:

- Table/list of configured machines.
- Add/edit form with display name, machine name, host, port, username, auth type, credential input, and default cwd.
- Test connection button.
- Delete action.
- Status chips for configured/tested/error.

Session creation should include an optional machine selector:

- Default: no remote machine.
- If selected: show connection status and the machine display name.
- Once a session is created, the binding is immutable for that session in the MVP.

## Acceptance Demo

The required final proof is a real `demo` student session:

- User: `demo`.
- Machine: local Remote Runner config named `seed-lab`.
- Recommended lab: SEED Sniffing and Spoofing Lab.
- LabSetup reference: `https://github.com/seed-labs/seed-labs/tree/master/category-network/Sniffing_Spoofing/Labsetup`.
- The conversation must complete every curriculum step.
- The tutor must execute commands through Remote Runner, collect results, explain at least one output, and help with at least one point of student uncertainty or failure.
- The exported session artifact must be credential-free and include enough command/result evidence to support a lab report.

## Deployment Notes

The official deployment path should remain conda-based. Remote Runner setup must be documented as an optional but supported capability:

- Install or expose the Remote Runner package/CLI.
- Configure the Socratic environment with the Remote Runner repository/package path if needed.
- Configure encryption for stored remote credentials.
- Keep per-user credentials out of `.env.example`, git, logs, and exported examples.
- Run a smoke test against a configured machine.

## Open Risks

- The current Remote Runner CLI surface may not yet expose every operation needed for machine upsert or credential management from Socratic.
- Running real packet labs may require root privileges, Docker access, privileged containers, or network capabilities that differ between machines.
- Tutor command use can drift from Socratic guidance into direct solution automation. The prompt and command policy must keep the tutor focused on observation, explanation, debugging, and evidence collection.
- Long-running packet capture or interactive tools may need a separate job model instead of synchronous `session_exec`.
