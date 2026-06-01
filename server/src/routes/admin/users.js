'use strict';

const express = require('express');
const { param, query } = require('express-validator');
const router = express.Router();
const { listUsers, getUserById, deactivateUser, activateUser } = require('../../controllers/admin/usersController');
const { validate } = require('../../middleware/validate');

// GET  /api/v1/admin/users
router.get(
  '/',
  [
    query('search').optional().isString().isLength({ max: 100 }),
    query('isActive').optional().isIn(['true', 'false']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  listUsers
);

// GET  /api/v1/admin/users/:id
router.get('/:id', [param('id').isMongoId()], validate, getUserById);

// PATCH /api/v1/admin/users/:id/deactivate
router.patch('/:id/deactivate', [param('id').isMongoId()], validate, deactivateUser);

// PATCH /api/v1/admin/users/:id/activate
router.patch('/:id/activate', [param('id').isMongoId()], validate, activateUser);

module.exports = router;
