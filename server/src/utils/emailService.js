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
    secure: EMAIL_SECURE === 'true' || port === 465, // true for port 465, false for 587 (TLS)
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  });

  return _transporter;
};

// ─── Shared layout ────────────────────────────────────────────────────────────
const CLINIC_NAME     = 'Aayush Health Care';
const CLINIC_TAGLINE  = 'Amrut Singhavi — Acupressure & Neurotherapy Specialist';
const CLINIC_PHONE    = process.env.CLINIC_PHONE || '+91 98228 43015';
const CLINIC_EMAIL    = process.env.SMTP_FROM || process.env.SMTP_USER || process.env.EMAIL_FROM || 'noreply@aayushhealthcare.in';
const CLINIC_COLOR    = '#0d9488'; // teal-600

const wrapHtml = (title, bodyHtml) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:${CLINIC_COLOR};padding:28px 32px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">${CLINIC_NAME}</p>
            <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">${CLINIC_TAGLINE}</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            ${bodyHtml}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;font-size:12px;color:#6b7280;">
              ${CLINIC_NAME} &bull; ${CLINIC_PHONE} &bull;
              <a href="mailto:${CLINIC_EMAIL}" style="color:${CLINIC_COLOR};text-decoration:none;">${CLINIC_EMAIL}</a>
            </p>
            <p style="margin:6px 0 0;font-size:11px;color:#9ca3af;">
              This is an automated message. Please do not reply to this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const btn = (text, href) =>
  `<a href="${href}" style="display:inline-block;background:${CLINIC_COLOR};color:#ffffff;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;margin:16px 0;">${text}</a>`;

const infoRow = (label, value) =>
  `<tr><td style="padding:6px 0;font-size:14px;color:#6b7280;width:160px;">${label}</td>
   <td style="padding:6px 0;font-size:14px;color:#111827;font-weight:600;">${value}</td></tr>`;

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
      from:    `"${CLINIC_NAME}" <${CLINIC_EMAIL}>`,
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
// ═══════════════════════════════════════════════════════════════

// ─── 1. Admin: New payment screenshot submitted ───────────────────────────────
const notifyAdminNewPayment = async (appointment, submission) => {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return { success: false, reason: 'ADMIN_EMAIL not configured' };

  const html = wrapHtml('New Payment Received', `
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">New Payment Screenshot Received</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">A patient has submitted payment and is awaiting your approval.</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <tbody style="background:#f9fafb;">
        ${infoRow('Patient', appointment.patientName)}
        ${infoRow('Phone', appointment.patientPhone || '—')}
        ${infoRow('Date', new Date(appointment.appointmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }))}
        ${infoRow('Time', `${appointment.slotStart} – ${appointment.slotEnd}`)}
        ${infoRow('Type', appointment.consultationType === 'online' ? '🎥 Online' : '🏥 In-Clinic')}
        ${infoRow('Fee', `₹${appointment.feeSnapshot}`)}
        ${infoRow('Amount Claimed', `₹${submission.amountClaimed}`)}
        ${infoRow('WhatsApp Sent', submission.whatsappSentConfirmed ? '✅ Yes' : '❌ No')}
        ${submission.upiTransactionId ? infoRow('UPI Ref', submission.upiTransactionId) : ''}
      </tbody>
    </table>
    <div style="text-align:center;margin-top:24px;">
      ${btn('Review in Admin Panel', `${process.env.PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL || ''}/admin/payments`)}
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
  const dateStr  = new Date(appointment.appointmentDate).toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

  const html = wrapHtml('Appointment Confirmed', `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:#d1fae5;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:28px;">✅</div>
    </div>
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827;text-align:center;">Your Appointment is Confirmed!</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;text-align:center;">
      Your payment has been verified and your appointment is booked.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <tbody style="background:#f9fafb;">
        ${infoRow('Date', dateStr)}
        ${infoRow('Time', `${appointment.slotStart} – ${appointment.slotEnd}`)}
        ${infoRow('Type', isOnline ? '🎥 Online Consultation' : '🏥 In-Clinic Visit')}
        ${infoRow('Patient', appointment.patientName)}
        ${infoRow('Amount Paid', `₹${appointment.feeSnapshot}`)}
      </tbody>
    </table>
    ${isOnline && whatsappJoinLink ? `
      <p style="font-size:14px;color:#6b7280;">To join your online consultation, click the WhatsApp button below at your appointment time:</p>
      <div style="text-align:center;">${btn('Join on WhatsApp', whatsappJoinLink)}</div>
    ` : `
      <p style="font-size:14px;color:#6b7280;">Please arrive 10 minutes before your scheduled time.<br>
      Clinic Address: ${process.env.CLINIC_ADDRESS || 'Contact clinic for address.'}</p>
    `}
    <p style="font-size:13px;color:#9ca3af;margin-top:24px;">
      For queries, call us at <strong>${CLINIC_PHONE}</strong> or WhatsApp us.
    </p>
  `);

  return sendEmail({
    to: appointment.patientEmail,
    subject: `✅ Appointment Confirmed — ${new Date(appointment.appointmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} at ${appointment.slotStart}`,
    html,
  });
};

// ─── 3. User: Payment rejected ────────────────────────────────────────────────
const notifyUserPaymentRejected = async (appointment, submission, reason) => {
  if (!appointment.patientEmail) return { success: false, reason: 'No patient email' };

  const html = wrapHtml('Payment Not Verified', `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:#fee2e2;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:28px;">❌</div>
    </div>
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827;text-align:center;">Payment Could Not Be Verified</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;text-align:center;">
      We were unable to verify your payment for the appointment on
      <strong>${new Date(appointment.appointmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long' })}</strong>
      at <strong>${appointment.slotStart}</strong>.
    </p>
    <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:16px;border-radius:0 8px 8px 0;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#991b1b;font-weight:600;">Reason:</p>
      <p style="margin:6px 0 0;font-size:14px;color:#7f1d1d;">${reason}</p>
    </div>
    <p style="font-size:14px;color:#6b7280;">
      Please book a new appointment and ensure you:<br>
      • Upload a clear, full screenshot of the payment confirmation<br>
      • Also send the screenshot on WhatsApp as instructed<br>
      • The amount should match the consultation fee exactly
    </p>
    <div style="text-align:center;margin-top:24px;">
      ${btn('Book Again', `${process.env.PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL || ''}/book`)}
    </div>
    <p style="font-size:13px;color:#9ca3af;margin-top:24px;">
      Need help? Call us at <strong>${CLINIC_PHONE}</strong>.
    </p>
  `);

  return sendEmail({
    to: appointment.patientEmail,
    subject: `Payment Not Verified — Please Rebook`,
    html,
  });
};

// ─── 4. User: Appointment cancelled (by admin) ────────────────────────────────
const notifyUserAppointmentCancelled = async (appointment) => {
  if (!appointment.patientEmail) return { success: false, reason: 'No patient email' };

  const html = wrapHtml('Appointment Cancelled', `
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Appointment Cancelled</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">
      Your appointment on <strong>${new Date(appointment.appointmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>
      at <strong>${appointment.slotStart}</strong> has been cancelled.
    </p>
    ${appointment.cancellationReason ? `
      <div style="background:#fef9c3;border-left:4px solid #f59e0b;padding:14px;border-radius:0 8px 8px 0;margin-bottom:20px;">
        <p style="margin:0;font-size:14px;color:#78350f;"><strong>Reason:</strong> ${appointment.cancellationReason}</p>
      </div>
    ` : ''}
    <p style="font-size:14px;color:#6b7280;">
      If you have already made payment, please contact us for a refund at <strong>${CLINIC_PHONE}</strong>.
    </p>
    <div style="text-align:center;margin-top:24px;">
      ${btn('Book New Appointment', `${process.env.PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL || ''}/book`)}
    </div>
  `);

  return sendEmail({
    to: appointment.patientEmail,
    subject: `Appointment Cancelled — ${new Date(appointment.appointmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`,
    html,
  });
};

// ─── 5. User: 24-hour appointment reminder ────────────────────────────────────
const notifyUserAppointmentReminder = async (appointment) => {
  if (!appointment.patientEmail) return { success: false, reason: 'No patient email' };
  const isOnline = appointment.consultationType === 'online';

  const html = wrapHtml('Reminder: Appointment Tomorrow', `
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">📅 Appointment Reminder</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">
      This is a reminder for your appointment <strong>tomorrow</strong>.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <tbody style="background:#f9fafb;">
        ${infoRow('Date', new Date(appointment.appointmentDate).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' }))}
        ${infoRow('Time', `${appointment.slotStart} – ${appointment.slotEnd}`)}
        ${infoRow('Type', isOnline ? '🎥 Online Consultation' : '🏥 In-Clinic Visit')}
      </tbody>
    </table>
    ${isOnline && appointment.whatsappJoinLink ? `
      <p style="font-size:14px;color:#6b7280;">At your appointment time, click below to join on WhatsApp:</p>
      <div style="text-align:center;">${btn('Join Consultation', appointment.whatsappJoinLink)}</div>
    ` : `
      <p style="font-size:14px;color:#6b7280;">Please arrive 10 minutes early. Bring any previous reports or prescriptions.</p>
    `}
  `);

  return sendEmail({
    to: appointment.patientEmail,
    subject: `Reminder: Your Appointment Tomorrow at ${appointment.slotStart}`,
    html,
  });
};

// ─── 6. User: Slot locked — payment pending ──────────────────────────────────
const notifyUserSlotLocked = async (appointment, profile) => {
  if (!appointment.patientEmail) return { success: false, reason: 'No patient email' };

  const dateStr = new Date(appointment.appointmentDate).toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
  const qrUrl = profile?.payment?.qrImageUrl
    ? `${process.env.BACKEND_URL || ''}${profile.payment.qrImageUrl}`
    : null;
  const upiId = profile?.payment?.upiId || 'Contact clinic for UPI details';
  const fee   = appointment.feeSnapshot || profile?.consultationFee || 500;

  const html = wrapHtml('Complete Your Payment', `
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Your Slot is Reserved! 🎉</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">
      Your slot has been reserved for <strong>30 minutes</strong>. Please complete payment to confirm.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <tbody style="background:#f9fafb;">
        ${infoRow('Patient', appointment.patientName)}
        ${infoRow('Date', dateStr)}
        ${infoRow('Time', `${appointment.slotStart} – ${appointment.slotEnd}`)}
        ${infoRow('Type', appointment.consultationType === 'online' ? '🎥 Online' : '🏥 In-Clinic')}
        ${infoRow('Amount to Pay', `₹${fee}`)}
      </tbody>
    </table>
    <p style="font-size:14px;color:#111827;font-weight:600;">How to pay:</p>
    ${qrUrl ? `
      <p style="font-size:14px;color:#6b7280;">Scan the QR code below with any UPI app to pay ₹${fee}:</p>
      <div style="text-align:center;margin:16px 0;">
        <img src="${qrUrl}" alt="UPI QR Code" style="max-width:200px;border-radius:8px;border:1px solid #e5e7eb;" />
      </div>
    ` : `
      <p style="font-size:14px;color:#6b7280;">Pay via UPI — <strong>UPI ID: ${upiId}</strong> — using any UPI app (GPay, PhonePe, Paytm).</p>
    `}
    <p style="font-size:14px;color:#6b7280;">After payment, upload your screenshot on the website to confirm your booking.</p>
    <div style="text-align:center;margin-top:24px;">
      ${btn('Upload Payment Screenshot', `${process.env.PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL || ''}/appointments`)}
    </div>
    <p style="font-size:13px;color:#ef4444;margin-top:20px;">⚠️ Your slot will be released if payment is not uploaded within 30 minutes.</p>
  `);

  return sendEmail({
    to: appointment.patientEmail,
    subject: `Complete Payment to Confirm Your Appointment — ₹${fee}`,
    html,
  });
};

// ─── 7. Admin: User cancelled their own appointment ────────────────────────────
const notifyAdminUserCancelled = async (appointment) => {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return { success: false, reason: 'ADMIN_EMAIL not configured' };

  const html = wrapHtml('Patient Cancelled Appointment', `
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Patient Cancelled Appointment</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">A patient has cancelled their appointment. The slot is now free.</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <tbody style="background:#f9fafb;">
        ${infoRow('Patient', appointment.patientName)}
        ${infoRow('Phone', appointment.patientPhone || '—')}
        ${infoRow('Date', new Date(appointment.appointmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }))}
        ${infoRow('Time', `${appointment.slotStart} – ${appointment.slotEnd}`)}
        ${infoRow('Type', appointment.consultationType === 'online' ? '🎥 Online' : '🏥 In-Clinic')}
        ${appointment.cancellationReason ? infoRow('Reason', appointment.cancellationReason) : ''}
      </tbody>
    </table>
  `);

  return sendEmail({
    to: adminEmail,
    subject: `[Cancellation] ${appointment.patientName} cancelled their appointment`,
    html,
  });
};

// ─── 8. User: Appointment rescheduled ─────────────────────────────────────────
const notifyUserRescheduled = async (appointment) => {
  if (!appointment.patientEmail) return { success: false, reason: 'No patient email' };

  const dateStr = new Date(appointment.appointmentDate).toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

  const html = wrapHtml('Appointment Rescheduled', `
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Your Appointment Has Been Rescheduled 📅</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">Your appointment has been moved to the following new slot:</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
      <tbody style="background:#f9fafb;">
        ${infoRow('New Date', dateStr)}
        ${infoRow('New Time', `${appointment.slotStart} – ${appointment.slotEnd}`)}
        ${infoRow('Type', appointment.consultationType === 'online' ? '🎥 Online' : '🏥 In-Clinic')}
        ${infoRow('Patient', appointment.patientName)}
      </tbody>
    </table>
    <p style="font-size:13px;color:#9ca3af;">For queries, call us at <strong>${CLINIC_PHONE}</strong>.</p>
  `);

  return sendEmail({
    to: appointment.patientEmail,
    subject: `Appointment Rescheduled — New slot: ${dateStr} at ${appointment.slotStart}`,
    html,
  });
};

// ─── 9. Admin: Appointment rescheduled (with old slot info) ───────────────────
const notifyAdminRescheduled = async (appointment, oldSlot) => {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return { success: false, reason: 'ADMIN_EMAIL not configured' };

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  const html = wrapHtml('Appointment Rescheduled by Patient', `
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Patient Rescheduled Appointment</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">${appointment.patientName} has rescheduled their appointment.</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:16px;">
      <tbody style="background:#fef9c3;">
        <tr><td colspan="2" style="padding:8px 12px;font-size:12px;font-weight:700;color:#92400e;">OLD SLOT</td></tr>
        ${infoRow('Date', oldSlot?.oldDate ? fmtDate(oldSlot.oldDate) : '—')}
        ${infoRow('Time', oldSlot?.oldSlotStart ? `${oldSlot.oldSlotStart} – ${oldSlot.oldSlotEnd}` : '—')}
      </tbody>
    </table>
    <table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <tbody style="background:#d1fae5;">
        <tr><td colspan="2" style="padding:8px 12px;font-size:12px;font-weight:700;color:#065f46;">NEW SLOT</td></tr>
        ${infoRow('Date', fmtDate(appointment.appointmentDate))}
        ${infoRow('Time', `${appointment.slotStart} – ${appointment.slotEnd}`)}
        ${infoRow('Type', appointment.consultationType === 'online' ? '🎥 Online' : '🏥 In-Clinic')}
        ${infoRow('Patient', appointment.patientName)}
        ${infoRow('Phone', appointment.patientPhone || '—')}
      </tbody>
    </table>
  `);

  return sendEmail({
    to: adminEmail,
    subject: `[Reschedule] ${appointment.patientName} moved their appointment`,
    html,
  });
};

// ─── 10. User: Appointment completed ─────────────────────────────────────────
const notifyUserCompleted = async (appointment) => {
  if (!appointment.patientEmail) return { success: false, reason: 'No patient email' };

  const html = wrapHtml('Thank You for Visiting!', `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:#d1fae5;border-radius:50%;width:64px;height:64px;line-height:64px;font-size:28px;">🙏</div>
    </div>
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827;text-align:center;">Thank You for Visiting Aayush Health Care</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;text-align:center;">
      We hope your appointment on <strong>${new Date(appointment.appointmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long' })}</strong> was helpful.
    </p>
    <p style="font-size:14px;color:#6b7280;">We'd love to hear about your experience. A quick review helps other patients find us:</p>
    <div style="text-align:center;margin-top:16px;">
      ${btn('Leave a Review', `${process.env.PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL || ''}/reviews`)}
    </div>
    <p style="font-size:13px;color:#9ca3af;margin-top:24px;">For follow-up queries, call <strong>${CLINIC_PHONE}</strong>.</p>
  `);

  return sendEmail({
    to: appointment.patientEmail,
    subject: `Thank You ${appointment.patientName.split(' ')[0]}! We'd Love Your Feedback 🙏`,
    html,
  });
};

// ─── 11. User: Marked as No-Show ──────────────────────────────────────────────
const notifyUserNoShow = async (appointment) => {
  if (!appointment.patientEmail) return { success: false, reason: 'No patient email' };

  const html = wrapHtml('Missed Appointment Notice', `
    <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">We Missed You Today</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#6b7280;">
      Your appointment on <strong>${new Date(appointment.appointmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>
      at <strong>${appointment.slotStart}</strong> was marked as <strong>No-Show</strong> as you were not present.
    </p>
    <p style="font-size:14px;color:#6b7280;">If this was an error or you faced an emergency, please contact us:</p>
    <p style="font-size:14px;color:#111827;font-weight:600;">${CLINIC_PHONE}</p>
    <div style="text-align:center;margin-top:24px;">
      ${btn('Book a New Appointment', `${process.env.PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL || ''}/book`)}
    </div>
  `);

  return sendEmail({
    to: appointment.patientEmail,
    subject: `Missed Appointment — ${new Date(appointment.appointmentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} at ${appointment.slotStart}`,
    html,
  });
};

module.exports = {
  sendEmail,
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
