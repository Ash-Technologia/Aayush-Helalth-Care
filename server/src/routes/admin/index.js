'use strict';

/**
 * Admin routes index — mounts all admin sub-routers.
 *
 * Auth flow:
 *   - POST /api/v1/admin/login  — public (no middleware)
 *   - All other /api/v1/admin/* — require valid JWT + role === 'admin'
 *
 * Each sub-router is loaded lazily; missing files are skipped
 * with a console.warn so the app starts cleanly during development.
 */
const express = require('express');
const router = express.Router();
const { protect, requireAdmin } = require('../../middleware/auth');

// ─── Public admin route (no auth required) ────────────────────────────────────
try {
  router.use('/login', require('./auth'));
} catch (err) {
  console.warn(`[Admin Routes] Could not load '/login': ${err.message}`);
}

// ─── Guard: all routes below require valid JWT + admin role ───────────────────
router.use(protect, requireAdmin);

// ─── Protected admin routes ───────────────────────────────────────────────────
const mountAdmin = (path, file) => {
  try {
    router.use(path, require(file));
  } catch (err) {
    console.warn(`[Admin Routes] Could not load '${path}': ${err.message}`);
  }
};

mountAdmin('/dashboard',    './dashboard');
mountAdmin('/payments',     './payments');
mountAdmin('/appointments', './appointments');
mountAdmin('/slots',        './slots');
mountAdmin('/profile',      './profile');
mountAdmin('/content',      './content');
mountAdmin('/users',        './users');

module.exports = router;
