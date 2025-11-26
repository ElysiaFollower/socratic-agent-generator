from pydantic import BaseModel
from typing import List, Optional
from enum import Enum

class Role(str, Enum):
    admin = "admin"
    teacher = "teacher"
    student = "student"

class UserBase(BaseModel):
    username: str
    email: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    role: Role
    group_id: Optional[int] = None

    class Config:
        orm_mode = True

class GroupBase(BaseModel):
    name: str
    description: Optional[str] = None

class GroupCreate(GroupBase):
    pass

class Group(GroupBase):
    id: int
    users: List[User] = []

    class Config:
        orm_mode = True
