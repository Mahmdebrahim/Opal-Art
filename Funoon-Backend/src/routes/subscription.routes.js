// src/routes/subscription.routes.js
const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const {
  purchaseSubscription,
  getMySubscription,
  getMySubscriptionPayments,
  getSubscriptionQuote,
  getCheckoutDetails,
  validateCoupon,
} = require("../controllers/subscription.controller");
const { protect } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validation.middleware");
const {
  purchaseSubscriptionValidator,
} = require("../validators/subscription.validator");

const couponRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 22,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    req.path === "/purchase" && !String(req.body?.couponCode || "").trim(),
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  message: { message: "تم تجاوز عدد محاولات استخدام الكوبونات. حاول لاحقاً." },
});

// All routes require authentication
router.use(protect);

// Purchase a plan
router.post(
  "/purchase",
  couponRequestLimiter,
  purchaseSubscriptionValidator,
  validate,
  purchaseSubscription,
);

// Get my subscription details
router.get("/my", getMySubscription);

// Get my payment history
router.get("/my/payments", getMySubscriptionPayments);
router.get("/quote/:planId", protect, getSubscriptionQuote);
router.get("/checkout-details/:invoiceId", protect, getCheckoutDetails);
router.post("/coupons/validate", couponRequestLimiter, validateCoupon);
module.exports = router;
