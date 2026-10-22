# Start Niyantrak System
Write-Host "Starting Niyantrak Enterprise Fire Safety System..." -ForegroundColor Green
Write-Host ""

# Start Backend
Write-Host "Starting Backend Server..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    Set-Location "$using:PSScriptRoot\backend"
    npm run start:demo
}

Start-Sleep -Seconds 3

# Start ML risk service
Write-Host "Starting ML Risk Service..." -ForegroundColor Yellow
$mlJob = Start-Job -ScriptBlock {
    Set-Location "$using:PSScriptRoot\backend\ml"
    & "$using:PSScriptRoot\.venv\Scripts\Activate.ps1"
    python -m uvicorn serve_model:app --host 0.0.0.0 --port 8001
}

Start-Sleep -Seconds 2

# Start fire image detection service
Write-Host "Starting Fire Image Detection Service..." -ForegroundColor Yellow
$fireJob = Start-Job -ScriptBlock {
    Set-Location "$using:PSScriptRoot\backend\ml"
    & "$using:PSScriptRoot\.venv\Scripts\Activate.ps1"
    python -m uvicorn fire_detection.service:app --host 0.0.0.0 --port 8002
}

Start-Sleep -Seconds 2

# Start CCTV Live Fire Detection Service (Add-On)
Write-Host "Starting CCTV Fire Detection Service (Add-On)..." -ForegroundColor Yellow
$cctvJob = Start-Job -ScriptBlock {
    Set-Location "$using:PSScriptRoot\backend\ml"
    & "$using:PSScriptRoot\.venv\Scripts\Activate.ps1"
    python -m uvicorn cctv_engine.cctv_service:app --host 0.0.0.0 --port 8003
}

Start-Sleep -Seconds 2

# Start Frontend  
Write-Host "Starting Frontend Server..." -ForegroundColor Yellow
$frontendJob = Start-Job -ScriptBlock {
    Set-Location "$using:PSScriptRoot\frontend"
    python -m http.server 3000
}

Write-Host ""
Write-Host "Servers starting..." -ForegroundColor Green
Write-Host "Backend: http://localhost:5000" -ForegroundColor Cyan
Write-Host "ML Service: http://localhost:8001" -ForegroundColor Cyan
Write-Host "Fire Image Service: http://localhost:8002" -ForegroundColor Cyan
Write-Host "CCTV Live Service (Add-On): http://localhost:8003" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "CCTV Control Room: http://localhost:3000/cctv.html" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop all servers..." -ForegroundColor Red

# Wait for jobs
try {
    Wait-Job -Job $backendJob, $mlJob, $fireJob, $cctvJob, $frontendJob
} finally {
    Write-Host "Stopping servers..." -ForegroundColor Yellow
    Stop-Job -Job $backendJob, $mlJob, $fireJob, $cctvJob, $frontendJob
    Remove-Job -Job $backendJob, $mlJob, $fireJob, $cctvJob, $frontendJob
}