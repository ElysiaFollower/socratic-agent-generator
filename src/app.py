"""Main FastAPI application module.

This module initializes the FastAPI application and registers all route handlers.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.logging_config import setup_logging
from config import (
    CORS_ALLOWED_ORIGINS,
    API_HOST,
    API_PORT,
    PROFILES_DIR,
    SESSION_DATA_DIR,
)
from api.routes import profile, session, interaction, adapter

# Setup logging
setup_logging()

# Initialize FastAPI application
app = FastAPI(
    title="Socratic Agent API",
    description="后端API服务，用于驱动苏格拉底式AI导师前端。",
    version="2.0.0",
)

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure directories exist
PROFILES_DIR.mkdir(parents=True, exist_ok=True)
SESSION_DATA_DIR.mkdir(parents=True, exist_ok=True)

# Register route handlers
app.include_router(profile.router)
app.include_router(session.router)
app.include_router(interaction.router)
app.include_router(adapter.router)


@app.get("/api/health", summary="健康检查", tags=["Health"])
def health() -> dict:
    """Health check endpoint.

    Returns:
        Dictionary with status "ok".
    """
    return {"status": "ok"}


# --- Startup code for direct execution ---
if __name__ == "__main__":
    import uvicorn

    print("🚀 启动 Socratic Agent API 服务器...")
    server_url = f"http://{API_HOST}:{API_PORT}"
    print(f"🌐 服务地址(后端服务): {server_url}")
    print(f"📚 API 文档: {server_url}/docs")

    # reload=True enables auto-reload on code changes
    uvicorn.run("app:app", host=API_HOST, port=API_PORT, reload=True)
