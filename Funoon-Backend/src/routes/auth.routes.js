const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");

const authController = require("../controllers/auth.controller");
const { protect } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validation.middleware");

const {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  verifyEmailValidator,
  resendOtpValidator,
} = require("../validators/auth.validator");

// ─── Rate Limiters ──────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  message: { message: "تجاوزت عدد المحاولات — حاول بعد 15 دقيقة" },
  standardHeaders: true,
  legacyHeaders: false,
});

const resendOtpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { message: "تم تجاوز الحد المسموح — حاول لاحقاً" },
  standardHeaders: true,
  legacyHeaders: false,
});

const verifyOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "تجاوزت عدد المحاولات — حاول بعد قليل" },
  standardHeaders: true,
  legacyHeaders: false,
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,  // 30 refresh / 15 min
  skipSuccessfulRequests: true,
  message: { message: "Too many refresh attempts" },
});



// ─── Public Routes ────────────────────────────
router.post("/register", authLimiter, registerValidator, validate, authController.register);
router.post("/login", authLimiter, loginValidator, validate, authController.login);
router.post("/forgot-password", authLimiter, forgotPasswordValidator, validate, authController.forgotPassword);
router.post("/reset-password", authLimiter, resetPasswordValidator, validate, authController.resetPassword);

// ─── Public Route
// router.post("/refresh-token", authController.refreshToken);
router.post("/refresh-token", refreshLimiter, authController.refreshToken);

// ─── Email Verification ─────────────────────────────────────────────────────
router.post("/verify-email", verifyOtpLimiter, verifyEmailValidator, validate, authController.verifyEmail);
router.post("/resend-otp", resendOtpLimiter, resendOtpValidator, validate, authController.resendVerificationOTP);
router.get("/verify-status/:userId", authController.checkVerificationStatus);

// ─── Protected Routes (بدون authLimiter — محمية بالـ token أصلاً) ────────────
router.post("/logout", authController.logout);
router.get("/me", protect, authController.getMe);

module.exports = router;