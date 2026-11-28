const mongoose = require('mongoose');

/** Drop legacy global unique phone/email indexes so same number can exist across roles. */
const migrateUserPhoneIndexes = async () => {
  try {
    const User = require('../models/User');
    const col = User.collection;
    const indexes = await col.indexes();
    for (const idx of indexes) {
      const keys = Object.keys(idx.key || {});
      const name = idx.name;
      if (!name || name === '_id_') continue;
      // Old: unique on phone alone, or unique on email alone
      if (idx.unique && keys.length === 1 && (keys[0] === 'phone' || keys[0] === 'email')) {
        await col.dropIndex(name);
        console.log(`Dropped legacy User index: ${name}`);
      }
    }
    await User.syncIndexes();
  } catch (err) {
    console.warn(`User index migrate skipped: ${err.message}`);
  }
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/hyperlocal_grocery',
      { serverSelectionTimeoutMS: 8000 }
    );
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    await migrateUserPhoneIndexes();
    return conn;
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    // Do not process.exit — allow Express to keep serving static/API with degraded mode
    throw error;
  }
};

module.exports = connectDB;
