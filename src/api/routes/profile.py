"""Profile management routes.

This module handles HTTP endpoints for tutor profile operations.
"""

from typing import List

from fastapi import APIRouter, HTTPException

from core.dependencies import ProfileManagerDep
from core.exceptions import ProfileNotFoundError
from schemas.profile import Profile

router = APIRouter(prefix="/api/profiles", tags=["Profile"])


@router.get("", response_model=List[Profile], summary="获取所有可用的导师配置列表")
def list_profiles(profile_manager: ProfileManagerDep) -> List[Profile]:
    """List all available tutor profiles.

    Args:
        profile_manager: Injected ProfileManager instance.

    Returns:
        List of Profile objects.
    """
    return profile_manager.list_profiles()


@router.get("/{profile_id}", response_model=Profile, summary="获取指定导师的完整配置")
def get_profile(profile_id: str, profile_manager: ProfileManagerDep) -> Profile:
    """Get a specific tutor profile by ID.

    Args:
        profile_id: The ID of the profile to retrieve.
        profile_manager: Injected ProfileManager instance.

    Returns:
        Profile object.

    Raises:
        HTTPException: 404 if profile not found.
    """
    try:
        return profile_manager.read_profile(profile_id)
    except ProfileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

