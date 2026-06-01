'use strict';

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ─── Allowed MIME types ───────────────────────────────────────────────────────
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];

// ─── File type filter ─────────────────────────────────────────────────────────
const imageFileFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new multer.MulterError(
        'LIMIT_UNEXPECTED_FILE',
        `Only image files are allowed (JPEG, PNG, WebP, HEIC). Received: ${file.mimetype}`
      ),
      false
    );
  }
};

// ─── Memory storage ───────────────────────────────────────────────────────────
// Used for files that need Sharp processing before writing to disk.
// The controller reads req.file.buffer and pipes it through Sharp.
const memoryStorage = multer.memoryStorage();

// ─── Disk storage factory ─────────────────────────────────────────────────────
// Used for files that don't need processing (admin QR, doctor photo).
// Creates the destination directory automatically.
const createDiskStorage = (subDir, getFilename) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = process.env.UPLOAD_DIR || 'uploads';
      const dest = path.join(
        __dirname,
        '..',
        '..',
        uploadDir,
        subDir
      );
      fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
    },
    filename: (req, file, cb) => {
      cb(null, getFilename(req, file));
    },
  });
};

// ─── Upload Configurations ────────────────────────────────────────────────────

/**
 * Payment screenshot upload.
 * Memory storage — Sharp processes buffer in controller.
 * Limit: 15MB (client-side compression brings it down to ~800KB before upload).
 */
const screenshotUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: imageFileFilter,
});

/**
 * Admin: UPI QR code upload.
 * Disk storage — always overwrites the same filename: clinic-qr.jpg
 * Limit: 5MB.
 */
const qrUpload = multer({
  storage: createDiskStorage('qr', () => 'clinic-qr.jpg'),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: imageFileFilter,
});

/**
 * Admin: Doctor photo upload.
 * Disk storage — always overwrites the same filename: doctor-photo.jpg
 * Limit: 10MB.
 */
const doctorPhotoUpload = multer({
  storage: createDiskStorage('doctor', () => 'doctor-photo.jpg'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: imageFileFilter,
});

/**
 * General single-image upload for admin (OG image, etc.).
 * Memory storage.
 * Limit: 5MB.
 */
const singleImageUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});

// ─── Multer error handler ─────────────────────────────────────────────────────
/**
 * Middleware to convert Multer errors into consistent API error responses.
 * Must be placed after the multer middleware in the route chain.
 */
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: 'File is too large. Please upload a smaller image.',
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: err.message || 'Unexpected file field.',
      });
    }
    return res.status(400).json({
      success: false,
      message: `File upload error: ${err.message}`,
    });
  }
  next(err);
};

// ─── Helper: ensure upload directory exists ───────────────────────────────────
const ensureUploadDir = (subDir) => {
  const uploadDir = process.env.UPLOAD_DIR || 'uploads';
  const fullPath = path.join(__dirname, '..', '..', uploadDir, subDir);
  fs.mkdirSync(fullPath, { recursive: true });
  return fullPath;
};

// ─── Helper: build public URL from relative path ──────────────────────────────
const toPublicUrl = (relativePath) => {
  // relativePath: /uploads/payment-screenshots/payment_xxx.jpg
  // Returns it as-is — frontend prepends the API base URL
  return relativePath;
};

module.exports = {
  screenshotUpload,
  qrUpload,
  doctorPhotoUpload,
  singleImageUpload,
  handleUploadError,
  ensureUploadDir,
  toPublicUrl,
};
