const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const mongoUri = process.env.MONGO_URI;
console.log('Connecting to:', mongoUri ? 'URI exists' : 'URI missing');

const PaymentSubmission = require('./src/models/PaymentSubmission');
require('./src/models/Appointment');
require('./src/models/User');

mongoose.connect(mongoUri)
  .then(async () => {
    console.log('Connected successfully!');
    
    const submissions = await PaymentSubmission.find().lean();
    console.log('Submissions in DB:', JSON.stringify(submissions, null, 2));
    
    mongoose.disconnect();
  })
  .catch(err => {
    console.error('Connection error:', err);
    process.exit(1);
  });
