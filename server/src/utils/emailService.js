'use strict';

const nodemailer = require('nodemailer');

// ─── Transporter ──────────────────────────────────────────────────────────────
// Lazy-init: only create transporter once (singleton pattern).
let _transporter = null;

const getTransporter = () => {
  if (_transporter) return _transporter;

  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    EMAIL_HOST,
    EMAIL_PORT,
    EMAIL_USER,
    EMAIL_PASS,
    EMAIL_SECURE
  } = process.env;

  const host = SMTP_HOST || EMAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(SMTP_PORT || EMAIL_PORT || '587', 10);
  const user = SMTP_USER || EMAIL_USER;
  const pass = SMTP_PASS || EMAIL_PASS;

  // Dev mode: use console fallback
  if (!user || user.startsWith('REPLACE_')) {
    console.log('[Email] Not configured — using console fallback (dev mode).');
    return null;
  }

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: EMAIL_SECURE === 'true' || port === 465,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  });

  return _transporter;
};

// ─── Clinic constants (all from env — nothing hardcoded) ──────────────────────
const CLINIC_NAME    = () => process.env.CLINIC_NAME    || 'Aayush Health Care';
const CLINIC_TAGLINE = () => process.env.CLINIC_TAGLINE || 'Acupressure & Neurotherapy Specialist';
const CLINIC_PHONE   = () => process.env.CLINIC_PHONE   || '';
const CLINIC_EMAIL   = () => process.env.SMTP_FROM || process.env.SMTP_USER || process.env.EMAIL_FROM || '';
const CLINIC_ADDRESS = () => process.env.CLINIC_ADDRESS || '';
const CLINIC_COLOR   = '#0d9488'; // teal brand colour
const FRONTEND_URL   = () => process.env.PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL || '';
const BACKEND_URL    = () => process.env.BACKEND_URL || '';

// ─── Shared layout helpers ────────────────────────────────────────────────────

const wrapHtml = (title, bodyHtml) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0d9488 0%,#059669 100%);padding:32px 36px;text-align:center;">
            <p style="margin:0;font-size:11px;font-weight:700;color:rgba(255,255,255,0.7);letter-spacing:3px;text-transform:uppercase;">Healthcare Consultancy</p>
            <p style="margin:8px 0 4px;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">${CLINIC_NAME()}</p>
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.82);font-style:italic;">${CLINIC_TAGLINE()}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 36px 28px;">
            ${bodyHtml}
          </td>
        </tr>

        <!-- Divider -->
        <tr>
          <td style="padding:0 36px;">
            <div style="height:1px;background:linear-gradient(90deg,transparent,#e2e8f0,transparent);"></div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:24px 36px;border-radius:0 0 16px 16px;text-align:center;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#374151;">${CLINIC_NAME()}</p>
            ${CLINIC_PHONE() ? `<p style="margin:0 0 2px;font-size:12px;color:#6b7280;">📞 ${CLINIC_PHONE()}</p>` : ''}
            ${CLINIC_EMAIL() ? `<p style="margin:0 0 8px;font-size:12px;color:#6b7280;">✉️ <a href="mailto:${CLINIC_EMAIL()}" style="color:${CLINIC_COLOR};text-decoration:none;">${CLINIC_EMAIL()}</a></p>` : ''}
            <p style="margin:10px 0 0;font-size:11px;color:#9ca3af;line-height:1.6;">
              This is an automated notification from ${CLINIC_NAME()}.<br>
              Please do not reply directly to this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

const btn = (text, href) =>
  `<a href="${href}" style="display:inline-block;background:linear-gradient(135deg,#0d9488,#059669);color:#ffffff;padding:13px 30px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.2px;margin:8px 0;">${text}</a>`;

const infoRow = (label, value) =>
  `<tr>
     <td style="padding:9px 14px;font-size:13px;color:#6b7280;width:165px;border-bottom:1px solid #f1f5f9;vertical-align:top;">${label}</td>
     <td style="padding:9px 14px;font-size:13px;color:#111827;font-weight:600;border-bottom:1px solid #f1f5f9;">${value}</td>
   </tr>`;

const alertBox = (color, borderColor, text) =>
  `<div style="background:${color};border-left:4px solid ${borderColor};padding:16px 18px;border-radius:0 10px 10px 0;margin:20px 0;">
     <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.6;">${text}</p>
   </div>`;

const sectionHeading = (emoji, text) =>
  `<h2 style="margin:0 0 6px;font-size:21px;font-weight:800;color:#0f172a;letter-spacing:-0.3px;">${emoji} ${text}</h2>`;

const subText = (text) =>
  `<p style="margin:0 0 22px;font-size:14px;color:#64748b;line-height:1.7;">${text}</p>`;

const detailTable = (rows) =>
  `<table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:24px;background:#f8fafc;">
     <tbody>${rows}</tbody>
   </table>`;

// ─── Core send function ───────────────────────────────────────────────────────
/**
 * Sends an email. In dev mode (no transporter) prints to console.
 * Never throws — always returns { success, messageId?, error? }.
 */
const sendEmail = async ({ to, subject, html }) => {
  const transporter = getTransporter();

  if (!transporter) {
    console.log(`\n[Email DEV] To: ${to}`);
    console.log(`[Email DEV] Subject: ${subject}`);
    console.log(`[Email DEV] Body: (HTML email — see template)\n`);
    return { success: true, dev: true };
  }

  try {
    const info = await transporter.sendMail({
      from:    `"${CLINIC_NAME()}" <${CLINIC_EMAIL()}>`,
      to,
      subject,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Email] Failed to send to ${to}:`, err.message);
    return { success: false, error: err.message };
  }
};

// ═══════════════════════════════════════════════════════════════
// EMAIL TEMPLATES
// All clinic details come from env vars — nothing is hardcoded.
// ═══════════════════════════════════════════════════════════════

// ─── 1. Admin: New payment screenshot submitted ───────────────────────────────
const notifyAdminNewPayment = async (appointment, submission) => {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return { success: false, reason: 'ADMIN_EMAIL not configured' };

  const html = wrapHtml('New Payment Received', `
    ${sectionHeading('💳', 'New Payment Awaiting Approval')}
    ${subText(`A patient has submitted their payment screenshot and is awaiting your verification. Please review at your earliest convenience.`)}

    ${detailTable(`
      ${infoRow('Patient Name', appointment.patientName)}
      ${infoRow('Phone', appointment.patientPhone || '—')}
      ${infoRow('Date', new Date(appointment.appointmentDate).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }))}
      ${infoRow('Time Slot', `${appointment.slotStart} – ${appointment.slotEnd}`)}
      ${infoRow('Consultation', appointment.consultationType === 'online' ? '🎥 Online' : '🏥 In-Clinic')}
      ${infoRow('Consultation Fee', `₹${appointment.feeSnapshot}`)}
      ${infoRow('Amount Claimed', `₹${submission.amountClaimed}`)}
      ${infoRow('WhatsApp Sent', submission.whatsappSentConfirmed ? '✅ Yes' : '❌ No')}
      ${submission.upiTransactionId ? infoRow('UPI Reference', submission.upiTransactionId) : ''}
    `)}

    <div style="text-align:center;margin-top:28px;">
      ${btn('Review &amp; Approve Payment →', `${FRONTEND_URL()}/admin/payments`)}
    </div>
  `);

  return sendEmail({
    to: adminEmail,
    subject: `[Action Required] New Payment from ${appointment.patientName} — ₹${submission.amountClaimed}`,
    html,
  });
};

// ─── 2. User: Payment approved → appointment confirmed ────────────────────────
const notifyUserPaymentApproved = async (appointment, submission, whatsappJoinLink) => {
  if (!appointment.patientEmail) return { success: false, reason: 'No patient email' };

  const isOnline = appointment.consultationType === 'online';
  const firstName = appointment.patientName.split(' ')[0];
  const dateStr = new Date(appointment.appointmentDate).toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

  const html = wrapHtml('Appointment Confirmed', `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:72px;height:72px;background:linear-gradient(135deg,#d1fae5,#a7f3d0);border-radius:50%;font-size:32px;">✅</div>
    </div>
    ${sectionHeading('', 'Your Appointment is Confirmed!')}
    ${subText(`Dear ${firstName}, we are delighted to inform you that your payment has been successfully verified and your appointment is officially confirmed. We look forward to seeing you.`)}

    ${detailTable(`
      ${infoRow('Date', dateStr)}
      ${infoRow('Time Slot', `${appointment.slotStart} – ${appointment.slotEnd}`)}
      ${infoRow('Consultation', isOnline ? '🎥 Online Consultation' : '🏥 In-Clinic Visit')}
      ${infoRow('Patient Name', appointment.patientName)}
      ${infoRow('Amount Paid', `₹${appointment.feeSnapshot}`)}
    `)}

    ${isOnline && whatsappJoinLink ? `
      ${alertBox('#f0fdf4', '#10b981', '📱 <strong>Online Consultation:</strong> At your appointment time, click the button below to join your consultation on WhatsApp.')}
      <div style="text-align:center;margin:24px 0;">
        ${btn('Join Consultation on WhatsApp', whatsappJoinLink)}
      </div>
    ` : `
      ${alertBox('#f0f9ff', '#3b82f6', `📍 <strong>In-Clinic Visit:</strong> We kindly request you to arrive <strong>10 minutes before</strong> your scheduled time. Please bring any previous medical reports or prescriptions.${CLINIC_ADDRESS() ? `<br><br>📌 <strong>Clinic Address:</strong> ${CLINIC_ADDRESS()}` : ''}`)}
    `}

    <p style="font-size:13px;color:#94a3b8;margin-top:24px;text-align:center;line-height:1.6;">
      If you have any questions, please do not hesitate to contact us${CLINIC_PHONE() ? ` at <strong style="color:#0f172a;">${CLINIC_PHONE()}</strong>` : ''}.
    </p>
  `);

  return sendEmail({
    to: appointment.patientEmail,
    subject: `✅ Appointment Confirmed — ${new Date(appointment.appointmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} at ${appointment.slotStart} | ${CLINIC_NAME()}`,
    html,
  });
};

// ─── 3. User: Payment rejected ────────────────────────────────────────────────
const notifyUserPaymentRejected = async (appointment, submission, reason) => {
  if (!appointment.patientEmail) return { success: false, reason: 'No patient email' };

  const firstName = appointment.patientName.split(' ')[0];

  const html = wrapHtml('Payment Verification Unsuccessful', `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:72px;height:72px;background:linear-gradient(135deg,#fee2e2,#fecaca);border-radius:50%;font-size:32px;">⚠️</div>
    </div>
    ${sectionHeading('', 'Payment Could Not Be Verified')}
    ${subText(`Dear ${firstName}, we regret to inform you that we were unable to verify your payment for the appointment on <strong>${new Date(appointment.appointmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long' })}</strong> at <strong>${appointment.slotStart}</strong>.`)}

    ${alertBox('#fef2f2', '#ef4444', `<strong>Reason for Non-Verification:</strong><br>${reason}`)}

    <p style="font-size:14px;color:#475569;line-height:1.8;margin:20px 0;">
      To complete your booking, we kindly request you to rebook your appointment and ensure the following:
    </p>
    <ul style="font-size:14px;color:#475569;line-height:2;padding-left:20px;margin:0 0 24px;">
      <li>Upload a clear, complete screenshot of the payment confirmation</li>
      <li>Send the screenshot on WhatsApp as instructed on the booking page</li>
      <li>Ensure the payment amount exactly matches the consultation fee</li>
    </ul>

    <div style="text-align:center;margin:24px 0;">
      ${btn('Book a New Appointment', `${FRONTEND_URL()}/book`)}
    </div>

    <p style="font-size:13px;color:#94a3b8;margin-top:20px;text-align:center;line-height:1.6;">
      If you believe this is an error or need assistance, please contact us${CLINIC_PHONE() ? ` at <strong style="color:#0f172a;">${CLINIC_PHONE()}</strong>` : ''}. We are happy to help.
    </p>
  `);

  return sendEmail({
    to: appointment.patientEmail,
    subject: `Payment Verification Unsuccessful — Please Rebook | ${CLINIC_NAME()}`,
    html,
  });
};

// ─── 4. User: Appointment cancelled (by admin) ────────────────────────────────
const notifyUserAppointmentCancelled = async (appointment) => {
  if (!appointment.patientEmail) return { success: false, reason: 'No patient email' };

  const firstName = appointment.patientName.split(' ')[0];

  const html = wrapHtml('Appointment Cancelled', `
    ${sectionHeading('📋', 'Appointment Cancellation Notice')}
    ${subText(`Dear ${firstName}, we regret to inform you that your appointment on <strong>${new Date(appointment.appointmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</strong> at <strong>${appointment.slotStart}</strong> has been cancelled by our team.`)}

    ${appointment.cancellationReason ? alertBox('#fefce8', '#f59e0b', `<strong>Reason for Cancellation:</strong> ${appointment.cancellationReason}`) : ''}

    <p style="font-size:14px;color:#475569;line-height:1.8;margin:20px 0;">
      We sincerely apologise for any inconvenience this may have caused. If you have already made a payment, please contact us and we will process your refund at the earliest.
    </p>

    <div style="text-align:center;margin:24px 0;">
      ${btn('Book a New Appointment', `${FRONTEND_URL()}/book`)}
    </div>

    <p style="font-size:13px;color:#94a3b8;margin-top:20px;text-align:center;line-height:1.6;">
      For refunds or queries, please reach us${CLINIC_PHONE() ? ` at <strong style="color:#0f172a;">${CLINIC_PHONE()}</strong>` : ''}.
    </p>
  `);

  return sendEmail({
    to: appointment.patientEmail,
    subject: `Appointment Cancelled — ${new Date(appointment.appointmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} | ${CLINIC_NAME()}`,
    html,
  });
};

// ─── 5. User: 24-hour appointment reminder ────────────────────────────────────
const notifyUserAppointmentReminder = async (appointment) => {
  if (!appointment.patientEmail) return { success: false, reason: 'No patient email' };
  const isOnline = appointment.consultationType === 'online';
  const firstName = appointment.patientName.split(' ')[0];

  const html = wrapHtml('Appointment Reminder — Tomorrow', `
    ${sectionHeading('📅', 'Appointment Reminder')}
    ${subText(`Dear ${firstName}, this is a friendly reminder that your appointment is scheduled for <strong>tomorrow</strong>. We look forward to attending to you.`)}

    ${detailTable(`
      ${infoRow('Date', new Date(appointment.appointmentDate).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' }))}
      ${infoRow('Time Slot', `${appointment.slotStart} – ${appointment.slotEnd}`)}
      ${infoRow('Consultation', isOnline ? '🎥 Online Consultation' : '🏥 In-Clinic Visit')}
    `)}

    ${isOnline && appointment.whatsappJoinLink ? `
      ${alertBox('#f0fdf4', '#10b981', '📱 <strong>Join Online:</strong> At your appointment time, click the button below to connect on WhatsApp.')}
      <div style="text-align:center;margin:24px 0;">
        ${btn('Join Consultation on WhatsApp', appointment.whatsappJoinLink)}
      </div>
    ` : `
      ${alertBox('#f0f9ff', '#3b82f6', `📍 <strong>In-Clinic Reminder:</strong> Please arrive <strong>10 minutes early</strong>. Kindly bring any previous reports, prescriptions, or medical records that may be relevant to your consultation.`)}
    `}

    <p style="font-size:13px;color:#94a3b8;margin-top:20px;text-align:center;line-height:1.6;">
      If you need to reschedule or have any questions, please contact us${CLINIC_PHONE() ? ` at <strong style="color:#0f172a;">${CLINIC_PHONE()}</strong>` : ''}.
    </p>
  `);

  return sendEmail({
    to: appointment.patientEmail,
    subject: `📅 Reminder: Your Appointment Tomorrow at ${appointment.slotStart} | ${CLINIC_NAME()}`,
    html,
  });
};

// ─── 6. User: Slot locked — payment pending ──────────────────────────────────
const notifyUserSlotLocked = async (appointment, profile) => {
  if (!appointment.patientEmail) return { success: false, reason: 'No patient email' };

  const firstName = appointment.patientName.split(' ')[0];
  const dateStr = new Date(appointment.appointmentDate).toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

  // Fee comes strictly from the appointment record — never fallback to a hardcoded value
  const fee   = appointment.feeSnapshot;
  const upiId = profile?.payment?.upiId || null;
  const qrUrl = profile?.payment?.qrImageUrl
    ? `${BACKEND_URL()}${profile.payment.qrImageUrl}`
    : null;

  const html = wrapHtml('Complete Your Payment', `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:72px;height:72px;background:linear-gradient(135deg,#d1fae5,#a7f3d0);border-radius:50%;font-size:32px;">🎉</div>
    </div>
    ${sectionHeading('', 'Your Slot is Reserved!')}
    ${subText(`Dear ${firstName}, congratulations! Your appointment slot has been successfully reserved. Please complete the payment within <strong>30 minutes</strong> to confirm your booking.`)}

    ${detailTable(`
      ${infoRow('Patient Name', appointment.patientName)}
      ${infoRow('Date', dateStr)}
      ${infoRow('Time Slot', `${appointment.slotStart} – ${appointment.slotEnd}`)}
      ${infoRow('Consultation', appointment.consultationType === 'online' ? '🎥 Online Consultation' : '🏥 In-Clinic Visit')}
      ${fee ? infoRow('Amount to Pay', `₹${fee}`) : ''}
    `)}

    <p style="font-size:14px;font-weight:700;color:#0f172a;margin:20px 0 10px;">How to Complete Payment</p>

    ${qrUrl ? `
      <p style="font-size:14px;color:#475569;margin:0 0 12px;">Scan the QR code below using any UPI app${fee ? ` to pay ₹${fee}` : ''}:</p>
      <div style="text-align:center;margin:16px 0 24px;">
        <img src="${qrUrl}" alt="UPI QR Code" style="max-width:180px;border-radius:12px;border:1px solid #e2e8f0;box-shadow:0 2px 8px rgba(0,0,0,0.06);" />
      </div>
    ` : upiId ? `
      <p style="font-size:14px;color:#475569;margin:0 0 8px;">Pay via any UPI app (GPay, PhonePe, Paytm, etc.):</p>
      ${alertBox('#f0fdf4', '#10b981', `💳 <strong>UPI ID:</strong> ${upiId}${fee ? `<br>💰 <strong>Amount:</strong> ₹${fee}` : ''}`)}
    ` : `
      <p style="font-size:14px;color:#475569;margin:0 0 8px;">Please pay via UPI and upload your payment screenshot to confirm your booking.</p>
    `}

    <p style="font-size:14px;color:#475569;margin:12px 0 20px;line-height:1.7;">
      After making the payment, please upload your payment screenshot on the website to confirm your appointment.
    </p>

    <div style="text-align:center;margin-bottom:20px;">
      ${btn('Upload Payment Screenshot →', `${FRONTEND_URL()}/appointments`)}
    </div>

    ${alertBox('#fef2f2', '#f87171', '⏳ <strong>Important:</strong> Your reserved slot will be automatically released if the payment screenshot is not uploaded within <strong>30 minutes</strong>.')}
  `);

  return sendEmail({
    to: appointment.patientEmail,
    subject: `Complete Payment to Confirm Your Appointment${fee ? ` — ₹${fee}` : ''} | ${CLINIC_NAME()}`,
    html,
  });
};

// ─── 7. Admin: User cancelled their own appointment ────────────────────────────
const notifyAdminUserCancelled = async (appointment) => {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return { success: false, reason: 'ADMIN_EMAIL not configured' };

  const html = wrapHtml('Patient Cancelled Appointment', `
    ${sectionHeading('🔔', 'Patient Cancelled Their Appointment')}
    ${subText(`A patient has cancelled their appointment. The time slot is now available for new bookings.`)}

    ${detailTable(`
      ${infoRow('Patient Name', appointment.patientName)}
      ${infoRow('Phone', appointment.patientPhone || '—')}
      ${infoRow('Date', new Date(appointment.appointmentDate).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }))}
      ${infoRow('Time Slot', `${appointment.slotStart} – ${appointment.slotEnd}`)}
      ${infoRow('Consultation', appointment.consultationType === 'online' ? '🎥 Online' : '🏥 In-Clinic')}
      ${appointment.cancellationReason ? infoRow('Reason Given', appointment.cancellationReason) : ''}
    `)}
  `);

  return sendEmail({
    to: adminEmail,
    subject: `[Cancellation] ${appointment.patientName} cancelled their appointment | ${CLINIC_NAME()}`,
    html,
  });
};

// ─── 8. User: Appointment rescheduled ─────────────────────────────────────────
const notifyUserRescheduled = async (appointment) => {
  if (!appointment.patientEmail) return { success: false, reason: 'No patient email' };

  const firstName = appointment.patientName.split(' ')[0];
  const dateStr = new Date(appointment.appointmentDate).toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

  const html = wrapHtml('Appointment Rescheduled', `
    ${sectionHeading('🔄', 'Your Appointment Has Been Rescheduled')}
    ${subText(`Dear ${firstName}, your appointment has been successfully moved to the new slot shown below. If this change does not work for you, please contact us and we will be happy to assist.`)}

    ${detailTable(`
      ${infoRow('New Date', dateStr)}
      ${infoRow('New Time Slot', `${appointment.slotStart} – ${appointment.slotEnd}`)}
      ${infoRow('Consultation', appointment.consultationType === 'online' ? '🎥 Online Consultation' : '🏥 In-Clinic Visit')}
      ${infoRow('Patient Name', appointment.patientName)}
    `)}

    <p style="font-size:13px;color:#94a3b8;margin-top:20px;text-align:center;line-height:1.6;">
      For any queries, please contact us${CLINIC_PHONE() ? ` at <strong style="color:#0f172a;">${CLINIC_PHONE()}</strong>` : ''}.
    </p>
  `);

  return sendEmail({
    to: appointment.patientEmail,
    subject: `Appointment Rescheduled — ${dateStr} at ${appointment.slotStart} | ${CLINIC_NAME()}`,
    html,
  });
};

// ─── 9. Admin: Appointment rescheduled (with old slot info) ───────────────────
const notifyAdminRescheduled = async (appointment, oldSlot) => {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return { success: false, reason: 'ADMIN_EMAIL not configured' };

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  const html = wrapHtml('Appointment Rescheduled by Patient', `
    ${sectionHeading('🔄', 'Patient Rescheduled Their Appointment')}
    ${subText(`${appointment.patientName} has rescheduled their appointment. Details of the old and new slots are shown below.`)}

    <p style="font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;">Previous Slot</p>
    ${detailTable(`
      ${infoRow('Date', oldSlot?.oldDate ? fmtDate(oldSlot.oldDate) : '—')}
      ${infoRow('Time Slot', oldSlot?.oldSlotStart ? `${oldSlot.oldSlotStart} – ${oldSlot.oldSlotEnd}` : '—')}
    `)}

    <p style="font-size:12px;font-weight:700;color:#065f46;text-transform:uppercase;letter-spacing:1px;margin:16px 0 6px;">New Slot</p>
    ${detailTable(`
      ${infoRow('Date', fmtDate(appointment.appointmentDate))}
      ${infoRow('Time Slot', `${appointment.slotStart} – ${appointment.slotEnd}`)}
      ${infoRow('Consultation', appointment.consultationType === 'online' ? '🎥 Online' : '🏥 In-Clinic')}
      ${infoRow('Patient Name', appointment.patientName)}
      ${infoRow('Phone', appointment.patientPhone || '—')}
    `)}
  `);

  return sendEmail({
    to: adminEmail,
    subject: `[Reschedule] ${appointment.patientName} has rescheduled their appointment | ${CLINIC_NAME()}`,
    html,
  });
};

// ─── 10. User: Appointment completed ─────────────────────────────────────────
const notifyUserCompleted = async (appointment) => {
  if (!appointment.patientEmail) return { success: false, reason: 'No patient email' };

  const firstName = appointment.patientName.split(' ')[0];

  const html = wrapHtml('Thank You for Your Visit', `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:72px;height:72px;background:linear-gradient(135deg,#d1fae5,#a7f3d0);border-radius:50%;font-size:32px;">🙏</div>
    </div>
    ${sectionHeading('', `Thank You, ${firstName}!`)}
    ${subText(`We hope your consultation on <strong>${new Date(appointment.appointmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long' })}</strong> was helpful and that you are on your path to better health. Your trust and wellbeing mean everything to us.`)}

    ${alertBox('#f0fdf4', '#10b981', '⭐ <strong>Share Your Experience</strong> — Your feedback helps other patients find trusted care. A brief review takes less than a minute and makes a big difference.')}

    <div style="text-align:center;margin:24px 0;">
      ${btn('Leave a Review', `${FRONTEND_URL()}/reviews`)}
    </div>

    <p style="font-size:13px;color:#94a3b8;margin-top:20px;text-align:center;line-height:1.6;">
      For follow-up queries or to book your next appointment, please contact us${CLINIC_PHONE() ? ` at <strong style="color:#0f172a;">${CLINIC_PHONE()}</strong>` : ''}.
    </p>
  `);

  return sendEmail({
    to: appointment.patientEmail,
    subject: `Thank You for Visiting ${CLINIC_NAME()} — We'd Love Your Feedback 🙏`,
    html,
  });
};

// ─── 11. User: Marked as No-Show ──────────────────────────────────────────────
const notifyUserNoShow = async (appointment) => {
  if (!appointment.patientEmail) return { success: false, reason: 'No patient email' };

  const firstName = appointment.patientName.split(' ')[0];

  const html = wrapHtml('Missed Appointment Notice', `
    ${sectionHeading('📋', 'Missed Appointment Notice')}
    ${subText(`Dear ${firstName}, we noticed that you were unable to attend your appointment on <strong>${new Date(appointment.appointmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</strong> at <strong>${appointment.slotStart}</strong>. We hope all is well.`)}

    ${alertBox('#fefce8', '#f59e0b', 'Your appointment has been marked as <strong>No-Show</strong>. If this was due to an emergency or unavoidable circumstance, please reach out to us — we would be glad to assist you reschedule.')}

    <div style="text-align:center;margin:24px 0;">
      ${btn('Book a New Appointment', `${FRONTEND_URL()}/book`)}
    </div>

    <p style="font-size:13px;color:#94a3b8;margin-top:20px;text-align:center;line-height:1.6;">
      To reschedule or for any assistance, please contact us${CLINIC_PHONE() ? ` at <strong style="color:#0f172a;">${CLINIC_PHONE()}</strong>` : ''}.
    </p>
  `);

  return sendEmail({
    to: appointment.patientEmail,
    subject: `Missed Appointment — ${new Date(appointment.appointmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} at ${appointment.slotStart} | ${CLINIC_NAME()}`,
    html,
  });
};

module.exports = {
  sendEmail,
  wrapHtml,       // exported so authController can use the shared layout for OTP email
  notifyAdminNewPayment,
  notifyUserPaymentApproved,
  notifyUserPaymentRejected,
  notifyUserAppointmentCancelled,
  notifyUserAppointmentReminder,
  notifyUserSlotLocked,
  notifyAdminUserCancelled,
  notifyUserRescheduled,
  notifyAdminRescheduled,
  notifyUserCompleted,
  notifyUserNoShow,
};
