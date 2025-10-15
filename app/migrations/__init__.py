from __future__ import annotations

from datetime import datetime
from typing import Callable, Iterable, Tuple

from sqlalchemy import text
from sqlalchemy.engine import Connection

from sqlmodel import SQLModel

from ..models import CircuitRunSession

Migration = Tuple[str, Callable[[Connection], None]]


def _ensure_history_table(conn: Connection) -> None:
    conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS migration_history (
                version TEXT PRIMARY KEY,
                applied_at TEXT NOT NULL
            )
            """
        )
    )


def _already_applied(conn: Connection) -> set[str]:
    result = conn.execute(text("SELECT version FROM migration_history"))
    return {row[0] for row in result}


def _record_migration(conn: Connection, version: str) -> None:
    conn.execute(
        text(
            "INSERT INTO migration_history (version, applied_at) VALUES (:version, :applied_at)"
        ),
        {"version": version, "applied_at": datetime.utcnow().isoformat()},
    )


def _migration_2024051401(conn: Connection) -> None:
    CircuitRunSession.__table__.create(bind=conn, checkfirst=True)


MIGRATIONS: Iterable[Migration] = [
    ("2024051401_add_circuit_run_sessions", _migration_2024051401),
]


def run_migrations(engine) -> None:
    with engine.begin() as conn:
        _ensure_history_table(conn)
        applied = _already_applied(conn)
        for version, migration in MIGRATIONS:
            if version in applied:
                continue
            migration(conn)
            _record_migration(conn, version)
    # Ensure metadata is updated for fresh databases
    SQLModel.metadata.create_all(engine)
