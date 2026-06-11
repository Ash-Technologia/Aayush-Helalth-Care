'use strict';

const asyncHandler = require('express-async-handler');
const passport = require('passport');
const User = require('../models/User');
const {
  generateTokenPair,
  rotateRefreshToken,
  revokeRefreshToken,
} = require('../utils/tokenService');
const otpStore = require('../utils/otpStore');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds the safe user object to return in API responses.
 * NEVER returns passwordHash, refreshTokens, or other sensitive fields.
 */
const safeUser = (user) => ({
  _id: user._id,
  fullName: user.fullName,
  email: user.email || null,
  phone: user.phone || null,
  role: user.role,
  avatar: user.avatar || null,
  isEmailVerified: user.isEmailVerified,
  isPhoneVerified: user.isPhoneVerified,
  createdAt: user.createdAt,
});

/**
 * Sends OTP via Fast2SMS.
 * Falls back gracefully (logs to console) if API key is not configured.
 * Returns true on success, false on failure.
 *
 * @param {string} phone  - 10-digit Indian phone
 * @param {string} otp
 * @returns {Promise<boolean>}
 */
const sendSmsOtp = async (phone, otp) => {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey || apiKey.startsWith('REPLACE_')) {
    // Dev mode: print OTP to console
    console.log(`[OTP DEV] Phone: ${phone} | OTP: ${otp}`);
    return true;
  }

  try {
    const axios = require('axios');
    const response = await axios.get('https://www.fast2sms.com/dev/bulkV2', {
      params: {
        authorization: apiKey,
        variables_values: otp,
        route: 'otp',
        numbers: phone,
      },
      timeout: 10_000,
    });

    if (response.data && response.data.return === true) {
      return true;
    }
    console.error('[SMS] Fast2SMS error:', response.data);
    return false;
  } catch (err) {
    console.error('[SMS] Failed to send OTP:', err.message);
    return false;
  }
};

// ─── POST /api/v1/auth/register ───────────────────────────────────────────────
/**
 * Register with email + password.
 * Returns access token + refresh token on success.
 */
const register = asyncHandler(async (req, res) => {
  const { fullName, email, password, phone } = req.body;

  // Check for existing user (email or phone)
  const existingQuery = [];
  if (email) existingQuery.push({ email: email.toLowerCase() });
  if (phone) existingQuery.push({ phone });

  if (existingQuery.length > 0) {
    const existing = await User.findOne({ $or: existingQuery });
    if (existing) {
      if (existing.email === email?.toLowerCase()) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email already exists. Please log in.',
        });
      }
      if (existing.phone === phone) {
        return res.status(409).json({
          success: false,
          message: 'An account with this phone number already exists. Please log in.',
        });
      }
    }
  }

  // Create user — pre-save hook hashes the password
  const user = await User.create({
    fullName: fullName.trim(),
    email: email ? email.toLowerCase().trim() : undefined,
    phone: phone ? phone.trim() : undefined,
    passwordHash: password, // raw — pre-save hook hashes it
  });

  // Fetch fresh user with refreshTokens field for token generation
  const userWithTokens = await User.findById(user._id).select('+refreshTokens');
  const { accessToken, refreshToken } = await generateTokenPair(userWithTokens);

  res.status(201).json({
    success: true,
    message: 'Account created successfully.',
    data: {
      user: safeUser(user),
      accessToken,
      refreshToken,
    },
  });
});

// ─── POST /api/v1/auth/login ──────────────────────────────────────────────────
/**
 * Login with email + password.
 * Returns access token + refresh token on success.
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Fetch user including hidden fields needed for auth
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    '+passwordHash +refreshTokens'
  );

  if (!user) {
    // Generic message — don't reveal whether email exists
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password.',
    });
  }

  if (!user.passwordHash) {
    return res.status(401).json({
      success: false,
      message:
        'This account uses Google or phone login. Please use the appropriate login method.',
    });
  }

  if (!user.isActive) {
    return res.status(403).json({
      success: false,
      message: 'Your account has been deactivated. Please contact the clinic.',
    });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password.',
    });
  }

  const { accessToken, refreshToken } = await generateTokenPair(user);

  res.status(200).json({
    success: true,
    message: 'Logged in successfully.',
    data: {
      user: safeUser(user),
      accessToken,
      refreshToken,
    },
  });
});

// ─── POST /api/v1/auth/refresh ────────────────────────────────────────────────
/**
 * Rotates the refresh token.
 * Detects token reuse and invalidates all sessions if detected.
 */
const refresh = asyncHandler(async (req, res) => {
  const { refreshToken: oldToken } = req.body;

  if (!oldToken) {
    return res.status(400).json({
      success: false,
      message: 'Refresh token is required.',
    });
  }

  const { user, accessToken, refreshToken } = await rotateRefreshToken(oldToken);

  res.status(200).json({
    success: true,
    message: 'Token refreshed.',
    data: {
      user: safeUser(user),
      accessToken,
      refreshToken,
    },
  });
});

// ─── POST /api/v1/auth/logout ─────────────────────────────────────────────────
/**
 * Revokes the provided refresh token.
 * Requires a valid access token (protect middleware).
 */
const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    // Load user with refreshTokens to revoke the token
    const user = await User.findById(req.user.sub).select('+refreshTokens');
    if (user) {
      await revokeRefreshToken(user, refreshToken);
    }
  }

  res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
});

// ─── GET /api/v1/auth/me ──────────────────────────────────────────────────────
/**
 * Returns the currently authenticated user.
 * req.dbUser is attached by protect middleware.
 */
const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: { user: safeUser(req.dbUser) },
  });
});

// ─── POST /api/v1/auth/otp/send ───────────────────────────────────────────────
/**
 * Sends an OTP to a phone number.
 * Rate-limited at route level.
 */
const sendOtp = asyncHandler(async (req, res) => {
  const { phone } = req.body;

  // Prevent OTP spam: check if one was sent less than 60 seconds ago
  if (await otpStore.hasPendingOtp(phone)) {
    const ttl = await otpStore.getOtpTtlSeconds(phone);
    // Allow resend only if TTL is less than (expiry - 60s)
    const threshold =
      (parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10) - 1) * 60;
    if (ttl > threshold) {
      return res.status(429).json({
        success: false,
        message: `OTP already sent. Please wait 60 seconds before requesting again.`,
      });
    }
  }

  const otp = await otpStore.saveOtp(phone);
  const sent = await sendSmsOtp(phone, otp);

  if (!sent) {
    // Delete the OTP we just saved since it wasn't delivered
    await otpStore.deleteOtp(phone);
    return res.status(502).json({
      success: false,
      message: 'Failed to send OTP. Please try again or use email login.',
    });
  }

  res.status(200).json({
    success: true,
    message: `OTP sent to +91 ${phone}. Valid for ${process.env.OTP_EXPIRY_MINUTES || 10} minutes.`,
    // In development, the OTP is printed to console — do NOT return it in response
    ...(process.env.NODE_ENV === 'development' && { _devOtp: otp }),
  });
});

// ─── POST /api/v1/auth/otp/verify ────────────────────────────────────────────
/**
 * Verifies an OTP and returns tokens.
 * Finds or creates a user by phone number.
 */
const verifyOtp = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body;

  const result = await otpStore.verifyOtp(phone, otp);
  if (!result.valid) {
    return res.status(400).json({
      success: false,
      message: result.reason,
    });
  }

  // Find or create user by phone
  let user = await User.findOne({ phone }).select('+refreshTokens');
  let isNewUser = false;

  if (!user) {
    // New user — create account (name can be updated later from profile settings)
    user = await User.create({
      fullName: `User ${phone.slice(-4)}`, // Placeholder name
      phone,
      isPhoneVerified: true,
    });
    user = await User.findById(user._id).select('+refreshTokens');
    isNewUser = true;
  } else {
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact the clinic.',
      });
    }
    // Mark phone as verified if not already
    if (!user.isPhoneVerified) {
      user.isPhoneVerified = true;
      // save() is called inside generateTokenPair, so no need to save separately
    }
  }

  const { accessToken, refreshToken } = await generateTokenPair(user);

  res.status(isNewUser ? 201 : 200).json({
    success: true,
    message: isNewUser ? 'Account created successfully.' : 'Logged in successfully.',
    data: {
      user: safeUser(user),
      accessToken,
      refreshToken,
      isNewUser,
    },
  });
});

// ─── GET /api/v1/auth/google ──────────────────────────────────────────────────
/**
 * Initiates Google OAuth flow.
 * Passport redirects the user to Google's consent screen.
 */
const googleAuth = passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false,
});

const crypto = require('crypto');
const googleCodeMap = new Map();

const saveGoogleCode = (userId) => {
  const code = crypto.randomBytes(16).toString('hex');
  const expiresAt = Date.now() + 30_000; // 30 seconds
  googleCodeMap.set(code, { userId, expiresAt });
  return code;
};

const verifyGoogleCode = (code) => {
  const entry = googleCodeMap.get(code);
  if (!entry) return null;
  googleCodeMap.delete(code); // one-time use!
  if (entry.expiresAt <= Date.now()) return null;
  return entry.userId;
};

// Periodically clean up expired entries in googleCodeMap
setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of googleCodeMap.entries()) {
    if (entry.expiresAt <= now) googleCodeMap.delete(code);
  }
}, 30_000).unref?.();

// ─── GET /api/v1/auth/google/callback ────────────────────────────────────────
/**
 * Google OAuth callback.
 * On success: redirect to frontend with a short-lived exchange code.
 * On failure: redirect to frontend login with error query param.
 */
const googleCallback = (req, res, next) => {
  passport.authenticate('google', { session: false }, async (err, user, info) => {
    const frontendUrl = process.env.PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : '');

    if (!frontendUrl) {
      console.error('[Google OAuth] FRONTEND_URL is not configured. Set PUBLIC_FRONTEND_URL or FRONTEND_URL in production.');
    }

    if (err) {
      console.error('[Google OAuth] Error:', err.message);
      return res.redirect(
        `${frontendUrl}/auth/callback?error=${encodeURIComponent('Authentication failed. Please try again.')}`
      );
    }

    if (!user) {
      const message =
        info && info.message ? info.message : 'Google login failed.';
      return res.redirect(
        `${frontendUrl}/auth/callback?error=${encodeURIComponent(message)}`
      );
    }

    try {
      // Create short-lived code for Google OAuth flow
      const code = saveGoogleCode(user._id.toString());

      // Redirect to frontend callback route with code in query params
      return res.redirect(
        `${frontendUrl}/auth/callback?code=${code}`
      );
    } catch (tokenErr) {
      console.error('[Google OAuth] Code generation error:', tokenErr.message);
      return res.redirect(
        `${frontendUrl}/auth/callback?error=${encodeURIComponent('Login failed. Please try again.')}`
      );
    }
  })(req, res, next);
};

// ─── POST /api/v1/auth/google/exchange ───────────────────────────────────────
/**
 * Exchange a short-lived Google OAuth code for actual access + refresh tokens.
 * Keeps tokens out of URL parameters entirely.
 */
const googleExchange = asyncHandler(async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, message: 'Exchange code is required.' });
  }

  const userId = verifyGoogleCode(code);
  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired exchange code. Please try logging in again.',
    });
  }

  const user = await User.findById(userId).select('+refreshTokens');
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  if (!user.isActive) {
    return res.status(403).json({
      success: false,
      message: 'Your account has been deactivated. Please contact the clinic.',
    });
  }

  const { accessToken, refreshToken } = await generateTokenPair(user);

  res.status(200).json({
    success: true,
    message: 'Tokens exchanged successfully.',
    data: {
      user: safeUser(user),
      accessToken,
      refreshToken,
    },
  });
});

// ─── POST /api/v1/auth/request-otp ────────────────────────────────────────────
/**
 * Request an OTP (supports both Email and Phone)
 */
const requestOtp = asyncHandler(async (req, res) => {
  const { identifier, fullName } = req.body;
  if (!identifier) {
    return res.status(400).json({ success: false, message: 'Identifier (Email or Phone) is required.' });
  }

  const cleanId = identifier.trim().toLowerCase();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanId);
  const isPhone = /^[6-9]\d{9}$/.test(cleanId.replace(/\D/g, ''));

  if (!isEmail && !isPhone) {
    return res.status(400).json({ success: false, message: 'Please provide a valid email address or 10-digit mobile number.' });
  }

  const phone = isPhone ? cleanId.replace(/\D/g, '') : null;

  // Check if this is a new user (used by frontend for welcome message only — lightweight lean query)
  let existingUser;
  if (isEmail) {
    existingUser = await User.findOne({ email: cleanId }).select('_id').lean();
  } else {
    existingUser = await User.findOne({ phone }).select('_id').lean();
  }
  const isNewUser = !existingUser;

  // Prevent OTP spam: check if one was sent less than 60 seconds ago
  if (await otpStore.hasPendingOtp(cleanId)) {
    const ttl = await otpStore.getOtpTtlSeconds(cleanId);
    const threshold = (parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10) - 1) * 60;
    if (ttl > threshold) {
      return res.status(429).json({
        success: false,
        message: 'OTP already sent. Please wait 60 seconds before requesting again.',
      });
    }
  }

  const otp = await otpStore.saveOtp(cleanId);
  let sent = false;

  if (isEmail) {
    const { sendEmail } = require('../utils/emailService');
    const html = `
      <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">One-Time Password (OTP) Verification</h2>
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Please use the following 6-digit One-Time Password to verify your account. This code is valid for 10 minutes.</p>
      <div style="text-align:center;margin:32px 0;">
        <span style="font-size:36px;font-weight:800;letter-spacing:6px;color:#0d9488;background:#f3f4f6;padding:16px 32px;border-radius:12px;border:1px dashed #0d9488;">${otp}</span>
      </div>
      <p style="margin:0 0 12px;font-size:12px;color:#9ca3af;">If you did not request this verification, please ignore this email.</p>
    `;
    const mailRes = await sendEmail({
      to: cleanId,
      subject: `🔐 Your Verification Code: ${otp}`,
      html
    });
    sent = mailRes.success;
  } else {
    sent = await sendSmsOtp(phone, otp);
  }

  if (!sent) {
    await otpStore.deleteOtp(cleanId);
    return res.status(502).json({
      success: false,
      message: 'Failed to send OTP. Please try again.',
    });
  }

  res.status(200).json({
    success: true,
    message: 'OTP sent successfully.',
    data: { isNewUser },
    ...(process.env.NODE_ENV === 'development' && { _devOtp: otp }),
  });
});

// ─── POST /api/v1/auth/verify-otp ─────────────────────────────────────────────
/**
 * Verify OTP (supports both Email and Phone)
 */
const verifyOtpNew = asyncHandler(async (req, res) => {
  const { identifier, otp, fullName } = req.body;
  if (!identifier || !otp) {
    return res.status(400).json({ success: false, message: 'Identifier and OTP are required.' });
  }

  const cleanId = identifier.trim().toLowerCase();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanId);
  const isPhone = /^[6-9]\d{9}$/.test(cleanId.replace(/\D/g, ''));
  const phone = isPhone ? cleanId.replace(/\D/g, '') : null;

  const result = await otpStore.verifyOtp(cleanId, otp);
  if (!result.valid) {
    return res.status(400).json({ success: false, message: result.reason });
  }

  // Find or create user
  let user;
  let isNewUser = false;

  if (isEmail) {
    user = await User.findOne({ email: cleanId }).select('+refreshTokens');
    if (!user) {
      user = await User.create({
        fullName: fullName ? fullName.trim() : `User ${cleanId.split('@')[0]}`,
        email: cleanId,
        isEmailVerified: true,
      });
      user = await User.findById(user._id).select('+refreshTokens');
      isNewUser = true;
    } else {
      if (!user.isActive) {
        return res.status(403).json({ success: false, message: 'Your account has been deactivated. Please contact the clinic.' });
      }
      if (!user.isEmailVerified) {
        user.isEmailVerified = true;
      }
    }
  } else {
    user = await User.findOne({ phone }).select('+refreshTokens');
    if (!user) {
      user = await User.create({
        fullName: fullName ? fullName.trim() : `User ${phone.slice(-4)}`,
        phone,
        isPhoneVerified: true,
      });
      user = await User.findById(user._id).select('+refreshTokens');
      isNewUser = true;
    } else {
      if (!user.isActive) {
        return res.status(403).json({ success: false, message: 'Your account has been deactivated. Please contact the clinic.' });
      }
      if (!user.isPhoneVerified) {
        user.isPhoneVerified = true;
      }
    }
  }

  const { accessToken, refreshToken } = await generateTokenPair(user);

  res.status(isNewUser ? 201 : 200).json({
    success: true,
    message: isNewUser ? 'Account created successfully.' : 'Logged in successfully.',
    data: {
      user: safeUser(user),
      accessToken,
      refreshToken,
      isNewUser,
    },
  });
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  getMe,
  sendOtp,
  verifyOtp,
  googleAuth,
  googleCallback,
  requestOtp,
  verifyOtpNew,
  googleExchange,
};
