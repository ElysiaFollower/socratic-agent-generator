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


class FakeMemoryAPIConfig:
    def __init__(self, storage_path=None, mock_mode=False, enable_cue_recall=False):
        self.storage_path = storage_path
        self.mock_mode = mock_mode
        self.enable_cue_recall = enable_cue_recall


class FakeMemoryClient:
    instances = []

    def __init__(self, config):
        self.config = config
        self.remembered = []
        FakeMemoryClient.instances.append(self)

    def recall(self, query, top_n=3, include_scores=True):
        memory = SimpleNamespace(
            content=f"Student previously said they prefer hints. query={query}",
            source="user",
            scores={"final_score": 0.91},
        )
        return SimpleNamespace(query=query, memories=[memory], memory_count=1)

    def remember(self, content, source="user", metadata=None):
        self.remembered.append(
            {
                "content": content,
                "source": source,
                "metadata": metadata or {},
            }
        )
        return SimpleNamespace(
            memory=SimpleNamespace(content=content, source=source, metadata=metadata or {}),
            memory_count=len(self.remembered),
        )


class MemoryProviderTest(unittest.TestCase):
    def setUp(self):
        FakeMemoryClient.instances.clear()

    def test_null_provider_is_noop(self):
        provider = NullMemoryProvider()

        self.assertFalse(provider.enabled)
        self.assertEqual("", provider.recall_context("anything"))
        self.assertIsNone(provider.record_turn("user", "assistant"))

    def test_format_memory_context_limits_and_scores_snippets(self):
        memory = SimpleNamespace(
            content="A" * 500,
            source="user",
            scores={"final_score": 0.875},
        )

        context = format_memory_context(
            [memory],
            max_chars=120,
        )

        self.assertIn("[Memory 1; score=0.875; source=user]", context)
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
                memory_client_cls=FakeMemoryClient,
                config_cls=FakeMemoryAPIConfig,
            )

            context = provider.recall_context("I am confused")

            self.assertIn("Student previously said", context)
            self.assertTrue(FakeMemoryClient.instances)
            client = FakeMemoryClient.instances[0]
            storage_path = client.config.storage_path
            self.assertTrue(Path(storage_path).exists())
            self.assertIn("user_1", storage_path)
            self.assertIn("session_2", storage_path)
            self.assertTrue(client.config.mock_mode)
            self.assertTrue(client.config.enable_cue_recall)

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
                memory_client_cls=FakeMemoryClient,
                config_cls=FakeMemoryAPIConfig,
            )

            provider.record_turn("I need hints.", "Try checking the SYN queue.")

            remembered = FakeMemoryClient.instances[0].remembered
            self.assertEqual("user", remembered[0]["source"])
            self.assertEqual("ai", remembered[1]["source"])
            self.assertIn("role=student", remembered[0]["content"])
            self.assertIn("role=tutor", remembered[1]["content"])
            self.assertIn("TCP Attack", remembered[0]["content"])
            self.assertEqual("student", remembered[0]["metadata"]["role"])
            self.assertEqual("tutor", remembered[1]["metadata"]["role"])
            self.assertEqual("s", remembered[0]["metadata"]["session_id"])
            self.assertEqual("p", remembered[0]["metadata"]["profile_id"])


if __name__ == "__main__":
    unittest.main()
