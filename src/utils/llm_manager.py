"""LLM instance and settings management.

This module provides a cache layer for LLM instances and CRUD helpers
for per-provider API key storage and user defaults.
"""

import logging
import os
import time
from typing import Dict, List, Optional, Tuple

from cryptography.fernet import Fernet
from langchain_openai import ChatOpenAI

from config import DEFAULT_LLM_PROVIDER, LLM_PROVIDERS, TEMPERATURE
from core.database import SessionLocal
from models.llm_provider_setting import LLMProviderSetting, UserLLMPreference

logger = logging.getLogger(__name__)

_ENCRYPTION_KEY = os.getenv("LLM_API_KEY_ENCRYPTION_KEY")
_CIPHER = Fernet(_ENCRYPTION_KEY.encode()) if _ENCRYPTION_KEY else None
if not _CIPHER:
    logger.warning(
        "LLM_API_KEY_ENCRYPTION_KEY not set; API keys will be stored in plain text."
    )

_llm_manager_instance: Optional["LLMManager"] = None


def get_llm_manager() -> "LLMManager":
    """Return a singleton LLMManager instance."""
    global _llm_manager_instance
    if _llm_manager_instance is None:
        _llm_manager_instance = LLMManager()
    return _llm_manager_instance


class LLMManager:
    """Manages active LLM instances and user settings."""

    def __init__(self) -> None:
        self.active_llms: Dict[str, ChatOpenAI] = {}
        logger.info("LLMManager initialized")

    def _encrypt_api_key(self, api_key: str) -> str:
        if _CIPHER:
            return _CIPHER.encrypt(api_key.encode()).decode()
        return api_key

    def _decrypt_api_key(self, encrypted_key: str) -> str:
        if _CIPHER:
            return _CIPHER.decrypt(encrypted_key.encode()).decode()
        return encrypted_key

    def _validate_provider(self, provider: str) -> None:
        if provider not in LLM_PROVIDERS:
            raise ValueError(f"Unsupported provider: {provider}")

    def _get_env_api_key(self, provider: str) -> Optional[str]:
        """Return provider API key from environment if set."""
        env_key = LLM_PROVIDERS.get(provider, {}).get("env_key")
        return os.getenv(env_key) if env_key else None

    def list_provider_statuses(self, user_id: str) -> List[Dict[str, object]]:
        """Return per-provider status for the user (no API keys)."""
        with SessionLocal() as db:
            settings = (
                db.query(LLMProviderSetting)
                .filter(LLMProviderSetting.user_id == user_id)
                .all()
            )
            settings_by_provider = {s.provider: s for s in settings}

        results: List[Dict[str, object]] = []
        for provider in LLM_PROVIDERS.keys():
            setting = settings_by_provider.get(provider)
            env_key = self._get_env_api_key(provider)
            source = "none"
            if setting and setting.api_key:
                source = "user"
            elif env_key:
                source = "preset"
            results.append(
                {
                    "provider": provider,
                    "has_api_key": source != "none",
                    "source": source,
                    "model": setting.model if setting else None,
                }
            )
        return results

    def save_provider_setting(
        self,
        user_id: str,
        provider: str,
        api_key: str,
        model: Optional[str] = None,
    ) -> None:
        """Upsert a provider setting for the user."""
        self._validate_provider(provider)
        encrypted_key = self._encrypt_api_key(api_key)
        with SessionLocal() as db:
            setting = (
                db.query(LLMProviderSetting)
                .filter(
                    LLMProviderSetting.user_id == user_id,
                    LLMProviderSetting.provider == provider,
                )
                .first()
            )
            if setting:
                setting.api_key = encrypted_key
                setting.model = model
            else:
                setting = LLMProviderSetting(
                    user_id=user_id,
                    provider=provider,
                    api_key=encrypted_key,
                    model=model,
                )
                db.add(setting)
            db.commit()
        self.invalidate_user(user_id)

    def delete_provider_setting(self, user_id: str, provider: str) -> None:
        """Delete a provider setting for the user."""
        self._validate_provider(provider)
        with SessionLocal() as db:
            setting = (
                db.query(LLMProviderSetting)
                .filter(
                    LLMProviderSetting.user_id == user_id,
                    LLMProviderSetting.provider == provider,
                )
                .first()
            )
            if setting:
                db.delete(setting)
                db.commit()
        self.invalidate_user(user_id)

    def get_default_provider(self, user_id: str) -> Tuple[str, Optional[str]]:
        """Return the user's default provider/model, falling back to env."""
        with SessionLocal() as db:
            pref = (
                db.query(UserLLMPreference)
                .filter(UserLLMPreference.user_id == user_id)
                .first()
            )
        if pref:
            return pref.default_provider, pref.default_model
        return DEFAULT_LLM_PROVIDER, None

    def set_default_provider(
        self,
        user_id: str,
        provider: str,
        model: Optional[str] = None,
    ) -> None:
        """Set the user's default provider/model."""
        self._validate_provider(provider)
        with SessionLocal() as db:
            pref = (
                db.query(UserLLMPreference)
                .filter(UserLLMPreference.user_id == user_id)
                .first()
            )
            if pref:
                pref.default_provider = provider
                pref.default_model = model
            else:
                pref = UserLLMPreference(
                    user_id=user_id,
                    default_provider=provider,
                    default_model=model,
                )
                db.add(pref)
            db.commit()
        self.invalidate_user(user_id)

    def get_llm(
        self,
        user_id: str,
        provider: Optional[str] = None,
        model: Optional[str] = None,
    ) -> ChatOpenAI:
        """Get an LLM instance for the user and provider/model."""
        resolved_provider = provider
        resolved_model = model

        if not resolved_provider:
            resolved_provider, default_model = self.get_default_provider(user_id)
            if not resolved_model:
                resolved_model = default_model

        self._validate_provider(resolved_provider)

        cache_key = f"{user_id}:{resolved_provider}:{resolved_model or 'default'}"
        cached = self.active_llms.get(cache_key)
        if cached:
            return cached

        with SessionLocal() as db:
            setting = (
                db.query(LLMProviderSetting)
                .filter(
                    LLMProviderSetting.user_id == user_id,
                    LLMProviderSetting.provider == resolved_provider,
                )
                .first()
            )

        if setting:
            api_key = self._decrypt_api_key(setting.api_key)
            resolved_model = (
                resolved_model
                or setting.model
                or LLM_PROVIDERS[resolved_provider]["default_model"]
            )
        else:
            env_key = LLM_PROVIDERS[resolved_provider]["env_key"]
            api_key = os.getenv(env_key) if env_key else None
            resolved_model = (
                resolved_model or LLM_PROVIDERS[resolved_provider]["default_model"]
            )

        base_url = LLM_PROVIDERS[resolved_provider]["base_url"]
        kwargs = {
            "model": resolved_model,
            "api_key": api_key,
            "temperature": TEMPERATURE,
        }
        if base_url:
            kwargs["base_url"] = base_url

        llm = ChatOpenAI(**kwargs)
        self.active_llms[cache_key] = llm
        return llm

    def invalidate_user(self, user_id: str) -> None:
        """Invalidate all cached LLMs for the user."""
        keys_to_remove = [k for k in self.active_llms if k.startswith(f"{user_id}:")]
        for key in keys_to_remove:
            del self.active_llms[key]

    def test_latency(
        self,
        provider: str,
        api_key: str,
        model: Optional[str] = None,
    ) -> Dict[str, Optional[float]]:
        """Run a minimal test request and return latency in ms."""
        self._validate_provider(provider)
        resolved_model = model or LLM_PROVIDERS[provider]["default_model"]
        base_url = LLM_PROVIDERS[provider]["base_url"]
        kwargs = {
            "model": resolved_model,
            "api_key": api_key,
            "temperature": 0,
        }
        if base_url:
            kwargs["base_url"] = base_url

        llm = ChatOpenAI(**kwargs)
        start = time.perf_counter()
        llm.invoke("ping")
        latency_ms = (time.perf_counter() - start) * 1000.0
        return {"latency_ms": round(latency_ms, 2)}
