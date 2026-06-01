'use strict';

const asyncHandler = require('express-async-handler');
const User = require('../../models/User');
const { generateTokenPair } = require('../../utils/tokenService');

// ─── Shared safe user formatter ───────────────────────────────────────────────
const safeUser = (user) => ({
  _id:             user._id,
  fullName:        user.fullName,
  email:           user.email || null,
  phone:           user.phone || null,
  role:            user.role,
  avatar:          user.avatar || null,
  isEmailVerified: user.isEmailVerified,
  isPhoneVerified: user.isPhoneVerified,
  createdAt:       user.createdAt,
});

// ─── POST /api/v1/admin/login ─────────────────────────────────────────────────
/**
 * Admin-only login endpoint.
 * Checks email + password AND role === 'admin'.
 * Returns the same JWT token pair as the regular login.
 * Using a separate endpoint keeps the admin surface isolated from the
 * public /api/v1/auth/login (which serves all roles).
 */
const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    '+passwordHash +refreshTokens'
  );

  // Intentionally generic error — don't reveal whether email exists or role
  const INVALID_MSG = 'Invalid credentials.';

  if (!user || !user.passwordHash) {
    return res.status(401).json({ success: false, message: INVALID_MSG });
  }

  if (user.role !== 'admin') {
    return res.status(401).json({ success: false, message: INVALID_MSG });
  }

  if (!user.isActive) {
    return res.status(403).json({
      success: false,
      message: 'Admin account is deactivated. Contact system administrator.',
    });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: INVALID_MSG });
  }

  const { accessToken, refreshToken } = await generateTokenPair(user);

  res.status(200).json({
    success: true,
    message:  'Admin logged in successfully.',
    data: {
      user: safeUser(user),
      accessToken,
      refreshToken,
    },
  });
});

module.exports = { adminLogin };
