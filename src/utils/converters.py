from schemas.profile import Profile
from schemas.session import Session, SessionState
from schemas.curriculum import SocraticCurriculum
from schemas.user import User
from models.profile import ProfileModel
from models.session import SessionModel
from models.user import UserModel
from models.invitation_code import InvitationCodeModel

def profile_to_model(profile: Profile, document_id: int = None) -> ProfileModel:
    """Convert Pydantic Profile to SQLAlchemy ProfileModel."""
    return ProfileModel(
        profile_id=profile.profile_id,
        profile_name=profile.profile_name,
        topic_name=profile.topic_name,
        lab_name=profile.lab_name,
        document_id=document_id,
        persona_hints=profile.persona_hints,
        target_audience=profile.target_audience,
        curriculum=profile.curriculum.model_dump(), # Convert to dict/list
        prompt_template=profile.prompt_template,
        create_at=profile.create_at,
    )

def model_to_profile(model: ProfileModel) -> Profile:
    """Convert SQLAlchemy ProfileModel to Pydantic Profile."""
    # Handle curriculum conversion
    # model.curriculum should be a list (from JSON column)
    curriculum = SocraticCurriculum.model_validate(model.curriculum)

    return Profile(
        profile_id=model.profile_id,
        profile_name=model.profile_name,
        topic_name=model.topic_name,
        lab_name=model.lab_name,
        persona_hints=model.persona_hints or [],
        target_audience=model.target_audience,
        curriculum=curriculum,
        prompt_template=model.prompt_template,
        create_at=model.create_at,
    )

def session_to_model(session: Session) -> SessionModel:
    """Convert Pydantic Session to SQLAlchemy SessionModel."""
    return SessionModel(
        session_id=session.session_id,
        session_name=session.session_name,
        owner_id=session.owner_id,
        profile_id=session.profile.profile_id,
        state=session.state.model_dump(),
        history=session.history,
        output_language=session.output_language,
        create_at=session.create_at,
        update_at=session.update_at,
    )

def model_to_session(model: SessionModel, profile: Profile = None) -> Session:
    """Convert SQLAlchemy SessionModel to Pydantic Session.

    Args:
        model: The SessionModel instance.
        profile: The converted Pydantic Profile object. If None, it will be
                 derived from model.profile (which must be eagerly loaded).
    """
    if profile is None:
        if model.profile is None:
            raise ValueError("Profile not loaded for session")
        profile = model_to_profile(model.profile)

    return Session(
        session_id=model.session_id,
        session_name=model.session_name,
        owner_id=model.owner_id,
        profile=profile,
        state=SessionState.model_validate(model.state) if model.state else SessionState(),
        history=model.history or [],
        output_language=model.output_language,
        create_at=model.create_at,
        update_at=model.update_at,
    )


def user_to_model(user: User) -> UserModel:
    """Convert Pydantic User to SQLAlchemy UserModel.

    Args:
        user: The User Pydantic object.

    Returns:
        UserModel instance.
    """
    return UserModel(
        user_id=user.user_id,
        username=user.username,
        password_hash=user.password_hash,
        role=user.role,
        display_name=user.display_name,
        email=user.email,
        create_at=user.create_at,
    )


def model_to_user(model: UserModel) -> User:
    """Convert SQLAlchemy UserModel to Pydantic User.

    Args:
        model: The UserModel instance.

    Returns:
        User Pydantic object.
    """
    return User(
        user_id=model.user_id,
        username=model.username,
        password_hash=model.password_hash,
        role=model.role,
        display_name=model.display_name,
        email=model.email,
        create_at=model.create_at,
    )
