'use strict';

const express = require('express');
const router = express.Router();
const { getDoctorProfile, getWebsiteContent } = require('../controllers/profileController');
const { optionalAuth } = require('../middleware/auth');

// Both endpoints are public — no auth required.
// optionalAuth allows future logged-in personalisation without breaking guests.

// GET /api/v1/profile/doctor
router.get('/doctor', optionalAuth, getDoctorProfile);

// GET /api/v1/profile/content
router.get('/content', optionalAuth, getWebsiteContent);

module.exports = router;
