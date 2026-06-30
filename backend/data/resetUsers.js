// One-time cleanup script: clears the Users collection so the new
// username/password/OTP signup schema doesn't conflict with old data
// created by the previous OTP-only auth system.
//
// Run with: node data/resetUsers.js
require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const User = require('../models/User');
const OTP = require('../models/OTP');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/medcare');
    console.log('Connected to MongoDB.');

    const userResult = await User.deleteMany({});
    console.log(`Deleted ${userResult.deletedCount} old user(s).`);

    const otpResult = await OTP.deleteMany({});
    console.log(`Deleted ${otpResult.deletedCount} old OTP record(s).`);

    await mongoose.connection.close();
    console.log('Done. You can now register fresh accounts.');
    process.exit(0);
  } catch (error) {
    console.error('Reset failed:', error);
    process.exit(1);
  }
};

run();
