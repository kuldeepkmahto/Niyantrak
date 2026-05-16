const express = require('express');
const { body, validationResult } = require('express-validator');
const ComplianceLog = require('../models/ComplianceLog');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// ── POST /api/compliance/logs — create a compliance entry
router.post('/logs', [
  body('zone').trim().notEmpty().withMessage('Zone is required'),
  body('standard').trim().notEmpty().withMessage('Standard is required'),
  body('status').isIn(['compliant', 'non-compliant', 'under-review']).withMessage('Invalid status'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const log = await ComplianceLog.create({
      ...req.body,
      submittedBy: req.user._id,
    });

    res.status(201).json({ success: true, data: log });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/compliance/logs — list compliance logs
router.get('/logs', async (req, res, next) => {
  try {
    const { zone, standard, status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (zone) filter.zone = { $regex: zone, $options: 'i' };
    if (standard) filter.standard = { $regex: standard, $options: 'i' };
    if (status) filter.status = status;

    const total = await ComplianceLog.countDocuments(filter);
    const logs = await ComplianceLog.find(filter)
      .populate('submittedBy', 'fullname email role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit, 10));

    res.json({ success: true, count: logs.length, total, data: logs });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/compliance/report — summary by standard and zone
router.get('/report', authorize('admin', 'safetyofficer'), async (req, res, next) => {
  try {
    const { zone, standard } = req.query;
    const filter = {};
    if (zone) filter.zone = { $regex: zone, $options: 'i' };
    if (standard) filter.standard = { $regex: standard, $options: 'i' };

    const summary = await ComplianceLog.aggregate([
      { $match: filter },
      { $group: {
        _id: { standard: '$standard', zone: '$zone', status: '$status' },
        count: { $sum: 1 },
        avgCompletion: { $avg: '$completionPct' },
      } },
      { $sort: { '_id.standard': 1, '_id.zone': 1 } },
    ]);

    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
