// models/Incident.js — covers Near Miss, Unsafe Condition, Work Permit, Incident Report
const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
  // ── Type ──────────────────────────────────────────────
  type: {
    type: String,
    enum: ['near-miss', 'unsafe-condition', 'work-permit', 'incident-report'],
    required: true,
  },

  // ── Submitted by ──────────────────────────────────────
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // ── Common fields ─────────────────────────────────────
  location:    { type: String, required: true },
  zone:        { type: String },
  description: { type: String, required: true },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
  incidentDate: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['open', 'under-review', 'resolved', 'closed', 'pending-approval'],
    default: 'open',
  },

  // ── Near Miss specific ────────────────────────────────
  nearMiss: {
    whatHappened:        String,
    contributingFactors: [String],
    immediateAction:     String,
    preventiveSuggestion: String,
    personsInvolved:     [String],
  },

  // ── Unsafe Condition specific ─────────────────────────
  unsafeCondition: {
    hazardType:      String,
    areaStatus:      String,
    immediateAction: String,
  },

  // ── Work Permit specific ──────────────────────────────
  workPermit: {
    permitType:       String,
    startDateTime:    Date,
    endDateTime:      Date,
    supervisorName:   String,
    numWorkers:       Number,
    safetyChecks:     [String],
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
  },

  // ── Incident Report specific ──────────────────────────
  incidentReport: {
    incidentType:      String,
    personsInvolved:   [String],
    injuriesOrDamage:  String,
    responseActions:   [String],
  },

  // ── Files ─────────────────────────────────────────────
  attachments: [{
    filename:    String,
    originalName: String,
    path:        String,
    mimetype:    String,
    size:        Number,
    uploadedAt:  { type: Date, default: Date.now },
  }],

  // ── Admin fields ──────────────────────────────────────
  resolvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt:  Date,
  adminNotes:  String,

  // ── AI risk score (computed on submission) ────────────
  aiRiskScore: { type: Number, default: null },
  aiFlags:     [String],

}, { timestamps: true });

// Index for fast queries
incidentSchema.index({ type: 1, status: 1 });
incidentSchema.index({ submittedBy: 1 });
incidentSchema.index({ location: 1 });
incidentSchema.index({ incidentDate: -1 });

module.exports = mongoose.model('Incident', incidentSchema);