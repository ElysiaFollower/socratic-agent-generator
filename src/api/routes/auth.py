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
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    User,
)
from utils.user_manager import (
    UserAlreadyExistsError,
    UserNotFoundError as UserManagerNotFoundError,
)
from core.dependencies import UserManagerDep

router = APIRouter(prefix="/api/auth", tags=["Auth"])

# JWT configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# HTTP Bearer token security
security = HTTPBearer()


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
    user_manager: UserManagerDep = None,
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
    user_manager: UserManagerDep = None,
) -> dict:
    """Register a new user.

    Registration requirements:
    - Admin: Requires ADMIN_TOKEN from environment variable
    - Teacher/Student: No invitation code required

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
    user_manager: UserManagerDep = None,
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
