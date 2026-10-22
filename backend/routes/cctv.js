// routes/cctv.js — CCTV Fire Detection Add-On Route for NiyanTrak
const express = require('express');
const Alert   = require('../models/Alert');
const router  = express.Router();

const CCTV_SERVICE_URL = process.env.CCTV_SERVICE_URL || 'http://localhost:8003';

// ── GET /api/cctv/health ──────────────────────────────────
router.get('/health', async (req, res) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch(`${CCTV_SERVICE_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!resp.ok) return res.status(502).json({ success: false, message: 'CCTV engine error' });
    const data = await resp.json();
    return res.json({ success: true, data });
  } catch (err) {
    return res.json({
      success: false,
      message: 'CCTV service is offline. Start the CCTV engine on port 8003.',
      online: false
    });
  }
});

// ── GET /api/cctv/cameras ─────────────────────────────────
router.get('/cameras', async (req, res) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const resp = await fetch(`${CCTV_SERVICE_URL}/cameras`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!resp.ok) return res.status(502).json({ success: false, message: 'Failed to fetch camera feeds.' });
    const data = await resp.json();
    return res.json(data);
  } catch (err) {
    return res.json({
      success: true,
      serviceOnline: false,
      cameras: [
        { id: 'cam-01', name: 'Camera 01 - Warehouse High Bay', zone: 'Warehouse A - Zone 3', fps: 0, isFire: false },
        { id: 'cam-02', name: 'Camera 02 - Chemical Storage', zone: 'Chemical Storage - Zone 1', fps: 0, isFire: false },
        { id: 'cam-03', name: 'Camera 03 - Loading Bay South', zone: 'Loading Dock', fps: 0, isFire: false },
        { id: 'cam-04', name: 'Camera 04 - Production Line B', zone: 'Factory Floor - Zone 2', fps: 0, isFire: false },
      ],
      notice: 'CCTV Engine on port 8003 is currently offline.'
    });
  }
});

// ── POST /api/cctv/cameras ────────────────────────────────
router.post('/cameras', async (req, res) => {
  try {
    const resp = await fetch(`${CCTV_SERVICE_URL}/cameras`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await resp.json();
    return res.status(resp.status).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: 'CCTV engine unreachable.' });
  }
});

// ── POST /api/cctv/simulate/:id ───────────────────────────
router.post('/simulate/:id', async (req, res) => {
  try {
    const resp = await fetch(`${CCTV_SERVICE_URL}/simulate-fire/${req.params.id}`, {
      method: 'POST'
    });
    const data = await resp.json();
    return res.status(resp.status).json(data);
  } catch (err) {
    return res.status(503).json({ success: false, message: 'CCTV engine unreachable.' });
  }
});

// ── POST /api/cctv/alert — Direct CCTV Machine Alert Webhook ──
router.post('/alert', async (req, res) => {
  try {
    const { title, location, zone, level, type, detail, aiConfidence, temperature } = req.body;
    const alert = await Alert.create({
      title: title || `CCTV Fire Alert — ${zone}`,
      location: location || zone || 'Unknown Zone',
      zone: zone || 'Warehouse A - Zone 3',
      level: level || 'critical',
      type: type || 'fire',
      source: 'ai-detection',
      status: 'active',
      aiGenerated: true,
      aiConfidence: aiConfidence || 0.95,
      detail: detail || 'Flame signature confirmed by CCTV Vision Engine.',
      temperature: temperature || 78,
    });
    return res.status(201).json({ success: true, data: alert });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
