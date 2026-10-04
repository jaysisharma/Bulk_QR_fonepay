@echo off
REM Launcher script for Windows
TITLE Batch QR and Template PDF Generator

echo ==========================================================
echo  Starting Batch QR and Template PDF Generator (Windows)
echo ==========================================================

REM Check Python installation
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python is not installed or not in your PATH.
    echo Please download and install Python from https://python.org
    pause
    exit /b 1
)

REM Create virtual environment if it does not exist
if not exist ".venv" (
    echo [INFO] Creating virtual environment (.venv)...
    python -m venv .venv
)

REM Activate virtual environment
call .venv\Scripts\activate.bat

REM Install dependencies
echo [INFO] Verifying dependencies...
pip install -q -r requirements.txt

REM Launch Streamlit app
echo [INFO] Launching application in your browser...
streamlit run app.py

pause
