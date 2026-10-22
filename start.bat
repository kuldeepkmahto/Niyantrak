@echo off
setlocal
set "ROOT=%~dp0"

echo Starting Niyantrak Enterprise Fire Safety System...
echo.

echo Starting Backend Server...
start "NiyanTrak Backend" /d "%ROOT%backend" cmd /k "npm run start:demo"

ping 127.0.0.1 -n 4 > nul

echo Starting ML Risk Service...
start "NiyanTrak ML Risk" /d "%ROOT%backend\ml" cmd /k ""%ROOT%.venv\Scripts\python.exe" -m uvicorn serve_model:app --host 0.0.0.0 --port 8001"

ping 127.0.0.1 -n 3 > nul

echo Starting Fire Image Detection Service...
start "NiyanTrak Fire Detection" /d "%ROOT%backend\ml" cmd /k ""%ROOT%.venv\Scripts\python.exe" -m uvicorn fire_detection.service:app --host 0.0.0.0 --port 8002"

ping 127.0.0.1 -n 3 > nul

echo Starting CCTV Fire Detection Service...
start "NiyanTrak CCTV Service" /d "%ROOT%backend\ml" cmd /k ""%ROOT%.venv\Scripts\python.exe" -m uvicorn cctv_engine.cctv_service:app --host 0.0.0.0 --port 8003"

ping 127.0.0.1 -n 3 > nul

echo Starting Frontend Server...
start "NiyanTrak Frontend" /d "%ROOT%frontend" cmd /k "python -m http.server 3000"

echo.
echo ========================================================
echo All Servers Started!
echo ========================================================
echo Backend:              http://localhost:5000
echo ML Service:           http://localhost:8001
echo Fire Image Service:   http://localhost:8002
echo CCTV Service (Add-On): http://localhost:8003
echo Frontend:             http://localhost:3000
echo CCTV Control Room:    http://localhost:3000/cctv.html
echo ========================================================
echo.