from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base


class ClassMembershipModel(Base):
    __tablename__ = "class_memberships"

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(String, ForeignKey("classes.class_id", ondelete="CASCADE"), index=True)
    user_id = Column(String, ForeignKey("users.user_id", ondelete="CASCADE"), index=True)
    role_in_class = Column(String, nullable=False)
    joined_at = Column(String, nullable=False)

    class_ = relationship("ClassModel", back_populates="memberships")
