from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import crud, models, main as auth
from ..dependencies import get_db
from ..schemas import user as user_schema

router = APIRouter()

@router.post("/users/", response_model=user_schema.User)
def create_user(user: user_schema.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db=db, user=user)

@router.get("/users/", response_model=list[user_schema.User])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: user_schema.User = Depends(auth.get_current_user)):
    if current_user.role != user_schema.Role.admin:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    users = crud.get_users(db, skip=skip, limit=limit)
    return users

@router.get("/users/{user_id}", response_model=user_schema.User)
def read_user(user_id: int, db: Session = Depends(get_db), current_user: user_schema.User = Depends(auth.get_current_user)):
    if current_user.role != user_schema.Role.admin and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    db_user = crud.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user

@router.get("/users/me/group", response_model=user_schema.Group)
def read_user_group(db: Session = Depends(get_db), current_user: user_schema.User = Depends(auth.get_current_user)):
    return current_user.group
