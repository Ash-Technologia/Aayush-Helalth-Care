'use strict';

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES_IN  || '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a JWT expiry string like '7d' or '15m' to milliseconds.
 * Used to compute the Date stored in refreshTokens[].expiresAt.
 */
const expiryToMs = (expiry) => {
  const unit = expiry.slice(-1);
  const value = parseInt(expiry.slice(0, -1), 10);
  const map = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return (map[unit] || 86_400_000) * value;
};

// ─── Access Token ─────────────────────────────────────────────────────────────

/**
 * Signs a short-lived access token.
 * Payload: { sub: userId, role }
 */
const signAccessToken = (user) => {
  if (!ACCESS_SECRET) throw new Error('JWT_ACCESS_SECRET is not set.');
  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
};

/**
 * Verifies an access token and returns its decoded payload.
 * Throws JsonWebTokenError or TokenExpiredError on failure.
 */
const verifyAccessToken = (token) => {
  if (!ACCESS_SECRET) throw new Error('JWT_ACCESS_SECRET is not set.');
  return jwt.verify(token, ACCESS_SECRET);
};

// ─── Refresh Token ────────────────────────────────────────────────────────────

/**
 * Signs a long-lived refresh token.
 * Payload: { sub: userId, jti: unique random ID (prevents replay after rotation) }
 */
const signRefreshToken = (user) => {
  if (!REFRESH_SECRET) throw new Error('JWT_REFRESH_SECRET is not set.');
  const jti = crypto.randomBytes(32).toString('hex');
  const token = jwt.sign(
    { sub: user._id.toString(), jti },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES }
  );
  return { token, jti };
};

/**
 * Verifies a refresh token and returns its decoded payload.
 * Throws JsonWebTokenError or TokenExpiredError on failure.
 */
const verifyRefreshToken = (token) => {
  if (!REFRESH_SECRET) throw new Error('JWT_REFRESH_SECRET is not set.');
  return jwt.verify(token, REFRESH_SECRET);
};

// ─── Token Pair ───────────────────────────────────────────────────────────────

/**
 * Generates a new access + refresh token pair and stores the refresh
 * token in the user's refreshTokens array (rotation pattern).
 *
 * Steps:
 *  1. Purge expired tokens from the array (housekeeping).
 *  2. Sign new access token.
 *  3. Sign new refresh token (jti ensures uniqueness).
 *  4. Push the new refresh token entry to user.refreshTokens.
 *  5. Persist user (save() runs the pre-save hook).
 *
 * @param {Document} user  - Mongoose User document (must be fetched with +refreshTokens)
 * @returns {{ accessToken, refreshToken }}
 */
const generateTokenPair = async (user) => {
  // Purge expired refresh tokens (keep array clean)
  user.purgeExpiredTokens();

  const accessToken = signAccessToken(user);
  const { token: refreshToken } = signRefreshToken(user);

  const expiresAt = new Date(Date.now() + expiryToMs(REFRESH_EXPIRES));
  user.refreshTokens.push({ token: refreshToken, expiresAt });
  user.lastLoginAt = new Date();
  await user.save();

  return { accessToken, refreshToken };
};

/**
 * Rotates a refresh token:
 *  1. Verify the incoming refresh token.
 *  2. Load user with +refreshTokens (select hidden field).
 *  3. Find the token in user.refreshTokens — if not found, it was already used
 *     (possible token theft). Remove ALL tokens for this user (security lockout).
 *  4. Remove old token, issue a new token pair.
 *
 * @param {string} oldRefreshToken
 * @returns {{ user, accessToken, refreshToken }}
 */
const rotateRefreshToken = async (oldRefreshToken) => {
  const User = require('../models/User');

  let decoded;
  try {
    decoded = verifyRefreshToken(oldRefreshToken);
  } catch (err) {
    const error = new Error('Invalid or expired refresh token.');
    error.statusCode = 401;
    throw error;
  }

  const user = await User.findById(decoded.sub).select('+refreshTokens +passwordHash');
  if (!user || !user.isActive) {
    const error = new Error('User not found or deactivated.');
    error.statusCode = 401;
    throw error;
  }

  const tokenIndex = user.refreshTokens.findIndex(
    (t) => t.token === oldRefreshToken
  );

  if (tokenIndex === -1) {
    // Token reuse detected — invalidate ALL sessions for this user
    user.refreshTokens = [];
    await user.save();
    const error = new Error(
      'Refresh token reuse detected. All sessions have been invalidated. Please log in again.'
    );
    error.statusCode = 401;
    throw error;
  }

  // Remove the used token
  user.refreshTokens.splice(tokenIndex, 1);

  // Issue new pair
  const { accessToken, refreshToken } = await generateTokenPair(user);
  return { user, accessToken, refreshToken };
};

/**
 * Revokes a specific refresh token for a user.
 * Used on logout.
 *
 * @param {Document} user
 * @param {string}   token  - The refresh token to revoke
 */
const revokeRefreshToken = async (user, token) => {
  user.refreshTokens = user.refreshTokens.filter((t) => t.token !== token);
  await user.save();
};

/**
 * Revokes ALL refresh tokens for a user.
 * Used for admin-forced logout.
 *
 * @param {Document} user
 */
const revokeAllRefreshTokens = async (user) => {
  user.refreshTokens = [];
  await user.save();
};

module.exports = {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  generateTokenPair,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
};
