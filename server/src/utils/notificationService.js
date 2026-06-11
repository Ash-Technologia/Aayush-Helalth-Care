'use strict';

/**
 * Notification Service — Orchestrates email + SMS and logs every attempt
 * to the Notification collection (audit trail).
 *
 * All public functions:
 *  - Never throw (catch all errors internally)
 *  - Return a results object: { email, sms }
 *  - Log each channel attempt to the DB
 *
 * Adding a new notification type:
 *  1. Add a MSG_* template in smsService.js
 *  2. Add an HTML template in emailService.js
 *  3. Create a new function here that calls both + logNotification()
 */

const emailService = require('./emailService');
const smsService   = require('./smsService');

// ─── Logger: saves result to Notification collection ─────────────────────────
/**
 * @param {Object} opts
 * @param {string} opts.userId
 * @param {string} opts.appointmentId
 * @param {string} opts.type           - NOTIFICATION_TYPES value
 * @param {string} opts.channel        - 'email' | 'sms' | 'whatsapp'
 * @param {boolean} opts.success
 * @param {Object} opts.payload        - What was sent (for debugging)
 * @param {string} [opts.errorMessage]
 */
const logNotification = async (opts) => {
  try {
    // Lazy-load to avoid circular deps at startup
    const Notification = require('../models/Notification');
    await Notification.create({
      user:        opts.userId,
      appointment: opts.appointmentId || null,
      type:        opts.type,
      channel:     opts.channel,
      status:      opts.success ? 'sent' : 'failed',
      payload:     opts.payload || {},
      sentAt:      opts.success ? new Date() : null,
      errorMessage: opts.success ? null : (opts.errorMessage || 'Unknown error'),
    });
  } catch (dbErr) {
    // DB logging failure must NOT affect the caller
    console.error('[Notification Log] Failed to save notification record:', dbErr.message);
  }
};

// ─── Helper: fire email + SMS + log ──────────────────────────────────────────
const fireAll = async ({
  userId,
  appointmentId,
  type,
  emailFn,
  smsFn,
  payload,
}) => {
  const results = { email: null, sms: null };

  // Email
  try {
    results.email = await emailFn();
    await logNotification({
      userId, appointmentId, type, channel: 'email',
      success: results.email.success,
      payload,
      errorMessage: results.email.error,
    });
  } catch (err) {
    results.email = { success: false, error: err.message };
    await logNotification({
      userId, appointmentId, type, channel: 'email',
      success: false, payload, errorMessage: err.message,
    });
  }

  // SMS
  try {
    results.sms = await smsFn();
    await logNotification({
      userId, appointmentId, type, channel: 'sms',
      success: results.sms.success,
      payload,
      errorMessage: results.sms.error,
    });
  } catch (err) {
    results.sms = { success: false, error: err.message };
    await logNotification({
      userId, appointmentId, type, channel: 'sms',
      success: false, payload, errorMessage: err.message,
    });
  }

  return results;
};

// ═══════════════════════════════════════════════════════════════
// PUBLIC NOTIFICATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Fired when a user submits their payment screenshot.
 * Notifies the admin via email + SMS.
 */
const notifyAdminNewPayment = async (appointment, submission) => {
  return fireAll({
    userId:        appointment.user,
    appointmentId: appointment._id,
    type:          'payment_submitted',
    emailFn:       () => emailService.notifyAdminNewPayment(appointment, submission),
    smsFn:         () => smsService.smsAdminNewPayment(appointment, submission),
    payload: {
      patientName:    appointment.patientName,
      amountClaimed:  submission.amountClaimed,
      submissionId:   submission._id,
    },
  });
};

/**
 * Fired when admin approves a payment.
 * Notifies the patient via email + SMS.
 */
const notifyUserPaymentApproved = async (appointment, submission, whatsappJoinLink) => {
  return fireAll({
    userId:        appointment.user,
    appointmentId: appointment._id,
    type:          'payment_approved',
    emailFn:       () => emailService.notifyUserPaymentApproved(appointment, submission, whatsappJoinLink),
    smsFn:         () => smsService.smsUserConfirmed(appointment),
    payload: {
      patientEmail:    appointment.patientEmail,
      patientPhone:    appointment.patientPhone,
      whatsappJoinLink: whatsappJoinLink || null,
    },
  });
};

/**
 * Fired when admin rejects a payment.
 * Notifies the patient via email + SMS.
 */
const notifyUserPaymentRejected = async (appointment, submission, reason) => {
  return fireAll({
    userId:        appointment.user,
    appointmentId: appointment._id,
    type:          'payment_rejected',
    emailFn:       () => emailService.notifyUserPaymentRejected(appointment, submission, reason),
    smsFn:         () => smsService.smsUserRejected(appointment),
    payload: { reason, patientEmail: appointment.patientEmail },
  });
};

/**
 * Fired when admin cancels an appointment.
 * Notifies the patient via email + SMS.
 */
const notifyUserAppointmentCancelled = async (appointment) => {
  return fireAll({
    userId:        appointment.user,
    appointmentId: appointment._id,
    type:          'appointment_cancelled',
    emailFn:       () => emailService.notifyUserAppointmentCancelled(appointment),
    smsFn:         () => smsService.smsUserCancelled(appointment),
    payload: { cancellationReason: appointment.cancellationReason },
  });
};

/**
 * Fired when a slot is locked (payment pending).
 * Sends patient an email with QR code (or UPI ID fallback) + SMS.
 */
const notifyUserSlotLocked = async (appointment, profile) => {
  return fireAll({
    userId:        appointment.user,
    appointmentId: appointment._id,
    type:          'slot_locked',
    emailFn:       () => emailService.notifyUserSlotLocked(appointment, profile),
    smsFn:         () => smsService.smsUserSlotLocked(appointment),
    payload: { patientEmail: appointment.patientEmail, patientPhone: appointment.patientPhone },
  });
};

/**
 * Fired when a patient cancels their own appointment.
 * Notifies admin via email + SMS.
 */
const notifyAdminUserCancelled = async (appointment) => {
  return fireAll({
    userId:        appointment.user,
    appointmentId: appointment._id,
    type:          'appointment_cancelled',
    emailFn:       () => emailService.notifyAdminUserCancelled(appointment),
    smsFn:         () => smsService.smsAdminUserCancelled(appointment),
    payload: { patientName: appointment.patientName, cancellationReason: appointment.cancellationReason },
  });
};

/**
 * Fired when a patient reschedules their appointment.
 * Notifies both the patient AND admin (with old slot context).
 */
const notifyRescheduled = async (appointment, oldSlot) => {
  // Notify patient
  const patientResult = await fireAll({
    userId:        appointment.user,
    appointmentId: appointment._id,
    type:          'appointment_rescheduled',
    emailFn:       () => emailService.notifyUserRescheduled(appointment),
    smsFn:         () => smsService.smsUserRescheduled(appointment),
    payload: { patientEmail: appointment.patientEmail, patientPhone: appointment.patientPhone },
  });

  // Notify admin
  await fireAll({
    userId:        appointment.user,
    appointmentId: appointment._id,
    type:          'appointment_rescheduled',
    emailFn:       () => emailService.notifyAdminRescheduled(appointment, oldSlot),
    smsFn:         () => smsService.smsAdminRescheduled(appointment),
    payload: { oldSlot },
  });

  return patientResult;
};

/**
 * Fired when admin marks appointment as Completed.
 * Sends patient a thank-you + review prompt.
 */
const notifyUserCompleted = async (appointment) => {
  return fireAll({
    userId:        appointment.user,
    appointmentId: appointment._id,
    type:          'appointment_completed',
    emailFn:       () => emailService.notifyUserCompleted(appointment),
    smsFn:         () => smsService.smsUserCompleted(appointment),
    payload: { patientEmail: appointment.patientEmail, patientPhone: appointment.patientPhone },
  });
};

/**
 * Fired when admin marks appointment as No-Show.
 * Sends patient a missed-appointment notice.
 */
const notifyUserNoShow = async (appointment) => {
  return fireAll({
    userId:        appointment.user,
    appointmentId: appointment._id,
    type:          'appointment_no_show',
    emailFn:       () => emailService.notifyUserNoShow(appointment),
    smsFn:         () => smsService.smsUserNoShow(appointment),
    payload: { patientEmail: appointment.patientEmail, patientPhone: appointment.patientPhone },
  });
};

/**
 * Fired as a daily cron reminder.
 * Notifies patient via email + SMS.
 */
const notifyUserAppointmentReminder = async (appointment) => {
  return fireAll({
    userId:        appointment.user,
    appointmentId: appointment._id,
    type:          'appointment_reminder',
    emailFn:       () => emailService.notifyUserAppointmentReminder(appointment),
    smsFn:         () => smsService.smsUserReminder(appointment),
    payload: { patientEmail: appointment.patientEmail, patientPhone: appointment.patientPhone },
  });
};

module.exports = {
  notifyAdminNewPayment,
  notifyUserPaymentApproved,
  notifyUserPaymentRejected,
  notifyUserAppointmentCancelled,
  notifyUserAppointmentReminder,
  notifyUserSlotLocked,
  notifyAdminUserCancelled,
  notifyRescheduled,
  notifyUserCompleted,
  notifyUserNoShow,
  logNotification,
};
