// src/jobs/cleanupExpiredSubscriptionPayments.js
const SubscriptionPayment = require("../models/SubscriptionPayment");
const MoyasarService = require("../services/payment/moyasar.service");
const logger = require("../utils/logger");
const { releaseCouponReservation } = require("../services/coupon.service");

const EXPIRE_MINUTES = Number(
  process.env.SUBSCRIPTION_PAYMENT_EXPIRE_MINUTES || 15,
);

async function cleanupExpiredSubscriptionPayments() {
  const cutoff = new Date(Date.now() - EXPIRE_MINUTES * 60 * 1000);

  try {
    const expired = await SubscriptionPayment.find(
      { status: "PENDING", createdAt: { $lt: cutoff } },
      { _id: 1, moyasarPaymentId: 1, coupon: 1, couponRedemption: 1 } 
    ).limit(100); 

    if (expired.length === 0) return;

    logger.info(`🧹 Found ${expired.length} expired subscription payments`);

    await Promise.all(
      expired
        .filter((p) => p.moyasarPaymentId)
        .map(async (payment) => {
          try {
            await MoyasarService.cancelInvoice(payment.moyasarPaymentId);
          } catch (err) {
            logger.debug(`Invoice ${payment.moyasarPaymentId} cancel skipped`);
          }
        })
    );

    // 3. Update in one operation (بدل loop + save)
    const result = await SubscriptionPayment.updateMany(
      { _id: { $in: expired.map((p) => p._id) } },
      { $set: { status: "EXPIRED" } }
    );

    await Promise.all(expired.map(releaseCouponReservation));

    logger.info(`✅ ${result.modifiedCount} subscription payments marked expired`);
  } catch (error) {
    logger.error(`❌ Subscription cleanup job error: ${error.message}`);
  }
}

function startSubscriptionCleanupJob() {
  const intervalMs = Number(
    process.env.SUBSCRIPTION_CLEANUP_INTERVAL_MS || 2 * 60 * 1000,
  );

  setTimeout(cleanupExpiredSubscriptionPayments, 45 * 1000);
  setInterval(cleanupExpiredSubscriptionPayments, intervalMs);

  logger.info(
    `🧹 Subscription payments cleanup started (every ${intervalMs / 60000} min, expire after ${EXPIRE_MINUTES} min)`,
  );
}

module.exports = {
  startSubscriptionCleanupJob,
  cleanupExpiredSubscriptionPayments,
};
