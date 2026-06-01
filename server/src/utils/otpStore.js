'use strict';

const crypto = require('crypto');

const OTP_LENGTH       = parseInt(process.env.OTP_LENGTH       || '6',  10);
const OTP_EXPIRY_MINS  = parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10);
const MAX_ATTEMPTS     = 5; // max wrong guesses before OTP is invalidated

// In-memory store fallback
const store = new Map();

// Redis client initialization (optional, only if REDIS_URL is provided)
let redis = null;
if (process.env.REDIS_URL) {
  try {
    const Redis = require('ioredis');
    redis = new Redis(process.env.REDIS_URL);
    redis.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });
    console.log('[Redis] Connected for OTP store.');
  } catch (err) {
    console.warn('[Redis] Failed to load ioredis. Falling back to in-memory map.');
  }
}

// ─── Cleanup for In-Memory Fallback ─────────────────────────────────────────────
const cleanup = () => {
  const now = new Date();
  for (const [key, entry] of store.entries()) {
    if (entry.expiresAt <= now) {
      store.delete(key);
    }
  }
};
const cleanupInterval = setInterval(cleanup, 60_000);
if (cleanupInterval.unref) cleanupInterval.unref();

// ─── Key format ───────────────────────────────────────────────────────────────
const makeKey = (phone) => `otp:${phone}`;

// ─── Generate a cryptographically random numeric OTP ─────────────────────────
const generateOtp = () => {
  const max = Math.pow(10, OTP_LENGTH);
  const min = Math.pow(10, OTP_LENGTH - 1);
  return crypto.randomInt(min, max).toString();
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates and stores a new OTP for a phone number / email.
 *
 * @param {string} phone
 * @returns {Promise<string>}
 */
const saveOtp = async (phone) => {
  const otp = generateOtp();
  const key = makeKey(phone);

  if (redis) {
    await redis.set(key, otp, 'EX', OTP_EXPIRY_MINS * 60);
  } else {
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINS * 60_000);
    store.set(key, { otp, expiresAt, attempts: 0 });
  }
  return otp;
};

/**
 * Verifies an OTP for a phone number / email.
 *
 * @param {string} phone
 * @param {string} candidateOtp
 * @returns {Promise<{ valid: boolean, reason?: string }>}
 */
const verifyOtp = async (phone, candidateOtp) => {
  const key = makeKey(phone);
  let expectedOtp = null;

  if (redis) {
    expectedOtp = await redis.get(key);
    if (!expectedOtp) {
      return { valid: false, reason: 'No OTP found or has expired. Please request a new one.' };
    }
  } else {
    const entry = store.get(key);
    if (!entry) {
      return { valid: false, reason: 'No OTP found. Please request a new one.' };
    }

    if (entry.expiresAt <= new Date()) {
      store.delete(key);
      return { valid: false, reason: 'OTP has expired. Please request a new one.' };
    }

    if (entry.attempts >= MAX_ATTEMPTS) {
      store.delete(key);
      return {
        valid: false,
        reason: 'Too many failed attempts. Please request a new OTP.',
      };
    }
    expectedOtp = entry.otp;
  }

  // Constant-time comparison
  const expected = Buffer.from(expectedOtp);
  const received = Buffer.from(candidateOtp || '');

  const isMatch =
    expected.length === received.length &&
    crypto.timingSafeEqual(expected, received);

  if (!isMatch) {
    if (!redis) {
      const entry = store.get(key);
      entry.attempts += 1;
      return {
        valid: false,
        reason: `Incorrect OTP. ${MAX_ATTEMPTS - entry.attempts} attempt(s) remaining.`,
      };
    }
    return { valid: false, reason: 'Incorrect OTP.' };
  }

  // Valid — delete immediately
  if (redis) {
    await redis.del(key);
  } else {
    store.delete(key);
  }
  return { valid: true };
};

/**
 * Manually deletes an OTP entry.
 *
 * @param {string} phone
 * @returns {Promise<void>}
 */
const deleteOtp = async (phone) => {
  const key = makeKey(phone);
  if (redis) {
    await redis.del(key);
  } else {
    store.delete(key);
  }
};

/**
 * Returns whether a phone number has a pending (non-expired) OTP.
 *
 * @param {string} phone
 * @returns {Promise<boolean>}
 */
const hasPendingOtp = async (phone) => {
  const key = makeKey(phone);
  if (redis) {
    const exists = await redis.exists(key);
    return exists === 1;
  } else {
    const entry = store.get(key);
    if (!entry) return false;
    if (entry.expiresAt <= new Date()) {
      store.delete(key);
      return false;
    }
    return true;
  }
};

/**
 * Returns the number of seconds until the current OTP expires.
 *
 * @param {string} phone
 * @returns {Promise<number>}
 */
const getOtpTtlSeconds = async (phone) => {
  const key = makeKey(phone);
  if (redis) {
    const ttl = await redis.ttl(key);
    return Math.max(0, ttl);
  } else {
    const entry = store.get(key);
    if (!entry || entry.expiresAt <= new Date()) return 0;
    return Math.floor((entry.expiresAt - new Date()) / 1000);
  }
};

const storeSize = () => {
  return redis ? -1 : store.size;
};

module.exports = {
  saveOtp,
  verifyOtp,
  deleteOtp,
  hasPendingOtp,
  getOtpTtlSeconds,
  storeSize,
};
