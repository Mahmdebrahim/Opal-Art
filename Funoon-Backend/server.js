// server.js
const dotenv = require("dotenv");
dotenv.config();
const app = require("./src/app");
const { connectDB } = require("./src/config");
const logger = require("./src/utils/logger");
const mongoose = require("mongoose");

// ─── Handle Uncaught Exceptions ──────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  logger.error(`UNCAUGHT EXCEPTION!  Shutting down...`);
  logger.error(err.name, err.message);
  process.exit(1);
});

// ─── Connect to Database ─────────────────────────────────────────────────────
const startServer = async () => {
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    logger.info(` Server running on port ${PORT}`);
    logger.info(` Environment: ${process.env.NODE_ENV || "development"}`);
    logger.info(` Health check: http://localhost:${PORT}/health`);
  });

  process.on("unhandledRejection", (err) => {
    logger.error(`UNHANDLED REJECTION!  Shutting down...`);
    logger.error(err.name, err.message);
    server.close(() => {
      process.exit(1);
    });
  });

  process.on("SIGTERM", () => {
    logger.info(" SIGTERM received. Shutting down gracefully...");
    server.close(() => {
      logger.info(" Process terminated!");
      process.exit(0);
    });
  });

  process.on("SIGINT", () => {
    logger.info(" SIGINT received. Shutting down gracefully...");
    server.close(() => {
      logger.info("Process terminated!");
      process.exit(0);
    });
  });

  try {
    await connectDB();
    require("./src/jobs/fundsRelease.job").startFundsReleaseJob();
    require("./src/jobs/expiredOrdersCleanup.job").startExpiredOrdersCleanupJob();
    require("./src/jobs/subscriptionExpiryReminder.job").startSubscriptionExpiringJob();
    require("./src/jobs/subscriptionExpiry.job").startSubscriptionExpiryJob();
    require("./src/jobs/cleanupExpiredSubscriptionPayments.job").startSubscriptionCleanupJob();

    // if (process.env.NODE_ENV === "development") {
    //   mongoose.set("debug", (collectionName, method, query, doc) => {
    //     logger.debug(
    //       `🔍 MONGO: ${collectionName}.${method}`,
    //       JSON.stringify(query).substring(0, 200),
    //     );
    //   });
    // }
  } catch (error) {
    logger.error("Failed to initialize database-dependent services:", error);
  }
};

startServer();
