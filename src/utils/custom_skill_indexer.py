"""Custom skill indexing utilities."""

import logging
import math
from typing import List, Tuple

from langchain_text_splitters import RecursiveCharacterTextSplitter

from core.database import SessionLocal
from models.custom_skill import CustomSkill
from models.custom_skill_chunk import CustomSkillChunk
from utils.sqlite_vec_store import SqliteVecStore
from utils.skills import get_shared_embeddings

logger = logging.getLogger(__name__)

DEFAULT_CHUNK_SIZE = 800
DEFAULT_CHUNK_OVERLAP = 100


def _split_materials(materials) -> List[Tuple[int, str]]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=DEFAULT_CHUNK_SIZE,
        chunk_overlap=DEFAULT_CHUNK_OVERLAP,
    )
    chunks: List[Tuple[int, str]] = []
    for material in materials:
        for chunk in splitter.split_text(material.content):
            cleaned = chunk.strip()
            if cleaned:
                chunks.append((material.id, cleaned))
    return chunks


def build_custom_skill_index(skill_id: int) -> dict:
    """Build or rebuild sqlite-vec index for a custom skill."""
    with SessionLocal() as db:
        skill = db.query(CustomSkill).filter(CustomSkill.id == skill_id).first()
        if not skill:
            raise ValueError("Skill not found.")

        materials = list(skill.materials or [])
        if not materials:
            raise ValueError("Skill has no associated materials.")

        chunks = _split_materials(materials)
        if not chunks:
            raise ValueError("No chunks generated from materials.")

        texts = [text for _, text in chunks]
        embeddings = get_shared_embeddings()
        vectors = embeddings.embed_documents(texts)
        dim = len(vectors[0]) if vectors else 0

        db.query(CustomSkillChunk).filter(CustomSkillChunk.skill_id == skill_id).delete()
        db.flush()

        chunk_rows = []
        for (material_id, text), vector in zip(chunks, vectors):
            row = CustomSkillChunk(
                skill_id=skill_id,
                material_id=material_id,
                content=text,
                embedding=vector,
            )
            db.add(row)
            chunk_rows.append(row)

        db.flush()
        chunk_ids = [row.id for row in chunk_rows]

        store = SqliteVecStore(dim=dim)
        store.clear_skill(skill_id)
        inserted = store.insert_vectors(skill_id, chunk_ids, vectors)

        skill.meta_info = dict(skill.meta_info or {})
        skill.meta_info["embedding_dim"] = dim
        skill.meta_info["embedding_model"] = "sentence-transformers/all-MiniLM-L6-v2"
        skill.meta_info["vector_backend"] = "sqlite-vec" if inserted else "python"
        skill.status = "ready"
        db.commit()

        return {
            "skill_id": skill_id,
            "chunks": len(chunk_rows),
            "vector_backend": skill.meta_info["vector_backend"],
        }


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def search_custom_skill_chunks(skill_id: int, query: str, k: int = 3) -> List[CustomSkillChunk]:
    """Search indexed chunks for a skill."""
    embeddings = get_shared_embeddings()
    query_vec = embeddings.embed_query(query)

    store = SqliteVecStore(dim=len(query_vec))
    chunk_ids = store.search(skill_id, query_vec, k=k)

    with SessionLocal() as db:
        if chunk_ids:
            rows = (
                db.query(CustomSkillChunk)
                .filter(CustomSkillChunk.id.in_(chunk_ids))
                .all()
            )
            row_map = {row.id: row for row in rows}
            return [row_map[cid] for cid in chunk_ids if cid in row_map]

        # Fallback: python similarity over stored embeddings
        rows = (
            db.query(CustomSkillChunk)
            .filter(CustomSkillChunk.skill_id == skill_id)
            .all()
        )
        scored = [
            (row, _cosine_similarity(query_vec, row.embedding or []))
            for row in rows
        ]
        scored.sort(key=lambda item: item[1], reverse=True)
        return [row for row, _ in scored[:k]]
