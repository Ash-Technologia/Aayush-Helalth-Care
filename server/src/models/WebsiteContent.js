'use strict';

const mongoose = require('mongoose');

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const heroSchema = new mongoose.Schema(
  {
    headline: { type: String, trim: true, default: 'Aayush Health Care' },
    subheadline: {
      type: String,
      trim: true,
      default: 'Aayush Health Care has been providing quality healthcare services to the community for several years.',
    },
    ctaPrimary: { type: String, trim: true, default: 'Book Appointment' },
    ctaSecondary: { type: String, trim: true, default: '' },
    videoUrl: { type: String, trim: true, default: '' },
    videoPosterUrl: { type: String, trim: true, default: '' },
    videoTitle: { type: String, trim: true, default: 'Introduction video' },
  },
  { _id: false }
);

const aboutSchema = new mongoose.Schema(
  {
    sectionTitle: {
      type: String,
      trim: true,
      default: 'Healing with Tradition, Guided by Science',
    },
    bodyText: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const serviceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    icon: { type: String, trim: true, default: 'leaf' }, // icon key for frontend
    isVisible: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { _id: true }
);

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    isVisible: { type: Boolean, default: true },
  },
  { _id: true }
);

const seoSchema = new mongoose.Schema(
  {
    metaTitle: {
      type: String,
      trim: true,
      default: 'Aayush Health Care — Amrut Singhavi | Ayurvedic Consultancy',
    },
    metaDescription: {
      type: String,
      trim: true,
      default:
        'Book an Ayurvedic consultation with Amrut Singhavi. ' +
        'Expert treatment for all diseases, pain management, and lifestyle conditions.',
    },
    keywords: { type: [String], default: [] },
    ogImageUrl: { type: String, default: null },
  },
  { _id: false }
);

// ─── WebsiteContent Schema ────────────────────────────────────────────────────
// Singleton CMS document. Admin edits this from the admin panel.
// All content is fetched by the frontend on load (cached with TanStack Query).
const websiteContentSchema = new mongoose.Schema(
  {
    hero: { type: heroSchema, default: () => ({}) },
    about: { type: aboutSchema, default: () => ({}) },
    services: { type: [serviceSchema], default: [] },
    faqs: { type: [faqSchema], default: [] },
    seo: { type: seoSchema, default: () => ({}) },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'websitecontent', // fixed collection name for singleton
  }
);

// ─── Static: Get or create the singleton ─────────────────────────────────────
websiteContentSchema.statics.getSingleton = async function () {
  let content = await this.findOne();
  if (!content) {
    content = await this.create({});
    console.log('[WebsiteContent] Singleton created with defaults.');
  }
  return content;
};

const WebsiteContent = mongoose.model('WebsiteContent', websiteContentSchema);
module.exports = WebsiteContent;
