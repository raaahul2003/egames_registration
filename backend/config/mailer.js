// backend/config/mailer.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendConfirmationEmail(reg) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('⚠️  Email not configured — skipping confirmation email');
    return;
  }

  const isTeam = reg.team_name && reg.team_name !== '-';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #0a0a0a; color: #e0e0e0; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background: #111827; border-radius: 12px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #00f5ff22, #bf00ff22); border-bottom: 2px solid #00f5ff44; padding: 32px; text-align: center; }
    .header h1 { color: #00f5ff; font-size: 24px; margin: 0 0 6px; letter-spacing: 2px; }
    .header p { color: #8892a4; margin: 0; font-size: 14px; }
    .body { padding: 32px; }
    .reg-id { background: #0d1117; border: 1px solid #00f5ff33; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 24px; }
    .reg-id .label { font-size: 11px; color: #8892a4; letter-spacing: 2px; text-transform: uppercase; }
    .reg-id .value { font-family: monospace; font-size: 22px; color: #00f5ff; font-weight: bold; margin-top: 4px; }
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .info-table td { padding: 10px 12px; border-bottom: 1px solid #1a2035; font-size: 14px; }
    .info-table td:first-child { color: #8892a4; width: 40%; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
    .info-table td:last-child { color: #e8eaf6; font-weight: 600; }
    .status-box { background: #ffc10715; border: 1px solid #ffc10744; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 24px; }
    .status-box.cash { background: #ff6b0015; border-color: #ff6b0044; }
    .status-label { font-size: 13px; font-weight: bold; color: #ffc107; }
    .status-label.cash { color: #ff6b00; }
    .status-note { font-size: 12px; color: #8892a4; margin-top: 6px; }
    .footer { background: #0d1117; border-top: 1px solid #1a2035; padding: 20px 32px; text-align: center; font-size: 12px; color: #8892a4; }
    .footer a { color: #00f5ff; text-decoration: none; }
    .event-badge { display: inline-block; background: #00f5ff15; border: 1px solid #00f5ff44; color: #00f5ff; padding: 4px 12px; border-radius: 50px; font-size: 13px; font-weight: bold; }
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>⚡ E-GAMES TOURNAMENT 2025</h1>
    <p>Registration Confirmation</p>
  </div>
  <div class="body">
    <p>Hi <strong>${reg.participant_name}</strong>, your registration has been received! 🎮</p>
    <div class="reg-id">
      <div class="label">Your Registration ID</div>
      <div class="value">${reg.reg_id}</div>
    </div>
    <table class="info-table">
      <tr><td>Event</td><td><span class="event-badge">${reg.event_name.split(' - ')[0]}</span></td></tr>
      <tr><td>Semester / Dept</td><td>${reg.semester_department}</td></tr>
      <tr><td>Contact</td><td>${reg.contact_number}</td></tr>
      <tr><td>Fee</td><td>₹${reg.event_fee}</td></tr>
      ${isTeam ? `<tr><td>Team Name</td><td>${reg.team_name}</td></tr>` : ''}
      <tr><td>Payment Method</td><td style="text-transform:capitalize">${reg.payment_method}</td></tr>
      ${reg.transaction_id ? `<tr><td>Transaction ID</td><td style="font-family:monospace">${reg.transaction_id}</td></tr>` : ''}
    </table>
    <div class="status-box ${reg.payment_method === 'cash' ? 'cash' : ''}">
      <div class="status-label ${reg.payment_method === 'cash' ? 'cash' : ''}">
        ${reg.payment_method === 'cash' ? '💵 Cash Payment — Pay at Event Desk' : '⏳ Payment Verification Pending'}
      </div>
      <div class="status-note">
        ${reg.payment_method === 'cash'
          ? 'Please bring ₹' + reg.event_fee + ' cash on the event day. Show this email at the registration desk.'
          : 'Our coordinator will verify your payment and confirm your slot shortly. Keep your Registration ID safe.'}
      </div>
    </div>
    <p style="font-size:13px;color:#8892a4;">For queries, contact us at <a href="mailto:egames@college.edu.in" style="color:#00f5ff;">egames@college.edu.in</a> or call <strong style="color:#e8eaf6;">+91 98765 43210</strong></p>
  </div>
  <div class="footer">
    © 2025 E-Games Tournament · Your College Name · Department of CSE<br>
    <a href="#">egames@college.edu.in</a>
  </div>
</div>
</body>
</html>
  `;

  try {
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to:      reg.email,
      subject: `🎮 Registration Confirmed — ${reg.reg_id} | E-Games Tournament 2025`,
      html
    });
    console.log(`📧 Confirmation email sent to ${reg.email}`);
  } catch (err) {
    console.error('❌ Failed to send email:', err.message);
  }
}

async function sendVerificationEmail(reg) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;

  const html = `
<!DOCTYPE html>
<html>
<head><style>
  body { font-family: Arial, sans-serif; background: #0a0a0a; color: #e0e0e0; }
  .container { max-width: 600px; margin: 0 auto; background: #111827; border-radius: 12px; overflow: hidden; }
  .header { background: linear-gradient(135deg, #00ff8822, #00f5ff22); border-bottom: 2px solid #00ff8844; padding: 32px; text-align: center; }
  .header h1 { color: #00ff88; font-size: 22px; margin: 0; letter-spacing: 2px; }
  .body { padding: 32px; }
  .success-box { background: #00ff8810; border: 1px solid #00ff8844; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
  .footer { background: #0d1117; border-top: 1px solid #1a2035; padding: 20px 32px; text-align: center; font-size: 12px; color: #8892a4; }
</style></head>
<body>
<div class="container">
  <div class="header"><h1>✅ PAYMENT VERIFIED!</h1></div>
  <div class="body">
    <p>Hi <strong>${reg.participant_name}</strong>,</p>
    <div class="success-box">
      <div style="font-size:36px;">🎉</div>
      <div style="color:#00ff88;font-size:18px;font-weight:bold;margin:8px 0;">Your slot is confirmed!</div>
      <div style="color:#8892a4;font-size:13px;">Payment for <strong style="color:#e8eaf6;">${reg.event_name.split(' - ')[0]}</strong> has been verified.</div>
    </div>
    <p style="font-size:13px;color:#8892a4;">Registration ID: <strong style="font-family:monospace;color:#00f5ff;">${reg.reg_id}</strong></p>
    <p style="font-size:13px;color:#8892a4;">Get ready to play! Further details about the event schedule will be shared soon.</p>
  </div>
  <div class="footer">© 2025 E-Games Tournament · Your College Name</div>
</div>
</body>
</html>
  `;

  try {
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to:      reg.email,
      subject: `✅ Payment Verified — You're In! | E-Games Tournament 2025`,
      html
    });
    console.log(`📧 Verification email sent to ${reg.email}`);
  } catch (err) {
    console.error('❌ Failed to send verification email:', err.message);
  }
}

module.exports = { sendConfirmationEmail, sendVerificationEmail };
