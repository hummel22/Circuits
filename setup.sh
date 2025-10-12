#!/usr/bin/env bash
set -euo pipefail

python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

pushd frontend
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi
npm run build
popd

uvicorn app.main:app --host 0.0.0.0 --port 8000
