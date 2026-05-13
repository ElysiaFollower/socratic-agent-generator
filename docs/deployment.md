# Official Deployment Guide

This is the maintained deployment path for Socratic Agent Generator. The default deployment includes DreamingRAG memory support.

## Deployment Profile

- Backend: Python 3.10+ with FastAPI, LangChain, SQLite, and DreamingRAG.
- Frontend: Node.js 18+ with React, TypeScript, and Vite.
- Memory: DreamingRAG installed in the same backend Python environment.
- Embeddings: Socratic document RAG and DreamingRAG memory both use Volcengine Ark by default.
- Storage: local SQLite and file-system data under `data/`.

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
- DreamingRAG memory storage is under `data/dreamingrag_memory/`.
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

## Maintenance Contract

Maintain this document whenever any of the following change:

- `src/utils/memory_provider.py`
- `src/config.py` DreamingRAG settings
- `.env.example`
- DreamingRAG `dreaming_rag.public_api`
- DreamingRAG `setup.py` or dependency requirements
- Backend Python version support
- Startup commands or frontend dependency workflow

Deployment instructions are part of the repo harness. If they drift, update this document, README links, and `harness/quality.md` in the same task.
