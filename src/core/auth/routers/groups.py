from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import crud, models, main as auth
from ..dependencies import get_db
from ..schemas import user as user_schema
from datetime import timedelta

router = APIRouter()

@router.post("/groups/join", response_model=user_schema.User)
def join_group(invite_code: str, db: Session = Depends(get_db), current_user: user_schema.User = Depends(auth.get_current_user)):
    group = db.query(models.Group).filter(models.Group.invite_code == invite_code).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    current_user.group_id = group.id
    db.commit()
    db.refresh(current_user)

    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": current_user.username, "role": current_user.role, "group_id": current_user.group_id}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/groups/{group_id}/tutors", response_model=list[user_schema.User])
def read_group_tutors(group_id: int, db: Session = Depends(get_db), current_user: user_schema.User = Depends(auth.get_current_user)):
    if current_user.group_id != group_id and current_user.role != user_schema.Role.admin:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    return [user for user in group.users if user.role == user_schema.Role.teacher]
