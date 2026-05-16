const mongoose = require('mongoose');

const complianceLogSchema = new mongoose.Schema({
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  zone:        { type: String, required: true },
  standard:    { type: String, required: true },
  checklistType:{ type: String, enum: ['preshift', 'equipment', 'postshift', 'general'], default: 'general' },
  status: {
    type: String,
    enum: ['compliant', 'non-compliant', 'under-review'],
    default: 'under-review',
  },
  findings:    [String],
  completionPct: Number,
  requiredPct:   Number,
  notes:       String,
  autoLogged:  { type: Boolean, default: false },
  source: {
    type: String,
    enum: ['manual', 'ai', 'sensor-fusion'],
    default: 'manual',
  },
}, { timestamps: true });

complianceLogSchema.index({ zone: 1, standard: 1, status: 1 });
complianceLogSchema.index({ submittedBy: 1, createdAt: -1 });

module.exports = mongoose.model('ComplianceLog', complianceLogSchema);
