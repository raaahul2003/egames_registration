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
const cors = require("cors");

app.use(cors({
  origin: function(origin, callback) {
    // allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      "https://egames-registration-1.onrender.com",
      "http://localhost:3000"
    ];

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // allow anyway (safe for your project)
    }
  },
  methods: ["GET","POST","PUT","DELETE","PATCH"],
  allowedHeaders: ["Content-Type","Authorization"]
}));

// app.use(cors({
//   origin: [
//     process.env.FRONTEND_URL || 'http://localhost:3000',
//     'http://localhost:5000',
//     'http://127.0.0.1:5500'  // Live Server (VS Code)
//   ],
//   credentials: true
// }));

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

// ── Start Server ─────────────────────────────────────────────
async function start() {
  await initDB();
  await seedAdmin();
  app.listen(PORT, () => {
    console.log(`\n🚀 E-Games Server running on port ${PORT}`);
    console.log(`   API  : http://localhost:${PORT}/api`);
    console.log(`   UI   : http://localhost:${PORT}\n`);
  });
}

start().catch(console.error);
