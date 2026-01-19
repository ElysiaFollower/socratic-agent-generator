"""Authentication routes.

This module handles HTTP endpoints for user authentication and registration.
"""

import logging
import os
from datetime import datetime, timedelta
from typing import Optional

import pytz
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

from config import ADMIN_TOKEN

logger = logging.getLogger(__name__)

from schemas.user import (
    CurrentUserResponse,
    GenerateInvitationCodeRequest,
    GenerateInvitationCodeResponse,
    InvitationCodeInfo,
    InvitationCodeListResponse,
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    User,
)
from utils.user_manager import (
    UserAlreadyExistsError,
    UserManager,
    UserNotFoundError as UserManagerNotFoundError,
)

router = APIRouter(prefix="/api/auth", tags=["Auth"])

# JWT configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# HTTP Bearer token security
security = HTTPBearer()

# Singleton instance for UserManager
_user_manager_instance: Optional[UserManager] = None


def get_user_manager() -> UserManager:
    """Get UserManager singleton instance.

    Returns:
        UserManager instance (singleton).
    """
    global _user_manager_instance
    if _user_manager_instance is None:
        _user_manager_instance = UserManager()
    return _user_manager_instance


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token.

    Args:
        data: Data to encode in the token.
        expires_delta: Optional expiration time delta.

    Returns:
        Encoded JWT token string.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(pytz.utc) + expires_delta
    else:
        expire = datetime.now(pytz.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Verify JWT token from Authorization header.

    Args:
        credentials: HTTP Bearer token credentials.

    Returns:
        Decoded token payload.

    Raises:
        HTTPException: If token is invalid or expired.
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
            )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )


def get_current_user(
    token_payload: dict = Depends(verify_token),
    user_manager: UserManager = Depends(get_user_manager),
) -> User:
    """Get current authenticated user.

    Args:
        token_payload: Decoded JWT token payload.
        user_manager: Injected UserManager instance.

    Returns:
        Current User object.

    Raises:
        HTTPException: If user is not found.
    """
    username = token_payload.get("sub")
    if username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
    user = user_manager.get_user_by_username(username)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


@router.post("/register", summary="用户注册")
def register(
    req: RegisterRequest,
    user_manager: UserManager = Depends(get_user_manager),
) -> dict:
    """Register a new user.

    Registration requirements:
    - Admin: Requires ADMIN_TOKEN from environment variable
    - Teacher: Requires invitation code from admin
    - Student: Requires invitation code from admin or teacher

    Args:
        req: Registration request with username, password, role, etc.
        user_manager: Injected UserManager instance.

    Returns:
        Dictionary with success message and user_id.

    Raises:
        HTTPException: If registration fails.
    """
    # Validate role
    if req.role not in ["admin", "teacher", "student"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role: {req.role}. Must be 'admin', 'teacher', or 'student'.",
        )

    # Validate admin registration
    if req.role == "admin":
        # Debug: Log ADMIN_TOKEN value (masked for security)
        admin_token_value = ADMIN_TOKEN if ADMIN_TOKEN else None
        admin_token_display = (
            f"{admin_token_value[:4]}...{admin_token_value[-4:]}"
            if admin_token_value and len(admin_token_value) > 8
            else admin_token_value if admin_token_value else "None"
        )
        request_token_display = (
            f"{req.admin_token[:4]}...{req.admin_token[-4:]}"
            if req.admin_token and len(req.admin_token) > 8
            else req.admin_token if req.admin_token else "None"
        )
        
        logger.info("=== Admin Registration Debug Info ===")
        logger.info(f"ADMIN_TOKEN from config: {admin_token_display}")
        logger.info(f"ADMIN_TOKEN length: {len(ADMIN_TOKEN) if ADMIN_TOKEN else 0}")
        logger.info(f"ADMIN_TOKEN is None: {ADMIN_TOKEN is None}")
        logger.info(f"Request admin_token: {request_token_display}")
        logger.info(f"Request admin_token length: {len(req.admin_token) if req.admin_token else 0}")
        logger.info(f"Request admin_token is None: {req.admin_token is None}")
        
        if not ADMIN_TOKEN:
            logger.error("ADMIN_TOKEN is not set in environment variables")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Admin registration is not configured. ADMIN_TOKEN not set.",
            )
        if req.admin_token != ADMIN_TOKEN:
            logger.error(
                f"Admin token mismatch. Expected: {admin_token_display}, "
                f"Got: {request_token_display}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid admin token",
            )
        logger.info("Admin token validation passed")

    # Validate teacher/student registration
    if req.role in ["teacher", "student"]:
        if not req.invitation_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invitation code required for {req.role} registration",
            )
        is_valid, error_msg = user_manager.validate_invitation_code(
            req.invitation_code, req.role
        )
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg or "Invalid invitation code",
            )

    # Create user
    try:
        # Debug: Log password info before creating user
        logger.info("=== Password Debug Info ===")
        logger.info(f"Password type: {type(req.password)}")
        logger.info(f"Password length: {len(req.password)}")
        logger.info(f"Password bytes length: {len(req.password.encode('utf-8'))}")
        logger.info(f"Password value (first 20 chars): {req.password[:20]}")
        
        user = user_manager.create_user(
            username=req.username,
            password=req.password,
            role=req.role,
            display_name=req.display_name,
            email=req.email,
        )
    except UserAlreadyExistsError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )

    return {
        "success": True,
        "message": "User registered successfully",
        "user_id": user.user_id,
    }


@router.post("/login", summary="用户登录")
def login(
    req: LoginRequest,
    user_manager: UserManager = Depends(get_user_manager),
) -> LoginResponse:
    """Login with username and password.

    Args:
        req: Login request with username and password.
        user_manager: Injected UserManager instance.

    Returns:
        LoginResponse with user information and JWT token.

    Raises:
        HTTPException: If login fails.
    """
    user = user_manager.get_user_by_username(req.username)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    if not user_manager.verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )

    # Return user info without password
    user_dict = user.model_dump()
    user_dict.pop("password_hash", None)

    return LoginResponse(user=user_dict, token=access_token)


@router.post("/logout", summary="用户登出")
def logout() -> dict:
    """Logout endpoint.

    Note: Since we're using stateless JWT tokens, logout is handled
    client-side by removing the token. This endpoint exists for API
    consistency.

    Returns:
        Dictionary with success message.
    """
    return {"success": True, "message": "Logged out successfully"}


@router.get("/me", response_model=CurrentUserResponse, summary="获取当前用户信息")
def get_current_user_info(
    current_user: User = Depends(get_current_user),
) -> CurrentUserResponse:
    """Get current authenticated user information.

    Args:
        current_user: Current authenticated user from dependency.

    Returns:
        CurrentUserResponse with user information.
    """
    user_dict = current_user.model_dump()
    user_dict.pop("password_hash", None)
    return CurrentUserResponse(user=user_dict)


@router.post(
    "/invitation-codes/generate",
    response_model=GenerateInvitationCodeResponse,
    summary="生成邀请码（管理员/教师）",
)
def generate_invitation_code(
    req: GenerateInvitationCodeRequest,
    current_user: User = Depends(get_current_user),
    user_manager: UserManager = Depends(get_user_manager),
) -> GenerateInvitationCodeResponse:
    """Generate an invitation code for teacher or student registration.

    Only admins can generate codes for both teacher and student roles.
    Teachers can only generate codes for student role.

    Args:
        req: Request with role and expiration days.
        current_user: Current authenticated user from dependency.
        user_manager: Injected UserManager instance.

    Returns:
        GenerateInvitationCodeResponse with invitation code and details.

    Raises:
        HTTPException: If user doesn't have permission or role is invalid.
    """
    # Validate role
    if req.role not in ["teacher", "student"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role: {req.role}. Must be 'teacher' or 'student'.",
        )

    # Check permissions
    if current_user.role == "admin":
        # Admin can generate codes for both teacher and student
        pass
    elif current_user.role == "teacher":
        # Teacher can only generate codes for student
        if req.role != "student":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Teachers can only generate invitation codes for students.",
            )
    else:
        # Student cannot generate codes
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can generate invitation codes.",
        )

    # Generate invitation code
    try:
        code = user_manager.generate_invitation_code(
            role=req.role,
            created_by=current_user.username,
            expires_in_days=req.expires_in_days,
        )

        # Get expiration date
        from datetime import timedelta

        expires_at = datetime.now(pytz.utc) + timedelta(days=req.expires_in_days)

        return GenerateInvitationCodeResponse(
            invitation_code=code,
            role=req.role,
            created_by=current_user.username,
            expires_in_days=req.expires_in_days,
            expires_at=expires_at.isoformat(),
        )
    except Exception as e:
        logger.error(f"Failed to generate invitation code: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate invitation code: {str(e)}",
        )


@router.get(
    "/invitation-codes",
    response_model=InvitationCodeListResponse,
    summary="列出邀请码（管理员/教师）",
)
def list_invitation_codes(
    current_user: User = Depends(get_current_user),
    user_manager: UserManager = Depends(get_user_manager),
) -> InvitationCodeListResponse:
    """List invitation codes created by the current user.

    Args:
        current_user: Current authenticated user from dependency.
        user_manager: Injected UserManager instance.

    Returns:
        InvitationCodeListResponse with invitation code list.
    """
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can list invitation codes.",
        )

    codes = user_manager.list_invitation_codes(created_by=current_user.username)
    results: list[InvitationCodeInfo] = []

    for code in codes:
        results.append(
            InvitationCodeInfo(
                invitation_code=code.get("code", ""),
                role=code.get("role", ""),
                created_by=code.get("created_by", ""),
                created_at=code.get("created_at", ""),
                expires_at=code.get("expires_at"),
            )
        )

    return InvitationCodeListResponse(invitation_codes=results)
