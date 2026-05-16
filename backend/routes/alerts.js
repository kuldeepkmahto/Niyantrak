// routes/alerts.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const Alert   = require('../models/Alert');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes require auth
router.use(protect);

// ── GET /api/alerts ───────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { status, level, type, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (level)  filter.level = level;
    if (type)   filter.type = type;

    const total = await Alert.countDocuments(filter);
    const alerts = await Alert.find(filter)
      .populate('triggeredBy', 'fullname email role')
      .populate('resolvedBy', 'fullname email role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({ success: true, count: alerts.length, total, data: alerts });
  } catch (err) { next(err); }
});

// ── POST /api/alerts — create an alert ────────────────────
router.post('/', [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('location').trim().notEmpty().withMessage('Location is required'),
  body('level').isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid level'),
  body('type').optional().isIn(['fire', 'smoke', 'temperature', 'equipment', 'gas', 'other']),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const alert = await Alert.create({
      ...req.body,
      triggeredBy: req.user._id,
    });

    await alert.populate('triggeredBy', 'fullname email role');

    res.status(201).json({ success: true, data: alert });
  } catch (err) { next(err); }
});

// ── PUT /api/alerts/:id/status — update status ────────────
router.put('/:id/status', [
  body('status').isIn(['active', 'acknowledged', 'escalated', 'resolved']).withMessage('Invalid status'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found.' });
    }

    const { status } = req.body;
    alert.status = status;

    if (status === 'resolved') {
      alert.resolvedBy = req.user._id;
      alert.resolvedAt = new Date();
    } else if (status === 'escalated') {
      alert.escalatedAt = new Date();
    }

    await alert.save();
    await alert.populate('triggeredBy', 'fullname email role');
    await alert.populate('resolvedBy', 'fullname email role');

    res.json({ success: true, data: alert });
  } catch (err) { next(err); }
});

// ── DELETE /api/alerts/:id — delete an alert ──────────────
router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const alert = await Alert.findByIdAndDelete(req.params.id);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found.' });
    }

    res.json({ success: true, message: 'Alert deleted successfully.' });
  } catch (err) { next(err); }
});

module.exports = router;
