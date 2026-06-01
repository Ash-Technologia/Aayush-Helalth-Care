'use strict';

const express = require('express');
const { param, query, body } = require('express-validator');
const router = express.Router();
const {
  listAppointments, getAppointment,
  completeAppointment, markNoShow, adminCancelAppointment,
} = require('../../controllers/admin/appointmentsController');
const { validate } = require('../../middleware/validate');

// GET  /api/v1/admin/appointments
router.get(
  '/',
  [
    query('status').optional().isString(),
    query('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    query('type').optional().isIn(['online', 'clinic']),
    query('search').optional().isString().isLength({ max: 100 }),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  listAppointments
);

// GET  /api/v1/admin/appointments/:id
router.get('/:id', [param('id').isMongoId()], validate, getAppointment);

// PATCH /api/v1/admin/appointments/:id/complete
router.patch('/:id/complete', [param('id').isMongoId()], validate, completeAppointment);

// PATCH /api/v1/admin/appointments/:id/no-show
router.patch('/:id/no-show', [param('id').isMongoId()], validate, markNoShow);

// PATCH /api/v1/admin/appointments/:id/cancel
router.patch(
  '/:id/cancel',
  [
    param('id').isMongoId(),
    body('reason').optional().isString().isLength({ max: 500 }),
  ],
  validate,
  adminCancelAppointment
);

module.exports = router;
