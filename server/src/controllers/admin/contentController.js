'use strict';

const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const WebsiteContent = require('../../models/WebsiteContent');

// ─── GET /api/v1/admin/content ────────────────────────────────────────────────
const getContent = asyncHandler(async (req, res) => {
  const content = await WebsiteContent.getSingleton();
  res.status(200).json({ success: true, data: { content } });
});

// ─── PUT /api/v1/admin/content/hero ──────────────────────────────────────────
const updateHero = asyncHandler(async (req, res) => {
  const { headline, subheadline, ctaPrimary, ctaSecondary, videoUrl, videoPosterUrl, videoTitle } = req.body;
  const updates = {};
  if (headline      !== undefined) updates['hero.headline']      = headline.trim();
  if (subheadline   !== undefined) updates['hero.subheadline']   = subheadline.trim();
  if (ctaPrimary    !== undefined) updates['hero.ctaPrimary']    = ctaPrimary.trim();
  if (ctaSecondary  !== undefined) updates['hero.ctaSecondary']  = ctaSecondary.trim();
  if (videoUrl      !== undefined) updates['hero.videoUrl']      = videoUrl.trim();
  if (videoPosterUrl!== undefined) updates['hero.videoPosterUrl']= videoPosterUrl.trim();
  if (videoTitle    !== undefined) updates['hero.videoTitle']    = videoTitle.trim();
  updates['updatedBy'] = req.dbUser._id;

  const content = await WebsiteContent.findOneAndUpdate(
    {}, { $set: updates }, { new: true, upsert: true }
  );
  res.status(200).json({ success: true, message: 'Hero section updated.', data: { hero: content.hero } });
});

// ─── PUT /api/v1/admin/content/about ─────────────────────────────────────────
const updateAbout = asyncHandler(async (req, res) => {
  const { sectionTitle, bodyText } = req.body;
  const updates = { updatedBy: req.dbUser._id };
  if (sectionTitle !== undefined) updates['about.sectionTitle'] = sectionTitle.trim();
  if (bodyText     !== undefined) updates['about.bodyText']     = bodyText.trim();

  const content = await WebsiteContent.findOneAndUpdate(
    {}, { $set: updates }, { new: true, upsert: true }
  );
  res.status(200).json({ success: true, message: 'About section updated.', data: { about: content.about } });
});

// ─── PUT /api/v1/admin/content/seo ───────────────────────────────────────────
const updateSeo = asyncHandler(async (req, res) => {
  const { metaTitle, metaDescription, keywords, ogImageUrl } = req.body;
  const updates = { updatedBy: req.dbUser._id };
  if (metaTitle       !== undefined) updates['seo.metaTitle']       = metaTitle.trim();
  if (metaDescription !== undefined) updates['seo.metaDescription'] = metaDescription.trim();
  if (keywords        !== undefined) updates['seo.keywords']        = Array.isArray(keywords) ? keywords : [];
  if (ogImageUrl      !== undefined) updates['seo.ogImageUrl']      = ogImageUrl;

  const content = await WebsiteContent.findOneAndUpdate(
    {}, { $set: updates }, { new: true, upsert: true }
  );
  res.status(200).json({ success: true, message: 'SEO settings updated.', data: { seo: content.seo } });
});

// ─── POST /api/v1/admin/content/services ─────────────────────────────────────
const addService = asyncHandler(async (req, res) => {
  const { title, description, icon, order } = req.body;

  const content = await WebsiteContent.findOneAndUpdate(
    {},
    {
      $push: {
        services: {
          title: title.trim(),
          description: description ? description.trim() : '',
          icon:  icon || 'leaf',
          order: order || 0,
          isVisible: true,
        },
      },
      $set: { updatedBy: req.dbUser._id },
    },
    { new: true, upsert: true }
  );

  const added = content.services[content.services.length - 1];
  res.status(201).json({ success: true, message: 'Service added.', data: { service: added } });
});

// ─── PUT /api/v1/admin/content/services/:serviceId ───────────────────────────
const updateService = asyncHandler(async (req, res) => {
  const { serviceId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(serviceId)) {
    return res.status(400).json({ success: false, message: 'Invalid service ID.' });
  }

  const allowed = ['title', 'description', 'icon', 'order', 'isVisible'];
  const setFields = { updatedBy: req.dbUser._id };
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      setFields[`services.$.${key}`] = typeof req.body[key] === 'string'
        ? req.body[key].trim() : req.body[key];
    }
  }

  const content = await WebsiteContent.findOneAndUpdate(
    { 'services._id': serviceId },
    { $set: setFields },
    { new: true }
  );

  if (!content) {
    return res.status(404).json({ success: false, message: 'Service not found.' });
  }

  const updated = content.services.id(serviceId);
  res.status(200).json({ success: true, message: 'Service updated.', data: { service: updated } });
});

// ─── DELETE /api/v1/admin/content/services/:serviceId ────────────────────────
const deleteService = asyncHandler(async (req, res) => {
  const { serviceId } = req.params;

  await WebsiteContent.findOneAndUpdate(
    {},
    { $pull: { services: { _id: serviceId } }, $set: { updatedBy: req.dbUser._id } }
  );

  res.status(200).json({ success: true, message: 'Service removed.' });
});

// ─── POST /api/v1/admin/content/faqs ─────────────────────────────────────────
const addFaq = asyncHandler(async (req, res) => {
  const { question, answer, order } = req.body;

  const content = await WebsiteContent.findOneAndUpdate(
    {},
    {
      $push: {
        faqs: {
          question: question.trim(),
          answer:   answer.trim(),
          order:    order || 0,
          isVisible: true,
        },
      },
      $set: { updatedBy: req.dbUser._id },
    },
    { new: true, upsert: true }
  );

  const added = content.faqs[content.faqs.length - 1];
  res.status(201).json({ success: true, message: 'FAQ added.', data: { faq: added } });
});

// ─── PUT /api/v1/admin/content/faqs/:faqId ───────────────────────────────────
const updateFaq = asyncHandler(async (req, res) => {
  const { faqId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(faqId)) {
    return res.status(400).json({ success: false, message: 'Invalid FAQ ID.' });
  }

  const allowed = ['question', 'answer', 'order', 'isVisible'];
  const setFields = { updatedBy: req.dbUser._id };
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      setFields[`faqs.$.${key}`] = typeof req.body[key] === 'string'
        ? req.body[key].trim() : req.body[key];
    }
  }

  const content = await WebsiteContent.findOneAndUpdate(
    { 'faqs._id': faqId },
    { $set: setFields },
    { new: true }
  );

  if (!content) {
    return res.status(404).json({ success: false, message: 'FAQ not found.' });
  }

  const updated = content.faqs.id(faqId);
  res.status(200).json({ success: true, message: 'FAQ updated.', data: { faq: updated } });
});

// ─── DELETE /api/v1/admin/content/faqs/:faqId ────────────────────────────────
const deleteFaq = asyncHandler(async (req, res) => {
  const { faqId } = req.params;

  await WebsiteContent.findOneAndUpdate(
    {},
    { $pull: { faqs: { _id: faqId } }, $set: { updatedBy: req.dbUser._id } }
  );

  res.status(200).json({ success: true, message: 'FAQ removed.' });
});

module.exports = {
  getContent,
  updateHero, updateAbout, updateSeo,
  addService, updateService, deleteService,
  addFaq, updateFaq, deleteFaq,
};
