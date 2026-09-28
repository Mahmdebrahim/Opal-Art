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
      type: Number, // بالهللات
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
// subscriptionPaymentSchema.index(
//   { user: 1, plan: 1, status: 1 },
//   {
//     unique: true,
//     partialFilterExpression: { status: "PENDING" },
//     name: "unique_pending_per_user_plan",
//   },
// );

module.exports = mongoose.model(
  "SubscriptionPayment",
  subscriptionPaymentSchema,
);
