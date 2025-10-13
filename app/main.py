from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from fastapi import FastAPI, HTTPException, status
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select

from .database import get_session, init_db
from .models import Circuit, CircuitRun, CircuitRunTask

BASE_DIR = Path(__file__).resolve().parent
SPA_DIR = BASE_DIR / "static"
SPA_INDEX = SPA_DIR / "index.html"
SPA_ASSETS_DIR = SPA_DIR / "assets"

app = FastAPI(title="Circuits", description="Create, edit, and run timeboxed circuits.")

if SPA_ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=SPA_ASSETS_DIR), name="spa-assets")


TASK_STATUS_VALUES = {"completed", "skipped", "not_done"}


def format_datetime(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat().replace("+00:00", "Z")


def parse_iso_datetime(raw: Any, field_name: str) -> datetime:
    if raw is None:
        return datetime.utcnow()
    if not isinstance(raw, str):
        raise ValueError(f"{field_name} must be an ISO 8601 string.")
    value = raw.strip()
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f"{field_name} must be an ISO 8601 string.") from exc
    if parsed.tzinfo is None:
        return parsed
    return parsed.astimezone(timezone.utc).replace(tzinfo=None)


def serialize_run_model(
    run: CircuitRun,
    tasks: List[CircuitRunTask] | None = None,
    circuit: Circuit | None = None,
) -> Dict[str, Any]:
    total = run.total_duration_seconds or 0
    completed = run.completed_duration_seconds or 0
    completion_rate = completed / total if total > 0 else 0.0
    task_records: List[Dict[str, Any]] = []
    for task in sorted(tasks or [], key=lambda item: item.task_index):
        task_records.append(
            {
                "index": task.task_index,
                "name": task.name,
                "description": task.description,
                "duration": task.duration,
                "status": task.status,
            }
        )

    return {
        "id": run.id,
        "circuit": {
            "id": circuit.id if circuit else run.circuit_id,
            "name": circuit.name if circuit else None,
        },
        "circuit_id": run.circuit_id,
        "started_at": format_datetime(run.started_at),
        "ended_at": format_datetime(run.ended_at),
        "total_duration_seconds": total,
        "completed_duration_seconds": completed,
        "completion_rate": completion_rate,
        "completion_percentage": round(completion_rate * 100, 2),
        "tasks": task_records,
    }


def serialize_circuit_model(circuit: Circuit) -> Dict[str, Any]:
    return {
        "id": circuit.id,
        "name": circuit.name,
        "description": circuit.description,
        "created_at": format_datetime(circuit.created_at),
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


def record_circuit_run(
    session: Session, circuit: Circuit, payload: Dict[str, Any]
) -> tuple[CircuitRun, List[CircuitRunTask]]:
    if circuit.id is None:
        raise ValueError("Circuit must be persisted before recording runs.")
    if not isinstance(payload, dict):
        raise ValueError("Run payload must be a JSON object.")

    circuit_tasks = circuit.tasks()
    if not circuit_tasks:
        raise ValueError("Circuit must have tasks to record a run.")

    tasks_payload = payload.get("tasks")
    if not isinstance(tasks_payload, list):
        raise ValueError("Run payload must include a tasks array.")

    status_map: Dict[int, str] = {}
    for item in tasks_payload:
        if not isinstance(item, dict):
            raise ValueError("Each task result must be an object.")
        index = item.get("index")
        status = item.get("status")
        if not isinstance(index, int) or index < 0:
            raise ValueError("Task index must be a non-negative integer.")
        if index >= len(circuit_tasks):
            raise ValueError("Task index is out of range for this circuit.")
        if status not in TASK_STATUS_VALUES:
            raise ValueError("Task status must be one of completed, skipped, or not_done.")
        status_map[index] = status

    started_at = parse_iso_datetime(payload.get("started_at"), "started_at")
    ended_at = parse_iso_datetime(payload.get("ended_at"), "ended_at")
    if ended_at < started_at:
        raise ValueError("ended_at cannot be before started_at.")

    total_duration = 0
    completed_duration = 0
    normalized_results: List[Dict[str, Any]] = []
    for index, task in enumerate(circuit_tasks):
        name = task.get("name", "")
        description = task.get("description", "")
        duration = task.get("duration", 0)
        try:
            duration_value = int(duration)
        except (TypeError, ValueError):
            duration_value = 0
        if duration_value < 0:
            duration_value = 0
        status = status_map.get(index, "not_done")
        total_duration += duration_value
        if status == "completed":
            completed_duration += duration_value
        normalized_results.append(
            {
                "index": index,
                "name": name,
                "description": description,
                "duration": duration_value,
                "status": status,
            }
        )

    run = CircuitRun(
        circuit_id=circuit.id,
        started_at=started_at,
        ended_at=ended_at,
        total_duration_seconds=total_duration,
        completed_duration_seconds=completed_duration,
    )
    session.add(run)
    session.flush()

    task_models = [
        CircuitRunTask(
            run_id=run.id,
            task_index=item["index"],
            name=item["name"],
            description=item["description"],
            duration=item["duration"],
            status=item["status"],
        )
        for item in normalized_results
    ]
    session.add_all(task_models)
    session.commit()
    session.refresh(run)
    return run, task_models


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


@app.post("/api/circuits/{circuit_id}/runs", status_code=status.HTTP_201_CREATED)
def api_create_run(circuit_id: int, payload: Dict[str, Any]):
    with get_session() as session:
        circuit = session.get(Circuit, circuit_id)
        if circuit is None:
            raise HTTPException(status_code=404, detail="Circuit not found")
        try:
            run, tasks = record_circuit_run(session, circuit, payload)
        except ValueError as exc:
            session.rollback()
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        data = serialize_run_model(run, tasks, circuit)
    return data


@app.get("/api/runs")
def api_list_runs():
    with get_session() as session:
        runs = session.exec(select(CircuitRun).order_by(CircuitRun.started_at.desc())).all()
        if not runs:
            return []

        run_ids = [run.id for run in runs if run.id is not None]
        tasks_map: Dict[int, List[CircuitRunTask]] = {}
        if run_ids:
            tasks = session.exec(
                select(CircuitRunTask).where(CircuitRunTask.run_id.in_(run_ids))
            ).all()
            for task in tasks:
                tasks_map.setdefault(task.run_id, []).append(task)

        circuit_ids = {run.circuit_id for run in runs}
        circuits = session.exec(select(Circuit).where(Circuit.id.in_(circuit_ids))).all()
        circuit_map = {c.id: c for c in circuits}

        data = [
            serialize_run_model(
                run,
                tasks_map.get(run.id or -1, []),
                circuit_map.get(run.circuit_id),
            )
            for run in runs
        ]
    return data


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


@app.get("/api/health")
def healthcheck():
    return {"status": "ok"}


@app.get("/", include_in_schema=False)
def serve_spa_root() -> FileResponse:
    if not SPA_INDEX.exists():
        raise HTTPException(status_code=503, detail="SPA bundle not found. Run the frontend build.")
    return FileResponse(SPA_INDEX)


@app.get("/{full_path:path}", include_in_schema=False)
def serve_spa(full_path: str):
    if full_path.startswith("api/") or full_path.startswith("static/"):
        raise HTTPException(status_code=404, detail="Not found")

    if full_path in {"manifest.json", "service-worker.js"}:
        candidate = (SPA_DIR / full_path).resolve()
        try:
            candidate.relative_to(SPA_DIR)
        except ValueError:
            candidate = None
        if candidate and candidate.is_file():
            return FileResponse(candidate)
        raise HTTPException(status_code=404, detail="Not found")
    if not SPA_INDEX.exists():
        raise HTTPException(status_code=503, detail="SPA bundle not found. Run the frontend build.")

    candidate = (SPA_DIR / full_path).resolve()
    try:
        candidate.relative_to(SPA_DIR)
    except ValueError:
        candidate = None

    if candidate and candidate.is_file():
        return FileResponse(candidate)

    return FileResponse(SPA_INDEX)
