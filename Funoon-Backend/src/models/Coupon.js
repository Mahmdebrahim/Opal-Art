const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 32,
      match: /^[A-Z0-9_-]+$/,
    },
    discountPercent: { type: Number, required: true, min: 1, max: 99 },
    maxRedemptions: { type: Number, required: true, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    reservedCount: { type: Number, default: 0, min: 0 },
    startsAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

couponSchema.index({ isActive: 1, startsAt: 1, expiresAt: 1 });

module.exports = mongoose.model("Coupon", couponSchema);
