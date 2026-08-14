"""
train_risk_model.py
--------------------
Trains a real supervised model to predict incident likelihood from
checklist submission features, replacing the fixed-weight heuristic in
aiDetection.js's predictIncidentRisk().

Run:
    python generate_training_data.py --n 6000 --out training_data.csv
    python train_risk_model.py --data training_data.csv
"""
import argparse
import json

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score, roc_auc_score, classification_report, confusion_matrix,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

TARGET_COL = "incident_within_7d"
CATEGORICAL_COLS = ["checklist_type"]
NUMERIC_COLS = [
    "total_items", "checked", "required_total", "required_checked",
    "completion_pct", "required_pct", "missed_required", "is_night_shift",
    "rolling_avg_completion_5", "rolling_avg_required_pct_5",
    "consecutive_low_completion", "repeated_miss_count_7",
    "recent_incidents_zone_7d", "active_alerts_zone", "equipment_defect_flag",
]


def build_pipeline():
    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_COLS),
            ("num", "passthrough", NUMERIC_COLS),
        ]
    )
    model = GradientBoostingClassifier(
        n_estimators=200,
        max_depth=3,
        learning_rate=0.08,
        subsample=0.9,
        random_state=42,
    )
    return Pipeline([("preprocess", preprocessor), ("model", model)])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=str, default="training_data.csv")
    ap.add_argument("--out-dir", type=str, default="model_artifacts")
    args = ap.parse_args()

    import os
    os.makedirs(args.out_dir, exist_ok=True)

    df = pd.read_csv(args.data)
    X = df[CATEGORICAL_COLS + NUMERIC_COLS]
    y = df[TARGET_COL]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    pipe = build_pipeline()
    pipe.fit(X_train, y_train)

    y_pred = pipe.predict(X_test)
    y_proba = pipe.predict_proba(X_test)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_proba)
    report = classification_report(y_test, y_pred, output_dict=True)
    cm = confusion_matrix(y_test, y_pred).tolist()

    print(f"Accuracy: {acc:.3f}")
    print(f"ROC-AUC:  {auc:.3f}")
    print("Confusion matrix:", cm)
    print(classification_report(y_test, y_pred))

    # Feature importances (mapped back through the one-hot encoder)
    ohe = pipe.named_steps["preprocess"].named_transformers_["cat"]
    cat_feature_names = list(ohe.get_feature_names_out(CATEGORICAL_COLS))
    all_feature_names = cat_feature_names + NUMERIC_COLS
    importances = pipe.named_steps["model"].feature_importances_
    importance_map = dict(sorted(
        zip(all_feature_names, importances.tolist()),
        key=lambda kv: kv[1], reverse=True,
    ))

    joblib.dump(pipe, f"{args.out_dir}/risk_model.joblib")
    with open(f"{args.out_dir}/metadata.json", "w") as f:
        json.dump({
            "categorical_cols": CATEGORICAL_COLS,
            "numeric_cols": NUMERIC_COLS,
            "target_col": TARGET_COL,
            "metrics": {"accuracy": acc, "roc_auc": auc, "confusion_matrix": cm},
            "feature_importances": importance_map,
        }, f, indent=2)

    print(f"\nSaved model to {args.out_dir}/risk_model.joblib")
    print(f"Saved metadata to {args.out_dir}/metadata.json")
    print("\nTop 5 features by importance:")
    for name, imp in list(importance_map.items())[:5]:
        print(f"  {name}: {imp:.3f}")


if __name__ == "__main__":
    main()
