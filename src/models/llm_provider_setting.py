"""LLM provider settings models.

This module defines per-provider API key storage and user defaults.
"""

from sqlalchemy import Column, String, ForeignKey

from .base import Base


class LLMProviderSetting(Base):
    """Per-user, per-provider API key and model override."""

    __tablename__ = "llm_provider_settings"

    user_id = Column(String, ForeignKey("users.user_id"), primary_key=True)
    provider = Column(String, primary_key=True)
    api_key = Column(String, nullable=False)
    model = Column(String, nullable=True)


class UserLLMPreference(Base):
    """Per-user default provider and model selection."""

    __tablename__ = "user_llm_preferences"

    user_id = Column(String, ForeignKey("users.user_id"), primary_key=True)
    default_provider = Column(String, nullable=False)
    default_model = Column(String, nullable=True)
