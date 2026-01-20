import logging
from typing import Optional, List
from sqlalchemy.orm import Session
from models.document import Document
from datetime import datetime

logger = logging.getLogger(__name__)

class DocumentManager:
    """Manages Document operations."""

    def __init__(self, db: Session):
        self.db = db

    def create_document(
        self,
        owner_id: str,  # ✅ 新增：必须指定所有者
        doc_name: str,
        filename: str,
        storage_path: str,
        index_path: str = None,
        meta_info: dict = None
    ) -> Document:
        """Create a new document record."""
        # ✅ 检查同一用户下是否已存在同名文档
        existing = self.get_document_by_owner_and_name(owner_id, doc_name)
        if existing:
            raise ValueError(
                f"Document with name '{doc_name}' already exists for user '{owner_id}'"
            )
        
        db_doc = Document(
            owner_id=owner_id,  # ✅ 设置所有者
            doc_name=doc_name,
            filename=filename,
            storage_path=storage_path,
            index_path=index_path,
            meta_info=meta_info or {},
            upload_time=datetime.utcnow()
        )
        self.db.add(db_doc)
        self.db.commit()
        self.db.refresh(db_doc)
        logger.info(
            "Created document: %s (id=%s, owner=%s)", 
            doc_name, db_doc.id, owner_id
        )
        return db_doc

    # ✅ 新增：按所有者和名称查询
    def get_document_by_owner_and_name(
        self, 
        owner_id: str, 
        doc_name: str
    ) -> Optional[Document]:
        """Get a document by owner_id and doc_name."""
        return self.db.query(Document).filter(
            Document.owner_id == owner_id,
            Document.doc_name == doc_name
        ).first()
    
    # ✅ 修改：按名称查询（保留向后兼容，但需要配合权限检查）
    def get_document_by_name(
        self, 
        doc_name: str,
        owner_id: str = None  # 可选：如果提供，则限制在指定用户范围内
    ) -> Optional[Document]:
        """Get a document by name, optionally filtered by owner."""
        query = self.db.query(Document).filter(Document.doc_name == doc_name)
        if owner_id:
            query = query.filter(Document.owner_id == owner_id)
        return query.first()

    def get_document_by_id(self, doc_id: int) -> Optional[Document]:
        """Get a document by its ID."""
        return self.db.query(Document).filter(Document.id == doc_id).first()

    # ✅ 新增：列出指定用户的所有文档
    def list_documents_by_owner(
        self, 
        owner_id: str
    ) -> List[Document]:
        """List all documents owned by a specific user."""
        return self.db.query(Document).filter(
            Document.owner_id == owner_id
        ).order_by(Document.upload_time.desc()).all()
    
    # ✅ 修改：列出所有文档（仅 admin 使用）
    def list_documents(
        self, 
        owner_id: str = None  # 可选：如果提供，则只返回该用户的文档
    ) -> List[Document]:
        """List all documents, optionally filtered by owner."""
        query = self.db.query(Document)
        if owner_id:
            query = query.filter(Document.owner_id == owner_id)
        return query.order_by(Document.upload_time.desc()).all()

    def delete_document(
        self, 
        doc_name: str,
        owner_id: str  # ✅ 新增：必须指定所有者
    ) -> None:
        """Delete a document by name and owner."""
        doc = self.get_document_by_owner_and_name(owner_id, doc_name)
        if doc:
            self.db.delete(doc)
            self.db.commit()
            logger.info("Deleted document: %s (owner=%s)", doc_name, owner_id)
        else:
            logger.warning(
                "Document not found for deletion: %s (owner=%s)", 
                doc_name, owner_id
            )

    def update_index_path(
        self, 
        doc_name: str, 
        index_path: str,
        owner_id: str = None  # ✅ 可选：如果提供，则限制在指定用户范围内
    ) -> Optional[Document]:
        """Update the index path for a document."""
        doc = self.get_document_by_name(doc_name, owner_id=owner_id)
        if doc:
            doc.index_path = index_path
            self.db.commit()
            self.db.refresh(doc)
            return doc
        return None
