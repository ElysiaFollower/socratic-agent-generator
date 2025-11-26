from fastapi import APIRouter
from typing import List
from ..schemas.profile import Profile
from ..utils.ProfileManager import ProfileManager

router = APIRouter()
profile_manager = ProfileManager()

@router.get("/profiles", response_model=List[Profile], summary="Get a list of all available tutor profiles.")
def list_profiles():
    return profile_manager.list_profiles()
