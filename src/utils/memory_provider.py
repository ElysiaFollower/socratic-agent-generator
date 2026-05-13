"""Long-term memory provider adapters for Tutor.

The app's runtime should depend on this small interface, not directly on an
external memory system. DreamingRAG can evolve behind its public API without
leaking implementation details across TutorCore.
"""

from __future__ import annotations

import logging
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional, Protocol, Sequence

from config import (
    DREAMINGRAG_MEMORY_CONTEXT_CHARS,
    DREAMINGRAG_MEMORY_ENABLE_CUE_RECALL,
    DREAMINGRAG_MEMORY_ENABLED,
    DREAMINGRAG_MEMORY_MOCK_MODE,
    DREAMINGRAG_MEMORY_STORAGE_DIR,
    DREAMINGRAG_MEMORY_TOP_N,
    DREAMINGRAG_REPO_PATH,
)

logger = logging.getLogger(__name__)


class MemoryProvider(Protocol):
    """Minimal interface Tutor needs from any long-term memory backend."""

    @property
    def enabled(self) -> bool:
        """Whether this provider should affect Tutor behavior."""

    @property
    def status(self) -> str:
        """Short diagnostic status string."""

    def recall_context(self, query: str) -> str:
        """Return prompt-ready memory context for a user query."""

    def record_turn(self, user_input: str, assistant_output: str) -> None:
        """Persist the current user/assistant turn."""


@dataclass(frozen=True)
class MemoryProviderContext:
    """Tutor/session identity used to isolate memory storage."""

    user_id: Optional[str]
    session_id: str
    profile_id: Optional[str] = None
    topic_name: Optional[str] = None
    lab_name: Optional[str] = None


class NullMemoryProvider:
    """No-op provider used when memory is disabled or unavailable."""

    def __init__(self, reason: str = "disabled") -> None:
        self._reason = reason

    @property
    def enabled(self) -> bool:
        return False

    @property
    def status(self) -> str:
        return f"null:{self._reason}"

    def recall_context(self, query: str) -> str:
        return ""

    def record_turn(self, user_input: str, assistant_output: str) -> None:
        return None


class DreamingRAGMemoryProvider:
    """Adapter around DreamingRAG's public memory API.

    Socratic Tutor keeps responsibility for response generation, skills,
    streaming, and step evaluation. DreamingRAG is used only for long-term
    memory recall and turn persistence through its stable local Python API.
    """

    def __init__(
        self,
        context: MemoryProviderContext,
        *,
        repo_path: Optional[str] = None,
        storage_root: Path = DREAMINGRAG_MEMORY_STORAGE_DIR,
        mock_mode: bool = DREAMINGRAG_MEMORY_MOCK_MODE,
        enable_cue_recall: bool = DREAMINGRAG_MEMORY_ENABLE_CUE_RECALL,
        top_n: int = DREAMINGRAG_MEMORY_TOP_N,
        max_context_chars: int = DREAMINGRAG_MEMORY_CONTEXT_CHARS,
        memory_client_cls: Optional[type] = None,
        config_cls: Optional[type] = None,
    ) -> None:
        self.context = context
        self.repo_path = repo_path or DREAMINGRAG_REPO_PATH
        self.storage_root = Path(storage_root)
        self.mock_mode = mock_mode
        self.enable_cue_recall = enable_cue_recall
        self.top_n = max(1, top_n)
        self.max_context_chars = max(200, max_context_chars)
        self._memory_client_cls = memory_client_cls
        self._config_cls = config_cls
        self._client: Optional[Any] = None

    @property
    def enabled(self) -> bool:
        return True

    @property
    def status(self) -> str:
        mode = "mock" if self.mock_mode else "real"
        return f"dreamingrag:{mode}:{self._storage_path()}"

    def recall_context(self, query: str) -> str:
        if not query.strip():
            return ""

        try:
            response = self._get_client().recall(
                query,
                top_n=self.top_n,
                include_scores=True,
            )
        except Exception as exc:
            logger.warning("DreamingRAG recall failed: %s", exc, exc_info=True)
            return ""

        results = getattr(response, "memories", [])
        return format_memory_context(results, self.max_context_chars)

    def record_turn(self, user_input: str, assistant_output: str) -> None:
        try:
            client = self._get_client()
            if user_input.strip():
                client.remember(
                    self._format_turn_memory("student", user_input),
                    source="user",
                    metadata=self._memory_metadata("student"),
                )
            if assistant_output.strip():
                client.remember(
                    self._format_turn_memory("tutor", assistant_output),
                    source="ai",
                    metadata=self._memory_metadata("tutor"),
                )
        except Exception as exc:
            logger.warning("DreamingRAG turn write failed: %s", exc, exc_info=True)

    def close(self) -> None:
        if self._client is not None and hasattr(self._client, "close"):
            self._client.close()

    def _get_client(self) -> Any:
        if self._client is None:
            memory_client_cls = self._memory_client_cls
            config_cls = self._config_cls
            if memory_client_cls is None or config_cls is None:
                memory_client_cls, config_cls = load_dreamingrag_public_api(
                    self.repo_path
                )
            self._storage_path().mkdir(parents=True, exist_ok=True)
            config = config_cls(
                storage_path=str(self._storage_path()),
                mock_mode=self.mock_mode,
                enable_cue_recall=self.enable_cue_recall,
            )
            self._client = memory_client_cls(config)
        return self._client

    def _storage_path(self) -> Path:
        user = _safe_segment(self.context.user_id or "anonymous")
        session = _safe_segment(self.context.session_id)
        return self.storage_root / user / session

    def _format_turn_memory(self, role: str, content: str) -> str:
        topic = self.context.topic_name or "unknown topic"
        profile = self.context.profile_id or "unknown profile"
        return (
            f"Socratic tutor session memory. role={role}; "
            f"topic={topic}; profile={profile}; content={content}"
        )

    def _memory_metadata(self, role: str) -> dict:
        return {
            "app": "socratic-agent-generator",
            "role": role,
            "user_id": self.context.user_id,
            "session_id": self.context.session_id,
            "profile_id": self.context.profile_id,
            "topic_name": self.context.topic_name,
            "lab_name": self.context.lab_name,
        }


def get_memory_provider(context: MemoryProviderContext) -> MemoryProvider:
    """Factory for Tutor memory providers with graceful fallback."""
    if not DREAMINGRAG_MEMORY_ENABLED:
        return NullMemoryProvider()

    try:
        provider = DreamingRAGMemoryProvider(context)
        # Load lazily but fail early enough that Tutor can downgrade on startup.
        provider._get_client()
        return provider
    except Exception as exc:
        logger.warning("DreamingRAG memory provider unavailable: %s", exc, exc_info=True)
        return NullMemoryProvider(reason="dreamingrag_unavailable")


def load_dreamingrag_public_api(repo_path: Optional[str]) -> tuple[type, type]:
    """Load DreamingRAG's stable public API from package or configured repo."""
    if repo_path:
        path = Path(repo_path).expanduser().resolve()
        if path.exists() and str(path) not in sys.path:
            sys.path.insert(0, str(path))

    try:
        from dreaming_rag.public_api import DreamingRAGMemory, MemoryAPIConfig
    except ImportError:
        from dreaming_rag import DreamingRAGMemory, MemoryAPIConfig

    return DreamingRAGMemory, MemoryAPIConfig


def format_memory_context(
    results: Sequence[Any],
    max_chars: int = DREAMINGRAG_MEMORY_CONTEXT_CHARS,
) -> str:
    """Convert DreamingRAG recall results into prompt-ready snippets."""
    lines = []
    remaining = max_chars
    for index, memory in enumerate(results, start=1):
        content = str(getattr(memory, "content", "")).strip()
        if not content:
            continue
        scores = getattr(memory, "scores", None) or {}
        final_score = scores.get("final_score", scores.get("base_score"))
        score_part = (
            f" score={float(final_score):.3f};"
            if isinstance(final_score, (float, int))
            else ""
        )
        source = str(getattr(memory, "source", "unknown") or "unknown")
        prefix = f"[Memory {index};{score_part} source={source}] "
        allowed = remaining - len(prefix) - 1
        if allowed <= 0:
            break
        snippet = content[:allowed].strip()
        lines.append(prefix + snippet)
        remaining -= len(lines[-1]) + 1
        if remaining <= 0:
            break

    return "\n".join(lines)


def build_memory_system_note(memory_context: str) -> str:
    """Wrap memory snippets as a system note for the Tutor prompt."""
    if not memory_context.strip():
        return ""
    return (
        "Long-term learning memory from previous tutor interactions. "
        "Use it only when relevant, prefer current user input and curriculum, "
        "and do not expose implementation details.\n"
        f"{memory_context.strip()}"
    )


def append_memory_note(base_note: str, memory_context: str) -> str:
    """Append memory context to the existing history/system note."""
    memory_note = build_memory_system_note(memory_context)
    if not memory_note:
        return base_note
    return f"{base_note}\n\n{memory_note}"


def _safe_segment(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_.-]+", "_", value.strip())
    return cleaned[:120] or "unknown"
