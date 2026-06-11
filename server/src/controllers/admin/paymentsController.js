'use strict';

const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const PaymentSubmission = require('../../models/PaymentSubmission');
const Appointment = require('../../models/Appointment');
const { generateJoinWhatsAppLink, formatAppointmentDate, formatSlotTime } = require('../../utils/whatsappLinks');

// ─── GET /api/v1/admin/payments ────────────────────────────────────────────────────
/**
 * Lists payment submissions with optional status filter and search.
 * Uses $lookup aggregation so search runs on joined appointment/user
 * fields BEFORE pagination, keeping totalPages accurate.
 */
const listPayments = asyncHandler(async (req, res) => {
  const { status = 'submitted', search = '', page = 1, limit = 20 } = req.query;
  const pageNum  = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip     = (pageNum - 1) * limitNum;

  const validStatuses = ['submitted', 'approved', 'rejected'];
  const matchStage = validStatuses.includes(status) ? { status } : {};

  // Build search filter on joined fields if a term is provided
  const searchTerm = search.trim();
  const searchFilter = searchTerm
    ? {
        $or: [
          { 'appointmentData.patientName':  { $regex: searchTerm, $options: 'i' } },
          { 'appointmentData.patientPhone': { $regex: searchTerm, $options: 'i' } },
          { 'userData.fullName':            { $regex: searchTerm, $options: 'i' } },
          { 'userData.email':               { $regex: searchTerm, $options: 'i' } },
          { 'userData.phone':               { $regex: searchTerm, $options: 'i' } },
        ],
      }
    : {};

  const pipeline = [
    // 1. Filter by status first (uses existing index)
    { $match: matchStage },

    // 2. Join appointments
    {
      $lookup: {
        from:         'appointments',
        localField:   'appointment',
        foreignField: '_id',
        as:           'appointmentData',
      },
    },
    { $unwind: { path: '$appointmentData', preserveNullAndEmptyArrays: true } },

    // 3. Join users
    {
      $lookup: {
        from:         'users',
        localField:   'user',
        foreignField: '_id',
        as:           'userData',
      },
    },
    { $unwind: { path: '$userData', preserveNullAndEmptyArrays: true } },

    // 4. Join adminReviewedBy
    {
      $lookup: {
        from:         'users',
        localField:   'adminReviewedBy',
        foreignField: '_id',
        as:           'adminReviewedByData',
      },
    },
    { $unwind: { path: '$adminReviewedByData', preserveNullAndEmptyArrays: true } },

    // 5. Apply search filter (on joined fields) — this is what makes pagination correct
    ...(searchTerm ? [{ $match: searchFilter }] : []),

    // 6. Sort newest first
    { $sort: { createdAt: -1 } },

    // 7. Facet: paginated results + total count in one round-trip
    {
      $facet: {
        submissions: [
          { $skip: skip },
          { $limit: limitNum },
          {
            $project: {
              _id: 1,
              status: 1,
              amountClaimed: 1,
              upiTransactionId: 1,
              screenshotUrl: 1,
              screenshotUploadedAt: 1,
              whatsappSentConfirmed: 1,
              rejectionReason: 1,
              createdAt: 1,
              // Re-shape joined documents to match the old populate shape
              appointment: {
                _id: '$appointmentData._id',
                appointmentDate: '$appointmentData.appointmentDate',
                slotStart: '$appointmentData.slotStart',
                slotEnd: '$appointmentData.slotEnd',
                consultationType: '$appointmentData.consultationType',
                feeSnapshot: '$appointmentData.feeSnapshot',
                patientName: '$appointmentData.patientName',
                patientPhone: '$appointmentData.patientPhone',
                status: '$appointmentData.status',
              },
              user: {
                _id: '$userData._id',
                fullName: '$userData.fullName',
                phone: '$userData.phone',
                email: '$userData.email',
              },
              adminReviewedBy: {
                _id: '$adminReviewedByData._id',
                fullName: '$adminReviewedByData.fullName',
                email: '$adminReviewedByData.email',
              },
            },
          },
        ],
        totalCount: [{ $count: 'count' }],
      },
    },
  ];

  const [result] = await PaymentSubmission.aggregate(pipeline);
  const submissions = result?.submissions || [];
  const total       = result?.totalCount?.[0]?.count || 0;

  res.status(200).json({
    success: true,
    data: {
      submissions,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    },
  });
});

// ─── GET /api/v1/admin/payments/:id ──────────────────────────────────────────
const getPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid submission ID.' });
  }

  const submission = await PaymentSubmission.findById(id)
    .populate('user', 'fullName phone email')
    .populate({
      path: 'appointment',
      select: 'appointmentDate slotStart slotEnd consultationType feeSnapshot patientName patientPhone patientEmail status',
    })
    .populate('adminReviewedBy', 'fullName email')
    .lean();

  if (!submission) {
    return res.status(404).json({ success: false, message: 'Payment submission not found.' });
  }

  res.status(200).json({ success: true, data: { submission } });
});

// ─── POST /api/v1/admin/payments/:id/approve ─────────────────────────────────
/**
 * Approves a payment submission.
 * Atomically: marks submission as approved + appointment as confirmed.
 * Generates WhatsApp join link for online appointments.
 * Idempotent: re-approving an already-approved submission returns 200.
 */
const approvePayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const admin = req.dbUser;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid submission ID.' });
  }

  const submission = await PaymentSubmission.findById(id).populate('appointment');
  if (!submission) {
    return res.status(404).json({ success: false, message: 'Payment submission not found.' });
  }

  // Idempotency
  if (submission.status === 'approved') {
    return res.status(200).json({ success: true, message: 'Already approved.', data: { alreadyProcessed: true } });
  }

  if (submission.status !== 'submitted') {
    return res.status(400).json({
      success: false,
      message: `Cannot approve a submission with status '${submission.status}'.`,
    });
  }

  const appointment = submission.appointment;
  if (!appointment) {
    return res.status(404).json({ success: false, message: 'Associated appointment not found.' });
  }

  // Check if amountClaimed matches feeSnapshot
  const fee = appointment.feeSnapshot;
  const claimed = submission.amountClaimed;
  const force = req.body.force === true || req.body.force === 'true';

  if (claimed !== fee && !force) {
    return res.status(400).json({
      success: false,
      code: 'AMOUNT_MISMATCH',
      message: `Payment amount claimed (₹${claimed}) does not match the consultation fee (₹${fee}). Do you want to approve it anyway?`,
    });
  }

  // Generate join link for online consultations
  let whatsappJoinLink = null;
  if (appointment.consultationType === 'online') {
    whatsappJoinLink = generateJoinWhatsAppLink(
      appointment.patientName,
      appointment._id.toString(),
      formatAppointmentDate(appointment.appointmentDate),
      formatSlotTime(appointment.slotStart)
    );
  }

  // ── Atomic transaction ────────────────────────────────────────────────────
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await PaymentSubmission.findByIdAndUpdate(
        id,
        {
          status:          'approved',
          adminReviewedBy: admin._id,
          adminReviewedAt: new Date(),
        },
        { session, new: true }
      );

      const apptUpdate = {
        status: 'confirmed',
        confirmedAt: new Date(),
      };
      if (whatsappJoinLink) apptUpdate.whatsappJoinLink = whatsappJoinLink;

      await Appointment.findByIdAndUpdate(appointment._id, apptUpdate, {
        session,
        runValidators: true,
        new: true,
      });
    });
  } catch (err) {
    await session.endSession();
    throw err;
  }
  await session.endSession();

  // ── Fire notifications (email + SMS, async) ─────────────────────────────────
  try {
    const { notifyUserPaymentApproved } = require('../../utils/notificationService');
    notifyUserPaymentApproved(appointment, submission, whatsappJoinLink).catch((e) =>
      console.error('[Notify] Approval notification failed:', e.message)
    );
  } catch (e) { console.error('[Notify] notificationService unavailable:', e.message); }

  res.status(200).json({
    success: true,
    message:
      `Appointment confirmed. ${appointment.consultationType === 'online' ? 'WhatsApp join link generated.' : 'Patient can visit the clinic.'}`,
    data: { whatsappJoinLink },
  });
});

// ─── POST /api/v1/admin/payments/:id/reject ───────────────────────────────────
/**
 * Rejects a payment submission.
 * Atomically: marks submission as rejected + appointment as payment_rejected.
 * Reason is required (min 10 chars — validated at route level).
 * Idempotent: re-rejecting an already-rejected submission returns 200.
 */
const rejectPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const admin = req.dbUser;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid submission ID.' });
  }

  const submission = await PaymentSubmission.findById(id).populate('appointment');
  if (!submission) {
    return res.status(404).json({ success: false, message: 'Payment submission not found.' });
  }

  // Idempotency
  if (submission.status === 'rejected') {
    return res.status(200).json({ success: true, message: 'Already rejected.', data: { alreadyProcessed: true } });
  }

  if (submission.status !== 'submitted') {
    return res.status(400).json({
      success: false,
      message: `Cannot reject a submission with status '${submission.status}'.`,
    });
  }

  const appointment = submission.appointment;

  // ── Atomic transaction ────────────────────────────────────────────────────
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Note: using findByIdAndUpdate bypasses pre-save hook.
      // Reason validation is done at the route level (express-validator).
      await PaymentSubmission.findByIdAndUpdate(
        id,
        {
          status:          'rejected',
          rejectionReason: reason.trim(),
          adminReviewedBy: admin._id,
          adminReviewedAt: new Date(),
        },
        { session, new: true }
      );

      if (appointment) {
        await Appointment.findByIdAndUpdate(
          appointment._id,
          { status: 'payment_rejected' },
          { session, runValidators: true }
        );
      }
    });
  } catch (err) {
    await session.endSession();
    throw err;
  }
  await session.endSession();

  // ── Fire notifications (email + SMS, async) ─────────────────────────────────
  try {
    const { notifyUserPaymentRejected } = require('../../utils/notificationService');
    notifyUserPaymentRejected(appointment, submission, reason).catch((e) =>
      console.error('[Notify] Rejection notification failed:', e.message)
    );
  } catch (e) { console.error('[Notify] notificationService unavailable:', e.message); }

  res.status(200).json({
    success: true,
    message: 'Payment rejected. User will be notified.',
  });
});

module.exports = { listPayments, getPayment, approvePayment, rejectPayment };
