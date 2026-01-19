from sqlalchemy import Column, Integer, String, JSON, DateTime
from sqlalchemy.sql import func
from .base import Base

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    doc_name = Column(String, unique=True, index=True, nullable=False) # e.g. "Spectre-Attack"
    filename = Column(String) # e.g. "lab_manual.md" or original upload name
    upload_time = Column(DateTime(timezone=True), server_default=func.now())
    storage_path = Column(String) # Relative path to the file
    index_path = Column(String) # Relative path to the vector store
    meta_info = Column(JSON, default={})
