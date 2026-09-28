const SubscriptionPayment = require("../models/SubscriptionPayment");
const User = require("../models/User");
const MoyasarService = require("./payment/moyasar.service");
const EmailService = require("./email.service");
const logger = require("../utils/logger");

const REPLACED_REASON = "REPLACED_BY_NEW_CHECKOUT";

const processReplacedSubscriptionRefund = async (paymentId) => {
  const payment = await SubscriptionPayment.findOne({
    _id: paymentId,
    status: "EXPIRED",
    failureReason: REPLACED_REASON,
    refundStatus: "PENDING",
  });

  if (!payment) return { processed: false };

  try {
    const result = await MoyasarService.refundPayment(payment.refundPaymentId, {
      amount: Math.round(payment.refundedAmount * 100),
      reason: "Late payment on a replaced subscription checkout",
    });

    const updated = await SubscriptionPayment.findOneAndUpdate(
      { _id: payment._id, refundStatus: "PENDING" },
      {
        $set: {
          refundStatus: "REFUNDED",
          refundedAt: new Date(),
          refundFailureReason: null,
          refundReference: result?.id || null,
        },
      },
      { new: true },
    );

    if (!updated) return { processed: false };

    const user = await User.findById(updated.user).select("name email");
    if (user && !updated.refundEmailSentAt) {
      const sent = await EmailService.sendSubscriptionReplacementRefundEmail(
        user,
        updated.refundedAmount,
      );
      if (sent) {
        await SubscriptionPayment.updateOne(
          { _id: updated._id, refundEmailSentAt: null },
          { $set: { refundEmailSentAt: new Date() } },
        );
      }
    }

    logger.info(`✅ Refunded late payment ${payment.refundPaymentId} for subscription ${payment._id}`);
    return { processed: true, refunded: true };
  } catch (error) {
    await SubscriptionPayment.updateOne(
      { _id: payment._id, refundStatus: "PENDING" },
      { $set: { refundStatus: "FAILED", refundFailureReason: error.message } },
    );
    logger.error(`🚨 Subscription refund failed for ${payment._id}: ${error.message}`);
    return { processed: true, refunded: false, error: error.message };
  }
};

module.exports = { REPLACED_REASON, processReplacedSubscriptionRefund };
