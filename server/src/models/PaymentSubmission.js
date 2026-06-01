'use strict';

const mongoose = require('mongoose');

// ─── PaymentSubmission Schema ─────────────────────────────────────────────────
// Created when a user uploads their payment screenshot.
// One submission per appointment (enforced by unique index on 'appointment').
const paymentSubmissionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required.'],
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: [true, 'Appointment reference is required.'],
      unique: true, // one submission per appointment — spec requirement
    },

    // ── Screenshot ────────────────────────────────────────────────────────────
    screenshotUrl: {
      type: String,
      required: [true, 'Screenshot URL is required.'],
      trim: true,
    },
    screenshotUploadedAt: {
      type: Date,
      default: Date.now,
    },

    // ── User-provided payment details ─────────────────────────────────────────
    upiTransactionId: {
      type: String,
      trim: true,
      default: null,
      // Optional — user can enter their UPI reference number
    },
    amountClaimed: {
      type: Number,
      required: [true, 'Amount claimed is required.'],
      min: [0, 'Amount cannot be negative.'],
      // The amount the user says they paid — for admin cross-check against feeSnapshot
    },
    whatsappSentConfirmed: {
      type: Boolean,
      required: [true, 'WhatsApp confirmation is required.'],
      // User must check a box confirming they sent the screenshot on WhatsApp
    },

    // ── Admin review ──────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: {
        values: ['submitted', 'approved', 'rejected'],
        message: "Status must be 'submitted', 'approved', or 'rejected'.",
      },
      default: 'submitted',
    },
    adminReviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    adminReviewedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: null,
      // Required when admin rejects — validated at route level
    },
  },
  {
    timestamps: true,
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Admin pending-review dashboard: fast count + list of submitted submissions
paymentSubmissionSchema.index({ status: 1, createdAt: -1 });

// Admin review list sorted by creation date
paymentSubmissionSchema.index({ createdAt: -1 });

// ─── Validation: rejectionReason required when rejecting ─────────────────────
paymentSubmissionSchema.pre('save', function () {
  if (this.isModified('status') && this.status === 'rejected') {
    if (!this.rejectionReason || this.rejectionReason.trim().length < 10) {
      throw new Error('Rejection reason is required and must be at least 10 characters.');
    }
  }
});

const PaymentSubmission = mongoose.model('PaymentSubmission', paymentSubmissionSchema);
module.exports = PaymentSubmission;
