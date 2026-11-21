const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/hyperlocal_grocery',
      { serverSelectionTimeoutMS: 8000 }
    );
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    // Do not process.exit — allow Express to keep serving static/API with degraded mode
    throw error;
  }
};

module.exports = connectDB;
