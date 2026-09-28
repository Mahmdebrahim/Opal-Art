const mongoose = require("mongoose");
const logger = require("../utils/logger");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_DB || "funoon_dev",
      serverSelectionTimeoutMS: 35000,
      socketTimeoutMS: 45000,
      heartbeatFrequencyMS: 10000,
      maxPoolSize: 10,
      minPoolSize: 2,
      retryWrites: true,
    });
    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error(`❌ DB Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
