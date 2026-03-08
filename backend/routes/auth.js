// backend/routes/auth.js
const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { pool } = require('../config/db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

// ── POST /api/auth/login ────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required' });

    const [rows] = await pool.execute(
      'SELECT * FROM coordinators WHERE email = ?', [email.toLowerCase().trim()]
    );
    if (rows.length === 0)
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const coordinator = rows[0];
    const valid = await bcrypt.compare(password, coordinator.password);
    if (!valid)
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: coordinator.id, email: coordinator.email, name: coordinator.name, role: coordinator.role },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      success: true,
      token,
      coordinator: { id: coordinator.id, name: coordinator.name, email: coordinator.email, role: coordinator.role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /api/auth/create-coordinator (admin only) ─────────
router.post('/create-coordinator', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'Name, email and password required' });

    const hashed = await bcrypt.hash(password, 12);
    await pool.execute(
      'INSERT INTO coordinators (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email.toLowerCase().trim(), hashed, role || 'coordinator']
    );
    res.json({ success: true, message: 'Coordinator created successfully' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(400).json({ success: false, message: 'Email already exists' });
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /api/auth/me ────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  res.json({ success: true, coordinator: req.coordinator });
});

// ── GET /api/auth/coordinators (admin only) ─────────────────
router.get('/coordinators', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, created_at FROM coordinators ORDER BY created_at DESC'
    );
    res.json({ success: true, coordinators: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── DELETE /api/auth/coordinators/:id (admin only) ──────────
router.delete('/coordinators/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.coordinator.id)
      return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
    await pool.execute('DELETE FROM coordinators WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Coordinator removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
