from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from sqlmodel import Session, create_engine

from .migrations import run_migrations

DATABASE_URL = "sqlite:///" + str(Path(__file__).resolve().parent.parent / "circuits.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


def init_db() -> None:
    run_migrations(engine)


@contextmanager
def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
