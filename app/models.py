from __future__ import annotations

from datetime import datetime
from typing import Any, Dict

from sqlmodel import Field, SQLModel


class Circuit(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    description: str
    tasks_json: str
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)

    def tasks(self) -> list[Dict[str, Any]]:
        from json import loads

        try:
            data = loads(self.tasks_json)
            if isinstance(data, list):
                return data
        except Exception:
            pass
        return []


class CircuitRun(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    circuit_id: int = Field(foreign_key="circuit.id", nullable=False, index=True)
    started_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    ended_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    total_duration_seconds: int = Field(default=0, nullable=False)
    completed_duration_seconds: int = Field(default=0, nullable=False)


class CircuitRunTask(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    run_id: int = Field(foreign_key="circuitrun.id", nullable=False, index=True)
    task_index: int = Field(nullable=False)
    name: str
    description: str
    duration: int = Field(nullable=False)
    status: str = Field(nullable=False)
