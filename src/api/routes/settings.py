"""Settings routes for LLM provider configuration."""

import logging
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException

from api.routes.auth import get_current_user
from core.dependencies import RemoteMachineManagerDep
from schemas.llm import (
    LLMDefaultRequest,
    LLMProviderSettingRequest,
    LLMSettingsResponse,
    LLMTestRequest,
)
from schemas.remote_machine import (
    RemoteMachineCreate,
    RemoteMachineSummary,
    RemoteMachineTestResponse,
    RemoteMachineUpdate,
)
from schemas.user import User
from utils.remote_machine_manager import RemoteMachineNotFoundError
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


@router.delete("/llm/{provider}", summary="删除单个供应商配置")
def delete_llm_settings(
    provider: str,
    current_user: User = Depends(get_current_user),
) -> Dict[str, bool]:
    manager = get_llm_manager()
    try:
        manager.delete_provider_setting(current_user.user_id, provider)
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


@router.get(
    "/remote-machines",
    response_model=list[RemoteMachineSummary],
    summary="获取远程实验机设置",
)
def list_remote_machines(
    remote_manager: RemoteMachineManagerDep,
    current_user: User = Depends(get_current_user),
) -> list[RemoteMachineSummary]:
    return remote_manager.list_machines(current_user.user_id)


@router.post(
    "/remote-machines",
    response_model=RemoteMachineSummary,
    summary="保存远程实验机设置",
)
def create_remote_machine(
    req: RemoteMachineCreate,
    remote_manager: RemoteMachineManagerDep,
    current_user: User = Depends(get_current_user),
) -> RemoteMachineSummary:
    try:
        return remote_manager.create_machine(current_user.user_id, req)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put(
    "/remote-machines/{machine_id}",
    response_model=RemoteMachineSummary,
    summary="更新远程实验机设置",
)
def update_remote_machine(
    machine_id: str,
    req: RemoteMachineUpdate,
    remote_manager: RemoteMachineManagerDep,
    current_user: User = Depends(get_current_user),
) -> RemoteMachineSummary:
    try:
        return remote_manager.update_machine(current_user.user_id, machine_id, req)
    except RemoteMachineNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/remote-machines/{machine_id}", summary="删除远程实验机设置")
def delete_remote_machine(
    machine_id: str,
    remote_manager: RemoteMachineManagerDep,
    current_user: User = Depends(get_current_user),
) -> Dict[str, bool]:
    try:
        remote_manager.delete_machine(current_user.user_id, machine_id)
    except RemoteMachineNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"success": True}


@router.post(
    "/remote-machines/{machine_id}/test",
    response_model=RemoteMachineTestResponse,
    summary="测试远程实验机连接",
)
def test_remote_machine(
    machine_id: str,
    remote_manager: RemoteMachineManagerDep,
    current_user: User = Depends(get_current_user),
) -> RemoteMachineTestResponse:
    try:
        return remote_manager.test_machine(current_user.user_id, machine_id)
    except RemoteMachineNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
