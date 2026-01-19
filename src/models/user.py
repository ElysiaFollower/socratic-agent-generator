"""User database model.

This module defines the User database model using SQLAlchemy.
"""

from sqlalchemy import Column, String
from .base import Base


class UserModel(Base):
    """User database model."""

    __tablename__ = "users"

    user_id = Column(String, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # 'admin', 'teacher', or 'student'
    display_name = Column(String, nullable=True)
    email = Column(String, nullable=True)
    create_at = Column(String, nullable=False)  # ISO format string
