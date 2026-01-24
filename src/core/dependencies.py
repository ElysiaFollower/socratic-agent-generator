"""Dependency injection module for FastAPI.

This module provides dependency injection functions for FastAPI routes,
following Google Python Style Guide and FastAPI best practices.
"""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from core.database import get_db
from utils import profile_manager
from utils import session_manager
from utils import tutor_manager
from utils import document_manager
from utils import user_manager
from utils import class_manager
from utils import custom_skill_manager
from utils import step_completion_manager

# Singleton for TutorManager (memory cache)
_tutor_manager_instance: tutor_manager.TutorManager = None


def get_profile_manager(db: Session = Depends(get_db)) -> profile_manager.ProfileManager:
    """Get ProfileManager instance with request-scoped DB session.

    Args:
        db: Database session.

    Returns:
        ProfileManager instance.
    """
    return profile_manager.ProfileManager(db)


def get_session_manager(db: Session = Depends(get_db)) -> session_manager.SessionManager:
    """Get SessionManager instance with request-scoped DB session.

    Args:
        db: Database session.

    Returns:
        SessionManager instance.
    """
    return session_manager.SessionManager(db)


def get_document_manager(db: Session = Depends(get_db)) -> document_manager.DocumentManager:
    """Get DocumentManager instance with request-scoped DB session.

    Args:
        db: Database session.

    Returns:
        DocumentManager instance.
    """
    return document_manager.DocumentManager(db)


def get_tutor_manager() -> tutor_manager.TutorManager:
    """Get TutorManager singleton instance.

    Returns:
        TutorManager instance (singleton).
    """
    global _tutor_manager_instance
    if _tutor_manager_instance is None:
        _tutor_manager_instance = tutor_manager.TutorManager()
    return _tutor_manager_instance


def get_user_manager(db: Session = Depends(get_db)) -> user_manager.UserManager:
    """Get UserManager instance with request-scoped DB session.

    Args:
        db: Database session.

    Returns:
        UserManager instance.
    """
    return user_manager.UserManager(db)


def get_class_manager(db: Session = Depends(get_db)) -> class_manager.ClassManager:
    """Get ClassManager instance with request-scoped DB session."""
    return class_manager.ClassManager(db)


def get_custom_skill_manager(
    db: Session = Depends(get_db),
) -> custom_skill_manager.CustomSkillManager:
    """Get CustomSkillManager instance with request-scoped DB session."""
    return custom_skill_manager.CustomSkillManager(db)


def get_step_completion_manager(
    db: Session = Depends(get_db),
) -> step_completion_manager.StepCompletionManager:
    """Get StepCompletionManager instance with request-scoped DB session."""
    return step_completion_manager.StepCompletionManager(db)


# Type aliases for dependency injection
ProfileManagerDep = Annotated[
    profile_manager.ProfileManager, Depends(get_profile_manager)
]
SessionManagerDep = Annotated[
    session_manager.SessionManager, Depends(get_session_manager)
]
DocumentManagerDep = Annotated[
    document_manager.DocumentManager, Depends(get_document_manager)
]
TutorManagerDep = Annotated[
    tutor_manager.TutorManager, Depends(get_tutor_manager)
]
UserManagerDep = Annotated[
    user_manager.UserManager, Depends(get_user_manager)
]
ClassManagerDep = Annotated[
    class_manager.ClassManager, Depends(get_class_manager)
]
CustomSkillManagerDep = Annotated[
    custom_skill_manager.CustomSkillManager, Depends(get_custom_skill_manager)
]
StepCompletionManagerDep = Annotated[
    step_completion_manager.StepCompletionManager,
    Depends(get_step_completion_manager),
]
