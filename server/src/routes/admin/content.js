'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();
const {
  getContent,
  updateHero, updateAbout, updateSeo,
  addService, updateService, deleteService,
  addFaq, updateFaq, deleteFaq,
} = require('../../controllers/admin/contentController');
const { validate } = require('../../middleware/validate');

// GET /api/v1/admin/content
router.get('/', getContent);

// PUT /api/v1/admin/content/hero
router.put(
  '/hero',
  [
    body('headline').optional().isString().isLength({ max: 150 }),
    body('subheadline').optional().isString().isLength({ max: 300 }),
    body('ctaPrimary').optional().isString().isLength({ max: 50 }),
    body('ctaSecondary').optional().isString().isLength({ max: 50 }),
  ],
  validate,
  updateHero
);

// PUT /api/v1/admin/content/about
router.put(
  '/about',
  [
    body('sectionTitle').optional().isString().isLength({ max: 150 }),
    body('bodyText').optional().isString().isLength({ max: 5000 }),
  ],
  validate,
  updateAbout
);

// PUT /api/v1/admin/content/seo
router.put(
  '/seo',
  [
    body('metaTitle').optional().isString().isLength({ max: 70 }),
    body('metaDescription').optional().isString().isLength({ max: 160 }),
    body('keywords').optional().isArray(),
    body('ogImageUrl').optional().isURL(),
  ],
  validate,
  updateSeo
);

// ─── Services ─────────────────────────────────────────────────────────────────
router.post(
  '/services',
  [
    body('title').notEmpty().isString().isLength({ max: 100 }),
    body('description').optional().isString().isLength({ max: 500 }),
    body('icon').optional().isString().isLength({ max: 30 }),
    body('order').optional().isInt({ min: 0 }),
  ],
  validate,
  addService
);

router.put(
  '/services/:serviceId',
  [
    param('serviceId').isMongoId(),
    body('title').optional().isString().isLength({ max: 100 }),
    body('description').optional().isString().isLength({ max: 500 }),
    body('isVisible').optional().isBoolean(),
    body('order').optional().isInt({ min: 0 }),
  ],
  validate,
  updateService
);

router.delete('/services/:serviceId', [param('serviceId').isMongoId()], validate, deleteService);

// ─── FAQs ─────────────────────────────────────────────────────────────────────
router.post(
  '/faqs',
  [
    body('question').notEmpty().isString().isLength({ max: 300 }),
    body('answer').notEmpty().isString().isLength({ max: 2000 }),
    body('order').optional().isInt({ min: 0 }),
  ],
  validate,
  addFaq
);

router.put(
  '/faqs/:faqId',
  [
    param('faqId').isMongoId(),
    body('question').optional().isString().isLength({ max: 300 }),
    body('answer').optional().isString().isLength({ max: 2000 }),
    body('isVisible').optional().isBoolean(),
    body('order').optional().isInt({ min: 0 }),
  ],
  validate,
  updateFaq
);

router.delete('/faqs/:faqId', [param('faqId').isMongoId()], validate, deleteFaq);

module.exports = router;
