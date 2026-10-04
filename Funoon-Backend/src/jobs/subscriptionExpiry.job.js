const cron = require("node-cron");
const User = require("../models/User");
const eventEmitter = require("../events/event-emitter");
const EVENTS = require("../events/events");
const logger = require("../utils/logger");

const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function runSubscriptionExpiryJob() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiredUsers = await User.find({
      "subscription.isActive": true,
      "subscription.endDate": { $lt: today },
    }).select(
      "_id name email subscription.plan subscription.endDate subscription.lastReminderSentAt",
    );

    logger.info(
      `⏰ Found ${expiredUsers.length} expired subscription(s) to deactivate`,
    );

    let deactivatedCount = 0;

    for (const user of expiredUsers) {
      const endDate = new Date(user.subscription.endDate);
      const daysSinceExpiry = Math.round((today - endDate) / MS_PER_DAY);

      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            "subscription.isActive": false,
            verifiedBadge: false,
            freeShippingUsed: 0,
          },
        },
      );

      deactivatedCount++;
      logger.info(
        `🔒 Subscription expired for user ${user._id} (${user.name}) — expired ${daysSinceExpiry} day(s) ago`,
      );

      const planConfig = User.PLAN_CONFIG?.[user.subscription.plan];
      const planLabel = planConfig?.labelAr || user.subscription.plan;

      eventEmitter.safeEmit(EVENTS.SUBSCRIPTION_EXPIRED, {
        userId: user._id,
        email: user.email,
        name: user.name,
        planId: user.subscription.plan,
        planLabel,
        daysSinceExpiry,
      });
    }

    logger.info(
      `✅ Subscription expiry job completed: deactivated=${deactivatedCount}`,
    );
  } catch (error) {
    logger.error(`❌ Subscription expiry job error: ${error.message}`);
  }
}

/**
 * ✅ Schedule Subscription Expiry Cron Job (Daily at 9:05 AM)
 */
function startSubscriptionExpiryJob() {
  cron.schedule("52 1 * * *", runSubscriptionExpiryJob);
  logger.info("⏰ Subscription expiry cron job scheduled (daily at 9:05 AM)");
}

module.exports = {
  startSubscriptionExpiryJob,
  runSubscriptionExpiryJob,
};