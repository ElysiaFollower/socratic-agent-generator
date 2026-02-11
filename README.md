# Socratic Agent Generator

> [中文版本](docs/README.zh.md)

An intelligent tutoring system based on the Socratic method that automatically converts technical lab manuals into personalized AI tutors, providing progressive dialogue-based learning experiences through an interactive web interface.

## Overview

### Core Innovation

The key contribution of this system is **automated transformation of static, passive technical lab manuals into interactive, node-structured Socratic tutoring agents**. Unlike existing approaches that require manual tutor configuration, this system enables **one-click conversion** from documents to deployable AI tutors while maintaining human oversight for pedagogical rigor.

**The transformation process**:

1. **Upload Document**: Provide a technical lab manual (Markdown/PDF)
2. **Automated Generation**: AI analyzes the document and **creates** (not just extracts):
   - **Persona**: A unique teaching character with dialogue style and pedagogical approach
   - **Curriculum**: A structured cognitive map with Socratic questioning paths
3. **Human Review**: Educators can review, modify, or regenerate components to ensure quality
4. **Deploy & Learn**: Each generated Profile becomes a complete, deployable tutor for interactive learning sessions

### Design Philosophy

- **Creative Generation**: The system **creates** teaching personas and curricula rather than simply extracting or reorganizing content. It transforms "technical features" into "dialogue styles" and "technical dependencies" into "pedagogical logic".
- **Profile = Document + AI-Generated Configuration**: A Profile is a **complete, living tutor**—the document provides the knowledge base, while AI generators provide the "soul" (persona) and "capability" (curriculum).
- **Human-in-the-Loop**: While generation is automated, educators maintain control through review and modification capabilities, ensuring pedagogical rigor and alignment with teaching objectives.

### Core Contributions

1. **Automated Document-to-Tutor Pipeline**: End-to-end conversion from static lab manuals to interactive Socratic tutors with minimal human intervention
2. **Creative Generation Architecture**: Two-stage generation (PersonaGenerator + CurriculumGenerator) that creates teaching entities rather than extracting information
3. **Node-Structured Learning Paths**: Structured curricula with explicit learning nodes, enabling controlled progression and assessment
4. **Human Oversight Integration**: Review and modification capabilities integrated into the generation workflow, ensuring quality and pedagogical appropriateness

## System Architecture

![](docs/images/system-architecture.png)

### Backend (`src/`)

Built on **Python 3.8+**, **FastAPI**, and **LangChain**:

- **Profile Generators** (`generators/`):
  - `PersonaGenerator`: Creates teaching personas from technical documents (transforms technical features into dialogue styles)
  - `CurriculumGenerator`: Creates structured Socratic curricula (transforms technical dependencies into pedagogical logic)
  - `ProfileGenerateManager`: Orchestrates the generation pipeline
- **Tutor Core** (`utils/tutor_core.py`): LangChain-based conversational tutor with dynamic prompt assembly, conversation history management, and streaming support
- **RESTful API** (`api/routes/`): Modular route architecture for authentication, profile/session management, interaction, class management, and custom skills
- **Data Layer**: SQLite database with SQLAlchemy ORM for persistent storage; file system for document and vector index storage (user-isolated)

### Frontend (`frontend/`)

Built with **React 18**, **TypeScript**, **Vite**, and **Material-UI**:

- User authentication and JWT token management
- Profile selection with visibility filtering
- Session management and real-time chat with streaming responses
- Class management and custom skill administration
- Learning progress visualization

### Data Flow

```
Lab Manual (Markdown/PDF)
    ↓
DocumentManager → data/documents/{user_id}/{lab_name}/
    ↓
CurriculumGenerator + PersonaGenerator
    ↓
ProfileGenerateManager → Profile
    ↓
ProfileManager → SQLite (profiles table)
    ↓
Web Interface → Session Creation
    ↓
Tutor Instance → LLM + Skills → Streaming Response
    ↓
SessionManager → SQLite (sessions table)
```

## Quick Start

### Prerequisites

- Python 3.8+
- Node.js 18+
- An API key from a supported LLM provider (optional if users will configure their own keys)

### Installation

```bash
# Clone repository
git clone https://github.com/ElysiaFollower/socratic-agent-generator.git
cd socratic-agent-generator

# Configure environment variables
cp .env.example .env
# Edit .env and configure the following required variables:
#   - JWT_SECRET_KEY: Secret key for JWT token signing (required for authentication)
#   - ADMIN_TOKEN: Secret token for admin registration (required - must be set in .env before registering admin accounts)
# Optional LLM presets (shared by all users unless they configure their own key in Settings):
#   - DEEPSEEK_API_KEY / OPENAI_API_KEY / GLM_API_KEY / MINIMAX_API_KEY
#   - DEFAULT_LLM_PROVIDER: Default provider used when no user-specific key is set
#   - LLM_API_KEY_ENCRYPTION_KEY: Encryption key for storing user-configured API keys in the database

# Install backend dependencies
conda create -n SocraticAgent python=3.9 -y
conda activate SocraticAgent
pip install -r requirements.txt

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### Launch Services

```bash
# Terminal 1: Start backend (http://localhost:8000)
python src/app.py

# Terminal 2: Start frontend (http://localhost:5173)
cd frontend && npm run dev
```

Database is automatically initialized on first startup. Access the application at `http://localhost:5173` and register an account.

**Important**: To register an admin account, you **must** configure `ADMIN_TOKEN` in your `.env` file before starting the backend server. The admin registration form will require this token. If `ADMIN_TOKEN` is not set in `.env`, admin registration will fail with an error.

## LLM Configuration

- Env API keys act as **global presets** shared by all users.
- Users can add their own API keys in the **Settings** panel; per-user keys take priority over presets.
- `DEFAULT_LLM_PROVIDER` is used when a user has not selected a provider.
- User-configured keys are stored **encrypted** in the database (controlled by `LLM_API_KEY_ENCRYPTION_KEY`).

## Usage

### Creating AI Tutors

**Three-Step Workflow**:

1. **Upload Document**: Upload a lab manual (Markdown/PDF) via web interface or CLI
2. **Generate Tutor**: System automatically analyzes the document and generates:
   - **Persona**: Teaching character with dialogue style and pedagogical approach
   - **Curriculum**: Structured learning path with Socratic questioning nodes
   - Review and modify generated components as needed
3. **Deploy & Learn**: The generated Profile becomes a complete tutor ready for interactive learning sessions

**Web Interface** (Recommended):

- Upload lab manual via web interface
- System automatically generates Persona and Curriculum
- Review and modify generated components before finalizing
- Profile saved to database and ready for deployment

**CLI Tool** (`src/main.py`):

```bash
# Place lab manual at: data/documents/{lab_name}/lab_manual.md
# Requires existing admin user in database (uses first admin as owner)
python src/main.py [lab_name]
```

Interactive commands:

- `[rp]` / `regenerate-persona`: Regenerate persona
- `[rc]` / `regenerate-curriculum`: Regenerate curriculum
- `[c]` / `continue`: Compile and save profile to database
- `[q]` / `quit`: Exit

Intermediate files (`definition.json`, `curriculum.json`) are saved to `data/documents/{lab_name}/` for manual editing. Final profiles are stored in SQLite database. The CLI tool creates a document record pointing to `data/documents/{admin_user_id}/{lab_name}/lab_manual.md` in the database.

### Learning with AI Tutors

1. Login and select a visible tutor profile
2. Create a new session (automatically saved to database)
3. Engage in Socratic dialogue with streaming responses
4. Monitor learning progress and manage sessions

### Class Management

Teachers/admins can create classes, generate invitation codes, and control profile visibility. Students join classes via invitation codes.

### Custom Skills

Teachers can create custom skills with automatic vector indexing for extending tutor capabilities.

## Technical Stack

**Backend**: Python 3.8+, FastAPI, LangChain, SQLAlchemy, SQLite, Pydantic, JWT (python-jose), Uvicorn

**Frontend**: React 18, TypeScript, Vite, Material-UI, Axios, React Router, Notistack

**Storage**: SQLite (user data, profiles, sessions, classes, skills), File system (documents, vector indices), In-memory cache (active tutor instances)

## API

Full API documentation available at `http://localhost:8000/docs` (Swagger UI).

## License

MIT License.

## Contact

- Issues: [GitHub Issues](https://github.com/ElysiaFollower/socratic-agent-generator/issues)
- Pull Requests: [GitHub Pull Requests](https://github.com/ElysiaFollower/socratic-agent-generator/pulls)
