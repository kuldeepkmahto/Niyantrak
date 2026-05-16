// utils/aiDetection.js — Risk scoring engine based on checklist history
// Uses weighted rule-based scoring + trend analysis (no external ML dependency)
// Can be swapped for a real model (TensorFlow.js, OpenAI, etc.) later

const Checklist = require('../models/Checklist');
const Incident  = require('../models/Incident');
const Alert     = require('../models/Alert');

// ── Risk weights ────────────────────────────────────────
const WEIGHTS = {
  missedRequired:     15,  // per missed required item
  lowCompletion:       8,  // per 10% below 80% completion
  repeatedMiss:       20,  // same required item missed 3+ times in a week
  recentIncident:     25,  // incident in same zone in last 7 days
  activeAlert:        30,  // active alert in same zone
  consecutiveLow:     18,  // 3+ checklists in a row below 60% completion
  nightShift:          5,  // night shift (higher baseline risk)
  equipmentDefect:    22,  // equipment checklist has critical item unchecked
};

// ── Risk thresholds ─────────────────────────────────────
const RISK_LEVELS = [
  { max: 20,  level: 'low',      label: '🟢 Low Risk' },
  { max: 45,  level: 'medium',   label: '🟡 Medium Risk' },
  { max: 70,  level: 'high',     label: '🟠 High Risk' },
  { max: 100, level: 'critical', label: '🔴 Critical Risk' },
];

function getRiskLevel(score) {
  return RISK_LEVELS.find(r => score <= r.max) || RISK_LEVELS[3];
}

// ── Compute stats for a set of checklist items ──────────
function computeStats(items) {
  const total           = items.length;
  const checked         = items.filter(i => i.checked).length;
  const requiredTotal   = items.filter(i => i.priority === 'high').length;
  const requiredChecked = items.filter(i => i.priority === 'high' && i.checked).length;
  return {
    total,
    checked,
    requiredTotal,
    requiredChecked,
    completionPct: total ? Math.round((checked / total) * 100) : 0,
    requiredPct:   requiredTotal ? Math.round((requiredChecked / requiredTotal) * 100) : 100,
  };
}

// ── Analyze a single fresh checklist submission ──────────
async function analyzeChecklist({ userId, checklistType, items, zone, shiftDate }) {
  let score = 0;
  const flags = [];
  const recommendations = [];

  const stats = computeStats(items);
  const missedRequired = stats.requiredTotal - stats.requiredChecked;

  // 1. Missed required items
  if (missedRequired > 0) {
    score += missedRequired * WEIGHTS.missedRequired;
    flags.push(`${missedRequired} required safety item(s) skipped`);
    recommendations.push('Complete all required items before starting shift — these are non-negotiable safety checks.');
  }

  // 2. Low overall completion
  if (stats.completionPct < 80) {
    const deficit = Math.floor((80 - stats.completionPct) / 10);
    score += deficit * WEIGHTS.lowCompletion;
    flags.push(`Overall completion only ${stats.completionPct}%`);
    recommendations.push('Aim for at least 80% completion on every checklist submission.');
  }

  // 3. Equipment checklist: any unchecked high-priority item = elevated risk
  if (checklistType === 'equipment') {
    const uncheckedEquip = items.filter(i => i.priority === 'high' && !i.checked);
    if (uncheckedEquip.length > 0) {
      score += uncheckedEquip.length * WEIGHTS.equipmentDefect;
      flags.push(`Critical equipment not verified: ${uncheckedEquip.map(i => i.label).join(', ')}`);
      recommendations.push('Log faulty equipment in the maintenance system and notify your supervisor immediately.');
    }
  }

  // 4. Historical pattern: look at last 10 checklists by this user
  const history = await Checklist.find({ submittedBy: userId, checklistType })
    .sort({ shiftDate: -1 }).limit(10).lean();

  if (history.length >= 3) {
    // Consecutive low completion
    const recentThree = history.slice(0, 3);
    const allLow = recentThree.every(c => (c.stats?.completionPct || 0) < 60);
    if (allLow) {
      score += WEIGHTS.consecutiveLow;
      flags.push('3 consecutive checklists with <60% completion — concerning pattern detected');
      recommendations.push('Consistent low completion may indicate workload issues or knowledge gaps. Request additional support or training.');
    }

    // Repeated miss: same high-priority item unchecked 3+ times in last 7 submissions
    const recentSeven = history.slice(0, 7);
    const missCount   = {};
    recentSeven.forEach(c => {
      (c.items || []).filter(i => i.priority === 'high' && !i.checked).forEach(i => {
        missCount[i.label] = (missCount[i.label] || 0) + 1;
      });
    });
    const repeatedMisses = Object.entries(missCount).filter(([, n]) => n >= 3);
    if (repeatedMisses.length > 0) {
      score += repeatedMisses.length * WEIGHTS.repeatedMiss;
      repeatedMisses.forEach(([label]) => {
        flags.push(`"${label}" repeatedly skipped (${missCount[label]}x in last 7 shifts)`);
        recommendations.push(`Investigate why "${label}" is consistently being skipped — may be an equipment or procedural issue.`);
      });
    }
  }

  // 5. Recent incident in same zone (last 7 days)
  if (zone) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentInc = await Incident.countDocuments({
      location: { $regex: zone, $options: 'i' },
      incidentDate: { $gte: sevenDaysAgo },
      status: { $ne: 'resolved' },
    });
    if (recentInc > 0) {
      score += WEIGHTS.recentIncident;
      flags.push(`${recentInc} unresolved incident(s) in ${zone} in the last 7 days`);
      recommendations.push(`Zone ${zone} has recent incidents. Exercise extra caution and verify all safety measures.`);
    }
  }

  // 6. Active alert in same zone
  if (zone) {
    const activeAlert = await Alert.countDocuments({
      location: { $regex: zone, $options: 'i' },
      status: { $in: ['active', 'acknowledged', 'escalated'] },
    });
    if (activeAlert > 0) {
      score += WEIGHTS.activeAlert;
      flags.push(`${activeAlert} active alert(s) in ${zone}`);
      recommendations.push('Active alert in your zone — follow emergency protocols and stay in contact with your supervisor.');
    }
  }

  // 7. Night shift bonus (if between 10PM–6AM)
  const hour = (shiftDate ? new Date(shiftDate) : new Date()).getHours();
  if (hour >= 22 || hour < 6) {
    score += WEIGHTS.nightShift;
    flags.push('Night shift — statistically higher incident probability');
    recommendations.push('Night shifts carry elevated risk. Ensure buddy system is in place and communication lines are open.');
  }

  // Cap score at 100
  score = Math.min(score, 100);

  const riskResult = getRiskLevel(score);

  // Auto-generate alert if critical
  if (riskResult.level === 'critical') {
    recommendations.unshift('⚠️ CRITICAL: Immediate supervisor review required before proceeding with shift.');
  }

  return {
    riskScore: score,
    riskLevel: riskResult.level,
    riskLabel: riskResult.label,
    flags,
    recommendations: [...new Set(recommendations)], // deduplicate
    stats,
    analyzedAt: new Date(),
  };
}

// ── Zone risk report (aggregate across all recent checklists) ──
async function getZoneRiskReport(zone, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const checklists = await Checklist.find({
    zone: { $regex: zone, $options: 'i' },
    shiftDate: { $gte: since },
  }).lean();

  if (checklists.length === 0) {
    return { zone, dataPoints: 0, message: 'No checklist data for this zone in the given period.' };
  }

  const scores      = checklists.map(c => c.ai?.riskScore || 0);
  const avgScore    = scores.reduce((a, b) => a + b, 0) / scores.length;
  const maxScore    = Math.max(...scores);
  const trend       = computeTrend(checklists.map(c => c.ai?.riskScore || 0));
  const riskResult  = getRiskLevel(avgScore);

  // Tally common flags
  const flagCount = {};
  checklists.forEach(c => (c.ai?.flags || []).forEach(f => { flagCount[f] = (flagCount[f] || 0) + 1; }));
  const topFlags = Object.entries(flagCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([flag, count]) => ({ flag, count }));

  return {
    zone,
    period: `${days} days`,
    dataPoints: checklists.length,
    avgRiskScore: Math.round(avgScore),
    maxRiskScore: Math.round(maxScore),
    riskLevel: riskResult.level,
    riskLabel: riskResult.label,
    trend,
    topFlags,
    recommendation: riskResult.level === 'critical' || riskResult.level === 'high'
      ? `Zone ${zone} shows elevated risk. Consider safety audit and additional training.`
      : `Zone ${zone} risk is within acceptable range. Maintain current safety standards.`,
  };
}

// ── Predict incident likelihood based on patterns ────────
async function predictIncidentRisk(userId) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [checklists, userIncidents] = await Promise.all([
    Checklist.find({ submittedBy: userId, shiftDate: { $gte: thirtyDaysAgo } }).sort({ shiftDate: -1 }).lean(),
    Incident.find({ submittedBy: userId, incidentDate: { $gte: thirtyDaysAgo } }).lean(),
  ]);

  if (checklists.length < 3) {
    return { message: 'Insufficient data. Need at least 3 checklist submissions for prediction.', prediction: null };
  }

  const avgCompletion = checklists.reduce((a, c) => a + (c.stats?.completionPct || 0), 0) / checklists.length;
  const avgRequired   = checklists.reduce((a, c) => a + (c.stats?.requiredPct  || 0), 0) / checklists.length;
  const recentScore   = checklists[0]?.ai?.riskScore || 0;
  const incidentRate  = userIncidents.length / 30; // incidents per day

  // Simple weighted incident likelihood score
  let likelihood = 0;
  if (avgCompletion < 70)   likelihood += 35;
  if (avgRequired < 80)     likelihood += 40;
  if (recentScore > 60)     likelihood += 20;
  if (incidentRate > 0.1)   likelihood += 25; // more than 3 incidents/month
  likelihood = Math.min(likelihood, 100);

  const level = getRiskLevel(likelihood);

  return {
    userId,
    incidentLikelihood: likelihood,
    riskLevel: level.level,
    riskLabel: level.label,
    factors: {
      avgChecklistCompletion: Math.round(avgCompletion),
      avgRequiredCompletion:  Math.round(avgRequired),
      recentRiskScore:        recentScore,
      incidentsLast30Days:    userIncidents.length,
    },
    recommendation: likelihood > 50
      ? 'This employee has a high predicted incident risk. Consider safety coaching or workload review.'
      : 'Incident risk is within acceptable range. Continue monitoring.',
    analyzedAt: new Date(),
  };
}

// ── Trend helper ─────────────────────────────────────────
function computeTrend(scores) {
  if (scores.length < 2) return 'stable';
  const first = scores.slice(0, Math.floor(scores.length / 2));
  const last  = scores.slice(Math.floor(scores.length / 2));
  const avgFirst = first.reduce((a, b) => a + b, 0) / first.length;
  const avgLast  = last.reduce((a, b) => a + b, 0) / last.length;
  const delta = avgLast - avgFirst;
  if (delta > 10) return 'worsening';
  if (delta < -10) return 'improving';
  return 'stable';
}

module.exports = { analyzeChecklist, getZoneRiskReport, predictIncidentRisk, computeStats };