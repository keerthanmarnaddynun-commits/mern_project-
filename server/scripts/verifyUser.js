const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

async function main() {
  const emailArg = process.argv[2];
  if (!emailArg || typeof emailArg !== 'string' || !emailArg.trim()) {
    console.log('Usage: node server/scripts/verifyUser.js <email>');
    process.exit(1);
  }

  const emailNorm = emailArg.trim().toLowerCase();

  dotenv.config({ path: path.resolve(__dirname, '../.env') });

  try {
    if (!process.env.MONGO_URI) {
      console.error('MONGO_URI is not defined');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);

    const User = require('../models/User');

    const user = await User.findOne({ email: emailNorm });
    if (!user) {
      console.log('User not found');
      await mongoose.disconnect();
      process.exit(1);
    }

    user.isVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationTokenExpires = null;
    await user.save();

    console.log(`Verified: ${emailNorm}`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error(error.message || error);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
}

main();
