# Remote Runner Session Tools

## Purpose

This document defines the product and architecture boundary for turning the existing Remote Runner prototype into a real Socratic tutor capability.

The target behavior is session-scoped lab assistance: a student configures a lab machine, selects it when creating a learning session, and the tutor can use Remote Runner only for that selected machine during that session.

A second target behavior is session-scoped lab setup assistance. A session can own uploaded files, such as `docker-compose.yml`, helper scripts, or small LabSetup artifacts. The backend can then transfer those files to the session-bound lab machine and run controlled setup commands, so the student can complete environment preparation through Socratic instead of directly operating the remote host.

Product alignment is defined by `docs/product/vision.md`: Remote Runner reduces lab friction and makes learning evidence real, but it must not turn the tutor into an automatic lab executor. The tutor remains responsible for converting command output into the current learning question, student reasoning, and report-ready evidence.

## Current State

The merged vNext prototype already contains:

- A CLI-backed `RemoteRunnerProvider` in `src/utils/remote_runner_provider.py`.
- A LangChain tool wrapper named `observe_remote_environment` in `src/utils/remote_tool_skill.py`.
- Tutor injection in `src/utils/tutor_core.py` when `REMOTE_TOOL_ENABLED=true`.
- Optional deployment-level command policy configuration in `src/config.py`.
- Focused tests in `tests/test_remote_runner_provider.py`.

The missing product path is:

- Per-user lab machine settings are now represented by `UserRemoteMachineModel`.
- Session creation can carry an optional remote machine id and creates `SessionRemoteBindingModel`.
- Command evidence is recorded as sanitized `RemoteCommandAuditModel` rows.
- Session files are cached under a server-owned per-session directory and can be transferred into the bound Remote Runner session.
- Backend debug APIs now exercise the same binding, file-transfer, optional command policy, and audit path used by the Tutor and frontend.
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
  - `runner_session_id` or derived `terminal_id` in read APIs.
  - `command`, `cwd`, `exit_code`, `duration_ms`.
  - `stdout_excerpt`, `stderr_excerpt`.
  - `redaction_applied`.
  - `created_at`.

- `SessionFile`
  - MVP storage is filesystem-backed rather than a database table.
  - Keyed by `owner_id` and `session_id`.
  - Stores sanitized filenames, file size, and upload timestamp.
  - Files are deleted with the owning session and are never included in exported examples unless explicitly curated.

Secrets must follow a fail-closed posture: password-based remote machine
entries require a valid Fernet `REMOTE_MACHINE_SECRET_KEY`; if the key is
missing or invalid, Socratic refuses to store or use the password instead of
falling back to plaintext. Secrets are never returned by read APIs and never
included in LLM context.

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
- `PUT /api/sessions/{session_id}/remote-binding` to bind, switch, or detach the session's lab machine after creation.
- `GET /api/sessions/{session_id}/remote-audits`
- `GET /api/sessions/{session_id}/files`
- `POST /api/sessions/{session_id}/files`
- `POST /api/sessions/{session_id}/files/{filename}/remote-put`
- `POST /api/sessions/{session_id}/remote-command`

The file, binding, audit, and command routes are intentionally useful for both frontend implementation and backend-only debugging. They must call the same managers and policy checks used by the Tutor tool rather than a separate maintenance backdoor.

Tutor runtime:

- The Tutor should load the current session's `SessionRemoteBinding`.
- If no binding exists, the Remote Runner tool is not exposed.
- If a binding exists, the provider must ignore or reject any LLM-supplied machine that does not match the binding.

## Tool Boundary

The tutor-facing tool should not expose raw SSH or credential concepts, but it
also should not over-specialize remote execution into lab-specific teaching
verbs. Remote tools are infrastructure: they connect to the bound machine, run
commands, manage command lifecycle, and return structured observations. The
model and the profile decide what command is pedagogically appropriate.

The stable tool surface should therefore stay general:

- `check_remote_connection`
- `run_remote_command`
- `start_remote_command`
- `wait_remote_command`
- `get_remote_command_result`
- `list_remote_commands`
- `stop_remote_command`

Lab-specific prompt guidance can still say when a command is useful, but the
tool implementation should remain a general feedback channel rather than a
collection of narrow teaching actions such as "collect report evidence" or
"diagnose this specific lab." That keeps the capability flexible while command
optional deployment policy, session binding, audit, and output redaction provide
the safety boundary.

The runtime teaching boundary is stricter than the tool boundary: after a command
returns, Tutor must explain why the observation matters for the current step,
ask the student to make or refine a judgment, or connect the evidence to the
student's answer. Repeated command execution without this conversion is a product
failure even if the tool calls themselves succeed.

Tutor should prefer simple, readable command observations when that helps the
student connect one result to one concept. That preference is a teaching style,
not a Socratic adapter restriction. Remote Runner owns shell execution semantics:
`id && whoami`, pipes, redirection, and other shell expressions are valid
`session exec --cmd` strings when the deployment policy allows them. Socratic
must not re-parse shell syntax or apply inconsistent prefix heuristics that
change what Remote Runner would execute.

Because the upstream shell is persistent and session-like, Socratic also
serializes tutor command execution per `runner_session_id` inside the backend
process. This reduces accidental parallel tool calls that compete for the same
terminal and produce `Session is busy`; long-running work should still use
`start_remote_command` followed by explicit result/wait/stop tools.

### Command Interaction Modes

The tutor-facing contract must keep short observations distinct from long-running
lab work:

- `run_and_wait`: execute a bounded command and return stdout/stderr/exit code.
- `run_background`: start a persistent command, return a command/run id
  immediately, and do not block the student turn.
- `get_command_result`: fetch the current status and accumulated output for a
  previous background command.
- `wait_command`: wait for a previous command for an explicit short timeout,
  returning a timeout status without killing the command when it is still
  running.
- `stop_command`: stop a previous background command when the student or tutor
  no longer needs it.

Remote Runner now exposes this split directly:

- `session exec --mode wait --timeout <seconds>`
- `session exec --mode background --timeout <seconds>`
- `session command list/show/result/wait/stop`

Socratic should keep the synchronous timeout short for interactive diagnostics
such as `pwd`, `docker ps`, and `ip addr`. Packet captures, foreground servers,
long builds, or commands where the useful interaction is "start now, inspect
later" should use the background command lifecycle instead of a long blocking
tool call.

## Adapter Boundary And Command Policy

The default Socratic behavior is a thin adapter: forward the command string to
Remote Runner, preserve Remote Runner's structured result, and record a
sanitized audit entry. Socratic does not own shell parsing. It does own the
application boundary:

- Bound machine only.
- Bound Remote Runner session only.
- Timeout for every command.
- Output length limit.
- Secret and local-path redaction.
- Audit record for every attempted command.
- Clear user-facing error when the remote session is busy, unavailable, or
  explicitly blocked by deployment policy.

`REMOTE_TOOL_COMMAND_POLICY` controls the optional deployment-level command
policy:

- `passthrough` (default): do not reinterpret the command string; Remote Runner
  is the execution boundary.
- `allowlist`: use `REMOTE_TOOL_ALLOWED_COMMANDS` and
  `REMOTE_TOOL_ALLOWED_COMMAND_PREFIXES` as a strict compatibility policy.
- `deny_all`: disable tutor/Shell command execution while keeping machine
  connection checks and non-command actions available.

For the current self-use SEED lab deployment, `passthrough` better matches the
product goal: the student explicitly binds a lab machine to the session, and the
Tutor should use Remote Runner as the real shell evidence channel. More locked
down institutional deployments can opt into `allowlist` or `deny_all` without
changing tutor code.

Setup commands still need the same session binding, audit, redaction, timeout
and optional policy controls. For Sniffing/Spoofing, the expected setup is small:
create a LabSetup directory, upload the known `docker-compose.yml`, create the
empty `volumes` directory, and run Docker Compose in that directory. The system
should not require cloning the whole SEED Labs repository for this case.

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
- A session may bind, switch, or detach its lab machine through the session
  header control. Switching must recreate the underlying Remote Runner session
  and preserve the Socratic permission boundary: Tutor can only use the machine
  currently bound to that learning session.

The session Shell panel should use a terminal-tab model:

- A tab represents a Remote Runner shell/session, usually grouped by
  `runner_session_id`.
- A tab does not represent a single command. Single commands are transcript
  entries inside the selected terminal.
- The primary transcript should come from Remote Runner `session read`, because
  Remote Runner `session exec` now runs inside a persistent session shell and
  preserves shell-local state such as `cd`, exported variables, aliases, and
  shell functions.
- Socratic audit records remain useful fallback and structured evidence, but
  they should not replace the persistent shell transcript when `session read` is
  available.
- Student-entered commands should use `session exec` rather than raw `session
  send` by default. That keeps command boundaries, stdout/stderr, exit code,
  timeout, optional deployment policy, redaction, and audit intact.
- Raw `session send/read` is a lower-level capability for future interactive
  flows. It must not become a policy bypass.
- The user-facing name is simply Shell. Audit records are implementation
  evidence, but the interface should look and read like a terminal, not a
  generic evidence text box.
- The panel should be horizontally resizable on desktop, keep a stable mobile
  full-width fallback, render transcript content with terminal-style contrast
  and monospace layout, and show explicit shell state such as connected,
  running, closed, or error.
- Raw Remote Runner JSON observations must not leak into ordinary chat text.
  If a tool-heavy turn needs a fallback teaching reply, the backend should
  summarize the observation into a short student-readable Shell result summary
  and then return to the current learning question.

## Acceptance Demo

The required final proof is a real `demo` student session:

- User: `demo`.
- Machine: local Remote Runner config named `seed-lab`.
- Recommended lab: SEED Sniffing and Spoofing Lab.
- LabSetup reference: `https://github.com/seed-labs/seed-labs/tree/master/category-network/Sniffing_Spoofing/Labsetup`.
- The conversation must complete every curriculum step.
- The tutor must execute commands through Remote Runner, collect results, explain at least one output, and help with at least one point of student uncertainty or failure.
- The exported session artifact must be credential-free and include enough command/result evidence to support a lab report.
- The conversation must show learning, not only completion: student messages should contain real judgments, explanations, pseudo-code, or evidence interpretation; Tutor responses should not be dominated by "let me check" tool loops.
- A benchmark or demo that reaches `isFinished=true` while the student mostly watches the tutor operate the machine is not sufficient evidence of product success.

## Deployment Notes

The official deployment path should remain conda-based. Remote Runner setup must be documented as an optional but supported capability:

- Install or expose the Remote Runner package/CLI.
- Configure the Socratic environment with the Remote Runner repository/package path if needed.
- Configure a valid Fernet `REMOTE_MACHINE_SECRET_KEY` before allowing password-based remote credentials.
- Choose a command policy. The default is `REMOTE_TOOL_COMMAND_POLICY=passthrough`;
  stricter deployments can set `allowlist` or `deny_all`.
- Keep per-user credentials out of `.env.example`, git, logs, and exported examples.
- Run a smoke test against a configured machine.

## Open Risks

- Remote Runner's background command lifecycle is available, but Socratic must keep tool prompts and tests aligned with that CLI as it evolves.
- Running real packet labs may require root privileges, Docker access, privileged containers, or network capabilities that differ between machines.
- Tutor command use can drift from Socratic guidance into direct solution automation. The prompt, profiles, benchmark, and optional deployment policy must keep the tutor focused on observation, explanation, debugging, and evidence collection.
- Fully interactive terminal programs may still need additional frontend rendering and input handling beyond the current command input box; raw `session send` should be introduced only with explicit policy and audit decisions.
