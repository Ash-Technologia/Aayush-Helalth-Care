'use strict';

const mongoose = require('mongoose');

// ─── Review Schema ────────────────────────────────────────────────────────────
// One review per completed appointment — enforced by unique index on 'appointment'.
// Only users with a 'completed' appointment can leave a review (validated at route level).
const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required.'],
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: [true, 'Appointment reference is required.'],
      unique: true, // one review per appointment — spec requirement
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required.'],
      min: [1, 'Rating must be at least 1.'],
      max: [5, 'Rating cannot exceed 5.'],
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [500, 'Review comment cannot exceed 500 characters.'],
      default: '',
    },
    // Admin can hide inappropriate reviews without deleting
    isVisible: {
      type: Boolean,
      default: true,
    },
    // All reviews from completed appointments are treated as verified
    isVerified: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Public review listing — only visible reviews, newest first
reviewSchema.index({ isVisible: 1, createdAt: -1 });

// User's reviews (for "have I reviewed this appointment?" checks)
reviewSchema.index({ user: 1 });

// ─── Static: Compute average rating from all visible reviews ──────────────────
reviewSchema.statics.getAverageRating = async function () {
  const result = await this.aggregate([
    { $match: { isVisible: true } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  if (!result.length) return { averageRating: 0, totalReviews: 0 };

  return {
    averageRating: Math.round(result[0].averageRating * 10) / 10, // 1 decimal place
    totalReviews: result[0].totalReviews,
  };
};

const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;
