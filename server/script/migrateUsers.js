const mongoose = require('mongoose');
const User = require('../models/User'); // adjust path if needed
require('dotenv').config();

async function migrateUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    // Find users without phone numbers
    const usersWithoutPhone = await User.find({ phoneNumber: { $exists: false } });

    if (usersWithoutPhone.length === 0) {
      console.log('🎉 All users already have phone numbers.');
    } else {
      for (let user of usersWithoutPhone) {
        user.phoneNumber = '254000000000'; // placeholder
        await user.save();
        console.log(`📌 Updated user ${user.email} with placeholder phone number`);
      }
    }

    mongoose.connection.close();
    console.log('✅ Migration complete');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateUsers();
