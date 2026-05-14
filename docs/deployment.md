# Official Deployment Guide

This is the maintained deployment path for Socratic Agent Generator. The default deployment includes DreamingRAG memory support.

## Deployment Profile

- Backend: Python 3.10+ with FastAPI, LangChain, SQLite, and DreamingRAG.
- Frontend: Node.js 18+ with React, TypeScript, and Vite.
- Memory: DreamingRAG installed in the same backend Python environment.
- Embeddings: Socratic document RAG and DreamingRAG memory both use Volcengine Ark by default.
- Storage: local SQLite and file-system data under `data/`.
- Built-in labs: the six calibrated SEED profiles ship with versioned `.tex` lab manuals and are seeded into SQLite as public profiles linked to built-in document records.

DreamingRAG is installed by default because `DREAMINGRAG_MEMORY_ENABLED=true` is the default runtime configuration. If DreamingRAG is unavailable, the backend falls back to null memory, but that fallback is for resilience rather than the intended deployment state.

## Repository Layout

Keep Socratic and DreamingRAG as sibling repositories. This matches the default `DREAMINGRAG_REPO_PATH` behavior and keeps the projects independently maintainable.

```text
workspace/
  DreamingRAG/
  socratic-agent-generator/
```

Clone both repositories:

```bash
mkdir -p workspace
cd workspace
git clone git@github.com:ElysiaFollower/DreamingRAG.git
git clone git@github.com:ElysiaFollower/socratic-agent-generator.git
cd socratic-agent-generator
```

## Backend Install

Use Python 3.10+ for the default deployment because DreamingRAG declares `python_requires=">=3.10"`.

```bash
conda create -n SocraticAgent python=3.10 -y
conda activate SocraticAgent
python -m pip install --upgrade pip
pip install -r requirements.txt
pip install -e ../DreamingRAG
```

The editable DreamingRAG install provides the `dreaming_rag.public_api` package and installs DreamingRAG's own dependencies. The Socratic adapter still accepts `DREAMINGRAG_REPO_PATH` so a deployment can point at an explicit DreamingRAG checkout.

## Frontend Install

```bash
cd frontend
npm ci
cd ..
```

## Environment Configuration

Create `.env` from the template:

```bash
cp .env.example .env
```

Required Socratic settings:

```bash
JWT_SECRET_KEY="replace_with_a_random_secret"
ADMIN_TOKEN="replace_with_admin_registration_token"
DEFAULT_LLM_PROVIDER="deepseek"
DEEPSEEK_API_KEY="replace_with_deepseek_key"
```

Default DreamingRAG settings:

```bash
DREAMINGRAG_MEMORY_ENABLED="true"
DREAMINGRAG_REPO_PATH="/absolute/path/to/workspace/DreamingRAG"
DREAMINGRAG_MEMORY_MOCK_MODE="false"
DREAMINGRAG_MEMORY_ENABLE_CUE_RECALL="true"
DREAMINGRAG_MEMORY_TOP_N=3
DREAMINGRAG_MEMORY_CONTEXT_CHARS=2000
```

Socratic document RAG and DreamingRAG real mode share the same embedding provider. The default hosted route is Volcengine Ark:

```bash
EMBEDDING_PROVIDER="volcengine"
VOLCENGINE_API_KEY="replace_with_volcengine_key"
VOLCENGINE_EMBEDDING_MODEL="doubao-embedding-text-240515"
VOLCENGINE_EMBEDDING_BASE_URL="https://ark.cn-beijing.volces.com/api/v3"
EMBEDDING_REQUEST_TIMEOUT=60
```

HuggingFace is now an explicit Socratic fallback only:

```bash
EMBEDDING_PROVIDER="huggingface"
HUGGINGFACE_EMBEDDING_MODEL="sentence-transformers/all-MiniLM-L6-v2"
HF_MODELS_DIR="models"
```

Do not use HuggingFace for the default deployment. Hosts without HuggingFace access should still start normally when Volcengine is configured.

Remote Runner is optional but supported for session-bound lab machine tools. Install it in the same conda environment, then point Socratic at the checkout or installed package:

```bash
pip install -e ../SEEDRunner

# Generate before enabling password-based remote machine settings:
# python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'

REMOTE_TOOL_ENABLED="true"
REMOTE_RUNNER_REPO_PATH="/absolute/path/to/workspace/SEEDRunner"
REMOTE_RUNNER_PYTHON_EXECUTABLE="/absolute/path/to/conda/env/bin/python"
REMOTE_RUNNER_STATE_DIR=""
REMOTE_MACHINE_SECRET_KEY="replace_with_generated_fernet_key"
REMOTE_TOOL_COMMAND_TIMEOUT=20
REMOTE_TOOL_AGENT_IDLE_TIMEOUT=15
REMOTE_TOOL_OUTPUT_CHARS=4000
REMOTE_TOOL_ALLOWED_MACHINE_IDS=""
REMOTE_TOOL_ALLOWED_COMMANDS="pwd,ls,ls -la,whoami,hostname,uname -a,id,ip addr,ip route,ifconfig,cat /etc/os-release,python --version,python3 --version"
REMOTE_TOOL_ALLOWED_COMMAND_PREFIXES="ls ,cat ,ip ,docker ps,docker exec,docker network inspect,docker compose ps,python ,python3 ,ping "
REMOTE_TOOL_ALLOWED_CWD_PREFIXES=""
```

Users configure lab machines from Settings. A learning session only gets the Remote Runner tool when it has a selected machine. Users can select a machine during session creation or switch/detach the current session's machine from the session header. The Tutor receives the current fixed machine/session binding and cannot switch to a different machine by prompt.

`REMOTE_RUNNER_PYTHON_EXECUTABLE` is optional when Remote Runner is installed in the same conda environment as Socratic. Set it when Socratic and Remote Runner are maintained in separate conda environments.

`REMOTE_MACHINE_SECRET_KEY` must be a valid Fernet key before users save password-based remote machines. If the key is missing or invalid, Socratic refuses to store or use remote passwords instead of falling back to plaintext. Key-based and existing Remote Runner machine entries do not require a stored password.

Remote command policy is fail-closed: if both `REMOTE_TOOL_ALLOWED_COMMANDS` and `REMOTE_TOOL_ALLOWED_COMMAND_PREFIXES` are empty, Tutor command execution is denied. Add exact commands or narrow prefixes deliberately, then restart the backend.

Tutor remote command tools intentionally separate command lifecycles:

- `run_remote_command`: short bounded diagnostics, backed by `session exec --mode wait`.
- `start_remote_command`: long-running work such as packet capture, servers, or long builds, backed by `session exec --mode background`.
- `wait_remote_command`: wait for an existing command for an explicit short timeout.
- `get_remote_command_result`, `list_remote_commands`, and `stop_remote_command`: inspect or control previous commands.

Do not increase `REMOTE_TOOL_COMMAND_TIMEOUT` to cover long-running lab work. Use background commands so a student turn is not blocked for minutes.

Session-scoped LabSetup files are stored under `data/session_files` and capped by `SESSION_FILE_MAX_BYTES` (default 20 MiB). A user can upload files to one session, transfer them to that session's bound lab machine, and then ask the Tutor or debug API to run setup commands such as Docker Compose. Do not commit this cache directory.

## Smoke Checks

Run the cheap repository checks:

```bash
./scripts/harness-check.sh
python3 -m compileall src tests
```

Check that Socratic can load DreamingRAG's public API through the installed package:

```bash
python - <<'PY'
from tempfile import TemporaryDirectory
from dreaming_rag.public_api import DreamingRAGMemory, MemoryAPIConfig

with TemporaryDirectory() as temp_dir:
    memory = DreamingRAGMemory(MemoryAPIConfig(storage_path=temp_dir, mock_mode=True))
    memory.remember("deployment smoke: user prefers step-by-step hints")
    recall = memory.recall("step-by-step hints", top_n=1)
    print("dreamingrag_public_api_ready=", bool(recall.memories))
    memory.close()
PY
```

Check the Socratic adapter path:

```bash
PYTHONPATH=src python - <<'PY'
from pathlib import Path
from tempfile import TemporaryDirectory
from utils.memory_provider import DreamingRAGMemoryProvider, MemoryProviderContext

with TemporaryDirectory() as temp_dir:
    provider = DreamingRAGMemoryProvider(
        MemoryProviderContext(user_id="deploy-smoke", session_id="memory", profile_id="p", topic_name="TCP"),
        storage_root=Path(temp_dir),
        mock_mode=True,
    )
    provider.record_turn("I need hints about TCP SYN queues.", "Start by checking the SYN backlog.")
    context = provider.recall_context("TCP SYN queue hints")
    print("socratic_dreamingrag_context_ready=", bool(context.strip()))
    provider.close()
PY
```

Mock mode is used for smoke checks so they do not consume provider API credits. Production should use `DREAMINGRAG_MEMORY_MOCK_MODE="false"`. The Socratic document RAG path still uses the shared Volcengine embedding provider in both smoke and production modes.

Check that the default SEED lab profiles and their lab manual document links seed correctly:

```bash
PYTHONPATH=src python - <<'PY'
from core.database import SessionLocal
from models.profile import ProfileModel

with SessionLocal() as db:
    profiles = db.query(ProfileModel).filter(ProfileModel.owner_id.is_(None)).all()
    print("builtin_profiles=", len(profiles))
    print("document_links_ready=", all(profile.document_id for profile in profiles))
PY
```

If Remote Runner is enabled, check the target lab machine before using it in Socratic:

```bash
remote-runner machine doctor <machine-id> --json
```

Then use Settings to add an "existing runner machine" with the same machine id, test it, create a learning session with that machine selected, and verify `/api/sessions/{session_id}/remote-audits` records sanitized command evidence after the Tutor uses the remote tool.

For backend-only debugging, use the session APIs that mirror the frontend/Tutor path:

- `GET /api/sessions/{session_id}/files`
- `POST /api/sessions/{session_id}/files`
- `POST /api/sessions/{session_id}/files/{filename}/remote-put`
- `PUT /api/sessions/{session_id}/remote-binding`
- `POST /api/sessions/{session_id}/remote-command`

`remote-command` defaults to the old synchronous action when no action is supplied. For background debugging, send `action` values such as `session_exec_background`, `session_command_result`, `session_command_wait`, or `session_command_stop`; include `command_id` for command inspection actions and `wait_timeout_seconds` for bounded waits.

For the SEED Sniffing/Spoofing demo, prefer uploading the known LabSetup `docker-compose.yml` and creating the empty `volumes` directory on the remote machine. That LabSetup is small enough that cloning the full SEED Labs repository on the lab host is unnecessary.

## Start Services

Terminal 1:

```bash
conda activate SocraticAgent
python src/app.py
```

Terminal 2:

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`. The backend API docs are available at `http://localhost:8000/docs`.

## Operational Notes

- SQLite and runtime files are created under `data/`.
- The six built-in SEED lab manuals are versioned under `docs/manual-enhance/calibrated/*/lab_manual.tex`. Runtime vector indexes for them are created under `data/vector_stores/builtin/`.
- Deleting a lab manual from the UI removes the document record and vector index, and unlinks profiles that referenced it. The profiles remain visible but show an invalid/unlinked document reference until a document is restored or the profile is regenerated.
- DreamingRAG memory storage is under `data/dreamingrag_memory/`.
- Remote machine settings and session bindings are stored in SQLite. API responses never return passwords or private key contents. Remote command evidence is stored as sanitized excerpts in `remote_command_audits`.
- Do not commit `.env`, SQLite databases, memory stores, vector indexes, logs, or provider keys.
- Admin registration requires `ADMIN_TOKEN` to be configured before the backend starts.
- User-configured LLM keys in the Settings panel override global `.env` provider presets.

## Troubleshooting

- `No module named 'dreaming_rag'`: run `pip install -e ../DreamingRAG` in the backend environment, or set `DREAMINGRAG_REPO_PATH` to the correct checkout.
- `No module named 'openai'`, `pandas`, or `networkx`: DreamingRAG dependencies are missing; rerun `pip install -e ../DreamingRAG`.
- No long-term memory context appears: confirm `DREAMINGRAG_MEMORY_ENABLED="true"` and run the Socratic adapter smoke check above.
- Real mode fails on embeddings: confirm `EMBEDDING_PROVIDER="volcengine"`, `VOLCENGINE_API_KEY`, `VOLCENGINE_EMBEDDING_MODEL`, and `VOLCENGINE_EMBEDDING_BASE_URL`.
- Backend tries to download from HuggingFace: check that `EMBEDDING_PROVIDER` was not set to `huggingface`.
- Need an offline memory-only demo: set `DREAMINGRAG_MEMORY_MOCK_MODE="true"` temporarily, then switch it back to `false` for real memory behavior.
- Remote machine test fails: first run `remote-runner machine doctor <machine-id> --json`; do not debug with raw SSH unless you are changing Remote Runner itself.
- Tutor cannot execute a lab command: confirm the command policy is not empty, then add the exact command or a narrow prefix to `REMOTE_TOOL_ALLOWED_COMMANDS` or `REMOTE_TOOL_ALLOWED_COMMAND_PREFIXES` and restart the backend.
- Password-based remote machine save fails: set `REMOTE_MACHINE_SECRET_KEY` to a valid Fernet key and restart the backend; Socratic will not store remote passwords in plaintext.
- A long-running Tutor tool appears to hang: use `start_remote_command` plus `wait_remote_command`/`get_remote_command_result` instead of increasing the synchronous command timeout.

## Maintenance Contract

Maintain this document whenever any of the following change:

- `src/utils/memory_provider.py`
- `src/config.py` DreamingRAG settings
- `.env.example`
- DreamingRAG `dreaming_rag.public_api`
- DreamingRAG `setup.py` or dependency requirements
- Backend Python version support
- Remote Runner settings, command policy, or session binding behavior
- Startup commands or frontend dependency workflow

Deployment instructions are part of the repo harness. If they drift, update this document, README links, and `harness/quality.md` in the same task.
