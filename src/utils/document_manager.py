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
        doc_name: str,
        filename: str,
        storage_path: str,
        index_path: str = None,
        meta_info: dict = None
    ) -> Document:
        """Create a new document record."""
        db_doc = Document(
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
        logger.info("Created document: %s (id=%s)", doc_name, db_doc.id)
        return db_doc

    def get_document_by_name(self, doc_name: str) -> Optional[Document]:
        """Get a document by its unique doc_name (lab_name)."""
        return self.db.query(Document).filter(Document.doc_name == doc_name).first()

    def get_document_by_id(self, doc_id: int) -> Optional[Document]:
        """Get a document by its ID."""
        return self.db.query(Document).filter(Document.id == doc_id).first()

    def list_documents(self) -> List[Document]:
        """List all documents."""
        return self.db.query(Document).all()

    def delete_document(self, doc_name: str) -> None:
        """Delete a document by name."""
        doc = self.get_document_by_name(doc_name)
        if doc:
            self.db.delete(doc)
            self.db.commit()
            logger.info("Deleted document: %s", doc_name)
        else:
            logger.warning("Document not found for deletion: %s", doc_name)

    def update_index_path(self, doc_name: str, index_path: str) -> Optional[Document]:
        """Update the index path for a document."""
        doc = self.get_document_by_name(doc_name)
        if doc:
            doc.index_path = index_path
            self.db.commit()
            self.db.refresh(doc)
            return doc
        return None
