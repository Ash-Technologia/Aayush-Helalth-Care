'use strict';

const path = require('path');

// ─── WhatsApp Link Generators ─────────────────────────────────────────────────
// Pure functions. No external dependencies.
// These produce wa.me deep links with pre-filled messages.

const CLINIC_WHATSAPP = process.env.CLINIC_WHATSAPP_NUMBER || '919822843015';

/**
 * Link for the "Send Screenshot" button on the payment page.
 * Pre-fills a message containing patient name, appointment ID, and amount.
 *
 * @param {string} patientName
 * @param {string} appointmentId
 * @param {number} fee
 * @returns {string} wa.me URL
 */
const generateScreenshotWhatsAppLink = (patientName, appointmentId, fee) => {
  const msg = encodeURIComponent(
    `Hello, I have completed the payment for my appointment.\n\n` +
    `Patient Name: ${patientName}\n` +
    `Appointment ID: ${appointmentId}\n` +
    `Amount Paid: ₹${fee}\n\n` +
    `Please find the payment screenshot attached.`
  );
  return `https://wa.me/${CLINIC_WHATSAPP}?text=${msg}`;
};

/**
 * Link for the "Join Consultation" button (online appointments, post-confirm).
 * Pre-fills a message with patient details and appointment time.
 *
 * @param {string} patientName
 * @param {string} appointmentId
 * @param {string} date          - Human-readable date string e.g. "01 June 2026"
 * @param {string} time          - Human-readable time string e.g. "10:30 AM"
 * @returns {string} wa.me URL
 */
const generateJoinWhatsAppLink = (patientName, appointmentId, date, time) => {
  const msg = encodeURIComponent(
    `Hello, I have a confirmed online consultation with Amrut Singhavi.\n\n` +
    `Patient: ${patientName}\n` +
    `Date: ${date}  Time: ${time}\n` +
    `Appointment ID: ${appointmentId}\n\n` +
    `I am ready for my appointment.`
  );
  return `https://wa.me/${CLINIC_WHATSAPP}?text=${msg}`;
};

/**
 * General-purpose WhatsApp contact link.
 * Used in navbar, footer, and contact section.
 *
 * @param {string} [message] - Optional pre-filled message
 * @returns {string} wa.me URL
 */
const generateContactWhatsAppLink = (message) => {
  if (!message) return `https://wa.me/${CLINIC_WHATSAPP}`;
  return `https://wa.me/${CLINIC_WHATSAPP}?text=${encodeURIComponent(message)}`;
};

/**
 * Formats an appointment date as a human-readable string.
 * e.g., "01 June 2026"
 *
 * @param {Date|string} date
 * @returns {string}
 */
const formatAppointmentDate = (date) => {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
};

/**
 * Formats HH:mm slot time as 12-hour AM/PM string.
 * e.g., "09:30" → "9:30 AM"
 *
 * @param {string} time - HH:mm format
 * @returns {string}
 */
const formatSlotTime = (time) => {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours < 12 ? 'AM' : 'PM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`;
};

module.exports = {
  generateScreenshotWhatsAppLink,
  generateJoinWhatsAppLink,
  generateContactWhatsAppLink,
  formatAppointmentDate,
  formatSlotTime,
};
