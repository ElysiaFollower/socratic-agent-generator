"""Dependency injection module for FastAPI.

This module provides dependency injection functions for FastAPI routes,
following Google Python Style Guide and FastAPI best practices.

Note: Manager instances are singletons to maintain cache consistency
across requests.
"""

from typing import Annotated, Optional

from fastapi import Depends

from utils import profile_manager
from utils import session_manager
from utils import tutor_manager

# Singleton instances for managers (to maintain cache consistency)
_profile_manager_instance: Optional[profile_manager.ProfileManager] = None
_session_manager_instance: Optional[session_manager.SessionManager] = None
_tutor_manager_instance: Optional[tutor_manager.TutorManager] = None


def get_profile_manager() -> profile_manager.ProfileManager:
    """Get ProfileManager singleton instance.

    Returns:
        ProfileManager instance (singleton).
    """
    global _profile_manager_instance
    if _profile_manager_instance is None:
        _profile_manager_instance = profile_manager.ProfileManager()
    return _profile_manager_instance


def get_session_manager() -> session_manager.SessionManager:
    """Get SessionManager singleton instance.

    Returns:
        SessionManager instance (singleton).
    """
    global _session_manager_instance
    if _session_manager_instance is None:
        _session_manager_instance = session_manager.SessionManager()
    return _session_manager_instance


def get_tutor_manager() -> tutor_manager.TutorManager:
    """Get TutorManager singleton instance.

    Returns:
        TutorManager instance (singleton).
    """
    global _tutor_manager_instance
    if _tutor_manager_instance is None:
        _tutor_manager_instance = tutor_manager.TutorManager()
    return _tutor_manager_instance


# Type aliases for dependency injection
ProfileManagerDep = Annotated[
    profile_manager.ProfileManager, Depends(get_profile_manager)
]
SessionManagerDep = Annotated[
    session_manager.SessionManager, Depends(get_session_manager)
]
TutorManagerDep = Annotated[
    tutor_manager.TutorManager, Depends(get_tutor_manager)
]

