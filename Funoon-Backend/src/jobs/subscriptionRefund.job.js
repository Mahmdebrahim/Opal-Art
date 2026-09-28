const SubscriptionPayment = require("../models/SubscriptionPayment");
const logger = require("../utils/logger");
const {
  REPLACED_REASON,
  processReplacedSubscriptionRefund,
} = require("../services/subscription-refund.service");

const MAX_REFUND_ATTEMPTS = 6;

async function retrySubscriptionRefunds() {
  try {
    const payments = await SubscriptionPayment.find({
      status: "EXPIRED",
      failureReason: REPLACED_REASON,
      refundStatus: "FAILED",
      refundAttempts: { $lt: MAX_REFUND_ATTEMPTS },
    }).select("_id").limit(25);

    for (const payment of payments) {
      const claimed = await SubscriptionPayment.findOneAndUpdate(
        { _id: payment._id, refundStatus: "FAILED" },
        { $set: { refundStatus: "PENDING", refundRequestedAt: new Date() }, $inc: { refundAttempts: 1 } },
      );
      if (claimed) await processReplacedSubscriptionRefund(payment._id);
    }
  } catch (error) {
    logger.error(`Subscription refund retry job error: ${error.message}`);
  }
}

function startSubscriptionRefundJob() {
  const intervalMs = Number(process.env.SUBSCRIPTION_REFUND_RETRY_INTERVAL_MS || 5 * 60 * 1000);
  setTimeout(retrySubscriptionRefunds, 60 * 1000);
  setInterval(retrySubscriptionRefunds, intervalMs);
  logger.info(`Subscription refund retry job started (every ${intervalMs / 60000} min)`);
}

module.exports = { startSubscriptionRefundJob, retrySubscriptionRefunds };
