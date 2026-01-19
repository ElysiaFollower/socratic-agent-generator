"""Invitation code database model.

This module defines the InvitationCode database model using SQLAlchemy.
"""

from sqlalchemy import Column, String
from .base import Base


class InvitationCodeModel(Base):
    """Invitation code database model."""

    __tablename__ = "invitation_codes"

    code = Column(String, primary_key=True, index=True)
    role = Column(String, nullable=False)  # 'teacher' or 'student'
    created_by = Column(String, nullable=False)  # username
    created_at = Column(String, nullable=False)  # ISO format string
    expires_at = Column(String, nullable=True)  # ISO format string
