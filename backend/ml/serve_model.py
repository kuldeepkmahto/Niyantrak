import json
import os

import joblib
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR_ENV = os.environ.get("MODEL_DIR", "model_artifacts")
MODEL_DIR = MODEL_DIR_ENV
if not os.path.isabs(MODEL_DIR):
    MODEL_DIR = os.path.join(BASE_DIR, MODEL_DIR)
MODEL_DIR = os.path.abspath(MODEL_DIR)
MODEL_PATH = os.path.join(MODEL_DIR, "risk_model.joblib")
METADATA_PATH = os.path.join(MODEL_DIR, "metadata.json")

app = FastAPI(title="Niyantrak Risk Model Service")

_model = None
_metadata = None


@app.on_event("startup")
def load_model():
    global _model, _metadata
    if not os.path.exists(MODEL_PATH):
        raise RuntimeError(
            f"No trained model found at {MODEL_PATH}. Run train_risk_model.py first."
        )
    _model = joblib.load(MODEL_PATH)
    with open(METADATA_PATH) as f:
        _metadata = json.load(f)


class RiskFeatures(BaseModel):
    checklist_type: str = Field(..., description="preshift | equipment | postshift")
    total_items: int
    checked: int
    required_total: int
    required_checked: int
    completion_pct: float
    required_pct: float
    missed_required: int
    is_night_shift: int = Field(..., ge=0, le=1)
    rolling_avg_completion_5: float
    rolling_avg_required_pct_5: float
    consecutive_low_completion: int = Field(..., ge=0, le=1)
    repeated_miss_count_7: int
    recent_incidents_zone_7d: int
    active_alerts_zone: int
    equipment_defect_flag: int = Field(..., ge=0, le=1)


def risk_level_from_score(score: float) -> tuple[str, str]:
    if score <= 20:
        return "low", "🟢 Low Risk"
    if score <= 45:
        return "medium", "🟡 Medium Risk"
    if score <= 70:
        return "high", "🟠 High Risk"
    return "critical", "🔴 Critical Risk"


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": _model is not None}


@app.get("/metadata")
def metadata():
    return _metadata


@app.post("/predict")
def predict(features: RiskFeatures):
    if _model is None:
        raise HTTPException(500, "Model not loaded")

    import pandas as pd
    row = pd.DataFrame([features.model_dump()])
    proba = float(_model.predict_proba(row)[0, 1])  # P(incident within 7 days)
    score = round(proba * 100)
    level, label = risk_level_from_score(score)

    return {
        "riskScore": score,
        "riskLevel": level,
        "riskLabel": label,
        "incidentProbability": round(proba, 4),
        "modelVersion": _metadata.get("metrics", {}) if _metadata else {},
        "source": "ml-model",
    }
