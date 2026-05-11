import tempfile
import unittest
import sys
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from utils.memory_provider import (
    DreamingRAGMemoryProvider,
    MemoryProviderContext,
    NullMemoryProvider,
    append_memory_note,
    format_memory_context,
)


class FakeHippocampus:
    def __init__(self):
        self.added = []

    def add_memory(self, content, source="user"):
        self.added.append((source, content))
        return SimpleNamespace(content=content, source=source)


class FakeBrain:
    instances = []

    def __init__(self, storage_path, mock_mode=False, enable_cue_recall=False):
        self.storage_path = storage_path
        self.mock_mode = mock_mode
        self.enable_cue_recall = enable_cue_recall
        self.hippocampus = FakeHippocampus()
        FakeBrain.instances.append(self)

    def _recall_memories_with_scores(self, query, top_n=3):
        memory = SimpleNamespace(
            content=f"Student previously said they prefer hints. query={query}",
            source=SimpleNamespace(value="user_input"),
        )
        return [(memory, {"final_score": 0.91})]


class MemoryProviderTest(unittest.TestCase):
    def setUp(self):
        FakeBrain.instances.clear()

    def test_null_provider_is_noop(self):
        provider = NullMemoryProvider()

        self.assertFalse(provider.enabled)
        self.assertEqual("", provider.recall_context("anything"))
        self.assertIsNone(provider.record_turn("user", "assistant"))

    def test_format_memory_context_limits_and_scores_snippets(self):
        memory = SimpleNamespace(
            content="A" * 500,
            source=SimpleNamespace(value="user_input"),
        )

        context = format_memory_context(
            [(memory, {"final_score": 0.875})],
            max_chars=120,
        )

        self.assertIn("[Memory 1; score=0.875; source=user_input]", context)
        self.assertLessEqual(len(context), 120)

    def test_append_memory_note_wraps_context(self):
        note = append_memory_note("base", "remember this")

        self.assertIn("base", note)
        self.assertIn("Long-term learning memory", note)
        self.assertIn("remember this", note)

    def test_dreamingrag_provider_uses_session_scoped_storage(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            provider = DreamingRAGMemoryProvider(
                MemoryProviderContext(
                    user_id="user/1",
                    session_id="session:2",
                    profile_id="profile-1",
                    topic_name="Buffer Overflow",
                ),
                storage_root=Path(temp_dir),
                mock_mode=True,
                brain_cls=FakeBrain,
            )

            context = provider.recall_context("I am confused")

            self.assertIn("Student previously said", context)
            self.assertTrue(FakeBrain.instances)
            brain = FakeBrain.instances[0]
            self.assertTrue(Path(brain.storage_path).exists())
            self.assertIn("user_1", brain.storage_path)
            self.assertIn("session_2", brain.storage_path)
            self.assertTrue(brain.mock_mode)

    def test_dreamingrag_provider_records_user_and_assistant_turns(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            provider = DreamingRAGMemoryProvider(
                MemoryProviderContext(
                    user_id="u",
                    session_id="s",
                    profile_id="p",
                    topic_name="TCP Attack",
                ),
                storage_root=Path(temp_dir),
                brain_cls=FakeBrain,
            )

            provider.record_turn("I need hints.", "Try checking the SYN queue.")

            added = FakeBrain.instances[0].hippocampus.added
            self.assertEqual("user", added[0][0])
            self.assertEqual("ai", added[1][0])
            self.assertIn("role=student", added[0][1])
            self.assertIn("role=tutor", added[1][1])
            self.assertIn("TCP Attack", added[0][1])


if __name__ == "__main__":
    unittest.main()
