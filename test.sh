#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR/backend"

echo "==================================================="
echo "Running Smart Waste Management Test Suite"
echo "==================================================="

if [ ! -d "venv" ]; then
    echo "[INFO] Creating virtual environment at backend/venv..."
    python3 -m venv venv || python -m venv venv
    ./venv/bin/pip install --upgrade pip
    ./venv/bin/pip install -r requirements.txt
fi

./venv/bin/pytest tests -v
echo ""
echo "==================================================="
echo "All tests PASSED successfully!"
echo "==================================================="
