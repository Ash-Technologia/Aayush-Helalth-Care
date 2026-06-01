# Aayush Health Care Consultancy

A modern, full-stack ayurvedic consultation booking and clinic management platform built for **Dr. Amrut Singhavi**.

## 🌿 Project Architecture

The application is structured as a monorepo containing a React frontend and an Express backend:

```
Aayush Health Care Consultancy/
├── client/   ← React 18 + Vite frontend (Single Page Application)
└── server/   ← Express.js + Mongoose backend (REST API & Jobs)
```

- **Frontend**: React 18, Vite, Redux Toolkit, React Query, Framer Motion, Vanilla CSS.
- **Backend**: Node.js, Express.js, MongoDB + Mongoose, Passport (Google OAuth), Sharp (Image compression), Nodemailer.
- **Database**: MongoDB Atlas for cloud persistence.
- **Communications**: Fast2SMS (OTP & Alerts), Gmail SMTP (Transactional emails).

---

## 🛠️ Local Development Setup

### Prerequisite
Install [Node.js](https://nodejs.org/) (v18 or higher) and [MongoDB](https://www.mongodb.com/try/download/community) (for local testing).

### 1. Backend Setup
1. Open a terminal and navigate to the server folder:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file from the example:
   ```bash
   copy .env.example .env
   ```
4. Set up your environment variables (see [Environment Variables](#environment-variables) below).
5. Seed the database with the doctor profile, CMS page content, and initial slots templates:
   ```bash
   npm run seed
   ```
6. Start the development server (runs on `http://localhost:5000`):
   ```bash
   npm run dev
   ```

### 2. Frontend Setup
1. Open a new terminal and navigate to the client folder:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server (runs on `http://localhost:5173`):
   ```bash
   npm run dev
   ```
   *Note: In development mode, Vite is pre-configured to proxy `/api` and `/uploads` requests to the local backend at `http://localhost:5000` automatically.*

---

## ⚙️ Environment Variables

### Backend Configuration (`server/.env`)

| Variable | Description | Example / Default |
|---|---|---|
| `PORT` | Local server port | `5000` |
| `NODE_ENV` | Environment state | `development` / `production` |
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/aayush` |
| `JWT_ACCESS_SECRET` | Secret key for access token encryption | *(Use a long random string)* |
| `JWT_REFRESH_SECRET` | Secret key for refresh token encryption | *(Use a long random string)* |
| `FAST2SMS_API_KEY` | Fast2SMS provider credentials | *(Your API Key)* |
| `EMAIL_HOST` | Gmail SMTP Server | `smtp.gmail.com` |
| `EMAIL_PORT` | SMTP port | `587` |
| `EMAIL_USER` | NodeMailer email sender user | `dr.singhavi.clinic@gmail.com` |
| `EMAIL_PASS` | Gmail App Password | `xxxx xxxx xxxx xxxx` |
| `FRONTEND_URL` | Public frontend origin used for auth callbacks and email links | `http://localhost:5173` (Dev) |
| `PUBLIC_FRONTEND_URL` | Optional explicit public frontend origin for production email/auth redirects | `https://your-vercel-app.vercel.app` |
| `LOCAL_FRONTEND_URL` | Optional comma-separated extra allowed frontend origins | `http://localhost:5173` |
| `PUBLIC_BACKEND_URL` | Optional public backend base URL used to derive the Google OAuth callback | `https://your-render-app.onrender.com` |
| `GOOGLE_CLIENT_ID` | OAuth Google Client ID | *(From Google Console)* |
| `GOOGLE_CLIENT_SECRET`| OAuth Google Secret Key | *(From Google Console)* |

Google OAuth callback routes supported by the backend:

- `/api/v1/auth/google/callback`
- `/api/auth/google/callback` for compatibility with existing console setups

### Frontend Configuration (`client/.env`)

For production cross-origin deploys, create a `.env` file inside `client/`:
```env
VITE_API_URL=https://aayush-backend.railway.app/api/v1
```

---

## 🚀 Deployment Guide

### Backend: Railway Deployment
1. Log in to [Railway.app](https://railway.app) and create a new project.
2. Select **Deploy from GitHub repo** and point it to the `server/` directory of your repository.
3. In **Settings**, change the **Root Directory** to `server`.
4. Add all variables listed in the backend configuration to Railway's **Variables** settings, especially:
   - `MONGO_URI` pointing to MongoDB Atlas
   - `FRONTEND_URL` set to your Vercel production domain
   - `PUBLIC_FRONTEND_URL` set to your Vercel production domain
   - `PUBLIC_BACKEND_URL` set to your Render/Railway public backend URL
   - `GOOGLE_CALLBACK_URL` set to your Railway callback URL
   - `NODE_ENV=production`
5. Railway will automatically detect the `Procfile` (`web: node src/index.js`) and spin up the backend instance.
6. After the Railway URL is created, copy it and use it in the frontend `VITE_API_URL` value.

### Frontend: Vercel Deployment
1. Log in to [Vercel](https://vercel.com) and create a **New Project**.
2. Link your repository.
3. In the project config:
   - **Root Directory**: `client`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Under **Environment Variables**, add:
   - `VITE_API_URL` pointing to your Railway production API endpoint (for example `https://your-backend.railway.app/api/v1`).
5. Click **Deploy**. Vercel will handle SPA routes automatically due to `client/vercel.json` rewrite rules.
6. After Vercel finishes, copy the production domain and paste it into Railway as `FRONTEND_URL`, then redeploy Railway once so CORS is updated.

### Recommended Production Values

Use these as a final checklist once both services are live:

- Railway backend: `NODE_ENV=production`
- Railway backend: `MONGO_URI=<MongoDB Atlas connection string>`
- Railway backend: `FRONTEND_URL=https://<your-vercel-app>.vercel.app`
- Railway backend: `PUBLIC_FRONTEND_URL=https://<your-vercel-app>.vercel.app`
- Railway backend: `PUBLIC_BACKEND_URL=https://<your-render-app>.onrender.com`
- Railway backend: `GOOGLE_CALLBACK_URL=https://<your-railway-app>.railway.app/api/v1/auth/google/callback`
- Vercel frontend: `VITE_API_URL=https://<your-railway-app>.railway.app/api/v1`

### Deployment Notes

- Vercel should deploy the `client/` folder only.
- Railway should deploy the `server/` folder only.
- Uploaded files stored in `server/uploads/` are local filesystem data; if you need persistence across redeploys, move them to external object storage.

---

## 🔒 Administrative Tasks

To log into the Admin panel:
1. Navigate to `/admin/login` (hidden from navigation menus for safety).
2. Default seeded admin credentials (if configured via `npm run seed`):
   - **Email**: `admin@clinic.in`
   - **Password**: `Admin@123`
3. Upon first login, change the doctor credentials, upload your UPI QR code, and update Timings in **Profile Settings** to initialize bookings slots.
