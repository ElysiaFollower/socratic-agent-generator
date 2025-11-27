from fastapi import APIRouter, Depends
from typing import List
from ..schemas.profile import Profile
from ..utils.ProfileManager import ProfileManager
from ..core.auth import main as auth
from ..core.auth.schemas import user as user_schema

router = APIRouter()
profile_manager = ProfileManager()

@router.get("/profiles", response_model=List[Profile], summary="Get a list of all available tutor profiles.")
def list_profiles(current_user: user_schema.User = Depends(auth.get_current_user)):
    return profile_manager.list_profiles()
