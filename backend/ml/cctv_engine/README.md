# NiyanTrak CCTV Live Fire Detection Add-On

This add-on connects directly to RTSP IP camera streams, HTTP/MJPEG feeds, USB webcams, or built-in industrial simulated feeds. It detects flame signatures using OpenCV color and contour segmentation verified with the scikit-learn fire classifier, renders real-time HUD overlays and flame bounding boxes, and streams live MJPEG video to dashboards.

## Quick Start

### Start the CCTV Microservice (Port 8003)

From project root:
```powershell
.\.venv\Scripts\Activate.ps1
python backend\ml\cctv_engine\cctv_service.py
```

Or via uvicorn:
```powershell
uvicorn backend.ml.cctv_engine.cctv_service:app --host 0.0.0.0 --port 8003
```

### Endpoints
- **Health**: `GET http://localhost:8003/health`
- **List Cameras**: `GET http://localhost:8003/cameras`
- **Live Stream**: `GET http://localhost:8003/stream/{camera_id}`
- **Snapshot**: `GET http://localhost:8003/snapshot/{camera_id}`
- **Fire Drill Simulation Toggle**: `POST http://localhost:8003/simulate-fire/{camera_id}`
- **Add Custom Camera**: `POST http://localhost:8003/cameras`

### Standalone Desktop Detector (OpenCV GUI)
```powershell
python backend\ml\cctv_engine\cctv_detector.py --source 0 --zone "Warehouse A - Zone 3"
# Or RTSP:
python backend\ml\cctv_engine\cctv_detector.py --source "rtsp://admin:pass@192.168.1.100:554/live" --zone "Chemical Storage"
```
