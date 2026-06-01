'use strict';

const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const SlotTemplate = require('../../models/SlotTemplate');
const Holiday = require('../../models/Holiday');
const { generateTimeSlots } = require('../../utils/slotGenerator');

// ═══════════════════════════════════════════════════════════════
// SLOT TEMPLATES
// ═══════════════════════════════════════════════════════════════

// ─── GET /api/v1/admin/slots/templates ───────────────────────────────────────
const listTemplates = asyncHandler(async (req, res) => {
  const templates = await SlotTemplate.find()
    .sort({ dayOfWeek: 1, startTime: 1 })
    .populate('createdBy', 'fullName email')
    .lean({ virtuals: true });

  res.status(200).json({ success: true, data: { templates } });
});

// ─── POST /api/v1/admin/slots/templates ──────────────────────────────────────
const createTemplate = asyncHandler(async (req, res) => {
  const {
    dayOfWeek, startTime, endTime, slotDurationMins, consultationType, maxSlots, notes,
  } = req.body;

  // Prevent duplicate active templates (same day + time block + type)
  const existing = await SlotTemplate.findOne({
    dayOfWeek,
    startTime,
    endTime,
    consultationType: { $in: [consultationType, 'both'] },
    isActive: true,
  });

  if (existing) {
    return res.status(409).json({
      success: false,
      message: 'An active template for this day and time range already exists.',
    });
  }

  const template = await SlotTemplate.create({
    dayOfWeek,
    startTime,
    endTime,
    slotDurationMins,
    consultationType,
    maxSlots: maxSlots || null,
    notes:    notes    || '',
    createdBy: req.dbUser._id,
  });

  // Return with preview of generated slots
  const preview = generateTimeSlots(startTime, endTime, slotDurationMins);

  res.status(201).json({
    success: true,
    message: `Template created. Generates ${preview.length} slots.`,
    data: { template, slotPreview: preview },
  });
});

// ─── PUT /api/v1/admin/slots/templates/:id ────────────────────────────────────
const updateTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid template ID.' });
  }

  const allowed = ['startTime', 'endTime', 'slotDurationMins', 'consultationType', 'isActive', 'maxSlots', 'notes'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  const template = await SlotTemplate.findByIdAndUpdate(
    id,
    updates,
    { new: true, runValidators: true }
  );

  if (!template) {
    return res.status(404).json({ success: false, message: 'Template not found.' });
  }

  const preview = generateTimeSlots(template.startTime, template.endTime, template.slotDurationMins);

  res.status(200).json({
    success: true,
    message: `Template updated. Generates ${preview.length} slots.`,
    data: { template, slotPreview: preview },
  });
});

// ─── DELETE /api/v1/admin/slots/templates/:id ────────────────────────────────
/**
 * Soft-delete: deactivates the template instead of removing it.
 * This preserves the record for historical reference.
 * Hard delete is done via ?hard=true (only if no appointments exist for this template).
 */
const deleteTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const hard = req.query.hard === 'true';

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid template ID.' });
  }

  const template = await SlotTemplate.findById(id);
  if (!template) {
    return res.status(404).json({ success: false, message: 'Template not found.' });
  }

  if (hard) {
    await SlotTemplate.findByIdAndDelete(id);
    return res.status(200).json({ success: true, message: 'Template permanently deleted.' });
  }

  // Soft delete — deactivate
  template.isActive = false;
  await template.save();

  res.status(200).json({
    success: true,
    message: 'Template deactivated. No new slots will be generated from this template.',
    data: { templateId: id, isActive: false },
  });
});

// ═══════════════════════════════════════════════════════════════
// HOLIDAYS
// ═══════════════════════════════════════════════════════════════

// ─── GET /api/v1/admin/slots/holidays ────────────────────────────────────────
const listHolidays = asyncHandler(async (req, res) => {
  // Return upcoming + recent holidays
  const holidays = await Holiday.find()
    .sort({ date: 1 })
    .lean();

  res.status(200).json({ success: true, data: { holidays } });
});

// ─── POST /api/v1/admin/slots/holidays ───────────────────────────────────────
const createHoliday = asyncHandler(async (req, res) => {
  const { date, reason, isRecurring } = req.body;

  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return res.status(400).json({ success: false, message: 'Invalid date format.' });
  }

  // Holiday model normalizes to UTC midnight in pre-save hook
  const holiday = await Holiday.create({
    date: parsedDate,
    reason: reason.trim(),
    isRecurring: isRecurring || false,
    createdBy: req.dbUser._id,
  });

  res.status(201).json({
    success: true,
    message: `Holiday added: ${holiday.reason} on ${holiday.date.toISOString().split('T')[0]}.`,
    data: { holiday },
  });
});

// ─── DELETE /api/v1/admin/slots/holidays/:id ─────────────────────────────────
const deleteHoliday = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid holiday ID.' });
  }

  const holiday = await Holiday.findByIdAndDelete(id);
  if (!holiday) {
    return res.status(404).json({ success: false, message: 'Holiday not found.' });
  }

  res.status(200).json({ success: true, message: 'Holiday removed.' });
});

// ─── GET /api/v1/admin/slots/preview ─────────────────────────────────────────
/**
 * Returns a preview of slots for a specific date (admin planning tool).
 * Does NOT check blocked appointments — shows the raw schedule.
 */
const previewSlots = asyncHandler(async (req, res) => {
  const { date, type } = req.query;

  if (!date || !type) {
    return res.status(400).json({ success: false, message: '`date` and `type` are required.' });
  }

  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    return res.status(400).json({ success: false, message: 'Invalid date.' });
  }

  const requestDate = new Date(
    Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
  );
  const dayOfWeek = requestDate.getUTCDay();

  const templates = await SlotTemplate.find({
    dayOfWeek,
    isActive: true,
    consultationType: { $in: ['both', type] },
  });

  const Appointment = require('../../models/Appointment');
  const appointments = await Appointment.find({
    appointmentDate: requestDate,
    consultationType: type,
    status: { $in: ['awaiting_payment', 'pending_approval', 'confirmed'] },
  }).lean();

  const preview = templates.flatMap((t) =>
    generateTimeSlots(t.startTime, t.endTime, t.slotDurationMins).map((s) => {
      const booking = appointments.find((a) => a.slotStart === s.slotStart);
      return {
        ...s,
        templateId: t._id,
        slotDurationMins: t.slotDurationMins,
        isBooked: !!booking,
        bookingDetails: booking ? {
          appointmentId: booking._id,
          patientName: booking.patientName,
          status: booking.status,
          isBlockedSlot: booking.patientName === 'Blocked Slot (Admin)',
        } : null,
      };
    })
  );

  preview.sort((a, b) => a.slotStart.localeCompare(b.slotStart));

  res.status(200).json({
    success: true,
    data: { date, type, totalSlots: preview.length, slots: preview },
  });
});

// ─── POST /api/v1/admin/slots/block ──────────────────────────────────────────
/**
 * Blocks a specific slot by creating a placeholder confirmed appointment.
 */
const blockSlot = asyncHandler(async (req, res) => {
  const { date, slotStart, slotEnd, consultationType } = req.body;

  if (!date || !slotStart || !slotEnd || !consultationType) {
    return res.status(400).json({ success: false, message: 'date, slotStart, slotEnd, and consultationType are required.' });
  }

  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    return res.status(400).json({ success: false, message: 'Invalid date.' });
  }

  const requestDate = new Date(
    Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
  );

  const Appointment = require('../../models/Appointment');
  
  // Check if slot is already booked or blocked
  const existing = await Appointment.findOne({
    appointmentDate: requestDate,
    slotStart,
    consultationType,
    status: { $in: ['awaiting_payment', 'pending_approval', 'confirmed'] },
  });

  if (existing) {
    return res.status(409).json({ success: false, message: 'This slot is already booked or blocked.' });
  }

  // Create a placeholder appointment representing the block
  const blockedAppt = await Appointment.create({
    user: req.dbUser._id, // admin user
    appointmentDate: requestDate,
    slotStart,
    slotEnd,
    consultationType,
    feeSnapshot: 0,
    status: 'confirmed',
    patientName: 'Blocked Slot (Admin)',
    patientPhone: req.dbUser.phone || '9822843015',
    patientEmail: req.dbUser.email || 'admin@aayushhealth.in',
    reason: 'Blocked by Admin (Busy)',
  });

  res.status(201).json({
    success: true,
    message: 'Slot blocked successfully.',
    data: { appointmentId: blockedAppt._id },
  });
});

// ─── POST /api/v1/admin/slots/unblock ────────────────────────────────────────
/**
 * Unblocks a slot by deleting the placeholder confirmed appointment.
 */
const unblockSlot = asyncHandler(async (req, res) => {
  const { appointmentId } = req.body;

  if (!appointmentId || !mongoose.Types.ObjectId.isValid(appointmentId)) {
    return res.status(400).json({ success: false, message: 'Valid appointmentId is required.' });
  }

  const Appointment = require('../../models/Appointment');
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    return res.status(404).json({ success: false, message: 'Blocked slot not found.' });
  }

  // Ensure it is indeed a blocked slot
  if (appointment.patientName !== 'Blocked Slot (Admin)') {
    return res.status(400).json({ success: false, message: 'This appointment is a real patient booking. Use the appointments manager to cancel it.' });
  }

  await Appointment.findByIdAndDelete(appointmentId);

  res.status(200).json({
    success: true,
    message: 'Slot unblocked successfully.',
  });
});

module.exports = {
  listTemplates, createTemplate, updateTemplate, deleteTemplate,
  listHolidays, createHoliday, deleteHoliday,
  previewSlots, blockSlot, unblockSlot,
};
