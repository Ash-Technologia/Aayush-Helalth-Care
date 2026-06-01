'use strict';

const asyncHandler = require('express-async-handler');
const path = require('path');
const sharp = require('sharp');
const DoctorProfile = require('../../models/DoctorProfile');
const { ensureUploadDir } = require('../../middleware/upload');

// ─── GET /api/v1/admin/profile ────────────────────────────────────────────────
/**
 * Returns the FULL doctor profile (including payment settings).
 * Admin sees more than the public GET /api/v1/profile/doctor.
 */
const getProfile = asyncHandler(async (req, res) => {
  const profile = await DoctorProfile.getSingleton();
  res.status(200).json({ success: true, data: { profile } });
});

// ─── PUT /api/v1/admin/profile ────────────────────────────────────────────────
/**
 * Updates doctor profile fields.
 * Uses dot-notation updates so only provided fields are changed.
 * Supports nested payment.* fields.
 */
const updateProfile = asyncHandler(async (req, res) => {
  const allowedTopLevel = [
    'name', 'tagline', 'about', 'degrees', 'achievements',
    'experience', 'specializations', 'consultationFee',
    'clinicTimings', 'breakTimings', 'address',
    'contactEmail', 'contactPhone', 'whatsappNumber',
    'isEmergencyClosed', 'emergencyMessage',
    'stats',
  ];

  const allowedPayment = ['upiId', 'accountName', 'instructions'];

  const updates = {};

  for (const key of allowedTopLevel) {
    if (req.body[key] !== undefined) {
      updates[key] = req.body[key];
    }
  }

  // Handle nested payment fields: req.body.payment.upiId etc.
  if (req.body.payment && typeof req.body.payment === 'object') {
    for (const key of allowedPayment) {
      if (req.body.payment[key] !== undefined) {
        updates[`payment.${key}`] = req.body.payment[key];
      }
    }
  }

  const profile = await DoctorProfile.findOneAndUpdate(
    {},
    { $set: updates },
    { new: true, runValidators: true, upsert: true }
  );

  res.status(200).json({
    success: true,
    message: 'Doctor profile updated successfully.',
    data: { profile },
  });
});

// ─── POST /api/v1/admin/profile/qr ───────────────────────────────────────────
/**
 * Uploads / replaces the UPI QR code image.
 * Stored at /uploads/qr/clinic-qr.jpg (fixed path).
 * Updates DoctorProfile.payment.qrImageUrl.
 */
const uploadQrCode = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'QR code image is required.' });
  }

  // qrUpload uses disk storage — file is already saved, just update the DB path
  const qrUrl = `/uploads/qr/${req.file.filename}`;

  const profile = await DoctorProfile.findOneAndUpdate(
    {},
    { $set: { 'payment.qrImageUrl': qrUrl } },
    { new: true, upsert: true }
  );

  res.status(200).json({
    success: true,
    message: 'QR code uploaded successfully.',
    data: { qrImageUrl: qrUrl },
  });
});

// ─── POST /api/v1/admin/profile/photo ────────────────────────────────────────
/**
 * Uploads / replaces the doctor's profile photo.
 * Processes with Sharp (max 800x800, JPEG 90%) for consistent quality.
 * Updates DoctorProfile.imageUrl.
 */
const uploadDoctorPhoto = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Doctor photo is required.' });
  }

  // If using memory storage, process with Sharp and save
  const photoDir = ensureUploadDir('doctor');
  const filename = 'doctor-photo.jpg';
  const filepath = path.join(photoDir, filename);

  try {
    await sharp(req.file.buffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toFile(filepath);
  } catch (err) {
    console.error('[Sharp] Doctor photo processing failed:', err.message);
    return res.status(422).json({
      success: false,
      message: 'Failed to process the uploaded photo. Please try a different file.',
    });
  }

  const photoUrl = `/uploads/doctor/${filename}`;
  const profile = await DoctorProfile.findOneAndUpdate(
    {},
    { $set: { imageUrl: photoUrl } },
    { new: true, upsert: true }
  );

  res.status(200).json({
    success: true,
    message: 'Doctor photo uploaded successfully.',
    data: { imageUrl: photoUrl },
  });
});

// ─── PATCH /api/v1/admin/profile/emergency ───────────────────────────────────
/**
 * Toggles the emergency closure flag.
 * Quick action from dashboard — no need to open full profile editor.
 */
const toggleEmergencyClosure = asyncHandler(async (req, res) => {
  const { isEmergencyClosed, emergencyMessage } = req.body;

  const updates = { isEmergencyClosed: Boolean(isEmergencyClosed) };
  if (emergencyMessage !== undefined) updates.emergencyMessage = emergencyMessage.trim();

  const profile = await DoctorProfile.findOneAndUpdate(
    {},
    { $set: updates },
    { new: true, upsert: true }
  );

  res.status(200).json({
    success: true,
    message: isEmergencyClosed
      ? `Clinic marked as closed: ${profile.emergencyMessage}`
      : 'Clinic reopened — bookings are available.',
    data: {
      isEmergencyClosed: profile.isEmergencyClosed,
      emergencyMessage: profile.emergencyMessage,
    },
  });
});

module.exports = { getProfile, updateProfile, uploadQrCode, uploadDoctorPhoto, toggleEmergencyClosure };
