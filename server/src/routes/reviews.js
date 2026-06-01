'use strict';

const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();

const { getReviews, createReview, getEligibleForReview } = require('../controllers/reviewsController');
const { protect, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const rateLimit = require('express-rate-limit');

// 3 reviews per hour per IP (prevent spam reviews)
const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many review submissions. Please wait.' },
});

// GET /api/v1/reviews — public, paginated
router.get(
  '/',
  optionalAuth,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ],
  validate,
  getReviews
);

// GET /api/v1/reviews/eligible — authenticated, returns unreviewed completed appointments
router.get('/eligible', protect, getEligibleForReview);

// POST /api/v1/reviews — authenticated, one per completed appointment
router.post(
  '/',
  protect,
  reviewLimiter,
  [
    body('appointmentId')
      .notEmpty().withMessage('appointmentId is required.')
      .isMongoId().withMessage('Invalid appointmentId.'),
    body('rating')
      .notEmpty().withMessage('Rating is required.')
      .isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5.'),
    body('comment')
      .optional({ checkFalsy: true })
      .isString()
      .isLength({ max: 500 }).withMessage('Comment cannot exceed 500 characters.'),
  ],
  validate,
  createReview
);

module.exports = router;
