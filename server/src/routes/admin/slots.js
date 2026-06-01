'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();
const {
  listTemplates, createTemplate, updateTemplate, deleteTemplate,
  listHolidays, createHoliday, deleteHoliday, previewSlots,
  blockSlot, unblockSlot,
} = require('../../controllers/admin/slotsController');
const { validate } = require('../../middleware/validate');

const VALID_DURATIONS = [10, 15, 20, 30, 45, 60, 90, 120];

// ─── Templates ────────────────────────────────────────────────────────────────
router.get('/templates', listTemplates);

router.post(
  '/templates',
  [
    body('dayOfWeek').isInt({ min: 0, max: 6 }).withMessage('dayOfWeek must be 0 (Sun)–6 (Sat).'),
    body('startTime').matches(/^\d{2}:\d{2}$/).withMessage('startTime must be HH:mm.'),
    body('endTime').matches(/^\d{2}:\d{2}$/).withMessage('endTime must be HH:mm.'),
    body('slotDurationMins')
      .isInt().withMessage('slotDurationMins must be an integer.')
      .custom((v) => {
        if (!VALID_DURATIONS.includes(Number(v))) {
          throw new Error(`slotDurationMins must be one of: ${VALID_DURATIONS.join(', ')}.`);
        }
        return true;
      }),
    body('consultationType').isIn(['online', 'clinic', 'both'])
      .withMessage("consultationType must be 'online', 'clinic', or 'both'."),
    body('maxSlots').optional().isInt({ min: 1 }),
    body('notes').optional().isString().isLength({ max: 200 }),
    // endTime > startTime validation
    body('endTime').custom((endTime, { req }) => {
      const { startTime } = req.body;
      if (startTime && endTime) {
        const [sh, sm] = startTime.split(':').map(Number);
        const [eh, em] = endTime.split(':').map(Number);
        if (eh * 60 + em <= sh * 60 + sm) {
          throw new Error('endTime must be after startTime.');
        }
      }
      return true;
    }),
  ],
  validate,
  createTemplate
);

router.put(
  '/templates/:id',
  [
    param('id').isMongoId(),
    body('slotDurationMins').optional().custom((v) => {
      if (!VALID_DURATIONS.includes(Number(v))) {
        throw new Error(`slotDurationMins must be one of: ${VALID_DURATIONS.join(', ')}.`);
      }
      return true;
    }),
    body('consultationType').optional().isIn(['online', 'clinic', 'both']),
    body('isActive').optional().isBoolean(),
  ],
  validate,
  updateTemplate
);

router.delete(
  '/templates/:id',
  [
    param('id').isMongoId(),
    query('hard').optional().isIn(['true', 'false']),
  ],
  validate,
  deleteTemplate
);

// ─── Holidays ─────────────────────────────────────────────────────────────────
router.get('/holidays', listHolidays);

router.post(
  '/holidays',
  [
    body('date').notEmpty().withMessage('date is required.').isISO8601().withMessage('date must be a valid ISO date.'),
    body('reason').notEmpty().withMessage('reason is required.').isLength({ max: 200 }),
    body('isRecurring').optional().isBoolean(),
  ],
  validate,
  createHoliday
);

router.delete('/holidays/:id', [param('id').isMongoId()], validate, deleteHoliday);

// ─── Preview ──────────────────────────────────────────────────────────────────
router.get(
  '/preview',
  [
    query('date').notEmpty().matches(/^\d{4}-\d{2}-\d{2}$/),
    query('type').notEmpty().isIn(['online', 'clinic']),
  ],
  validate,
  previewSlots
);

// ─── Slot Blocking / Unblocking ──────────────────────────────────────────────
router.post(
  '/block',
  [
    body('date').notEmpty().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date is required (YYYY-MM-DD).'),
    body('slotStart').notEmpty().matches(/^\d{2}:\d{2}$/).withMessage('slotStart is required (HH:mm).'),
    body('slotEnd').notEmpty().matches(/^\d{2}:\d{2}$/).withMessage('slotEnd is required (HH:mm).'),
    body('consultationType').notEmpty().isIn(['online', 'clinic']).withMessage("consultationType must be 'online' or 'clinic'."),
  ],
  validate,
  blockSlot
);

router.post(
  '/unblock',
  [
    body('appointmentId').notEmpty().isMongoId().withMessage('Valid appointmentId is required.'),
  ],
  validate,
  unblockSlot
);

module.exports = router;
