# new file: utils/managers.py

import json
from pathlib import Path
from typing import List

import sys
from pathlib import Path
# Add the src directory to sys.path
sys.path.append(str(Path(__file__).resolve().parents[1]))
from config import PROFILES_DIR
from schemas.profile import Profile


class ProfileManager:
    """Handles loading and listing of teaching profiles."""

    def list_profiles(self) -> List[Profile]:
        """Lists available profiles with their topic names."""
        profile_list = []
        for p_file in PROFILES_DIR.glob("*.json"):
            try:
                with open(p_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    profile_list.append(Profile.model_validate(data))
            except (json.JSONDecodeError, Exception) as e: 
                print(f"Warning[ProfileManager]：list_profiles :skip Profile: {p_file.name} . Due to error: {e}")
                continue 
        
        # Sort by creation time, newest first
        profile_list.sort(key=lambda p: p.create_at, reverse=True)
        return profile_list

    @staticmethod
    def read_profile(profile_id: str):
        """reads a profile from disk"""
        profile_path = PROFILES_DIR / f"{profile_id}.json"
        if not profile_path.exists():
            raise FileNotFoundError(f"Profile {profile_id} does not exist")
        with open(profile_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return Profile.model_validate(data)
    
    @staticmethod
    def save_profile(profile: Profile):
        """saves a profile to disk"""
        profile_path = PROFILES_DIR / f"{profile.profile_id}.json"
        with open(profile_path, 'w', encoding='utf-8') as f:
            json.dump(profile.model_dump(), f, ensure_ascii=False, indent=2)
        return profile
    
    @staticmethod
    def delete_profile(profile_id: str):
        """deletes a profile from disk"""
        profile_path = PROFILES_DIR / f"{profile_id}.json"
        if not profile_path.exists():
            return 
        profile_path.unlink()
