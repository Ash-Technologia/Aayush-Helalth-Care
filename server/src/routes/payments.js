'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const { submitPayment, getPaymentStatus } = require('../controllers/paymentsController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { screenshotUpload, handleUploadError } = require('../middleware/upload');
const rateLimit = require('express-rate-limit');

// 5 submission attempts per hour per IP
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many payment submission attempts. Please wait an hour.',
  },
});

// ─── POST /api/v1/payments/submit ────────────────────────────────────────────
// multipart/form-data — screenshot file + JSON fields
router.post(
  '/submit',
  protect,
  submitLimiter,
  screenshotUpload.single('screenshot'), // field name: 'screenshot'
  handleUploadError,
  [
    body('appointmentId')
      .notEmpty().withMessage('appointmentId is required.')
      .isMongoId().withMessage('appointmentId must be a valid ID.'),
    body('amountClaimed')
      .notEmpty().withMessage('amountClaimed is required.')
      .isFloat({ min: 0.01 }).withMessage('amountClaimed must be a positive number.'),
    body('whatsappSentConfirmed')
      .notEmpty().withMessage('whatsappSentConfirmed is required.')
      .custom((val) => {
        if (val === true || val === 'true') return true;
        throw new Error('You must confirm that you sent the screenshot on WhatsApp.');
      }),
    body('upiTransactionId')
      .optional({ checkFalsy: true })
      .isString()
      .isLength({ max: 50 }).withMessage('UPI transaction ID cannot exceed 50 characters.'),
  ],
  validate,
  submitPayment
);

// ─── GET /api/v1/payments/status/:appointmentId ───────────────────────────────
router.get(
  '/status/:appointmentId',
  protect,
  [param('appointmentId').isMongoId().withMessage('Invalid appointment ID.')],
  validate,
  getPaymentStatus
);

module.exports = router;
