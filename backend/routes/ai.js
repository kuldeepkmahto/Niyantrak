// routes/ai.js
const express    = require('express');
const Checklist  = require('../models/Checklist');
const Alert      = require('../models/Alert');
const User       = require('../models/User');
const { analyzeChecklist, getZoneRiskReport, predictIncidentRisk } = require('../utils/aiDetection');
const { triageReport } = require('../utils/aiTriage');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// ── POST /api/ai/triage ───────────────────────────────
// NLP auto-triage: given a report type + freeform description, suggest a
// severity, hazard category, one-line summary, and key risks. Called live
// from the report forms (e.g. via an "AI Assist" button) before submission,
// and automatically re-run server-side when the report is actually saved.
router.post('/triage', async (req, res, next) => {
  try {
    const { type, description, zone } = req.body;
    if (!description || !description.trim()) {
      return res.status(400).json({ success: false, message: 'Description is required for triage.' });
    }
    const result = await triageReport({ type, description, zone });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ── POST /api/ai/sensor-fusion ────────────────────────
// Accepts sensor + vision inputs, returns an early hazard detection result.
router.post('/sensor-fusion', authorize('admin', 'safetyofficer', 'firemen'), async (req, res, next) => {
  try {
    const { smokePPM, temperature, carbonMonoxide, soundLevel, cameraAlert, zone, location } = req.body;
    let score = 0;
    const flags = [];

    if (smokePPM >= 35) {
      score += 30;
      flags.push('Smoke levels above safe threshold.');
    }
    if (temperature >= 55) {
      score += 30;
      flags.push('High temperature detected near hazard threshold.');
    }
    if (carbonMonoxide >= 50) {
      score += 20;
      flags.push('Elevated carbon monoxide concentration detected.');
    }
    if (soundLevel >= 85) {
      score += 10;
      flags.push('Unusual acoustic signature detected in the area.');
    }
    if (cameraAlert) {
      score += 20;
      flags.push('Vision model flagged a potential fire or smoke event.');
    }

    score = Math.min(100, score);
    const riskLevel = score >= 70 ? 'critical' : score >= 45 ? 'high' : score >= 25 ? 'medium' : 'low';
    const riskLabel = riskLevel === 'critical' ? '🔴 Critical Hazard' : riskLevel === 'high' ? '🟠 High Hazard' : riskLevel === 'medium' ? '🟡 Medium Hazard' : '🟢 Low Hazard';

    res.json({
      success: true,
      data: {
        score,
        riskLevel,
        riskLabel,
        flags,
        sensorReadings: { smokePPM, temperature, carbonMonoxide, soundLevel, cameraAlert },
        zone,
        location,
        analyzedAt: new Date(),
      },
    });
  } catch (err) { next(err); }
});

// ── POST /api/ai/analyze-checklist ────────────────────────
// Accepts a checklist submission, scores it, saves it, returns AI result.
// This is the main entry point called when a fireman submits a checklist.
router.post('/analyze-checklist', async (req, res, next) => {
  try {
    const { checklistType, items, zone, shiftDate } = req.body;

    if (!checklistType || !items?.length) {
      return res.status(400).json({ success: false, message: 'checklistType and items are required.' });
    }

    // Run AI scoring
    const aiResult = await analyzeChecklist({
      userId: req.user._id,
      checklistType,
      items,
      zone,
      shiftDate,
    });

    // Compute stats
    const stats = aiResult.stats;

    // Save the checklist with AI result
    const checklist = await Checklist.create({
      submittedBy:   req.user._id,
      checklistType,
      shiftDate:     shiftDate || new Date(),
      zone,
      items,
      stats,
      ai: {
        riskScore:       aiResult.riskScore,
        riskLevel:       aiResult.riskLevel,
        flags:           aiResult.flags,
        recommendations: aiResult.recommendations,
        analyzedAt:      aiResult.analyzedAt,
      },
    });

    // Update user's rolling risk profile
    const allScores = await Checklist.find({ submittedBy: req.user._id })
      .select('ai.riskScore stats.completionPct stats.requiredPct stats.requiredTotal stats.requiredChecked')
      .lean();

    const avgCompletion  = allScores.reduce((a, c) => a + (c.stats?.completionPct || 0), 0) / allScores.length;
    const totalMissed    = allScores.reduce((a, c) => a + ((c.stats?.requiredTotal || 0) - (c.stats?.requiredChecked || 0)), 0);

    await User.findByIdAndUpdate(req.user._id, {
      'riskProfile.totalChecklists': allScores.length,
      'riskProfile.missedRequired':  totalMissed,
      'riskProfile.avgCompletion':   Math.round(avgCompletion),
      'riskProfile.riskScore':       aiResult.riskScore,
      'riskProfile.lastUpdated':     new Date(),
    });

    // Auto-create a system alert if critical risk detected
    if (aiResult.riskLevel === 'critical') {
      await Alert.create({
        title:       `AI Risk Alert — ${req.user.fullname}`,
        location:    zone || 'Unknown Zone',
        level:       'critical',
        type:        'other',
        detail:      `Critical risk detected from ${checklistType} checklist. Score: ${aiResult.riskScore}/100. Flags: ${aiResult.flags.slice(0, 2).join('; ')}`,
        status:      'active',
        source:      'ai-detection',
        triggeredBy: req.user._id,
        aiGenerated:  true,
        aiConfidence: parseFloat((aiResult.riskScore / 100).toFixed(2)),
      });
    }

    res.status(201).json({
      success: true,
      data: {
        checklistId: checklist._id,
        ...aiResult,
      },
    });
  } catch (err) { next(err); }
});

// ── GET /api/ai/risk-report/:zone ─────────────────────────
// Aggregated risk report for a zone over last N days
router.get('/risk-report/:zone', authorize('admin', 'safetyofficer', 'firemen'), async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const report = await getZoneRiskReport(req.params.zone, days);
    res.json({ success: true, data: report });
  } catch (err) { next(err); }
});

// ── POST /api/ai/predict-incident ─────────────────────────
// Predict incident likelihood for a specific user
router.post('/predict-incident', authorize('admin', 'safetyofficer'), async (req, res, next) => {
  try {
    const userId = req.body.userId || req.user._id;
    const result = await predictIncidentRisk(userId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ── GET /api/ai/recommendations ───────────────────────────
// Personalized recommendations for the logged-in user
router.get('/recommendations', async (req, res, next) => {
  try {
    const recent = await Checklist.find({ submittedBy: req.user._id })
      .sort({ shiftDate: -1 }).limit(5).lean();

    if (!recent.length) {
      return res.json({
        success: true,
        data: {
          message: 'No checklist history yet. Submit your first checklist to get recommendations.',
          recommendations: ['Start by completing your pre-shift checklist before every shift.'],
        },
      });
    }

    // Collect all recommendations from recent checklists, ranked by frequency
    const recCount = {};
    const flagCount = {};
    recent.forEach(c => {
      (c.ai?.recommendations || []).forEach(r => { recCount[r] = (recCount[r] || 0) + 1; });
      (c.ai?.flags || []).forEach(f => { flagCount[f] = (flagCount[f] || 0) + 1; });
    });

    const topRecs  = Object.entries(recCount).sort((a,b) => b[1]-a[1]).slice(0,5).map(([r]) => r);
    const topFlags = Object.entries(flagCount).sort((a,b) => b[1]-a[1]).slice(0,3).map(([f,n]) => ({ flag:f, occurrences:n }));

    const latestScore = recent[0]?.ai?.riskScore || 0;
    const trend = recent.length >= 3
      ? (recent[0].ai?.riskScore > recent[2].ai?.riskScore ? 'worsening' : 'improving')
      : 'stable';

    res.json({
      success: true,
      data: {
        latestRiskScore:   latestScore,
        riskTrend:         trend,
        topFlags,
        recommendations:   topRecs.length ? topRecs : ['Keep up the good work — no major issues detected.'],
        checklistsAnalyzed: recent.length,
      },
    });
  } catch (err) { next(err); }
});

// ── GET /api/ai/dashboard — admin-wide AI summary ─────────
router.get('/dashboard', authorize('admin', 'safetyofficer'), async (req, res, next) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

    const [
      totalChecklists,
      highRisk,
      criticalAlerts,
      avgScore,
    ] = await Promise.all([
      Checklist.countDocuments({ shiftDate: { $gte: sevenDaysAgo } }),
      Checklist.countDocuments({ 'ai.riskLevel': { $in: ['high', 'critical'] }, shiftDate: { $gte: sevenDaysAgo } }),
      Alert.countDocuments({ source: 'ai-detection', status: { $ne: 'resolved' } }),
      Checklist.aggregate([
        { $match: { shiftDate: { $gte: sevenDaysAgo } } },
        { $group: { _id: null, avg: { $avg: '$ai.riskScore' } } },
      ]),
    ]);

    // Top risky users
    const riskyUsers = await User.find({ 'riskProfile.riskScore': { $gt: 50 } })
      .select('fullname email role riskProfile')
      .sort({ 'riskProfile.riskScore': -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        last7Days: {
          checklistsSubmitted: totalChecklists,
          highRiskChecklists:  highRisk,
          aiGeneratedAlerts:   criticalAlerts,
          avgRiskScore:        Math.round(avgScore[0]?.avg || 0),
        },
        topRiskyUsers: riskyUsers,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;