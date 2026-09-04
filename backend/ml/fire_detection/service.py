import json
import os
from io import BytesIO
from pathlib import Path

import joblib
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError


BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = Path(os.getenv("FIRE_MODEL_DIR", BASE_DIR / "model_artifacts"))
MODEL_PATH = MODEL_DIR / "fire_detection_model.joblib"
METADATA_PATH = MODEL_DIR / "fire_detection_metadata.json"
IMAGE_SIZE = (64, 64)

app = FastAPI(title="NiyanTrak Fire Image Detection")
model = None
metadata = {}


@app.on_event("startup")
def load_model():
    global model, metadata
    if MODEL_PATH.exists():
        model = joblib.load(MODEL_PATH)
    if METADATA_PATH.exists():
        metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}


@app.post("/predict")
async def predict(image: UploadFile = File(...)):
    if model is None:
        raise HTTPException(503, "Fire detection model is not trained. Run train_fire_model.py first.")
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(400, "Upload a JPG, PNG, or other image file.")
    contents = await image.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(413, "Image must be smaller than 10 MB.")
    try:
        pil_image = Image.open(BytesIO(contents)).convert("RGB").resize(IMAGE_SIZE)
    except (UnidentifiedImageError, OSError) as error:
        raise HTTPException(400, "The uploaded file is not a valid image.") from error

    batch = np.asarray(pil_image, dtype=np.float32).reshape(1, -1) / 255.0
    fire_probability = float(model.predict_proba(batch)[0][1])
    threshold = float(metadata.get("threshold", 0.5))
    is_fire = fire_probability >= threshold
    confidence = fire_probability if is_fire else 1 - fire_probability
    return {
        "prediction": "fire" if is_fire else "no_fire",
        "isFire": is_fire,
        "fireProbability": round(fire_probability, 4),
        "confidence": round(confidence, 4),
        "reviewRequired": confidence < 0.7,
        "filename": image.filename,
    }