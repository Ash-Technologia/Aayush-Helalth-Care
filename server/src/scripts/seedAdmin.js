'use strict';

/**
 * Admin Seed Script — Run ONCE to create the first admin account.
 *
 * Usage:
 *   npm run seed:admin
 *
 * This script:
 *  1. Creates the admin user account
 *  2. Creates the DoctorProfile singleton with clinic defaults
 *  3. Creates default SlotTemplates (Mon–Sat, 9–1 PM + 5–7 PM, 30 min)
 *  4. Creates the WebsiteContent singleton with default CMS content
 *
 * IMPORTANT: Set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD in .env before running.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');

// ─── CONFIGURE THESE BEFORE RUNNING ──────────────────────────────────────────
const ADMIN_FULL_NAME = 'Amrut Singhavi';
const ADMIN_EMAIL     = process.env.ADMIN_SEED_EMAIL    || 'admin@aayushhealth.in';
const ADMIN_PASSWORD  = process.env.ADMIN_SEED_PASSWORD || 'CHANGE_THIS_BEFORE_SEEDING!';
const ADMIN_PHONE     = process.env.ADMIN_PHONE         || '9822843015';
// ─────────────────────────────────────────────────────────────────────────────

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error('[Seed] MONGO_URI not set. Create a .env file first.');
    process.exit(1);
  }

  if (ADMIN_PASSWORD === 'CHANGE_THIS_BEFORE_SEEDING!') {
    console.error(
      '[Seed] You must set ADMIN_SEED_PASSWORD in your .env file before seeding.\n' +
      '       Add: ADMIN_SEED_PASSWORD=YourStrongPassword123!'
    );
    process.exit(1);
  }

  if (ADMIN_PASSWORD.length < 8) {
    console.error('[Seed] Admin password must be at least 8 characters.');
    process.exit(1);
  }

  console.log('[Seed] Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[Seed] Connected.\n');

  // ── 1. Admin User ────────────────────────────────────────────────────────
  const User = require('../models/User');

  const existing = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
  if (existing) {
    existing.passwordHash = ADMIN_PASSWORD;
    existing.role = 'admin';
    existing.isEmailVerified = true;
    existing.isPhoneVerified = true;
    existing.fullName = ADMIN_FULL_NAME;
    await existing.save();
    console.log(`[Seed] ✅ Updated existing user '${ADMIN_EMAIL}' to admin role and updated password.`);
  } else {
    await User.create({
      fullName:        ADMIN_FULL_NAME,
      email:           ADMIN_EMAIL.toLowerCase(),
      phone:           ADMIN_PHONE,
      passwordHash:    ADMIN_PASSWORD,
      role:            'admin',
      isEmailVerified: true,
      isPhoneVerified: true,
    });
    console.log(`[Seed] ✅ Admin account created: ${ADMIN_EMAIL}`);
  }

  // Fetch the admin user for createdBy references
  const adminUser = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });

  // ── 2. DoctorProfile Singleton ──────────────────────────────────────────
  const DoctorProfile = require('../models/DoctorProfile');
  const existingProfile = await DoctorProfile.findOne();

  if (!existingProfile) {
    await DoctorProfile.create({
      name:            ADMIN_FULL_NAME,
      tagline:         'Healing with Ayurveda, Guided by Science',
      about:           'Amrut Singhavi is a highly experienced Ayurvedic consultant with over 15 years of practice. He specialises in chronic disease management, lifestyle disorders, and pain management using traditional Ayurvedic principles combined with modern diagnostic techniques.',
      degrees:         [
        { title: 'Acupressure Healer', institution: 'Indian Academy of Acupressure', year: 2008, order: 1 },
        { title: 'Neurotherapy Specialist', institution: 'Neurotherapy Institute', year: 2011, order: 2 },
      ],
      achievements:    [
        { title: '15+ years of clinical experience', order: 1 },
        { title: '5000+ patients treated successfully', order: 2 },
        { title: 'Specialised in Panchakarma therapy', order: 3 },
      ],
      experience:      15,
      specializations: ['Panchakarma', 'Chronic Pain', 'Digestive Disorders', 'Skin Diseases', 'Lifestyle Disorders'],
      consultationFee: 500,
      clinicTimings:   [
        { day: 'Mon', isOpen: true, shifts: [{ open: '09:00', close: '13:00' }, { open: '17:00', close: '19:00' }] },
        { day: 'Tue', isOpen: true, shifts: [{ open: '09:00', close: '13:00' }, { open: '17:00', close: '19:00' }] },
        { day: 'Wed', isOpen: true, shifts: [{ open: '09:00', close: '13:00' }, { open: '17:00', close: '19:00' }] },
        { day: 'Thu', isOpen: true, shifts: [{ open: '09:00', close: '13:00' }, { open: '17:00', close: '19:00' }] },
        { day: 'Fri', isOpen: true, shifts: [{ open: '09:00', close: '13:00' }, { open: '17:00', close: '19:00' }] },
        { day: 'Sat', isOpen: true, shifts: [{ open: '09:00', close: '13:00' }, { open: '17:00', close: '19:00' }] },
        { day: 'Sun', isOpen: false, shifts: [] },
      ],
      breakTimings:    [
        { start: '13:00', end: '17:00', label: 'Afternoon Break' },
      ],
      address: {
        line1:   'Clinic Address, Update in Admin Panel',
        city:    'Pune',
        state:   'Maharashtra',
        pincode: '411001',
      },
      contactPhone:    ADMIN_PHONE,
      whatsappNumber:  ADMIN_PHONE,
      payment: {
        upiId:       'aayushhealth@upi',
        accountName: ADMIN_FULL_NAME,
        instructions: 'Pay exact amount shown. Screenshot required. WhatsApp the screenshot to confirm.',
      },
      stats: {
        yearsExperience:  15,
        totalPatients:    5000,
        totalTreatments:  5000,
        satisfactionRate: 98,
      },
    });
    console.log('[Seed] ✅ DoctorProfile singleton created with clinic defaults.');
  } else {
    console.log('[Seed] ⏩ DoctorProfile already exists — skipping.');
  }

  // ── 3. Default Slot Templates ────────────────────────────────────────────
  const SlotTemplate = require('../models/SlotTemplate');
  const existingTemplates = await SlotTemplate.countDocuments();

  if (existingTemplates === 0) {
    // Mon(1)–Sat(6), both morning and evening, both types
    const WEEKDAYS = [1, 2, 3, 4, 5, 6]; // Mon=1 … Sat=6
    const slots = [
      { startTime: '09:00', endTime: '13:00', label: 'Morning' },
      { startTime: '17:00', endTime: '19:00', label: 'Evening' },
    ];

    const templates = [];
    for (const day of WEEKDAYS) {
      for (const slot of slots) {
        templates.push({
          dayOfWeek:        day,
          startTime:        slot.startTime,
          endTime:          slot.endTime,
          slotDurationMins: 30,
          consultationType: 'both',
          isActive:         true,
          notes:            `${slot.label} session — auto-seeded`,
          createdBy:        adminUser._id,
        });
      }
    }

    await SlotTemplate.insertMany(templates);
    console.log(`[Seed] ✅ Created ${templates.length} default slot templates (Mon–Sat, 30-min, both types).`);
  } else {
    console.log(`[Seed] ⏩ ${existingTemplates} SlotTemplate(s) already exist — skipping.`);
  }

  // ── 4. WebsiteContent Singleton ──────────────────────────────────────────
  const WebsiteContent = require('../models/WebsiteContent');
  await WebsiteContent.getSingleton(); // creates with defaults if not present
  console.log('[Seed] ✅ WebsiteContent singleton ensured.');

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════');
  console.log('  SEED COMPLETE');
  console.log('═══════════════════════════════════════════');
  console.log(`  Admin Email    : ${ADMIN_EMAIL}`);
  console.log(`  Admin Password : [as set in ADMIN_SEED_PASSWORD]`);
  console.log(`  Login at       : POST /api/v1/admin/login`);
  console.log('  Next step      : Configure QR code in Admin → Profile');
  console.log('═══════════════════════════════════════════\n');

  await mongoose.disconnect();
  console.log('[Seed] Disconnected. Done.');
};

run().catch((err) => {
  console.error('[Seed] Fatal error:', err);
  process.exit(1);
});
