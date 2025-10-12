# Circuits

Circuits is a self-contained web application that lets you create, store, edit, and run training circuits backed by a local SQLite database. The PrimeVue-powered Material Design interface and the JSON API are served from the same FastAPI service, making it easy to run locally or inside a container.

## Features

- 📚 **Circuit library** – Store as many named circuits as you like. Each circuit contains an ordered list of tasks with names, descriptions, and durations in seconds.
- 📤 **Flexible imports** – Paste JSON into the builder or upload a JSON file directly in the browser dialog. Validation ensures the data fits the expected schema.
- 🛠️ **Visual editor** – Use the PrimeVue builder to add, remove, and reorder steps with duration controls—no raw JSON editing required.
- 📄 **JSON schema export** – Visit `/api/circuit-schema` to retrieve a JSON Schema plus an example payload (perfect for AI assistants).
- ⏱️ **Guided runner** – Start a circuit to see the active task, remaining time, and the upcoming task in muted text. Configure finish actions (sound, vibration, or both), toggle 5-second countdown alerts, and pause or stop the timer at any time.
- 💾 **Local persistence** – All data is stored in `circuits.db` using SQLite.
- 📱 **Installable experience** – A web app manifest and service worker enable PWA installation on Android devices and offline caching of core assets.

## Project layout

```
app/
├── main.py              # FastAPI application and routes
├── models.py            # SQLModel definitions
├── database.py          # SQLite engine helpers
├── templates/           # Legacy Jinja templates (unused by the SPA runtime)
└── static/              # SPA entrypoint, CSS, JS, icons, manifest, and service worker
```

## Running locally

The repository provides a convenience script that bootstraps a virtual environment, installs dependencies, and launches the development server:

```bash
./setup.sh
```

The application becomes available at <http://127.0.0.1:8000>. The first run creates `circuits.db` in the project root.

### Manual setup

If you prefer to manage the environment yourself:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Docker

Build and run the container with Docker Compose:

```bash
docker compose up --build
```

This maps the service to <http://localhost:8000> and persists `circuits.db` to the host.

## JSON schema

The circuit schema is available at <http://localhost:8000/api/circuit-schema>:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Circuit",
  "type": "object",
  "required": ["name", "tasks"],
  "properties": {
    "name": {"type": "string"},
    "description": {"type": "string"},
    "tasks": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "duration"],
        "properties": {
          "name": {"type": "string"},
          "description": {"type": "string"},
          "duration": {"type": "integer", "minimum": 1}
        }
      }
    }
  }
}
```

Use this document to validate payloads or guide automated agents that generate circuits.
