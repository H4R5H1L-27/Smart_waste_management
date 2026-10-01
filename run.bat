@echo off
setlocal
echo ===================================================
echo Starting Smart Waste Management System (FastAPI)
echo ===================================================

cd /d "%~dp0backend"

if not exist "venv\Scripts\python.exe" (
    echo [INFO] Virtual environment not found. Setting up backend\venv...
    py -3.11 -m venv venv 2>nul || py -3 -m venv venv 2>nul || python -m venv venv
    if not exist "venv\Scripts\python.exe" (
        echo [ERROR] Python not found or failed to create virtual environment.
        echo Please ensure Python 3.10+ is installed and on your PATH.
        pause
        exit /b 1
    )
    echo [INFO] Installing dependencies from requirements.txt...
    venv\Scripts\python -m pip install --upgrade pip
    venv\Scripts\pip install -r requirements.txt
)

echo.
echo ===================================================
echo Server starting on http://127.0.0.1:8000 ...
echo Main Operations Dashboard: http://127.0.0.1:8000/
echo CivicLens Citizen Portal:  http://127.0.0.1:8000/civiclens
echo API Docs (Swagger UI):     http://127.0.0.1:8000/docs
echo ===================================================
echo Press Ctrl+C to stop.
echo.

venv\Scripts\python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
