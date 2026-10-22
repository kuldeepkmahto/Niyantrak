# Niyantrak Enterprise Fire Safety System

## Quick Start

### Option 1: Batch File (Windows)
Double-click `start.bat` or run:
```cmd
start.bat
```

### Option 2: PowerShell Script
Run with PowerShell:
```powershell
.\start.ps1
```

### Manual Start
If you prefer manual control, start all three services:

**Terminal 1 - Backend:**
```bash
cd backend
npm run seed
npm start
```

**Terminal 2 - ML Service:**
```bash
cd backend/ml
uvicorn serve_model:app --host 0.0.0.0 --port 8001
```

**Terminal 3 - Frontend:**
```bash
cd frontend
python -m http.server 3000
```

## Access the Application
- **Frontend**: http://localhost:3000
- **CCTV Control Room (Add-On)**: http://localhost:3000/cctv.html
- **Backend API**: http://localhost:5000
- **ML Risk Service**: http://localhost:8001
- **Fire Image Service**: http://localhost:8002
- **CCTV Vision Engine (Add-On)**: http://localhost:8003
- **Health Check**: http://localhost:5000/api/health

## Core Features
- **Live CCTV & IP Camera Fire Detection (Add-On)**: Real-time OpenCV flame contour detection, ML verification, glowing bounding boxes, audio sirens, automated NiyanTrak emergency alerts, and emergency drill simulation.
- AI-driven early detection using vision and sensor fusion models for smoke, fire, and predictive hazard analysis
- GPS-based precise alerts with location coordinates and role-based escalation workflows for rapid emergency response
- Digital compliance tracking aligned with standards like NFPA, including automated logging, reporting, and status summaries
- Checklist intelligence with risk scoring, trend analysis, and safety recommendations

## Demo Credentials
- **Admin**: test@admin.com / Admin@123
- **Employee**: test@employee.com / Emp@12345
- **Firemen**: test@firemen.com / Fire@1234

## Requirements
- Node.js (for backend)
- Python 3 (for frontend server)
- MongoDB (running locally)

## Development
- Backend dev mode: `npm run dev`
- Frontend: Served via Python HTTP server
- Demo data is sourced from `backend/data/demoDataset.json` and loaded by `backend/utils/seed.js`