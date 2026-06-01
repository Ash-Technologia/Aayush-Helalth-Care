'use strict';

const mongoose = require('mongoose');

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const degreeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    institution: { type: String, required: true, trim: true },
    year: { type: Number, min: 1900, max: new Date().getFullYear() },
    order: { type: Number, default: 0 }, // for display sorting
  },
  { _id: true }
);

const achievementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    year: { type: Number },
    order: { type: Number, default: 0 },
  },
  { _id: true }
);

const shiftSchema = new mongoose.Schema(
  {
    open: {
      type: String,
      required: true,
      match: [/^\d{2}:\d{2}$/, 'Shift time must be in HH:mm format.'],
    },
    close: {
      type: String,
      required: true,
      match: [/^\d{2}:\d{2}$/, 'Shift time must be in HH:mm format.'],
    },
  },
  { _id: false }
);

const clinicTimingSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      required: true,
      enum: {
        values: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        message: 'Day must be a valid 3-letter abbreviation.',
      },
    },
    isOpen: { type: Boolean, default: true },
    shifts: { type: [shiftSchema], default: [] },
  },
  { _id: false }
);

const breakTimingSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true }, // e.g. "Lunch Break"
    start: {
      type: String,
      required: true,
      match: [/^\d{2}:\d{2}$/, 'Break start must be in HH:mm format.'],
    },
    end: {
      type: String,
      required: true,
      match: [/^\d{2}:\d{2}$/, 'Break end must be in HH:mm format.'],
    },
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true, match: [/^\d{6}$/, 'Pincode must be 6 digits.'] },
    googleMapsEmbedUrl: { type: String, trim: true },
  },
  { _id: false }
);

const paymentSettingsSchema = new mongoose.Schema(
  {
    qrImageUrl: { type: String, default: null },   // path to uploaded QR image
    upiId: { type: String, trim: true, default: '' }, // e.g. '9822843015@ybl'
    accountName: { type: String, trim: true, default: 'Amrut Singhavi' },
    instructions: {
      type: String,
      trim: true,
      default:
        'Scan the QR code or use the UPI ID to pay, then send the payment ' +
        'screenshot to WhatsApp +91 9822843015 and upload it below.',
    },
  },
  { _id: false }
);

// ─── DoctorProfile Schema ─────────────────────────────────────────────────────
// Singleton document — only one ever exists in the collection.
const doctorProfileSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Doctor name is required.'],
      trim: true,
      default: 'Amrut Singhavi',
    },
    imageUrl: { type: String, default: null },
    tagline: {
      type: String,
      trim: true,
      default: 'Holistic Healing Through Ayurveda',
    },
    degrees: { type: [degreeSchema], default: [] },
    achievements: { type: [achievementSchema], default: [] },
    experience: {
      type: Number,
      min: [0, 'Experience cannot be negative.'],
      default: 0,
    },
    about: { type: String, trim: true, default: '' },
    specializations: { type: [String], default: [] },
    consultationFee: {
      type: Number,
      required: [true, 'Consultation fee is required.'],
      min: [0, 'Fee cannot be negative.'],
      default: 500,
    },
    payment: { type: paymentSettingsSchema, default: () => ({}) },
    clinicTimings: { type: [clinicTimingSchema], default: [] },
    breakTimings: { type: [breakTimingSchema], default: [] },
    address: { type: addressSchema, default: () => ({}) },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid contact email.'],
    },
    contactPhone: { type: String, trim: true },
    whatsappNumber: {
      type: String,
      trim: true,
      default: '9822843015',
    },
    // Emergency closure — overrides all slot availability
    isEmergencyClosed: { type: Boolean, default: false },
    emergencyMessage: {
      type: String,
      trim: true,
      default: 'Clinic is temporarily closed. Please call to reschedule.',
    },
    // Trust statistics for homepage display (admin-editable)
    stats: {
      yearsExperience: { type: Number, default: 0 },
      totalPatients: { type: Number, default: 0 },
      totalTreatments: { type: Number, default: 0 },
      satisfactionRate: { type: Number, default: 0, min: 0, max: 100 },
    },
  },
  {
    timestamps: true,
    collection: 'doctorprofile', // fixed collection name for singleton
  }
);

// ─── Static: Get or create the singleton ─────────────────────────────────────
doctorProfileSchema.statics.getSingleton = async function () {
  let profile = await this.findOne();
  if (!profile) {
    profile = await this.create({});
    console.log('[DoctorProfile] Singleton created with defaults.');
  }
  return profile;
};

const DoctorProfile = mongoose.model('DoctorProfile', doctorProfileSchema);
module.exports = DoctorProfile;
