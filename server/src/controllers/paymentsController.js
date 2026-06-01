'use strict';

const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const Appointment = require('../models/Appointment');
const PaymentSubmission = require('../models/PaymentSubmission');
const { ensureUploadDir } = require('../middleware/upload');

// ─── POST /api/v1/payments/submit ─────────────────────────────────────────────
/**
 * Accepts a payment screenshot upload from the user.
 * Processes with Sharp, stores in DB via transaction.
 *
 * Validates:
 *   - Appointment exists + belongs to user
 *   - status === 'awaiting_payment'
 *   - lockedUntil > now (lock not expired)
 *   - Screenshot file present
 *   - whatsappSentConfirmed === true
 */
const submitPayment = asyncHandler(async (req, res) => {
  const { appointmentId, upiTransactionId, amountClaimed, whatsappSentConfirmed } = req.body;
  const user = req.dbUser;

  // ── Validate appointmentId ────────────────────────────────────────────────
  if (!appointmentId || !mongoose.Types.ObjectId.isValid(appointmentId)) {
    return res.status(400).json({ success: false, message: 'Valid appointmentId is required.' });
  }

  // ── Validate WhatsApp confirmation ────────────────────────────────────────
  const waConfirmed = whatsappSentConfirmed === true || whatsappSentConfirmed === 'true';
  if (!waConfirmed) {
    return res.status(400).json({
      success: false,
      message: 'You must confirm that you have sent the payment screenshot on WhatsApp.',
    });
  }

  // ── Validate amountClaimed ────────────────────────────────────────────────
  const amount = parseFloat(amountClaimed);
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ success: false, message: 'A valid amount claimed is required.' });
  }

  // ── File check ────────────────────────────────────────────────────────────
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Payment screenshot image is required.' });
  }

  // ── Fetch appointment ─────────────────────────────────────────────────────
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    return res.status(404).json({ success: false, message: 'Appointment not found.' });
  }

  // ── Ownership check ───────────────────────────────────────────────────────
  if (!appointment.user.equals(user._id)) {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }

  // ── Status check ──────────────────────────────────────────────────────────
  if (appointment.status !== 'awaiting_payment') {
    return res.status(400).json({
      success: false,
      message:
        appointment.status === 'pending_approval'
          ? 'Payment has already been submitted and is under review.'
          : `Cannot submit payment for an appointment with status '${appointment.status}'.`,
    });
  }

  // ── Lock expiry check ─────────────────────────────────────────────────────
  if (appointment.lockedUntil && appointment.lockedUntil <= new Date()) {
    // Mark as expired
    appointment.status = 'expired';
    await appointment.save();
    return res.status(410).json({
      success: false,
      message:
        'Your slot reservation has expired. Please go back and book a new appointment.',
      code: 'LOCK_EXPIRED',
    });
  }

  // ── Process image with Sharp ──────────────────────────────────────────────
  const screenshotsDir = ensureUploadDir('payment-screenshots');
  const timestamp = Date.now();
  const filename = `payment_${appointmentId}_${timestamp}.jpg`;
  const filepath = path.join(screenshotsDir, filename);
  const screenshotUrl = `/uploads/payment-screenshots/${filename}`;

  try {
    await sharp(req.file.buffer)
      .resize(1920, 1080, {
        fit: 'inside',          // preserve aspect ratio, never upscale
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toFile(filepath);
  } catch (sharpErr) {
    console.error('[Sharp] Image processing failed:', sharpErr.message);
    return res.status(422).json({
      success: false,
      message: 'Failed to process the uploaded image. Please try a different file.',
    });
  }

  // ── MongoDB Transaction ───────────────────────────────────────────────────
  const session = await mongoose.startSession();
  let submission;

  try {
    await session.withTransaction(async () => {
      // Check if a submission already exists for this appointment (double-submit guard)
      const existing = await PaymentSubmission.findOne(
        { appointment: appointmentId },
        null,
        { session }
      );
      if (existing) {
        const err = new Error('Payment has already been submitted for this appointment.');
        err.statusCode = 409;
        throw err;
      }

      const created = await PaymentSubmission.create(
        [
          {
            user: user._id,
            appointment: appointmentId,
            screenshotUrl,
            screenshotUploadedAt: new Date(),
            upiTransactionId: upiTransactionId ? upiTransactionId.trim() : null,
            amountClaimed: amount,
            whatsappSentConfirmed: true,
            status: 'submitted',
          },
        ],
        { session }
      );
      submission = created[0];

      await Appointment.findByIdAndUpdate(
        appointmentId,
        {
          status: 'pending_approval',
          paymentSubmission: submission._id,
          lockedUntil: null, // Clear lock; pending_approval holds the slot
        },
        { session, runValidators: true, new: true }
      );
    });
  } catch (err) {
    await session.endSession();
    // Clean up the uploaded file if the transaction failed
    try { fs.unlinkSync(filepath); } catch { /* ignore */ }
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    throw err;
  }

  await session.endSession();

  // ── Fire admin notification (email + SMS, async) ──────────────────────────
  try {
    const { notifyAdminNewPayment } = require('../utils/notificationService');
    notifyAdminNewPayment(appointment, submission).catch((e) =>
      console.error('[Notify] Admin payment notification failed:', e.message)
    );
  } catch (e) { console.error('[Notify] notificationService unavailable:', e.message); }

  res.status(201).json({
    success: true,
    message:
      'Payment proof submitted successfully. Your appointment is reserved and under review. ' +
      'You will receive a confirmation SMS and email within 2–4 hours.',
    data: {
      submissionId: submission._id,
      appointmentId,
      status: 'pending_approval',
    },
  });
});

// ─── GET /api/v1/payments/status/:appointmentId ───────────────────────────────
/**
 * Returns the payment submission status for an appointment.
 * User can check the review status from their "pending" page.
 */
const getPaymentStatus = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
    return res.status(400).json({ success: false, message: 'Invalid appointment ID.' });
  }

  const appointment = await Appointment.findById(appointmentId)
    .populate('paymentSubmission', 'status rejectionReason screenshotUploadedAt amountClaimed')
    .lean();

  if (!appointment) {
    return res.status(404).json({ success: false, message: 'Appointment not found.' });
  }

  if (!appointment.user.equals(req.dbUser._id)) {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }

  res.status(200).json({
    success: true,
    data: {
      appointmentId,
      appointmentStatus: appointment.status,
      paymentSubmission: appointment.paymentSubmission || null,
    },
  });
});

module.exports = { submitPayment, getPaymentStatus };
