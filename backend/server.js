// ============================================================
//  NIYANTRAK – ENTERPRISE FIRE SAFETY API
//  server.js — Express + MongoDB entry point
// ============================================================
require('dotenv').config();
const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const fs         = require('fs');

const app = express();

// ── Upload directory ──────────────────────────────────────
const uploadDir = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ── Security middleware ───────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    const allowed = (process.env.CLIENT_ORIGIN || 'http://localhost:5500,http://localhost:3000,http://localhost:8080')
      .split(',').map(o => o.trim());
    // Allow requests with no origin (mobile, Postman, curl)
    // Allow any localhost origin for development
    if (!origin || allowed.includes(origin) || origin.startsWith('http://localhost:')) return cb(null, true);
    cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));

// ── Rate limiting ─────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
});
app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);

// ── Body parsing ──────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Logging ───────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ── Static uploads ────────────────────────────────────────
app.use('/uploads', express.static(uploadDir));

// ── Routes ────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/incidents', require('./routes/incidents'));
app.use('/api/alerts',    require('./routes/alerts'));
app.use('/api/users',     require('./routes/users'));
app.use('/api/ai',        require('./routes/ai'));
app.use('/api/compliance', require('./routes/compliance'));

// ── Health check ──────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({
  success: true,
  message: 'Niyantrak API is running',
  version: '1.0.0',
  timestamp: new Date().toISOString(),
  env: process.env.NODE_ENV,
}));

// ── 404 ───────────────────────────────────────────────────
app.use('*', (req, res) => res.status(404).json({
  success: false,
  message: `Route ${req.originalUrl} not found`,
}));

// ── Global error handler ──────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.stack || err.message);
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ── MongoDB + Start ───────────────────────────────────────
const PORT     = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/niyantrak';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log(`✅  MongoDB connected → ${MONGO_URI}`);
    app.listen(PORT, () => {
      console.log(`🔥  Niyantrak API running on http://localhost:${PORT}`);
      console.log(`📋  Health: http://localhost:${PORT}/api/health`);
    });
  })
  .catch(err => {
    console.error('❌  MongoDB connection failed:', err.message);
    process.exit(1);
  });

module.exports = app;