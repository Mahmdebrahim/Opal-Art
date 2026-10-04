const mongoose = require("mongoose");
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const SubscriptionPayment = require("../models/SubscriptionPayment");
const Coupon = require("../models/Coupon");
const CouponRedemption = require("../models/CouponRedemption");
const MoyasarService = require("../services/payment/moyasar.service");
const { PLAN_CONFIG } = require("../models/User");
const { BadRequestError, NotFoundError } = require("../utils/api-error");
const ApiResponse = require("../utils/api-response");
const catchAsync = require("../utils/catch-async");
const logger = require("../utils/logger");
const M = require("../utils/messages");
const eventEmitter = require("../events/event-emitter");
const EVENTS = require("../events/events");
const {
  REPLACED_REASON,
  processReplacedSubscriptionRefund,
} = require("../services/subscription-refund.service");
const {
  normalizeCouponCode,
  getValidCouponForUser,
  releaseCouponReservation,
} = require("../services/coupon.service");

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const RENEWAL_WINDOW_DAYS = 30;

const PAYMENT_EXPIRE_MINUTES = Number(
  process.env.SUBSCRIPTION_PAYMENT_EXPIRE_MINUTES || 15,
);

const PLAN_RANK = {
  opal_classic: 1,
  opal_plus: 2,
  opal_prestige: 3,
};

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

const expirePendingSubscriptionPayment = async (payment) => {
  const expiredPayment = await SubscriptionPayment.findOneAndUpdate(
    { _id: payment._id, status: "PENDING" },
    { $set: { status: "EXPIRED", failureReason: REPLACED_REASON } },
    { new: true },
  );

  if (!expiredPayment) return null;

  await releaseCouponReservation(expiredPayment);

  if (expiredPayment.moyasarPaymentId) {
    void MoyasarService.cancelInvoice(expiredPayment.moyasarPaymentId).catch(
      (err) => {
        logger.warn(
          `⚠️ Failed to cancel stale invoice ${expiredPayment.moyasarPaymentId}: ${err.message}`,
        );
      },
    );
  }

  return expiredPayment;
};

const addMonths = (date, months) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

const getDaysLeft = (endDate) => {
  if (!endDate) return 0;
  return Math.max(0, Math.ceil((new Date(endDate) - new Date()) / MS_PER_DAY));
};

const refundLatePaymentForReplacedInvoice = async (
  subscriptionPaymentId,
  moyasarPaymentId,
  eventAmount,
  fallbackAmount,
) => {
  const capturedAmount = Number(eventAmount);
  const refundAmount =
    Number.isFinite(capturedAmount) && capturedAmount > 0
      ? capturedAmount / 100
      : fallbackAmount;
  const payment = await SubscriptionPayment.findOneAndUpdate(
    {
      _id: subscriptionPaymentId,
      status: "EXPIRED",
      failureReason: REPLACED_REASON,
      refundStatus: { $in: ["NONE", "FAILED"] },
    },
    {
      $set: {
        refundStatus: "PENDING",
        refundPaymentId: moyasarPaymentId,
        refundedAmount: refundAmount,
        refundRequestedAt: new Date(),
        refundFailureReason: null,
      },
      $inc: { refundAttempts: 1 },
    },
    { new: true },
  );

  if (!payment) return { claimed: false };

  if (!payment.refundPaymentId || !payment.refundedAmount) {
    await SubscriptionPayment.updateOne(
      { _id: payment._id, refundStatus: "PENDING" },
      {
        $set: {
          refundStatus: "FAILED",
          refundFailureReason:
            "Missing payment id or captured amount in webhook",
        },
      },
    );
    return { claimed: true, refunded: false };
  }

  return {
    claimed: true,
    ...(await processReplacedSubscriptionRefund(payment._id)),
  };
};

const calculateSubscriptionQuote = (user, targetPlanId) => {
  const targetPlan = PLAN_CONFIG[targetPlanId];

  if (!targetPlan) {
    throw new BadRequestError("الباقة غير موجودة");
  }

  const now = new Date();
  const hasActive = user.hasActiveSubscription?.() || false;

  if (!hasActive) {
    return {
      scenario: "new",
      canPurchase: true,
      amountToPay: targetPlan.price,
      originalPlan: null,
      targetPlanId,
      daysLeft: 0,
      startDate: now,
      endDate: addMonths(now, targetPlan.durationMonths || 12),
      message: "اشتراك جديد",
    };
  }

  const currentPlanId = user.subscription.plan;
  const currentPlan = PLAN_CONFIG[currentPlanId];

  if (!currentPlan) {
    return {
      scenario: "new",
      canPurchase: true,
      amountToPay: targetPlan.price,
      originalPlan: currentPlanId,
      targetPlanId,
      daysLeft: 0,
      startDate: now,
      endDate: addMonths(now, targetPlan.durationMonths || 12),
      message: "اشتراك جديد",
    };
  }

  const currentRank = PLAN_RANK[currentPlanId] || 0;
  const targetRank = PLAN_RANK[targetPlanId] || 0;
  const daysLeft = getDaysLeft(user.subscription.endDate);

  // نفس الباقة = تجديد
  if (currentPlanId === targetPlanId) {
    if (daysLeft > RENEWAL_WINDOW_DAYS) {
      return {
        scenario: "renewal_not_allowed",
        canPurchase: false,
        amountToPay: 0,
        originalPlan: currentPlanId,
        targetPlanId,
        daysLeft,
        message: `التجديد متاح قبل انتهاء الاشتراك بـ ${RENEWAL_WINDOW_DAYS} يوم فقط. المتبقي حالياً ${daysLeft} يوم.`,
      };
    }

    const startDate = new Date(user.subscription.endDate);
    const endDate = addMonths(startDate, targetPlan.durationMonths || 12);

    return {
      scenario: "renewal",
      canPurchase: true,
      amountToPay: targetPlan.price,
      originalPlan: currentPlanId,
      targetPlanId,
      daysLeft,
      startDate,
      endDate,
      message: "تجديد الاشتراك",
    };
  }

  if (targetRank > currentRank) {
    const yearlyDiff = targetPlan.price - currentPlan.price;
    const termDays = 365;
    let amountToPay = roundMoney((yearlyDiff * daysLeft) / termDays);

    if (amountToPay > 0 && amountToPay < 1) {
      amountToPay = 1;
    }

    return {
      scenario: "upgrade",
      canPurchase: true,
      amountToPay,
      originalPlan: currentPlanId,
      targetPlanId,
      daysLeft,
      startDate: now,
      endDate: new Date(user.subscription.endDate),
      message: "ترقية فورية للباقة الأعلى",
    };
  }

  return {
    scenario: "downgrade_not_supported",
    canPurchase: false,
    amountToPay: 0,
    originalPlan: currentPlanId,
    targetPlanId,
    daysLeft,
    message: "تغيير الباقة لباقة أقل غير متاح حالياً.",
  };
};
// ═══════════════════════════════════════════════════
// Purchase Subscription
// ═══════════════════════════════════════════════════

// @desc    Purchase a subscription plan
// @route   POST /api/v1/subscriptions/purchase
// @access  Private
const purchaseSubscription = catchAsync(async (req, res, next) => {
  const { planId, couponCode: couponCodeInput } = req.body;
  const userId = req.user._id;
  const couponCode = normalizeCouponCode(couponCodeInput);

  const plan = PLAN_CONFIG[planId];
  if (!plan) throw new BadRequestError(M.subscriptions.planNotFound);

  const user = await User.findById(userId);
  if (!user) throw new NotFoundError("المستخدم غير موجود");

  const quote = calculateSubscriptionQuote(user, planId);

  if (!quote.canPurchase) {
    throw new BadRequestError(quote.message);
  }

  const expireThreshold = new Date(
    Date.now() - PAYMENT_EXPIRE_MINUTES * 60 * 1000,
  );

  // ═══════════════════════════════════════════════════
  // 1. Cleanup: expired payments + cancel their Moyasar invoices
  // ═══════════════════════════════════════════════════
  const expiredCandidates = await SubscriptionPayment.find({
    user: userId,
    plan: planId,
    status: "PENDING",
    createdAt: { $lt: expireThreshold },
  });

  if (expiredCandidates.length > 0) {
    await SubscriptionPayment.updateMany(
      { _id: { $in: expiredCandidates.map((p) => p._id) } },
      { $set: { status: "EXPIRED" } },
    );

    await Promise.all(expiredCandidates.map(releaseCouponReservation));

    // Invoice cancellation is best-effort and must not delay a new checkout.
    void Promise.allSettled(
      expiredCandidates
        .filter((payment) => payment.moyasarPaymentId)
        .map((payment) =>
          MoyasarService.cancelInvoice(payment.moyasarPaymentId),
        ),
    ).then((results) => {
      results.forEach((result) => {
        if (result.status === "rejected") {
          logger.warn(
            `Failed to cancel expired subscription invoice: ${result.reason?.message}`,
          );
        }
      });
    });

    logger.info(
      `🗑️ Expired ${expiredCandidates.length} subscription payment(s) + invoices for user ${userId}`,
    );
  }

  // 2. Reuse only when the requested coupon matches the active invoice.
  const existing = await SubscriptionPayment.findOne({
    user: userId,
    plan: planId,
    status: "PENDING",
    scenario: quote.scenario,
    moyasarPaymentId: { $ne: null, $exists: true },
    createdAt: { $gt: expireThreshold },
  }).sort({ createdAt: -1 });

  if (existing) {
    const existingCouponCode = normalizeCouponCode(existing.couponCode);
    if (existingCouponCode !== couponCode) {
      await expirePendingSubscriptionPayment(existing);
    } else {
      logger.info(`♻️ Reusing existing payment: ${existing._id}`);
      return ApiResponse.success(
        res,
        {
          paymentUrl: `${process.env.MOYASAR_CHECKOUT_URL || "https://checkout.moyasar.com"}/invoices/${existing.moyasarPaymentId}`,
          invoiceId: existing.moyasarPaymentId,
          planDetails: plan,
          existingPayment: true,
          scenario: existing.scenario,
          amountToPay: existing.amount,
          originalAmount: existing.originalAmount || existing.amount,
          discountAmount: existing.discountAmount || 0,
          discountPercent: existing.discountPercent || 0,
          couponCode: existing.couponCode || null,
          minimumChargeApplied: existing.minimumChargeApplied || false,
        },
        "Existing payment found",
      );
    }
  }

  const inFlight = await SubscriptionPayment.findOne({
    user: userId,
    plan: planId,
    status: "PENDING",
    $or: [{ moyasarPaymentId: null }, { moyasarPaymentId: { $exists: false } }],
    createdAt: { $gt: expireThreshold },
  }).sort({ createdAt: -1 });

  if (inFlight) {
    let refreshed = null;
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 500));
      refreshed = await SubscriptionPayment.findById(inFlight._id);
      if (refreshed?.moyasarPaymentId) break;
    }

    if (refreshed?.moyasarPaymentId) {
      if (normalizeCouponCode(refreshed.couponCode) === couponCode) {
        logger.info(`♻️ Reusing payment after wait: ${refreshed._id}`);
        return ApiResponse.success(
          res,
          {
            paymentUrl: `${process.env.MOYASAR_CHECKOUT_URL || "https://checkout.moyasar.com"}/invoices/${refreshed.moyasarPaymentId}`,
            invoiceId: refreshed.moyasarPaymentId,
            planDetails: plan,
            existingPayment: true,
            scenario: refreshed.scenario,
            amountToPay: refreshed.amount,
            originalAmount: refreshed.originalAmount || refreshed.amount,
            discountAmount: refreshed.discountAmount || 0,
            discountPercent: refreshed.discountPercent || 0,
            couponCode: refreshed.couponCode || null,
            minimumChargeApplied: refreshed.minimumChargeApplied || false,
          },
          "Existing payment found",
        );
      }

      await expirePendingSubscriptionPayment(refreshed);
    }

    if (refreshed && refreshed.status === "PENDING") {
      await expirePendingSubscriptionPayment(refreshed);
    }
  }

  const couponValidation = couponCode
    ? await getValidCouponForUser(couponCode, userId)
    : { coupon: null };
  const coupon = couponValidation.coupon;
  const originalAmount = quote.amountToPay;
  const requestedDiscount = coupon
    ? roundMoney((originalAmount * coupon.discountPercent) / 100)
    : 0;
  // Moyasar invoices require at least 1 SAR. The stored discount is the real one.
  const discountAmount = Math.min(
    requestedDiscount,
    Math.max(0, roundMoney(originalAmount - 1)),
  );
  const amountToPay = Math.max(1, roundMoney(originalAmount - discountAmount));
  const minimumChargeApplied = requestedDiscount > discountAmount;

  if (
    !Number.isFinite(originalAmount) ||
    !Number.isFinite(discountAmount) ||
    !Number.isFinite(amountToPay) ||
    amountToPay < 1 ||
    amountToPay > originalAmount ||
    discountAmount < 0
  ) {
    throw new BadRequestError("تعذّر حساب سعر الاشتراك بعد الخصم");
  }

  if (coupon) {
    const staleRedemption = await CouponRedemption.findOne({
      coupon: coupon._id,
      user: userId,
      status: "PENDING",
    });

    if (staleRedemption) {
      const linkedPayment = await SubscriptionPayment.findById(
        staleRedemption.subscriptionPayment,
      );

      const isSamePlanPending =
        linkedPayment &&
        linkedPayment.status === "PENDING" &&
        String(linkedPayment.plan) === String(planId);

      // لو الحجز القديم على باقة تانية (أو فاتورة ميتة) → نضفه
      if (!isSamePlanPending) {
        if (linkedPayment && linkedPayment.status === "PENDING") {
          await expirePendingSubscriptionPayment(linkedPayment);
        } else {
          await releaseCouponReservation({
            coupon: coupon._id,
            couponRedemption: staleRedemption._id,
          });
        }

        logger.info(
          `🧹 Released stale coupon reservation ${staleRedemption._id} (plan switch: ${linkedPayment?.plan || "dead"} → ${planId})`,
        );
      }
    }
  }

  // 4. اعمل subPayment جديد
  const subPayment = await SubscriptionPayment.create({
    user: userId,
    plan: planId,
    amount: amountToPay,
    amountInHalalas: Math.round(amountToPay * 100),
    originalAmount,
    discountAmount,
    discountPercent: coupon?.discountPercent || 0,
    minimumChargeApplied,
    couponCode: coupon?.code || null,
    coupon: coupon?._id || null,
    status: "PENDING",
    scenario: quote.scenario,
    originalPlan: quote.originalPlan,
    daysLeftAtPurchase: quote.daysLeft,
    startDateAfterPayment: quote.startDate,
    endDateAfterPayment: quote.endDate,
    expiresAt: new Date(Date.now() + PAYMENT_EXPIRE_MINUTES * 60 * 1000),
  });

  if (coupon) {
    const reservedCoupon = await Coupon.findOneAndUpdate(
      {
        _id: coupon._id,
        isActive: true,
        startsAt: { $lte: new Date() },
        expiresAt: { $gt: new Date() },
        $expr: {
          $lt: [{ $add: ["$usedCount", "$reservedCount"] }, "$maxRedemptions"],
        },
      },
      { $inc: { reservedCount: 1 } },
      { new: true },
    );

    if (!reservedCoupon) {
      await SubscriptionPayment.findByIdAndDelete(subPayment._id);
      throw new BadRequestError("كود الخصم لم يعد متاحاً، جرّب كوداً آخر");
    }

    try {
      const redemption = await CouponRedemption.create({
        coupon: coupon._id,
        user: userId,
        subscriptionPayment: subPayment._id,
        originalPrice: originalAmount,
        discountAmount,
        finalPrice: amountToPay,
        discountPercent: coupon.discountPercent,
      });
      subPayment.couponRedemption = redemption._id;
      await subPayment.save();
    } catch (error) {
      await Coupon.updateOne(
        { _id: coupon._id, reservedCount: { $gt: 0 } },
        { $inc: { reservedCount: -1 } },
      );
      await SubscriptionPayment.findByIdAndDelete(subPayment._id);
      if (error?.code === 11000)
        throw new BadRequestError("استخدمت كود الخصم هذا من قبل");
      throw error;
    }
  }

  // 5. Moyasar invoice
  let invoice;
  try {
    const scenarioLabels = {
      new: "اشتراك جديد",
      renewal: "تجديد",
      upgrade: "ترقية",
    };
    invoice = await MoyasarService.createInvoice({
      amount: Math.round(amountToPay * 100),
      description: `أوبال جاليري - اشتراك ${plan.label} (${scenarioLabels[quote.scenario] || "اشتراك"})`,
      callbackUrl: `${process.env.NGROK_URL}/api/v1/webhooks/moyasar`,
      successUrl: `${process.env.FRONTEND_URL}/subscription/success`,
      backUrl: `${process.env.FRONTEND_URL}/subscription/cancel`,
      expired_at: new Date(
        Date.now() + PAYMENT_EXPIRE_MINUTES * 60 * 1000,
      ).toISOString(),
      metadata: {
        type: "subscription",
        subscriptionPaymentId: subPayment._id.toString(),
        userId: userId.toString(),
        planId,
        scenario: quote.scenario,
        couponCode: coupon?.code || null,
      },
    });
    logger.info(`🧪 Sandbox test URL: ${invoice.url}`);
    logger.info(`🧪 Invoice ID: ${invoice.id}`);
    logger.info(`🧪 Amount: ${quote.amountToPay} SAR`);
    logger.info(`🧪 Scenario: ${quote.scenario}`);
    if (!invoice?.id) throw new Error(M.subscriptions.paymentInitFailed);
  } catch (error) {
    logger.error("❌ Moyasar invoice failed:", error.message);
    subPayment.status = "FAILED";
    subPayment.failureReason = error.message;
    await subPayment.save();
    await releaseCouponReservation(subPayment);
    throw new BadRequestError("تعذّر بدء عملية الدفع. حاول مرة أخرى.");
  }

  subPayment.moyasarPaymentId = invoice.id;
  await subPayment.save();

  return ApiResponse.success(
    res,
    {
      paymentUrl: invoice.url,
      invoiceId: invoice.id,
      planDetails: plan,
      scenario: quote.scenario,
      amountToPay,
      originalAmount,
      discountAmount,
      discountPercent: coupon?.discountPercent || 0,
      couponCode: coupon?.code || null,
      minimumChargeApplied,
      daysLeft: quote.daysLeft,
      message: quote.message,
    },
    "Subscription invoice created",
  );
});

const validateCoupon = catchAsync(async (req, res) => {
  const { code } = req.body;
  const { coupon, hasPendingInvoice } = await getValidCouponForUser(
    code,
    req.user._id,
  );
  return ApiResponse.success(
    res,
    {
      code: coupon.code,
      discountPercent: coupon.discountPercent,
      hasPendingInvoice,
      message: `تم تطبيق خصم ${coupon.discountPercent}%`,
    },
    "Coupon is valid",
  );
});

// @desc    Get subscription quote for a plan
// @route   GET /api/v1/subscriptions/quote/:planId
// @access  Private
const getSubscriptionQuote = catchAsync(async (req, res) => {
  const { planId } = req.params;
  const user = await User.findById(req.user._id);

  if (!user) {
    throw new NotFoundError("المستخدم غير موجود");
  }

  const quote = calculateSubscriptionQuote(user, planId);
  const plan = PLAN_CONFIG[planId];

  return ApiResponse.success(
    res,
    {
      ...quote,
      planDetails: plan,
      currentPlan: user.subscription?.plan || null,
      currentEndDate: user.subscription?.endDate || null,
    },
    "Subscription quote calculated",
  );
});

// @desc    Get my subscription details
// @route   GET /api/v1/subscriptions/my
// @access  Private
const getMySubscription = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  const plan = PLAN_CONFIG[user.subscription?.plan];

  return ApiResponse.success(
    res,
    {
      subscription: {
        plan: user.subscription?.plan || "none",
        label: plan?.label || "No Plan",
        startDate: user.subscription?.startDate,
        endDate: user.subscription?.endDate,
        isActive: user.hasActiveSubscription(),
        pricePaid: user.subscription?.pricePaid,
        autoRenew: user.subscription?.autoRenew,
        features: plan?.features || {},
        maxArtworks: plan?.maxArtworks || 0,
        commission: plan?.commission || 0.15,
      },
    },
    "Subscription details retrieved",
  );
});

// @desc    Get my subscription payment history
// @route   GET /api/v1/subscriptions/my/payments
// @access  Private
const getMySubscriptionPayments = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const payments = await SubscriptionPayment.find({
    user: req.user._id,
    status: "PAID",
  })
    .select(
      "plan amount status createdAt paidAt failureReason moyasarPaymentId scenario",
    )

    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await SubscriptionPayment.countDocuments({
    user: req.user._id,
  });

  return ApiResponse.success(
    res,
    {
      payments,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    },
    "Subscription payments retrieved",
  );
});

// @desc    Get real checkout details for a subscription invoice
// @route   GET /api/v1/subscriptions/checkout-details/:invoiceId
// @access  Private
const getCheckoutDetails = catchAsync(async (req, res) => {
  const { invoiceId } = req.params;

  const subPayment = await SubscriptionPayment.findOne({
    moyasarPaymentId: invoiceId,
    user: req.user._id,
  });

  if (!subPayment) {
    throw new NotFoundError("فاتورة الدفع غير موجودة");
  }

  const plan = PLAN_CONFIG[subPayment.plan];

  return ApiResponse.success(
    res,
    {
      invoiceId,
      status: subPayment.status,
      scenario: subPayment.scenario || "new",
      amountToPay: subPayment.amount,
      originalAmount: subPayment.originalAmount || subPayment.amount,
      discountAmount: subPayment.discountAmount || 0,
      discountPercent: subPayment.discountPercent || 0,
      couponCode: subPayment.couponCode || null,
      minimumChargeApplied: subPayment.minimumChargeApplied || false,
      fullPlanPrice:
        plan?.price || subPayment.originalAmount || subPayment.amount,
      daysLeftAtPurchase: subPayment.daysLeftAtPurchase || 0,
      originalPlan: subPayment.originalPlan || null,
      planDetails: plan
        ? {
            id: subPayment.plan,
            name: plan.label,
            label: plan.label,
            price: plan.price,
            popular: plan.popular || false,
            durationMonths: plan.durationMonths || 12,
          }
        : null,
    },
    "Checkout details retrieved",
  );
});

// @desc    Handle Moyasar webhook for subscription payments
// @route   POST /api/v1/webhooks/moyasar/subscription
// @access  Public (Moyasar server)
// const handleSubscriptionWebhook = catchAsync(async (req, res, next) => {
//   let event;
//   try {
//     if (
//       typeof req.body === "object" &&
//       req.body !== null &&
//       !Buffer.isBuffer(req.body)
//     ) {
//       event = req.body;
//     } else if (Buffer.isBuffer(req.body)) {
//       event = JSON.parse(req.body.toString("utf8"));
//     } else if (typeof req.body === "string") {
//       event = JSON.parse(req.body);
//     } else {
//       throw new Error("Invalid body type");
//     }
//   } catch (parseErr) {
//     logger.error("❌ Subscription webhook parse error:", parseErr.message);
//     return res.status(400).json({ error: "Invalid JSON" });
//   }

//   logger.info("📥 Subscription webhook received, status:", event.status);
//   logger.info("📦 Full payload:", JSON.stringify(event, null, 2));
//   logger.info("🏷️ Event status:", event.status);

//   if (event.status !== "paid") {
//     logger.info("⚠️ Ignoring non-paid event, status:", event.status);
//     return res.status(200).json({ received: true });
//   }

//   const metadata = event.metadata || {};
//   logger.info("📦 Metadata:", metadata);

//   if (metadata.type !== "subscription") {
//     logger.info("⚠️ Not a subscription payment");
//     return res.status(200).json({ received: true });
//   }

//   const { subscriptionPaymentId, userId, planId } = metadata;
//   const plan = PLAN_CONFIG[planId];

//   if (!plan) {
//     logger.error("❌ Invalid plan in metadata:", planId);
//     return res.status(200).json({ received: true });
//   }

//   if (!subscriptionPaymentId || !userId) {
//     logger.error("❌ Missing required metadata");
//     return res.status(200).json({ received: true });
//   }

//   const session = await mongoose.startSession();
//   session.startTransaction();

//   let user = null;
//   let activationStartDate = null;
//   let activationEndDate = null;

//   try {
//     let subPayment = await SubscriptionPayment.findOneAndUpdate(
//       {
//         _id: subscriptionPaymentId,
//         status: "PENDING",
//       },
//       {
//         $set: {
//           status: "PAID",
//           moyasarPaymentStatus: event.status,
//           moyasarPaymentId: event.id,
//           paidAt: new Date(),
//         },
//       },
//       { session, new: true },
//     );

//     if (!subPayment) {
//       const anyPayment = await SubscriptionPayment.findById(
//         subscriptionPaymentId,
//       ).session(session);

//       if (anyPayment && anyPayment.status === "EXPIRED") {
//         logger.warn(
//           `⚠️ Payment succeeded on an EXPIRED subscription record (${subscriptionPaymentId}) — honoring payment and activating anyway.`,
//         );
//         anyPayment.status = "PAID";
//         anyPayment.moyasarPaymentStatus = event.status;
//         anyPayment.moyasarPaymentId = event.id;
//         anyPayment.paidAt = new Date();
//         await anyPayment.save({ session });
//         subPayment = anyPayment;
//       } else {
//         logger.warn(
//           "⚠️ Payment already processed or not found:",
//           subscriptionPaymentId,
//         );
//         await session.abortTransaction();
//         session.endSession();
//         return res.status(200).json({ received: true, duplicate: true });
//       }
//     }

//     user = await User.findById(userId).session(session);
//     if (!user) {
//       logger.error("❌ User not found:", userId);
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(200).json({ received: true });
//     }

//     // ═══════════════════════════════════════════════════
//     // ✅ Calculate activation dates (from stored subPayment)
//     // ═══════════════════════════════════════════════════
//     const scenario = subPayment.scenario || metadata.scenario || "new";
//     activationStartDate = subPayment.startDateAfterPayment || new Date();
//     activationEndDate =
//       subPayment.endDateAfterPayment ||
//       addMonths(activationStartDate, plan.durationMonths || 12);

//     user.role = "artist";
//     user.subscription = {
//       plan: planId,
//       startDate: activationStartDate,
//       endDate: activationEndDate,
//       isActive: true,
//       pricePaid: subPayment.amount,
//       moyasarPaymentId: event.id,
//       moyasarPaymentStatus: event.status,
//       autoRenew: true,
//       reminderSent: false,
//     };

//     // ═══════════════════════════════════════════════════
//     // ✅ Reset Free Shipping Quota on new/renewal
//     // ═══════════════════════════════════════════════════
//     if (scenario === "new" || scenario === "renewal") {
//       user.freeShippingUsed = 0;
//       logger.info(
//         `🔄 Free shipping quota reset for user ${userId} (${scenario})`,
//       );
//     } else if (scenario === "upgrade") {
//       logger.info(
//         `⬆️ Upgrade: keeping current quota (used: ${user.freeShippingUsed || 0})`,
//       );
//     }

//     await user.save({ session });

//     let wallet = await Wallet.findOne({ user: userId }).session(session);
//     if (!wallet) {
//       wallet = new Wallet({ user: userId });
//       await wallet.save({ session });
//       logger.info("✅ Created new wallet for artist:", userId);
//     }

//     await session.commitTransaction();
//     logger.info(`✅ Transaction committed for user ${userId}`);
//   } catch (error) {
//     if (session.inTransaction()) {
//       await session.abortTransaction();
//     }
//     session.endSession();
//     logger.error("❌ Subscription webhook transaction error:", error);

//     const isTransient =
//       error?.codeName === "WriteConflict" ||
//       error?.code === 112 ||
//       error?.errorLabels?.includes?.("TransientTransactionError");

//     if (isTransient) {
//       return res
//         .status(500)
//         .json({ received: false, retry: true, error: error.message });
//     }
//     return res.status(200).json({ received: true, error: error.message });
//   }

//   session.endSession();

//   try {
//     eventEmitter.safeEmit(EVENTS.SUBSCRIPTION_ACTIVATED, {
//       userId: user._id,
//       email: user.email,
//       name: user.name,
//       planId,
//       planLabel: plan.label,
//       startDate: activationStartDate,
//       endDate: activationEndDate,
//     });

//     logger.info(
//       `✅ Subscription activated for user ${userId}, plan: ${planId}, ` +
//         `from ${activationStartDate.toISOString()} to ${activationEndDate.toISOString()}`,
//     );
//   } catch (eventError) {
//     logger.error("❌ Event emission error (non-critical):", eventError);
//   }

//   return res.status(200).json({ received: true });
// });

// const handleSubscriptionWebhook = catchAsync(async (req, res, next) => {
//   let event;
//   try {
//     // ✅ Unwrap لو كان enveloped (من Dashboard webhook)
//     const isEnveloped =
//       typeof req.body?.type === "string" &&
//       typeof req.body?.data === "object";

//     if (isEnveloped) {
//       event = req.body.data;
//     } else if (typeof req.body === "object" && req.body !== null && !Buffer.isBuffer(req.body)) {
//       event = req.body;
//     } else if (Buffer.isBuffer(req.body)) {
//       event = JSON.parse(req.body.toString("utf8"));
//     } else if (typeof req.body === "string") {
//       event = JSON.parse(req.body);
//     } else {
//       throw new Error("Invalid body type");
//     }
//   } catch (parseErr) {
//     logger.error("❌ Subscription webhook parse error:", parseErr.message);
//     return res.status(400).json({ error: "Invalid JSON" });
//   }

//   logger.info("📥 Subscription webhook received");
//   logger.info(`🏷️ Event type: ${req.body?.type || "N/A"}, status: ${event?.status}`);
//   logger.info(`🏷️ Invoice ID: ${event?.invoice_id || event?.id}`);

//   // ═══════════════════════════════════════════════════
//   // ✅ NEW: Handle failed/expired/cancelled payments
//   // ═══════════════════════════════════════════════════
//   const FAILED_STATUSES = ["failed", "expired", "cancelled", "voided"];

//   if (FAILED_STATUSES.includes(event?.status)) {
//     logger.warn(`⚠️ Subscription payment ${event.status}: ${event.message || "no message"}`);

//     const invoiceId = event.invoice_id || event.id;
//     if (invoiceId) {
//       const subPayment = await SubscriptionPayment.findOne({
//         moyasarPaymentId: invoiceId,
//         status: "PENDING",
//       });

//       if (subPayment) {
//         subPayment.status = "FAILED";
//         subPayment.failureReason = event.message || `Payment ${event.status}`;
//         subPayment.failedAt = new Date();
//         subPayment.moyasarPaymentId = event.id;
//         subPayment.moyasarPaymentStatus = event.status;
//         await subPayment.save();
//         logger.info(`✅ Subscription payment marked as FAILED: ${subPayment._id}`);
//       } else {
//         logger.info(`ℹ️ No pending subscription payment found for invoice ${invoiceId}`);
//       }
//     }

//     return res.status(200).json({ received: true, failed: true });
//   }

//   // ═══════════════════════════════════════════════════
//   // Ignore non-paid events (initiated, authorized, etc.)
//   // ═══════════════════════════════════════════════════
//   if (event?.status !== "paid") {
//     logger.info(`ℹ️ Ignoring non-paid event, status: ${event?.status}`);
//     return res.status(200).json({ received: true });
//   }

//   const metadata = event.metadata || {};
//   logger.info("📦 Metadata:", metadata);

//   // Fallback: لو metadata مش موجودة (Dashboard webhook)، دور بالـ invoice_id
//   let { subscriptionPaymentId, userId, planId } = metadata;

//   if (!subscriptionPaymentId) {
//     const invoiceId = event.invoice_id || event.id;
//     if (invoiceId) {
//       const fallbackPayment = await SubscriptionPayment.findOne({
//         moyasarPaymentId: invoiceId,
//       });
//       if (fallbackPayment) {
//         subscriptionPaymentId = fallbackPayment._id.toString();
//         userId = fallbackPayment.user.toString();
//         planId = fallbackPayment.plan;
//         logger.info(`♻️ Fallback: found subscription payment via invoice_id ${invoiceId}`);
//       }
//     }
//   }

//   const plan = PLAN_CONFIG[planId];

//   if (!plan) {
//     logger.error("❌ Invalid plan in metadata:", planId);
//     return res.status(200).json({ received: true });
//   }

//   if (!subscriptionPaymentId || !userId) {
//     logger.error("❌ Missing required metadata and no fallback found");
//     return res.status(200).json({ received: true });
//   }

//   const session = await mongoose.startSession();
//   session.startTransaction();

//   let user = null;
//   let activationStartDate = null;
//   let activationEndDate = null;

//   try {
//     let subPayment = await SubscriptionPayment.findOneAndUpdate(
//       {
//         _id: subscriptionPaymentId,
//         status: "PENDING",
//       },
//       {
//         $set: {
//           status: "PAID",
//           moyasarPaymentStatus: event.status,
//           moyasarPaymentId: event.id,
//           paidAt: new Date(),
//         },
//       },
//       { session, new: true },
//     );

//     if (!subPayment) {
//       const anyPayment = await SubscriptionPayment.findById(
//         subscriptionPaymentId,
//       ).session(session);

//       if (anyPayment && anyPayment.status === "EXPIRED") {
//         logger.warn(
//           `⚠️ Payment succeeded on an EXPIRED subscription record (${subscriptionPaymentId}) — honoring payment`,
//         );
//         anyPayment.status = "PAID";
//         anyPayment.moyasarPaymentStatus = event.status;
//         anyPayment.moyasarPaymentId = event.id;
//         anyPayment.paidAt = new Date();
//         await anyPayment.save({ session });
//         subPayment = anyPayment;
//       } else if (anyPayment && anyPayment.status === "PAID") {
//         logger.info(`ℹ️ Duplicate webhook for already-paid subscription: ${subscriptionPaymentId}`);
//         await session.abortTransaction();
//         session.endSession();
//         return res.status(200).json({ received: true, duplicate: true });
//       } else {
//         logger.warn("⚠️ Payment already processed or not found:", subscriptionPaymentId);
//         await session.abortTransaction();
//         session.endSession();
//         return res.status(200).json({ received: true, duplicate: true });
//       }
//     }

//     user = await User.findById(userId).session(session);
//     if (!user) {
//       logger.error("❌ User not found:", userId);
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(200).json({ received: true });
//     }

//     const scenario = subPayment.scenario || metadata.scenario || "new";
//     activationStartDate = subPayment.startDateAfterPayment || new Date();
//     activationEndDate =
//       subPayment.endDateAfterPayment ||
//       addMonths(activationStartDate, plan.durationMonths || 12);

//     user.role = "artist";
//     user.subscription = {
//       plan: planId,
//       startDate: activationStartDate,
//       endDate: activationEndDate,
//       isActive: true,
//       pricePaid: subPayment.amount,
//       moyasarPaymentId: event.id,
//       moyasarPaymentStatus: event.status,
//       autoRenew: true,
//       reminderSent: false,
//     };

//     if (scenario === "new" || scenario === "renewal") {
//       user.freeShippingUsed = 0;
//       logger.info(`🔄 Free shipping quota reset for user ${userId} (${scenario})`);
//     } else if (scenario === "upgrade") {
//       logger.info(`⬆️ Upgrade: keeping current quota (used: ${user.freeShippingUsed || 0})`);
//     }

//     await user.save({ session });

//     let wallet = await Wallet.findOne({ user: userId }).session(session);
//     if (!wallet) {
//       wallet = new Wallet({ user: userId });
//       await wallet.save({ session });
//       logger.info("✅ Created new wallet for artist:", userId);
//     }

//     await session.commitTransaction();
//     logger.info(`✅ Transaction committed for user ${userId}`);
//   } catch (error) {
//     if (session.inTransaction()) {
//       await session.abortTransaction();
//     }
//     session.endSession();
//     logger.error("❌ Subscription webhook transaction error:", error);

//     const isTransient =
//       error?.codeName === "WriteConflict" ||
//       error?.code === 112 ||
//       error?.errorLabels?.includes?.("TransientTransactionError");

//     if (isTransient) {
//       return res.status(500).json({ received: false, retry: true, error: error.message });
//     }
//     return res.status(200).json({ received: true, error: error.message });
//   }

//   session.endSession();

//   try {
//     eventEmitter.safeEmit(EVENTS.SUBSCRIPTION_ACTIVATED, {
//       userId: user._id,
//       email: user.email,
//       name: user.name,
//       planId,
//       planLabel: plan.label,
//       startDate: activationStartDate,
//       endDate: activationEndDate,
//     });

//     logger.info(
//       `✅ Subscription activated for user ${userId}, plan: ${planId}, ` +
//         `from ${activationStartDate.toISOString()} to ${activationEndDate.toISOString()}`,
//     );
//   } catch (eventError) {
//     logger.error("❌ Event emission error (non-critical):", eventError);
//   }

//   return res.status(200).json({ received: true });
// });

const handleSubscriptionWebhook = catchAsync(async (req, res, next) => {
  const event = req.body;

  logger.info(`📥 Subscription webhook received, status: ${event.status}`);

  if (event.status !== "paid") {
    logger.info(`⚠️ Ignoring non-paid event, status: ${event.status}`);
    return res.status(200).json({ received: true });
  }

  const metadata = event.metadata || {};
  let { subscriptionPaymentId, userId, planId } = metadata;
  const moyasarTransactionId = event.id;

  // ═══════════════════════════════════════════════════
  //  IDEMPOTENCY CHECK
  // ═══════════════════════════════════════════════════
  if (moyasarTransactionId) {
    const existingPayment = await SubscriptionPayment.findOne({
      $or: [
        { moyasarTransactionId },
        { moyasarPaymentId: moyasarTransactionId },
      ],
      status: "PAID",
    }).lean();

    if (existingPayment) {
      logger.warn(
        `⚠️ Payment already processed (idempotent by Moyasar transaction): ${moyasarTransactionId}`,
      );
      return res.status(200).json({ received: true, duplicate: true });
    }
  }

  if (!subscriptionPaymentId) {
    const invoiceId = event.invoice_id || event.id;
    const found = await SubscriptionPayment.findOne({
      $or: [
        { moyasarPaymentId: invoiceId },
        { moyasarTransactionId: event.id },
        { moyasarPaymentId: event.id },
      ],
    });
    if (!found) {
      logger.info(
        "⚠️ Not a subscription payment (no metadata, no invoice match)",
      );
      return res.status(200).json({ received: true });
    }
    subscriptionPaymentId = found._id.toString();
    userId = found.user?.toString();
    planId = found.plan;
    logger.info(`♻️ Resolved via invoice_id lookup: ${subscriptionPaymentId}`);
  }

  const plan = PLAN_CONFIG[planId];
  if (!plan || !subscriptionPaymentId || !userId) {
    logger.error("❌ Missing/invalid plan or ids after resolution");
    return res.status(200).json({ received: true });
  }

  // ═══════════════════════════════════════════════════
  //  IDEMPOTENCY CHECK
  // ═══════════════════════════════════════════════════
  const existingPayment = await SubscriptionPayment.findById(
    subscriptionPaymentId,
  ).lean();
  if (existingPayment && existingPayment.status === "PAID") {
    logger.warn(
      `⚠️ Payment already processed (idempotent by ID): ${subscriptionPaymentId}`,
    );
    return res.status(200).json({ received: true, duplicate: true });
  }
  if (
    existingPayment?.status === "EXPIRED" &&
    existingPayment.failureReason === REPLACED_REASON
  ) {
    logger.warn(
      `⚠️ Payment received on replaced invoice ${subscriptionPaymentId} — initiating auto-refund`,
    );
    const refund = await refundLatePaymentForReplacedInvoice(
      subscriptionPaymentId,
      moyasarTransactionId,
      event.amount,
      existingPayment.amount,
    );
    return res.status(200).json({
      received: true,
      action: refund.claimed
        ? "auto_refund_triggered"
        : "auto_refund_already_handled",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  let user = null;
  let activationStartDate = null;
  let activationEndDate = null;

  try {
    let subPayment = await SubscriptionPayment.findOneAndUpdate(
      { _id: subscriptionPaymentId, status: "PENDING" },
      {
        $set: {
          status: "PAID",
          moyasarPaymentStatus: event.status,
          moyasarTransactionId,
          paidAt: new Date(),
        },
      },
      { session, new: true },
    );

    if (!subPayment) {
      const anyPayment = await SubscriptionPayment.findById(
        subscriptionPaymentId,
      ).session(session);

      if (anyPayment && anyPayment.status === "EXPIRED") {
        if (anyPayment.failureReason === REPLACED_REASON) {
          logger.warn(
            `⚠️ Payment raced with replacement for subscription invoice (${subscriptionPaymentId}).`,
          );
          await session.abortTransaction();
          session.endSession();
          const refund = await refundLatePaymentForReplacedInvoice(
            subscriptionPaymentId,
            moyasarTransactionId,
            event.amount,
            anyPayment.amount,
          );
          return res.status(200).json({
            received: true,
            action: refund.claimed
              ? "auto_refund_triggered"
              : "auto_refund_already_handled",
          });
        }
        logger.warn(
          `⚠️ Payment succeeded on EXPIRED record (${subscriptionPaymentId}) — honoring anyway.`,
        );
        anyPayment.status = "PAID";
        anyPayment.moyasarPaymentStatus = event.status;
        anyPayment.moyasarTransactionId = moyasarTransactionId;
        anyPayment.paidAt = new Date();
        await anyPayment.save({ session });
        subPayment = anyPayment;
      } else {
        logger.warn(
          `⚠️ Payment already processed (idempotent): ${subscriptionPaymentId}`,
        );
        await session.abortTransaction();
        session.endSession();
        return res.status(200).json({ received: true, duplicate: true });
      }
    }

    user = await User.findById(userId).session(session);
    if (!user) {
      logger.error(`❌ User not found: ${userId}`);
      await session.abortTransaction();
      session.endSession();
      return res.status(200).json({ received: true });
    }

    const scenario = subPayment.scenario || metadata.scenario || "new";
    activationStartDate = subPayment.startDateAfterPayment || new Date();
    activationEndDate =
      subPayment.endDateAfterPayment ||
      addMonths(activationStartDate, plan.durationMonths || 12);

    user.role = "artist";
    user.subscription = {
      plan: planId,
      startDate: activationStartDate,
      endDate: activationEndDate,
      isActive: true,
      pricePaid: subPayment.amount,
      moyasarPaymentId: event.id,
      moyasarPaymentStatus: event.status,
      autoRenew: true,
      reminderSent: false,
    };

    if (scenario === "new" || scenario === "renewal") {
      user.freeShippingUsed = 0;
    }

    if (subPayment.coupon && subPayment.couponRedemption) {
      logger.info(
        `💰 Redeeming coupon ${subPayment.couponCode}: ` +
          `${subPayment.discountAmount} SAR discount (${subPayment.discountPercent}%) ` +
          `on ${subPayment.originalAmount} SAR → final ${subPayment.amount} SAR`,
      );
      const redemption = await CouponRedemption.findOneAndUpdate(
        { _id: subPayment.couponRedemption, status: "PENDING" },
        { $set: { status: "REDEEMED", redeemedAt: new Date() } },
        { session, new: true },
      );
      if (redemption) {
        await Coupon.updateOne(
          { _id: subPayment.coupon, reservedCount: { $gt: 0 } },
          { $inc: { reservedCount: -1, usedCount: 1 } },
          { session },
        );
      }
    }

    await user.save({ session });

    let wallet = await Wallet.findOne({ user: userId }).session(session);
    if (!wallet) {
      wallet = new Wallet({ user: userId });
      await wallet.save({ session });
    }

    await session.commitTransaction();
    logger.info(`✅ Transaction committed for user ${userId}`);
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    logger.error(`❌ Subscription webhook transaction error: ${error.message}`);

    const isTransient =
      error?.codeName === "WriteConflict" ||
      error?.code === 112 ||
      error?.errorLabels?.includes?.("TransientTransactionError");

    if (isTransient) {
      return res
        .status(500)
        .json({ received: false, retry: true, error: error.message });
    }
    return res.status(200).json({ received: true, error: error.message });
  }

  session.endSession();

  try {
    eventEmitter.safeEmit(EVENTS.SUBSCRIPTION_ACTIVATED, {
      userId: user._id,
      email: user.email,
      name: user.name,
      planId,
      planLabel: plan.label,
      startDate: activationStartDate,
      endDate: activationEndDate,
    });
  } catch (eventError) {
    logger.error(
      `❌ Event emission error (non-critical): ${eventError.message}`,
    );
  }

  return res.status(200).json({ received: true });
});

module.exports = {
  purchaseSubscription,
  getMySubscription,
  getMySubscriptionPayments,
  handleSubscriptionWebhook,
  getSubscriptionQuote,
  getCheckoutDetails,
  validateCoupon,
};
