'use strict';

const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const User = require('../../models/User');
const Appointment = require('../../models/Appointment');

// ─── GET /api/v1/admin/users ──────────────────────────────────────────────────
/**
 * Lists all non-admin users with optional search.
 */
const listUsers = asyncHandler(async (req, res) => {
  const { search, isActive, page = 1, limit = 20 } = req.query;
  const pageNum  = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip     = (pageNum - 1) * limitNum;

  const filter = { role: 'user' }; // never expose other admins in user list

  if (isActive !== undefined) filter.isActive = isActive === 'true';

  if (search && search.trim()) {
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { fullName: { $regex: escaped, $options: 'i' } },
      { email:    { $regex: escaped, $options: 'i' } },
      { phone:    { $regex: escaped, $options: 'i' } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('-passwordHash -refreshTokens')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    User.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: {
      users,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    },
  });
});

// ─── GET /api/v1/admin/users/:id ─────────────────────────────────────────────
/**
 * Gets a single user's profile + their appointment history.
 */
const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid user ID.' });
  }

  const [user, appointments] = await Promise.all([
    User.findById(id)
      .select('-passwordHash -refreshTokens')
      .lean(),
    Appointment.find({ user: id })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('appointmentDate slotStart consultationType status feeSnapshot createdAt')
      .lean(),
  ]);

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  res.status(200).json({ success: true, data: { user, appointments } });
});

// ─── PATCH /api/v1/admin/users/:id/deactivate ────────────────────────────────
const deactivateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid user ID.' });
  }

  // Prevent admin from deactivating themselves
  if (id === req.dbUser._id.toString()) {
    return res.status(400).json({ success: false, message: 'Cannot deactivate your own account.' });
  }

  const user = await User.findByIdAndUpdate(
    id,
    { isActive: false, refreshTokens: [] }, // revoke all sessions
    { new: true }
  ).select('-passwordHash -refreshTokens');

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  res.status(200).json({
    success: true,
    message: `User '${user.fullName}' has been deactivated. All sessions invalidated.`,
    data: { userId: user._id, isActive: false },
  });
});

// ─── PATCH /api/v1/admin/users/:id/activate ──────────────────────────────────
const activateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid user ID.' });
  }

  const user = await User.findByIdAndUpdate(
    id,
    { isActive: true },
    { new: true }
  ).select('-passwordHash -refreshTokens');

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  res.status(200).json({
    success: true,
    message: `User '${user.fullName}' has been reactivated.`,
    data: { userId: user._id, isActive: true },
  });
});

module.exports = { listUsers, getUserById, deactivateUser, activateUser };
