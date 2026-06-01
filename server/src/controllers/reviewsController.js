'use strict';

const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Review = require('../models/Review');
const Appointment = require('../models/Appointment');

// ─── GET /api/v1/reviews ──────────────────────────────────────────────────────
/**
 * Returns paginated list of visible, verified reviews.
 * Includes average rating and total count in the response.
 */
const getReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 9 } = req.query;
  const pageNum  = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
  const skip     = (pageNum - 1) * limitNum;

  const filter = { isVisible: true };

  const [reviews, total, ratingData] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('user', 'fullName avatar')
      .lean(),
    Review.countDocuments(filter),
    Review.getAverageRating(),
  ]);

  // Mask full name — show first name + last initial only (e.g. "Aayush S.")
  const safeReviews = reviews.map((r) => {
    const nameParts = (r.user?.fullName || 'Patient').split(' ');
    const displayName =
      nameParts.length > 1
        ? `${nameParts[0]} ${nameParts[nameParts.length - 1].charAt(0)}.`
        : nameParts[0];

    return {
      _id:       r._id,
      rating:    r.rating,
      comment:   r.comment,
      isVerified: r.isVerified,
      createdAt: r.createdAt,
      patient: {
        displayName,
        avatar: r.user?.avatar || null,
      },
    };
  });

  res.status(200).json({
    success: true,
    data: {
      reviews: safeReviews,
      stats: ratingData,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    },
  });
});

// ─── POST /api/v1/reviews ─────────────────────────────────────────────────────
/**
 * Submits a review for a completed appointment.
 *
 * Rules:
 *   - User must be authenticated
 *   - Appointment must exist + belong to user
 *   - Appointment status must be 'completed'
 *   - One review per appointment (enforced by unique index)
 */
const createReview = asyncHandler(async (req, res) => {
  const { appointmentId, rating, comment } = req.body;
  const user = req.dbUser;

  if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
    return res.status(400).json({ success: false, message: 'Invalid appointmentId.' });
  }

  // Find the appointment
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    return res.status(404).json({ success: false, message: 'Appointment not found.' });
  }

  // Ownership check
  if (!appointment.user.equals(user._id)) {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }

  // Only completed appointments can be reviewed
  if (appointment.status !== 'completed') {
    return res.status(400).json({
      success: false,
      message: 'Reviews can only be submitted for completed appointments.',
    });
  }

  // Check if review already exists for this appointment
  const existingReview = await Review.findOne({ appointment: appointmentId });
  if (existingReview) {
    return res.status(409).json({
      success: false,
      message: 'You have already submitted a review for this appointment.',
    });
  }

  const review = await Review.create({
    user:        user._id,
    appointment: appointmentId,
    rating:      parseInt(rating, 10),
    comment:     comment ? comment.trim() : '',
    isVerified:  true,
    isVisible:   true,
  });

  res.status(201).json({
    success: true,
    message: 'Thank you for your review!',
    data: {
      review: {
        _id:       review._id,
        rating:    review.rating,
        comment:   review.comment,
        createdAt: review.createdAt,
      },
    },
  });
});

// ─── GET /api/v1/reviews/eligible ────────────────────────────────────────────
/**
 * Returns the list of completed appointments for which the current user
 * has NOT yet submitted a review.
 * Used by the frontend to show the "Write a Review" prompt.
 */
const getEligibleForReview = asyncHandler(async (req, res) => {
  const user = req.dbUser;

  // Find all completed appointments for this user
  const completedAppointments = await Appointment.find({
    user: user._id,
    status: 'completed',
  }).select('_id appointmentDate slotStart consultationType').lean();

  if (completedAppointments.length === 0) {
    return res.status(200).json({ success: true, data: { eligible: [] } });
  }

  // Find which ones already have reviews
  const reviewedIds = await Review.find({
    appointment: { $in: completedAppointments.map((a) => a._id) },
  }).distinct('appointment');

  const reviewedSet = new Set(reviewedIds.map((id) => id.toString()));

  const eligible = completedAppointments.filter(
    (a) => !reviewedSet.has(a._id.toString())
  );

  res.status(200).json({
    success: true,
    data: { eligible },
  });
});

module.exports = { getReviews, createReview, getEligibleForReview };
