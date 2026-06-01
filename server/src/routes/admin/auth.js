'use strict';

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { adminLogin } = require('../../controllers/admin/authController');
const { validate } = require('../../middleware/validate');
const rateLimit = require('express-rate-limit');

// Tighter rate limit for admin login — 5 attempts per 15 min
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many admin login attempts. Please wait 15 minutes.' },
});

// POST /api/v1/admin/login
router.post(
  '/',
  adminLoginLimiter,
  [
    body('email').trim().notEmpty().isEmail().normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  validate,
  adminLogin
);

module.exports = router;
