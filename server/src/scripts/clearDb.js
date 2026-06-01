'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const clearDatabase = async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI not found in environment.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.');

  const DoctorProfile = require('../models/DoctorProfile');
  const WebsiteContent = require('../models/WebsiteContent');

  console.log('Clearing WebsiteContent & DoctorProfile texts...');

  await DoctorProfile.findOneAndUpdate({}, {
    $set: {
      tagline: '',
      about: '',
      degrees: [],
      achievements: [],
      specializations: [],
      'payment.instructions': ''
    }
  });

  await WebsiteContent.findOneAndUpdate({}, {
    $set: {
      'hero.headline': '',
      'hero.subheadline': '',
      'hero.ctaPrimary': '',
      'hero.ctaSecondary': '',
      'about.sectionTitle': '',
      'about.bodyText': '',
      services: [],
      faqs: []
    }
  });

  console.log('SUCCESS: Seeded texts and arrays cleared cleanly from the database.');
  await mongoose.disconnect();
};

clearDatabase().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
