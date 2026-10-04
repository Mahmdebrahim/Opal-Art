// const dotenv = require("dotenv");
// dotenv.config();
// const app = require("./src/app");
// const { connectDB } = require("./src/config");
// const logger = require("./src/utils/logger");

// // ─── Handle Uncaught Exceptions ──────────────────────────────────────────────
// process.on("uncaughtException", (err) => {
//   logger.error(`UNCAUGHT EXCEPTION! Shutting down...`);
//   logger.error(err.name, err.message);
//   if (!process.env.VERCEL) process.exit(1);
// });

// // ─── Middleware لتأكيد الاتصال بالداتابيز عند كل Request في Vercel ─────────
// app.use(async (req, res, next) => {
//   try {
//     await connectDB();
//     next();
//   } catch (err) {
//     logger.error("Database connection failed on request:", err);
//     res.status(500).json({ error: "Database connection failed" });
//   }
// });

// // ─── Connect to Database & Start Jobs (لو شغال المحلي أو VPS) ────────────────
// const startServer = async () => {
//   try {
//     await connectDB();

//     // تشغيل الـ Cron Jobs فقط خارج Vercel
//     if (!process.env.VERCEL) {
//       require("./src/jobs/fundsRelease.job").startFundsReleaseJob();
//       require("./src/jobs/expiredOrdersCleanup.job").startExpiredOrdersCleanupJob();
//       require("./src/jobs/subscriptionExpiryReminder.job").startSubscriptionExpiringJob();
//       require("./src/jobs/subscriptionExpiry.job").startSubscriptionExpiryJob();
//       require("./src/jobs/cleanupExpiredSubscriptionPayments.job").startSubscriptionCleanupJob();
//     }
//   } catch (error) {
//     logger.error("Failed to initialize database-dependent services:", error);
//   }

//   // تشغيل app.listen فقط في البيئة العادية (مش Vercel)
//   if (!process.env.VERCEL) {
//     const PORT = process.env.PORT || 5000;
//     const server = app.listen(PORT, () => {
//       logger.info(` Server running on port ${PORT}`);
//       logger.info(` Environment: ${process.env.NODE_ENV || "development"}`);
//       logger.info(` Health check: http://localhost:${PORT}/health`);
//     });

//     process.on("unhandledRejection", (err) => {
//       logger.error(`UNHANDLED REJECTION! Shutting down...`);
//       logger.error(err.name, err.message);
//       server.close(() => process.exit(1));
//     });

//     process.on("SIGTERM", () => {
//       logger.info(" SIGTERM received. Shutting down gracefully...");
//       server.close(() => process.exit(0));
//     });

//     process.on("SIGINT", () => {
//       logger.info(" SIGINT received. Shutting down gracefully...");
//       server.close(() => process.exit(0));
//     });
//   }
// };

// startServer();

// module.exports = app;

//! test vercel 
const dotenv = require("dotenv");
dotenv.config();

const app = require("./src/app");
const { connectDB } = require("./src/config");
const logger = require("./src/utils/logger");

// ─── Middleware لتأكيد الاتصال بالداتابيز في Vercel ──────────────────────────
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    logger.error("Database connection failed on request:", err);
    res
      .status(500)
      .json({ error: "Database connection failed", details: err.message });
  }
});

// ─── Local Development Server ───────────────────────────────────────────────
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, async () => {
    try {
      await connectDB();
      logger.info(`Server running on port ${PORT}`);
    } catch (err) {
      logger.error("Failed to start server locally:", err);
    }
  });
}

// Export for Vercel Serverless
module.exports = app;