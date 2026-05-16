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
If you prefer manual control:

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```

**Terminal 2 - Frontend:**
```bash
cd frontend
python -m http.server 3000
```

## Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/api/health

## Core Features
- AI-driven early detection using vision and sensor fusion models for smoke, fire, and predictive hazard analysis
- GPS-based precise alerts with location coordinates and role-based escalation workflows for rapid emergency response
- Digital compliance tracking aligned with standards like NFPA, including automated logging, reporting, and status summaries
- Checklist intelligence with risk scoring, trend analysis, and safety recommendations

## Demo Credentials
- **Admin**: test@admin.com / 123
- **Employee**: test@employee.com / 123
- **Firemen**: test@firemen.com / 123

## Requirements
- Node.js (for backend)
- Python 3 (for frontend server)
- MongoDB (running locally)

## Development
- Backend dev mode: `npm run dev`
- Frontend: Served via Python HTTP server
- Demo data is now sourced from `backend/data/demoDataset.json` and loaded by `backend/utils/seed.js`