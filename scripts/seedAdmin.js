const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const ADMIN_PHONE = process.env.ADMIN_PHONE || '9999999999';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@1234';
const ADMIN_MPIN = process.env.ADMIN_MPIN || '9876';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin';

async function seedAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    console.log('Connected to MongoDB');

    let admin = await User.findOne({phone: ADMIN_PHONE});

    if (admin) {
      console.log('Admin already exists, updating credentials...');
      admin.password = await bcrypt.hash(ADMIN_PASSWORD, 12);
      admin.mpin = await User.hashMpin(ADMIN_MPIN);
      admin.isAdmin = true;
      admin.name = ADMIN_NAME;
      await admin.save();
      console.log('Admin credentials updated');
    } else {
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);
      const hashedMpin = await User.hashMpin(ADMIN_MPIN);

      admin = new User({
        name: ADMIN_NAME,
        phone: ADMIN_PHONE,
        password: hashedPassword,
        mpin: hashedMpin,
        wallet: 0,
        isAdmin: true,
      });

      await admin.save();
      console.log('Admin created successfully');
    }

    console.log(`\nAdmin credentials:`);
    console.log(`  Phone: ${ADMIN_PHONE}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
    console.log(`  MPIN: ${ADMIN_MPIN}`);
  } catch (error) {
    console.error('Seed error:', error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

seedAdmin();
