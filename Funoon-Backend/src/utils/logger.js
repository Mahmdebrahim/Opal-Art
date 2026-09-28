// const winston = require("winston");
// const path = require("path");

// const logFormat = winston.format.combine(
//   winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
//   winston.format.errors({ stack: true }),
//   winston.format.splat(),
//   winston.format.json(),
// );

// const logger = winston.createLogger({
//   level: process.env.NODE_ENV === "development" ? "debug" : "info",
//   format: logFormat,
//   transports: [
//     new winston.transports.File({
//       filename: path.join(__dirname, "../../logs/error.log"),
//       level: "error",
//     }),
//     new winston.transports.File({
//       filename: path.join(__dirname, "../../logs/combined.log"),
//     }),
//   ],
// });

// if (process.env.NODE_ENV !== "production") {
//   logger.add(
//     new winston.transports.Console({
//       format: winston.format.combine(
//         winston.format.colorize(),
//         winston.format.simple(),
//       ),
//     }),
//   );
// }

// module.exports = logger;

const winston = require("winston");
const path = require("path");

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

// فحص بيئة Vercel
const isVercel = process.env.VERCEL || process.env.NODE_ENV === "production";

// قائمة الـ Transports الأساسية
const transports = [];

if (isVercel) {
  // على Vercel نعتمد على Console فقط (Vercel تجمع هذه السجلات تلقائياً في الـ Dashboard)
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
  );
} else {
  // في التطوير المحلي (Local) يتم حفظ الـ Logs في ملفات كالمعتاد
  transports.push(
    new winston.transports.File({
      filename: path.join(__dirname, "../../logs/error.log"),
      level: "error",
    }),
    new winston.transports.File({
      filename: path.join(__dirname, "../../logs/combined.log"),
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
  );
}

const logger = winston.createLogger({
  level: process.env.NODE_ENV === "development" ? "debug" : "info",
  format: logFormat,
  transports,
});

module.exports = logger;