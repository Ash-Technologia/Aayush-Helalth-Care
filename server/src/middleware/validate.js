'use strict';

const { validationResult } = require('express-validator');

/**
 * Middleware: Runs after express-validator chains.
 * If validation errors exist, returns a 422 with all error messages.
 * Otherwise calls next().
 *
 * Usage:
 *   router.post('/register', [
 *     body('email').isEmail(),
 *     body('password').isLength({ min: 8 }),
 *     validate,           ← insert AFTER all check() chains, BEFORE controller
 *     authController.register,
 *   ]);
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Return all field errors in a consistent shape
    const formatted = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
    }));
    return res.status(422).json({
      success: false,
      message: 'Validation failed.',
      errors: formatted,
    });
  }
  next();
};

module.exports = { validate };
