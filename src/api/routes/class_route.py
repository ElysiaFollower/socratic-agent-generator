"""Class management routes."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status

from api.routes.auth import get_current_user
from core.dependencies import ClassManagerDep, ProfileManagerDep
from core.exceptions import ProfileNotFoundError
from schemas.class_schema import (
    ClassInfo,
    ClassInvitationCodeInfo,
    ClassInvitationCodeListResponse,
    ClassMemberInfo,
    CreateClassRequest,
    GenerateClassInvitationCodeRequest,
    JoinClassRequest,
    UpdateClassInvitationCodeRequest,
    UpdateProfileVisibilityRequest,
)
from schemas.profile import Profile
from schemas.user import User
from utils.class_manager import ClassNotFoundError

router = APIRouter(prefix="/api/classes", tags=["Class"])


def _build_class_info(model, role_in_class: Optional[str] = None) -> ClassInfo:
    return ClassInfo(
        class_id=model.class_id,
        name=model.name,
        owner_id=model.owner_id,
        created_at=model.created_at,
        updated_at=model.updated_at,
        role_in_class=role_in_class,
    )


@router.post("", response_model=ClassInfo, summary="创建班级")
def create_class(
    req: CreateClassRequest,
    class_manager: ClassManagerDep,
    current_user: User = Depends(get_current_user),
) -> ClassInfo:
    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can create classes.",
        )
    name = req.name.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Class name cannot be empty.",
        )
    class_model = class_manager.create_class(name, current_user.user_id)
    return _build_class_info(class_model, role_in_class="teacher")


@router.get("", response_model=List[ClassInfo], summary="列出班级")
def list_classes(
    class_manager: ClassManagerDep,
    current_user: User = Depends(get_current_user),
) -> List[ClassInfo]:
    if current_user.role in ["admin", "teacher"]:
        models = class_manager.list_classes_for_owner(current_user.user_id)
        return [_build_class_info(model, role_in_class="teacher") for model in models]

    memberships = class_manager.list_classes_for_user(current_user.user_id)
    results = []
    for membership in memberships:
        try:
            model = class_manager.get_class(membership.class_id)
        except ClassNotFoundError:
            continue
        results.append(_build_class_info(model, role_in_class=membership.role_in_class))
    return results


@router.post("/join", response_model=ClassInfo, summary="通过邀请码加入班级")
def join_class(
    req: JoinClassRequest,
    class_manager: ClassManagerDep,
    current_user: User = Depends(get_current_user),
) -> ClassInfo:
    """Join a class using an invitation code.

    Any registered user (admin, teacher, or student) can join a class
    using a valid invitation code.

    Args:
        req: Join request with invitation code.
        class_manager: Injected ClassManager instance.
        current_user: Current authenticated user.

    Returns:
        ClassInfo for the joined class.

    Raises:
        HTTPException: If invitation code is invalid or class not found.
    """
    try:
        class_id = class_manager.join_by_invitation_code(
            req.invitation_code.strip(), current_user.user_id
        )
        model = class_manager.get_class(class_id)
        # Determine role in class
        memberships = class_manager.list_classes_for_user(current_user.user_id)
        role_in_class = None
        for membership in memberships:
            if membership.class_id == class_id:
                role_in_class = membership.role_in_class
                break
        return _build_class_info(model, role_in_class=role_in_class)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except ClassNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found",
        )


@router.post(
    "/{class_id}/invite",
    response_model=ClassInvitationCodeInfo,
    summary="生成班级邀请码",
)
def generate_class_invitation(
    class_id: str,
    req: GenerateClassInvitationCodeRequest,
    class_manager: ClassManagerDep,
    current_user: User = Depends(get_current_user),
) -> ClassInvitationCodeInfo:
    try:
        class_model = class_manager.get_class(class_id)
    except ClassNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found",
        )

    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can generate class invitation codes.",
        )
    if current_user.role == "teacher" and class_model.owner_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only class owners can generate invitations.",
        )

    model = class_manager.generate_invitation_code(
        class_id=class_id,
        created_by=current_user.user_id,
        expires_in_days=req.expires_in_days,
    )
    return ClassInvitationCodeInfo(
        invitation_code=model.code,
        class_id=model.class_id,
        created_by=model.created_by,
        created_at=model.created_at,
        expires_at=model.expires_at,
    )


@router.get(
    "/{class_id}/invites",
    response_model=ClassInvitationCodeListResponse,
    summary="列出班级邀请码",
)
def list_class_invitations(
    class_id: str,
    class_manager: ClassManagerDep,
    current_user: User = Depends(get_current_user),
) -> ClassInvitationCodeListResponse:
    try:
        class_model = class_manager.get_class(class_id)
    except ClassNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found",
        )

    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can list class invitations.",
        )
    if current_user.role == "teacher" and class_model.owner_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only class owners can list invitations.",
        )

    models = class_manager.list_invitation_codes(class_id=class_id)
    results = [
        ClassInvitationCodeInfo(
            invitation_code=model.code,
            class_id=model.class_id,
            created_by=model.created_by,
            created_at=model.created_at,
            expires_at=model.expires_at,
        )
        for model in models
    ]
    return ClassInvitationCodeListResponse(invitation_codes=results)


@router.delete(
    "/{class_id}/invites/{code}",
    summary="删除班级邀请码",
)
def delete_class_invitation_code(
    class_id: str,
    code: str,
    class_manager: ClassManagerDep,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Delete a class invitation code.

    Permission requirements:
    - Admin: Can delete any invitation code
    - Teacher: Can only delete invitation codes for classes they own
    - Student: No permission

    Args:
        class_id: Class ID.
        code: Invitation code to delete.
        class_manager: Injected ClassManager instance.
        current_user: Current authenticated user.

    Returns:
        Dictionary with success message.

    Raises:
        HTTPException: If permission denied or code not found.
    """
    try:
        class_model = class_manager.get_class(class_id)
    except ClassNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found",
        )

    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can delete class invitation codes.",
        )
    if current_user.role == "teacher" and class_model.owner_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only class owners can delete invitations.",
        )

    # Verify the code belongs to this class
    codes = class_manager.list_invitation_codes(class_id=class_id)
    if not any(c.code == code for c in codes):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation code not found for this class.",
        )

    try:
        class_manager.delete_invitation_code(code)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    return {"success": True, "message": "Invitation code deleted successfully"}


@router.patch(
    "/{class_id}/invites/{code}",
    response_model=ClassInvitationCodeInfo,
    summary="更新班级邀请码过期日期",
)
def update_class_invitation_code(
    class_id: str,
    code: str,
    req: UpdateClassInvitationCodeRequest,
    class_manager: ClassManagerDep,
    current_user: User = Depends(get_current_user),
) -> ClassInvitationCodeInfo:
    """Update the expiration date of a class invitation code.

    Permission requirements:
    - Admin: Can update any invitation code
    - Teacher: Can only update invitation codes for classes they own
    - Student: No permission

    Args:
        class_id: Class ID.
        code: Invitation code to update.
        req: Request with new expiration days.
        class_manager: Injected ClassManager instance.
        current_user: Current authenticated user.

    Returns:
        Updated ClassInvitationCodeInfo.

    Raises:
        HTTPException: If permission denied or code not found.
    """
    try:
        class_model = class_manager.get_class(class_id)
    except ClassNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found",
        )

    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can update class invitation codes.",
        )
    if current_user.role == "teacher" and class_model.owner_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only class owners can update invitations.",
        )

    # Verify the code belongs to this class
    codes = class_manager.list_invitation_codes(class_id=class_id)
    if not any(c.code == code for c in codes):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation code not found for this class.",
        )

    try:
        model = class_manager.update_invitation_code_expires_at(
            code, req.expires_in_days
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return ClassInvitationCodeInfo(
        invitation_code=model.code,
        class_id=model.class_id,
        created_by=model.created_by,
        created_at=model.created_at,
        expires_at=model.expires_at,
    )


@router.get(
    "/{class_id}/members",
    response_model=List[ClassMemberInfo],
    summary="列出班级成员",
)
def list_class_members(
    class_id: str,
    class_manager: ClassManagerDep,
    current_user: User = Depends(get_current_user),
) -> List[ClassMemberInfo]:
    try:
        class_model = class_manager.get_class(class_id)
    except ClassNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found",
        )

    members = class_manager.list_members(class_id)
    return [ClassMemberInfo(**member) for member in members]


@router.patch(
    "/{class_id}/profiles/{profile_id}",
    response_model=Profile,
    summary="设置班级内Profile可见性",
)
def update_profile_visibility(
    class_id: str,
    profile_id: str,
    req: UpdateProfileVisibilityRequest,
    class_manager: ClassManagerDep,
    profile_manager: ProfileManagerDep,
    current_user: User = Depends(get_current_user),
) -> Profile:
    try:
        class_model = class_manager.get_class(class_id)
    except ClassNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found",
        )

    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can update profile visibility.",
        )
    if current_user.role == "teacher" and class_model.owner_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only class owners can update profile visibility.",
        )

    try:
        profile = profile_manager.read_profile(profile_id)
    except ProfileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found",
        )
    if profile.owner_id and current_user.role == "teacher":
        if profile.owner_id != current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update your own profiles.",
            )

    visible_ids = set(profile.visible_class_ids or [])
    if req.visible:
        visible_ids.add(class_id)
    else:
        visible_ids.discard(class_id)

    updated_profile = profile.model_copy(
        update={"visible_class_ids": list(visible_ids)}
    )
    return profile_manager.save_profile(updated_profile)


@router.delete("/{class_id}", summary="删除班级")
def delete_class(
    class_id: str,
    class_manager: ClassManagerDep,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Delete a class and all related data.

    Only the class owner can delete the class.

    Args:
        class_id: Class ID to delete.
        class_manager: Injected ClassManager instance.
        current_user: Current authenticated user.

    Returns:
        Dictionary with success message.

    Raises:
        HTTPException: If permission denied or class not found.
    """
    try:
        class_model = class_manager.get_class(class_id)
    except ClassNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found",
        )

    if current_user.role not in ["admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can delete classes.",
        )
    if current_user.role == "teacher" and class_model.owner_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only class owners can delete the class.",
        )

    try:
        class_manager.delete_class(class_id, current_user.user_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )

    return {"success": True, "message": "Class deleted successfully"}


@router.delete(
    "/{class_id}/leave",
    summary="离开班级",
)
def leave_class(
    class_id: str,
    class_manager: ClassManagerDep,
    current_user: User = Depends(get_current_user),
) -> dict:
    """Leave a class (remove current user's membership).

    Non-owner members can leave a class. The class owner cannot leave their own class.

    Args:
        class_id: Class ID to leave.
        class_manager: Injected ClassManager instance.
        current_user: Current authenticated user.

    Returns:
        Dictionary with success message.

    Raises:
        HTTPException: If user is owner or not a member, or class not found.
    """
    try:
        class_manager.leave_class(class_id, current_user.user_id)
    except ClassNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )

    return {"success": True, "message": "Left class successfully"}
