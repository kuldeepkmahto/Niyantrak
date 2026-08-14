// utils/mlRiskClient.js
// Calls the Python risk-model microservice (serve_model.py). Falls back to
// the existing heuristic (predictIncidentRisk in aiDetection.js) if the ML
// service is unreachable or returns an error — so nothing breaks if the
// Python service isn't running.

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';

/**
 * Build the exact feature payload the model expects from a user's recent
 * checklist history + zone context. Mirrors the columns in
 * ml/generate_training_data.py / train_risk_model.py.
 */
function buildFeaturesFromHistory({ latestChecklist, history, zoneIncidents7d, activeAlertsInZone }) {
  const stats = latestChecklist.stats || {};
  const recentFive = history.slice(0, 5);
  const avgCompletion5 = recentFive.length
    ? recentFive.reduce((a, c) => a + (c.stats?.completionPct || 0), 0) / recentFive.length
    : stats.completionPct || 0;
  const avgRequiredPct5 = recentFive.length
    ? recentFive.reduce((a, c) => a + (c.stats?.requiredPct || 0), 0) / recentFive.length
    : stats.requiredPct || 100;

  const recentThree = history.slice(0, 3);
  const consecutiveLow = recentThree.length >= 3 && recentThree.every(c => (c.stats?.completionPct || 0) < 60) ? 1 : 0;

  const recentSeven = history.slice(0, 7);
  const missCount = {};
  recentSeven.forEach(c => {
    (c.items || []).filter(i => i.priority === 'high' && !i.checked).forEach(i => {
      missCount[i.label] = (missCount[i.label] || 0) + 1;
    });
  });
  const repeatedMissCount = Object.values(missCount).filter(n => n >= 3).length;

  const hour = new Date(latestChecklist.shiftDate || Date.now()).getHours();
  const isNightShift = (hour >= 22 || hour < 6) ? 1 : 0;

  const equipmentDefectFlag = (
    latestChecklist.checklistType === 'equipment' &&
    (stats.requiredTotal - stats.requiredChecked) > 0
  ) ? 1 : 0;

  return {
    checklist_type: latestChecklist.checklistType,
    total_items: stats.total || 0,
    checked: stats.checked || 0,
    required_total: stats.requiredTotal || 0,
    required_checked: stats.requiredChecked || 0,
    completion_pct: stats.completionPct || 0,
    required_pct: stats.requiredPct || 100,
    missed_required: (stats.requiredTotal || 0) - (stats.requiredChecked || 0),
    is_night_shift: isNightShift,
    rolling_avg_completion_5: Math.round(avgCompletion5 * 10) / 10,
    rolling_avg_required_pct_5: Math.round(avgRequiredPct5 * 10) / 10,
    consecutive_low_completion: consecutiveLow,
    repeated_miss_count_7: repeatedMissCount,
    recent_incidents_zone_7d: zoneIncidents7d || 0,
    active_alerts_zone: activeAlertsInZone || 0,
    equipment_defect_flag: equipmentDefectFlag,
  };
}

/**
 * Calls the ML service. Returns null on any failure so callers can fall
 * back to the heuristic — never throws.
 */
async function getMlRiskPrediction(features) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000); // 2s budget
    const resp = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(features),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    return await resp.json(); // { riskScore, riskLevel, riskLabel, incidentProbability, source: 'ml-model' }
  } catch (err) {
    return null; // service down / timed out — caller falls back to heuristic
  }
}

module.exports = { buildFeaturesFromHistory, getMlRiskPrediction, ML_SERVICE_URL };
