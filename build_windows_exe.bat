@echo off
TITLE Build QR Studio Windows Standalone Executable (.exe)
CD /D "%~dp0"

echo ==========================================================
echo        Building QR Studio Standalone Windows EXE
echo ==========================================================

REM Check Python
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python not found in PATH.
    pause
    exit /b 1
)

REM Setup build environment
if not exist ".venv" (
    echo [INFO] Creating .venv...
    python -m venv .venv
)

call .venv\Scripts\activate.bat

echo [INFO] Installing required build tools and dependencies...
pip install -q -r requirements-windows.txt
pip install -q pyinstaller

echo [INFO] Building standalone executable with PyInstaller...
pyinstaller --noconfirm --onedir --windowed ^
    --name "QR_Studio" ^
    --add-data "app.py;." ^
    --add-data "pdf_generator.py;." ^
    --add-data "sample_assets;sample_assets" ^
    --copy-metadata streamlit ^
    --hidden-import "streamlit" ^
    --hidden-import "streamlit_cropper" ^
    --hidden-import "pymupdf" ^
    --hidden-import "fitz" ^
    --hidden-import "PIL" ^
    --hidden-import "qrcode" ^
    --hidden-import "webview" ^
    desktop_app.py

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ==========================================================
    echo [SUCCESS] Windows executable built successfully!
    echo Location: dist\QR_Studio\QR_Studio.exe
    echo ==========================================================
    echo.
) else (
    echo [ERROR] Build failed. Please inspect the logs above.
)

pause
