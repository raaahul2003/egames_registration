// backend/config/db.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'egames_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ── Create tables if they don't exist ──────────────────────
async function initDB() {
  const conn = await pool.getConnection();
  try {
    // Coordinators / Admin accounts
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS coordinators (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        name         VARCHAR(100)        NOT NULL,
        email        VARCHAR(150) UNIQUE NOT NULL,
        password     VARCHAR(255)        NOT NULL,
        role         ENUM('admin','coordinator') DEFAULT 'coordinator',
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Participant registrations
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS registrations (
        id                  INT AUTO_INCREMENT PRIMARY KEY,
        reg_id              VARCHAR(20) UNIQUE NOT NULL,
        participant_name    VARCHAR(150)       NOT NULL,
        semester_department VARCHAR(50)        NOT NULL,
        event_name          VARCHAR(100)       NOT NULL,
        event_fee           INT                NOT NULL DEFAULT 0,
        team_name           VARCHAR(100),
        team_members        TEXT,
        contact_number      VARCHAR(20)        NOT NULL,
        email               VARCHAR(150)       NOT NULL,
        payment_method      ENUM('upi','screenshot','cash') NOT NULL,
        transaction_id      VARCHAR(100),
        screenshot_path     VARCHAR(255),
        payment_status      ENUM('pending','verified','rejected') DEFAULT 'pending',
        verified_by         INT,
        verified_at         TIMESTAMP NULL,
        notes               TEXT,
        registration_date   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (verified_by) REFERENCES coordinators(id) ON DELETE SET NULL
      )
    `);

    console.log('✅ Database tables ready');
  } finally {
    conn.release();
  }
}

module.exports = { pool, initDB };
