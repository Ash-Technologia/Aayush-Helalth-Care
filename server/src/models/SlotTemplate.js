'use strict';

const mongoose = require('mongoose');

// ─── Allowed slot durations ───────────────────────────────────────────────────
const ALLOWED_DURATIONS = [10, 15, 20, 30, 45, 60, 90, 120];

// ─── SlotTemplate Schema ──────────────────────────────────────────────────────
// Defines RECURRING weekly slot blocks. The availability algorithm
// uses these to generate individual slots for any given date.
const slotTemplateSchema = new mongoose.Schema(
  {
    dayOfWeek: {
      type: Number,
      required: [true, 'Day of week is required.'],
      enum: {
        values: [0, 1, 2, 3, 4, 5, 6],
        message: 'dayOfWeek must be 0 (Sunday) through 6 (Saturday).',
      },
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required.'],
      match: [/^\d{2}:\d{2}$/, 'Start time must be in HH:mm format (e.g. 09:00).'],
    },
    endTime: {
      type: String,
      required: [true, 'End time is required.'],
      match: [/^\d{2}:\d{2}$/, 'End time must be in HH:mm format (e.g. 13:00).'],
    },
    slotDurationMins: {
      type: Number,
      required: [true, 'Slot duration is required.'],
      enum: {
        values: ALLOWED_DURATIONS,
        message: `Slot duration must be one of: ${ALLOWED_DURATIONS.join(', ')} minutes.`,
      },
      default: 30,
    },
    consultationType: {
      type: String,
      required: [true, 'Consultation type is required.'],
      enum: {
        values: ['both', 'online', 'clinic'],
        message: "Consultation type must be 'both', 'online', or 'clinic'.",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator reference is required.'],
    },
    label: {
      type: String,
      trim: true,
      maxlength: [100, 'Label cannot exceed 100 characters.'],
      default: '',
      // Optional human-readable label e.g. "Morning Clinic", "Evening Online"
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Quickly fetch active templates for a given day+type during slot generation
slotTemplateSchema.index({ dayOfWeek: 1, consultationType: 1, isActive: 1 });

// ─── Validation: endTime must be after startTime ──────────────────────────────
slotTemplateSchema.pre('validate', function () {
  if (this.startTime && this.endTime) {
    const [sh, sm] = this.startTime.split(':').map(Number);
    const [eh, em] = this.endTime.split(':').map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;

    if (endMins <= startMins) {
      throw new Error('End time must be after start time.');
    }

    // Warn if the time block is shorter than one slot duration
    if (this.slotDurationMins && endMins - startMins < this.slotDurationMins) {
      throw new Error(
        `Time block (${endMins - startMins} min) is shorter than slot duration (${this.slotDurationMins} min).`
      );
    }
  }
});

// ─── Virtual: human-readable day name ────────────────────────────────────────
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
slotTemplateSchema.virtual('dayName').get(function () {
  return DAY_NAMES[this.dayOfWeek] || '';
});

// ─── Virtual: total slots this template generates ────────────────────────────
slotTemplateSchema.virtual('totalSlots').get(function () {
  if (!this.startTime || !this.endTime || !this.slotDurationMins) return 0;
  const [sh, sm] = this.startTime.split(':').map(Number);
  const [eh, em] = this.endTime.split(':').map(Number);
  const totalMins = (eh * 60 + em) - (sh * 60 + sm);
  return Math.floor(totalMins / this.slotDurationMins);
});

const SlotTemplate = mongoose.model('SlotTemplate', slotTemplateSchema);
module.exports = SlotTemplate;
