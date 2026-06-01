'use strict';

const axios = require('axios');

const API_KEY = () => process.env.FAST2SMS_API_KEY;

// ─── Message Templates ────────────────────────────────────────────────────────
// DLT-registered template bodies for transactional route.
// In production, replace {variables} with actual DLT template IDs.

/**
 * Appointment confirmed SMS.
 * Max 160 chars for single SMS, keep concise.
 */
const MSG_CONFIRMED = (name, date, time, type) =>
  `Hi ${name}, your Aayush Health Care appointment is CONFIRMED for ${date} at ${time} (${type}). Carry this msg as reference. -Amrut Singhavi`;

/**
 * Payment rejected SMS.
 */
const MSG_REJECTED = (name) =>
  `Hi ${name}, your payment for Aayush Health Care could not be verified. Please rebook & upload a clear payment screenshot. Call: +91 98228 43015`;

/**
 * Admin alert: new payment received.
 */
const MSG_ADMIN_NEW_PAYMENT = (patientName, amount) =>
  `[Admin] New payment of Rs.${amount} from ${patientName} is pending verification. Please review in the admin panel.`;

/**
 * Appointment reminder.
 */
const MSG_REMINDER = (name, time, type) =>
  `Reminder: Hi ${name}, your Aayush Health Care ${type} appointment is tomorrow at ${time}. -Amrut Singhavi`;

/**
 * Appointment cancelled.
 */
const MSG_CANCELLED = (name, date) =>
  `Hi ${name}, your Aayush Health Care appointment on ${date} has been cancelled. For queries call +91 98228 43015.`;

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
        route:     'q',          // Quick/transactional route — use 'dlt' for DLT
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

// ─── Notification SMS functions ───────────────────────────────────────────────

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
      appointment.consultationType === 'online' ? 'online' : 'clinic'
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

module.exports = {
  sendSms,
  smsUserConfirmed,
  smsUserRejected,
  smsAdminNewPayment,
  smsUserReminder,
  smsUserCancelled,
};
