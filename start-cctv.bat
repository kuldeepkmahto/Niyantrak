@echo off
setlocal
set "ROOT=%~dp0"

echo ========================================================
echo Starting Niyantrak CCTV Fire Detection Add-On (Port 8003)
echo ========================================================
echo.

"%ROOT%.venv\Scripts\python.exe" -m uvicorn cctv_engine.cctv_service:app --app-dir "%ROOT%backend\ml" --host 0.0.0.0 --port 8003
pause
