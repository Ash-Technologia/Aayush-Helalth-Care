'use strict';

const rateLimit = require('express-rate-limit');

/**
 * Specific rate limiters for sensitive auth endpoints.
 * These are tighter than the global limiter defined in app.js.
 */

// ─── Login: 10 attempts per 15 min per IP ─────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please wait 15 minutes and try again.',
  },
});

// ─── Registration: 5 per hour per IP ─────────────────────────────────────────
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many registration attempts. Please try again later.',
  },
});

// ─── OTP Send: 3 per 10 min per IP ───────────────────────────────────────────
const otpSendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many OTP requests. Please wait 10 minutes before requesting again.',
  },
});

// ─── OTP Verify: 10 per 10 min per IP ────────────────────────────────────────
const otpVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many OTP verification attempts. Please request a new OTP.',
  },
});

// ─── Token Refresh: 30 per 15 min per IP ─────────────────────────────────────
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many token refresh requests.',
  },
});

module.exports = {
  loginLimiter,
  registerLimiter,
  otpSendLimiter,
  otpVerifyLimiter,
  refreshLimiter,
};
