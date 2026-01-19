from sqlalchemy import Column, String, JSON, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base

class SessionModel(Base):
    __tablename__ = "sessions"

    session_id = Column(String, primary_key=True, index=True)
    session_name = Column(String)
    owner_id = Column(String, index=True)

    profile_id = Column(String, ForeignKey("profiles.profile_id", ondelete="CASCADE"))

    state = Column(JSON) # SessionState
    history = Column(JSON) # List[Dict]

    output_language = Column(String)

    create_at = Column(String)
    update_at = Column(String)

    # Relationship
    profile = relationship("ProfileModel", back_populates="sessions")
