// models/User.js
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullname:   { type: String, required: true, trim: true },
  email:      { type: String, required: true, unique: true, lowercase: true },
  password:   { type: String, required: true, select: false },
  phone:      String,
  role: {
    type: String,
    enum: ['admin', 'employee', 'firemen', 'safetyofficer'],
    default: 'employee',
  },
  department: String,
  isActive:   { type: Boolean, default: true },
  lastLogin:  Date,
}, { timestamps: true });

// ── Hash password before saving ───────────────────────────
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Instance method: compare password ────────────────────
userSchema.methods.matchPassword = async function(candidate) {
  return await bcrypt.compare(candidate, this.password);
};

// ── Indexes ──────────────────────────────────────────────
userSchema.index({ role: 1, isActive: 1 });

module.exports = mongoose.model('User', userSchema);
