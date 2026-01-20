from sqlalchemy import Column, String, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base


class ClassInvitationCodeModel(Base):
    __tablename__ = "class_invitation_codes"

    code = Column(String, primary_key=True, index=True)
    class_id = Column(String, ForeignKey("classes.class_id", ondelete="CASCADE"), index=True)
    created_by = Column(String, nullable=False)
    created_at = Column(String, nullable=False)
    expires_at = Column(String, nullable=True)

    class_ = relationship("ClassModel", back_populates="invitations")
