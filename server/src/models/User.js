'use strict';

const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');

// ─── Refresh Token Sub-schema ─────────────────────────────────────────────────
const refreshTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// ─── User Schema ──────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required.'],
      trim: true,
      maxlength: [100, 'Full name cannot exceed 100 characters.'],
    },
    email: {
      type: String,
      unique: true,
      sparse: true, // allows multiple null values (phone-only users)
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address.',
      ],
    },
    phone: {
      type: String,
      unique: true,
      sparse: true, // allows multiple null values (email-only / Google users)
      trim: true,
      match: [
        /^[6-9]\d{9}$/,
        'Phone must be a valid 10-digit Indian mobile number.',
      ],
    },
    passwordHash: {
      type: String,
      default: null, // null for Google / OTP-only users
      select: false,  // never returned in queries by default
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    role: {
      type: String,
      enum: {
        values: ['user', 'admin'],
        message: 'Role must be either user or admin.',
      },
      default: 'user',
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    avatar: {
      type: String,
      default: null,
    },
    refreshTokens: {
      type: [refreshTokenSchema],
      default: [],
      select: false, // never returned in queries by default
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// sparse unique indexes defined inline above (email, phone, googleId)
// Compound text index for admin user search
userSchema.index({ fullName: 'text', email: 'text' });
// Sorted list for admin panel (newest first)
userSchema.index({ createdAt: -1 });

// ─── Pre-save Hook: Hash password ────────────────────────────────────────────
userSchema.pre('save', async function () {
  // Only hash if passwordHash was explicitly modified and is not null
  if (!this.isModified('passwordHash') || !this.passwordHash) {
    return;
  }
  // Avoid double-hashing (e.g., if already a bcrypt hash)
  if (this.passwordHash.startsWith('$2')) {
    return;
  }
  this.passwordHash = await bcryptjs.hash(this.passwordHash, 12);
});

// ─── Instance Method: Compare password ───────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.passwordHash) return false;
  return bcryptjs.compare(candidatePassword, this.passwordHash);
};

// ─── Instance Method: Purge expired refresh tokens ───────────────────────────
userSchema.methods.purgeExpiredTokens = function () {
  const now = new Date();
  this.refreshTokens = this.refreshTokens.filter((t) => t.expiresAt > now);
};

// ─── Virtual: display name for notifications ─────────────────────────────────
userSchema.virtual('firstName').get(function () {
  return this.fullName ? this.fullName.split(' ')[0] : '';
});

// ─── Validation: at least one of email or phone must be provided ──────────────
userSchema.pre('validate', function () {
  if (!this.email && !this.phone && !this.googleId) {
    throw new Error('User must have at least one of: email, phone, or Google account.');
  }
});

const User = mongoose.model('User', userSchema);
module.exports = User;
