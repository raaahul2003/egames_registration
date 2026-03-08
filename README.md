# ⚡ E-Games Tournament 2025 — Full Stack App

> Node.js + Express + MySQL backend with a gaming-themed frontend.
> Students register → Coordinators verify payments → Excel export.

---

## 📁 Project Structure

```
egames/
├── backend/
│   ├── config/
│   │   ├── db.js          # MySQL pool + auto table creation
│   │   └── mailer.js      # Nodemailer email service
│   ├── middleware/
│   │   ├── auth.js        # JWT auth middleware
│   │   └── upload.js      # Multer file upload
│   ├── routes/
│   │   ├── auth.js        # Login, coordinator management
│   │   └── registrations.js # CRUD + verify + export
│   ├── uploads/           # Payment screenshots (auto-created)
│   ├── server.js          # Express app entry point
│   ├── package.json
│   └── .env.example       # ← Copy this to .env and fill in values
│
└── frontend/
    └── public/
        ├── index.html       # Student registration page
        └── coordinator.html # Coordinator dashboard
```

---

## 🚀 DEPLOYMENT GUIDE

### OPTION A — Deploy on Render (Free, Recommended)

#### Step 1: Set up MySQL Database

Use **Railway** for free MySQL:
1. Go to https://railway.app → New Project → Add MySQL
2. Click the MySQL service → **Connect** tab
3. Copy: Host, Port, Database name, Username, Password

#### Step 2: Deploy Backend on Render

1. Push your code to GitHub (just the `backend/` folder, or the full repo)
2. Go to https://render.com → New → **Web Service**
3. Connect your GitHub repo
4. Settings:
   - **Root directory**: `backend`
   - **Build command**: `npm install`
   - **Start command**: `npm start`
   - **Environment**: Node

5. Add Environment Variables (from your Railway MySQL):
```
DB_HOST         = <railway mysql host>
DB_PORT         = <railway mysql port>
DB_USER         = <username>
DB_PASSWORD     = <password>
DB_NAME         = egames_db
JWT_SECRET      = your_super_long_random_secret_here_at_least_32_chars
NODE_ENV        = production
EMAIL_USER      = your_gmail@gmail.com
EMAIL_PASS      = your_gmail_app_password
FRONTEND_URL    = https://your-frontend.onrender.com
```

6. Deploy → Render gives you: `https://egames-backend.onrender.com`

#### Step 3: Deploy Frontend on Render (Static Site)

1. Render → New → **Static Site**
2. Connect repo → Root directory: `frontend/public`
3. Build command: (leave empty)
4. Publish directory: `.`

OR just upload `index.html` and `coordinator.html` to **Netlify** by drag and drop.

5. **Update API_BASE in both HTML files**:

In `index.html` and `coordinator.html`, find:
```javascript
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:5000/api'
  : '/api';
```
Change the `/api` part to your Render backend URL:
```javascript
  : 'https://egames-backend.onrender.com/api';
```

---

### OPTION B — Run Locally (Development)

#### Prerequisites
- Node.js v18+
- MySQL 8.0+ running locally

#### Step 1: Clone & Install
```bash
cd backend
cp .env.example .env
# Edit .env with your local MySQL credentials
npm install
```

#### Step 2: Create MySQL Database
```sql
CREATE DATABASE egames_db;
```
(Tables are auto-created when server starts)

#### Step 3: Start Backend
```bash
npm start
# Or for development with auto-reload:
npm run dev
```

Server starts at: http://localhost:5000

#### Step 4: Open Frontend
Simply open `frontend/public/index.html` in a browser.
Or use VS Code Live Server extension.

---

## 🔐 Default Admin Credentials

On first startup, a default admin is created:
```
Email:    admin@egames.com
Password: admin@egames123
```
⚠️ **Change this password immediately** after first login!

---

## 📧 Setting Up Email (Gmail)

1. Go to: https://myaccount.google.com/apppasswords
2. Generate an App Password for "Mail"
3. Use that 16-character password as `EMAIL_PASS` in `.env`

---

## 🌐 API Endpoints

### Public (No Auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/registrations` | Submit registration (multipart/form-data) |
| GET | `/api/health` | Health check |

### Coordinator (JWT Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/registrations` | List all (filter: event, status, search) |
| GET | `/api/registrations/stats` | Dashboard statistics |
| GET | `/api/registrations/:id` | Single registration |
| PATCH | `/api/registrations/:id/verify` | Verify/reject payment |
| GET | `/api/registrations/export/excel` | Download Excel file |

### Admin Only
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/create-coordinator` | Add coordinator |
| GET | `/api/auth/coordinators` | List coordinators |
| DELETE | `/api/auth/coordinators/:id` | Remove coordinator |
| DELETE | `/api/registrations/:id` | Delete registration |

---

## 📱 Registration Form Data (multipart/form-data)

| Field | Type | Required |
|-------|------|----------|
| participant_name | text | ✅ |
| semester_department | text | ✅ |
| event_name | text | ✅ |
| contact_number | text | ✅ |
| email | text | ✅ |
| payment_method | upi / screenshot / cash | ✅ |
| transaction_id | text | If UPI |
| team_name | text | If team event |
| team_members | text | If team event |
| screenshot | file (image) | If screenshot |

---

## 🔧 Customization

### Change UPI ID
In `index.html`, search for `collegeevents@upi` and replace with your UPI ID.

### Change College Name
In both HTML files, search for `Your College Name Here` and update.

### Change Event Fees
In `registrations.js` (backend), update the `FEE_MAP` object.
Also update event options in `index.html`.

### Change Admin Password
After login, you can add a new admin via the Coordinators page,
then delete the default one.

---

## 🛡️ Security Features

- JWT authentication (12hr expiry)
- Bcrypt password hashing (12 salt rounds)
- Rate limiting (10 registrations / 15min per IP)
- File type validation (images only)
- File size limit (5MB)
- SQL injection protection (parameterized queries)
- CORS whitelist

---

## 📞 Support

For issues, contact your college IT department or the event coordinator.
