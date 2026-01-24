"""LLM settings schemas."""

from typing import List, Optional

from pydantic import BaseModel, Field
from typing import Literal


class LLMProviderSettingRequest(BaseModel):
    provider: str = Field(description="LLM provider name")
    api_key: str = Field(description="Provider API key")
    model: Optional[str] = Field(
        default=None, description="Optional model override"
    )


class LLMDefaultRequest(BaseModel):
    provider: str = Field(description="Default provider name")
    model: Optional[str] = Field(
        default=None, description="Optional default model"
    )


class LLMTestRequest(BaseModel):
    provider: str = Field(description="Provider name")
    api_key: str = Field(description="Provider API key for testing")
    model: Optional[str] = Field(default=None, description="Model to test")


class LLMProviderStatus(BaseModel):
    provider: str
    has_api_key: bool
    model: Optional[str] = None
    source: Literal["user", "preset", "none"] = "none"


class LLMSettingsResponse(BaseModel):
    providers: List[LLMProviderStatus]
    default_provider: str
    default_model: Optional[str] = None
