const mongoose = require("mongoose");
const logger = require("../utils/logger");

const connectDB = async () => {
  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected; waiting for reconnection");
  });
  mongoose.connection.on("reconnected", () => {
    logger.info("MongoDB connection restored");
  });

  let retryDelay = 1000;
  while (mongoose.connection.readyState !== 1) {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        dbName: process.env.MONGODB_DB || "funoon_dev",
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        heartbeatFrequencyMS: 10000,
        maxPoolSize: 10,
        minPoolSize: 2,
        retryWrites: true,
      });
      logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      logger.error(`❌ DB connection failed: ${error.message}`);
      logger.info(`Retrying MongoDB connection in ${retryDelay / 1000}s`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      retryDelay = Math.min(retryDelay * 2, 30000);
    }
  }

  return mongoose.connection;
};

module.exports = connectDB;
