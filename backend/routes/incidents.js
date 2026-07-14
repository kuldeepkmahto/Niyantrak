// routes/incidents.js
const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const Incident = require('../models/Incident');
const { protect, authorize } = require('../middleware/auth');
const { triageReport } = require('../utils/aiTriage');

const SEVERITY_SCORE = { low: 15, medium: 40, high: 70, critical: 95 };

const router = express.Router();

// ── Multer file upload ────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename:    (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|pdf|doc|docx/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Only images and documents are allowed.'));
  },
});

// All routes require auth
router.use(protect);

// ── POST /api/incidents — submit a report ─────────────────
router.post('/', upload.array('attachments', 5), async (req, res, next) => {
  try {
    const body = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body;

    const attachments = (req.files || []).map(f => ({
      filename:     f.filename,
      originalName: f.originalname,
      path:         `/uploads/${f.filename}`,
      mimetype:     f.mimetype,
      size:         f.size,
    }));

    // Best-effort AI auto-triage of the freeform description. Never blocks
    // or fails the submission — if this throws, the report still saves.
    let aiTriage = null;
    let aiRiskScore = null;
    let aiFlags = [];
    try {
      const result = await triageReport({ type: body.type, description: body.description, zone: body.zone });
      aiTriage = { ...result, analyzedAt: new Date() };
      aiRiskScore = SEVERITY_SCORE[result.suggestedSeverity] ?? null;
      aiFlags = result.keyRisks || [];
    } catch (err) {
      console.warn('[incidents] AI triage skipped:', err.message);
    }

    const incident = await Incident.create({
      ...body,
      submittedBy: req.user._id,
      attachments,
      aiTriage,
      aiRiskScore,
      aiFlags,
    });

    await incident.populate('submittedBy', 'fullname email role');
    res.status(201).json({ success: true, data: incident });
  } catch (err) { next(err); }
});

// ── GET /api/incidents — list (role-filtered) ─────────────
router.get('/', async (req, res, next) => {
  try {
    const { type, status, severity, location, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (type)     filter.type = type;
    if (status)   filter.status = status;
    if (severity) filter.severity = severity;
    if (location) filter.location = { $regex: location, $options: 'i' };

    // Employees only see their own reports
    if (req.user.role === 'employee') filter.submittedBy = req.user._id;

    const total = await Incident.countDocuments(filter);
    const incidents = await Incident.find(filter)
      .populate('submittedBy', 'fullname email role')
      .populate('resolvedBy', 'fullname email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({
      success: true,
      count:   incidents.length,
      total,
      page:    parseInt(page),
      pages:   Math.ceil(total / limit),
      data:    incidents,
    });
  } catch (err) { next(err); }
});

// ── GET /api/incidents/stats — summary for dashboard ──────
router.get('/stats', authorize('admin', 'safetyofficer'), async (req, res, next) => {
  try {
    const [byType, bySeverity, byStatus, recent] = await Promise.all([
      Incident.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
      Incident.aggregate([{ $group: { _id: '$severity', count: { $sum: 1 } } }]),
      Incident.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Incident.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } }),
    ]);
    res.json({ success: true, data: { byType, bySeverity, byStatus, last7Days: recent } });
  } catch (err) { next(err); }
});

// ── GET /api/incidents/:id ────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const incident = await Incident.findById(req.params.id)
      .populate('submittedBy', 'fullname email role department')
      .populate('resolvedBy',  'fullname email')
      .populate('workPermit.approvedBy', 'fullname email');

    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found.' });

    // Employees can only view their own
    if (req.user.role === 'employee' && !incident.submittedBy._id.equals(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this report.' });
    }

    res.json({ success: true, data: incident });
  } catch (err) { next(err); }
});

// ── PUT /api/incidents/:id/status ─────────────────────────
router.put('/:id/status', authorize('admin', 'safetyofficer', 'firemen'), async (req, res, next) => {
  try {
    const { status, adminNotes } = req.body;
    const update = { status };
    if (adminNotes) update.adminNotes = adminNotes;
    if (status === 'resolved') { update.resolvedBy = req.user._id; update.resolvedAt = new Date(); }

    const incident = await Incident.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
      .populate('submittedBy', 'fullname email');
    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found.' });

    res.json({ success: true, data: incident });
  } catch (err) { next(err); }
});

// ── PUT /api/incidents/:id/approve-permit ─────────────────
router.put('/:id/approve-permit', authorize('admin', 'safetyofficer'), async (req, res, next) => {
  try {
    const { decision, adminNotes } = req.body; // decision: 'approved' | 'rejected'
    const incident = await Incident.findByIdAndUpdate(req.params.id, {
      'workPermit.approvalStatus': decision,
      'workPermit.approvedBy':     req.user._id,
      'workPermit.approvedAt':     new Date(),
      status: decision === 'approved' ? 'closed' : 'under-review',
      adminNotes,
    }, { new: true }).populate('submittedBy', 'fullname email');

    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found.' });
    res.json({ success: true, data: incident });
  } catch (err) { next(err); }
});

// ── DELETE /api/incidents/:id ─────────────────────────────
router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const incident = await Incident.findByIdAndDelete(req.params.id);
    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found.' });
    res.json({ success: true, message: 'Incident deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;