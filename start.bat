@echo off
echo Starting Niyantrak Enterprise Fire Safety System...
echo.

echo Starting Backend Server...
start cmd /k "cd /d %~dp0backend && npm start"

timeout /t 3 /nobreak > nul

echo Starting Frontend Server...
start cmd /k "cd /d %~dp0frontend && python -m http.server 3000"

echo.
echo Servers starting...
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Press any key to exit (servers will continue running)...
pause > nul