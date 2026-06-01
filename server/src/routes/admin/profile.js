'use strict';

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const {
  getProfile, updateProfile, uploadQrCode, uploadDoctorPhoto, toggleEmergencyClosure,
} = require('../../controllers/admin/profileController');
const { validate } = require('../../middleware/validate');
const { qrUpload, doctorPhotoUpload, singleImageUpload, handleUploadError } = require('../../middleware/upload');

// GET /api/v1/admin/profile
router.get('/', getProfile);

// PUT /api/v1/admin/profile
router.put(
  '/',
  [
    body('name').optional().isString().isLength({ max: 100 }),
    body('consultationFee').optional().isFloat({ min: 0 }),
    body('contactEmail').optional().isEmail(),
    body('contactPhone').optional().matches(/^[6-9]\d{9}$/),
    body('isEmergencyClosed').optional().isBoolean(),
  ],
  validate,
  updateProfile
);

// POST /api/v1/admin/profile/qr  — multipart/form-data, field: 'qr'
router.post(
  '/qr',
  qrUpload.single('qr'),
  handleUploadError,
  uploadQrCode
);

// POST /api/v1/admin/profile/photo  — multipart/form-data, field: 'photo'
router.post(
  '/photo',
  singleImageUpload.single('photo'),
  handleUploadError,
  uploadDoctorPhoto
);

// PATCH /api/v1/admin/profile/emergency
router.patch(
  '/emergency',
  [
    body('isEmergencyClosed').isBoolean().withMessage('isEmergencyClosed must be boolean.'),
    body('emergencyMessage')
      .if(body('isEmergencyClosed').equals('true'))
      .notEmpty().withMessage('emergencyMessage is required when closing the clinic.')
      .isLength({ max: 300 }),
  ],
  validate,
  toggleEmergencyClosure
);

module.exports = router;
