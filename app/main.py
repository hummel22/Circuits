from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI, HTTPException, status
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select

from .database import get_session, init_db
from .models import Circuit

BASE_DIR = Path(__file__).resolve().parent
SPA_INDEX = BASE_DIR / "static" / "index.html"

app = FastAPI(title="Circuits", description="Create, edit, and run timeboxed circuits.")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")


def serialize_circuit_model(circuit: Circuit) -> Dict[str, Any]:
    return {
        "id": circuit.id,
        "name": circuit.name,
        "description": circuit.description,
        "created_at": circuit.created_at.isoformat() if circuit.created_at else None,
        "tasks": circuit.tasks(),
    }


def validate_circuit_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Circuit payload must be a JSON object.")
    name = payload.get("name")
    description = payload.get("description", "")
    tasks = payload.get("tasks")
    if not name or not isinstance(name, str):
        raise ValueError("Circuit name is required.")
    if not isinstance(description, str):
        raise ValueError("Circuit description must be a string.")
    if not isinstance(tasks, list) or not tasks:
        raise ValueError("Circuit must include a non-empty list of tasks.")

    normalized_tasks = []
    for task in tasks:
        if not isinstance(task, dict):
            raise ValueError("Each task must be an object.")
        task_name = task.get("name")
        task_desc = task.get("description", "")
        duration = task.get("duration")
        if not task_name or not isinstance(task_name, str):
            raise ValueError("Task name is required.")
        if not isinstance(task_desc, str):
            raise ValueError("Task description must be a string.")
        try:
            duration_value = int(duration)
        except (TypeError, ValueError):
            raise ValueError("Task duration must be an integer.")
        if duration_value <= 0:
            raise ValueError("Task duration must be greater than zero.")
        normalized_tasks.append(
            {
                "name": task_name,
                "description": task_desc,
                "duration": duration_value,
            }
        )

    return {"name": name, "description": description, "tasks": normalized_tasks}


@app.on_event("startup")
def on_startup() -> None:
    init_db()


def create_or_update_circuit(session: Session, circuit: Circuit | None, payload: Dict[str, Any]) -> Circuit:
    normalized = validate_circuit_payload(payload)
    tasks_json = json.dumps(normalized["tasks"], ensure_ascii=False)
    if circuit is None:
        circuit = Circuit(
            name=normalized["name"],
            description=normalized["description"],
            tasks_json=tasks_json,
        )
        session.add(circuit)
    else:
        circuit.name = normalized["name"]
        circuit.description = normalized["description"]
        circuit.tasks_json = tasks_json
    session.commit()
    session.refresh(circuit)
    return circuit


def get_circuit_or_404(circuit_id: int) -> Circuit:
    with get_session() as session:
        circuit = session.get(Circuit, circuit_id)
        if circuit is None:
            raise HTTPException(status_code=404, detail="Circuit not found")
        session.expunge(circuit)
        return circuit


@app.get("/api/circuits/{circuit_id}")
def circuit_api(circuit_id: int):
    circuit = get_circuit_or_404(circuit_id)
    return serialize_circuit_model(circuit)


@app.get("/api/circuits")
def circuits_api():
    with get_session() as session:
        circuits = session.exec(select(Circuit).order_by(Circuit.created_at.desc())).all()
    return [serialize_circuit_model(circuit) for circuit in circuits]


@app.post("/api/circuits", status_code=status.HTTP_201_CREATED)
def api_create_circuit(payload: Dict[str, Any]):
    with get_session() as session:
        try:
            circuit = create_or_update_circuit(session, None, payload)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
    return serialize_circuit_model(circuit)


@app.put("/api/circuits/{circuit_id}")
def api_update_circuit(circuit_id: int, payload: Dict[str, Any]):
    with get_session() as session:
        circuit = session.get(Circuit, circuit_id)
        if circuit is None:
            raise HTTPException(status_code=404, detail="Circuit not found")
        try:
            circuit = create_or_update_circuit(session, circuit, payload)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
    return serialize_circuit_model(circuit)


@app.delete("/api/circuits/{circuit_id}", status_code=status.HTTP_204_NO_CONTENT)
def api_delete_circuit(circuit_id: int):
    with get_session() as session:
        circuit = session.get(Circuit, circuit_id)
        if circuit is None:
            raise HTTPException(status_code=404, detail="Circuit not found")
        session.delete(circuit)
        session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/api/circuit-schema")
def circuit_schema():
    schema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "Circuit",
        "type": "object",
        "required": ["name", "tasks"],
        "properties": {
            "name": {"type": "string", "description": "Circuit title"},
            "description": {
                "type": "string",
                "description": "Overview of the circuit",
                "default": "",
            },
            "tasks": {
                "type": "array",
                "minItems": 1,
                "items": {
                    "type": "object",
                    "required": ["name", "duration"],
                    "properties": {
                        "name": {"type": "string"},
                        "description": {"type": "string", "default": ""},
                        "duration": {
                            "type": "integer",
                            "minimum": 1,
                            "description": "Task duration in seconds",
                        },
                    },
                },
            },
        },
        "examples": [
            {
                "name": "Morning Flow",
                "description": "A gentle warm-up routine.",
                "tasks": [
                    {
                        "name": "Stretch",
                        "description": "Full body stretch",
                        "duration": 180,
                    },
                    {
                        "name": "Meditate",
                        "description": "Mindful breathing",
                        "duration": 300,
                    },
                ],
            }
        ],
    }
    return schema


@app.get("/manifest.json")
def manifest() -> FileResponse:
    return FileResponse(BASE_DIR / "static" / "manifest.json")


@app.get("/service-worker.js")
def service_worker() -> FileResponse:
    return FileResponse(BASE_DIR / "static" / "js" / "service-worker.js")


@app.get("/api/health")
def healthcheck():
    return {"status": "ok"}


@app.get("/", include_in_schema=False)
def serve_spa_root() -> FileResponse:
    return FileResponse(SPA_INDEX)


@app.get("/{full_path:path}", include_in_schema=False)
def serve_spa(full_path: str):
    if full_path.startswith("api/") or full_path.startswith("static/"):
        raise HTTPException(status_code=404, detail="Not found")
    if full_path in {"manifest.json", "service-worker.js"}:
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(SPA_INDEX)
