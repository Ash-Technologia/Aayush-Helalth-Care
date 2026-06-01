'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('./middleware/mongoSanitize');
const xss = require('./middleware/xssClean');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
const path = require('path');

const initPassport = require('./config/passport');

// ─── Initialize Express ──────────────────────────────────────────────────────
const app = express();

// ─── Security Headers ────────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow image serving
  })
);

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
];
app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (mobile apps, curl, Postman)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: Origin '${origin}' not allowed.`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Body Parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ─── Data Sanitization ───────────────────────────────────────────────────────
app.use(mongoSanitize()); // prevents NoSQL injection ($, . in keys)
app.use(xss());           // sanitize HTML/script from body
app.use(hpp());           // prevent HTTP parameter pollution

// ─── Global Rate Limiter ─────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api/', globalLimiter);

// ─── Passport ────────────────────────────────────────────────────────────────
initPassport();
app.use(passport.initialize());

// ─── Static File Serving (uploaded files) ────────────────────────────────────
// Serves /uploads/** — doctor photos, QR codes, payment screenshots
app.use(
  '/uploads',
  express.static(path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads'))
);

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Aayush Health Care API is running.',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  });
});

// ─── API Routes ──────────────────────────────────────────────────────────────
// Routes are mounted here as they are built in subsequent phases.
// Each require() is inside a try/catch to give clear errors during development.

const mountRoute = (path, routeFile) => {
  try {
    app.use(path, require(routeFile));
  } catch (err) {
    console.warn(`[Routes] Could not load route '${path}': ${err.message}`);
  }
};

mountRoute('/api/v1/auth',               './routes/auth');
mountRoute('/api/v1/slots',              './routes/slots');
mountRoute('/api/v1/appointments',       './routes/appointments');
mountRoute('/api/v1/payments',           './routes/payments');
mountRoute('/api/v1/profile',            './routes/profile');
mountRoute('/api/v1/reviews',            './routes/reviews');
mountRoute('/api/v1/admin',              './routes/admin/index');

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const isDev = process.env.NODE_ENV === 'development';

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: messages.join('. ') });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token expired.' });
  }

  // CORS error
  if (err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({ success: false, message: err.message });
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'File too large.' });
  }

  const statusCode = err.statusCode || err.status || 500;
  console.error(`[Error] ${err.stack || err.message}`);

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error.',
    ...(isDev && { stack: err.stack }),
  });
});

module.exports = app;
