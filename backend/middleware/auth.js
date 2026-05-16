// middleware/auth.js — JWT verification + role-based guard
const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// ── Verify JWT token ──────────────────────────────────────
const protect = async (req, res, next) => {
  try {
    let token;

    // Accept token from Authorization header or cookie
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'User no longer exists.' });
    }
    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account has been deactivated.' });
    }

    req.user = user;
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError'
      ? 'Token expired. Please log in again.'
      : 'Invalid token.';
    return res.status(401).json({ success: false, message });
  }
};

// ── Role guard factory ────────────────────────────────────
// Usage: authorize('admin')  or  authorize('admin', 'employee')
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Role '${req.user.role}' is not authorized for this action.`,
    });
  }
  next();
};

module.exports = { protect, authorize };