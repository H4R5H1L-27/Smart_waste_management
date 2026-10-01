@echo off
setlocal
echo ===================================================
echo Running Smart Waste Management Test Suite
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

venv\Scripts\python -m pytest tests -v
if %ERRORLEVEL% equ 0 (
    echo.
    echo ===================================================
    echo All tests PASSED successfully!
    echo ===================================================
) else (
    echo.
    echo [ERROR] Tests failed with error code %ERRORLEVEL%.
)
