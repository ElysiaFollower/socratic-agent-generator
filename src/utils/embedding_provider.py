"""Embedding provider adapters for Socratic document retrieval."""

from __future__ import annotations

import logging
from typing import Any, Optional

import httpx
from langchain_core.embeddings import Embeddings
from langchain_huggingface import HuggingFaceEmbeddings

from config import (
    EMBEDDING_PROVIDER,
    EMBEDDING_REQUEST_TIMEOUT,
    HF_MODELS_DIR,
    HUGGINGFACE_EMBEDDING_MODEL,
    VOLCENGINE_API_KEY,
    VOLCENGINE_EMBEDDING_BASE_URL,
    VOLCENGINE_EMBEDDING_MODEL,
)

logger = logging.getLogger(__name__)


class VolcengineArkEmbeddings(Embeddings):
    """LangChain-compatible embeddings backed by Volcengine Ark."""

    def __init__(
        self,
        *,
        api_key: Optional[str] = None,
        base_url: str = VOLCENGINE_EMBEDDING_BASE_URL,
        model: str = VOLCENGINE_EMBEDDING_MODEL,
        timeout: int = EMBEDDING_REQUEST_TIMEOUT,
        client: Optional[httpx.Client] = None,
    ):
        self.api_key = api_key or VOLCENGINE_API_KEY
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout
        self._client = client

        if not self.api_key:
            raise ValueError(
                "VOLCENGINE_API_KEY environment variable is not set. "
                "Configure it when EMBEDDING_PROVIDER=volcengine."
            )

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if "vision" in self.model:
            return [self.embed_query(text) for text in texts]
        return self._embed_text_batch(texts)

    def embed_query(self, text: str) -> list[float]:
        if "vision" in self.model:
            return self._embed_multimodal_text(text)
        return self._embed_text_batch([text])[0]

    def _embed_text_batch(self, texts: list[str]) -> list[list[float]]:
        response = self._post(
            f"{self.base_url}/embeddings",
            {
                "model": self.model,
                "input": texts,
            },
        )
        data = response.get("data")
        if not isinstance(data, list):
            raise ValueError(f"Unexpected Volcengine embedding response: {response!r}")
        ordered = sorted(data, key=lambda item: item.get("index", 0))
        return [self._extract_embedding(item) for item in ordered]

    def _embed_multimodal_text(self, text: str) -> list[float]:
        response = self._post(
            f"{self.base_url}/embeddings/multimodal",
            {
                "model": self.model,
                "input": [{"type": "text", "text": text}],
            },
        )
        data = response.get("data")
        if isinstance(data, dict):
            return self._extract_embedding(data)
        if isinstance(data, list) and data:
            return self._extract_embedding(data[0])
        raise ValueError(f"Unexpected Volcengine multimodal embedding response: {response!r}")

    def _post(self, url: str, payload: dict[str, Any]) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        client = self._client or httpx.Client(timeout=self.timeout)
        close_client = self._client is None
        try:
            result = client.post(url, json=payload, headers=headers)
            result.raise_for_status()
            return result.json()
        finally:
            if close_client:
                client.close()

    @staticmethod
    def _extract_embedding(item: dict[str, Any]) -> list[float]:
        embedding = item.get("embedding")
        if not isinstance(embedding, list):
            raise ValueError(f"Embedding response item has no embedding list: {item!r}")
        return [float(value) for value in embedding]


def create_embeddings(provider: str = EMBEDDING_PROVIDER) -> Embeddings:
    """Create the configured embeddings implementation."""
    normalized = provider.strip().lower()
    if normalized in {"volcengine", "ark", "doubao"}:
        logger.info("Using Volcengine Ark embeddings model %s", VOLCENGINE_EMBEDDING_MODEL)
        return VolcengineArkEmbeddings()
    if normalized == "huggingface":
        HF_MODELS_DIR.mkdir(parents=True, exist_ok=True)
        logger.info("Using HuggingFace embeddings model %s", HUGGINGFACE_EMBEDDING_MODEL)
        return HuggingFaceEmbeddings(
            model_name=HUGGINGFACE_EMBEDDING_MODEL,
            cache_folder=str(HF_MODELS_DIR),
        )
    raise ValueError(
        f"Unsupported EMBEDDING_PROVIDER={provider!r}. "
        "Supported values are 'volcengine' and 'huggingface'."
    )
