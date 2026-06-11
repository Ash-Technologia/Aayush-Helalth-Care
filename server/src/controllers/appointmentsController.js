'use strict';

const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const DoctorProfile = require('../models/DoctorProfile');
const Holiday = require('../models/Holiday');
const SlotTemplate = require('../models/SlotTemplate');
const { generateScreenshotWhatsAppLink, generateJoinWhatsAppLink,
        formatAppointmentDate, formatSlotTime } = require('../utils/whatsappLinks');
const { timeToMins } = require('../utils/slotGenerator');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Formats an Appointment document for safe API response */
const formatAppointment = (appt) => ({
  _id: appt._id,
  appointmentDate: appt.appointmentDate,
  slotStart: appt.slotStart,
  slotEnd: appt.slotEnd,
  consultationType: appt.consultationType,
  status: appt.status,
  feeSnapshot: appt.feeSnapshot,
  patientName: appt.patientName,
  patientPhone: appt.patientPhone,
  patientEmail: appt.patientEmail,
  lockedUntil: appt.lockedUntil,
  lockRemainingSeconds: appt.lockRemainingSeconds,
  whatsappJoinLink: appt.whatsappJoinLink,
  paymentSubmission: appt.paymentSubmission,
  cancellationReason: appt.cancellationReason,
  createdAt: appt.createdAt,
});

/**
 * Verifies that a requested slot is valid for a given date + type.
 * Used inside the lock transaction.
 * Returns an error message string, or null if valid.
 */
const validateSlotExists = async (date, slotStart, slotEnd, consultationType) => {
  const requestDate = new Date(date);
  const dayOfWeek = requestDate.getUTCDay();

  const templates = await SlotTemplate.find({
    dayOfWeek,
    isActive: true,
    consultationType: { $in: ['both', consultationType] },
  });

  if (templates.length === 0) return 'No slots configured for this day.';

  // Check if slotStart/slotEnd falls within any template
  const slotStartMins = timeToMins(slotStart);
  const slotEndMins   = timeToMins(slotEnd);

  const slotInTemplate = templates.some((t) => {
    const tStart = timeToMins(t.startTime);
    const tEnd   = timeToMins(t.endTime);
    return slotStartMins >= tStart && slotEndMins <= tEnd;
  });

  if (!slotInTemplate) return 'The requested slot does not exist in any active template.';
  return null; // valid
};

// ─── POST /api/v1/appointments/lock ──────────────────────────────────────────
/**
 * Locks a slot for 30 minutes and creates an awaiting_payment appointment.
 *
 * Transaction guarantees:
 *   - Checks availability inside the transaction (prevents race conditions)
 *   - Creates appointment with compound partial index enforcement
 *   - If duplicate key error (11000) → 409 Conflict "slot just taken"
 */
const lockSlot = asyncHandler(async (req, res) => {
  const { date, slotStart, slotEnd, consultationType } = req.body;
  const user = req.dbUser;

  // ── Parse + validate date ────────────────────────────────────────────────
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    return res.status(400).json({ success: false, message: 'Invalid date format.' });
  }
  const requestDate = new Date(
    Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
  );

  const todayUTC = new Date();
  const today = new Date(
    Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), todayUTC.getUTCDate())
  );
  if (requestDate < today) {
    return res.status(400).json({ success: false, message: 'Cannot book past dates.' });
  }

  // ── Pre-flight checks (outside transaction for speed) ────────────────────
  const holiday = await Holiday.isHoliday(requestDate);
  if (holiday) {
    return res.status(409).json({
      success: false,
      message: `Clinic is closed on this date: ${holiday.reason}`,
    });
  }

  const profile = await DoctorProfile.getSingleton();
  if (profile.isEmergencyClosed) {
    return res.status(409).json({
      success: false,
      message: profile.emergencyMessage || 'Clinic is temporarily closed.',
    });
  }

  // Validate the slot exists in a template
  const slotError = await validateSlotExists(requestDate, slotStart, slotEnd, consultationType);
  if (slotError) {
    return res.status(400).json({ success: false, message: slotError });
  }

  // Check if user already has a non-expired active booking for same slot
  const existingUserBooking = await Appointment.findOne({
    user: user._id,
    appointmentDate: requestDate,
    slotStart,
    consultationType,
    status: { $in: ['awaiting_payment', 'pending_approval', 'confirmed'] },
  });
  if (existingUserBooking) {
    return res.status(409).json({
      success: false,
      message: 'You already have an active booking for this slot.',
      appointmentId: existingUserBooking._id,
    });
  }

  // ── MongoDB Transaction ──────────────────────────────────────────────────
  const session = await mongoose.startSession();
  let appointment;

  try {
    await session.withTransaction(async () => {
      // Re-check availability inside transaction (prevents race condition)
      const blocked = await Appointment.getBlockedSlots(requestDate, consultationType);
      if (blocked.includes(slotStart)) {
        const err = new Error('This slot was just taken. Please choose another.');
        err.statusCode = 409;
        throw err;
      }

      const lockExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      const created = await Appointment.create(
        [
          {
            user: user._id,
            appointmentDate: requestDate,
            slotStart,
            slotEnd,
            consultationType,
            feeSnapshot: profile.consultationFee,
            status: 'awaiting_payment',
            lockedUntil: lockExpiresAt,
            // Snapshot patient details at booking time
            patientName:  req.body.patientName  || user.fullName,
            patientPhone: req.body.patientPhone || user.phone  || '',
            patientEmail: req.body.patientEmail || user.email  || '',
          },
        ],
        { session }
      );

      appointment = created[0];
    });
  } catch (err) {
    await session.endSession();

    // MongoDB duplicate key — compound partial index triggered
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This slot was just taken. Please choose another time.',
      });
    }
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    throw err;
  }

  await session.endSession();

  // ── Build WhatsApp screenshot link for the payment page ──────────────────
  const whatsappLink = generateScreenshotWhatsAppLink(
    user.fullName,
    appointment._id.toString(),
    profile.consultationFee
  );

  // ── Fire slot-locked notification (payment reminder) ─────────────────────
  // Non-blocking: send email + SMS to patient with QR code / UPI details.
  try {
    const { notifyUserSlotLocked } = require('../utils/notificationService');
    notifyUserSlotLocked(appointment, profile).catch((e) =>
      console.error('[Notify] Slot-locked notification failed:', e.message)
    );
  } catch (e) { console.error('[Notify] notificationService unavailable:', e.message); }

  res.status(201).json({
    success: true,
    message: 'Slot reserved. Complete payment within 30 minutes.',
    data: {
      appointmentId: appointment._id,
      lockExpiresAt: appointment.lockedUntil,
      fee: appointment.feeSnapshot,
      payment: {
        qrImageUrl:   profile.payment.qrImageUrl,
        upiId:        profile.payment.upiId,
        accountName:  profile.payment.accountName,
        instructions: profile.payment.instructions,
        whatsappScreenshotLink: whatsappLink,
      },
    },
  });
});

// ─── GET /api/v1/appointments/my ─────────────────────────────────────────────
/**
 * Returns the current user's appointments, sorted newest first.
 * Supports filtering by status query param.
 */
const getMyAppointments = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;

  const filter = { user: req.dbUser._id };
  if (status) {
    const validStatuses = [
      'awaiting_payment', 'pending_approval', 'confirmed', 'completed',
      'cancelled', 'payment_rejected', 'expired', 'rescheduled', 'no_show',
    ];
    if (validStatuses.includes(status)) {
      filter.status = status;
    }
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const [appointments, total] = await Promise.all([
    Appointment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('paymentSubmission', 'status rejectionReason screenshotUploadedAt amountClaimed screenshotUrl')
      .lean({ virtuals: true }),
    Appointment.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      appointments: appointments.map(formatAppointment),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    },
  });
});

// ─── GET /api/v1/appointments/:id ────────────────────────────────────────────
/**
 * Returns a single appointment (user's own only).
 */
const getAppointmentById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid appointment ID.' });
  }

  const appointment = await Appointment.findById(id)
    .populate('paymentSubmission', 'status rejectionReason screenshotUploadedAt amountClaimed upiTransactionId screenshotUrl')
    .lean({ virtuals: true });

  if (!appointment) {
    return res.status(404).json({ success: false, message: 'Appointment not found.' });
  }

  // Ownership check — user can only see their own
  if (appointment.user.toString() !== req.dbUser._id.toString()) {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }

  // If awaiting_payment and lock expired, update status
  if (
    appointment.status === 'awaiting_payment' &&
    appointment.lockedUntil &&
    new Date(appointment.lockedUntil) <= new Date()
  ) {
    await Appointment.findByIdAndUpdate(id, { status: 'expired' });
    appointment.status = 'expired';
  }

  // Build WhatsApp join link for confirmed online appointments
  let whatsappJoinLink = appointment.whatsappJoinLink;
  if (
    appointment.status === 'confirmed' &&
    appointment.consultationType === 'online' &&
    !whatsappJoinLink
  ) {
    whatsappJoinLink = generateJoinWhatsAppLink(
      appointment.patientName,
      appointment._id.toString(),
      formatAppointmentDate(appointment.appointmentDate),
      formatSlotTime(appointment.slotStart)
    );
  }

  res.status(200).json({
    success: true,
    data: { appointment: { ...formatAppointment(appointment), whatsappJoinLink } },
  });
});

// ─── POST /api/v1/appointments/:id/cancel ────────────────────────────────────
/**
 * Cancels a user's own appointment.
 * Only allowed for: awaiting_payment (before screenshot), pending_approval.
 * Cannot cancel: confirmed, completed, already cancelled/rejected/expired.
 */
const cancelAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid appointment ID.' });
  }

  const appointment = await Appointment.findById(id);
  if (!appointment) {
    return res.status(404).json({ success: false, message: 'Appointment not found.' });
  }

  // Ownership check
  if (!appointment.user.equals(req.dbUser._id)) {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }

  const cancellableStatuses = ['awaiting_payment', 'pending_approval'];
  if (!cancellableStatuses.includes(appointment.status)) {
    return res.status(400).json({
      success: false,
      message: `Cannot cancel an appointment with status '${appointment.status}'. ` +
               `Please contact the clinic for confirmed or completed appointments.`,
    });
  }

  appointment.status = 'cancelled';
  appointment.cancellationReason = reason ? reason.trim() : 'Cancelled by patient.';
  appointment.cancelledBy = 'user';
  await appointment.save();

  // ── Notify admin of user-initiated cancellation ───────────────────────────
  // Non-blocking: only notify if appointment had an active status (not just awaiting_payment)
  if (['pending_approval', 'confirmed'].includes(appointment.status)) {
    try {
      const { notifyAdminUserCancelled } = require('../utils/notificationService');
      notifyAdminUserCancelled(appointment).catch((e) =>
        console.error('[Notify] User-cancel admin notification failed:', e.message)
      );
    } catch (e) { console.error('[Notify] notificationService unavailable:', e.message); }
  }

  res.status(200).json({
    success: true,
    message: 'Appointment cancelled successfully.',
    data: { appointmentId: appointment._id, status: 'cancelled' },
  });
});

// ─── POST /api/v1/appointments/:id/reschedule ────────────────────────────────
/**
 * Reschedules a user's own active appointment to a new date and time slot.
 * Re-uses payment state (does not require repayment).
 */
const rescheduleAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { date, slotStart, slotEnd, consultationType } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid appointment ID.' });
  }

  const appointment = await Appointment.findById(id);
  if (!appointment) {
    return res.status(404).json({ success: false, message: 'Appointment not found.' });
  }

  // Ownership check
  if (!appointment.user.equals(req.dbUser._id)) {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }

  // Active status check
  const activeStatuses = ['awaiting_payment', 'pending_approval', 'confirmed'];
  if (!activeStatuses.includes(appointment.status)) {
    return res.status(400).json({
      success: false,
      message: `Cannot reschedule an appointment with status '${appointment.status}'.`,
    });
  }

  // Parse + validate date
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) {
    return res.status(400).json({ success: false, message: 'Invalid date format.' });
  }
  const requestDate = new Date(
    Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
  );

  const todayUTC = new Date();
  const today = new Date(
    Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), todayUTC.getUTCDate())
  );
  if (requestDate < today) {
    return res.status(400).json({ success: false, message: 'Cannot reschedule to past dates.' });
  }

  // Pre-flight checks
  const holiday = await Holiday.isHoliday(requestDate);
  if (holiday) {
    return res.status(409).json({
      success: false,
      message: `Clinic is closed on this date: ${holiday.reason}`,
    });
  }

  const profile = await DoctorProfile.getSingleton();
  if (profile.isEmergencyClosed) {
    return res.status(409).json({
      success: false,
      message: profile.emergencyMessage || 'Clinic is temporarily closed.',
    });
  }

  const targetType = consultationType || appointment.consultationType;

  // Validate slot exists in template
  const slotError = await validateSlotExists(requestDate, slotStart, slotEnd, targetType);
  if (slotError) {
    return res.status(400).json({ success: false, message: slotError });
  }

  // MongoDB Transaction to prevent double-booking race conditions
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Recheck availability (excluding this appointment itself to allow re-scheduling within same slot if needed, though rare)
      const blocked = await Appointment.find({
        appointmentDate: requestDate,
        slotStart,
        consultationType: targetType,
        status: { $in: ['awaiting_payment', 'pending_approval', 'confirmed'] },
        _id: { $ne: appointment._id },
      });

      if (blocked.length > 0) {
        const err = new Error('This slot is already booked. Please choose another.');
        err.statusCode = 409;
        throw err;
      }

      // Update appointment details
      appointment.appointmentDate = requestDate;
      appointment.slotStart = slotStart;
      appointment.slotEnd = slotEnd;
      appointment.consultationType = targetType;

      // If awaiting_payment, reset lock countdown to 30 mins from now
      if (appointment.status === 'awaiting_payment') {
        appointment.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      }

      await appointment.save({ session });
    });
  } catch (err) {
    await session.endSession();
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This slot is already booked. Please choose another time.',
      });
    }
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    throw err;
  }

  await session.endSession();

  // ── Fire reschedule notifications (patient + admin) ───────────────────────
  // Pass old slot info so admin email shows the before/after comparison.
  try {
    const { notifyRescheduled } = require('../utils/notificationService');
    notifyRescheduled(appointment, {
      oldDate:      req.body._oldDate      || null,
      oldSlotStart: req.body._oldSlotStart || null,
      oldSlotEnd:   req.body._oldSlotEnd   || null,
    }).catch((e) => console.error('[Notify] Reschedule notification failed:', e.message));
  } catch (e) { console.error('[Notify] notificationService unavailable:', e.message); }

  res.status(200).json({
    success: true,
    message: 'Appointment rescheduled successfully.',
    data: {
      appointmentId: appointment._id,
      appointmentDate: appointment.appointmentDate,
      slotStart: appointment.slotStart,
      slotEnd: appointment.slotEnd,
      status: appointment.status,
    },
  });
});

module.exports = { lockSlot, getMyAppointments, getAppointmentById, cancelAppointment, rescheduleAppointment };
