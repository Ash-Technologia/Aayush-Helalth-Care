'use strict';

const mongoose = require('mongoose');

// ─── Holiday Schema ───────────────────────────────────────────────────────────
// Marks specific calendar dates as clinic holidays.
// The slot availability algorithm checks this collection first.
const holidaySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, 'Holiday date is required.'],
      unique: true, // one holiday record per calendar date
    },
    reason: {
      type: String,
      required: [true, 'Holiday reason is required.'],
      trim: true,
      maxlength: [200, 'Reason cannot exceed 200 characters.'],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator reference is required.'],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // holidays don't change
  }
);

// ─── Pre-save: Normalize date to midnight UTC ─────────────────────────────────
// Ensures date comparisons are consistent regardless of timezone of request.
holidaySchema.pre('save', function () {
  if (this.date) {
    const d = new Date(this.date);
    // Strip time component — set to start of day in UTC
    this.date = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    );
  }
});

// ─── Static: Check if a given date is a holiday ───────────────────────────────
holidaySchema.statics.isHoliday = async function (dateInput) {
  const d = new Date(dateInput);
  const normalized = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
  const nextDay = new Date(normalized.getTime() + 24 * 60 * 60 * 1000);

  const holiday = await this.findOne({
    date: { $gte: normalized, $lt: nextDay },
  });
  return holiday || null;
};

const Holiday = mongoose.model('Holiday', holidaySchema);
module.exports = Holiday;
