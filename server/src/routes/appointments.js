'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();

const {
  lockSlot,
  getMyAppointments,
  getAppointmentById,
  cancelAppointment,
  rescheduleAppointment,
} = require('../controllers/appointmentsController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const rateLimit = require('express-rate-limit');

// Limit slot locking: max 10 per hour per IP (prevents slot-flooding abuse)
const lockLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many booking attempts. Please wait an hour.' },
});

// ─── POST /api/v1/appointments/lock ──────────────────────────────────────────
router.post(
  '/lock',
  protect,
  lockLimiter,
  [
    body('date')
      .notEmpty().withMessage('date is required.')
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date must be YYYY-MM-DD.'),
    body('slotStart')
      .notEmpty().withMessage('slotStart is required.')
      .matches(/^\d{2}:\d{2}$/).withMessage('slotStart must be HH:mm.'),
    body('slotEnd')
      .notEmpty().withMessage('slotEnd is required.')
      .matches(/^\d{2}:\d{2}$/).withMessage('slotEnd must be HH:mm.'),
    body('consultationType')
      .notEmpty().withMessage('consultationType is required.')
      .isIn(['online', 'clinic']).withMessage("consultationType must be 'online' or 'clinic'."),
    // Ensure slotEnd is after slotStart
    body('slotEnd').custom((slotEnd, { req }) => {
      const { slotStart } = req.body;
      if (slotStart && slotEnd) {
        const [sh, sm] = slotStart.split(':').map(Number);
        const [eh, em] = slotEnd.split(':').map(Number);
        if (eh * 60 + em <= sh * 60 + sm) {
          throw new Error('slotEnd must be after slotStart.');
        }
      }
      return true;
    }),
    body('patientName')
      .optional()
      .trim()
      .escape()
      .isLength({ max: 100 }).withMessage('Patient name cannot exceed 100 characters.'),
    body('patientPhone')
      .optional()
      .trim()
      .escape()
      .matches(/^[6-9]\d{9}$/).withMessage('Patient phone must be a valid 10-digit Indian number.'),
    body('patientEmail')
      .optional({ checkFalsy: true })
      .trim()
      .isEmail().withMessage('Please provide a valid patient email.')
      .normalizeEmail(),
    body('reason')
      .optional()
      .trim()
      .escape()
      .isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters.'),
  ],
  validate,
  lockSlot
);

// ─── GET /api/v1/appointments/my ─────────────────────────────────────────────
router.get(
  '/my',
  protect,
  [
    query('status').optional().isString(),
    query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer.'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be 1–50.'),
  ],
  validate,
  getMyAppointments
);

// ─── GET /api/v1/appointments/:id ────────────────────────────────────────────
router.get(
  '/:id',
  protect,
  [param('id').isMongoId().withMessage('Invalid appointment ID.')],
  validate,
  getAppointmentById
);

// ─── POST /api/v1/appointments/:id/cancel ────────────────────────────────────
router.post(
  '/:id/cancel',
  protect,
  [
    param('id').isMongoId().withMessage('Invalid appointment ID.'),
    body('reason')
      .optional()
      .trim()
      .escape()
      .isLength({ max: 500 }).withMessage('Cancellation reason cannot exceed 500 characters.'),
  ],
  validate,
  cancelAppointment
);

// ─── POST /api/v1/appointments/:id/reschedule ────────────────────────────────
router.post(
  '/:id/reschedule',
  protect,
  [
    param('id').isMongoId().withMessage('Invalid appointment ID.'),
    body('date')
      .notEmpty().withMessage('date is required.')
      .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date must be YYYY-MM-DD.'),
    body('slotStart')
      .notEmpty().withMessage('slotStart is required.')
      .matches(/^\d{2}:\d{2}$/).withMessage('slotStart must be HH:mm.'),
    body('slotEnd')
      .notEmpty().withMessage('slotEnd is required.')
      .matches(/^\d{2}:\d{2}$/).withMessage('slotEnd must be HH:mm.'),
    body('consultationType')
      .optional()
      .isIn(['online', 'clinic']).withMessage("consultationType must be 'online' or 'clinic'."),
  ],
  validate,
  rescheduleAppointment
);

module.exports = router;
