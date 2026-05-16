// routes/users.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const User    = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect, authorize('admin', 'safetyofficer'));

// ── GET /api/users ────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { role, isActive, search, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (role)     filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (search)   filter.$or = [
      { fullname: { $regex: search, $options: 'i' } },
      { email:    { $regex: search, $options: 'i' } },
    ];

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({ success: true, count: users.length, total, data: users });
  } catch (err) { next(err); }
});

// ── POST /api/users — admin creates a user ────────────────
router.post('/', [
  body('fullname').trim().notEmpty().withMessage('Full name is required'),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('role').isIn(['admin','employee','firemen','safetyofficer']),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const exists = await User.findOne({ email: req.body.email });
    if (exists) return res.status(409).json({ success: false, message: 'Email already exists.' });

    const user = await User.create(req.body);
    res.status(201).json({ success: true, data: user });
  } catch (err) { next(err); }
});

// ── GET /api/users/:id ────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

// ── PUT /api/users/:id ────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  try {
    const { password, ...fields } = req.body; // never update password here
    const user = await User.findByIdAndUpdate(req.params.id, fields, {
      new: true, runValidators: true,
    }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

// ── PUT /api/users/:id/role ───────────────────────────────
router.put('/:id/role', authorize('admin'), async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['admin','employee','firemen','safetyofficer'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role.' });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

// ── PUT /api/users/:id/deactivate ─────────────────────────
router.put('/:id/deactivate', authorize('admin'), async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account.' });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
});

// ── DELETE /api/users/:id ─────────────────────────────────
router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account.' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;