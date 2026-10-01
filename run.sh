#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR/backend"

echo "==================================================="
echo "Starting Smart Waste Management System (FastAPI)"
echo "==================================================="

if [ ! -d "venv" ]; then
    echo "[INFO] Creating virtual environment at backend/venv..."
    python3 -m venv venv || python -m venv venv
    echo "[INFO] Installing dependencies..."
    ./venv/bin/pip install --upgrade pip
    ./venv/bin/pip install -r requirements.txt
fi

echo ""
echo "==================================================="
echo "Server starting on http://127.0.0.1:8000 ..."
echo "Main Operations Dashboard: http://127.0.0.1:8000/"
echo "CivicLens Citizen Portal:  http://127.0.0.1:8000/civiclens"
echo "API Docs (Swagger UI):     http://127.0.0.1:8000/docs"
echo "==================================================="
echo "Press Ctrl+C to stop."
echo ""

./venv/bin/uvicorn main:app --reload --host 0.0.0.0 --port 8000
