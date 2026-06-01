'use strict';

const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Appointment = require('../../models/Appointment');

// ─── GET /api/v1/admin/appointments ──────────────────────────────────────────
/**
 * Lists all appointments with full filtering.
 * Filters: status, date, consultationType, search (patient name/phone).
 */
const listAppointments = asyncHandler(async (req, res) => {
  const { status, date, type, search, page = 1, limit = 20 } = req.query;
  const pageNum  = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip     = (pageNum - 1) * limitNum;

  const filter = {};

  // Status filter
  const validStatuses = [
    'awaiting_payment', 'pending_approval', 'confirmed', 'completed',
    'cancelled', 'payment_rejected', 'expired', 'rescheduled', 'no_show',
  ];
  if (status && validStatuses.includes(status)) filter.status = status;

  // Date filter (exact day)
  if (date) {
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      const start = new Date(
        Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
      );
      const end = new Date(start.getTime() + 86_400_000 - 1);
      filter.appointmentDate = { $gte: start, $lte: end };
    }
  }

  // Consultation type
  if (type && ['online', 'clinic'].includes(type)) filter.consultationType = type;

  // Text search on patient name or phone (case-insensitive)
  if (search && search.trim()) {
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { patientName:  { $regex: escaped, $options: 'i' } },
      { patientPhone: { $regex: escaped, $options: 'i' } },
      { patientEmail: { $regex: escaped, $options: 'i' } },
    ];
  }

  const [appointments, total] = await Promise.all([
    Appointment.find(filter)
      .sort({ appointmentDate: -1, slotStart: 1 })
      .skip(skip)
      .limit(limitNum)
      .populate('user', 'fullName email phone')
      .populate('paymentSubmission', 'status screenshotUrl amountClaimed adminReviewedAt')
      .lean({ virtuals: true }),
    Appointment.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      appointments,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    },
  });
});

// ─── GET /api/v1/admin/appointments/:id ──────────────────────────────────────
const getAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid appointment ID.' });
  }

  const appt = await Appointment.findById(id)
    .populate('user', 'fullName email phone')
    .populate({
      path: 'paymentSubmission',
      populate: { path: 'adminReviewedBy', select: 'fullName email' },
    })
    .lean({ virtuals: true });

  if (!appt) {
    return res.status(404).json({ success: false, message: 'Appointment not found.' });
  }

  res.status(200).json({ success: true, data: { appointment: appt } });
});

// ─── PATCH /api/v1/admin/appointments/:id/complete ───────────────────────────
/**
 * Marks an appointment as completed (after the consultation is done).
 * Only confirmed appointments can be completed.
 */
const completeAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const appt = await Appointment.findById(id);
  if (!appt) {
    return res.status(404).json({ success: false, message: 'Appointment not found.' });
  }

  if (appt.status !== 'confirmed') {
    return res.status(400).json({
      success: false,
      message: `Only confirmed appointments can be marked as completed. Current status: '${appt.status}'.`,
    });
  }

  appt.status = 'completed';
  appt.completedAt = new Date();
  await appt.save();

  res.status(200).json({
    success: true,
    message: 'Appointment marked as completed.',
    data: { appointmentId: id, status: 'completed' },
  });
});

// ─── PATCH /api/v1/admin/appointments/:id/no-show ────────────────────────────
/**
 * Marks a confirmed appointment as no_show (patient didn't attend).
 */
const markNoShow = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const appt = await Appointment.findById(id);
  if (!appt) {
    return res.status(404).json({ success: false, message: 'Appointment not found.' });
  }

  if (appt.status !== 'confirmed') {
    return res.status(400).json({
      success: false,
      message: `Only confirmed appointments can be marked as no-show. Current status: '${appt.status}'.`,
    });
  }

  appt.status = 'no_show';
  await appt.save();

  res.status(200).json({
    success: true,
    message: 'Appointment marked as no-show.',
    data: { appointmentId: id, status: 'no_show' },
  });
});

// ─── PATCH /api/v1/admin/appointments/:id/cancel ─────────────────────────────
/**
 * Admin-level cancellation. Can cancel any non-terminal appointment.
 * (Unlike user cancellation which is restricted to awaiting_payment/pending_approval).
 */
const adminCancelAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const appt = await Appointment.findById(id);
  if (!appt) {
    return res.status(404).json({ success: false, message: 'Appointment not found.' });
  }

  const terminalStatuses = ['cancelled', 'completed', 'expired', 'no_show', 'payment_rejected'];
  if (terminalStatuses.includes(appt.status)) {
    return res.status(400).json({
      success: false,
      message: `Cannot cancel an appointment with terminal status '${appt.status}'.`,
    });
  }

  appt.status = 'cancelled';
  appt.cancellationReason = reason ? reason.trim() : 'Cancelled by clinic admin.';
  appt.cancelledBy = 'admin';
  await appt.save();

  // Fire notification (email + SMS, async)
  try {
    const { notifyUserAppointmentCancelled } = require('../../utils/notificationService');
    notifyUserAppointmentCancelled(appt).catch((e) =>
      console.error('[Notify] Cancellation notification failed:', e.message)
    );
  } catch (e) { console.error('[Notify] notificationService unavailable:', e.message); }

  res.status(200).json({
    success: true,
    message: 'Appointment cancelled.',
    data: { appointmentId: id, status: 'cancelled' },
  });
});

module.exports = {
  listAppointments,
  getAppointment,
  completeAppointment,
  markNoShow,
  adminCancelAppointment,
};
