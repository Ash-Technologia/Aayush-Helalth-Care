'use strict';

const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Appointment = require('../../models/Appointment');
const PaymentSubmission = require('../../models/PaymentSubmission');
const Review = require('../../models/Review');
const User = require('../../models/User');

// ─── GET /api/v1/admin/dashboard ─────────────────────────────────────────────
/**
 * Returns all stats needed for the admin dashboard in a single request.
 * Uses parallel aggregations for performance.
 */
const getDashboard = asyncHandler(async (req, res) => {
  const now = new Date();

  // ── Date boundaries ──────────────────────────────────────────────────────
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const todayEnd = new Date(todayStart.getTime() + 86_400_000 - 1);

  // Start of current week (Monday)
  const dayOfWeek = now.getUTCDay(); // 0=Sun
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(todayStart.getTime() - daysToMonday * 86_400_000);

  // Start of current month
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  // ── Parallel queries ─────────────────────────────────────────────────────
  const [
    statusCounts,
    todayCount,
    weekRevenue,
    monthRevenue,
    pendingReviewCount,
    totalUsers,
    totalReviews,
    recentPending,
    todayAppointments,
  ] = await Promise.all([
    // 1. Appointment counts by status
    Appointment.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    // 2. Today's total appointment count
    Appointment.countDocuments({
      appointmentDate: { $gte: todayStart, $lte: todayEnd },
      status: { $nin: ['expired', 'cancelled', 'payment_rejected'] },
    }),

    // 3. This week's revenue (confirmed + completed)
    Appointment.aggregate([
      {
        $match: {
          appointmentDate: { $gte: weekStart, $lte: todayEnd },
          status: { $in: ['confirmed', 'completed'] },
        },
      },
      { $group: { _id: null, total: { $sum: '$feeSnapshot' } } },
    ]),

    // 4. This month's revenue
    Appointment.aggregate([
      {
        $match: {
          appointmentDate: { $gte: monthStart },
          status: { $in: ['confirmed', 'completed'] },
        },
      },
      { $group: { _id: null, total: { $sum: '$feeSnapshot' } } },
    ]),

    // 5. Pending payment review count (admin notification badge)
    PaymentSubmission.countDocuments({ status: 'submitted' }),

    // 6. Total registered users
    User.countDocuments({ role: 'user' }),

    // 7. Total visible reviews
    Review.countDocuments({ isVisible: true }),

    // 8. 5 most recent pending payment submissions (for dashboard list)
    PaymentSubmission.find({ status: 'submitted' })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('user', 'fullName phone email')
      .populate({
        path: 'appointment',
        select: 'appointmentDate slotStart consultationType feeSnapshot patientName',
      })
      .lean(),

    // 9. Today's appointments (for quick view)
    Appointment.find({
      appointmentDate: { $gte: todayStart, $lte: todayEnd },
      status: { $in: ['confirmed', 'pending_approval'] },
    })
      .sort({ slotStart: 1 })
      .limit(10)
      .populate('paymentSubmission', 'status')
      .lean(),
  ]);

  // ── Format status counts into a map ──────────────────────────────────────
  const statusMap = {};
  for (const { _id, count } of statusCounts) {
    statusMap[_id] = count;
  }

  res.status(200).json({
    success: true,
    data: {
      appointments: {
        pendingApproval:  statusMap.pending_approval   || 0,
        confirmed:        statusMap.confirmed          || 0,
        completed:        statusMap.completed          || 0,
        cancelled:        statusMap.cancelled          || 0,
        paymentRejected:  statusMap.payment_rejected   || 0,
        awaitingPayment:  statusMap.awaiting_payment   || 0,
        total: Object.values(statusMap).reduce((s, v) => s + v, 0),
        today: todayCount,
      },
      revenue: {
        thisWeek:  weekRevenue[0]?.total  || 0,
        thisMonth: monthRevenue[0]?.total || 0,
      },
      pendingReviewCount,
      totalUsers,
      totalReviews,
      recentPending,
      todayAppointments,
    },
  });
});

module.exports = { getDashboard };
