'use strict';

const express = require('express');
const { param, query, body } = require('express-validator');
const router = express.Router();
const { listPayments, getPayment, approvePayment, rejectPayment } = require('../../controllers/admin/paymentsController');
const { validate } = require('../../middleware/validate');

// All routes in this file already have protect + requireAdmin applied in admin/index.js

// GET /api/v1/admin/payments?status=submitted&page=1&limit=20
router.get(
  '/',
  [
    query('status').optional().isIn(['submitted', 'approved', 'rejected']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  listPayments
);

// GET /api/v1/admin/payments/:id
router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid submission ID.')],
  validate,
  getPayment
);

// POST /api/v1/admin/payments/:id/approve
router.post(
  '/:id/approve',
  [param('id').isMongoId().withMessage('Invalid submission ID.')],
  validate,
  approvePayment
);

// POST /api/v1/admin/payments/:id/reject
router.post(
  '/:id/reject',
  [
    param('id').isMongoId().withMessage('Invalid submission ID.'),
    body('reason')
      .notEmpty().withMessage('Rejection reason is required.')
      .isString()
      .isLength({ min: 10 }).withMessage('Rejection reason must be at least 10 characters.')
      .isLength({ max: 500 }).withMessage('Rejection reason cannot exceed 500 characters.'),
  ],
  validate,
  rejectPayment
);

module.exports = router;
