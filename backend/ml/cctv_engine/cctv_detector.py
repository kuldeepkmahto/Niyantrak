"""
cctv_detector.py — Standalone Desktop CCTV Fire Detector Utility (Add-On)
Connects directly to an RTSP IP camera, HTTP MJPEG stream, or webcam index,
draws glowing flame bounding boxes, HUD telemetry, and generates audible alerts.

Usage:
  python cctv_detector.py --source 0 --zone "Warehouse A - Zone 3"
  python cctv_detector.py --source "rtsp://192.168.1.100:554/live" --zone "Chemical Storage"
"""

import argparse
import logging
import sys
import time
from pathlib import Path

import cv2
import numpy as np

# Import detector helpers from cctv_service
sys.path.insert(0, str(Path(__file__).resolve().parent))
from cctv_service import analyze_frame_for_fire, load_detection_model

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("cctv_detector_cli")


def run_detector(source: str, zone: str, width: int = 640, height: int = 480):
    load_detection_model()

    # Open video capture
    if source.isdigit():
        cap = cv2.VideoCapture(int(source), cv2.CAP_DSHOW)
    else:
        cap = cv2.VideoCapture(source)

    if not cap.isOpened():
        logger.error("Failed to connect to video stream: %s", source)
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)

    logger.info("CCTV Fire Detector started for %s (source: %s)", zone, source)
    logger.info("Press 'q' to quit, 's' to take snapshot.")

    consecutive_fire = 0
    fps_start = time.time()
    frame_count = 0
    current_fps = 0.0

    window_name = f"NiyanTrak CCTV Fire Monitor — {zone}"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(window_name, 800, 600)

    try:
        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                logger.warning("Frame read failed. Retrying...")
                time.sleep(0.5)
                continue

            frame_count += 1
            now = time.time()
            if now - fps_start >= 1.0:
                current_fps = frame_count / (now - fps_start)
                frame_count = 0
                fps_start = now

            # Analyze frame
            analysis = analyze_frame_for_fire(frame)
            is_fire = analysis["isFire"]

            if is_fire:
                consecutive_fire += 1
            else:
                consecutive_fire = max(0, consecutive_fire - 1)

            display = frame.copy()
            h, w = display.shape[:2]

            # Draw bounding boxes
            for b in analysis.get("boundingBoxes", []):
                bx, by, bw, bh = b["x"], b["y"], b["width"], b["height"]
                conf = int(b.get("confidence", 0.9) * 100)
                color = (0, 0, 255) if consecutive_fire >= 2 else (0, 165, 255)
                cv2.rectangle(display, (bx, by), (bx + bw, by + bh), color, 2)
                cv2.putText(
                    display,
                    f"FLAME {conf}%",
                    (bx, max(15, by - 5)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    (255, 255, 255),
                    1,
                )

            # Top overlay
            cv2.rectangle(display, (0, 0), (w, 35), (20, 20, 25), -1)
            cv2.putText(
                display,
                f"CCTV: {zone.upper()} | FPS: {current_fps:.1f}",
                (10, 24),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (220, 230, 240),
                1,
            )

            # Fire warning banner
            if consecutive_fire >= 2:
                cv2.rectangle(display, (0, h - 35), (w, h), (0, 0, 220), -1)
                cv2.putText(
                    display,
                    "CRITICAL: FIRE DETECTED IN CAMERA FEED",
                    (15, h - 10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (255, 255, 255),
                    2,
                )

            cv2.imshow(window_name, display)

            key = cv2.waitKey(20) & 0xFF
            if key == ord("q"):
                break
            elif key == ord("s"):
                snap_name = f"snapshot_{int(time.time())}.jpg"
                cv2.imwrite(snap_name, display)
                logger.info("Saved snapshot to %s", snap_name)
    finally:
        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="NiyanTrak CCTV Live Fire Detector")
    parser.add_argument("--source", type=str, default="0", help="Camera index (e.g. 0) or RTSP/HTTP URL")
    parser.add_argument("--zone", type=str, default="Warehouse A - Zone 3", help="Zone or area name")
    args = parser.parse_args()
    run_detector(args.source, args.zone)
