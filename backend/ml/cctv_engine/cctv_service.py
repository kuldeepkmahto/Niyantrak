import asyncio
import base64
import json
import logging
import math
import os
import threading
import time
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Dict, List, Optional
import urllib.request

import cv2
import joblib
import numpy as np
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from PIL import Image
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("cctv_fire_addon")

# Paths and configurations
CCTV_DIR = Path(__file__).resolve().parent
ML_ROOT = CCTV_DIR.parent
PROJECT_ROOT = ML_ROOT.parent.parent

MODEL_PATH = ML_ROOT / "fire_detection" / "model_artifacts" / "fire_detection_model.joblib"
METADATA_PATH = ML_ROOT / "fire_detection" / "model_artifacts" / "fire_detection_metadata.json"
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:5000/api")

SNAPSHOTS_DIR = PROJECT_ROOT / "backend" / "uploads" / "snapshots"
SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)

IMAGE_SIZE = (64, 64)

app = FastAPI(
    title="NiyanTrak CCTV Live Fire Detection Add-On",
    description="Real-time multi-camera CCTV stream processing, OpenCV flame contour detection, ML verification, and alert dispatcher.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = None
metadata = {}


@app.on_event("startup")
def load_detection_model():
    global model, metadata
    if MODEL_PATH.exists():
        try:
            model = joblib.load(MODEL_PATH)
            logger.info("Successfully loaded fire classification model from %s", MODEL_PATH)
        except Exception as e:
            logger.error("Failed to load model: %s", e)
    else:
        logger.warning("Model file not found at %s. Contour-based detection will be active.", MODEL_PATH)

    if METADATA_PATH.exists():
        try:
            metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
        except Exception as e:
            logger.warning("Could not read metadata: %s", e)


def detect_flame_regions(frame: np.ndarray) -> List[dict]:
    """
    High-precision flame detection using multi-color-space analysis
    (HSV + YCrCb + Core Luminescence + Human Skin Rejection).
    Reliably detects genuine flames (lighter, matches, candles, fires)
    while strictly rejecting human skin, clothing, walls, and ambient lights.
    """
    if frame is None or frame.size == 0:
        return []

    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    ycrcb = cv2.cvtColor(frame, cv2.COLOR_BGR2YCrCb)

    # 1. Mask A: Luminous Yellow/Orange flame core & body
    # Flames emit bright light: H: 8-32, S: 110-255, V: 195-255 (eliminates skin with V < 185)
    lower_core = np.array([8, 110, 195], dtype=np.uint8)
    upper_core = np.array([32, 255, 255], dtype=np.uint8)
    mask_core = cv2.inRange(hsv, lower_core, upper_core)

    # 2. Mask B: Deep glowing red flame tip (H: 0-6 or 172-180, S: 160-255, V: 210-255)
    # Strictly requires high saturation (>= 160) and high brightness (>= 210) to reject red shirts/lips
    lower_red1 = np.array([0, 160, 210], dtype=np.uint8)
    upper_red1 = np.array([6, 255, 255], dtype=np.uint8)
    mask_red1 = cv2.inRange(hsv, lower_red1, upper_red1)

    lower_red2 = np.array([172, 160, 210], dtype=np.uint8)
    upper_red2 = np.array([180, 255, 255], dtype=np.uint8)
    mask_red2 = cv2.inRange(hsv, lower_red2, upper_red2)

    flame_mask = cv2.bitwise_or(mask_core, cv2.bitwise_or(mask_red1, mask_red2))

    # Morphological noise filtering
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    flame_mask = cv2.morphologyEx(flame_mask, cv2.MORPH_OPEN, kernel)
    flame_mask = cv2.dilate(flame_mask, kernel, iterations=1)

    contours, _ = cv2.findContours(flame_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes = []
    h, w = frame.shape[:2]
    min_area = 100
    max_area = h * w * 0.35

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area or area > max_area:
            continue

        x, y, bw, bh = cv2.boundingRect(cnt)

        # Aspect ratio check: Flames are generally vertical or roughly square, not broad flat horizontal lines
        aspect_ratio = float(bh) / max(1.0, float(bw))
        if aspect_ratio < 0.35:
            continue

        crop = frame[y:y+bh, x:x+bw]
        if crop.size == 0:
            continue

        # Criteria 1: Active Light Emitter (Peak Brightness)
        # Real fire produces near-sensor-saturation at its center
        peak_val = max(np.max(crop[:, :, 2]), np.max(crop[:, :, 1]))
        if peak_val < 220:
            continue

        mean_b = float(np.mean(crop[:, :, 0]))
        mean_g = float(np.mean(crop[:, :, 1]))
        mean_r = float(np.mean(crop[:, :, 2]))

        # Criteria 2: RGB Flame Dominance: R > G and G > B, with strong Red-to-Blue separation
        if not (mean_r > 175 and mean_r > mean_g and mean_g > mean_b):
            continue
        if (mean_r - mean_b) < 45:
            continue

        # Criteria 3: YCrCb Color Difference
        # In flames, Cr is significantly higher than Cb (red-difference dominates blue-difference)
        crop_ycrcb = ycrcb[y:y+bh, x:x+bw]
        cr_mean = float(np.mean(crop_ycrcb[:, :, 1]))
        cb_mean = float(np.mean(crop_ycrcb[:, :, 2]))
        if (cr_mean - cb_mean) < 30:
            continue

        # Criteria 4: Luminous Core Presence
        # Real flame must contain yellow/white hot core pixels (high R & G, low/moderate B)
        core_mask = (crop[:, :, 2] >= 220) & (crop[:, :, 1] >= 130) & (crop[:, :, 0] <= 165)
        core_count = int(np.sum(core_mask))
        core_ratio = float(core_count) / float(bw * bh)
        if core_ratio < 0.03:
            continue

        # Compute confidence based on flame core quality and chromatic separation
        conf = min(0.99, 0.75 + core_ratio * 0.9 + ((cr_mean - cb_mean) / 120.0) * 0.15)

        pad_x = int(bw * 0.08)
        pad_y = int(bh * 0.08)
        x0 = max(0, x - pad_x)
        y0 = max(0, y - pad_y)
        x1 = min(w, x + bw + pad_x)
        y1 = min(h, y + bh + pad_y)

        boxes.append({
            "x": int(x0),
            "y": int(y0),
            "width": int(x1 - x0),
            "height": int(y1 - y0),
            "area": float(area),
            "confidence": round(conf, 3),
        })

    return boxes


def evaluate_frame_ml(frame: np.ndarray) -> float:
    """Evaluates an image frame through the trained scikit-learn model."""
    if model is None:
        return 0.0
    try:
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(rgb_frame).resize(IMAGE_SIZE)
        batch = np.asarray(pil_img, dtype=np.float32).reshape(1, -1) / 255.0
        prob = float(model.predict_proba(batch)[0][1])
        return prob
    except Exception as e:
        logger.error("ML evaluation error: %s", e)
        return 0.0


def analyze_frame_for_fire(frame: np.ndarray):
    """
    Combined computer vision and machine learning analysis.
    Returns (is_fire, confidence, bounding_boxes, fire_probability).
    """
    flame_boxes = detect_flame_regions(frame)
    frame_prob = evaluate_frame_ml(frame)

    if flame_boxes:
        # Verified flame bounding box with luminous core
        top_box_conf = max(b["confidence"] for b in flame_boxes)
        is_fire = True
        combined_prob = max(frame_prob, top_box_conf)
        confidence = combined_prob
        return {
            "isFire": True,
            "fireProbability": round(float(combined_prob), 4),
            "confidence": round(float(confidence), 4),
            "boundingBoxes": flame_boxes
        }
    elif frame_prob >= 0.75:
        # Full frame fire without localized box (e.g. intense fire engulfment)
        return {
            "isFire": True,
            "fireProbability": round(float(frame_prob), 4),
            "confidence": round(float(frame_prob), 4),
            "boundingBoxes": []
        }
    else:
        # Safe - no flame detected
        return {
            "isFire": False,
            "fireProbability": round(float(frame_prob), 4),
            "confidence": round(float(1.0 - frame_prob), 4),
            "boundingBoxes": []
        }


# ─────────────────────────────────────────────────────────────
# CCTV Stream & Camera Manager
# ─────────────────────────────────────────────────────────────
class CCTVCamera:
    def __init__(self, camera_id: str, name: str, zone: str, source: str):
        self.camera_id = camera_id
        self.name = name
        self.zone = zone
        self.source = source  # "demo", webcam index "0", or RTSP/HTTP URL
        self.is_active = True
        self.simulated_fire = False
        self.last_fire_detected = False
        self.consecutive_fire_frames = 0
        self.last_alert_time = 0.0
        self.latest_frame = None
        self.latest_analysis = {
            "isFire": False,
            "fireProbability": 0.0,
            "confidence": 0.99,
            "boundingBoxes": []
        }
        self.fps = 0.0
        self.lock = threading.Lock()
        self.cap = None
        self.thread = None
        self._stop_event = threading.Event()
        self.start()

    def start(self):
        self._stop_event.clear()
        self.thread = threading.Thread(target=self._worker_loop, daemon=True)
        self.thread.start()

    def stop(self):
        self._stop_event.set()
        if self.cap:
            try:
                self.cap.release()
            except Exception:
                pass

    def _init_capture(self):
        if self.source == "demo" or self.source.startswith("sim"):
            return None
        try:
            # Check if source is integer (local camera device index)
            if self.source.isdigit():
                cap = cv2.VideoCapture(int(self.source), cv2.CAP_DSHOW)
            else:
                cap = cv2.VideoCapture(self.source)
            if cap.isOpened():
                cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                return cap
        except Exception as e:
            logger.warning("Could not open video capture for %s: %s", self.camera_id, e)
        return None

    def _generate_synthetic_cctv_frame(self, t: float) -> np.ndarray:
        """
        Generates a realistic industrial warehouse CCTV frame.
        When self.simulated_fire is True, renders flickering dynamic flame.
        """
        w, h = 640, 480
        frame = np.zeros((h, w, 3), dtype=np.uint8)

        # Base warehouse lighting & floor
        frame[0:220, :] = [32, 28, 25]     # Dark ceiling / rafters
        frame[220:480, :] = [45, 42, 38]   # Concrete floor

        # Safety concrete lane markings in clean off-white (BGR)
        cv2.line(frame, (100, 480), (220, 220), (160, 160, 160), 2)
        cv2.line(frame, (540, 480), (420, 220), (160, 160, 160), 2)

        # Industrial storage racks on the left and right (slate grey)
        cv2.rectangle(frame, (30, 120), (140, 420), (60, 50, 45), -1)
        cv2.rectangle(frame, (500, 120), (610, 420), (60, 50, 45), -1)

        # Shelf levels & cargo pallets
        for shelf_y in [180, 250, 320, 390]:
            cv2.line(frame, (30, shelf_y), (140, shelf_y), (85, 75, 70), 2)
            cv2.line(frame, (500, shelf_y), (610, shelf_y), (85, 75, 70), 2)
            # Steel/Blue storage containers
            cv2.rectangle(frame, (45, shelf_y - 25), (125, shelf_y), (110, 75, 45), -1)
            cv2.rectangle(frame, (515, shelf_y - 25), (595, shelf_y), (85, 95, 60), -1)

        # Background doorway with exit sign
        cv2.rectangle(frame, (280, 150), (360, 260), (20, 20, 20), -1)
        cv2.rectangle(frame, (300, 135), (340, 148), (0, 140, 0), -1)
        cv2.putText(frame, "EXIT", (305, 145), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (255, 255, 255), 1)

        # Subtle camera noise / grain
        noise = np.random.randint(0, 10, (h, w, 3), dtype=np.uint8)
        frame = cv2.add(frame, noise)

        # If Fire Drill / Simulation is active on this camera
        if self.simulated_fire:
            fire_x, fire_y = 310, 300
            # Flickering animation parameters based on time
            flicker = math.sin(t * 12.0) * 8.0 + math.cos(t * 22.0) * 6.0
            flame_h = int(65 + flicker)
            flame_w = int(48 + flicker * 0.5)

            # Outer smoke plume
            for i in range(5):
                smoke_y = fire_y - flame_h - (i * 15) - int((t * 20 + i * 10) % 30)
                smoke_x = fire_x + int(math.sin(t * 4 + i) * 12)
                cv2.circle(frame, (smoke_x, smoke_y), 16 + i * 4, (75, 70, 68), -1)

            # Outer red-orange flame
            pts_outer = np.array([
                [fire_x - flame_w // 2, fire_y],
                [fire_x - flame_w // 4, fire_y - int(flame_h * 0.7)],
                [fire_x, fire_y - flame_h],
                [fire_x + flame_w // 4, fire_y - int(flame_h * 0.65)],
                [fire_x + flame_w // 2, fire_y]
            ], np.int32)
            cv2.fillPoly(frame, [pts_outer], (0, 65, 245))  # Bright red-orange (BGR)

            # Inner bright yellow/white core
            pts_core = np.array([
                [fire_x - flame_w // 4, fire_y],
                [fire_x - flame_w // 8, fire_y - int(flame_h * 0.5)],
                [fire_x, fire_y - int(flame_h * 0.75)],
                [fire_x + flame_w // 8, fire_y - int(flame_h * 0.5)],
                [fire_x + flame_w // 4, fire_y]
            ], np.int32)
            cv2.fillPoly(frame, [pts_core], (15, 215, 255))  # Intense yellow

            # Ambient orange glow around fire
            glow = np.zeros_like(frame)
            cv2.circle(glow, (fire_x, fire_y - 20), 120, (0, 45, 120), -1)
            frame = cv2.addWeighted(frame, 1.0, glow, 0.4, 0)

        return frame

    def _render_cctv_hud(self, frame: np.ndarray, analysis: dict) -> np.ndarray:
        """Draws realistic high-tech CCTV camera HUD and flame bounding boxes."""
        h, w = frame.shape[:2]
        out = frame.copy()

        # Draw detected flame bounding boxes
        is_fire = analysis.get("isFire", False)
        boxes = analysis.get("boundingBoxes", [])

        for b in boxes:
            bx, by, bw, bh = b["x"], b["y"], b["width"], b["height"]
            conf = int(b.get("confidence", 0.9) * 100)

            # Pulsing corner brackets
            color = (0, 0, 255) if is_fire else (0, 165, 255)
            cv2.rectangle(out, (bx, by), (bx + bw, by + bh), color, 2)

            # Tactical corner markers
            c_len = min(15, bw // 3, bh // 3)
            if c_len > 3:
                cv2.line(out, (bx, by), (bx + c_len, by), (0, 255, 255), 2)
                cv2.line(out, (bx, by), (bx, by + c_len), (0, 255, 255), 2)
                cv2.line(out, (bx + bw, by), (bx + bw - c_len, by), (0, 255, 255), 2)
                cv2.line(out, (bx + bw, by), (bx + bw, by + c_len), (0, 255, 255), 2)

            # Tag badge
            tag_text = f"FLAME {conf}%"
            (tw, th), _ = cv2.getTextSize(tag_text, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
            cv2.rectangle(out, (bx, max(0, by - th - 6)), (bx + tw + 8, max(th + 6, by)), color, -1)
            cv2.putText(out, tag_text, (bx + 4, max(th + 2, by - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)

        # Top HUD Bar
        cv2.rectangle(out, (0, 0), (w, 36), (15, 15, 20), -1)
        cv2.line(out, (0, 36), (w, 36), (40, 45, 55), 1)

        # Camera Name & Zone
        title_text = f"{self.name.upper()} | {self.zone.upper()}"
        cv2.putText(out, title_text, (14, 23), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (230, 235, 245), 1)

        # Top Right: Live Date / Timestamp + REC pill
        timestamp_str = datetime.now().strftime("%Y-%m-%d  %H:%M:%S")
        cv2.putText(out, timestamp_str, (w - 245, 23), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (170, 185, 200), 1)

        # REC dot
        rec_color = (0, 0, 255) if int(time.time() * 2) % 2 == 0 else (60, 60, 120)
        cv2.circle(out, (w - 30, 21), 5, rec_color, -1)
        cv2.putText(out, "REC", (w - 20, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (220, 220, 220), 1)

        # Bottom HUD Bar
        cv2.rectangle(out, (0, h - 30), (w, h), (15, 15, 20), -1)
        cv2.line(out, (0, h - 30), (w, h - 30), (40, 45, 55), 1)

        fps_text = f"FPS: {self.fps:.1f} | AI CONF: {int(analysis.get('confidence', 0)*100)}%"
        cv2.putText(out, fps_text, (14, h - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (140, 160, 175), 1)

        # Status badge
        if is_fire:
            banner_bg = (0, 0, 200) if int(time.time() * 3) % 2 == 0 else (0, 30, 160)
            cv2.rectangle(out, (w - 230, h - 28), (w - 10, h - 4), banner_bg, -1)
            cv2.putText(out, "CRITICAL: FIRE DETECTED", (w - 220, h - 11), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)
        else:
            cv2.rectangle(out, (w - 140, h - 28), (w - 10, h - 4), (20, 80, 30), -1)
            cv2.putText(out, "SCANNING - SAFE", (w - 130, h - 11), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 255, 200), 1)

        return out

    def _trigger_system_alert(self, snapshot_path: Path):
        """Asynchronously dispatches a critical alert to NiyanTrak Backend API."""
        try:
            url = f"{BACKEND_API_URL}/cctv/alert"
            payload = {
                "title": f"CCTV Fire Alert - {self.name} ({self.zone})",
                "location": self.zone,
                "zone": self.zone,
                "level": "critical",
                "type": "fire",
                "source": "ai-detection",
                "aiGenerated": True,
                "aiConfidence": self.latest_analysis.get("confidence", 0.95),
                "detail": f"Automated fire detection on {self.name}. Sustained flame signature confirmed by CCTV Vision Engine.",
                "temperature": 78
            }
            data_bytes = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=data_bytes,
                headers={"Content-Type": "application/json", "User-Agent": "Niyantrak-CCTV-Engine"}
            )
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                logger.info("Auto-alert created for %s: status %d", self.camera_id, resp.status)
        except Exception as e:
            logger.info("Auto-alert webhook delivery to %s: %s", url, e)

    def _worker_loop(self):
        """Background thread reading and analyzing frames continuously."""
        self.cap = self._init_capture()
        frame_count = 0
        t0 = time.time()

        while not self._stop_event.is_set():
            loop_start = time.time()

            raw_frame = None
            if self.cap and self.cap.isOpened():
                ret, captured = self.cap.read()
                if ret and captured is not None:
                    raw_frame = captured
                else:
                    time.sleep(1.0)
                    self.cap = self._init_capture()

            if raw_frame is None:
                raw_frame = self._generate_synthetic_cctv_frame(loop_start)

            # Analyze frame for fire
            analysis = analyze_frame_for_fire(raw_frame)
            is_fire = analysis["isFire"]

            if is_fire:
                self.consecutive_fire_frames += 1
            else:
                self.consecutive_fire_frames = max(0, self.consecutive_fire_frames - 1)

            # Check if sustained fire meets threshold (>= 5 consecutive frames)
            if self.consecutive_fire_frames >= 5:
                analysis["isFire"] = True
                if (loop_start - self.last_alert_time) > 30.0:
                    self.last_alert_time = loop_start
                    snapshot_filename = f"cctv_{self.camera_id}_{int(loop_start)}.jpg"
                    snapshot_path = SNAPSHOTS_DIR / snapshot_filename
                    cv2.imwrite(str(snapshot_path), raw_frame)
                    threading.Thread(target=self._trigger_system_alert, args=(snapshot_path,), daemon=True).start()

            # Render HUD and bounding boxes
            annotated_frame = self._render_cctv_hud(raw_frame, analysis)

            with self.lock:
                self.latest_frame = annotated_frame
                self.latest_analysis = analysis

            # Measure FPS
            frame_count += 1
            now = time.time()
            if now - t0 >= 1.0:
                self.fps = frame_count / (now - t0)
                frame_count = 0
                t0 = now

            # Throttle to ~20-25 FPS to save CPU
            elapsed = time.time() - loop_start
            sleep_time = max(0.01, 0.045 - elapsed)
            time.sleep(sleep_time)


class CCTVManager:
    def __init__(self):
        self.cameras: Dict[str, CCTVCamera] = {}
        self._init_defaults()

    def _init_defaults(self):
        presets = [
            ("cam-01", "Camera 01 - Warehouse High Bay", "Warehouse A - Zone 3", "demo"),
            ("cam-02", "Camera 02 - Chemical Storage", "Chemical Storage - Zone 1", "demo"),
            ("cam-03", "Camera 03 - Loading Bay South", "Loading Dock", "demo"),
            ("cam-04", "Camera 04 - Production Line B", "Factory Floor - Zone 2", "demo"),
        ]
        for cid, name, zone, src in presets:
            self.cameras[cid] = CCTVCamera(cid, name, zone, src)

    def get_camera(self, cid: str) -> Optional[CCTVCamera]:
        return self.cameras.get(cid)

    def add_camera(self, cid: str, name: str, zone: str, source: str) -> CCTVCamera:
        if cid in self.cameras:
            self.cameras[cid].stop()
        cam = CCTVCamera(cid, name, zone, source)
        self.cameras[cid] = cam
        return cam

    def list_cameras(self) -> List[dict]:
        res = []
        for cid, cam in self.cameras.items():
            res.append({
                "id": cam.camera_id,
                "name": cam.name,
                "zone": cam.zone,
                "source": cam.source,
                "fps": round(cam.fps, 1),
                "isFire": cam.latest_analysis.get("isFire", False),
                "confidence": cam.latest_analysis.get("confidence", 0.0),
                "fireProbability": cam.latest_analysis.get("fireProbability", 0.0),
                "simulatedFire": cam.simulated_fire,
            })
        return res


cctv_manager = CCTVManager()


# ─────────────────────────────────────────────────────────────
# API Endpoints
# ─────────────────────────────────────────────────────────────
class FramePayload(BaseModel):
    image: str  # Base64 string or data:image/jpeg;base64,...
    zone: Optional[str] = None
    cameraId: Optional[str] = None


class AddCameraPayload(BaseModel):
    id: str
    name: str
    zone: str
    source: str  # "demo", "0", "1", "rtsp://...", "http://..."


@app.get("/health")
def health():
    return {
        "status": "ok",
        "addon": "NiyanTrak CCTV Fire Detection Add-On",
        "model_loaded": model is not None,
        "active_cameras": len(cctv_manager.cameras)
    }


@app.get("/cameras")
def get_cameras():
    """Lists all configured CCTV channels with live detection metrics."""
    return {"success": True, "cameras": cctv_manager.list_cameras()}


@app.post("/cameras")
def add_camera(payload: AddCameraPayload):
    """Adds or reconfigures a CCTV camera stream."""
    cam = cctv_manager.add_camera(payload.id, payload.name, payload.zone, payload.source)
    return {
        "success": True,
        "camera": {
            "id": cam.camera_id,
            "name": cam.name,
            "zone": cam.zone,
            "source": cam.source
        }
    }


@app.post("/simulate-fire/{camera_id}")
def simulate_fire(camera_id: str):
    """Toggles simulated fire on a CCTV channel for emergency drills and testing."""
    cam = cctv_manager.get_camera(camera_id)
    if not cam:
        raise HTTPException(404, f"Camera '{camera_id}' not found.")
    cam.simulated_fire = not cam.simulated_fire
    return {
        "success": True,
        "camera_id": camera_id,
        "simulatedFire": cam.simulated_fire,
        "message": f"Simulated fire {'activated' if cam.simulated_fire else 'deactivated'} on {cam.name}"
    }


def mjpeg_generator(camera: CCTVCamera):
    """Yields continuous JPEG frames for multipart MJPEG video streaming."""
    while True:
        with camera.lock:
            frame = camera.latest_frame
        if frame is not None:
            ret, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if ret:
                frame_bytes = buffer.tobytes()
                yield (b"--frame\r\n"
                       b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n")
        time.sleep(0.04)


@app.get("/stream/{camera_id}")
def stream_cctv(camera_id: str):
    """Live MJPEG video stream with real-time HUD and flame bounding boxes."""
    cam = cctv_manager.get_camera(camera_id)
    if not cam:
        raise HTTPException(404, f"Camera '{camera_id}' not found.")
    return StreamingResponse(mjpeg_generator(cam), media_type="multipart/x-mixed-replace; boundary=frame")


@app.get("/snapshot/{camera_id}")
def get_snapshot(camera_id: str):
    """Returns the latest single frame snapshot as a JPEG image."""
    cam = cctv_manager.get_camera(camera_id)
    if not cam or cam.latest_frame is None:
        raise HTTPException(404, "Snapshot unavailable.")
    with cam.lock:
        frame = cam.latest_frame.copy()
    ret, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
    if not ret:
        raise HTTPException(500, "Encoding error.")
    return Response(content=buffer.tobytes(), media_type="image/jpeg")


@app.post("/predict-frame")
async def predict_frame(payload: FramePayload):
    """Direct frame prediction endpoint accepting base64-encoded frame."""
    if not payload.image:
        raise HTTPException(400, "Image data is required.")

    img_data = payload.image
    if "," in img_data:
        img_data = img_data.split(",", 1)[1]

    try:
        raw_bytes = base64.b64decode(img_data)
        np_arr = np.frombuffer(raw_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("Failed to decode image buffer.")
    except Exception as e:
        raise HTTPException(400, f"Invalid base64 image data: {e}")

    analysis = analyze_frame_for_fire(frame)
    return {
        "success": True,
        "isFire": analysis["isFire"],
        "fireProbability": analysis["fireProbability"],
        "confidence": analysis["confidence"],
        "boundingBoxes": analysis["boundingBoxes"],
        "zone": payload.zone,
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("CCTV_PORT", 8003))
    uvicorn.run("cctv_service:app", host="0.0.0.0", port=port, reload=False)
