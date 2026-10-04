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
);

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim())
  : ["https://opal-art.vercel.app", "http://localhost:5173"];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error("CORS not allowed"));
      }
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

//══════════════════════════════════════════════════════════════════════════════
// Webhooks
// ═════════════════════════════════════════════════════════════════════════════

// Moyasar Webhook — Smart Router + Conditional Signature
app.post(
  `/api/${apiVersion}/webhooks/moyasar`,
  express.raw({ type: "application/json" }),
  async (req, res, next) => {
    let payment;
    let rawBody;

    try {
      if (Buffer.isBuffer(req.body)) {
        rawBody = req.body.toString("utf8");
        logger.info("📥 Body came as Buffer (ideal)");
      } else if (typeof req.body === "string") {
        rawBody = req.body;
        logger.info("📥 Body came as string");
      } else if (typeof req.body === "object" && req.body !== null) {
        const keys = Object.keys(req.body);

        if (keys.length > 0 && keys.every((k) => /^\d+$/.test(k))) {
          rawBody = Object.values(req.body).join("");
          logger.warn("⚠️ Body came as character-map — reconstructed");
        }

        else {
          rawBody = JSON.stringify(req.body);
          logger.warn("⚠️ Body was pre-parsed by another middleware");
        }
      } else {
        throw new Error(`Unknown body type: ${typeof req.body}`);
      }

      let parsedBody;
      try {
        parsedBody = JSON.parse(rawBody);
      } catch (jsonErr) {
        const cleaned = rawBody.replace(/[^\x20-\x7E\n\r\t]/g, "");
        parsedBody = JSON.parse(cleaned);
      }

      req.rawBody = rawBody;

      const isEnveloped =
        typeof parsedBody?.type === "string" && parsedBody?.data;
      payment = isEnveloped ? parsedBody.data : parsedBody;

      logger.info("✅ Parsed webhook successfully");
      logger.info(`🏷️ Event type: ${parsedBody?.type || "N/A"}`);
      logger.info(`🏷️ Payment status: ${payment?.status || "N/A"}`);
      logger.info(`🏷️ Invoice ID: ${payment?.invoice_id || payment?.id}`);

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

    // SMART ROUTING
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
          { moyasarPaymentId: invoiceId }, 
          { moyasarPaymentId: req.body?.id }, 
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

// OTO Webhook
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

//══════════════════════════════════════════════════════════════════════════════
// Body Parsing 
// ═════════════════════════════════════════════════════════════════════════════
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
