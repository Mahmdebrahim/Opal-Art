const Order = require("../models/Order");
const Artwork = require("../models/Artwork");
const User = require("../models/User");
const MoyasarService = require("../services/payment/moyasar.service");
const logger = require("../utils/logger");

const EXPIRE_AFTER_MINUTES = Number(process.env.ORDER_EXPIRE_MINUTES);

async function cleanupExpiredOrders() {
  const cutoff = new Date(Date.now() - EXPIRE_AFTER_MINUTES * 60 * 1000);

  try {
    const expiredOrders = await Order.find({
      status: "PENDING_PAYMENT",
      createdAt: { $lte: cutoff },
    })
      .select("items buyer artist payment financials")
      .populate("artist", "subscription.plan name")
      .limit(50);

    if (expiredOrders.length === 0) return;

    logger.info(`🧹 Found ${expiredOrders.length} expired pending orders`);

    let cancelledCount = 0;
    let quotaReversedCount = 0;
    let artworksReleasedCount = 0;

    for (const order of expiredOrders) {
      try {
        // 1. Cancel invoice
        if (order.payment?.invoiceId) {
          try {
            await MoyasarService.cancelInvoice(order.payment.invoiceId);
          } catch (err) {
            logger.debug(`Invoice cancel skipped: ${err.message}`);
          }
        }

        // 2. Cancel order (update بدل save)
        await Order.updateOne(
          { _id: order._id, status: "PENDING_PAYMENT" },
          {
            $set: {
              status: "CANCELLED",
              cancelledAt: new Date(),
              cancellationReason: "expired_pending_order",
            },
          },
        );
        cancelledCount++;

        // 3. Release artworks
        const artworkIds = order.items.map((i) => i.artwork);
        const result = await Artwork.updateMany(
          {
            _id: { $in: artworkIds },
            reservedBy: order.buyer,
            isSold: false,
          },
          { $set: { reservedBy: null, reservedUntil: null } },
        );
        artworksReleasedCount += result.modifiedCount;

        // 4. Reverse quota
        if (
          order.financials?.platformShippingExpense > 0 &&
          order.artist?.subscription?.plan === "opal_prestige"
        ) {
          const reversed = await User.updateOne(
            { _id: order.artist._id, freeShippingUsed: { $gt: 0 } },
            { $inc: { freeShippingUsed: -1 } },
          );
          if (reversed.modifiedCount > 0) quotaReversedCount++;
        }
      } catch (orderErr) {
        logger.error(
          `❌ Failed to cleanup order ${order._id}: ${orderErr.message}`,
        );
      }
    }

    logger.info(
      `✅ Cleanup: ${cancelledCount} cancelled, ${artworksReleasedCount} released, ${quotaReversedCount} reversed`,
    );
  } catch (error) {
    logger.error(`❌ Cleanup job error: ${error.message}`);
  }
}

function startExpiredOrdersCleanupJob() {
  const intervalMs = Number(process.env.CLEANUP_INTERVAL_MS || 2 * 60 * 1000);

  setTimeout(cleanupExpiredOrders, 30 * 1000);

  setInterval(cleanupExpiredOrders, intervalMs);

  logger.info(
    `🧹 Expired orders cleanup started ` +
      `(every ${intervalMs / 60000} min, expire after ${EXPIRE_AFTER_MINUTES} min)`,
  );
}

module.exports = { startExpiredOrdersCleanupJob, cleanupExpiredOrders };
