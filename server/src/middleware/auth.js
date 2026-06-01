'use strict';

const { verifyAccessToken } = require('../utils/tokenService');

/**
 * Extracts the Bearer token from the Authorization header.
 * Returns null if not present or malformed.
 */
const extractBearerToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  return token && token.trim() !== '' ? token.trim() : null;
};

// ─── protect ─────────────────────────────────────────────────────────────────
/**
 * Middleware: Requires a valid access token.
 * Attaches the decoded payload to req.user: { sub (userId), role }
 * then loads the full user document and attaches as req.dbUser.
 *
 * Fails with 401 if:
 *   - No token provided
 *   - Token is invalid or expired
 *   - User not found in DB
 *   - User is deactivated
 */
const protect = async (req, res, next) => {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in.',
    });
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please refresh your token.',
        code: 'TOKEN_EXPIRED',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token.',
    });
  }

  // Lazy-load User model to avoid circular deps at startup
  const User = require('../models/User');
  const user = await User.findById(decoded.sub).select(
    '-refreshTokens -passwordHash'
  );

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'User account not found.',
    });
  }

  if (!user.isActive) {
    return res.status(403).json({
      success: false,
      message: 'Your account has been deactivated. Please contact the clinic.',
    });
  }

  // Attach to request for downstream use
  req.user = decoded;       // { sub, role, iat, exp }
  req.dbUser = user;        // full Mongoose document (no sensitive fields)
  next();
};

// ─── requireAdmin ─────────────────────────────────────────────────────────────
/**
 * Middleware: Must be used AFTER protect.
 * Requires the authenticated user to have role === 'admin'.
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.',
    });
  }
  next();
};

// ─── optionalAuth ─────────────────────────────────────────────────────────────
/**
 * Middleware: Tries to authenticate but does NOT fail if no token.
 * Attaches req.user and req.dbUser if token is valid.
 * Used for public routes that show extra content to logged-in users
 * (e.g., homepage review section shows "Write a Review" if logged in).
 */
const optionalAuth = async (req, res, next) => {
  const token = extractBearerToken(req);
  if (!token) return next(); // no token — continue as guest

  try {
    const decoded = verifyAccessToken(token);
    const User = require('../models/User');
    const user = await User.findById(decoded.sub).select(
      '-refreshTokens -passwordHash'
    );
    if (user && user.isActive) {
      req.user = decoded;
      req.dbUser = user;
    }
  } catch {
    // Silently ignore invalid/expired tokens in optional mode
  }
  next();
};

module.exports = { protect, requireAdmin, optionalAuth };
