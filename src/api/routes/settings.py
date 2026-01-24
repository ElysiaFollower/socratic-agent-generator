"""Settings routes for LLM provider configuration."""

import logging
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException

from api.routes.auth import get_current_user
from schemas.llm import (
    LLMDefaultRequest,
    LLMProviderSettingRequest,
    LLMSettingsResponse,
    LLMTestRequest,
)
from schemas.user import User
from utils.llm_manager import get_llm_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/settings", tags=["Settings"])


@router.get("/llm", response_model=LLMSettingsResponse, summary="获取 LLM 设置")
def get_llm_settings(
    current_user: User = Depends(get_current_user),
) -> LLMSettingsResponse:
    manager = get_llm_manager()
    provider_statuses = manager.list_provider_statuses(current_user.user_id)
    default_provider, default_model = manager.get_default_provider(
        current_user.user_id
    )
    return LLMSettingsResponse(
        providers=provider_statuses,
        default_provider=default_provider,
        default_model=default_model,
    )


@router.post("/llm", summary="保存单个供应商配置")
def save_llm_settings(
    req: LLMProviderSettingRequest,
    current_user: User = Depends(get_current_user),
) -> Dict[str, bool]:
    manager = get_llm_manager()
    try:
        manager.save_provider_setting(
            user_id=current_user.user_id,
            provider=req.provider,
            api_key=req.api_key,
            model=req.model,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"success": True}


@router.post("/llm/default", summary="设置默认供应商")
def set_default_provider(
    req: LLMDefaultRequest,
    current_user: User = Depends(get_current_user),
) -> Dict[str, bool]:
    manager = get_llm_manager()
    try:
        manager.set_default_provider(
            user_id=current_user.user_id,
            provider=req.provider,
            model=req.model,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"success": True}


@router.post("/llm/test", summary="测试供应商延时")
def test_llm_latency(
    req: LLMTestRequest,
    current_user: User = Depends(get_current_user),
) -> Dict[str, object]:
    manager = get_llm_manager()
    try:
        result = manager.test_latency(
            provider=req.provider,
            api_key=req.api_key,
            model=req.model,
        )
    except Exception as exc:
        logger.exception("LLM latency test failed")
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, **result}
