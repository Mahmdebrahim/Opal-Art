// src/models/SubscriptionPayment.js
const mongoose = require("mongoose");

const subscriptionPaymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    plan: {
      type: String,
      enum: ["opal_classic", "opal_plus", "opal_prestige"],
      required: true,
    },
    amount: {
      type: Number, // بالريال
      required: true,
    },
    amountInHalalas: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "EXPIRED"],
      default: "PENDING",
    },
    moyasarPaymentId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    moyasarTransactionId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    moyasarPaymentStatus: {
      type: String,
    },
    paidAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
      default: () => {
        const date = new Date();
        date.setHours(date.getHours() + 24);
        return date;
      },
    },
    failureReason: {
      type: String,
    },

    scenario: {
      type: String,
      enum: ["new", "renewal", "upgrade"],
      default: "new",
    },

    originalPlan: {
      type: String,
      default: null,
    },

    daysLeftAtPurchase: {
      type: Number,
      default: 0,
    },

    startDateAfterPayment: Date,
    endDateAfterPayment: Date,
    originalAmount: { type: Number },
    discountAmount: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    minimumChargeApplied: { type: Boolean, default: false },
    couponCode: { type: String, uppercase: true, trim: true },
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon" },
    couponRedemption: { type: mongoose.Schema.Types.ObjectId, ref: "CouponRedemption" },
    refundStatus: {
      type: String,
      enum: ["NONE", "PENDING", "REFUNDED", "FAILED"],
      default: "NONE",
    },
    refundPaymentId: { type: String },
    refundReference: { type: String },
    refundedAmount: { type: Number },
    refundRequestedAt: { type: Date },
    refundedAt: { type: Date },
    refundFailureReason: { type: String },
    refundAttempts: { type: Number, default: 0 },
    refundEmailSentAt: { type: Date },
  },
  {
    timestamps: true,
  },
);

// Indexes
subscriptionPaymentSchema.index({ user: 1, createdAt: -1 });
subscriptionPaymentSchema.index({ status: 1 });
subscriptionPaymentSchema.index({ status: 1, createdAt: 1 });
subscriptionPaymentSchema.index(
  { expiresAt: 1 },
  {
    expireAfterSeconds: 0,
    partialFilterExpression: { status: "PENDING" },
  },
);
subscriptionPaymentSchema.index({ status: 1, expiresAt: 1 });
subscriptionPaymentSchema.index({ user: 1, status: 1, paidAt: -1 });
subscriptionPaymentSchema.index({ user: 1, plan: 1, status: 1, scenario: 1, createdAt: -1 });
subscriptionPaymentSchema.index({ refundStatus: 1, refundRequestedAt: 1 });
// subscriptionPaymentSchema.index(
//   { user: 1, plan: 1, status: 1 },
//   {
//     unique: true,
//     partialFilterExpression: { status: "PENDING" },
//     name: "unique_pending_per_user_plan",
//   },
// )

module.exports = mongoose.model(
  "SubscriptionPayment",
  subscriptionPaymentSchema,
);
