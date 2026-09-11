'use strict';

const asyncHandler = require('express-async-handler');
const DoctorProfile = require('../models/DoctorProfile');
const Holiday = require('../models/Holiday');
const SlotTemplate = require('../models/SlotTemplate');
const Appointment = require('../models/Appointment');
const { filterAvailableSlots, deduplicateSlots, getISTTodayString } = require('../utils/slotGenerator');

// ─── GET /api/v1/slots/available ─────────────────────────────────────────────
/**
 * Returns available appointment slots for a given date and consultation type.
 *
 * Query params:
 *   date (required) — YYYY-MM-DD
 *   type (required) — 'online' | 'clinic'
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

  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) {
    return res.status(400).json({
      success: false,
      message: 'Invalid date format. Use YYYY-MM-DD.',
    });
  }

  const requestDate = new Date(Date.UTC(y, m - 1, d));
  if (isNaN(requestDate.getTime())) {
    return res.status(400).json({
      success: false,
      message: 'Invalid date format. Use YYYY-MM-DD.',
    });
  }

  // Reject past dates relative to Indian Standard Time
  const istTodayStr = getISTTodayString();
  if (date < istTodayStr) {
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

// ─── GET /api/v1/slots/config ────────────────────────────────────────────────
/**
 * Returns scheduling metadata for the client calendar:
 * - Active days of week per consultation type (0=Sun..6=Sat)
 * - Upcoming holidays
 * - Emergency closure status
 * - Current consultation fee & clinic timings
 */
const getSlotsConfig = asyncHandler(async (req, res) => {
  const profile = await DoctorProfile.getSingleton();
  const templates = await SlotTemplate.find({ isActive: true }).lean();

  const activeDays = {
    all: [...new Set(templates.map((t) => t.dayOfWeek))],
    online: [
      ...new Set(
        templates
          .filter((t) => t.consultationType === 'online' || t.consultationType === 'both')
          .map((t) => t.dayOfWeek)
      ),
    ],
    clinic: [
      ...new Set(
        templates
          .filter((t) => t.consultationType === 'clinic' || t.consultationType === 'both')
          .map((t) => t.dayOfWeek)
      ),
    ],
  };

  const istTodayStr = getISTTodayString();
  const [y, m, d] = istTodayStr.split('-').map(Number);
  const todayUtc = new Date(Date.UTC(y, m - 1, d));
  const futureUtc = new Date(todayUtc.getTime() + 60 * 24 * 60 * 60 * 1000);

  const holidays = await Holiday.find({
    $or: [
      { date: { $gte: todayUtc, $lte: futureUtc } },
      { isRecurring: true },
    ],
  })
    .select('date reason isRecurring')
    .lean();

  return res.status(200).json({
    success: true,
    data: {
      activeDays,
      holidays: holidays.map((h) => ({
        date: h.date ? h.date.toISOString().slice(0, 10) : null,
        reason: h.reason,
        isRecurring: h.isRecurring,
      })),
      emergencyClosure: {
        isClosed: !!profile.isEmergencyClosed,
        message: profile.emergencyMessage || '',
      },
      advanceBookingDays: 30,
      consultationFee: profile.consultationFee ?? 500,
      clinicTimings: profile.clinicTimings || [],
      payment: {
        qrImageUrl: profile.payment?.qrImageUrl || null,
        upiId: profile.payment?.upiId || '',
        accountName: profile.payment?.accountName || 'Amrut Singhavi',
        instructions: profile.payment?.instructions || '',
      },
      whatsappNumber: profile.whatsappNumber || '9822843015',
    },
  });
});

module.exports = { getAvailableSlots, getSlotsConfig };
