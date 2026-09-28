const Coupon = require("../models/Coupon");
const CouponRedemption = require("../models/CouponRedemption");
const { BadRequestError } = require("../utils/api-error");

const normalizeCouponCode = (code) =>
  String(code || "")
    .trim()
    .toUpperCase();

const getValidCouponForUser = async (code, userId) => {
  const normalizedCode = normalizeCouponCode(code);
  if (!normalizedCode) throw new BadRequestError("كود الخصم مطلوب");

  const coupon = await Coupon.findOne({ code: normalizedCode });
  if (!coupon || !coupon.isActive)
    throw new BadRequestError("كود الخصم غير صالح أو متوقف");

  const now = new Date();
  if (coupon.startsAt > now)
    throw new BadRequestError("كود الخصم غير متاح بعد");
  if (coupon.expiresAt <= now)
    throw new BadRequestError("انتهت صلاحية كود الخصم");
  const previousRedemption = await CouponRedemption.findOne({
    coupon: coupon._id,
    user: userId,
  }).populate("subscriptionPayment", "status");

  if (previousRedemption?.status === "REDEEMED") {
    throw new BadRequestError("استخدمت كود الخصم هذا من قبل");
  }

  if (previousRedemption?.status === "PENDING") {
    if (previousRedemption.subscriptionPayment?.status === "PENDING") {
      return { coupon, hasPendingInvoice: true };
    }

    const released = await CouponRedemption.findOneAndDelete({
      _id: previousRedemption._id,
      status: "PENDING",
    });
    if (released) {
      await Coupon.updateOne(
        { _id: coupon._id, reservedCount: { $gt: 0 } },
        { $inc: { reservedCount: -1 } },
      );
      coupon.reservedCount = Math.max(0, coupon.reservedCount - 1);
    }
  }

  if (coupon.usedCount + coupon.reservedCount >= coupon.maxRedemptions) {
    throw new BadRequestError("تم الوصول إلى الحد الأقصى لاستخدام كود الخصم");
  }

  return { coupon, hasPendingInvoice: false };
};

const releaseCouponReservation = async (payment) => {
  if (!payment?.coupon || !payment?.couponRedemption) return;

  const reservation = await CouponRedemption.findOneAndDelete({
    _id: payment.couponRedemption,
    status: "PENDING",
  });

  if (reservation) {
    await Coupon.updateOne(
      { _id: payment.coupon, reservedCount: { $gt: 0 } },
      { $inc: { reservedCount: -1 } },
    );
  }
};

module.exports = {
  normalizeCouponCode,
  getValidCouponForUser,
  releaseCouponReservation,
};
