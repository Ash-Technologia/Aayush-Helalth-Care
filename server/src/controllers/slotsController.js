'use strict';

const asyncHandler = require('express-async-handler');
const DoctorProfile = require('../models/DoctorProfile');
const Holiday = require('../models/Holiday');
const SlotTemplate = require('../models/SlotTemplate');
const Appointment = require('../models/Appointment');
const { filterAvailableSlots, deduplicateSlots } = require('../utils/slotGenerator');

// ─── GET /api/v1/slots/available ─────────────────────────────────────────────
/**
 * Returns available appointment slots for a given date and consultation type.
 *
 * Query params:
 *   date (required) — YYYY-MM-DD
 *   type (required) — 'online' | 'clinic'
 *
 * Algorithm (per spec):
 *   1. Reject past dates
 *   2. Check holiday
 *   3. Check emergency closure
 *   4. Find active SlotTemplates for dayOfWeek + type
 *   5. Generate all raw slots per template
 *   6. Filter out break times
 *   7. Filter out past slots (for today)
 *   8. Query blocked appointments
 *   9. Remove blocked slots
 *  10. Deduplicate + sort
 */
const getAvailableSlots = asyncHandler(async (req, res) => {
  const { date, type } = req.query;

  // ── 1. Parse + validate date ─────────────────────────────────────────────
  if (!date || !type) {
    return res.status(400).json({
      success: false,
      message: 'Both `date` (YYYY-MM-DD) and `type` (online|clinic) are required.',
    });
  }

  if (!['online', 'clinic'].includes(type)) {
    return res.status(400).json({
      success: false,
      message: "`type` must be 'online' or 'clinic'.",
    });
  }

  // Parse and normalize date to UTC midnight
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    return res.status(400).json({
      success: false,
      message: 'Invalid date format. Use YYYY-MM-DD.',
    });
  }

  const requestDate = new Date(
    Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
  );

  // Reject past dates (before today UTC)
  const todayUTC = new Date();
  const today = new Date(
    Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), todayUTC.getUTCDate())
  );

  if (requestDate < today) {
    return res.status(400).json({
      success: false,
      available: false,
      message: 'Cannot book appointments for past dates.',
    });
  }

  // ── 2. Check holiday ─────────────────────────────────────────────────────
  const holiday = await Holiday.isHoliday(requestDate);
  if (holiday) {
    return res.status(200).json({
      success: true,
      available: false,
      reason: 'holiday',
      message: `Clinic is closed: ${holiday.reason}`,
      slots: [],
    });
  }

  // ── 3. Check emergency closure ───────────────────────────────────────────
  const profile = await DoctorProfile.getSingleton();
  if (profile.isEmergencyClosed) {
    return res.status(200).json({
      success: true,
      available: false,
      reason: 'emergency',
      message: profile.emergencyMessage || 'Clinic is temporarily closed.',
      slots: [],
    });
  }

  // ── 4. Find active SlotTemplates for this day + type ────────────────────
  const dayOfWeek = requestDate.getUTCDay(); // 0=Sun, 6=Sat

  // Templates can be 'both', 'online', or 'clinic'.
  // A 'both' template provides slots for either type.
  const templates = await SlotTemplate.find({
    dayOfWeek,
    isActive: true,
    consultationType: { $in: ['both', type] },
  });

  if (templates.length === 0) {
    return res.status(200).json({
      success: true,
      available: false,
      reason: 'no_templates',
      message: `No ${type} slots configured for this day.`,
      slots: [],
    });
  }

  // ── 5–9. Generate, filter, deduplicate ──────────────────────────────────
  const blockedSlotStarts = await Appointment.getBlockedSlots(requestDate, type);

  let allSlots = [];
  for (const template of templates) {
    const slots = filterAvailableSlots(
      template,
      blockedSlotStarts,
      profile.breakTimings || [],
      requestDate,
      type,
      profile.consultationFee
    );
    allSlots = allSlots.concat(slots);
  }

  const slots = deduplicateSlots(allSlots);

  return res.status(200).json({
    success: true,
    available: slots.length > 0,
    date: date,
    consultationType: type,
    fee: profile.consultationFee,
    slots,
  });
});

module.exports = { getAvailableSlots };
