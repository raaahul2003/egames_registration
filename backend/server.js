// backend/server.js
require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const path         = require('path');
const rateLimit    = require('express-rate-limit');
const bcrypt       = require('bcryptjs');
const { pool, initDB } = require('./config/db');

const authRoutes  = require('./routes/auth');
const regRoutes   = require('./routes/registrations');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── CORS ────────────────────────────────────────────────────
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    const allowed = [
      'https://egames-registration-1.onrender.com',
      'https://egames-registration.onrender.com',
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:5000',
      'http://127.0.0.1:5500'
    ].filter(Boolean);
    if (allowed.some(u => origin.startsWith(u))) return callback(null, true);
    return callback(null, true); // Allow all during development — tighten later
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

// ── Body Parsers ─────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Static uploads folder ───────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, process.env.UPLOAD_DIR || 'uploads')));

// ── Rate Limiting ────────────────────────────────────────────
const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10, // max 10 registrations per IP per window
  message: { success: false, message: 'Too many requests. Please try again later.' }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts. Please try again later.' }
});

// ── Routes ───────────────────────────────────────────────────
app.use('/api/auth',          loginLimiter,        authRoutes);
app.use('/api/registrations', registrationLimiter, regRoutes);

// ── Health Check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'E-Games API is running 🎮', timestamp: new Date() });
});

// ── Serve Frontend (if in same repo) ────────────────────────
app.use(express.static(path.join(__dirname, '../frontend/public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

// ── 404 Handler ──────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// ── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: err.message || 'Internal server error' });
});

// ── Seed default admin account if no coordinators exist ─────
async function seedAdmin() {
  try {
    const [[{ count }]] = await pool.execute('SELECT COUNT(*) AS count FROM coordinators');
    if (count === 0) {
      const hashed = await bcrypt.hash('admin@egames123', 12);
      await pool.execute(
        "INSERT INTO coordinators (name, email, password, role) VALUES (?, ?, ?, 'admin')",
        ['Admin', 'admin@egames.com', hashed]
      );
      console.log('');
      console.log('🔐 Default admin account created:');
      console.log('   Email   : admin@egames.com');
      console.log('   Password: admin@egames123');
      console.log('   ⚠️  Change this password immediately after first login!');
      console.log('');
    }
  } catch (err) {
    console.error('Seeding error:', err.message);
  }
}

// ── Start Server (with DB retry) ─────────────────────────────
async function start(retries = 5) {
  for (let i = 1; i <= retries; i++) {
    try {
      console.log(`🔌 Connecting to database (attempt ${i}/${retries})...`);
      await initDB();
      await seedAdmin();
      break; // success
    } catch (err) {
      console.error(`❌ DB connection failed (attempt ${i}): ${err.message}`);
      if (i === retries) {
        console.error('💀 Could not connect to database after', retries, 'attempts. Exiting.');
        process.exit(1);
      }
      const wait = i * 3000; // 3s, 6s, 9s, 12s backoff
      console.log(`⏳ Retrying in ${wait / 1000}s...`);
      await new Promise(r => setTimeout(r, wait));
    }
  }

  app.listen(PORT, () => {
    console.log(`\n🚀 E-Games Server running on port ${PORT}`);
    console.log(`   API  : http://localhost:${PORT}/api`);
    console.log(`   UI   : http://localhost:${PORT}\n`);
  });

  // ── Keep pool alive — ping every 4 minutes ──────────────
  setInterval(async () => {
    try {
      const conn = await pool.getConnection();
      await conn.ping();
      conn.release();
    } catch (e) {
      console.warn('⚠️  DB keepalive ping failed:', e.message);
    }
  }, 4 * 60 * 1000);
}

start().catch(console.error);