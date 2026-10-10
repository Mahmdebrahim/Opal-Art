// src/app.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("./utils/logger");
const errorHandler = require("./middlewares/error.middleware.js");
const mongoSanitize = require("express-mongo-sanitize");
const { verifyMoyasarSignature } = require("./utils/webhook-signature");
const verifyOtoWebhook = require("./middlewares/verify-oto-webhook.middleware");
require("./events/subscribers/notification.subscriber");
require("./events/subscribers/email.subscriber");

const app = express();

// ─── Security Middlewares ────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", "https://api.moyasar.com"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
)

const allowedOrigins = (process.env.CORS_ORIGINS )
  .split(",")
  .map((s) => s.trim());

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) cb(null, true);
      else cb(new Error("CORS not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "Idempotency-Key",
    ],
  }),
);

app.set("trust proxy", 1);

// ─── Rate Limiting ───────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500,
  message: {
    message: "عذراً تجاوزت الحد المسموح به من المحاولات — حاول بعد 15 دقيقة",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", limiter);

// ─── API Version ─────────────────────────────────────────────────────────────
const apiVersion = process.env.API_VERSION || "v1";

// ═══════════════════════════════════════════════════════════════════════════════
// ⚠️ Webhooks — لازم تكون قبل express.json()!
// ═══════════════════════════════════════════════════════════════════════════════

// ✅ Moyasar Webhook — Smart Router + Conditional Signature
// app.post(
//   `/api/${apiVersion}/webhooks/moyasar`,
//   express.raw({ type: "application/json" }),
//   (req, res, next) => {
//     let parsedBody;
//     try {
//       const rawBody = Buffer.isBuffer(req.body)
//         ? req.body.toString("utf8")
//         : String(req.body || "");
//       console.log("🔍 RAW WEBHOOK BODY:", rawBody);
//       const signature =
//         req.headers["x-moyasar-signature"] ||
//         req.headers["x-signature"] ||
//         req.headers["moyasar-signature"] ||
//         req.headers["signature"];

//       parsedBody = JSON.parse(rawBody);
//       req.rawBody = rawBody;

//       // ✅ جديد: حدد الشكل — enveloped (type + data) ولا direct (payment object مباشر)
//       const isEnveloped =
//         typeof parsedBody?.type === "string" && parsedBody?.data;

//       const payment = isEnveloped ? parsedBody.data : parsedBody;
//       const eventType = isEnveloped ? parsedBody.type : null;

//       // ═══════════════════════════════════════════════════
//       // Signature verification — تختلف حسب الشكل
//       // ═══════════════════════════════════════════════════
//       const isProduction = process.env.NODE_ENV === "production";
//       const WEBHOOK_SECRET = process.env.MOYASAR_WEBHOOK_SECRET;

//       if (isEnveloped) {
//         // ✅ في الشكل ده، Moyasar بتحط الـ secret جوه الـ body نفسه (secret_token)
//         // مش في الـ header — ده موثّق صراحة في الـ docs
//         if (isProduction && parsedBody.secret_token !== WEBHOOK_SECRET) {
//           logger.error(`🚨 Invalid secret_token in production from ${req.ip}`);
//           return res.status(401).json({ error: "Invalid secret token" });
//         }
//       } else {
//         // الشكل القديم (direct) — نفس التحقق بالـ header زي ما هو
//         if (isProduction) {
//           if (!signature) {
//             logger.error(`🚨 Missing signature header in production`);
//             return res.status(401).json({ error: "Missing signature" });
//           }
//           if (!verifyMoyasarSignature(rawBody, signature, WEBHOOK_SECRET)) {
//             logger.error(`🚨 Invalid signature in production from ${req.ip}`);
//             return res.status(401).json({ error: "Invalid signature" });
//           }
//         } else if (!signature) {
//           logger.warn(
//             `⚠️ No signature header — allowing in dev mode (IP: ${req.ip})`,
//           );
//         } else if (!WEBHOOK_SECRET) {
//           logger.warn(
//             `⚠️ MOYASAR_WEBHOOK_SECRET not set — skipping verification`,
//           );
//         } else if (
//           !verifyMoyasarSignature(rawBody, signature, WEBHOOK_SECRET)
//         ) {
//           logger.warn(
//             `⚠️ Invalid signature — allowing in dev mode (IP: ${req.ip})`,
//           );
//         }
//       }

//       // ✅ من هنا، req.body دايمًا "payment object" موحّد، بغض النظر عن الشكل الأصلي
//       req.body = payment;
//       req.moyasarEventType = eventType; // اختياري: لو حبيت تستخدمه في اللوجات
//     } catch (err) {
//       logger.error("❌ Moyasar webhook parse error:", err.message);
//       return res.status(400).json({ error: "Invalid JSON" });
//     }

//     // SMART ROUTING — زي ما هو، لكن دلوقتي req.body.metadata دايمًا صح
//     const metadataType = req.body?.metadata?.type;

//     if (metadataType === "subscription") {
//       logger.info("📦 Routing to Subscription Webhook Handler");
//       const {
//         handleSubscriptionWebhook,
//       } = require("./controllers/subscription.controller");
//       return handleSubscriptionWebhook(req, res, next);
//     }

//     logger.info("🛒 Routing to Order Webhook Handler");
//     const { handleMoyasarWebhook } = require("./controllers/order.controller");
//     return handleMoyasarWebhook(req, res, next);
//   },
// );

// app.post(
//   `/api/${apiVersion}/webhooks/moyasar`,
//   express.raw({ type: "application/json" }),
//   async (req, res, next) => {
//     let payment;
//     try {
//       const rawBody = Buffer.isBuffer(req.body)
//         ? req.body.toString("utf8")
//         : String(req.body || "");

//       const signature =
//         req.headers["x-moyasar-signature"] ||
//         req.headers["x-signature"] ||
//         req.headers["moyasar-signature"] ||
//         req.headers["signature"];

//       const parsedBody = JSON.parse(rawBody);
//       req.rawBody = rawBody;

//       // ✅ الشكل الملفوف (Dashboard webhook) بيبقى فيه type + data
//       // الشكل المباشر (Invoice callback_url) بيبقى الـ payload نفسه هو الكيان
//       const isEnveloped = typeof parsedBody?.type === "string" && parsedBody?.data;
//       payment = isEnveloped ? parsedBody.data : parsedBody;

//       const isProduction = process.env.NODE_ENV === "production";
//       const WEBHOOK_SECRET = process.env.MOYASAR_WEBHOOK_SECRET;

//       if (isEnveloped) {
//         if (isProduction && parsedBody.secret_token !== WEBHOOK_SECRET) {
//           logger.error(`🚨 Invalid secret_token in production from ${req.ip}`);
//           return res.status(401).json({ error: "Invalid secret token" });
//         }
//       } else {
//         if (isProduction) {
//           if (!signature) {
//             logger.error(`🚨 Missing signature header in production`);
//             return res.status(401).json({ error: "Missing signature" });
//           }
//           if (!verifyMoyasarSignature(rawBody, signature, WEBHOOK_SECRET)) {
//             logger.error(`🚨 Invalid signature in production from ${req.ip}`);
//             return res.status(401).json({ error: "Invalid signature" });
//           }
//         } else if (!signature) {
//           logger.warn(`⚠️ No signature header — allowing in dev mode (IP: ${req.ip})`);
//         } else if (!WEBHOOK_SECRET) {
//           logger.warn(`⚠️ MOYASAR_WEBHOOK_SECRET not set — skipping verification`);
//         } else if (!verifyMoyasarSignature(rawBody, signature, WEBHOOK_SECRET)) {
//           logger.warn(`⚠️ Invalid signature — allowing in dev mode (IP: ${req.ip})`);
//         }
//       }

//       req.body = payment;
//     } catch (err) {
//       logger.error("❌ Moyasar webhook parse error:", err.message);
//       return res.status(400).json({ error: "Invalid JSON" });
//     }

//     // ═══════════════════════════════════════════════════
//     // ✅ التوجيه النهائي: metadata أولاً (أسرع لو موجودة)،
//     // ولو مش موجودة، دايمًا رجّع للبحث بالـ invoice_id — الطريقة الموثوقة 100%
//     // ═══════════════════════════════════════════════════
//     const metadataType = req.body?.metadata?.type;
//     const invoiceId = req.body?.invoice_id || req.body?.id;

//     if (metadataType === "subscription") {
//       logger.info("📦 Routing to Subscription Handler (via metadata)");
//       const { handleSubscriptionWebhook } = require("./controllers/subscription.controller");
//       return handleSubscriptionWebhook(req, res, next);
//     }

//     if (metadataType === "artwork_purchase") {
//       logger.info("🛒 Routing to Order Handler (via metadata)");
//       const { handleMoyasarWebhook } = require("./controllers/order.controller");
//       return handleMoyasarWebhook(req, res, next);
//     }

//     // ✅ مفيش metadata (الحالة الشائعة لـ Dashboard webhooks) → دوّر بالـ invoice_id
//     if (invoiceId) {
//       const SubscriptionPayment = require("./models/SubscriptionPayment");
//       const subPayment = await SubscriptionPayment.findOne({
//         moyasarPaymentId: invoiceId,
//       }).select("_id");

//       if (subPayment) {
//         logger.info("📦 Routing to Subscription Handler (via invoice_id lookup)");
//         const { handleSubscriptionWebhook } = require("./controllers/subscription.controller");
//         return handleSubscriptionWebhook(req, res, next);
//       }
//     }

//     // Default: Order handler (وهو نفسه عنده بحث احتياطي بالـ invoiceId جوّاه)
//     logger.info("🛒 Routing to Order Handler (default/fallback)");
//     const { handleMoyasarWebhook } = require("./controllers/order.controller");
//     return handleMoyasarWebhook(req, res, next);
//   },
// );

app.post(
  `/api/${apiVersion}/webhooks/moyasar`,
  express.raw({ type: "application/json" }),
  async (req, res, next) => {
    let payment;
    let rawBody;

    try {
      // ═══════════════════════════════════════════════════
      // ✅ Layer 1: استخراج الـ raw body من أي شكل جاي
      // ═══════════════════════════════════════════════════
      if (Buffer.isBuffer(req.body)) {
        rawBody = req.body.toString("utf8");
        logger.info("📥 Body came as Buffer (ideal)");
      } else if (typeof req.body === "string") {
        rawBody = req.body;
        logger.info("📥 Body came as string");
      } else if (typeof req.body === "object" && req.body !== null) {
        const keys = Object.keys(req.body);

        // ✅ Case A: character-map (keys are "0", "1", "2"...)
        if (keys.length > 0 && keys.every((k) => /^\d+$/.test(k))) {
          rawBody = Object.values(req.body).join("");
          logger.warn("⚠️ Body came as character-map — reconstructed");
        }
        // ✅ Case B: already parsed as object
        else {
          rawBody = JSON.stringify(req.body);
          logger.warn("⚠️ Body was pre-parsed by another middleware");
        }
      } else {
        throw new Error(`Unknown body type: ${typeof req.body}`);
      }

      // logger.info("📥 Raw webhook body (first 500 chars):", rawBody.substring(0, 500));

      // ═══════════════════════════════════════════════════
      // ✅ Layer 2: Parse الـ JSON
      // ═══════════════════════════════════════════════════
      let parsedBody;
      try {
        parsedBody = JSON.parse(rawBody);
      } catch (jsonErr) {
        // لو rawBody نفسه مش JSON → ممكن يكون فيه encoding issues
        // جرب نطهر الـ string من أي non-printable characters
        const cleaned = rawBody.replace(/[^\x20-\x7E\n\r\t]/g, "");
        parsedBody = JSON.parse(cleaned);
      }

      req.rawBody = rawBody;

      // ═══════════════════════════════════════════════════
      // ✅ Layer 3: Unwrap إذا كان enveloped
      // ═══════════════════════════════════════════════════
      const isEnveloped =
        typeof parsedBody?.type === "string" && parsedBody?.data;
      payment = isEnveloped ? parsedBody.data : parsedBody;

      logger.info("✅ Parsed webhook successfully");
      logger.info(`🏷️ Event type: ${parsedBody?.type || "N/A"}`);
      logger.info(`🏷️ Payment status: ${payment?.status || "N/A"}`);
      logger.info(`🏷️ Invoice ID: ${payment?.invoice_id || payment?.id}`);

      // ═══════════════════════════════════════════════════
      // ✅ Signature verification
      // ═══════════════════════════════════════════════════
      const signature =
        req.headers["x-moyasar-signature"] ||
        req.headers["x-signature"] ||
        req.headers["moyasar-signature"] ||
        req.headers["signature"];

      const isProduction = process.env.NODE_ENV === "production";
      const WEBHOOK_SECRET = process.env.MOYASAR_WEBHOOK_SECRET;

      if (isEnveloped) {
        if (isProduction && parsedBody.secret_token !== WEBHOOK_SECRET) {
          logger.error(`🚨 Invalid secret_token in production from ${req.ip}`);
          return res.status(401).json({ error: "Invalid secret token" });
        }
      } else {
        if (isProduction) {
          if (!signature)
            return res.status(401).json({ error: "Missing signature" });
          if (!verifyMoyasarSignature(rawBody, signature, WEBHOOK_SECRET)) {
            return res.status(401).json({ error: "Invalid signature" });
          }
        } else if (!signature) {
          logger.warn(
            `⚠️ No signature header — allowing in dev mode (IP: ${req.ip})`,
          );
        }
      }

      req.body = payment;
    } catch (err) {
      logger.error("❌ Moyasar webhook parse error:", err.message);
      logger.error("❌ req.body type:", typeof req.body);
      logger.error(
        "❌ req.body keys:",
        req.body ? Object.keys(req.body).slice(0, 10) : "null",
      );
      return res.status(400).json({ error: "Invalid webhook payload" });
    }

    // ═══════════════════════════════════════════════════
    // SMART ROUTING (زي ما هو)
    // ═══════════════════════════════════════════════════
    const metadataType = req.body?.metadata?.type;
    const invoiceId = req.body?.invoice_id || req.body?.id;

    logger.info(
      `🔍 Routing: metadataType=${metadataType}, invoiceId=${invoiceId}, status=${req.body?.status}`,
    );

    if (metadataType === "subscription") {
      logger.info("📦 Routing to Subscription Handler (via metadata)");
      const {
        handleSubscriptionWebhook,
      } = require("./controllers/subscription.controller");
      return handleSubscriptionWebhook(req, res, next);
    }

    if (metadataType === "artwork_purchase") {
      logger.info("🛒 Routing to Order Handler (via metadata)");
      const {
        handleMoyasarWebhook,
      } = require("./controllers/order.controller");
      return handleMoyasarWebhook(req, res, next);
    }

    if (invoiceId) {
      const SubscriptionPayment = require("./models/SubscriptionPayment");
      // const subPayment = await SubscriptionPayment.findOne({
      //   moyasarPaymentId: invoiceId,
      // }).select("_id");
      const subPayment = await SubscriptionPayment.findOne({
        $or: [
          { moyasarPaymentId: invoiceId }, // قبل الدفع (invoice id)
          { moyasarPaymentId: req.body?.id }, // بعد الدفع (payment id)
        ],
      }).select("_id");
      if (subPayment) {
        logger.info(
          "📦 Routing to Subscription Handler (via invoice_id lookup)",
        );
        const {
          handleSubscriptionWebhook,
        } = require("./controllers/subscription.controller");
        return handleSubscriptionWebhook(req, res, next);
      }
    }

    logger.info("🛒 Routing to Order Handler (default/fallback)");
    const { handleMoyasarWebhook } = require("./controllers/order.controller");
    return handleMoyasarWebhook(req, res, next);
  },
);

// ✅ OTO Webhook
app.post(
  `/api/${apiVersion}/webhooks/oto`,
  express.text({ type: ["application/json", "text/plain", "application/*"] }),
  (req, res, next) => {
    try {
      if (typeof req.body === "string") {
        req.body = JSON.parse(req.body);
      }
    } catch (err) {
      logger.error("❌ OTO webhook parse error:", err.message);
      return res.status(400).json({ error: "Invalid JSON" });
    }
    return next();
  },
  verifyOtoWebhook,
  (req, res) => {
    const { handleOTOWebhook } = require("./controllers/shipping.controller");
    return handleOTOWebhook(req, res);
  },
);

// ═════════════════════════════════════════════════════════════════════
// Body Parsing (بعد الـ webhooks!)
// ═════════════════════════════════════════════════════════════════════
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(mongoSanitize());
app.use(cookieParser());

// ─── Logging ─────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(
    morgan("combined", {
      stream: { write: (message) => logger.info(message.trim()) },
    }),
  );
}

// ─── Static Files ────────────────────────────────────────────────────────────
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    next();
  },
  express.static(path.join(__dirname, "../uploads")),
);

// ─── Health Check ────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  res.status(databaseReady ? 200 : 503).json({
    success: databaseReady,
    message: databaseReady
      ? "Server and database are ready"
      : "Server is running, but database is unavailable",
    database: databaseReady ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

app.use("/api", (req, res, next) => {
  if (mongoose.connection.readyState === 1) return next();
  return res.status(503).json({
    success: false,
    code: "DATABASE_UNAVAILABLE",
    message: "قاعدة البيانات غير متاحة مؤقتاً. يرجى المحاولة بعد قليل.",
  });
});

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use(`/api/${apiVersion}/auth`, require("./routes/auth.routes"));
app.use(`/api/${apiVersion}/users`, require("./routes/user.routes"));
app.use(
  `/api/${apiVersion}/bank-account`,
  require("./routes/bank-account.routes"),
);
app.use(`/api/${apiVersion}/artists`, require("./routes/artist.routes"));
app.use(`/api/${apiVersion}/artworks`, require("./routes/artwork.routes"));
app.use(`/api/${apiVersion}/cart`, require("./routes/cart.routes"));
app.use(`/api/${apiVersion}/favorites`, require("./routes/favorite.routes"));
app.use(`/api/${apiVersion}/orders`, require("./routes/order.routes"));
app.use(`/api/${apiVersion}/shipping`, require("./routes/shipping.routes"));
app.use(
  `/api/${apiVersion}/withdrawals`,
  require("./routes/withdrawal.routes"),
);
app.use(`/api/${apiVersion}/wallet`, require("./routes/wallet.routes"));
app.use(
  `/api/${apiVersion}/subscriptions`,
  require("./routes/subscription.routes"),
);
app.use(`/api/${apiVersion}/admin`, require("./routes/admin.routes"));
app.use(
  `/api/${apiVersion}/notifications`,
  require("./routes/notification.routes"),
);
app.use(`/api/${apiVersion}/reviews`, require("./routes/review.routes"));
app.use(`/api/${apiVersion}/support`, require("./routes/support.routes"));

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
