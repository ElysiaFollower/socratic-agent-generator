"""Long-term memory provider adapters for Tutor.

The app's runtime should depend on this small interface, not directly on a
research prototype. DreamingRAG can evolve behind this adapter without leaking
its internal API across TutorCore.
"""

from __future__ import annotations

import logging
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional, Protocol, Sequence, Tuple

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
    """Adapter around DreamingRAG's current memory facade.

    This prototype intentionally uses only recall/write behavior. It does not
    call DreamingBrain.interact(), so the Socratic Tutor remains responsible for
    response generation, skills, streaming, and step evaluation.
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
        brain_cls: Optional[type] = None,
    ) -> None:
        self.context = context
        self.repo_path = repo_path or DREAMINGRAG_REPO_PATH
        self.storage_root = Path(storage_root)
        self.mock_mode = mock_mode
        self.enable_cue_recall = enable_cue_recall
        self.top_n = max(1, top_n)
        self.max_context_chars = max(200, max_context_chars)
        self._brain_cls = brain_cls
        self._brain: Optional[Any] = None

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
            results = self._recall_with_scores(query)
        except Exception as exc:
            logger.warning("DreamingRAG recall failed: %s", exc, exc_info=True)
            return ""

        return format_memory_context(results, self.max_context_chars)

    def record_turn(self, user_input: str, assistant_output: str) -> None:
        try:
            brain = self._get_brain()
            if user_input.strip():
                brain.hippocampus.add_memory(
                    self._format_turn_memory("student", user_input),
                    source="user",
                )
            if assistant_output.strip():
                brain.hippocampus.add_memory(
                    self._format_turn_memory("tutor", assistant_output),
                    source="ai",
                )
        except Exception as exc:
            logger.warning("DreamingRAG turn write failed: %s", exc, exc_info=True)

    def _recall_with_scores(self, query: str) -> Sequence[Tuple[Any, dict]]:
        brain = self._get_brain()
        if hasattr(brain, "_recall_memories_with_scores"):
            return brain._recall_memories_with_scores(query, top_n=self.top_n)
        return brain.hippocampus.recall_with_scores(query, top_n=self.top_n)

    def _get_brain(self) -> Any:
        if self._brain is None:
            brain_cls = self._brain_cls or load_dreamingbrain(self.repo_path)
            self._storage_path().mkdir(parents=True, exist_ok=True)
            self._brain = brain_cls(
                storage_path=str(self._storage_path()),
                mock_mode=self.mock_mode,
                enable_cue_recall=self.enable_cue_recall,
            )
        return self._brain

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


def get_memory_provider(context: MemoryProviderContext) -> MemoryProvider:
    """Factory for Tutor memory providers with graceful fallback."""
    if not DREAMINGRAG_MEMORY_ENABLED:
        return NullMemoryProvider()

    try:
        provider = DreamingRAGMemoryProvider(context)
        # Load lazily but fail early enough that Tutor can downgrade on startup.
        provider._get_brain()
        return provider
    except Exception as exc:
        logger.warning("DreamingRAG memory provider unavailable: %s", exc, exc_info=True)
        return NullMemoryProvider(reason="dreamingrag_unavailable")


def load_dreamingbrain(repo_path: Optional[str]) -> type:
    """Load DreamingBrain from an installed package or configured repo path."""
    if repo_path:
        path = Path(repo_path).expanduser().resolve()
        if path.exists() and str(path) not in sys.path:
            sys.path.insert(0, str(path))

    from dreaming_rag.core.brain import DreamingBrain

    return DreamingBrain


def format_memory_context(
    results: Sequence[Tuple[Any, dict]],
    max_chars: int = DREAMINGRAG_MEMORY_CONTEXT_CHARS,
) -> str:
    """Convert DreamingRAG recall results into prompt-ready snippets."""
    lines = []
    remaining = max_chars
    for index, (memory, scores) in enumerate(results, start=1):
        content = str(getattr(memory, "content", "")).strip()
        if not content:
            continue
        final_score = scores.get("final_score", scores.get("base_score"))
        score_part = (
            f" score={float(final_score):.3f};"
            if isinstance(final_score, (float, int))
            else ""
        )
        source = getattr(getattr(memory, "source", None), "value", None) or getattr(
            memory, "source", "unknown"
        )
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
