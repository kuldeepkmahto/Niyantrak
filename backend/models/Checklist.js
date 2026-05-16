// models/Checklist.js — stores every submitted checklist for AI pattern analysis
const mongoose = require('mongoose');

const checklistItemSchema = new mongoose.Schema({
  label:     { type: String, required: true },
  priority:  { type: String, enum: ['high', 'med', 'low'], required: true },
  checked:   { type: Boolean, default: false },
}, { _id: false });

const checklistSchema = new mongoose.Schema({
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  checklistType: {
    type: String,
    enum: ['preshift', 'equipment', 'postshift'],
    required: true,
  },
  shiftDate:   { type: Date, default: Date.now },
  zone:        { type: String },
  items:       [checklistItemSchema],

  // Computed stats (saved on submission)
  stats: {
    total:          Number,
    checked:        Number,
    requiredTotal:  Number,
    requiredChecked: Number,
    completionPct:  Number, // 0-100
    requiredPct:    Number, // 0-100
  },

  // AI analysis result
  ai: {
    riskScore:    Number,  // 0-100
    riskLevel:    String,  // 'low' | 'medium' | 'high' | 'critical'
    flags:        [String],
    recommendations: [String],
    analyzedAt:   Date,
  },

}, { timestamps: true });

checklistSchema.index({ submittedBy: 1, shiftDate: -1 });
checklistSchema.index({ checklistType: 1, shiftDate: -1 });
checklistSchema.index({ zone: 1 });

module.exports = mongoose.model('Checklist', checklistSchema);