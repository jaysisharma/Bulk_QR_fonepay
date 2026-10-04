@echo off
TITLE QR Studio - Print Layout
CD /D "%~dp0"

echo ==========================================================
echo       Starting QR Studio - Print Layout (Windows)
echo ==========================================================

REM Check if Python is installed
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python is not installed or not in your system PATH.
    echo.
    echo Please install Python 3.10, 3.11, 3.12, or 3.13 from:
    echo https://www.python.org/downloads/
    echo.
    echo IMPORTANT: During installation, make sure to CHECK the box:
    echo           "Add python.exe to PATH"
    echo.
    pause
    exit /b 1
)

REM Create virtual environment if it does not exist
if not exist ".venv" (
    echo [INFO] First-time setup: Creating isolated Python environment (.venv)...
    python -m venv .venv
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
)

REM Activate virtual environment
call .venv\Scripts\activate.bat

REM Check and install dependencies
echo [INFO] Verifying packages...
pip install -q -r requirements-windows.txt

echo.
echo [INFO] Launching QR Studio Desktop App...
echo [INFO] (You can close this command window after the app opens, or leave it running)
echo.

python desktop_app.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [NOTICE] Desktop window closed or encountered an issue.
    echo [INFO] Launching in default web browser fallback...
    streamlit run app.py --server.maxMessageSize=1024 --server.maxUploadSize=1024
)

pause
