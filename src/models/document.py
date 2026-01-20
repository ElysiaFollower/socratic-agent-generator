from sqlalchemy import Column, Integer, String, JSON, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    
    # ✅ 新增：文档所有者
    owner_id = Column(String, ForeignKey("users.user_id"), nullable=False, index=True)
    
    # ✅ 修改：doc_name 不再全局唯一，改为在 owner_id 范围内唯一
    doc_name = Column(String, nullable=False, index=True)  # e.g. "Spectre-Attack"
    
    filename = Column(String)  # e.g. "lab_manual.md" or original upload name
    upload_time = Column(DateTime(timezone=True), server_default=func.now())
    storage_path = Column(String)  # Relative path to the file, contains user_id
    index_path = Column(String)  # Relative path to the vector store, contains user_id
    meta_info = Column(JSON, default={})
    
    # ✅ 关系
    owner = relationship("UserModel", backref="documents")
    
    # ✅ 添加复合唯一约束：同一用户下 doc_name 必须唯一
    __table_args__ = (
        UniqueConstraint('owner_id', 'doc_name', name='uq_documents_owner_doc_name'),
    )
