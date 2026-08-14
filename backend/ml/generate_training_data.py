"""
generate_training_data.py
--------------------------
Builds a synthetic but realistic training set for the checklist risk model.

WHY SYNTHETIC: your real Checklist collection only has 2 documents right now
(backend/data/demoDataset.json) — nowhere near enough to train anything. This
script generates thousands of plausible checklist submissions using the same
feature schema your Node backend already computes in aiDetection.js, plus a
probabilistic "did an incident follow within 7 days" label built from a
hidden ground-truth risk function + noise (not exposed to the model as a
feature). That gives you a real, testable ML pipeline today. Once you have
a few hundred/thousand REAL submissions in MongoDB, replace this generator's
output with an export of real data (see export_real_data.py stub at the
bottom) and retrain — the training script doesn't need to change at all.

Run:
    python generate_training_data.py --n 6000 --out training_data.csv
"""
import argparse
import numpy as np
import pandas as pd

CHECKLIST_TYPES = ["preshift", "equipment", "postshift"]
RNG = np.random.default_rng(42)


def sample_one():
    checklist_type = RNG.choice(CHECKLIST_TYPES, p=[0.45, 0.30, 0.25])

    total_items = {"preshift": 10, "equipment": 12, "postshift": 9}[checklist_type]
    required_total = {"preshift": 6, "equipment": 6, "postshift": 5}[checklist_type]

    # Simulate a "true" underlying diligence level per submission (hidden).
    diligence = RNG.beta(5, 2)  # skewed toward higher completion, long tail low

    checked = int(round(total_items * np.clip(diligence + RNG.normal(0, 0.08), 0, 1)))
    checked = min(checked, total_items)
    required_checked = int(round(required_total * np.clip(diligence + RNG.normal(0, 0.1), 0, 1)))
    required_checked = min(required_checked, required_total)

    completion_pct = round(100 * checked / total_items)
    required_pct = round(100 * required_checked / required_total) if required_total else 100
    missed_required = required_total - required_checked

    hour = int(RNG.integers(0, 24))
    is_night_shift = 1 if (hour >= 22 or hour < 6) else 0

    # Rolling history signals (simulate a trailing window per "user")
    rolling_avg_completion = np.clip(diligence * 100 + RNG.normal(0, 8), 0, 100)
    rolling_avg_required_pct = np.clip(diligence * 100 + RNG.normal(0, 10), 0, 100)
    consecutive_low = 1 if (rolling_avg_completion < 60 and RNG.random() < 0.6) else 0
    repeated_miss_count = int(RNG.poisson(0.3 + (1 - diligence) * 1.5))

    # Zone context
    recent_incidents_zone = int(RNG.poisson(0.2 + (1 - diligence) * 0.4))
    active_alerts_zone = int(RNG.poisson(0.15))

    equipment_defect_flag = (
        1 if (checklist_type == "equipment" and missed_required > 0 and RNG.random() < 0.7) else 0
    )

    # ── Hidden ground-truth risk function (NOT given to the model directly) ──
    true_risk = (
        0.35 * (missed_required / max(required_total, 1))
        + 0.20 * (1 - completion_pct / 100)
        + 0.15 * consecutive_low
        + 0.10 * min(repeated_miss_count / 3, 1)
        + 0.10 * min(recent_incidents_zone / 2, 1)
        + 0.05 * min(active_alerts_zone / 2, 1)
        + 0.05 * is_night_shift
        + 0.10 * equipment_defect_flag
    )
    true_risk = np.clip(true_risk + RNG.normal(0, 0.06), 0, 1)  # label noise

    incident_within_7d = 1 if RNG.random() < true_risk else 0

    return {
        "checklist_type": checklist_type,
        "total_items": total_items,
        "checked": checked,
        "required_total": required_total,
        "required_checked": required_checked,
        "completion_pct": completion_pct,
        "required_pct": required_pct,
        "missed_required": missed_required,
        "is_night_shift": is_night_shift,
        "rolling_avg_completion_5": round(rolling_avg_completion, 1),
        "rolling_avg_required_pct_5": round(rolling_avg_required_pct, 1),
        "consecutive_low_completion": consecutive_low,
        "repeated_miss_count_7": repeated_miss_count,
        "recent_incidents_zone_7d": recent_incidents_zone,
        "active_alerts_zone": active_alerts_zone,
        "equipment_defect_flag": equipment_defect_flag,
        "incident_within_7d": incident_within_7d,  # TARGET
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=6000)
    ap.add_argument("--out", type=str, default="training_data.csv")
    args = ap.parse_args()

    rows = [sample_one() for _ in range(args.n)]
    df = pd.DataFrame(rows)
    df.to_csv(args.out, index=False)
    print(f"Wrote {len(df)} rows to {args.out}")
    print(f"Positive rate (incident_within_7d=1): {df['incident_within_7d'].mean():.3f}")


if __name__ == "__main__":
    main()


# ─────────────────────────────────────────────────────────────────────────
# STUB for later: once you have real data in MongoDB, write a script that
# queries the Checklist + Incident collections and outputs the SAME columns
# as above, with incident_within_7d computed as: did an Incident with
# matching zone/user occur within 7 days after this checklist's shiftDate?
# Then just point train_risk_model.py at that CSV instead.
# ─────────────────────────────────────────────────────────────────────────
