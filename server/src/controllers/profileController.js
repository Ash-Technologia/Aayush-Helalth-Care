'use strict';

const asyncHandler = require('express-async-handler');
const DoctorProfile = require('../models/DoctorProfile');
const WebsiteContent = require('../models/WebsiteContent');
const Review = require('../models/Review');

// ─── GET /api/v1/profile/doctor ───────────────────────────────────────────────
/**
 * Returns the public-facing doctor profile.
 * Includes computed average rating and review count from the Review collection.
 * Excludes internal admin-only fields (isEmergencyClosed admin reason, etc.).
 */
const getDoctorProfile = asyncHandler(async (req, res) => {
  const [profile, ratingData] = await Promise.all([
    DoctorProfile.getSingleton(),
    Review.getAverageRating(),
  ]);

  // Build a safe public response — omit sensitive payment details
  // (payment.qrImageUrl is fetched separately during booking via the lock endpoint)
  const publicProfile = {
    name:             profile.name,
    imageUrl:         profile.imageUrl,
    tagline:          profile.tagline,
    degrees:          profile.degrees.filter(Boolean).sort((a, b) => a.order - b.order),
    achievements:     profile.achievements.filter(Boolean).sort((a, b) => a.order - b.order),
    experience:       profile.experience,
    about:            profile.about,
    specializations:  profile.specializations,
    consultationFee:  profile.consultationFee,
    clinicTimings:    profile.clinicTimings,
    breakTimings:     profile.breakTimings,
    address:          profile.address,
    contactEmail:     profile.contactEmail,
    contactPhone:     profile.contactPhone,
    whatsappNumber:   profile.whatsappNumber,
    isEmergencyClosed: profile.isEmergencyClosed,
    emergencyMessage:  profile.isEmergencyClosed ? profile.emergencyMessage : null,
    stats:            profile.stats,
    // Computed from Review collection
    averageRating:    ratingData.averageRating,
    totalReviews:     ratingData.totalReviews,
  };

  res.status(200).json({
    success: true,
    data: { profile: publicProfile },
  });
});

// ─── GET /api/v1/profile/content ──────────────────────────────────────────────
/**
 * Returns the CMS website content singleton.
 * Used by: Homepage sections, SEO meta tags.
 */
const getWebsiteContent = asyncHandler(async (req, res) => {
  const content = await WebsiteContent.getSingleton();

  // Only return visible services and FAQs
  const publicContent = {
    hero:     content.hero,
    about:    content.about,
    services: content.services
      .filter((s) => s.isVisible)
      .sort((a, b) => a.order - b.order),
    faqs: content.faqs
      .filter((f) => f.isVisible)
      .sort((a, b) => a.order - b.order),
    seo:      content.seo,
    updatedAt: content.updatedAt,
  };

  res.status(200).json({
    success: true,
    data: { content: publicContent },
  });
});

module.exports = { getDoctorProfile, getWebsiteContent };
