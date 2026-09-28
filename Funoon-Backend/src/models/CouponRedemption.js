const mongoose = require("mongoose");

const couponRedemptionSchema = new mongoose.Schema(
  {
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      required: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    subscriptionPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPayment",
      required: true,
    },
    originalPrice: { type: Number, required: true, min: 1 },
    discountAmount: { type: Number, required: true, min: 0 },
    finalPrice: { type: Number, required: true, min: 1 },
    discountPercent: { type: Number, required: true, min: 0, max: 99 },
    status: { type: String, enum: ["PENDING", "REDEEMED"], default: "PENDING" },
    redeemedAt: Date,
  },
  { timestamps: true },
);

couponRedemptionSchema.index({ coupon: 1, user: 1 }, { unique: true });
couponRedemptionSchema.index({ subscriptionPayment: 1 }, { unique: true });

module.exports = mongoose.model("CouponRedemption", couponRedemptionSchema);
