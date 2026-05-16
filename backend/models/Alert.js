// models/Alert.js
const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  title:    { type: String, required: true },
  location: { type: String, required: true },
  zone:     { type: String },
  level: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true,
  },
  type: {
    type: String,
    enum: ['fire', 'smoke', 'temperature', 'equipment', 'gas', 'other'],
    default: 'other',
  },
  temperature: Number, // °C reading if sensor-triggered
  detail:   { type: String },
  status: {
    type: String,
    enum: ['active', 'acknowledged', 'escalated', 'resolved'],
    default: 'active',
  },
  // Who triggered / auto-detected
  source: {
    type: String,
    enum: ['sensor', 'manual', 'ai-detection'],
    default: 'manual',
  },
  triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt:  Date,
  escalatedAt: Date,

  // AI metadata
  aiGenerated:  { type: Boolean, default: false },
  aiConfidence: Number, // 0-1
  coordinates: {
    lat: Number,
    lng: Number,
  },
  escalatedToRole: {
    type: String,
    enum: ['safetyofficer', 'admin', 'firemen', 'supervisor', 'none'],
    default: 'safetyofficer',
  },
  escalationWorkflow: [String],
}, { timestamps: true });

alertSchema.index({ status: 1, level: 1 });
alertSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Alert', alertSchema);