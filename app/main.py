from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict
from urllib.parse import quote_plus

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlmodel import Session, select

from .database import get_session, init_db
from .models import Circuit

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(title="Circuits", description="Create, edit, and run timeboxed circuits.")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


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


@app.middleware("http")
async def add_request_state(request: Request, call_next):
    response = await call_next(request)
    return response


@app.get("/", response_class=HTMLResponse)
def read_index(request: Request):
    with get_session() as session:
        circuits = session.exec(select(Circuit).order_by(Circuit.created_at.desc())).all()
    serialized = []
    for circuit in circuits:
        serialized.append(
            {
                "id": circuit.id,
                "name": circuit.name,
                "description": circuit.description,
                "tasks": circuit.tasks(),
            }
        )
    error = request.query_params.get("error")
    context = {
        "request": request,
        "circuits": serialized,
        "error": error,
        "form_payload": request.query_params.get("payload", ""),
    }
    return templates.TemplateResponse("index.html", context)


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


@app.post("/circuits")
def create_circuit(payload: str = Form(...)):
    try:
        data = json.loads(payload)
    except json.JSONDecodeError as exc:
        return RedirectResponse(
            url=f"/?error={quote_plus(f'Invalid JSON: {exc}')}&payload={quote_plus(payload)}",
            status_code=303,
        )

    with get_session() as session:
        try:
            circuit = create_or_update_circuit(session, None, data)
        except ValueError as exc:
            return RedirectResponse(
                url=f"/?error={quote_plus(str(exc))}&payload={quote_plus(json.dumps(data))}",
                status_code=303,
            )
    return RedirectResponse(url=f"/circuits/{circuit.id}", status_code=303)


@app.post("/circuits/upload")
async def upload_circuit(file: UploadFile = File(...)):
    content = await file.read()
    try:
        data = json.loads(content)
    except json.JSONDecodeError as exc:
        return RedirectResponse(
            url=f"/?error={quote_plus(f'Invalid JSON: {exc}')}",
            status_code=303,
        )

    with get_session() as session:
        try:
            circuit = create_or_update_circuit(session, None, data)
        except ValueError as exc:
            return RedirectResponse(url=f"/?error={quote_plus(str(exc))}", status_code=303)
    return RedirectResponse(url=f"/circuits/{circuit.id}", status_code=303)


def get_circuit_or_404(circuit_id: int) -> Circuit:
    with get_session() as session:
        circuit = session.get(Circuit, circuit_id)
        if circuit is None:
            raise HTTPException(status_code=404, detail="Circuit not found")
        session.expunge(circuit)
        return circuit


@app.get("/circuits/{circuit_id}", response_class=HTMLResponse)
def view_circuit(request: Request, circuit_id: int):
    circuit = get_circuit_or_404(circuit_id)
    tasks = circuit.tasks()
    context = {
        "request": request,
        "circuit": {
            "id": circuit.id,
            "name": circuit.name,
            "description": circuit.description,
            "created_at": circuit.created_at,
            "tasks": tasks,
        },
    }
    return templates.TemplateResponse("circuit_detail.html", context)


@app.get("/circuits/{circuit_id}/edit", response_class=HTMLResponse)
def edit_circuit(request: Request, circuit_id: int):
    circuit = get_circuit_or_404(circuit_id)
    payload = json.dumps(
        {
            "name": circuit.name,
            "description": circuit.description,
            "tasks": circuit.tasks(),
        },
        indent=2,
        ensure_ascii=False,
    )
    context = {
        "request": request,
        "circuit": circuit,
        "payload": payload,
        "error": request.query_params.get("error"),
    }
    return templates.TemplateResponse("edit_circuit.html", context)


@app.post("/circuits/{circuit_id}/edit")
def update_circuit(circuit_id: int, payload: str = Form(...)):
    try:
        data = json.loads(payload)
    except json.JSONDecodeError as exc:
        return RedirectResponse(
            url=f"/circuits/{circuit_id}/edit?error=Invalid+JSON:+{exc}", status_code=303
        )

    with get_session() as session:
        circuit = session.get(Circuit, circuit_id)
        if circuit is None:
            raise HTTPException(status_code=404, detail="Circuit not found")
        try:
            create_or_update_circuit(session, circuit, data)
        except ValueError as exc:
            return RedirectResponse(
                url=f"/circuits/{circuit_id}/edit?error={quote_plus(str(exc))}",
                status_code=303,
            )
    return RedirectResponse(url=f"/circuits/{circuit_id}", status_code=303)


@app.get("/circuits/{circuit_id}/run", response_class=HTMLResponse)
def run_circuit(request: Request, circuit_id: int):
    circuit = get_circuit_or_404(circuit_id)
    data = {
        "id": circuit.id,
        "name": circuit.name,
        "description": circuit.description,
        "tasks": circuit.tasks(),
    }
    context = {
        "request": request,
        "circuit": circuit,
        "circuit_data": data,
    }
    return templates.TemplateResponse("circuit_run.html", context)


@app.get("/api/circuits/{circuit_id}")
def circuit_api(circuit_id: int):
    circuit = get_circuit_or_404(circuit_id)
    return {
        "id": circuit.id,
        "name": circuit.name,
        "description": circuit.description,
        "tasks": circuit.tasks(),
    }


@app.get("/api/circuits")
def circuits_api():
    with get_session() as session:
        circuits = session.exec(select(Circuit)).all()
    return [
        {
            "id": circuit.id,
            "name": circuit.name,
            "description": circuit.description,
            "tasks": circuit.tasks(),
        }
        for circuit in circuits
    ]


@app.get("/circuit-schema")
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


@app.get("/health")
def healthcheck():
    return {"status": "ok"}
