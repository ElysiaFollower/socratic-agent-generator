import json
from pathlib import Path
from typing import Type, TypeVar, List, Optional
from pydantic import BaseModel
import uuid

T = TypeVar('T', bound=BaseModel)

class DataManager:
    """
    A generic manager for handling Pydantic models as JSON files.
    """
    def __init__(self, directory: Path, model_class: Type[T], id_field: str = "id"):
        """
        Initializes the DataManager.

        Args:
            directory: The directory where the JSON files are stored.
            model_class: The Pydantic model class to manage.
            id_field: The name of the ID field in the model.
        """
        self.directory = directory
        self.model_class = model_class
        self.id_field = id_field
        self.directory.mkdir(parents=True, exist_ok=True)

    def create(self, data: T) -> T:
        """
        Creates a new data entry.

        Args:
            data: The Pydantic model instance to create.

        Returns:
            The created Pydantic model instance with an ID.
        """
        if not getattr(data, self.id_field):
            setattr(data, self.id_field, str(uuid.uuid4()))
        self.save(data)
        return data

    def save(self, data: T) -> None:
        """
        Saves a data entry to a JSON file.

        Args:
            data: The Pydantic model instance to save.
        """
        file_path = self.directory / f"{getattr(data, self.id_field)}.json"
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(data.model_dump_json(indent=2))

    def read(self, id: str) -> Optional[T]:
        """
        Reads a data entry from a JSON file.

        Args:
            id: The ID of the data entry to read.

        Returns:
            The Pydantic model instance, or None if not found.
        """
        file_path = self.directory / f"{id}.json"
        if not file_path.exists():
            return None
        with open(file_path, 'r', encoding='utf-8') as f:
            return self.model_class.model_validate_json(f.read())

    def list(self) -> List[T]:
        """
        Lists all data entries in the directory.

        Returns:
            A list of Pydantic model instances.
        """
        return [self.read(p.stem) for p in self.directory.glob("*.json") if self.read(p.stem) is not None]

    def delete(self, id: str) -> None:
        """
        Deletes a data entry.

        Args:
            id: The ID of the data entry to delete.
        """
        file_path = self.directory / f"{id}.json"
        if file_path.exists():
            file_path.unlink()
