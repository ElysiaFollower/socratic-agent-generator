from sqlalchemy import Column, String
from sqlalchemy.orm import relationship
from .base import Base


class ClassModel(Base):
    __tablename__ = "classes"

    class_id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    owner_id = Column(String, index=True, nullable=False)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)

    memberships = relationship(
        "ClassMembershipModel",
        back_populates="class_",
        cascade="all, delete-orphan",
    )
    invitations = relationship(
        "ClassInvitationCodeModel",
        back_populates="class_",
        cascade="all, delete-orphan",
    )
