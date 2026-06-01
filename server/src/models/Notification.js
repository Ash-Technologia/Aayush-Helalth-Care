'use strict';

const mongoose = require('mongoose');

// ─── Notification Types & Channels ───────────────────────────────────────────
const NOTIFICATION_TYPES = [
  'appointment_confirmed',
  'appointment_reminder',
  'appointment_cancelled',
  'payment_submitted',   // admin alert: new screenshot for review
  'payment_approved',
  'payment_rejected',
  'otp',
];

const NOTIFICATION_CHANNELS = ['email', 'sms', 'whatsapp'];
const NOTIFICATION_STATUSES = ['pending', 'sent', 'failed'];

// ─── Notification Schema ──────────────────────────────────────────────────────
// Audit log for all outgoing notifications.
// Each send attempt (email, SMS, WhatsApp) creates one record.
const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required.'],
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
    },
    type: {
      type: String,
      required: [true, 'Notification type is required.'],
      enum: {
        values: NOTIFICATION_TYPES,
        message: 'Invalid notification type.',
      },
    },
    channel: {
      type: String,
      required: [true, 'Notification channel is required.'],
      enum: {
        values: NOTIFICATION_CHANNELS,
        message: 'Invalid notification channel.',
      },
    },
    status: {
      type: String,
      enum: {
        values: NOTIFICATION_STATUSES,
        message: 'Invalid notification status.',
      },
      default: 'pending',
    },
    // Snapshot of what was sent — useful for debugging and auditing
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    sentAt: {
      type: Date,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // immutable audit log
  }
);

// ─── TTL Index: Auto-delete after 90 days ─────────────────────────────────────
// MongoDB automatically removes documents 90 days after 'createdAt'.
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60, name: 'ttl_90_days' }
);

// ─── Indexes for audit queries ────────────────────────────────────────────────
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ status: 1, channel: 1 });
notificationSchema.index({ appointment: 1 });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
