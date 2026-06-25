'use strict';

const axios = require('axios');

// ─── Clinic constants (never hardcode — read from env at runtime) ──────────────
const CLINIC_NAME  = () => process.env.CLINIC_NAME  || 'Aayush Health Care';
const CLINIC_PHONE = () => process.env.CLINIC_PHONE || '';

const API_KEY = () => process.env.FAST2SMS_API_KEY;

// ═══════════════════════════════════════════════════════════════
// SMS MESSAGE TEMPLATES
// Keep each message under 160 characters for single-SMS delivery.
// Use CLINIC_PHONE() — never hardcode the phone number here.
// ═══════════════════════════════════════════════════════════════

/**
 * Appointment confirmed — sent to patient after admin approves payment.
 */
const MSG_CONFIRMED = (name, date, time, type) =>
  `Dear ${name}, your appointment at ${CLINIC_NAME()} is CONFIRMED for ${date} at ${time} (${type}). We look forward to seeing you. Please keep this message for reference.`;

/**
 * Payment rejected — sent to patient when admin cannot verify payment.
 */
const MSG_REJECTED = (name) =>
  `Dear ${name}, we were unable to verify your payment at ${CLINIC_NAME()}. Please rebook and upload a clear payment screenshot. We are here to help — contact us at ${CLINIC_PHONE()}.`;

/**
 * Admin alert: new payment received and pending review.
 */
const MSG_ADMIN_NEW_PAYMENT = (patientName, amount) =>
  `[${CLINIC_NAME()}] New payment of Rs.${amount} from ${patientName} is awaiting verification. Please review it in the admin panel at your earliest convenience.`;

/**
 * 24-hour appointment reminder — sent to patient one day before.
 */
const MSG_REMINDER = (name, time, type) =>
  `Dear ${name}, a friendly reminder of your ${type} appointment at ${CLINIC_NAME()} tomorrow at ${time}. Please be ready on time. We look forward to assisting you.`;

/**
 * Appointment cancelled by admin — sent to patient.
 */
const MSG_CANCELLED = (name, date) =>
  `Dear ${name}, your appointment at ${CLINIC_NAME()} on ${date} has been cancelled. We apologise for any inconvenience. For assistance, please contact us at ${CLINIC_PHONE()}.`;

/**
 * Slot locked — payment pending — sent to patient after booking.
 */
const MSG_SLOT_LOCKED = (name, date, time, fee) =>
  `Dear ${name}, your slot at ${CLINIC_NAME()} on ${date} at ${time} is reserved. Please pay Rs.${fee} and upload your screenshot to confirm. Slot expires in 30 minutes.`;

/**
 * Admin alert: patient self-cancelled their appointment.
 */
const MSG_ADMIN_USER_CANCELLED = (patientName, date) =>
  `[${CLINIC_NAME()}] ${patientName} has cancelled their appointment on ${date}. The slot is now available.`;

/**
 * Appointment rescheduled — sent to patient.
 */
const MSG_RESCHEDULED = (name, date, time) =>
  `Dear ${name}, your appointment at ${CLINIC_NAME()} has been rescheduled to ${date} at ${time}. Please contact us if you have any questions.`;

/**
 * Admin alert: patient rescheduled their appointment.
 */
const MSG_ADMIN_RESCHEDULED = (patientName, newDate, newTime) =>
  `[${CLINIC_NAME()}] ${patientName} has rescheduled their appointment to ${newDate} at ${newTime}. Please review in the admin panel.`;

/**
 * Appointment completed — review prompt sent to patient.
 */
const MSG_COMPLETED = (name) =>
  `Dear ${name}, thank you for visiting ${CLINIC_NAME()}. We hope you are feeling better. Your feedback means a great deal to us — we would love to hear from you.`;

/**
 * Patient marked as no-show — gentle notice sent to patient.
 */
const MSG_NO_SHOW = (name, date) =>
  `Dear ${name}, we noticed you could not make your appointment at ${CLINIC_NAME()} on ${date}. We hope all is well. Please contact us at ${CLINIC_PHONE()} to reschedule.`;

// ─── Core send function ───────────────────────────────────────────────────────
/**
 * Sends a transactional SMS via Fast2SMS.
 * Returns { success: boolean, response?, error? }.
 *
 * Never throws — all errors are caught and returned.
 *
 * @param {string} phone   - 10-digit Indian phone (no country code)
 * @param {string} message - Plain text message body
 */
const sendSms = async (phone, message) => {
  const apiKey = API_KEY();

  if (!apiKey || apiKey.startsWith('REPLACE_')) {
    // Dev mode — print to console
    console.log(`[SMS DEV] To: +91 ${phone}`);
    console.log(`[SMS DEV] Message: ${message}\n`);
    return { success: true, dev: true };
  }

  try {
    const response = await axios.get('https://www.fast2sms.com/dev/bulkV2', {
      params: {
        authorization: apiKey,
        message,
        language:  'english',
        route:     'q',          // Quick/transactional route — use 'dlt' for DLT-registered templates
        numbers:   phone,
      },
      timeout: 10_000,
    });

    if (response.data && response.data.return === true) {
      return { success: true, response: response.data };
    }

    console.error('[SMS] Fast2SMS error response:', response.data);
    return { success: false, error: JSON.stringify(response.data) };
  } catch (err) {
    console.error('[SMS] Request failed:', err.message);
    return { success: false, error: err.message };
  }
};

// ─── Notification SMS sender functions ───────────────────────────────────────

const smsUserConfirmed = async (appointment) => {
  if (!appointment.patientPhone) return { success: false, reason: 'No phone' };
  const date = new Date(appointment.appointmentDate).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short',
  });
  return sendSms(
    appointment.patientPhone,
    MSG_CONFIRMED(
      appointment.patientName.split(' ')[0],
      date,
      appointment.slotStart,
      appointment.consultationType === 'online' ? 'Online' : 'In-Clinic'
    )
  );
};

const smsUserRejected = async (appointment) => {
  if (!appointment.patientPhone) return { success: false, reason: 'No phone' };
  return sendSms(
    appointment.patientPhone,
    MSG_REJECTED(appointment.patientName.split(' ')[0])
  );
};

const smsAdminNewPayment = async (appointment, submission) => {
  const adminPhone = process.env.ADMIN_PHONE;
  if (!adminPhone) return { success: false, reason: 'ADMIN_PHONE not configured' };
  return sendSms(
    adminPhone,
    MSG_ADMIN_NEW_PAYMENT(appointment.patientName, submission.amountClaimed)
  );
};

const smsUserReminder = async (appointment) => {
  if (!appointment.patientPhone) return { success: false, reason: 'No phone' };
  return sendSms(
    appointment.patientPhone,
    MSG_REMINDER(
      appointment.patientName.split(' ')[0],
      appointment.slotStart,
      appointment.consultationType === 'online' ? 'online' : 'in-clinic'
    )
  );
};

const smsUserCancelled = async (appointment) => {
  if (!appointment.patientPhone) return { success: false, reason: 'No phone' };
  const date = new Date(appointment.appointmentDate).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short',
  });
  return sendSms(
    appointment.patientPhone,
    MSG_CANCELLED(appointment.patientName.split(' ')[0], date)
  );
};

const smsUserSlotLocked = async (appointment) => {
  if (!appointment.patientPhone) return { success: false, reason: 'No phone' };
  const date = new Date(appointment.appointmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  return sendSms(
    appointment.patientPhone,
    MSG_SLOT_LOCKED(
      appointment.patientName.split(' ')[0],
      date,
      appointment.slotStart,
      appointment.feeSnapshot          // always comes from DB — no fallback
    )
  );
};

const smsAdminUserCancelled = async (appointment) => {
  const adminPhone = process.env.ADMIN_PHONE;
  if (!adminPhone) return { success: false, reason: 'ADMIN_PHONE not configured' };
  const date = new Date(appointment.appointmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  return sendSms(adminPhone, MSG_ADMIN_USER_CANCELLED(appointment.patientName, date));
};

const smsUserRescheduled = async (appointment) => {
  if (!appointment.patientPhone) return { success: false, reason: 'No phone' };
  const date = new Date(appointment.appointmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  return sendSms(
    appointment.patientPhone,
    MSG_RESCHEDULED(appointment.patientName.split(' ')[0], date, appointment.slotStart)
  );
};

const smsAdminRescheduled = async (appointment) => {
  const adminPhone = process.env.ADMIN_PHONE;
  if (!adminPhone) return { success: false, reason: 'ADMIN_PHONE not configured' };
  const date = new Date(appointment.appointmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  return sendSms(adminPhone, MSG_ADMIN_RESCHEDULED(appointment.patientName, date, appointment.slotStart));
};

const smsUserCompleted = async (appointment) => {
  if (!appointment.patientPhone) return { success: false, reason: 'No phone' };
  return sendSms(
    appointment.patientPhone,
    MSG_COMPLETED(appointment.patientName.split(' ')[0])
  );
};

const smsUserNoShow = async (appointment) => {
  if (!appointment.patientPhone) return { success: false, reason: 'No phone' };
  const date = new Date(appointment.appointmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  return sendSms(
    appointment.patientPhone,
    MSG_NO_SHOW(appointment.patientName.split(' ')[0], date)
  );
};

module.exports = {
  sendSms,
  smsUserConfirmed,
  smsUserRejected,
  smsAdminNewPayment,
  smsUserReminder,
  smsUserCancelled,
  smsUserSlotLocked,
  smsAdminUserCancelled,
  smsUserRescheduled,
  smsAdminRescheduled,
  smsUserCompleted,
  smsUserNoShow,
};
