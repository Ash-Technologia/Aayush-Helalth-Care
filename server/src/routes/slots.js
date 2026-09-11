'use strict';

const express = require('express');
const { query } = require('express-validator');
const router = express.Router();

const { getAvailableSlots, getSlotsConfig } = require('../controllers/slotsController');
const { optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// ─── GET /api/v1/slots/config ────────────────────────────────────────────────
// Public endpoint: returns active template days, upcoming holidays, fees, and closure info
router.get('/config', getSlotsConfig);

// ─── GET /api/v1/slots/available ─────────────────────────────────────────────
// Public endpoint — no auth required.
// Optional auth: if logged in, could show personalized info in future.
router.get(
  '/available',
  optionalAuth,
  [
    query('date')
      .notEmpty().withMessage('date is required.')
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date must be in YYYY-MM-DD format.'),
    query('type')
      .notEmpty().withMessage('type is required.')
      .isIn(['online', 'clinic']).withMessage("type must be 'online' or 'clinic'."),
  ],
  validate,
  getAvailableSlots
);

module.exports = router;
