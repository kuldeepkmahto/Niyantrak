@echo off
REM ============================================================
REM start-with-ml.bat
REM Launches the Node backend AND the Python ML service together,
REM each in its own window, so you only run one command.
REM
REM Place this file in your NiyanTrak project ROOT folder
REM (same folder as start.bat, package.json, backend\, frontend\)
REM ============================================================

echo Starting NiyanTrak backend + ML risk service...
echo.

REM --- Start the Node backend in its own window ---
start "NiyanTrak Backend (Node)" cmd /k "cd /d %~dp0backend && npm run dev:demo"

REM small delay so windows don't overlap while opening
timeout /t 2 /nobreak >nul

REM --- Start the ML service in its own window ---
REM Activates your existing .venv, then runs uvicorn on port 8001
start "NiyanTrak ML Service (Python)" cmd /k "cd /d %~dp0backend\ml && call %~dp0.venv\Scripts\activate.bat && uvicorn serve_model:app --host 0.0.0.0 --port 8001"

echo.
echo Two windows should now be open:
echo   1. NiyanTrak Backend (Node)      -^> http://localhost:5000
echo   2. NiyanTrak ML Service (Python) -^> http://localhost:8001
echo.
echo Close either window (or Ctrl+C inside it) to stop that server.
echo This launcher window can be closed safely.
pause
