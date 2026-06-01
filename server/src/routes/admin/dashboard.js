'use strict';

const express = require('express');
const router = express.Router();
const { getDashboard } = require('../../controllers/admin/dashboardController');

// GET /api/v1/admin/dashboard
router.get('/', getDashboard);

module.exports = router;
