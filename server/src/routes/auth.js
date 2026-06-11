'use strict';

const express = require('express');
const { body, param } = require('express-validator');

const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  loginLimiter,
  registerLimiter,
  otpSendLimiter,
  otpVerifyLimiter,
  refreshLimiter,
} = require('../middleware/rateLimiters');

// ─── Validation Rules ─────────────────────────────────────────────────────────

const registerRules = [
  body('fullName')
    .trim()
    .notEmpty().withMessage('Full name is required.')
    .isLength({ max: 100 }).withMessage('Full name cannot exceed 100 characters.'),

  body('email')
    .optional({ checkFalsy: true })
    .trim()
    .isEmail().withMessage('Please provide a valid email address.')
    .normalizeEmail(),

  body('phone')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[6-9]\d{9}$/).withMessage('Phone must be a valid 10-digit Indian mobile number.'),

  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
    .isLength({ max: 128 }).withMessage('Password cannot exceed 128 characters.')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
    .matches(/[0-9]/).withMessage('Password must contain at least one number.'),

  body().custom((_, { req }) => {
    if (!req.body.email && !req.body.phone) {
      throw new Error('Either email or phone number is required.');
    }
    return true;
  }),
];

const loginRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Please provide a valid email address.')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required.'),
];

const otpSendRules = [
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required.')
    .matches(/^[6-9]\d{9}$/).withMessage('Phone must be a valid 10-digit Indian mobile number.'),
];

const otpVerifyRules = [
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required.')
    .matches(/^[6-9]\d{9}$/).withMessage('Phone must be a valid 10-digit Indian mobile number.'),

  body('otp')
    .trim()
    .notEmpty().withMessage('OTP is required.')
    .isLength({ min: 4, max: 8 }).withMessage('OTP must be between 4 and 8 digits.')
    .isNumeric().withMessage('OTP must contain only digits.'),
];

const refreshRules = [
  body('refreshToken')
    .notEmpty().withMessage('Refresh token is required.'),
];

const logoutRules = [
  body('refreshToken')
    .optional()
    .isString().withMessage('Refresh token must be a string.'),
];

// Validates the new unified OTP request route (accepts email OR phone as 'identifier')
const requestOtpRules = [
  body('identifier')
    .trim()
    .notEmpty().withMessage('Email or phone number is required.')
    .custom((val) => {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
      const isPhone = /^[6-9]\d{9}$/.test(val.replace(/\D/g, ''));
      if (!isEmail && !isPhone) {
        throw new Error('Please provide a valid email address or 10-digit mobile number.');
      }
      return true;
    }),
];

// Validates the new unified OTP verify route
const verifyOtpNewRules = [
  body('identifier')
    .trim()
    .notEmpty().withMessage('Identifier (email or phone) is required.'),
  body('otp')
    .trim()
    .notEmpty().withMessage('OTP is required.')
    .isLength({ min: 4, max: 8 }).withMessage('OTP must be between 4 and 8 digits.')
    .isNumeric().withMessage('OTP must contain only digits.'),
];

// ─── Routes ───────────────────────────────────────────────────────────────────

// Email + password registration
// POST /api/v1/auth/register
router.post(
  '/register',
  registerLimiter,
  registerRules,
  validate,
  authController.register
);

// Email + password login
// POST /api/v1/auth/login
router.post(
  '/login',
  loginLimiter,
  loginRules,
  validate,
  authController.login
);

// Refresh access token
// POST /api/v1/auth/refresh
router.post(
  '/refresh',
  refreshLimiter,
  refreshRules,
  validate,
  authController.refresh
);

// Logout (revoke refresh token)
// POST /api/v1/auth/logout
router.post(
  '/logout',
  protect,
  logoutRules,
  validate,
  authController.logout
);

// Get current authenticated user
// GET /api/v1/auth/me
router.get('/me', protect, authController.getMe);

// Passwordless request OTP (supports Email and Phone)
// POST /api/v1/auth/request-otp
router.post(
  '/request-otp',
  otpSendLimiter,
  requestOtpRules,
  validate,
  authController.requestOtp
);

// Passwordless verify OTP (supports Email and Phone)
// POST /api/v1/auth/verify-otp
router.post(
  '/verify-otp',
  otpVerifyLimiter,
  verifyOtpNewRules,
  validate,
  authController.verifyOtpNew
);

// Send OTP to phone (legacy/internal)
// POST /api/v1/auth/otp/send
router.post(
  '/otp/send',
  otpSendLimiter,
  otpSendRules,
  validate,
  authController.sendOtp
);

// Verify OTP and get tokens (legacy/internal)
// POST /api/v1/auth/otp/verify
router.post(
  '/otp/verify',
  otpVerifyLimiter,
  otpVerifyRules,
  validate,
  authController.verifyOtp
);

// Initiate Google OAuth
// GET /api/v1/auth/google
router.get('/google', authController.googleAuth);

// Google OAuth callback
// GET /api/v1/auth/google/callback
router.get('/google/callback', authController.googleCallback);

// Exchange code for Google OAuth tokens
// POST /api/v1/auth/google/exchange
router.post('/google/exchange', authController.googleExchange);

module.exports = router;
