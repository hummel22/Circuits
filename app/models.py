from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

from sqlmodel import Field, SQLModel


class Circuit(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    description: str
    tasks_json: str
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)

    def tasks(self) -> List[Dict[str, Any]]:
        from json import loads

        try:
            data = loads(self.tasks_json)
            if isinstance(data, list):
                return data
        except Exception:
            pass
        return []
