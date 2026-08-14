// utils/aiTriage.js
// Lightweight heuristic triage for incident descriptions.

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function detectHazardCategory(typeText, descriptionText) {
  const text = `${normalizeText(typeText)} ${normalizeText(descriptionText)}`;

  if (/(fire|smoke|heat|flame|burn)/.test(text)) return 'fire';
  if (/(electric|electrical|shock|wire|circuit|power)/.test(text)) return 'electrical';
  if (/(chemical|gas|leak|spill|toxic|fume|hazmat)/.test(text)) return 'chemical';
  if (/(injur|accident|fall|slip|trip|cut|fracture|hurt)/.test(text)) return 'injury';
  if (/(equipment|machine|mechanical|malfunction|fault|break)/.test(text)) return 'equipment';
  if (/(blocked exit|evac|crowd|security|theft|unauthorized)/.test(text)) return 'safety';

  return 'general';
}

function suggestSeverity(descriptionText) {
  const text = normalizeText(descriptionText);

  if (/(fatal|critical|explode|explosion|major injury|unconscious|collapsed|spreading fire)/.test(text)) {
    return 'critical';
  }
  if (/(fire|smoke|burning|leak|spill|gas|injury|serious|severe|unsafe)/.test(text)) {
    return 'high';
  }
  if (/(warning|hazard|fault|near miss|unsafe|minor injury|small leak|overheat)/.test(text)) {
    return 'medium';
  }

  return 'low';
}

function buildSummary(type, description) {
  const cleaned = String(description || '').trim().replace(/\s+/g, ' ');
  const shortText = cleaned.length > 140 ? `${cleaned.slice(0, 137)}...` : cleaned;
  const typeLabel = type ? String(type).replace(/[-_]/g, ' ') : 'report';
  return shortText ? `Auto-triaged ${typeLabel}: ${shortText}` : `Auto-triaged ${typeLabel}.`;
}

function buildKeyRisks(hazardCategory, severity, description) {
  const risks = [];
  const text = normalizeText(description);

  if (hazardCategory === 'fire') risks.push('Potential fire escalation');
  if (hazardCategory === 'electrical') risks.push('Possible electrical shock or arc flash');
  if (hazardCategory === 'chemical') risks.push('Exposure to hazardous substances');
  if (hazardCategory === 'injury') risks.push('Worker injury or medical escalation');
  if (hazardCategory === 'equipment') risks.push('Equipment failure and downtime');
  if (hazardCategory === 'safety') risks.push('Evacuation or access control issue');

  if (severity === 'critical') risks.unshift('Immediate escalation required');
  else if (severity === 'high') risks.unshift('High priority review needed');
  else if (severity === 'medium') risks.unshift('Monitor and correct promptly');
  else risks.unshift('Low urgency but should still be reviewed');

  if (/(smoke|heat|flame|spill|leak|shock|injury|collapse)/.test(text) && !risks.some(r => /potential|possible|exposure|injury|failure|evacuation/i.test(r))) {
    risks.push('Description contains concrete hazard indicators');
  }

  return [...new Set(risks)];
}

async function triageReport({ type, description, zone }) {
  const suggestedSeverity = suggestSeverity(description);
  const hazardCategory = detectHazardCategory(type, description);
  const keyRisks = buildKeyRisks(hazardCategory, suggestedSeverity, description);

  return {
    suggestedSeverity,
    hazardCategory,
    summary: buildSummary(type, description),
    keyRisks,
    zone: zone || null,
    source: 'heuristic',
    analyzedAt: new Date(),
  };
}

module.exports = { triageReport };