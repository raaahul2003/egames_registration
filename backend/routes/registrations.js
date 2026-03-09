// backend/routes/registrations.js
const express  = require('express');
const { pool } = require('../config/db');
const upload   = require('../middleware/upload');
const { authMiddleware } = require('../middleware/auth');
const { sendConfirmationEmail, sendVerificationEmail } = require('../config/mailer');
const XLSX     = require('xlsx');
const path     = require('path');

const router = express.Router();

const FEE_MAP = {
  'Mini Militia - Team of 4 - Rs80':  80,
  'Mini Militia - Team of 4 - Rs.80': 80,
  'eFootball - Individual - Rs50':    50,
  'eFootball - Individual - Rs.50':   50,
  'PUBG Mobile - Squad - Rs100':      100,
  'PUBG Mobile - Squad - Rs.100':     100
};

function genRegId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'EG-';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// ── POST /api/registrations  (public — student submits) ─────
router.post('/', upload.single('screenshot'), async (req, res) => {
  try {
    const {
      participant_name, semester_department, event_name,
      team_name, team_members, contact_number, email,
      payment_method, transaction_id
    } = req.body;

    // Basic required field validation
    if (!participant_name || !semester_department || !event_name || !contact_number || !email || !payment_method)
      return res.status(400).json({ success: false, message: 'Missing required fields' });

    // Phone validation
    const phone = contact_number.replace(/\D/g, '');
    if (phone.length < 10)
      return res.status(400).json({ success: false, message: 'Invalid contact number' });

    // Email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ success: false, message: 'Invalid email address' });

    // UPI must have transaction ID
    if (payment_method === 'upi' && !transaction_id)
      return res.status(400).json({ success: false, message: 'Transaction ID required for UPI payment' });

    const event_fee = FEE_MAP[event_name] || 0;
    const screenshot_path = req.file ? req.file.filename : null;

    // Generate unique reg_id
    let reg_id, duplicate = true;
    while (duplicate) {
      reg_id = genRegId();
      const [existing] = await pool.execute('SELECT id FROM registrations WHERE reg_id = ?', [reg_id]);
      duplicate = existing.length > 0;
    }

    const [result] = await pool.execute(`
      INSERT INTO registrations
        (reg_id, participant_name, semester_department, event_name, event_fee,
         team_name, team_members, contact_number, email,
         payment_method, transaction_id, screenshot_path, payment_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      reg_id, participant_name.trim(), semester_department, event_name, event_fee,
      team_name || null, team_members || null, contact_number.trim(), email.trim().toLowerCase(),
      payment_method, transaction_id || null, screenshot_path,
      payment_method === 'cash' ? 'pending' : 'pending'
    ]);

    // Fetch the full record to send email
    const [rows] = await pool.execute('SELECT * FROM registrations WHERE id = ?', [result.insertId]);
    const reg = rows[0];

    // Send confirmation email (non-blocking)
    sendConfirmationEmail(reg).catch(() => {});

    res.status(201).json({
      success: true,
      message: 'Registration successful!',
      reg_id,
      registration: {
        reg_id,
        participant_name: reg.participant_name,
        event_name:       reg.event_name,
        event_fee:        reg.event_fee,
        payment_method:   reg.payment_method,
        payment_status:   reg.payment_status,
        registration_date: reg.registration_date
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ── GET /api/registrations  (coordinator — list all) ────────
router.get('/', authMiddleware, async (req, res) => {
  try {
    const event  = req.query.event  || '';
    const status = req.query.status || '';
    const search = req.query.search || '';
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(1000, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    // Build WHERE clause safely
    const conditions = [];
    const params     = [];

    if (event)  { conditions.push('r.event_name LIKE ?');    params.push('%' + event + '%'); }
    if (status) { conditions.push('r.payment_status = ?');   params.push(status); }
    if (search) {
      conditions.push('(r.participant_name LIKE ? OR r.contact_number LIKE ? OR r.reg_id LIKE ? OR r.email LIKE ?)');
      const s = '%' + search + '%';
      params.push(s, s, s, s);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    // Use string interpolation for LIMIT/OFFSET (not placeholders)
    const sql = `SELECT r.id, r.reg_id, r.participant_name, r.semester_department,
                        r.event_name, r.event_fee, r.team_name, r.team_members,
                        r.contact_number, r.email, r.payment_method, r.transaction_id,
                        r.screenshot_path, r.payment_status, r.verified_by,
                        r.verified_at, r.notes, r.registration_date,
                        c.name AS verified_by_name
                 FROM registrations r
                 LEFT JOIN coordinators c ON r.verified_by = c.id
                 ${where}
                 ORDER BY r.registration_date DESC
                 LIMIT ${limit} OFFSET ${offset}`;

    const countSql = `SELECT COUNT(*) AS total FROM registrations r ${where}`;

    const [rows]          = await pool.query(sql, params);
    const [[{ total }]]   = await pool.query(countSql, params);

    res.json({ success: true, registrations: rows, total, page, limit });
  } catch (err) {
    console.error('GET /registrations error:', err.message, err.stack);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// ── GET /api/registrations/stats  (coordinator — dashboard) ─
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const [[totals]] = await pool.execute(`
      SELECT
        COUNT(*) AS total,
        SUM(event_fee) AS total_revenue,
        SUM(payment_status = 'verified') AS verified,
        SUM(payment_status = 'pending')  AS pending,
        SUM(payment_status = 'rejected') AS rejected,
        SUM(event_name LIKE '%Mini Militia%') AS militia,
        SUM(event_name LIKE '%eFootball%')    AS efootball,
        SUM(event_name LIKE '%PUBG%')         AS pubg
      FROM registrations
    `);
    res.json({ success: true, stats: totals });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});


// ── GET /api/registrations/export/excel  (coordinator) ──────
router.get('/export/excel', authMiddleware, async (req, res) => {
  try {
    const { event, status } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (event)  { where += ' AND event_name LIKE ?'; params.push(`%${event}%`); }
    if (status) { where += ' AND payment_status = ?'; params.push(status); }

    const [rows] = await pool.execute(
      `SELECT r.reg_id, r.participant_name, r.semester_department, r.event_name,
              r.event_fee, r.team_name, r.team_members, r.contact_number, r.email,
              r.payment_method, r.transaction_id, r.payment_status,
              c.name AS verified_by, r.verified_at, r.notes, r.registration_date
       FROM registrations r
       LEFT JOIN coordinators c ON r.verified_by = c.id
       ${where} ORDER BY r.registration_date DESC`,
      params
    );

    const data = rows.map((r, i) => ({
      '#':                  i + 1,
      'Reg ID':             r.reg_id,
      'Participant Name':   r.participant_name,
      'Semester/Dept':      r.semester_department,
      'Event':              r.event_name,
      'Fee (₹)':            r.event_fee,
      'Team Name':          r.team_name || '-',
      'Team Members':       r.team_members || '-',
      'Contact':            r.contact_number,
      'Email':              r.email,
      'Payment Method':     r.payment_method,
      'Transaction ID':     r.transaction_id || '-',
      'Payment Status':     r.payment_status,
      'Verified By':        r.verified_by || '-',
      'Verified At':        r.verified_at ? new Date(r.verified_at).toLocaleString() : '-',
      'Notes':              r.notes || '-',
      'Registered On':      new Date(r.registration_date).toLocaleString()
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = Object.keys(data[0] || {}).map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registrations');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename="egames_registrations_${Date.now()}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
});

// ── GET /api/registrations/:id  (coordinator — single) ──────
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT r.*, c.name AS verified_by_name
       FROM registrations r
       LEFT JOIN coordinators c ON r.verified_by = c.id
       WHERE r.id = ? OR r.reg_id = ?`,
      [req.params.id, req.params.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: 'Registration not found' });
    res.json({ success: true, registration: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// ── PATCH /api/registrations/:id/verify  (coordinator) ──────
router.patch('/:id/verify', authMiddleware, async (req, res) => {
  try {
    const { status, notes } = req.body; // status: 'verified' | 'rejected'
    if (!['verified', 'rejected'].includes(status))
      return res.status(400).json({ success: false, message: 'Status must be verified or rejected' });

    const [result] = await pool.execute(`
      UPDATE registrations
      SET payment_status = ?, verified_by = ?, verified_at = NOW(), notes = ?
      WHERE id = ? OR reg_id = ?
    `, [status, req.coordinator.id, notes || null, req.params.id, req.params.id]);

    if (result.affectedRows === 0)
      return res.status(404).json({ success: false, message: 'Registration not found' });

    // Send email if verified
    if (status === 'verified') {
      const [rows] = await pool.execute(
        'SELECT * FROM registrations WHERE id = ? OR reg_id = ?',
        [req.params.id, req.params.id]
      );
      if (rows.length > 0) sendVerificationEmail(rows[0]).catch(() => {});
    }

    res.json({ success: true, message: `Payment ${status} successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// ── DELETE /api/registrations/:id  (admin only) ─────────────
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.coordinator.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Admin access required' });

    await pool.execute('DELETE FROM registrations WHERE id = ? OR reg_id = ?', [req.params.id, req.params.id]);
    res.json({ success: true, message: 'Registration deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});
module.exports = router;