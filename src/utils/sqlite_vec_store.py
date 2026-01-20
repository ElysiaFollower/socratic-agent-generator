"""SQLite vector store helper using sqlite-vec when available."""

import json
import logging
import os
import sqlite3
from typing import Iterable, List, Optional, Tuple

from config import DATA_DIR

logger = logging.getLogger(__name__)


class SqliteVecStore:
    """Adapter for sqlite-vec with a safe fallback."""

    def __init__(self, dim: int, table_name: str = "custom_skill_vectors"):
        self.db_path = str(DATA_DIR / "socratic_agent.db")
        self.dim = dim
        self.table_name = table_name

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.execute("PRAGMA foreign_keys = ON")
        self._load_extension(conn)
        return conn

    def _load_extension(self, conn: sqlite3.Connection) -> None:
        path = os.getenv("SQLITE_VEC_PATH")
        if not path:
            try:
                import sqlite_vec  # type: ignore

                if hasattr(sqlite_vec, "load"):
                    sqlite_vec.load(conn)
                    return
            except Exception:
                return

        try:
            conn.enable_load_extension(True)
            conn.load_extension(path)
        except Exception:
            return

    def ensure_table(self) -> bool:
        try:
            with self._connect() as conn:
                conn.execute(
                    f"""
                    CREATE VIRTUAL TABLE IF NOT EXISTS {self.table_name}
                    USING vec0(
                        skill_id integer,
                        chunk_id integer,
                        embedding float[{self.dim}]
                    )
                    """
                )
            return True
        except Exception as exc:
            logger.warning("sqlite-vec not available: %s", exc)
            return False

    def clear_skill(self, skill_id: int) -> None:
        try:
            with self._connect() as conn:
                conn.execute(
                    f"DELETE FROM {self.table_name} WHERE skill_id = ?",
                    (skill_id,),
                )
        except Exception as exc:
            logger.warning("sqlite-vec clear failed: %s", exc)

    def insert_vectors(
        self, skill_id: int, chunk_ids: List[int], embeddings: List[List[float]]
    ) -> bool:
        if not self.ensure_table():
            return False
        rows = [
            (skill_id, chunk_id, json.dumps(embedding))
            for chunk_id, embedding in zip(chunk_ids, embeddings)
        ]
        try:
            with self._connect() as conn:
                conn.executemany(
                    f"""
                    INSERT INTO {self.table_name}
                    (skill_id, chunk_id, embedding)
                    VALUES (?, ?, ?)
                    """,
                    rows,
                )
            return True
        except Exception as exc:
            logger.warning("sqlite-vec insert failed: %s", exc)
            return False

    def search(
        self, skill_id: int, query_embedding: List[float], k: int
    ) -> Optional[List[int]]:
        if not self.ensure_table():
            return None
        try:
            with self._connect() as conn:
                cursor = conn.execute(
                    f"""
                    SELECT chunk_id
                    FROM {self.table_name}
                    WHERE skill_id = ? AND embedding MATCH ?
                    LIMIT ?
                    """,
                    (skill_id, json.dumps(query_embedding), k),
                )
                rows = cursor.fetchall()
            return [row[0] for row in rows]
        except Exception as exc:
            logger.warning("sqlite-vec search failed: %s", exc)
            return None
