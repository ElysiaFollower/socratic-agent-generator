# Socratic Agent Generator

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
- DeepSeek API Key ([platform.deepseek.com](https://platform.deepseek.com/))

### Installation

```bash
# Clone repository
git clone https://github.com/ElysiaFollower/socratic-agent-generator.git
cd socratic-agent-generator

# Configure environment variables
cp .env.example .env
# Edit .env: DEEPSEEK_API_KEY, JWT_SECRET_KEY, ADMIN_TOKEN

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

Database is automatically initialized on first startup. Access the application at `http://localhost:5173` and register an account (admin registration requires `ADMIN_TOKEN`).

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

## API Documentation

### Authentication

- `POST /api/auth/register`: User registration (requires `ADMIN_TOKEN` for admin role or valid invitation code)
- `POST /api/auth/login`: User login
- `POST /api/auth/logout`: User logout
- `GET /api/auth/me`: Get current user info
- `POST /api/auth/invitation-codes/generate`: Generate registration invitation code (admin/teacher)
- `GET /api/auth/invitation-codes`: List registration invitation codes (admin/teacher)
- `DELETE /api/auth/invitation-codes/{code}`: Delete invitation code (admin/teacher)
- `PATCH /api/auth/invitation-codes/{code}`: Update invitation code expiration (admin/teacher)

### Profile Management

- `GET /api/profiles`: List visible profiles (filtered by user classes)
- `GET /api/profiles/{profile_id}`: Get profile details
- `POST /api/profiles`: Create profile (admin/teacher only)
- `PUT /api/profiles/{profile_id}/rename`: Rename profile
- `DELETE /api/profiles/{profile_id}`: Delete profile
- `POST /api/profiles/upload-lab-manual`: Upload lab manual (Markdown/PDF)
- `GET /api/profiles/lab-manuals`: List lab manuals
- `GET /api/profiles/lab-manuals/{lab_name}/content`: Get lab manual content
- `DELETE /api/profiles/lab-manuals/{lab_name}`: Delete lab manual
- `GET /api/profiles/lab-manuals/{lab_name}/persona`: Get persona
- `POST /api/profiles/lab-manuals/{lab_name}/persona`: Save persona
- `GET /api/profiles/lab-manuals/{lab_name}/curriculum`: Get curriculum
- `POST /api/profiles/lab-manuals/{lab_name}/curriculum`: Save curriculum
- `POST /api/profiles/lab-manuals/{lab_name}/generate-persona`: Generate persona
- `POST /api/profiles/lab-manuals/{lab_name}/generate-curriculum`: Generate curriculum
- `POST /api/profiles/lab-manuals/{lab_name}/generate-profile`: Generate profile from lab manual
- `POST /api/profiles/generate`: Generate profile from content
- `PATCH /api/classes/{class_id}/profiles/{profile_id}`: Update profile visibility for class

### Session Management

- `GET /api/sessions`: List user sessions
- `POST /api/sessions/create`: Create session
- `GET /api/sessions/{session_id}`: Get session details
- `DELETE /api/sessions/{session_id}`: Delete session
- `PUT /api/sessions/{session_id}/rename`: Rename session

### Interaction

- `POST /api/sessions/{session_id}/messages/stream`: Send message (SSE streaming)
- `GET /api/tutor/{session_id}/welcome`: Get welcome message
- `GET /api/tutor/{session_id}/state`: Get learning progress

### Class Management

- `GET /api/classes`: List user classes
- `POST /api/classes`: Create class (teacher/admin)
- `POST /api/classes/join`: Join class via invitation code
- `POST /api/classes/{class_id}/invite`: Generate invitation code
- `GET /api/classes/{class_id}/invites`: List class invitation codes
- `DELETE /api/classes/{class_id}/invites/{code}`: Delete invitation code
- `PATCH /api/classes/{class_id}/invites/{code}`: Update invitation code expiration
- `GET /api/classes/{class_id}/members`: List class members
- `PATCH /api/classes/{class_id}/profiles/{profile_id}`: Update profile visibility for class

### Custom Skills

- `GET /api/profiles/{profile_id}/skills`: List skills for a profile
- `GET /api/skills/{skill_id}`: Get skill details
- `POST /api/profiles/{profile_id}/skills/generate`: Generate skill from materials
- `POST /api/profiles/{profile_id}/skills`: Create skill (teacher/admin)
- `PATCH /api/skills/{skill_id}`: Update skill
- `DELETE /api/skills/{skill_id}`: Delete skill
- `POST /api/skills/{skill_id}/index`: Rebuild skill index
- `POST /api/profiles/{profile_id}/skill-materials`: Upload skill material
- `GET /api/profiles/{profile_id}/skill-materials`: List skill materials

**Note**: Most endpoints require JWT authentication via `Authorization: Bearer <token>` header. User data is isolated by `owner_id`. Profile visibility is controlled by `visible_class_ids`.

## Technical Stack

**Backend**: Python 3.8+, FastAPI, LangChain, SQLAlchemy, SQLite, Pydantic, JWT (python-jose), Uvicorn

**Frontend**: React 18, TypeScript, Vite, Material-UI, Axios, React Router, Notistack

**Storage**: SQLite (user data, profiles, sessions, classes, skills), File system (documents, vector indices), In-memory cache (active tutor instances)

## Troubleshooting

**Database initialization**: Database auto-creates on startup. Manual initialization: `python -c "from src.core.database import init_db; init_db()"`

**CLI tool requires admin user**: Ensure at least one admin user exists before using `main.py`

**Profile visibility**: Check `visible_class_ids` field and user class membership

**API authentication**: Verify JWT token expiration (default 7 days) and `JWT_SECRET_KEY` configuration

Full API documentation available at `http://localhost:8000/docs` (Swagger UI).

## Citation

If you use this system in your research, please cite:

```bibtex
@software{socratic_agent_generator,
  title = {Socratic Agent Generator},
  author = {ElysiaFollower},
  year = {2025},
  url = {https://github.com/ElysiaFollower/socratic-agent-generator}
}
```

## License

MIT License. See [LICENSE](LICENSE) file for details.

## Contact

- Issues: [GitHub Issues](https://github.com/ElysiaFollower/socratic-agent-generator/issues)
- Pull Requests: [GitHub Pull Requests](https://github.com/ElysiaFollower/socratic-agent-generator/pulls)
